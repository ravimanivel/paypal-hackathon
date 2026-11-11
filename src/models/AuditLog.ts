import mongoose, { Schema, Document, Model } from "mongoose";
import { registerModel } from "@/lib/db/mongodb";

export interface IAuditLog extends Document {
  _id: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId | null;
  actorRole: "USER" | "ADMIN" | "SYSTEM" | "AGENT";
  action: string;
  entityType:
    | "USER"
    | "POLICY"
    | "AGENT"
    | "TRANSACTION"
    | "APPROVAL"
    | "PAYPAL"
    | "SYSTEM";
  entityId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    actorRole: {
      type: String,
      enum: ["USER", "ADMIN", "SYSTEM", "AGENT"],
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      enum: [
        "USER",
        "POLICY",
        "AGENT",
        "TRANSACTION",
        "APPROVAL",
        "PAYPAL",
        "SYSTEM",
      ],
      required: true,
      index: true,
    },
    entityId: {
      type: String,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ userId: 1, createdAt: -1 });

export const AuditLog: Model<IAuditLog> = registerModel<IAuditLog>(
  "AuditLog",
  AuditLogSchema
);

