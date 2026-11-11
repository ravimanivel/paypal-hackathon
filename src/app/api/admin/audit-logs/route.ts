import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import { requireAdmin } from "@/lib/auth/session";
import { AuditLog } from "@/models/AuditLog";
import { apiSuccess, handleApiError } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    await connectDB();

    const { searchParams } = new URL(req.url);
    const entityType = searchParams.get("entityType");

    const filter: Record<string, unknown> = {};
    if (entityType && entityType !== "ALL") {
      filter.entityType = entityType;
    }

    const logs = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(150)
      .lean();

    return apiSuccess({
      logs: logs.map((l) => ({
        id: String(l._id),
        userId: l.userId ? String(l.userId) : null,
        actorRole: l.actorRole,
        action: l.action,
        entityType: l.entityType,
        entityId: l.entityId,
        metadata: l.metadata,
        createdAt: l.createdAt,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

