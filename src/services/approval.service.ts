import mongoose from "mongoose";
import { Approval, IApproval } from "@/models/Approval";
import { Transaction } from "@/models/Transaction";
import { generateSecureToken, hashToken } from "@/lib/auth/session";
import { AppError } from "@/lib/utils";
import { createNotification, recordAuditLog } from "@/lib/security/audit";
import { releaseSpendingReservation } from "@/services/policy.service";
import { CurrencyCode } from "@/types";
import { formatCurrencyFromMinor } from "@/lib/utils/currency";

const APPROVAL_TTL_MINUTES = 30;

export async function createApprovalRequestForTransaction(params: {
  userId: string | mongoose.Types.ObjectId;
  transactionId: string | mongoose.Types.ObjectId;
  proposalId: string;
  amountMinor: number;
  currency: CurrencyCode;
  merchantName: string;
}): Promise<{ approval: IApproval; rawToken: string }> {
  const rawToken = generateSecureToken(32);
  const approvalTokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + APPROVAL_TTL_MINUTES * 60 * 1000);

  const approval = await Approval.create({
    userId: new mongoose.Types.ObjectId(String(params.userId)),
    transactionId: new mongoose.Types.ObjectId(String(params.transactionId)),
    status: "PENDING",
    approvalTokenHash,
    boundProposalId: params.proposalId,
    boundAmountMinor: params.amountMinor,
    boundCurrency: params.currency,
    boundMerchant: params.merchantName.trim(),
    expiresAt,
    usedAt: null,
  });

  return { approval, rawToken };
}

/**
 * Verifies that a required human approval exists, belongs to the customer,
 * has not expired, and remains cryptographically bound to the exact transaction amount,
 * currency, merchant, and proposal.
 */
export async function verifyValidTransactionApproval(params: {
  userId: string;
  transactionId: string;
  proposalId: string;
  amountMinor: number;
  currency: CurrencyCode;
  merchantName: string;
}): Promise<IApproval> {
  const approval = await Approval.findOne({
    transactionId: new mongoose.Types.ObjectId(params.transactionId),
  });

  if (!approval) {
    throw new AppError("No approval record found for this transaction.", 403);
  }

  if (String(approval.userId) !== String(params.userId)) {
    throw new AppError(
      "Access denied: You do not own this transaction approval.",
      403
    );
  }

  if (approval.status !== "APPROVED") {
    throw new AppError(
      `Transaction approval is currently ${approval.status} and cannot proceed to payment.`,
      403
    );
  }

  if (new Date(approval.expiresAt).getTime() <= Date.now()) {
    approval.status = "EXPIRED";
    await approval.save();
    throw new AppError(
      "This approval has expired. Please submit a new purchase request.",
      403
    );
  }

  // Verify material transaction details have not changed since approval
  if (
    approval.boundAmountMinor !== params.amountMinor ||
    approval.boundCurrency !== params.currency ||
    approval.boundMerchant.trim().toLowerCase() !==
      params.merchantName.trim().toLowerCase() ||
    approval.boundProposalId !== params.proposalId
  ) {
    throw new AppError(
      "Approval invalidated: Material transaction details (amount, currency, merchant, or proposal) were modified after approval.",
      403
    );
  }

  return approval;
}

