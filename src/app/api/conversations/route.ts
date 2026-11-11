import { connectDB } from "@/lib/db/mongodb";
import { requireAuth } from "@/lib/auth/session";
import { Conversation } from "@/models/Conversation";
import { apiSuccess, handleApiError } from "@/lib/utils";

export async function GET() {
  try {
    const session = await requireAuth();
    await connectDB();

    const conversations = await Conversation.find({ userId: session.userId })
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean();

    return apiSuccess({
      conversations: conversations.map((c) => ({
        id: String(c._id),
        agentId: String(c.agentId),
        title: c.title,
        messageCount: c.messages?.length || 0,
        updatedAt: c.updatedAt,
        createdAt: c.createdAt,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

