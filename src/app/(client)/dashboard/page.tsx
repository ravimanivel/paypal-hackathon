"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
} from "recharts";
import {
  Shield,
  CheckCircle2,
  Clock,
  XOctagon,
  AlertTriangle,
  Bot,
  Sliders,
  CreditCard,
  ArrowRight,
  Activity,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress, Skeleton } from "@/components/ui/controls";
import { formatCurrency } from "@/lib/utils/currency";
import { CurrencyCode } from "@/types";

export default function ClientDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [txData, setTxData] = useState<any>(null);
  const [policyData, setPolicyData] = useState<any>(null);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [paypalConfig, setPaypalConfig] = useState<any>(null);

  useEffect(() => {
    async function fetchDashboard() {
      setLoading(true);
      try {
        const [txRes, polRes, appRes, agRes, ppRes] = await Promise.all([
          fetch("/api/transactions"),
          fetch("/api/policies"),
          fetch("/api/approvals?status=PENDING"),
          fetch("/api/agents"),
          fetch("/api/paypal/config"),
        ]);

        const [txJson, polJson, appJson, agJson, ppJson] = await Promise.all([
          txRes.json(),
          polRes.json(),
          appRes.json(),
          agRes.json(),
          ppRes.json(),
        ]);

        if (txJson.success) setTxData(txJson.data);
        if (polJson.success) setPolicyData(polJson.data);
        if (appJson.success) setApprovals(appJson.data.approvals || []);
        if (agJson.success) setAgents(agJson.data.agents || []);
        if (ppJson.success) setPaypalConfig(ppJson.data);
      } catch {
        // Handled by empty state
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <Skeleton key={n} className="h-28 w-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-80 lg:col-span-2" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  const summary = txData?.summary || {
    totalProtectedSpendingMajor: 0,
    totalTransactions: 0,
    autoApprovedCount: 0,
    pendingApprovalsCount: 0,
    blockedCount: 0,
    riskAlertsCount: 0,
    currency: "INR",
  };

  const currency: CurrencyCode =
    policyData?.policy?.currency || summary.currency || "INR";
  const transactions: any[] = txData?.transactions || [];
  const policy = policyData?.policy;
  const spending = policyData?.spending;

  const dailyPct =
    policy && policy.dailyLimitMajor > 0
      ? Math.min(
          100,
          Math.round((spending.dailySpentMajor / policy.dailyLimitMajor) * 100)
        )
      : 0;

  // Build chart data from actual MongoDB transactions
  const chartData = transactions
    .slice(0, 8)
    .reverse()
    .map((t) => ({
      name: t.product.name.slice(0, 14) + "...",
      amount: t.amountMajor,
      decision: t.firewallDecision,
    }));

  const highRiskTransactions = transactions.filter(
    (t) =>
      t.riskLevel === "HIGH" ||
      t.riskLevel === "CRITICAL" ||
      t.firewallDecision === "BLOCKED"
  );

  return (
    <div className="space-y-8">
      {/* Top Action Banner */}
      <div className="ag-hero-banner flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-blue-500/25 bg-gradient-to-r from-blue-950/40 via-[#0a1122] to-violet-950/30 p-5 shadow-sm">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="violet">
              <Shield className="h-3 w-3" />
              Policy v{policy?.policyVersion || 1} ({policy?.preset || "BALANCED"})
            </Badge>
            <span className="text-xs font-medium text-slate-400">
              AI Agents Propose • AgentGuard Authorizes
            </span>
          </div>
          <h2 className="mt-1.5 text-lg font-bold text-white">
            Financial Security Command Center
          </h2>
          <p className="text-xs text-slate-400">
            All metrics below are computed live from your MongoDB transaction
            ledger.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link href="/shopping-agent">
            <Button variant="violet" size="sm">
              <Sparkles className="h-4 w-4" />
              Launch AI Shopping Agent
            </Button>
          </Link>
          <Link href="/policies">
            <Button variant="outline" size="sm">
              <Sliders className="h-4 w-4" />
              Edit Firewall Policy
            </Button>
          </Link>
        </div>
      </div>

      {/* 6 Mandatory Summary Statistics */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="rounded-xl border border-slate-800/90 bg-[#0a101d] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Protected Spending</span>
            <Shield className="h-4 w-4 text-blue-400" />
          </div>
          <p className="mt-2 text-xl font-bold font-mono text-white">
            {formatCurrency(summary.totalProtectedSpendingMajor, currency)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Verified & captured
          </p>
        </div>

        <div className="rounded-xl border border-slate-800/90 bg-[#0a101d] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Total Proposals</span>
            <Activity className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-2 text-xl font-bold font-mono text-white">
            {summary.totalTransactions}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Evaluated by firewall
          </p>
        </div>

        <div className="rounded-xl border border-slate-800/90 bg-[#0a101d] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Auto-Approved</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-2 text-xl font-bold font-mono text-emerald-400">
            {summary.autoApprovedCount}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Within safe threshold
          </p>
        </div>

        <div className="rounded-xl border border-slate-800/90 bg-[#0a101d] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Pending Approvals</span>
            <Clock className="h-4 w-4 text-amber-400" />
          </div>
          <p className="mt-2 text-xl font-bold font-mono text-amber-400">
            {summary.pendingApprovalsCount}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Awaiting your sign-off
          </p>
        </div>

        <div className="rounded-xl border border-slate-800/90 bg-[#0a101d] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Blocked by Policy</span>
            <XOctagon className="h-4 w-4 text-rose-400" />
          </div>
          <p className="mt-2 text-xl font-bold font-mono text-rose-400">
            {summary.blockedCount}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Hard limit violations
          </p>
        </div>

        <div className="rounded-xl border border-slate-800/90 bg-[#0a101d] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Risk Alerts</span>
            <AlertTriangle className="h-4 w-4 text-orange-400" />
          </div>
          <p className="mt-2 text-xl font-bold font-mono text-orange-400">
            {summary.riskAlertsCount}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Elevated risk scores
          </p>
        </div>
      </section>

      {/* Section 1 & Section 5: Spending Overview Chart + Financial Policy Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl border border-slate-800/90 bg-[#0a101d] p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white">
                  Spending Overview & Proposal Amounts
                </h3>
                <p className="text-xs text-slate-400">
                  Recent AI agent purchase proposals evaluated by AgentGuard ({currency})
                </p>
              </div>
              <Link
                href="/transactions"
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                All Transactions
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {chartData.length === 0 ? (
              <div className="ag-subtle-box flex flex-col items-center justify-center h-64 rounded-xl border border-dashed border-slate-800 bg-[#060a12] p-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 border border-blue-500/20 mb-3">
                  <Bot className="h-6 w-6 text-blue-400" />
                </div>
                <p className="text-sm font-semibold text-white">
                  No purchase proposals evaluated yet
                </p>
                <p className="mt-1 text-xs text-slate-400 max-w-md leading-relaxed">
                  Ask the AI Shopping Agent to find a product (for example,
                  &ldquo;Find me a laptop under ₹80,000&rdquo;) to watch the
                  AgentGuard Firewall evaluate and chart proposals in real time.
                </p>
                <Link href="/shopping-agent" className="mt-4">
                  <Button variant="violet" size="sm">
                    Ask AI Shopping Agent
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="name"
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        borderColor: "var(--border)",
                        color: "var(--foreground)",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Bar
                      dataKey="amount"
                      fill="var(--primary)"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Section 5 & Section 7: Financial Policy Status + PayPal Connection Status */}
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-800/90 bg-[#0a101d] p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sliders className="h-4 w-4 text-blue-400" />
                Active Financial Policy
              </h3>
              <Badge variant="default">
                {policy?.preset || "BALANCED"} • v{policy?.policyVersion || 1}
              </Badge>
            </div>

            {policy && (
              <div className="space-y-3 text-xs">
                <div>
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>Daily Spending Used</span>
                    <span className="font-mono">
                      {formatCurrency(spending?.dailySpentMajor || 0, currency)}{" "}
                      / {formatCurrency(policy.dailyLimitMajor, currency)}
                    </span>
                  </div>
                  <Progress value={dailyPct} />
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-800/80">
                  <div className="rounded-lg bg-[#060a12] p-2.5 border border-slate-800/70">
                    <span className="text-[11px] text-slate-400 block">
                      Max Single Tx
                    </span>
                    <span className="font-mono font-semibold text-white text-sm">
                      {formatCurrency(policy.maxTransactionAmountMajor, currency)}
                    </span>
                  </div>
                  <div className="rounded-lg bg-[#060a12] p-2.5 border border-slate-800/70">
                    <span className="text-[11px] text-slate-400 block">
                      Auto-Approve Under
                    </span>
                    <span className="font-mono font-semibold text-emerald-400 text-sm">
                      {policy.autoApprovalEnabled
                        ? formatCurrency(
                            policy.autoApprovalThresholdMajor,
                            currency
                          )
                        : "Disabled"}
                    </span>
                  </div>
                </div>

                <Link href="/policies" className="block pt-1">
                  <Button variant="outline" size="sm" className="w-full">
                    Configure Limits & Merchants
                  </Button>
                </Link>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-800/90 bg-[#0a101d] p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-violet-400" />
                PayPal Sandbox Status
              </h3>
              <Badge
                variant={paypalConfig?.configured ? "success" : "warning"}
              >
                {paypalConfig?.configured
                  ? "API Credentials Ready"
                  : "Credentials Needed"}
              </Badge>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {paypalConfig?.configured
                ? "PayPal Sandbox Orders v2 API & Agent Toolkit guard are active. Approved purchases can proceed to PayPal Checkout."
                : "Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env.local to enable live PayPal Sandbox Order creation and capture."}
            </p>
            <Link href="/paypal" className="mt-3 block">
              <Button variant="outline" size="sm" className="w-full">
                View PayPal & Agent Toolkit Config
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Section 3, Section 4 & Section 6: Pending Approvals, AI Agents & Risk Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending Approvals */}
        <div className="rounded-xl border border-slate-800/90 bg-[#0a101d] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-400" />
              Pending Approval Requests
            </h3>
            <Link
              href="/approvals"
              className="text-xs text-blue-400 hover:underline"
            >
              Open Queue ({approvals.length})
            </Link>
          </div>

          {approvals.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-800 rounded-lg">
              No pending manual approval requests right now.
            </p>
          ) : (
            <div className="space-y-3">
              {approvals.slice(0, 3).map((a) => (
                <div
                  key={a.id}
                  className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs"
                >
                  <div className="flex items-center justify-between font-semibold text-white">
                    <span className="truncate">
                      {a.transaction?.productName || "Purchase Proposal"}
                    </span>
                    <span className="font-mono text-amber-300">
                      {formatCurrency(a.amountMajor, a.currency)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Merchant: {a.merchant} • Risk Score:{" "}
                    {a.transaction?.riskScore ?? 0}/100
                  </p>
                  <Link href="/approvals" className="mt-2 inline-block">
                    <span className="text-[11px] font-medium text-blue-400 hover:underline">
                      Review & Authorize →
                    </span>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Agent Activity */}
        <div className="rounded-xl border border-slate-800/90 bg-[#0a101d] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Bot className="h-4 w-4 text-blue-400" />
              My AI Agents
            </h3>
            <Link
              href="/agents"
              className="text-xs text-blue-400 hover:underline"
            >
              Manage ({agents.length})
            </Link>
          </div>

          <div className="space-y-3">
            {agents.slice(0, 3).map((ag) => (
              <div
                key={ag.id}
                className="rounded-lg border border-slate-800 bg-[#060a12] p-3 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">{ag.name}</span>
                  <Badge
                    variant={ag.status === "ACTIVE" ? "success" : "outline"}
                  >
                    {ag.status}
                  </Badge>
                </div>
                <div className="mt-2 flex items-center gap-4 text-[11px] text-slate-400">
                  <span>Proposals: {ag.totalProposals}</span>
                  <span className="text-emerald-400">
                    Auto: {ag.approvedProposals}
                  </span>
                  <span className="text-rose-400">
                    Blocked: {ag.blockedProposals}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Alerts */}
        <div className="rounded-xl border border-slate-800/90 bg-[#0a101d] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-400" />
              Firewall & Risk Alerts
            </h3>
            <Link
              href="/risk"
              className="text-xs text-blue-400 hover:underline"
            >
              Risk Intelligence →
            </Link>
          </div>

          {highRiskTransactions.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-800 rounded-lg">
              No blocked or high-risk transactions recorded yet.
            </p>
          ) : (
            <div className="space-y-3">
              {highRiskTransactions.slice(0, 3).map((t) => (
                <div
                  key={t.id}
                  className="rounded-lg border border-rose-500/25 bg-rose-500/5 p-3 text-xs"
                >
                  <div className="flex items-center justify-between font-semibold text-white">
                    <span className="truncate">{t.product.name}</span>
                    <Badge variant="danger">{t.firewallDecision}</Badge>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-1 line-clamp-2">
                    {t.policyReasons?.[0] || t.riskReasons?.[0]}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Section 2: Recent Transactions Table */}
      <div className="rounded-xl border border-slate-800/90 bg-[#0a101d] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-white">
              Recent Transactions & Firewall Verdicts
            </h3>
            <p className="text-xs text-slate-400">
              Real-time ledger of proposals, firewall decisions, and PayPal
              states
            </p>
          </div>
          <Link href="/transactions">
            <Button variant="outline" size="sm">
              View Full Ledger
            </Button>
          </Link>
        </div>

        {transactions.length === 0 ? (
          <p className="text-xs text-slate-500 py-8 text-center">
            No transactions recorded yet. Use the AI Shopping Agent to submit
            your first purchase proposal.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="pb-3 font-medium">Product</th>
                  <th className="pb-3 font-medium">Merchant</th>
                  <th className="pb-3 font-medium">Amount</th>
                  <th className="pb-3 font-medium">Firewall Decision</th>
                  <th className="pb-3 font-medium">Risk Score</th>
                  <th className="pb-3 font-medium">Payment Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {transactions.slice(0, 6).map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-900/40">
                    <td className="py-3 pr-4 font-medium text-white">
                      {tx.product.name}
                    </td>
                    <td className="py-3 pr-4 text-slate-300">
                      {tx.merchant.name}
                    </td>
                    <td className="py-3 pr-4 font-mono font-semibold text-white">
                      {formatCurrency(tx.amountMajor, tx.currency)}
                    </td>
                    <td className="py-3 pr-4">
                      <Badge
                        variant={
                          tx.firewallDecision === "AUTO_APPROVED"
                            ? "success"
                            : tx.firewallDecision === "REQUIRES_APPROVAL"
                            ? "warning"
                            : "danger"
                        }
                      >
                        {tx.firewallDecision}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 font-mono">
                      <span
                        className={
                          tx.riskScore >= 50
                            ? "text-rose-400 font-bold"
                            : tx.riskScore >= 25
                            ? "text-amber-400"
                            : "text-emerald-400"
                        }
                      >
                        {tx.riskScore}/100 ({tx.riskLevel})
                      </span>
                    </td>
                    <td className="py-3">
                      <Badge variant="outline">{tx.paymentStatus}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

