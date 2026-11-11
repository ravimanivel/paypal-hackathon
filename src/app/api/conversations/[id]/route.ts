import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/mongodb";
import { requireAuth } from "@/lib/auth/session";
import { Conversation } from "@/models/Conversation";
import { apiError, apiSuccess, handleApiError } from "@/lib/utils";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await context.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return apiError("Invalid conversation ID", 400);
    }

    await connectDB();
    const conversation = await Conversation.findById(id).lean();
    if (!conversation) {
      return apiError("Conversation not found", 404);
    }

    if (String(conversation.userId) !== String(session.userId)) {
      return apiError(
        "Access denied: You do not own this conversation.",
        403
      );
    }

    return apiSuccess({
      conversation: {
        id: String(conversation._id),
        agentId: String(conversation.agentId),
        title: conversation.title,
        messages: conversation.messages || [],
        updatedAt: conversation.updatedAt,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await context.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return apiError("Invalid conversation ID", 400);
    }

    await connectDB();
    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return apiError("Conversation not found", 404);
    }

    if (String(conversation.userId) !== String(session.userId)) {
      return apiError("Access denied: You do not own this conversation.", 403);
    }

    await Conversation.deleteOne({ _id: id });

    return apiSuccess({ deletedId: id });
  } catch (error) {
    return handleApiError(error);
  }
}


