import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import { requireAuth } from "@/lib/auth/session";
import { Transaction } from "@/models/Transaction";
import { Approval } from "@/models/Approval";
import { toMajorUnits } from "@/lib/utils/currency";
import { apiSuccess, handleApiError } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    await connectDB();

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");
    const decisionFilter = searchParams.get("decision");

    const query: Record<string, unknown> = { userId: session.userId };
    if (statusFilter && statusFilter !== "ALL") {
      query.paymentStatus = statusFilter;
    }
    if (decisionFilter && decisionFilter !== "ALL") {
      query.firewallDecision = decisionFilter;
    }

    const [transactions, allUserTx, userApprovals] = await Promise.all([
      Transaction.find(query).sort({ createdAt: -1 }).limit(100).lean(),
      Transaction.find({ userId: session.userId }).lean(),
      Approval.find({ userId: session.userId }).lean(),
    ]);

    const approvalByTxId = new Map<string, string>();
    for (const appr of userApprovals) {
      approvalByTxId.set(String(appr.transactionId), String(appr._id));
    }

    let totalProtectedSpendingMinor = 0;
    let autoApprovedCount = 0;
    let pendingApprovalsCount = 0;
    let blockedCount = 0;
    let completedCount = 0;
    let riskAlertsCount = 0;

    for (const tx of allUserTx) {
      if (tx.paymentStatus === "COMPLETED") {
        totalProtectedSpendingMinor += tx.amount;
        completedCount += 1;
      }
      if (tx.firewallDecision === "AUTO_APPROVED") {
        autoApprovedCount += 1;
      }
      if (tx.paymentStatus === "PENDING_APPROVAL") {
        pendingApprovalsCount += 1;
      }
      if (
        tx.firewallDecision === "BLOCKED" ||
        tx.paymentStatus === "BLOCKED"
      ) {
        blockedCount += 1;
      }
      if (
        tx.riskLevel === "HIGH" ||
        tx.riskLevel === "CRITICAL" ||
        tx.riskScore >= 50
      ) {
        riskAlertsCount += 1;
      }
    }

    return apiSuccess({
      summary: {
        totalProtectedSpendingMinor,
        totalProtectedSpendingMajor: toMajorUnits(totalProtectedSpendingMinor),
        totalTransactions: allUserTx.length,
        completedCount,
        autoApprovedCount,
        pendingApprovalsCount,
        blockedCount,
        riskAlertsCount,
        currency: session.preferredCurrency,
      },
      transactions: transactions.map((t) => ({
        id: String(t._id),
        proposalId: t.proposalId,
        agentId: t.agentId ? String(t.agentId) : undefined,
        agentName: t.agentName,
        product: t.product,
        merchant: t.merchant,
        amountMinor: t.amount,
        amountMajor: toMajorUnits(t.amount),
        currency: t.currency,
        riskScore: t.riskScore,
        riskLevel: t.riskLevel,
        riskReasons: t.riskReasons,
        riskRecommendation: t.riskRecommendation,
        firewallDecision: t.firewallDecision,
        policyReasons: t.policyReasons,
        violatedRules: t.violatedRules,
        approvalStatus: t.approvalStatus,
        approvalId: approvalByTxId.get(String(t._id)),
        isDuplicateWithin30Days: Array.isArray(t.violatedRules)
          ? t.violatedRules.includes("DUPLICATE_TRANSACTION_DETECTED")
          : false,
        paymentStatus: t.paymentStatus,
        paypalOrderId: t.paypalOrderId,
        paypalCaptureId: t.paypalCaptureId,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

