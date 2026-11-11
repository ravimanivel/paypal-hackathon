import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongodb";
import { User } from "@/models/User";
import { emailSchema, passwordSchema } from "@/lib/validators";
import {
  generateSecureToken,
  hashPassword,
  hashToken,
} from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { recordAuditLog } from "@/lib/security/audit";
import { apiError, apiSuccess, handleApiError } from "@/lib/utils";

const requestResetSchema = z.object({
  action: z.literal("request"),
  email: emailSchema,
});

const confirmResetSchema = z.object({
  action: z.literal("reset"),
  email: emailSchema,
  token: z.string().min(16),
  newPassword: passwordSchema,
});

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const rate = checkRateLimit(`forgot-pwd:${ip}`, 6, 60_000);
    if (!rate.allowed) {
      return apiError("Too many requests. Please wait a minute.", 429);
    }

    const body = await req.json();
    await connectDB();

    if (body.action === "reset") {
      const parsed = confirmResetSchema.parse(body);
      const user = await User.findOne({ email: parsed.email }).select(
        "+resetTokenHash +resetTokenExpiresAt"
      );

      const candidateHash = hashToken(parsed.token);
      if (
        !user ||
        !user.resetTokenHash ||
        user.resetTokenHash !== candidateHash ||
        !user.resetTokenExpiresAt ||
        new Date(user.resetTokenExpiresAt).getTime() <= Date.now()
      ) {
        return apiError(
          "Invalid or expired password reset token.",
          400
        );
      }

      user.passwordHash = await hashPassword(parsed.newPassword);
      user.resetTokenHash = undefined;
      user.resetTokenExpiresAt = undefined;
      await user.save();

      await recordAuditLog({
        userId: user._id,
        actorRole: user.role,
        action: "PASSWORD_RESET_COMPLETED",
        entityType: "USER",
        entityId: String(user._id),
      });

      return apiSuccess(
        { reset: true },
        "Password has been reset successfully. You may now sign in."
      );
    }

    const parsed = requestResetSchema.parse(body);
    const user = await User.findOne({ email: parsed.email });

    if (user) {
      const rawToken = generateSecureToken(24);
      user.resetTokenHash = hashToken(rawToken);
      user.resetTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await user.save();

      await recordAuditLog({
        userId: user._id,
        actorRole: user.role,
        action: "PASSWORD_RESET_REQUESTED",
        entityType: "USER",
        entityId: String(user._id),
      });
    }

    // Generic response to prevent account enumeration
    return apiSuccess(
      {
        requested: true,
        emailDeliveryConfigured: false,
      },
      "If an account exists for that email address, a short-lived single-use reset token has been generated."
    );
  } catch (error) {
    return handleApiError(error);
  }
}

