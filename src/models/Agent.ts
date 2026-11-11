import mongoose, { Schema, Document, Model } from "mongoose";
import { registerModel } from "@/lib/db/mongodb";

export interface IAgent extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  name: string;
  description: string;
  status: "ACTIVE" | "PAUSED" | "REVOKED";
  configuration: {
    modelName: string;
    allowedCategories: string[];
    paypalToolkitEnabled: boolean;
    directCaptureAllowed: false; // Hard security invariant: AI agents never get direct capture authority
    maxProposalsPerTurn: number;
  };
  totalProposals: number;
  approvedProposals: number;
  blockedProposals: number;
  lastActiveAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AgentSchema = new Schema<IAgent>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 400,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "PAUSED", "REVOKED"],
      default: "ACTIVE",
      index: true,
    },
    configuration: {
      modelName: { type: String, default: "gpt-4o-mini" },
      allowedCategories: {
        type: [String],
        default: ["Laptops", "Electronics", "Accessories", "Software", "Office Equipment"],
      },
      paypalToolkitEnabled: { type: Boolean, default: true },
      directCaptureAllowed: { type: Boolean, default: false, immutable: true },
      maxProposalsPerTurn: { type: Number, default: 3 },
    },
    totalProposals: {
      type: Number,
      default: 0,
    },
    approvedProposals: {
      type: Number,
      default: 0,
    },
    blockedProposals: {
      type: Number,
      default: 0,
    },
    lastActiveAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

AgentSchema.index({ userId: 1, status: 1 });

export const Agent: Model<IAgent> = registerModel<IAgent>("Agent", AgentSchema);

