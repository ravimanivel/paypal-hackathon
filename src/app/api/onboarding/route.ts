import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import { requireAuth, setSessionCookie } from "@/lib/auth/session";
import { onboardingSchema } from "@/lib/validators";
import { User } from "@/models/User";
import { Policy } from "@/models/Policy";
import { getPresetPolicyValues } from "@/services/policy.service";
import { toMinorUnits } from "@/lib/utils/currency";
import { ensureDefaultUserAgents } from "@/lib/db/seed-defaults";
import { createNotification, recordAuditLog } from "@/lib/security/audit";
import { apiError, apiSuccess, handleApiError } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();
    const parsed = onboardingSchema.parse(body);

    await connectDB();

    const user = await User.findById(session.userId);
    if (!user) {
      return apiError("User not found", 404);
    }

    user.preferredCurrency = parsed.preferredCurrency;
    user.onboardingCompleted = true;
    user.onboardingStep = 3;
    user.lastActivePath = "/dashboard";
    user.paypalConnected = Boolean(parsed.connectPayPal);
    if (parsed.paypalSandboxPayerEmail) {
      user.paypalSandboxPayerEmail = parsed.paypalSandboxPayerEmail;
    }
    await user.save();

    const basePreset = getPresetPolicyValues(
      parsed.preset === "CUSTOM" ? "BALANCED" : parsed.preset,
      parsed.preferredCurrency
    );

    const policyValues =
      parsed.preset === "CUSTOM" && parsed.customPolicy
        ? {
            maxTransactionAmount: toMinorUnits(
              parsed.customPolicy.maxTransactionAmountMajor
            ),
            dailyLimit: toMinorUnits(parsed.customPolicy.dailyLimitMajor),
            weeklyLimit: toMinorUnits(parsed.customPolicy.weeklyLimitMajor),
            monthlyLimit: toMinorUnits(parsed.customPolicy.monthlyLimitMajor),
            autoApprovalThreshold: toMinorUnits(
              parsed.customPolicy.autoApprovalThresholdMajor
            ),
            manualApprovalThreshold: toMinorUnits(
              parsed.customPolicy.manualApprovalThresholdMajor
            ),
            requireTrustedMerchantForAuto:
              parsed.customPolicy.requireTrustedMerchantForAuto,
            duplicateProtection: parsed.customPolicy.duplicateProtection,
            autoApprovalEnabled: parsed.customPolicy.autoApprovalEnabled,
          }
        : basePreset;

    const existingPolicy = await Policy.findOne({ userId: user._id });
    let policy;
    if (existingPolicy) {
      existingPolicy.preset = parsed.preset;
      existingPolicy.currency = parsed.preferredCurrency;
      existingPolicy.maxTransactionAmount = policyValues.maxTransactionAmount;
      existingPolicy.dailyLimit = policyValues.dailyLimit;
      existingPolicy.weeklyLimit = policyValues.weeklyLimit;
      existingPolicy.monthlyLimit = policyValues.monthlyLimit;
      existingPolicy.autoApprovalThreshold = policyValues.autoApprovalThreshold;
      existingPolicy.manualApprovalThreshold =
        policyValues.manualApprovalThreshold;
      existingPolicy.requireTrustedMerchantForAuto =
        policyValues.requireTrustedMerchantForAuto;
      existingPolicy.duplicateProtection = policyValues.duplicateProtection;
      existingPolicy.autoApprovalEnabled = policyValues.autoApprovalEnabled;
      existingPolicy.policyVersion = (existingPolicy.policyVersion || 1) + 1;
      policy = await existingPolicy.save();
    } else {
      policy = await Policy.create({
        userId: user._id,
        preset: parsed.preset,
        currency: parsed.preferredCurrency,
        maxTransactionAmount: policyValues.maxTransactionAmount,
        dailyLimit: policyValues.dailyLimit,
        weeklyLimit: policyValues.weeklyLimit,
        monthlyLimit: policyValues.monthlyLimit,
        autoApprovalThreshold: policyValues.autoApprovalThreshold,
        manualApprovalThreshold: policyValues.manualApprovalThreshold,
        requireTrustedMerchantForAuto:
          policyValues.requireTrustedMerchantForAuto,
        duplicateProtection: policyValues.duplicateProtection,
        autoApprovalEnabled: policyValues.autoApprovalEnabled,
        policyVersion: 1,
      });
    }

    await ensureDefaultUserAgents(String(user._id));

    await setSessionCookie({
      userId: String(user._id),
      email: user.email,
      name: user.name,
      role: user.role,
      preferredCurrency: user.preferredCurrency,
      onboardingCompleted: true,
    });

    await recordAuditLog({
      userId: user._id,
      actorRole: user.role,
      action: "ONBOARDING_COMPLETED",
      entityType: "POLICY",
      entityId: String(policy._id),
      metadata: {
        preferredCurrency: parsed.preferredCurrency,
        preset: parsed.preset,
        connectPayPal: parsed.connectPayPal,
      },
    });

    await createNotification({
      userId: user._id,
      title: `Financial Firewall Active (${parsed.preset} Preset)`,
      message: `Your ${parsed.preset} protection policy in ${parsed.preferredCurrency} is now enforcing spending limits across all AI agents.`,
      type: "SUCCESS",
      link: "/policies",
    });

    return apiSuccess(
      {
        user: {
          id: String(user._id),
          name: user.name,
          email: user.email,
          preferredCurrency: user.preferredCurrency,
          onboardingCompleted: user.onboardingCompleted,
          paypalConnected: user.paypalConnected,
        },
        policy,
      },
      "Onboarding completed and financial policy activated"
    );
  } catch (error) {
    return handleApiError(error);
  }
}

