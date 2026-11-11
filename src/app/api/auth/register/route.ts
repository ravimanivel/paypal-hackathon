import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import { User } from "@/models/User";
import { registerSchema } from "@/lib/validators";
import { hashPassword, setSessionCookie } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createNotification, recordAuditLog } from "@/lib/security/audit";
import { ensureControlledAdminExists, ensureDefaultUserAgents } from "@/lib/db/seed-defaults";
import { apiError, apiSuccess, handleApiError } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const rate = checkRateLimit(`register:${ip}`, 10, 60_000);
    if (!rate.allowed) {
      return apiError(
        "Too many registration attempts. Please try again in a minute.",
        429
      );
    }

    const body = await req.json();
    const parsed = registerSchema.parse(body);

    await connectDB();
    await ensureControlledAdminExists();

    const normalizedEmail = parsed.email.trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail }).lean();
    if (existing) {
      return apiError(
        "An account with this email address already exists.",
        409
      );
    }

    const passwordHash = await hashPassword(parsed.password);

    // Security invariant: Public registration can ONLY create role = "USER"
    const newUser = await User.create({
      name: parsed.name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: "USER",
      accountStatus: "ACTIVE",
      preferredCurrency: "INR",
      onboardingCompleted: false,
      paypalConnected: false,
      lastLoginAt: new Date(),
    });

    await ensureDefaultUserAgents(String(newUser._id));

    const sessionPayload = {
      userId: String(newUser._id),
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
      preferredCurrency: newUser.preferredCurrency,
      onboardingCompleted: newUser.onboardingCompleted,
    };

    await setSessionCookie(sessionPayload, false);

    await recordAuditLog({
      userId: newUser._id,
      actorRole: "USER",
      action: "USER_REGISTERED",
      entityType: "USER",
      entityId: String(newUser._id),
      metadata: {
        email: newUser.email,
        role: newUser.role,
      },
    });

    await createNotification({
      userId: newUser._id,
      title: "Welcome to AgentGuard AI",
      message:
        "Your AI Payment Firewall account is active. Complete your 3-step protection setup to configure your spending limits.",
      type: "INFO",
      link: "/onboarding",
    });

    return apiSuccess(
      {
        user: {
          id: String(newUser._id),
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          accountStatus: newUser.accountStatus,
          preferredCurrency: newUser.preferredCurrency,
          onboardingCompleted: newUser.onboardingCompleted,
          paypalConnected: newUser.paypalConnected,
        },
      },
      "Account registered successfully",
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}

