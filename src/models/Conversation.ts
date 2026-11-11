import mongoose, { Schema, Document, Model } from "mongoose";
import { ProductProposalItem } from "@/types";
import { registerModel } from "@/lib/db/mongodb";

export interface IConversationMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  extractedIntent?: {
    category?: string;
    budgetMajor?: number;
    currency?: string;
    requirements?: string[];
  };
  proposals?: ProductProposalItem[];
  transactionId?: string;
  createdAt: Date;
}

export interface IConversation extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  agentId: mongoose.Types.ObjectId;
  title: string;
  messages: IConversationMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const ConversationMessageSchema = new Schema<IConversationMessage>(
  {
    id: { type: String, required: true },
    role: { type: String, enum: ["user", "assistant", "system"], required: true },
    content: { type: String, required: true },
    extractedIntent: {
      category: String,
      budgetMajor: Number,
      currency: String,
      requirements: [String],
    },
    proposals: { type: Schema.Types.Mixed },
    transactionId: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ConversationSchema = new Schema<IConversation>(
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
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 140,
    },
    messages: {
      type: [ConversationMessageSchema],
      default: [],
    },
  },
  { timestamps: true }
);

ConversationSchema.index({ userId: 1, updatedAt: -1 });

export const Conversation: Model<IConversation> = registerModel<IConversation>(
  "Conversation",
  ConversationSchema
);

