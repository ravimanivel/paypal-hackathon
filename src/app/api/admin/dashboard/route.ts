import { connectDB, getDbConnectionStatus } from "@/lib/db/mongodb";
import { requireAdmin } from "@/lib/auth/session";
import { getSystemConfigStatus } from "@/lib/env";
import { User } from "@/models/User";
import { Agent } from "@/models/Agent";
import { Transaction } from "@/models/Transaction";
import { Approval } from "@/models/Approval";
import { AuditLog } from "@/models/AuditLog";
import { toMajorUnits } from "@/lib/utils/currency";
import { apiSuccess, handleApiError } from "@/lib/utils";

export async function GET() {
  try {
    await requireAdmin();
    await connectDB();

    const [
      users,
      agents,
      transactions,
      pendingApprovalsCount,
      recentAuditLogs,
    ] = await Promise.all([
      User.find().lean(),
      Agent.find().sort({ updatedAt: -1 }).lean(),
      Transaction.find().sort({ createdAt: -1 }).lean(),
      Approval.countDocuments({ status: "PENDING" }),
      AuditLog.find().sort({ createdAt: -1 }).limit(15).lean(),
    ]);

    const activeUsersCount = users.filter(
      (u) => u.accountStatus === "ACTIVE"
    ).length;

    let completedTransactionsCount = 0;
    let blockedTransactionsCount = 0;
    let highRiskEventsCount = 0;
    let totalProtectedVolumeMinor = 0;

    for (const tx of transactions) {
      if (tx.paymentStatus === "COMPLETED") {
        completedTransactionsCount += 1;
        totalProtectedVolumeMinor += tx.amount;
      }
      if (tx.firewallDecision === "BLOCKED" || tx.paymentStatus === "BLOCKED") {
        blockedTransactionsCount += 1;
      }
      if (
        tx.riskLevel === "HIGH" ||
        tx.riskLevel === "CRITICAL" ||
        tx.riskScore >= 50
      ) {
        highRiskEventsCount += 1;
      }
    }

    const dbStatus = getDbConnectionStatus();
    const sysConfig = getSystemConfigStatus();

    return apiSuccess({
      metrics: {
        totalUsers: users.length,
        activeUsers: activeUsersCount,
        totalAgents: agents.length,
        totalPurchaseProposals: transactions.length,
        completedTransactions: completedTransactionsCount,
        blockedTransactions: blockedTransactionsCount,
        pendingApprovals: pendingApprovalsCount,
        highRiskEvents: highRiskEventsCount,
        totalProtectedVolumeMajor: toMajorUnits(totalProtectedVolumeMinor),
      },
      systemStatus: {
        mongodbConnected: dbStatus.connected,
        mongodbDatabase: dbStatus.dbName,
        mongodbMode: dbStatus.mode,
        mongodbUriConfigured: sysConfig.mongodbConfigured,
        openaiConfigured: sysConfig.openaiConfigured,
        openaiModel: sysConfig.openaiModel,
        paypalConfigured: sysConfig.paypalConfigured,
        paypalBaseUrl: sysConfig.paypalBaseUrl,
        paypalWebhookConfigured: sysConfig.paypalWebhookConfigured,
      },
      recentAgents: agents.slice(0, 10).map((a) => ({
        id: String(a._id),
        userId: String(a.userId),
        name: a.name,
        status: a.status,
        totalProposals: a.totalProposals || 0,
        approvedProposals: a.approvedProposals || 0,
        blockedProposals: a.blockedProposals || 0,
        lastActiveAt: a.lastActiveAt,
      })),
      recentTransactions: transactions.slice(0, 10).map((t) => ({
        id: String(t._id),
        userId: String(t.userId),
        productName: t.product.name,
        merchantName: t.merchant.name,
        amountMajor: toMajorUnits(t.amount),
        currency: t.currency,
        riskScore: t.riskScore,
        riskLevel: t.riskLevel,
        firewallDecision: t.firewallDecision,
        paymentStatus: t.paymentStatus,
        createdAt: t.createdAt,
      })),
      recentAuditLogs: recentAuditLogs.map((l) => ({
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

