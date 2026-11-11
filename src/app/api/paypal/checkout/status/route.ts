import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/mongodb";
import { requireAuth } from "@/lib/auth/session";
import { Transaction } from "@/models/Transaction";
import { toMajorUnits } from "@/lib/utils/currency";
import { apiError, apiSuccess, handleApiError } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);
    const transactionId = searchParams.get("transactionId");
    const paypalOrderId = searchParams.get("paypalOrderId");

    if (!transactionId && !paypalOrderId) {
      return apiError(
        "Provide either transactionId or paypalOrderId",
        400
      );
    }

    await connectDB();
    const tx = transactionId
      ? mongoose.Types.ObjectId.isValid(transactionId)
        ? await Transaction.findById(transactionId).lean()
        : null
      : await Transaction.findOne({ paypalOrderId }).lean();

    if (!tx) {
      return apiError("Transaction not found", 404);
    }

    if (
      session.role !== "ADMIN" &&
      String(tx.userId) !== String(session.userId)
    ) {
      return apiError("Access denied", 403);
    }

    return apiSuccess({
      transactionId: String(tx._id),
      proposalId: tx.proposalId,
      paymentStatus: tx.paymentStatus,
      approvalStatus: tx.approvalStatus,
      firewallDecision: tx.firewallDecision,
      paypalOrderId: tx.paypalOrderId,
      paypalCaptureId: tx.paypalCaptureId,
      amountMajor: toMajorUnits(tx.amount),
      currency: tx.currency,
      updatedAt: tx.updatedAt,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

