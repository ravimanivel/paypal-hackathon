import mongoose, { Schema, Document, Model } from "mongoose";
import { registerModel } from "@/lib/db/mongodb";
import {
  ApprovalStatus,
  CurrencyCode,
  FirewallDecision,
  RiskLevel,
  RiskRecommendation,
  TransactionState,
} from "@/types";

export interface ITransaction extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  agentId?: mongoose.Types.ObjectId;
  agentName: string;
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
    isTrusted: boolean;
  };
  amount: number; // Stored in integer minor units (e.g., paise/cents)
  currency: CurrencyCode;
  riskScore: number; // 0-100
  riskLevel: RiskLevel;
  riskReasons: string[];
  riskRecommendation: RiskRecommendation;
  firewallDecision: FirewallDecision;
  policyReasons: string[];
  violatedRules: string[];
  policyVersion: number;
  approvalStatus: ApprovalStatus;
  paymentStatus: TransactionState;
  paypalOrderId?: string;
  paypalCaptureId?: string;
  paypalPayerEmail?: string;
  idempotencyKey: string;
  spendingReserved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    agentId: {
      type: Schema.Types.ObjectId,
      ref: "Agent",
      index: true,
    },
    agentName: {
      type: String,
      default: "AgentGuard Shopping Assistant",
    },
    proposalId: {
      type: String,
      required: true,
      index: true,
    },
    product: {
      name: { type: String, required: true, trim: true },
      category: { type: String, default: "Electronics" },
      description: { type: String },
      specs: { type: [String], default: [] },
      isSampleData: { type: Boolean, default: true },
    },
    merchant: {
      name: { type: String, required: true, trim: true },
      domain: { type: String },
      category: { type: String, default: "Retail" },
      isTrusted: { type: Boolean, default: false },
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    currency: {
      type: String,
      enum: ["INR", "USD", "EUR", "GBP"],
      required: true,
    },
    riskScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    riskLevel: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      required: true,
      index: true,
    },
    riskReasons: {
      type: [String],
      default: [],
    },
    riskRecommendation: {
      type: String,
      enum: ["ALLOW", "REVIEW", "BLOCK"],
      default: "ALLOW",
    },
    firewallDecision: {
      type: String,
      enum: ["AUTO_APPROVED", "REQUIRES_APPROVAL", "BLOCKED"],
      required: true,
      index: true,
    },
    policyReasons: {
      type: [String],
      default: [],
    },
    violatedRules: {
      type: [String],
      default: [],
    },
    policyVersion: {
      type: Number,
      default: 1,
    },
    approvalStatus: {
      type: String,
      enum: ["NOT_REQUIRED", "PENDING", "APPROVED", "REJECTED", "EXPIRED"],
      required: true,
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: [
        "PROPOSED",
        "PENDING_APPROVAL",
        "APPROVED",
        "REJECTED",
        "BLOCKED",
        "PAYPAL_ORDER_CREATED",
        "CUSTOMER_CHECKOUT_APPROVED",
        "CAPTURE_PENDING",
        "COMPLETED",
        "FAILED",
        "CANCELLED",
        "REFUNDED",
      ],
      required: true,
      index: true,
    },
    paypalOrderId: {
      type: String,
      sparse: true,
      index: true,
    },
    paypalCaptureId: {
      type: String,
      sparse: true,
    },
    paypalPayerEmail: {
      type: String,
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    spendingReserved: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

TransactionSchema.index({ userId: 1, createdAt: -1 });
TransactionSchema.index({ userId: 1, paymentStatus: 1, createdAt: -1 });
TransactionSchema.index({
  userId: 1,
  "product.name": 1,
  "merchant.name": 1,
  amount: 1,
  createdAt: -1,
});

export const Transaction: Model<ITransaction> = registerModel<ITransaction>(
  "Transaction",
  TransactionSchema
);

