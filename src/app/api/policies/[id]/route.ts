import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/mongodb";
import { requireAuth } from "@/lib/auth/session";
import { Policy } from "@/models/Policy";
import { policyInputSchema } from "@/lib/validators";
import { toMajorUnits, toMinorUnits } from "@/lib/utils/currency";
import { recordAuditLog } from "@/lib/security/audit";
import { apiError, apiSuccess, handleApiError } from "@/lib/utils";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await context.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return apiError("Invalid policy ID", 400);
    }

    await connectDB();
    const policy = await Policy.findById(id);
    if (!policy) {
      return apiError("Financial policy not found", 404);
    }

    // Strict ownership verification
    if (String(policy.userId) !== String(session.userId)) {
      await recordAuditLog({
        userId: session.userId,
        actorRole: session.role,
        action: "UNAUTHORIZED_POLICY_MODIFICATION_ATTEMPT",
        entityType: "POLICY",
        entityId: id,
      });
      return apiError(
        "Access denied: You cannot modify another user's financial policy.",
        403
      );
    }

    const body = await req.json();
    const parsed = policyInputSchema.parse(body);

    policy.preset = parsed.preset || "CUSTOM";
    policy.currency = parsed.currency;
    policy.maxTransactionAmount = toMinorUnits(
      parsed.maxTransactionAmountMajor
    );
    policy.dailyLimit = toMinorUnits(parsed.dailyLimitMajor);
    policy.weeklyLimit = toMinorUnits(parsed.weeklyLimitMajor);
    policy.monthlyLimit = toMinorUnits(parsed.monthlyLimitMajor);
    policy.autoApprovalThreshold = toMinorUnits(
      parsed.autoApprovalThresholdMajor
    );
    policy.manualApprovalThreshold = toMinorUnits(
      parsed.manualApprovalThresholdMajor
    );
    policy.trustedMerchants = parsed.trustedMerchants;
    policy.blockedMerchants = parsed.blockedMerchants;
    policy.requireTrustedMerchantForAuto = parsed.requireTrustedMerchantForAuto;
    policy.duplicateProtection = parsed.duplicateProtection;
    policy.duplicateWindowMinutes = parsed.duplicateWindowMinutes;
    policy.autoApprovalEnabled = parsed.autoApprovalEnabled;
    policy.policyVersion = (policy.policyVersion || 1) + 1;

    await policy.save();

    await recordAuditLog({
      userId: session.userId,
      actorRole: session.role,
      action: "POLICY_UPDATED",
      entityType: "POLICY",
      entityId: String(policy._id),
      metadata: {
        policyVersion: policy.policyVersion,
        preset: policy.preset,
        currency: policy.currency,
        maxTransactionAmountMinor: policy.maxTransactionAmount,
        dailyLimitMinor: policy.dailyLimit,
      },
    });

    return apiSuccess(
      {
        policy: {
          id: String(policy._id),
          preset: policy.preset,
          currency: policy.currency,
          maxTransactionAmountMajor: toMajorUnits(policy.maxTransactionAmount),
          dailyLimitMajor: toMajorUnits(policy.dailyLimit),
          weeklyLimitMajor: toMajorUnits(policy.weeklyLimit),
          monthlyLimitMajor: toMajorUnits(policy.monthlyLimit),
          autoApprovalThresholdMajor: toMajorUnits(
            policy.autoApprovalThreshold
          ),
          manualApprovalThresholdMajor: toMajorUnits(
            policy.manualApprovalThreshold
          ),
          trustedMerchants: policy.trustedMerchants,
          blockedMerchants: policy.blockedMerchants,
          requireTrustedMerchantForAuto: policy.requireTrustedMerchantForAuto,
          duplicateProtection: policy.duplicateProtection,
          duplicateWindowMinutes: policy.duplicateWindowMinutes,
          autoApprovalEnabled: policy.autoApprovalEnabled,
          policyVersion: policy.policyVersion,
        },
      },
      `Policy updated to v${policy.policyVersion}`
    );
  } catch (error) {
    return handleApiError(error);
  }
}

