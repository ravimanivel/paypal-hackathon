import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongodb";
import { requireAuth } from "@/lib/auth/session";
import { Agent } from "@/models/Agent";
import { recordAuditLog } from "@/lib/security/audit";
import { apiError, apiSuccess, handleApiError } from "@/lib/utils";

const updateAgentSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().min(5).max(400).optional(),
  status: z.enum(["ACTIVE", "PAUSED", "REVOKED"]).optional(),
  allowedCategories: z.array(z.string()).optional(),
  paypalToolkitEnabled: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await context.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return apiError("Invalid agent ID", 400);
    }

    await connectDB();
    const agent = await Agent.findById(id);
    if (!agent) {
      return apiError("AI Agent not found", 404);
    }

    if (String(agent.userId) !== String(session.userId)) {
      return apiError("Access denied: You do not own this AI Agent.", 403);
    }

    const body = await req.json();
    if (
      body?.configuration?.directCaptureAllowed === true ||
      body?.directCaptureAllowed === true
    ) {
      return apiError(
        "Security Invariant Violation: AI agents cannot be granted unrestricted payment capture authority.",
        403
      );
    }

    const parsed = updateAgentSchema.parse(body);
    if (parsed.name !== undefined) agent.name = parsed.name;
    if (parsed.description !== undefined)
      agent.description = parsed.description;
    if (parsed.status !== undefined) agent.status = parsed.status;
    if (parsed.allowedCategories !== undefined) {
      agent.configuration.allowedCategories = parsed.allowedCategories;
    }
    if (parsed.paypalToolkitEnabled !== undefined) {
      agent.configuration.paypalToolkitEnabled = parsed.paypalToolkitEnabled;
    }
    agent.configuration.directCaptureAllowed = false;

    await agent.save();

    await recordAuditLog({
      userId: session.userId,
      actorRole: session.role,
      action: "AGENT_UPDATED",
      entityType: "AGENT",
      entityId: String(agent._id),
      metadata: {
        name: agent.name,
        status: agent.status,
      },
    });

    return apiSuccess(
      {
        agent: {
          id: String(agent._id),
          name: agent.name,
          description: agent.description,
          status: agent.status,
          configuration: agent.configuration,
          totalProposals: agent.totalProposals,
          approvedProposals: agent.approvedProposals,
          blockedProposals: agent.blockedProposals,
        },
      },
      "AI Agent updated"
    );
  } catch (error) {
    return handleApiError(error);
  }
}

