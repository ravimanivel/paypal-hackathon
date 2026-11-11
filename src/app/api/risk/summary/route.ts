import { connectDB } from "@/lib/db/mongodb";
import { requireAuth } from "@/lib/auth/session";
import { Transaction } from "@/models/Transaction";
import { AuditLog } from "@/models/AuditLog";
import { toMajorUnits } from "@/lib/utils/currency";
import { apiSuccess, handleApiError } from "@/lib/utils";

export async function GET() {
  try {
    const session = await requireAuth();
    await connectDB();

    const transactions = await Transaction.find({ userId: session.userId })
      .sort({ createdAt: -1 })
      .lean();

    const auditEvents = await AuditLog.find({ userId: session.userId })
      .sort({ createdAt: -1 })
      .limit(25)
      .lean();

    let totalBlocked = 0;
    let highRiskCount = 0;
    let duplicateAttempts = 0;
    let untrustedMerchantAttempts = 0;

    const distribution = [
      { bucket: "0-24 (Low)", count: 0, fill: "#10b981" },
      { bucket: "25-49 (Medium)", count: 0, fill: "#f59e0b" },
      { bucket: "50-74 (High)", count: 0, fill: "#f97316" },
      { bucket: "75-100 (Critical)", count: 0, fill: "#ef4444" },
    ];

    const merchantMap = new Map<
      string,
      {
        merchant: string;
        totalCount: number;
        blockedCount: number;
        avgRiskScore: number;
        isTrusted: boolean;
      }
    >();

    for (const tx of transactions) {
      if (tx.firewallDecision === "BLOCKED") totalBlocked += 1;
      if (tx.riskLevel === "HIGH" || tx.riskLevel === "CRITICAL") {
        highRiskCount += 1;
      }
      if (
        tx.violatedRules?.includes("DUPLICATE_TRANSACTION_DETECTED") ||
        tx.riskReasons?.some((r) => r.toLowerCase().includes("duplicate"))
      ) {
        duplicateAttempts += 1;
      }
      if (!tx.merchant.isTrusted) {
        untrustedMerchantAttempts += 1;
      }

      if (tx.riskScore < 25) distribution[0].count += 1;
      else if (tx.riskScore < 50) distribution[1].count += 1;
      else if (tx.riskScore < 75) distribution[2].count += 1;
      else distribution[3].count += 1;

      const mName = tx.merchant.name;
      const existing = merchantMap.get(mName) || {
        merchant: mName,
        totalCount: 0,
        blockedCount: 0,
        avgRiskScore: 0,
        isTrusted: Boolean(tx.merchant.isTrusted),
      };
      const nextCount = existing.totalCount + 1;
      existing.avgRiskScore = Math.round(
        (existing.avgRiskScore * existing.totalCount + tx.riskScore) / nextCount
      );
      existing.totalCount = nextCount;
      if (tx.firewallDecision === "BLOCKED") existing.blockedCount += 1;
      merchantMap.set(mName, existing);
    }

    return apiSuccess({
      metrics: {
        totalEvaluated: transactions.length,
        totalBlocked,
        highRiskCount,
        duplicateAttempts,
        untrustedMerchantAttempts,
      },
      distribution,
      merchantRiskBreakdown: Array.from(merchantMap.values()),
      recentRiskDecisions: transactions.slice(0, 15).map((t) => ({
        id: String(t._id),
        productName: t.product.name,
        merchantName: t.merchant.name,
        amountMajor: toMajorUnits(t.amount),
        currency: t.currency,
        riskScore: t.riskScore,
        riskLevel: t.riskLevel,
        riskReasons: t.riskReasons,
        firewallDecision: t.firewallDecision,
        policyReasons: t.policyReasons,
        violatedRules: t.violatedRules,
        createdAt: t.createdAt,
      })),
      recentSecurityEvents: auditEvents.map((e) => ({
        id: String(e._id),
        action: e.action,
        entityType: e.entityType,
        actorRole: e.actorRole,
        metadata: e.metadata,
        createdAt: e.createdAt,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

