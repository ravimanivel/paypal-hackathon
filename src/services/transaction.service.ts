import mongoose from "mongoose";
import { Transaction, ITransaction } from "@/models/Transaction";
import { Agent } from "@/models/Agent";
import {
  checkRecentDuplicateTransaction,
  evaluatePolicyDeterministic,
  getAggregatedSpending,
  getOrCreateUserPolicy,
  reserveSpendingAtomically,
} from "@/services/policy.service";
import { analyzeTransactionRisk } from "@/services/risk.service";
import { createApprovalRequestForTransaction } from "@/services/approval.service";
import { createNotification, recordAuditLog } from "@/lib/security/audit";
import { formatCurrencyFromMinor, toMinorUnits } from "@/lib/utils/currency";
import {
  ApprovalStatus,
  CurrencyCode,
  FirewallDecision,
  TransactionState,
} from "@/types";

export interface EvaluateProposalInput {
  userId: string;
  agentId?: string;
  agentName?: string;
  proposalId: string;
  product: {
    name: string;
    category: string;
    description?: string;
    specs?: string[];
    isSampleData: boolean;
  };
  merchant: {
    name: string;
    domain?: string;
    category?: string;
  };
  amountMajor: number;
  currency: CurrencyCode;
  idempotencyKey?: string;
  userPromptContext?: string;
}

/**
 * Core AgentGuard AI Financial Firewall Orchestrator.
 * Evaluates an AI Agent's purchase proposal against deterministic financial policies
 * and AI Risk Intelligence before allowing any payment workflow.
 */
