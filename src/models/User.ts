import mongoose, { Schema, Document, Model } from "mongoose";
import { AccountStatus, CurrencyCode, UserRole } from "@/types";
import { registerModel } from "@/lib/db/mongodb";

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  accountStatus: AccountStatus;
  preferredCurrency: CurrencyCode;
  onboardingCompleted: boolean;
  onboardingStep?: number;
  onboardingDraft?: Record<string, unknown>;
  lastActivePath?: string;
  paypalConnected: boolean;
  paypalSandboxPayerEmail?: string;
  resetTokenHash?: string;
  resetTokenExpiresAt?: Date;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ["USER", "ADMIN"],
      default: "USER",
      index: true,
    },
    accountStatus: {
      type: String,
      enum: ["ACTIVE", "SUSPENDED", "DISABLED"],
      default: "ACTIVE",
      index: true,
    },
    preferredCurrency: {
      type: String,
      enum: ["INR", "USD", "EUR", "GBP"],
      default: "INR",
    },
    onboardingCompleted: {
      type: Boolean,
      default: false,
    },
    onboardingStep: {
      type: Number,
      default: 1,
      min: 1,
      max: 3,
    },
    onboardingDraft: {
      type: Schema.Types.Mixed,
      default: {},
    },
    lastActivePath: {
      type: String,
      default: "/onboarding",
    },
    paypalConnected: {
      type: Boolean,
      default: false,
    },
    paypalSandboxPayerEmail: {
      type: String,
      trim: true,
    },
    resetTokenHash: {
      type: String,
      select: false,
    },
    resetTokenExpiresAt: {
      type: Date,
      select: false,
    },
    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.passwordHash;
        delete ret.resetTokenHash;
        delete ret.resetTokenExpiresAt;
        return ret;
      },
    },
  }
);

export const User: Model<IUser> = registerModel<IUser>("User", UserSchema);
