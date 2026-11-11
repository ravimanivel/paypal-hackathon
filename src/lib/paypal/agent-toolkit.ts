import { getServerEnv, isConfiguredValue } from "@/lib/env";

/**
 * Official PayPal Agent Toolkit integration wrapper.
 *
 * SECURITY ARCHITECTURE INVARIANT:
 * The AI Shopping Agent is NEVER granted `pay_order` or any unrestricted payment capture authority.
 * Only read/preparation capabilities are permitted in the toolkit configuration;
 * actual order creation and payment capture are gated behind AgentGuard's deterministic
 * backend Policy & Approval Verification Service (`paypal.service.ts`).
 */

export const ALLOWED_AGENT_TOOLKIT_ACTIONS = {
  orders: {
    create: true,
    get: true,
    capture: false, // EXPLICITLY FORBIDDEN FOR AI AGENT
  },
  invoices: {
    create: false,
    list: true,
  },
  disputes: {
    list: true,
    get: true,
  },
} as const;

export const FORBIDDEN_AGENT_TOOLS = [
  "pay_order",
  "capture_order",
  "create_payout",
  "send_money",
  "approve_payment",
] as const;

export function assertToolAllowedForAgent(toolName: string): void {
  const normalized = toolName.trim().toLowerCase();
  if (
    FORBIDDEN_AGENT_TOOLS.some((forbidden) => normalized.includes(forbidden))
  ) {
    throw new Error(
      `SECURITY_VIOLATION: AI Agent is strictly prohibited from invoking restricted payment execution tool "${toolName}". All payment captures require AgentGuard Firewall & Customer Checkout verification.`
    );
  }
}

export async function initializePayPalAgentToolkit() {
  const env = getServerEnv();
  const isConfigured =
    isConfiguredValue(env.PAYPAL_CLIENT_ID) &&
    isConfiguredValue(env.PAYPAL_CLIENT_SECRET);

  if (!isConfigured) {
    return {
      enabled: false,
      mode: "sandbox_unconfigured" as const,
      allowedActions: ALLOWED_AGENT_TOOLKIT_ACTIONS,
      forbiddenTools: FORBIDDEN_AGENT_TOOLS,
      toolkitInstance: null,
    };
  }

  try {
    const toolkitModule: any = await import("@paypal/agent-toolkit/ai-sdk").catch(
      () => null
    );
    if (toolkitModule && toolkitModule.PayPalAgentToolkit) {
      const instance = new toolkitModule.PayPalAgentToolkit({
        clientId: env.PAYPAL_CLIENT_ID!,
        clientSecret: env.PAYPAL_CLIENT_SECRET!,
        configuration: {
          actions: ALLOWED_AGENT_TOOLKIT_ACTIONS,
          context: {
            sandbox: true,
          },
        },
      });
      return {
        enabled: true,
        mode: "sandbox_active" as const,
        allowedActions: ALLOWED_AGENT_TOOLKIT_ACTIONS,
        forbiddenTools: FORBIDDEN_AGENT_TOOLS,
        toolkitInstance: instance,
      };
    }
  } catch {
    // Fallback metadata if toolkit SDK encounters runtime environment issues
  }

  return {
    enabled: true,
    mode: "sandbox_rest_bridge" as const,
    allowedActions: ALLOWED_AGENT_TOOLKIT_ACTIONS,
    forbiddenTools: FORBIDDEN_AGENT_TOOLS,
    toolkitInstance: null,
  };
}

