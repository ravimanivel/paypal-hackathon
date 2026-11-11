interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitBucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(
  key: string,
  maxRequests = 10,
  windowMs = 60_000
): RateLimitResult {
  const now = Date.now();
  const existing = rateLimitStore.get(key);

  if (!existing || existing.resetAt <= now) {
    const bucket: RateLimitBucket = {
      count: 1,
      resetAt: now + windowMs,
    };
    rateLimitStore.set(key, bucket);
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: bucket.resetAt,
    };
  }

  existing.count += 1;
  if (existing.count > maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
    };
  }

  return {
    allowed: true,
    remaining: maxRequests - existing.count,
    resetAt: existing.resetAt,
  };
}

export function resetRateLimit(key: string): void {
  rateLimitStore.delete(key);
}

const SENSITIVE_KEYS = [
  "password",
  "passwordhash",
  "confirmPassword",
  "secret",
  "clientsecret",
  "token",
  "accesstoken",
  "approvaltoken",
  "authorization",
  "cookie",
];

/**
 * Scrubs any sensitive keys from audit log metadata so secrets or credentials are never stored.
 */
export function sanitizeAuditMetadata(
  metadata?: Record<string, unknown>
): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object") return {};
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(metadata)) {
    const lowerKey = k.toLowerCase();
    if (SENSITIVE_KEYS.some((s) => lowerKey.includes(s))) {
      cleaned[k] = "[REDACTED]";
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      cleaned[k] = sanitizeAuditMetadata(v as Record<string, unknown>);
    } else {
      cleaned[k] = v;
    }
  }
  return cleaned;
}

