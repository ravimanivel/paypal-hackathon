import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import { requireAdmin } from "@/lib/auth/session";
import { Transaction } from "@/models/Transaction";
import { User } from "@/models/User";
import { toMajorUnits } from "@/lib/utils/currency";
import { apiSuccess, handleApiError } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    await connectDB();

    const { searchParams } = new URL(req.url);
    const decision = searchParams.get("decision");
    const status = searchParams.get("status");

    const filter: Record<string, unknown> = {};
    if (decision && decision !== "ALL") filter.firewallDecision = decision;
    if (status && status !== "ALL") filter.paymentStatus = status;

    const [transactions, users] = await Promise.all([
      Transaction.find(filter).sort({ createdAt: -1 }).limit(150).lean(),
      User.find().select("name email").lean(),
    ]);

    const userMap = new Map(
      users.map((u) => [String(u._id), { name: u.name, email: u.email }])
    );

    return apiSuccess({
      transactions: transactions.map((t) => {
        const owner = userMap.get(String(t.userId));
        return {
          id: String(t._id),
          userId: String(t.userId),
          userName: owner?.name || "Customer",
          userEmail: owner?.email || "",
          proposalId: t.proposalId,
          agentName: t.agentName,
          product: t.product,
          merchant: t.merchant,
          amountMinor: t.amount,
          amountMajor: toMajorUnits(t.amount),
          currency: t.currency,
          riskScore: t.riskScore,
          riskLevel: t.riskLevel,
          riskReasons: t.riskReasons,
          firewallDecision: t.firewallDecision,
          policyReasons: t.policyReasons,
          violatedRules: t.violatedRules,
          approvalStatus: t.approvalStatus,
          paymentStatus: t.paymentStatus,
          paypalOrderId: t.paypalOrderId,
          paypalCaptureId: t.paypalCaptureId,
          createdAt: t.createdAt,
        };
      }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

