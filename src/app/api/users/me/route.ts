import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongodb";
import { requireAuth, setSessionCookie } from "@/lib/auth/session";
import { User } from "@/models/User";
import { Policy } from "@/models/Policy";
import { recordAuditLog } from "@/lib/security/audit";
import { apiError, apiSuccess, handleApiError } from "@/lib/utils";
import { passwordSchema } from "@/lib/validators";
import { hashPassword, verifyPassword } from "@/lib/auth/session";

const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  preferredCurrency: z.enum(["INR", "USD", "EUR", "GBP"]).optional(),
  paypalConnected: z.boolean().optional(),
  paypalSandboxPayerEmail: z.string().email().optional().or(z.literal("")),
  onboardingStep: z.number().int().min(1).max(3).optional(),
  onboardingDraft: z.record(z.unknown()).optional(),
  lastActivePath: z.string().trim().max(200).optional(),
  currentPassword: z.string().optional(),
  newPassword: passwordSchema.optional(),
});

export async function GET() {
  try {
    const session = await requireAuth();
    await connectDB();

    const user = await User.findById(session.userId).lean();
    if (!user) {
      return apiError("User not found", 404);
    }

    return apiSuccess({
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
        paypalSandboxPayerEmail: user.paypalSandboxPayerEmail || "",
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();

    // Prevent unauthorized role escalation attempts
    if ("role" in body || "accountStatus" in body) {
      await recordAuditLog({
        userId: session.userId,
        actorRole: session.role,
        action: "BLOCKED_PRIVILEGE_ESCALATION_ATTEMPT",
        entityType: "USER",
        entityId: session.userId,
      });
      return apiError(
        "Security violation: Role or account status cannot be modified via profile endpoint.",
        403
      );
    }

    const parsed = updateProfileSchema.parse(body);
    await connectDB();

    const user = await User.findById(session.userId).select("+passwordHash");
    if (!user) {
      return apiError("User not found", 404);
    }

    if (parsed.newPassword) {
      if (!parsed.currentPassword) {
        return apiError(
          "Current password is required to set a new password.",
          400
        );
      }
      const isValidCurrent = await verifyPassword(
        parsed.currentPassword,
        user.passwordHash
      );
      if (!isValidCurrent) {
        return apiError("Current password is incorrect.", 400);
      }
      user.passwordHash = await hashPassword(parsed.newPassword);
    }

    if (parsed.name !== undefined) {
      user.name = parsed.name;
    }

    if (parsed.preferredCurrency !== undefined) {
      user.preferredCurrency = parsed.preferredCurrency;
      // Also keep user's policy currency aligned if requested
      await Policy.findOneAndUpdate(
        { userId: user._id },
        { $set: { currency: parsed.preferredCurrency } }
      );
    }

    if (parsed.paypalConnected !== undefined) {
      user.paypalConnected = parsed.paypalConnected;
    }

    if (parsed.paypalSandboxPayerEmail !== undefined) {
      user.paypalSandboxPayerEmail = parsed.paypalSandboxPayerEmail || undefined;
    }

    if (parsed.onboardingStep !== undefined) {
      user.onboardingStep = parsed.onboardingStep;
    }

    if (parsed.onboardingDraft !== undefined) {
      user.onboardingDraft = parsed.onboardingDraft;
    }

    if (
      parsed.lastActivePath !== undefined &&
      parsed.lastActivePath.startsWith("/")
    ) {
      user.lastActivePath = parsed.lastActivePath;
    }

    await user.save();

    const isQuietStateSync =
      parsed.name === undefined &&
      parsed.preferredCurrency === undefined &&
      parsed.paypalConnected === undefined &&
      !parsed.newPassword;

    if (!isQuietStateSync) {
      await setSessionCookie({
        userId: String(user._id),
        email: user.email,
        name: user.name,
        role: user.role,
        preferredCurrency: user.preferredCurrency,
        onboardingCompleted: user.onboardingCompleted,
      });

      await recordAuditLog({
        userId: user._id,
        actorRole: user.role,
        action: "USER_PROFILE_UPDATED",
        entityType: "USER",
        entityId: String(user._id),
        metadata: {
          preferredCurrency: user.preferredCurrency,
          paypalConnected: user.paypalConnected,
          passwordChanged: Boolean(parsed.newPassword),
        },
      });
    }

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
          paypalSandboxPayerEmail: user.paypalSandboxPayerEmail || "",
        },
      },
      "Profile updated successfully"
    );
  } catch (error) {
    return handleApiError(error);
  }
}

