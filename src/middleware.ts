import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "agentguard_session";

const PROTECTED_CLIENT_PREFIXES = [
  "/dashboard",
  "/shopping-agent",
  "/agents",
  "/policies",
  "/approvals",
  "/transactions",
  "/risk",
  "/notifications",
  "/paypal",
  "/settings",
  "/onboarding",
];

const AUTH_PAGES = ["/login", "/signup", "/forgot-password"];

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function decodeTokenEdge(token: string): Promise<Record<string, any> | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
    const candidateSecrets = Array.from(
      new Set(
        [
          process.env.AUTH_SECRET,
          "AI_GAURD_SL_PAYPAL",
          "agentguard-dev-fallback-secret-change-in-production-987654321",
        ].filter((s): s is string => Boolean(s && s.length >= 16))
      )
    );

    const encoder = new TextEncoder();
    const data = encoder.encode(`${headerB64}.${payloadB64}`);
    const signature = base64UrlToUint8Array(signatureB64);

    let verified = false;
    for (const secretStr of candidateSecrets) {
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secretStr),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
      );
      const isValid = await crypto.subtle.verify(
        "HMAC",
        key,
        signature as BufferSource,
        data
      );
      if (isValid) {
        verified = true;
        break;
      }
    }

    if (!verified) return null;

    const payloadJson = new TextDecoder().decode(
      base64UrlToUint8Array(payloadB64)
    );
    const payload = JSON.parse(payloadJson);

    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isClientProtected = PROTECTED_CLIENT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  const isAdminRoute =
    pathname === "/admin" || pathname.startsWith("/admin/");
  const isAdminApi = pathname.startsWith("/api/admin");
  const isAuthPage = AUTH_PAGES.some((p) => pathname === p);

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await decodeTokenEdge(token) : null;

  if (isAdminApi) {
    if (!session) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }
    if (session.role !== "ADMIN") {
      return NextResponse.json(
        {
          success: false,
          message: "Access denied. Administrator role required.",
        },
        { status: 403 }
      );
    }
    return NextResponse.next();
  }

  if (isAdminRoute) {
    if (!session) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (session.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard?error=forbidden", request.url));
    }
    return NextResponse.next();
  }

  if (isClientProtected && !session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPage && session) {
    if (session.role === "ADMIN") {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }
    if (!session.onboardingCompleted) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }
    return NextResponse.redirect(new URL("/shopping-agent", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/shopping-agent/:path*",
    "/agents/:path*",
    "/policies/:path*",
    "/approvals/:path*",
    "/transactions/:path*",
    "/risk/:path*",
    "/notifications/:path*",
    "/paypal/:path*",
    "/settings/:path*",
    "/onboarding/:path*",
    "/admin/:path*",
    "/api/admin/:path*",
    "/login",
    "/signup",
    "/forgot-password",
  ],
};