export async function evaluateAndCreateTransaction(
  input: EvaluateProposalInput
) {
  const userObjId = new mongoose.Types.ObjectId(input.userId);
  const amountMinor = toMinorUnits(input.amountMajor);
  const idempotencyKey =
    input.idempotencyKey ||
    `idem-${input.userId}-${input.proposalId}-${amountMinor}`;

  // 1. Idempotency check: prevent duplicate submission of identical idempotencyKey
  const existingByIdem = await Transaction.findOne({ idempotencyKey });
  if (existingByIdem && String(existingByIdem.userId) === String(input.userId)) {
    return {
      transaction: existingByIdem,
      idempotentReplay: true,
      firewallDecision: existingByIdem.firewallDecision,
      policyReasons: existingByIdem.policyReasons,
      violatedRules: existingByIdem.violatedRules,
      riskAssessment: {
        riskLevel: existingByIdem.riskLevel,
        riskScore: existingByIdem.riskScore,
        reasons: existingByIdem.riskReasons,
        recommendation: existingByIdem.riskRecommendation,
      },
    };
  }

  // 2. Load customer's active Policy
  const policy = await getOrCreateUserPolicy(input.userId, input.currency);

  // If this is a sample/demo catalog item, ensure reservedSpendingMinor does not accumulate across uncompleted demo clicks
  if (input.product.isSampleData && (policy.reservedSpendingMinor || 0) > 0) {
    policy.reservedSpendingMinor = 0;
    await policy.save();
  }

  // 3. Load aggregated spending & 30-day duplicate payment check
  const spending = await getAggregatedSpending(input.userId, policy.currency);
  const hasRecentDuplicate = await checkRecentDuplicateTransaction({
    userId: input.userId,
    productName: input.product.name,
    merchantName: input.merchant.name,
    amountMinor,
    windowMinutes: 30 * 24 * 60, // Current 30 days
  });

  // 4. Deterministic Policy Engine Evaluation (Hard limits can NEVER be overridden by AI)
  const policyEval = evaluatePolicyDeterministic({
    policy: {
      currency: policy.currency,
      maxTransactionAmount: policy.maxTransactionAmount,
      dailyLimit: policy.dailyLimit,
      weeklyLimit: policy.weeklyLimit,
      monthlyLimit: policy.monthlyLimit,
      autoApprovalThreshold: policy.autoApprovalThreshold,
      manualApprovalThreshold: policy.manualApprovalThreshold,
      trustedMerchants: policy.trustedMerchants,
      blockedMerchants: policy.blockedMerchants,
      requireTrustedMerchantForAuto: policy.requireTrustedMerchantForAuto,
      duplicateProtection: policy.duplicateProtection,
      autoApprovalEnabled: policy.autoApprovalEnabled,
      reservedSpendingMinor: policy.reservedSpendingMinor || 0,
      policyVersion: policy.policyVersion,
    },
    proposal: {
      amountMinor,
      currency: input.currency,
      merchantName: input.merchant.name,
      productName: input.product.name,
    },
    spendingHistory: {
      dailySpentMinor: spending.dailySpentMinor,
      weeklySpentMinor: spending.weeklySpentMinor,
      monthlySpentMinor: spending.monthlySpentMinor,
      hasRecentDuplicate,
    },
  });

  const normalizedMerchant = input.merchant.name.trim().toLowerCase();
  const isTrustedMerchant = policy.trustedMerchants.some(
    (m) => m.trim().toLowerCase() === normalizedMerchant
  );
  const isBlockedMerchant = policy.blockedMerchants.some(
    (m) => m.trim().toLowerCase() === normalizedMerchant
  );

  // Count recent velocity in last hour (exclude repeated interactive sample demo clicks)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentTxCountLastHour = input.product.isSampleData
    ? 1
    : await Transaction.countDocuments({
        userId: userObjId,
        "product.isSampleData": false,
        createdAt: { $gte: oneHourAgo },
      });

  // 5. AI Risk Intelligence Analysis
  const riskAssessment = await analyzeTransactionRisk({
    amountMinor,
    currency: input.currency,
    policyCurrency: policy.currency,
    maxTransactionMinor: policy.maxTransactionAmount,
    autoApprovalThresholdMinor: policy.autoApprovalThreshold,
    merchantName: input.merchant.name,
    isTrustedMerchant,
    isBlockedMerchant,
    productName: input.product.name,
    productDescription: input.product.description,
    userPromptContext: input.userPromptContext,
    hasRecentDuplicate,
    recentTxCountLastHour,
  });

  // 6. Combine Policy Decision + Risk Intelligence (Hard Policy Violation ALWAYS wins)
  let finalDecision: FirewallDecision = policyEval.decision;
  const finalPolicyReasons = [...policyEval.reasons];
  const finalViolatedRules = [...policyEval.violatedRules];

  if (finalDecision !== "BLOCKED") {
    if (
      riskAssessment.riskLevel === "CRITICAL" ||
      riskAssessment.recommendation === "BLOCK"
    ) {
      finalDecision = "BLOCKED";
      finalViolatedRules.push("CRITICAL_SECURITY_RISK_BLOCK");
      finalPolicyReasons.push(
        "AgentGuard Risk Intelligence identified critical security indicators and blocked the transaction."
      );
    } else if (
      finalDecision === "AUTO_APPROVED" &&
      (riskAssessment.riskLevel === "HIGH" ||
        riskAssessment.riskLevel === "MEDIUM" ||
        riskAssessment.recommendation === "REVIEW")
    ) {
      finalDecision = "REQUIRES_APPROVAL";
      finalPolicyReasons.push(
        `Elevated risk score (${riskAssessment.riskScore}/100) requires human review before checkout.`
      );
    }
  }

  // 7. Atomic spending reservation for allowed/pending proposals
  let spendingReserved = false;
  if (finalDecision !== "BLOCKED") {
    const reservedOk = await reserveSpendingAtomically(
      input.userId,
      amountMinor,
      spending.dailySpentMinor
    );
    if (!reservedOk) {
      finalDecision = "BLOCKED";
      finalViolatedRules.push("CONCURRENT_SPENDING_LIMIT_EXHAUSTED");
      finalPolicyReasons.push(
        "Atomic spending reservation failed because concurrent transactions exhausted your daily or single-transaction limit."
      );
    } else {
      spendingReserved = true;
    }
  }

  let approvalStatus: ApprovalStatus = "NOT_REQUIRED";
  let paymentStatus: TransactionState = "APPROVED";

  if (finalDecision === "BLOCKED") {
    approvalStatus = "REJECTED";
    paymentStatus = "BLOCKED";
  } else if (finalDecision === "REQUIRES_APPROVAL") {
    approvalStatus = "PENDING";
    paymentStatus = "PENDING_APPROVAL";
  } else {
    // AUTO_APPROVED: policy permits checkout without separate Pending Approval queue step
    approvalStatus = "NOT_REQUIRED";
    paymentStatus = "APPROVED";
  }

  // 8. Persist Transaction record
  const agentObjId =
    input.agentId && mongoose.Types.ObjectId.isValid(input.agentId)
      ? new mongoose.Types.ObjectId(input.agentId)
      : undefined;

  const transaction: ITransaction = await Transaction.create({
    userId: userObjId,
    agentId: agentObjId,
    agentName: input.agentName || "AgentGuard Shopping Assistant",
    proposalId: input.proposalId,
    product: {
      name: input.product.name,
      category: input.product.category || "Electronics",
      description: input.product.description,
      specs: input.product.specs || [],
      isSampleData: input.product.isSampleData ?? true,
    },
    merchant: {
      name: input.merchant.name,
      domain: input.merchant.domain,
      category: input.merchant.category || "Retail",
      isTrusted: isTrustedMerchant,
    },
    amount: amountMinor,
    currency: input.currency,
    riskScore: riskAssessment.riskScore,
    riskLevel: riskAssessment.riskLevel,
    riskReasons: riskAssessment.reasons,
    riskRecommendation: riskAssessment.recommendation,
    firewallDecision: finalDecision,
    policyReasons: finalPolicyReasons,
    violatedRules: finalViolatedRules,
    policyVersion: policy.policyVersion,
    approvalStatus,
    paymentStatus,
    idempotencyKey,
    spendingReserved,
  });

  // 9. Create bound Approval Request if REQUIRES_APPROVAL
  let approvalId: string | undefined;
  if (finalDecision === "REQUIRES_APPROVAL") {
    const { approval } = await createApprovalRequestForTransaction({
      userId: input.userId,
      transactionId: String(transaction._id),
      proposalId: input.proposalId,
      amountMinor,
      currency: input.currency,
      merchantName: input.merchant.name,
    });
    approvalId = String(approval._id);
  }

  // 10. Update AI Agent stats if applicable
  if (agentObjId) {
    await Agent.findByIdAndUpdate(agentObjId, {
      $inc: {
        totalProposals: 1,
        approvedProposals: finalDecision === "AUTO_APPROVED" ? 1 : 0,
        blockedProposals: finalDecision === "BLOCKED" ? 1 : 0,
      },
      $set: { lastActiveAt: new Date() },
    });
  }

  // 11. Record Audit Log & User Notification
  await recordAuditLog({
    userId: input.userId,
    actorRole: "SYSTEM",
    action: `FIREWALL_${finalDecision}`,
    entityType: "TRANSACTION",
    entityId: String(transaction._id),
    metadata: {
      proposalId: input.proposalId,
      product: input.product.name,
      merchant: input.merchant.name,
      amountMinor,
      currency: input.currency,
      riskScore: riskAssessment.riskScore,
      riskLevel: riskAssessment.riskLevel,
      firewallDecision: finalDecision,
      violatedRules: finalViolatedRules,
      policyVersion: policy.policyVersion,
    },
  });

  const formattedAmount = formatCurrencyFromMinor(amountMinor, input.currency);
  if (finalDecision === "BLOCKED") {
    await createNotification({
      userId: input.userId,
      title: `Firewall Blocked Purchase (${formattedAmount})`,
      message: `${input.product.name} at ${input.merchant.name} was blocked: ${
        finalPolicyReasons[0] || "Policy violation"
      }`,
      type: "DANGER",
      link: `/transactions?highlight=${transaction._id}`,
    });
  } else if (finalDecision === "REQUIRES_APPROVAL") {
    await createNotification({
      userId: input.userId,
      title: `Approval Required: ${input.product.name} (${formattedAmount})`,
      message: `AgentGuard paused ${input.product.name} for your review: ${
        finalPolicyReasons[0] || "Requires human authorization"
      }`,
      type: "APPROVAL_REQUIRED",
      link: "/approvals",
    });
  } else {
    await createNotification({
      userId: input.userId,
      title: `Auto-Approved by Firewall (${formattedAmount})`,
      message: `${input.product.name} passed all policy & risk checks and is ready for PayPal Checkout.`,
      type: "SUCCESS",
      link: `/transactions?highlight=${transaction._id}`,
    });
  }

  return {
    transaction,
    approvalId,
    idempotentReplay: false,
    firewallDecision: finalDecision,
    policyReasons: finalPolicyReasons,
    violatedRules: finalViolatedRules,
    riskAssessment,
  };
}

