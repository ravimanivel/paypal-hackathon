import mongoose from "mongoose";
import { Policy, IPolicy } from "@/models/Policy";
import { Transaction } from "@/models/Transaction";
import { CurrencyCode, PolicyEvaluationResult } from "@/types";
import { formatCurrencyFromMinor } from "@/lib/utils/currency";
import { getPresetPolicyValues, PresetConfig } from "@/lib/utils/presets";

export { getPresetPolicyValues };
export type { PresetConfig };

export interface DeterministicPolicyInput {
  policy: {
    currency: CurrencyCode;
    maxTransactionAmount: number;
    dailyLimit: number;
    weeklyLimit: number;
    monthlyLimit: number;
    autoApprovalThreshold: number;
    manualApprovalThreshold: number;
    trustedMerchants: string[];
    blockedMerchants: string[];
    requireTrustedMerchantForAuto: boolean;
    duplicateProtection: boolean;
    autoApprovalEnabled: boolean;
    reservedSpendingMinor?: number;
    policyVersion: number;
  };
  proposal: {
    amountMinor: number;
    currency: CurrencyCode;
    merchantName: string;
    productName: string;
  };
  spendingHistory: {
    dailySpentMinor: number;
    weeklySpentMinor: number;
    monthlySpentMinor: number;
    hasRecentDuplicate: boolean;
  };
}

/**
 * Pure, deterministic server-side policy engine.
 * Hard financial rules are evaluated here and can NEVER be overridden by AI output.
 */
