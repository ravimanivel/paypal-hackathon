import { connectDB, getDbConnectionStatus } from "@/lib/db/mongodb";
import { getSystemConfigStatus } from "@/lib/env";
import { apiSuccess, handleApiError } from "@/lib/utils";

export async function GET() {
  try {
    await connectDB();
    const dbStatus = getDbConnectionStatus();
    const sysConfig = getSystemConfigStatus();

    return apiSuccess(
      {
        status: "healthy",
        timestamp: new Date().toISOString(),
        database: {
          connected: dbStatus.connected,
          name: dbStatus.dbName,
          mode: dbStatus.mode,
          atlasConfigured: sysConfig.mongodbConfigured,
        },
        integrations: {
          openaiConfigured: sysConfig.openaiConfigured,
          openaiModel: sysConfig.openaiModel,
          paypalSandboxConfigured: sysConfig.paypalConfigured,
          paypalWebhookConfigured: sysConfig.paypalWebhookConfigured,
        },
      },
      "AgentGuard AI Firewall health check passed"
    );
  } catch (error) {
    return handleApiError(error);
  }
}

