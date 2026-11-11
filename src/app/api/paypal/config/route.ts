import { connectDB } from "@/lib/db/mongodb";
import { requireAuth } from "@/lib/auth/session";
import { User } from "@/models/User";
import { getPayPalConfigurationStatus } from "@/services/paypal.service";
import { initializePayPalAgentToolkit } from "@/lib/paypal/agent-toolkit";
import { apiSuccess, handleApiError } from "@/lib/utils";

export async function GET() {
  try {
    const session = await requireAuth();
    await connectDB();

    const user = await User.findById(session.userId).lean();
    const paypalConfig = getPayPalConfigurationStatus();
    const toolkit = await initializePayPalAgentToolkit();

    return apiSuccess({
      configured: paypalConfig.configured,
      clientId: paypalConfig.clientId,
      environment: paypalConfig.environment,
      baseUrl: paypalConfig.baseUrl,
      webhookConfigured: paypalConfig.webhookConfigured,
      userPayPalConnected: Boolean(user?.paypalConnected),
      paypalSandboxPayerEmail: user?.paypalSandboxPayerEmail || "",
      agentToolkit: {
        enabled: toolkit.enabled,
        mode: toolkit.mode,
        allowedActions: toolkit.allowedActions,
        forbiddenTools: toolkit.forbiddenTools,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

