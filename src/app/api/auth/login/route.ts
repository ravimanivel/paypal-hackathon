import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import { User } from "@/models/User";
import { loginSchema } from "@/lib/validators";
import { setSessionCookie, verifyPassword } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { recordAuditLog } from "@/lib/security/audit";
import { ensureControlledAdminExists, ensureDefaultUserAgents } from "@/lib/db/seed-defaults";
import { apiError, apiSuccess, handleApiError } from "@/lib/utils";

const GENERIC_LOGIN_ERROR = "Invalid email address or password.";

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const body = await req.json();
    const parsed = loginSchema.parse(body);
    const normalizedEmail = parsed.email.trim().toLowerCase();

    const rate = checkRateLimit(`login:${ip}:${normalizedEmail}`, 8, 60_000);
    if (!rate.allowed) {
      await recordAuditLog({
        userId: null,
        actorRole: "SYSTEM",
        action: "LOGIN_RATE_LIMIT_EXCEEDED",
        entityType: "USER",
        metadata: { email: normalizedEmail, ip },
      });
      return apiError(
        "Too many failed login attempts. Please wait 60 seconds before trying again.",
        429
      );
    }

    await connectDB();
    await ensureControlledAdminExists();

    const user = await User.findOne({ email: normalizedEmail }).select(
      "+passwordHash"
    );

    if (!user || !user.passwordHash) {
      await recordAuditLog({
        userId: null,
        actorRole: "USER",
        action: "USER_LOGIN_FAILED",
        entityType: "USER",
        metadata: { email: normalizedEmail, reason: "Account not found" },
      });
      return apiError(GENERIC_LOGIN_ERROR, 401);
    }

    const isPasswordValid = await verifyPassword(
      parsed.password,
      user.passwordHash
    );
    if (!isPasswordValid) {
      await recordAuditLog({
        userId: user._id,
        actorRole: user.role,
        action: "USER_LOGIN_FAILED",
        entityType: "USER",
        entityId: String(user._id),
        metadata: { email: normalizedEmail, reason: "Invalid credentials" },
      });
      return apiError(GENERIC_LOGIN_ERROR, 401);
    }

    if (user.accountStatus !== "ACTIVE") {
      await recordAuditLog({
        userId: user._id,
        actorRole: user.role,
        action: "USER_LOGIN_BLOCKED_STATUS",
        entityType: "USER",
        entityId: String(user._id),
        metadata: { accountStatus: user.accountStatus },
      });
      return apiError(
        `Your account is currently ${user.accountStatus.toLowerCase()}. Please contact an administrator.`,
        403
      );
    }

    user.lastLoginAt = new Date();
    await user.save();

    if (user.role === "USER") {
      await ensureDefaultUserAgents(String(user._id));
    }

    const sessionPayload = {
      userId: String(user._id),
      email: user.email,
      name: user.name,
      role: user.role,
      preferredCurrency: user.preferredCurrency,
      onboardingCompleted: user.onboardingCompleted,
    };

    await setSessionCookie(sessionPayload, parsed.rememberMe);

    await recordAuditLog({
      userId: user._id,
      actorRole: user.role,
      action: "USER_LOGIN_SUCCESS",
      entityType: "USER",
      entityId: String(user._id),
      metadata: {
        email: user.email,
        role: user.role,
        rememberMe: parsed.rememberMe,
      },
    });

    return apiSuccess(
      {
        user: {
          id: String(user._id),
          name: user.name,
          email: user.email,
          role: user.role,
          accountStatus: user.accountStatus,
          preferredCurrency: user.preferredCurrency,
          onboardingCompleted: user.onboardingCompleted,
          onboardingStep: user.onboardingStep || 1,
          onboardingDraft: user.onboardingDraft || {},
          lastActivePath: user.lastActivePath || "/dashboard",
          paypalConnected: user.paypalConnected,
        },
      },
      "Logged in successfully"
    );
  } catch (error) {
    return handleApiError(error);
  }
}