export function evaluatePolicyDeterministic(
  input: DeterministicPolicyInput
): PolicyEvaluationResult {
  const { policy, proposal, spendingHistory } = input;
  const reasons: string[] = [];
  const violatedRules: string[] = [];
  const reserved = policy.reservedSpendingMinor || 0;

  const normalizedMerchant = proposal.merchantName.trim().toLowerCase();
  const isBlockedMerchant = policy.blockedMerchants.some(
    (m) => m.trim().toLowerCase() === normalizedMerchant
  );
  const isTrustedMerchant = policy.trustedMerchants.some(
    (m) => m.trim().toLowerCase() === normalizedMerchant
  );

  // 1. Check Currency Mismatch
  if (proposal.currency !== policy.currency) {
    violatedRules.push("CURRENCY_MISMATCH");
    reasons.push(
      `Transaction currency (${proposal.currency}) does not match configured policy currency (${policy.currency}).`
    );
  }

  // 2. Check Blocked Merchant
  if (isBlockedMerchant) {
    violatedRules.push("MERCHANT_BLOCKED");
    reasons.push(
      `Merchant "${proposal.merchantName}" is on your blocked merchants list.`
    );
  }

  // 3. Check Duplicate Transaction Protection (Current 30 Days Window)
  if (policy.duplicateProtection && spendingHistory.hasRecentDuplicate) {
    violatedRules.push("DUPLICATE_TRANSACTION_DETECTED");
    reasons.push(
      `Duplicate payment detected within current 30 days: "${proposal.productName}" at "${proposal.merchantName}" was already evaluated or purchased within the last 30 days.`
    );
  }

  // 4. Check Maximum Single Transaction Limit
  if (proposal.amountMinor > policy.maxTransactionAmount) {
    violatedRules.push("MAX_TRANSACTION_LIMIT_EXCEEDED");
    reasons.push(
      `Amount ${formatCurrencyFromMinor(
        proposal.amountMinor,
        proposal.currency
      )} exceeds your maximum single transaction limit of ${formatCurrencyFromMinor(
        policy.maxTransactionAmount,
        policy.currency
      )}.`
    );
  }

  // 5. Check Daily Spending Limit (including active atomic reservations)
  const projectedDaily =
    spendingHistory.dailySpentMinor + reserved + proposal.amountMinor;
  if (projectedDaily > policy.dailyLimit) {
    violatedRules.push("DAILY_SPENDING_LIMIT_EXCEEDED");
    reasons.push(
      `This purchase would bring today's spending to ${formatCurrencyFromMinor(
        projectedDaily,
        policy.currency
      )}, exceeding your daily limit of ${formatCurrencyFromMinor(
        policy.dailyLimit,
        policy.currency
      )}.`
    );
  }

  // 6. Check Weekly Spending Limit
  const projectedWeekly =
    spendingHistory.weeklySpentMinor + reserved + proposal.amountMinor;
  if (projectedWeekly > policy.weeklyLimit) {
    violatedRules.push("WEEKLY_SPENDING_LIMIT_EXCEEDED");
    reasons.push(
      `This purchase would bring 7-day spending to ${formatCurrencyFromMinor(
        projectedWeekly,
        policy.currency
      )}, exceeding your weekly limit of ${formatCurrencyFromMinor(
        policy.weeklyLimit,
        policy.currency
      )}.`
    );
  }

  // 7. Check Monthly Spending Limit
  const projectedMonthly =
    spendingHistory.monthlySpentMinor + reserved + proposal.amountMinor;
  if (projectedMonthly > policy.monthlyLimit) {
    violatedRules.push("MONTHLY_SPENDING_LIMIT_EXCEEDED");
    reasons.push(
      `This purchase would bring 30-day spending to ${formatCurrencyFromMinor(
        projectedMonthly,
        policy.currency
      )}, exceeding your monthly limit of ${formatCurrencyFromMinor(
        policy.monthlyLimit,
        policy.currency
      )}.`
    );
  }

  // If ANY hard rule was violated, deterministically BLOCK
  if (violatedRules.length > 0) {
    return {
      decision: "BLOCKED",
      allowed: false,
      requiresApproval: false,
      blocked: true,
      reasons,
      violatedRules,
      policyVersion: policy.policyVersion,
      dailySpentMinor: spendingHistory.dailySpentMinor,
      weeklySpentMinor: spendingHistory.weeklySpentMinor,
      monthlySpentMinor: spendingHistory.monthlySpentMinor,
    };
  }

  // Check conditions requiring human approval (REQUIRES_APPROVAL)
  const approvalReasons: string[] = [];

  if (!policy.autoApprovalEnabled) {
    approvalReasons.push(
      "Automatic approval is disabled in your financial policy; all purchases require human authorization."
    );
  }

  if (proposal.amountMinor >= policy.manualApprovalThreshold) {
    approvalReasons.push(
      `Amount ${formatCurrencyFromMinor(
        proposal.amountMinor,
        policy.currency
      )} meets or exceeds mandatory manual approval threshold (${formatCurrencyFromMinor(
        policy.manualApprovalThreshold,
        policy.currency
      )}).`
    );
  } else if (proposal.amountMinor > policy.autoApprovalThreshold) {
    approvalReasons.push(
      `Amount ${formatCurrencyFromMinor(
        proposal.amountMinor,
        policy.currency
      )} exceeds automatic approval threshold of ${formatCurrencyFromMinor(
        policy.autoApprovalThreshold,
        policy.currency
      )}.`
    );
  }

  if (policy.requireTrustedMerchantForAuto && !isTrustedMerchant) {
    approvalReasons.push(
      `Merchant "${proposal.merchantName}" is not in your trusted merchants list; manual approval is required.`
    );
  }

  if (approvalReasons.length > 0) {
    return {
      decision: "REQUIRES_APPROVAL",
      allowed: true,
      requiresApproval: true,
      blocked: false,
      reasons: approvalReasons,
      violatedRules: [],
      policyVersion: policy.policyVersion,
      dailySpentMinor: spendingHistory.dailySpentMinor,
      weeklySpentMinor: spendingHistory.weeklySpentMinor,
      monthlySpentMinor: spendingHistory.monthlySpentMinor,
    };
  }

  // All checks passed and eligible for AUTO_APPROVED
  return {
    decision: "AUTO_APPROVED",
    allowed: true,
    requiresApproval: false,
    blocked: false,
    reasons: [
      `Purchase of ${formatCurrencyFromMinor(
        proposal.amountMinor,
        policy.currency
      )} is within all spending limits and under the automatic approval threshold (${formatCurrencyFromMinor(
        policy.autoApprovalThreshold,
        policy.currency
      )}).`,
      isTrustedMerchant
        ? `Merchant "${proposal.merchantName}" is verified in your trusted merchants list.`
        : `Merchant check passed.`,
    ],
    violatedRules: [],
    policyVersion: policy.policyVersion,
    dailySpentMinor: spendingHistory.dailySpentMinor,
    weeklySpentMinor: spendingHistory.weeklySpentMinor,
    monthlySpentMinor: spendingHistory.monthlySpentMinor,
  };
}

