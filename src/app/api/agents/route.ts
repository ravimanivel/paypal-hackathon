import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongodb";
import { requireAuth } from "@/lib/auth/session";
import { Agent } from "@/models/Agent";
import { ensureDefaultUserAgents } from "@/lib/db/seed-defaults";
import { recordAuditLog } from "@/lib/security/audit";
import { apiSuccess, handleApiError } from "@/lib/utils";

const createAgentSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().min(5).max(400),
  allowedCategories: z
    .array(z.string().trim().min(1))
    .default(["Laptops", "Electronics", "Accessories"]),
  paypalToolkitEnabled: z.boolean().default(true),
});

export async function GET() {
  try {
    const session = await requireAuth();
    await connectDB();
    await ensureDefaultUserAgents(session.userId);

    const agents = await Agent.find({ userId: session.userId })
      .sort({ createdAt: 1 })
      .lean();

    return apiSuccess({
      agents: agents.map((a) => ({
        id: String(a._id),
        name: a.name,
        description: a.description,
        status: a.status,
        configuration: a.configuration,
        totalProposals: a.totalProposals || 0,
        approvedProposals: a.approvedProposals || 0,
        blockedProposals: a.blockedProposals || 0,
        lastActiveAt: a.lastActiveAt,
        createdAt: a.createdAt,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();
    const parsed = createAgentSchema.parse(body);

    await connectDB();
    const agent = await Agent.create({
      userId: session.userId,
      name: parsed.name,
      description: parsed.description,
      status: "ACTIVE",
      configuration: {
        modelName: "gpt-4o-mini",
        allowedCategories: parsed.allowedCategories,
        paypalToolkitEnabled: parsed.paypalToolkitEnabled,
        directCaptureAllowed: false, // Hard invariant: AI can never capture directly
        maxProposalsPerTurn: 3,
      },
    });

    await recordAuditLog({
      userId: session.userId,
      actorRole: session.role,
      action: "AGENT_CREATED",
      entityType: "AGENT",
      entityId: String(agent._id),
      metadata: {
        name: agent.name,
        paypalToolkitEnabled: parsed.paypalToolkitEnabled,
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
          totalProposals: 0,
          approvedProposals: 0,
          blockedProposals: 0,
        },
      },
      "AI Agent registered under AgentGuard Firewall protection",
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}

