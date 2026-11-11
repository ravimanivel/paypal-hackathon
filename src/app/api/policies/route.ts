import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import { requireAuth } from "@/lib/auth/session";
import { policyInputSchema } from "@/lib/validators";
import {
  getAggregatedSpending,
  getOrCreateUserPolicy,
  getPresetPolicyValues,
} from "@/services/policy.service";
import { toMajorUnits, toMinorUnits } from "@/lib/utils/currency";
import { recordAuditLog } from "@/lib/security/audit";
import { apiSuccess, handleApiError } from "@/lib/utils";

export async function GET() {
  try {
    const session = await requireAuth();
    await connectDB();

    const policy = await getOrCreateUserPolicy(
      session.userId,
      session.preferredCurrency
    );
    const spending = await getAggregatedSpending(
      session.userId,
      policy.currency
    );

    const presets = {
      RELAXED: getPresetPolicyValues("RELAXED", policy.currency),
      BALANCED: getPresetPolicyValues("BALANCED", policy.currency),
      STRICT: getPresetPolicyValues("STRICT", policy.currency),
    };

    return apiSuccess({
      policy: {
        id: String(policy._id),
        userId: String(policy.userId),
        preset: policy.preset,
        currency: policy.currency,
        maxTransactionAmountMinor: policy.maxTransactionAmount,
        maxTransactionAmountMajor: toMajorUnits(policy.maxTransactionAmount),
        dailyLimitMinor: policy.dailyLimit,
        dailyLimitMajor: toMajorUnits(policy.dailyLimit),
        weeklyLimitMinor: policy.weeklyLimit,
        weeklyLimitMajor: toMajorUnits(policy.weeklyLimit),
        monthlyLimitMinor: policy.monthlyLimit,
        monthlyLimitMajor: toMajorUnits(policy.monthlyLimit),
        autoApprovalThresholdMinor: policy.autoApprovalThreshold,
        autoApprovalThresholdMajor: toMajorUnits(policy.autoApprovalThreshold),
        manualApprovalThresholdMinor: policy.manualApprovalThreshold,
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
        updatedAt: policy.updatedAt,
      },
      spending: {
        dailySpentMinor: spending.dailySpentMinor,
        dailySpentMajor: toMajorUnits(spending.dailySpentMinor),
        weeklySpentMinor: spending.weeklySpentMinor,
        weeklySpentMajor: toMajorUnits(spending.weeklySpentMinor),
        monthlySpentMinor: spending.monthlySpentMinor,
        monthlySpentMajor: toMajorUnits(spending.monthlySpentMinor),
      },
      presets,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();
    const parsed = policyInputSchema.parse(body);

    await connectDB();
    const policy = await getOrCreateUserPolicy(
      session.userId,
      parsed.currency
    );

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
        autoApprovalThresholdMinor: policy.autoApprovalThreshold,
      },
    });

    return apiSuccess(
      { policyId: String(policy._id), policyVersion: policy.policyVersion },
      "Financial policy saved and version incremented"
    );
  } catch (error) {
    return handleApiError(error);
  }
}

