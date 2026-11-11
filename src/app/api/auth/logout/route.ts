import { clearSessionCookie, getSession } from "@/lib/auth/session";
import { recordAuditLog } from "@/lib/security/audit";
import { apiSuccess, handleApiError } from "@/lib/utils";
import { connectDB } from "@/lib/db/mongodb";

export async function POST() {
  try {
    const session = await getSession();
    await clearSessionCookie();

    if (session) {
      await connectDB();
      await recordAuditLog({
        userId: session.userId,
        actorRole: session.role,
        action: "USER_LOGOUT",
        entityType: "USER",
        entityId: session.userId,
      });
    }

    return apiSuccess({ loggedOut: true }, "Logged out successfully");
  } catch (error) {
    return handleApiError(error);
  }
}