export async function approveTransactionByUser(params: {
  approvalId: string;
  userId: string;
  decisionNote?: string;
}) {
  if (!mongoose.Types.ObjectId.isValid(params.approvalId)) {
    throw new AppError("Invalid approval ID", 400);
  }

  const approval = await Approval.findById(params.approvalId);
  if (!approval) {
    throw new AppError("Approval request not found", 404);
  }

  if (String(approval.userId) !== String(params.userId)) {
    await recordAuditLog({
      userId: params.userId,
      actorRole: "USER",
      action: "UNAUTHORIZED_APPROVAL_ATTEMPT",
      entityType: "APPROVAL",
      entityId: params.approvalId,
      metadata: { reason: "User attempted to approve another user's request" },
    });
    throw new AppError(
      "Access denied: You cannot approve another customer's transaction.",
      403
    );
  }

  if (approval.status !== "PENDING" || approval.usedAt) {
    throw new AppError(
      `This approval request has already been ${approval.status.toLowerCase()}. Approval tokens are single-use.`,
      400
    );
  }

  if (new Date(approval.expiresAt).getTime() <= Date.now()) {
    approval.status = "EXPIRED";
    await approval.save();
    throw new AppError(
      "This approval request has expired and can no longer be approved.",
      400
    );
  }

  const tx = await Transaction.findById(approval.transactionId);
  if (!tx) {
    throw new AppError("Associated transaction not found", 404);
  }

  if (
    tx.amount !== approval.boundAmountMinor ||
    tx.currency !== approval.boundCurrency ||
    tx.merchant.name.trim().toLowerCase() !==
      approval.boundMerchant.trim().toLowerCase() ||
    tx.proposalId !== approval.boundProposalId
  ) {
    throw new AppError(
      "Security Alert: Transaction details do not match the bound approval record.",
      400
    );
  }

  approval.status = "APPROVED";
  approval.usedAt = new Date();
  approval.decisionNote = params.decisionNote || "Approved by customer";
  await approval.save();

  tx.approvalStatus = "APPROVED";
  tx.paymentStatus = "APPROVED";
  await tx.save();

  await recordAuditLog({
    userId: params.userId,
    actorRole: "USER",
    action: "APPROVAL_GRANTED",
    entityType: "APPROVAL",
    entityId: String(approval._id),
    metadata: {
      transactionId: String(tx._id),
      product: tx.product.name,
      merchant: tx.merchant.name,
      amountMinor: tx.amount,
      currency: tx.currency,
    },
  });

  await createNotification({
    userId: params.userId,
    title: "Purchase Approved — Ready for PayPal Checkout",
    message: `You approved ${tx.product.name} (${formatCurrencyFromMinor(
      tx.amount,
      tx.currency
    )}). Proceed to PayPal Checkout to complete payment.`,
    type: "SUCCESS",
    link: `/transactions?highlight=${tx._id}`,
  });

  return { approval, transaction: tx };
}

export async function rejectTransactionByUser(params: {
  approvalId: string;
  userId: string;
  decisionNote?: string;
}) {
  if (!mongoose.Types.ObjectId.isValid(params.approvalId)) {
    throw new AppError("Invalid approval ID", 400);
  }

  const approval = await Approval.findById(params.approvalId);
  if (!approval) {
    throw new AppError("Approval request not found", 404);
  }

  if (String(approval.userId) !== String(params.userId)) {
    throw new AppError(
      "Access denied: You cannot reject another customer's transaction.",
      403
    );
  }

  if (approval.status !== "PENDING") {
    throw new AppError(
      `This approval request is already ${approval.status.toLowerCase()}.`,
      400
    );
  }

  const tx = await Transaction.findById(approval.transactionId);
  if (!tx) {
    throw new AppError("Associated transaction not found", 404);
  }

  approval.status = "REJECTED";
  approval.usedAt = new Date();
  approval.decisionNote = params.decisionNote || "Rejected by customer";
  await approval.save();

  tx.approvalStatus = "REJECTED";
  tx.paymentStatus = "REJECTED";
  if (tx.spendingReserved) {
    await releaseSpendingReservation(params.userId, tx.amount);
    tx.spendingReserved = false;
  }
  await tx.save();

  await recordAuditLog({
    userId: params.userId,
    actorRole: "USER",
    action: "APPROVAL_REJECTED",
    entityType: "APPROVAL",
    entityId: String(approval._id),
    metadata: {
      transactionId: String(tx._id),
      product: tx.product.name,
      merchant: tx.merchant.name,
      amountMinor: tx.amount,
      currency: tx.currency,
    },
  });

  await createNotification({
    userId: params.userId,
    title: "Purchase Proposal Rejected",
    message: `You rejected the purchase proposal for ${tx.product.name} (${formatCurrencyFromMinor(
      tx.amount,
      tx.currency
    )}). No funds were moved.`,
    type: "WARNING",
    link: "/transactions",
  });

  return { approval, transaction: tx };
}

