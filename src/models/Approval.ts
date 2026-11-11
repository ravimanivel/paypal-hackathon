import mongoose, { Schema, Document, Model } from "mongoose";
import { CurrencyCode } from "@/types";
import { registerModel } from "@/lib/db/mongodb";

export interface IApproval extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  transactionId: mongoose.Types.ObjectId;
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  approvalTokenHash: string;
  boundProposalId: string;
  boundAmountMinor: number;
  boundCurrency: CurrencyCode;
  boundMerchant: string;
  decisionNote?: string;
  expiresAt: Date;
  usedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ApprovalSchema = new Schema<IApproval>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    transactionId: {
      type: Schema.Types.ObjectId,
      ref: "Transaction",
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "EXPIRED"],
      default: "PENDING",
      index: true,
    },
    approvalTokenHash: {
      type: String,
      required: true,
      index: true,
    },
    boundProposalId: {
      type: String,
      required: true,
    },
    boundAmountMinor: {
      type: Number,
      required: true,
    },
    boundCurrency: {
      type: String,
      enum: ["INR", "USD", "EUR", "GBP"],
      required: true,
    },
    boundMerchant: {
      type: String,
      required: true,
    },
    decisionNote: {
      type: String,
      maxlength: 500,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    usedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

ApprovalSchema.index({ userId: 1, status: 1, createdAt: -1 });

export const Approval: Model<IApproval> = registerModel<IApproval>(
  "Approval",
  ApprovalSchema
);

