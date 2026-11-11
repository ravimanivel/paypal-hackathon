import mongoose, { Schema, Document, Model } from "mongoose";
import { CurrencyCode, PolicyPreset } from "@/types";
import { registerModel } from "@/lib/db/mongodb";

export interface IPolicy extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  preset: PolicyPreset;
  currency: CurrencyCode;
  maxTransactionAmount: number; // Integer minor units (e.g., paise/cents)
  dailyLimit: number; // Integer minor units
  weeklyLimit: number; // Integer minor units
  monthlyLimit: number; // Integer minor units
  autoApprovalThreshold: number; // Integer minor units
  manualApprovalThreshold: number; // Integer minor units
  trustedMerchants: string[];
  blockedMerchants: string[];
  requireTrustedMerchantForAuto: boolean;
  duplicateProtection: boolean;
  duplicateWindowMinutes: number;
  autoApprovalEnabled: boolean;
  reservedSpendingMinor: number; // Atomic reservation counter for concurrent safety
  policyVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

const PolicySchema = new Schema<IPolicy>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    preset: {
      type: String,
      enum: ["RELAXED", "BALANCED", "STRICT", "CUSTOM"],
      default: "BALANCED",
    },
    currency: {
      type: String,
      enum: ["INR", "USD", "EUR", "GBP"],
      default: "INR",
    },
    maxTransactionAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    dailyLimit: {
      type: Number,
      required: true,
      min: 0,
    },
    weeklyLimit: {
      type: Number,
      required: true,
      min: 0,
    },
    monthlyLimit: {
      type: Number,
      required: true,
      min: 0,
    },
    autoApprovalThreshold: {
      type: Number,
      required: true,
      min: 0,
    },
    manualApprovalThreshold: {
      type: Number,
      required: true,
      min: 0,
    },
    trustedMerchants: {
      type: [String],
      default: ["Amazon India", "Flipkart", "Croma", "Reliance Digital", "Apple Store", "Dell India", "Lenovo Store"],
    },
    blockedMerchants: {
      type: [String],
      default: ["DarkMarket Electronics", "UntrustedKeys Hub", "AnonCrypto Hardware"],
    },
    requireTrustedMerchantForAuto: {
      type: Boolean,
      default: true,
    },
    duplicateProtection: {
      type: Boolean,
      default: true,
    },
    duplicateWindowMinutes: {
      type: Number,
      default: 30,
      min: 1,
      max: 1440,
    },
    autoApprovalEnabled: {
      type: Boolean,
      default: true,
    },
    reservedSpendingMinor: {
      type: Number,
      default: 0,
      min: 0,
    },
    policyVersion: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  { timestamps: true }
);

export const Policy: Model<IPolicy> = registerModel<IPolicy>(
  "Policy",
  PolicySchema
);

