import { connectDB } from "@/lib/db/mongodb";
import { requireAdmin } from "@/lib/auth/session";
import { Transaction } from "@/models/Transaction";
import { AuditLog } from "@/models/AuditLog";
import { toMajorUnits } from "@/lib/utils/currency";
import { apiSuccess, handleApiError } from "@/lib/utils";

export async function GET() {
  try {
    await requireAdmin();
    await connectDB();

    const [transactions, securityLogs] = await Promise.all([
      Transaction.find().sort({ createdAt: -1 }).lean(),
      AuditLog.find({
        action: {
          $regex: "BLOCKED|FAILED|UNAUTHORIZED|INVALID|EXCEEDED|ESCALATION",
          $options: "i",
        },
      })
        .sort({ createdAt: -1 })
        .limit(40)
        .lean(),
    ]);

    const blockedTransactions = transactions.filter(
      (t) => t.firewallDecision === "BLOCKED"
    );
    const highRiskTransactions = transactions.filter(
      (t) =>
        t.riskLevel === "HIGH" ||
        t.riskLevel === "CRITICAL" ||
        t.riskScore >= 50
    );

    const merchantStats = new Map<
      string,
      {
        name: string;
        totalProposals: number;
        blockedCount: number;
        completedCount: number;
        avgRiskScore: number;
        isTrusted: boolean;
      }
    >();

    for (const tx of transactions) {
      const m = tx.merchant.name;
      const cur = merchantStats.get(m) || {
        name: m,
        totalProposals: 0,
        blockedCount: 0,
        completedCount: 0,
        avgRiskScore: 0,
        isTrusted: Boolean(tx.merchant.isTrusted),
      };
      const nextCount = cur.totalProposals + 1;
      cur.avgRiskScore = Math.round(
        (cur.avgRiskScore * cur.totalProposals + tx.riskScore) / nextCount
      );
      cur.totalProposals = nextCount;
      if (tx.firewallDecision === "BLOCKED") cur.blockedCount += 1;
      if (tx.paymentStatus === "COMPLETED") cur.completedCount += 1;
      merchantStats.set(m, cur);
    }

    return apiSuccess({
      summary: {
        totalEvaluated: transactions.length,
        totalBlocked: blockedTransactions.length,
        totalHighRisk: highRiskTransactions.length,
        securityAlertCount: securityLogs.length,
      },
      blockedTransactions: blockedTransactions.slice(0, 25).map((t) => ({
        id: String(t._id),
        userId: String(t.userId),
        productName: t.product.name,
        merchantName: t.merchant.name,
        amountMajor: toMajorUnits(t.amount),
        currency: t.currency,
        riskScore: t.riskScore,
        riskLevel: t.riskLevel,
        riskReasons: t.riskReasons,
        policyReasons: t.policyReasons,
        violatedRules: t.violatedRules,
        createdAt: t.createdAt,
      })),
      merchants: Array.from(merchantStats.values()),
      securityAlerts: securityLogs.map((l) => ({
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

