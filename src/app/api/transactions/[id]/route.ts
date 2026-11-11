import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/mongodb";
import { requireAuth } from "@/lib/auth/session";
import { Transaction } from "@/models/Transaction";
import { recordAuditLog } from "@/lib/security/audit";
import { toMajorUnits } from "@/lib/utils/currency";
import { apiError, apiSuccess, handleApiError } from "@/lib/utils";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await context.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return apiError("Invalid transaction ID", 400);
    }

    await connectDB();
    const tx = await Transaction.findById(id).lean();
    if (!tx) {
      return apiError("Transaction not found", 404);
    }

    // Strict ownership enforcement (unless ADMIN)
    if (
      session.role !== "ADMIN" &&
      String(tx.userId) !== String(session.userId)
    ) {
      await recordAuditLog({
        userId: session.userId,
        actorRole: session.role,
        action: "UNAUTHORIZED_TRANSACTION_ACCESS_ATTEMPT",
        entityType: "TRANSACTION",
        entityId: id,
      });
      return apiError(
        "Access denied: You do not have permission to view this transaction.",
        403
      );
    }

    return apiSuccess({
      transaction: {
        id: String(tx._id),
        userId: String(tx.userId),
        proposalId: tx.proposalId,
        agentName: tx.agentName,
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
        policyVersion: tx.policyVersion,
        approvalStatus: tx.approvalStatus,
        paymentStatus: tx.paymentStatus,
        paypalOrderId: tx.paypalOrderId,
        paypalCaptureId: tx.paypalCaptureId,
        createdAt: tx.createdAt,
        updatedAt: tx.updatedAt,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

