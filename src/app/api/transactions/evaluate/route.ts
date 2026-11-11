import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import { requireAuth } from "@/lib/auth/session";
import { evaluateTransactionSchema } from "@/lib/validators";
import { evaluateAndCreateTransaction } from "@/services/transaction.service";
import { toMajorUnits } from "@/lib/utils/currency";
import { apiSuccess, handleApiError } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();
    const parsed = evaluateTransactionSchema.parse(body);

    await connectDB();
    const result = await evaluateAndCreateTransaction({
      userId: session.userId,
      agentId: parsed.agentId,
      agentName: parsed.agentName,
      proposalId: parsed.proposalId,
      product: parsed.product,
      merchant: parsed.merchant,
      amountMajor: parsed.amountMajor,
      currency: parsed.currency,
      idempotencyKey: parsed.idempotencyKey,
      userPromptContext: parsed.userPromptContext,
    });

    const tx = result.transaction;

    return apiSuccess(
      {
        transaction: {
          id: String(tx._id),
          proposalId: tx.proposalId,
          product: tx.product,
          merchant: tx.merchant,
          amountMinor: tx.amount,
          amountMajor: toMajorUnits(tx.amount),
          currency: tx.currency,
          riskScore: tx.riskScore,
          riskLevel: tx.riskLevel,
          riskReasons: tx.riskReasons,
          riskRecommendation: tx.riskRecommendation,
          firewallDecision: tx.firewallDecision,
          policyReasons: tx.policyReasons,
          violatedRules: tx.violatedRules,
          approvalStatus: tx.approvalStatus,
          paymentStatus: tx.paymentStatus,
          createdAt: tx.createdAt,
        },
        approvalId: result.approvalId,
        idempotentReplay: result.idempotentReplay,
        firewallDecision: result.firewallDecision,
        policyReasons: result.policyReasons,
        violatedRules: result.violatedRules,
        riskAssessment: result.riskAssessment,
      },
      `AgentGuard Firewall decision: ${result.firewallDecision}`,
      result.idempotentReplay ? 200 : 201
    );
  } catch (error) {
    return handleApiError(error);
  }
}

