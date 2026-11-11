import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongodb";
import { requireAuth } from "@/lib/auth/session";
import { Agent } from "@/models/Agent";
import { Conversation } from "@/models/Conversation";
import { getOrCreateUserPolicy } from "@/services/policy.service";
import { generateShoppingAgentResponse } from "@/services/agent.service";
import { ensureDefaultUserAgents } from "@/lib/db/seed-defaults";
import { toMajorUnits } from "@/lib/utils/currency";
import { recordAuditLog } from "@/lib/security/audit";
import { apiError, apiSuccess, handleApiError } from "@/lib/utils";

const chatRequestSchema = z.object({
  message: z.string().trim().min(2).max(1500),
  conversationId: z.string().optional(),
  agentId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();
    const parsed = chatRequestSchema.parse(body);

    await connectDB();
    await ensureDefaultUserAgents(session.userId);

    const policy = await getOrCreateUserPolicy(
      session.userId,
      session.preferredCurrency
    );

    let agent =
      parsed.agentId && mongoose.Types.ObjectId.isValid(parsed.agentId)
        ? await Agent.findOne({
            _id: parsed.agentId,
            userId: session.userId,
          })
        : await Agent.findOne({ userId: session.userId, status: "ACTIVE" });

    if (!agent) {
      agent = await Agent.findOne({ userId: session.userId });
    }

    if (!agent) {
      return apiError("No AI Shopping Agent available.", 404);
    }

    if (agent.status !== "ACTIVE") {
      return apiError(
        `AI Agent "${agent.name}" is currently ${agent.status}. Activate it in My AI Agents to submit shopping requests.`,
        403
      );
    }

    const aiResponse = await generateShoppingAgentResponse({
      userMessage: parsed.message,
      currency: policy.currency,
      maxPolicyLimitMajor: toMajorUnits(policy.maxTransactionAmount),
      autoApprovalLimitMajor: toMajorUnits(policy.autoApprovalThreshold),
    });

    const userMsgObj = {
      id: `msg-u-${Date.now()}`,
      role: "user" as const,
      content: parsed.message,
      createdAt: new Date(),
    };

    const assistantMsgObj = {
      id: `msg-a-${Date.now() + 1}`,
      role: "assistant" as const,
      content: aiResponse.assistantMessage,
      extractedIntent: aiResponse.extractedIntent,
      proposals: aiResponse.proposals,
      createdAt: new Date(),
    };

    let conversation =
      parsed.conversationId &&
      mongoose.Types.ObjectId.isValid(parsed.conversationId)
        ? await Conversation.findOne({
            _id: parsed.conversationId,
            userId: session.userId,
          })
        : null;

    if (conversation) {
      conversation.messages.push(userMsgObj, assistantMsgObj);
      await conversation.save();
    } else {
      conversation = await Conversation.create({
        userId: session.userId,
        agentId: agent._id,
        title: parsed.message.slice(0, 70),
        messages: [userMsgObj, assistantMsgObj],
      });
    }

    agent.lastActiveAt = new Date();
    await agent.save();

    await recordAuditLog({
      userId: session.userId,
      actorRole: "AGENT",
      action: "SHOPPING_AGENT_PROPOSAL_GENERATED",
      entityType: "AGENT",
      entityId: String(agent._id),
      metadata: {
        conversationId: String(conversation._id),
        extractedCategory: aiResponse.extractedIntent.category,
        extractedBudgetMajor: aiResponse.extractedIntent.budgetMajor,
        proposalCount: aiResponse.proposals.length,
      },
    });

    return apiSuccess({
      conversationId: String(conversation._id),
      agent: {
        id: String(agent._id),
        name: agent.name,
      },
      userMessage: userMsgObj,
      assistantMessage: assistantMsgObj,
      extractedIntent: aiResponse.extractedIntent,
      proposals: aiResponse.proposals,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

