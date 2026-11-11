import fs from "fs";
import path from "path";

export interface ServerEnv {
  MONGODB_URI?: string;
  AUTH_SECRET: string;
  NEXTAUTH_URL: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL: string;
  PAYPAL_CLIENT_ID?: string;
  PAYPAL_CLIENT_SECRET?: string;
  PAYPAL_BASE_URL: string;
  PAYPAL_WEBHOOK_ID?: string;
  NEXT_PUBLIC_APP_URL: string;
}

function readEnvFilesFallback(): Record<string, string> {
  if (process.env.NODE_ENV === "test") {
    return {};
  }
  const merged: Record<string, string> = {};
  const files = [".env.example", ".env", ".env.local"];
  for (const fileName of files) {
    try {
      const fullPath = path.join(process.cwd(), fileName);
      if (!fs.existsSync(fullPath)) continue;
      const content = fs.readFileSync(fullPath, "utf8");
      for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const eqIdx = line.indexOf("=");
        if (eqIdx === -1) continue;
        const key = line.slice(0, eqIdx).trim();
        let val = line.slice(eqIdx + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (key && val) {
          merged[key] = val;
        }
      }
    } catch {
      // Ignore read errors
    }
  }
  return merged;
}

export function isConfiguredValue(val?: string): boolean {
  if (!val) return false;
  const trimmed = val.trim();
  if (!trimmed) return false;
  if (
    trimmed.startsWith("YOUR_") ||
    trimmed.startsWith("GENERATE_") ||
    trimmed === "changeme"
  ) {
    return false;
  }
  return true;
}

export function getServerEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error(
      "Server environment variables cannot be accessed on the client."
    );
  }

  const diskEnv = readEnvFilesFallback();
  const pick = (key: string): string | undefined => {
    const procVal = process.env[key];
    if (isConfiguredValue(procVal)) return procVal!.trim();
    const diskVal = diskEnv[key];
    if (isConfiguredValue(diskVal)) return diskVal.trim();
    return procVal?.trim() || diskVal?.trim() || undefined;
  };

  const rawAuthSecret = pick("AUTH_SECRET");
  const authSecret =
    rawAuthSecret && rawAuthSecret.length >= 16
      ? rawAuthSecret
      : "agentguard-dev-fallback-secret-change-in-production-987654321";

  return {
    MONGODB_URI: pick("MONGODB_URI"),
    AUTH_SECRET: authSecret,
    NEXTAUTH_URL: pick("NEXTAUTH_URL") || "http://localhost:3000",
    OPENAI_API_KEY: pick("OPENAI_API_KEY"),
    OPENAI_MODEL: pick("OPENAI_MODEL") || "gpt-4o-mini",
    PAYPAL_CLIENT_ID: pick("PAYPAL_CLIENT_ID"),
    PAYPAL_CLIENT_SECRET: pick("PAYPAL_CLIENT_SECRET"),
    PAYPAL_BASE_URL:
      pick("PAYPAL_BASE_URL") || "https://api-m.sandbox.paypal.com",
    PAYPAL_WEBHOOK_ID: pick("PAYPAL_WEBHOOK_ID"),
    NEXT_PUBLIC_APP_URL:
      pick("NEXT_PUBLIC_APP_URL") || "http://localhost:3000",
  };
}

export function getSystemConfigStatus() {
  const env = getServerEnv();
  return {
    mongodbConfigured: isConfiguredValue(env.MONGODB_URI),
    authSecretConfigured:
      isConfiguredValue(env.AUTH_SECRET) &&
      env.AUTH_SECRET !==
        "agentguard-dev-fallback-secret-change-in-production-987654321",
    openaiConfigured: isConfiguredValue(env.OPENAI_API_KEY),
    openaiModel: env.OPENAI_MODEL || "gpt-4o-mini",
    paypalConfigured:
      isConfiguredValue(env.PAYPAL_CLIENT_ID) &&
      isConfiguredValue(env.PAYPAL_CLIENT_SECRET),
    paypalBaseUrl: env.PAYPAL_BASE_URL,
    paypalWebhookConfigured: isConfiguredValue(env.PAYPAL_WEBHOOK_ID),
    appUrl: env.NEXT_PUBLIC_APP_URL,
  };
}

