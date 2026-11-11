import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import { requireAuth } from "@/lib/auth/session";
import { Approval } from "@/models/Approval";
import { Transaction } from "@/models/Transaction";
import { toMajorUnits } from "@/lib/utils/currency";
import { apiSuccess, handleApiError } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    await connectDB();

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");

    const query: Record<string, unknown> = { userId: session.userId };
    if (statusFilter && statusFilter !== "ALL") {
      query.status = statusFilter;
    }

    const approvals = await Approval.find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const txIds = approvals.map((a) => a.transactionId);
    const transactions = await Transaction.find({ _id: { $in: txIds } }).lean();
    const txMap = new Map(transactions.map((t) => [String(t._id), t]));

    const now = Date.now();

    const enriched = approvals.map((a) => {
      const tx = txMap.get(String(a.transactionId));
      const isExpired =
        a.status === "PENDING" && new Date(a.expiresAt).getTime() <= now;

      return {
        id: String(a._id),
        transactionId: String(a.transactionId),
        status: isExpired ? "EXPIRED" : a.status,
        boundProposalId: a.boundProposalId,
        amountMinor: a.boundAmountMinor,
        amountMajor: toMajorUnits(a.boundAmountMinor),
        currency: a.boundCurrency,
        merchant: a.boundMerchant,
        decisionNote: a.decisionNote,
        expiresAt: a.expiresAt,
        usedAt: a.usedAt,
        createdAt: a.createdAt,
        transaction: tx
          ? {
              id: String(tx._id),
              productName: tx.product.name,
              productCategory: tx.product.category,
              merchantName: tx.merchant.name,
              agentName: tx.agentName,
              riskScore: tx.riskScore,
              riskLevel: tx.riskLevel,
              riskReasons: tx.riskReasons,
              firewallDecision: tx.firewallDecision,
              policyReasons: tx.policyReasons,
              paymentStatus: tx.paymentStatus,
              paypalOrderId: tx.paypalOrderId,
            }
          : null,
      };
    });

    return apiSuccess({ approvals: enriched });
  } catch (error) {
    return handleApiError(error);
  }
}