export async function getOrCreateUserPolicy(
  userId: string | mongoose.Types.ObjectId,
  preferredCurrency: CurrencyCode = "INR"
): Promise<IPolicy> {
  const userObjId = new mongoose.Types.ObjectId(String(userId));
  const existing = await Policy.findOne({ userId: userObjId });
  if (existing) return existing;

  const presetValues = getPresetPolicyValues("BALANCED", preferredCurrency);
  return Policy.create({
    userId: userObjId,
    preset: "BALANCED",
    currency: preferredCurrency,
    maxTransactionAmount: presetValues.maxTransactionAmount,
    dailyLimit: presetValues.dailyLimit,
    weeklyLimit: presetValues.weeklyLimit,
    monthlyLimit: presetValues.monthlyLimit,
    autoApprovalThreshold: presetValues.autoApprovalThreshold,
    manualApprovalThreshold: presetValues.manualApprovalThreshold,
    requireTrustedMerchantForAuto: presetValues.requireTrustedMerchantForAuto,
    duplicateProtection: presetValues.duplicateProtection,
    autoApprovalEnabled: presetValues.autoApprovalEnabled,
    policyVersion: 1,
  });
}

export async function getAggregatedSpending(
  userId: string | mongoose.Types.ObjectId,
  currency: CurrencyCode,
  excludeTransactionId?: string | mongoose.Types.ObjectId
) {
  const userObjId = new mongoose.Types.ObjectId(String(userId));
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const countedStatuses = [
    "COMPLETED",
    "CAPTURE_PENDING",
    "CUSTOMER_CHECKOUT_APPROVED",
    "PAYPAL_ORDER_CREATED",
  ];

  const query: Record<string, any> = {
    userId: userObjId,
    currency,
    paymentStatus: { $in: countedStatuses },
    createdAt: { $gte: startOfMonth },
  };

  if (excludeTransactionId) {
    query._id = {
      $ne: new mongoose.Types.ObjectId(String(excludeTransactionId)),
    };
  }

  const recentTx = await Transaction.find(query)
    .select("amount createdAt")
    .lean();

  let dailySpentMinor = 0;
  let weeklySpentMinor = 0;
  let monthlySpentMinor = 0;

  for (const tx of recentTx) {
    const created = new Date(tx.createdAt);
    monthlySpentMinor += tx.amount;
    if (created >= startOfWeek) {
      weeklySpentMinor += tx.amount;
    }
    if (created >= startOfDay) {
      dailySpentMinor += tx.amount;
    }
  }

  return {
    dailySpentMinor,
    weeklySpentMinor,
    monthlySpentMinor,
  };
}

export async function checkRecentDuplicateTransaction(params: {
  userId: string | mongoose.Types.ObjectId;
  productName: string;
  merchantName: string;
  amountMinor: number;
  windowMinutes?: number;
}): Promise<boolean> {
  const userObjId = new mongoose.Types.ObjectId(String(params.userId));
  // Check duplicate payment / evaluation within the current 30 days (43,200 minutes)
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - thirtyDaysMs);

  const existing = await Transaction.findOne({
    userId: userObjId,
    "product.name": params.productName.trim(),
    "merchant.name": params.merchantName.trim(),
    amount: params.amountMinor,
    paymentStatus: {
      $nin: ["REJECTED", "CANCELLED", "FAILED", "BLOCKED"],
    },
    createdAt: { $gte: cutoff },
  }).lean();

  return Boolean(existing);
}

/**
 * Atomically reserves spending against the user's policy so concurrent requests
 * cannot exceed the daily/monthly budget.
 */
export async function reserveSpendingAtomically(
  userId: string | mongoose.Types.ObjectId,
  amountMinor: number,
  currentDailySpentMinor: number
): Promise<boolean> {
  const userObjId = new mongoose.Types.ObjectId(String(userId));
  const updated = await Policy.findOneAndUpdate(
    {
      userId: userObjId,
      $expr: {
        $and: [
          { $lte: [amountMinor, "$maxTransactionAmount"] },
          {
            $lte: [
              {
                $add: [
                  "$reservedSpendingMinor",
                  currentDailySpentMinor,
                  amountMinor,
                ],
              },
              "$dailyLimit",
            ],
          },
        ],
      },
    },
    {
      $inc: { reservedSpendingMinor: amountMinor },
    },
    { new: true }
  );

  return Boolean(updated);
}

export async function releaseSpendingReservation(
  userId: string | mongoose.Types.ObjectId,
  amountMinor: number
): Promise<void> {
  const userObjId = new mongoose.Types.ObjectId(String(userId));
  const policy = await Policy.findOne({ userId: userObjId });
  if (!policy) return;
  const nextReserved = Math.max(0, (policy.reservedSpendingMinor || 0) - amountMinor);
  policy.reservedSpendingMinor = nextReserved;
  await policy.save();
}
