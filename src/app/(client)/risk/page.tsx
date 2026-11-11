"use client";

import React, { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import {
  AlertTriangle,
  Shield,
  XOctagon,
  Copy,
  Store,
  Activity,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/controls";
import { formatCurrency } from "@/lib/utils/currency";

export default function RiskIntelligencePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRisk() {
      setLoading(true);
      try {
        const res = await fetch("/api/risk/summary");
        const json = await res.json();
        if (json.success) setData(json.data);
      } finally {
        setLoading(false);
      }
    }
    loadRisk();
  }, []);

  if (loading) {
    return <Skeleton className="h-96 w-full" />;
  }

  const metrics = data?.metrics || {
    totalEvaluated: 0,
    totalBlocked: 0,
    highRiskCount: 0,
    duplicateAttempts: 0,
    untrustedMerchantAttempts: 0,
  };
  const distribution: any[] = data?.distribution || [];
  const merchants: any[] = data?.merchantRiskBreakdown || [];
  const decisions: any[] = data?.recentRiskDecisions || [];
  const events: any[] = data?.recentSecurityEvents || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white">
          AI Risk Intelligence & Threat Telemetry
        </h2>
        <p className="text-xs text-slate-400">
          Analyzes unusual purchase amounts, untrusted merchants, duplicate
          attempts, velocity spikes, and prompt injection patterns. Validated
          with Zod schemas.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-800/90 bg-[#0a101d] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Blocked Transactions</span>
            <XOctagon className="h-4 w-4 text-rose-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono text-rose-400">
            {metrics.totalBlocked}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Stopped by firewall before checkout
          </p>
        </div>

        <div className="rounded-xl border border-slate-800/90 bg-[#0a101d] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>High / Critical Risk</span>
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono text-amber-400">
            {metrics.highRiskCount}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Risk score ≥ 50/100
          </p>
        </div>

        <div className="rounded-xl border border-slate-800/90 bg-[#0a101d] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Duplicate Purchase Attempts</span>
            <Copy className="h-4 w-4 text-blue-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono text-blue-400">
            {metrics.duplicateAttempts}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Detected within protection window
          </p>
        </div>

        <div className="rounded-xl border border-slate-800/90 bg-[#0a101d] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Untrusted Merchant Activity</span>
            <Store className="h-4 w-4 text-violet-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono text-violet-400">
            {metrics.untrustedMerchantAttempts}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Outside trusted allowlist
          </p>
        </div>
      </div>

      {/* Risk Distribution Chart & Merchant Risk Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-800/90 bg-[#0a101d] p-5">
          <h3 className="text-sm font-bold text-white mb-1">
            Risk Score Distribution (0–100)
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Distribution of evaluated proposals across Low, Medium, High, and
            Critical risk tiers
          </p>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="bucket"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  allowDecimals={false}
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
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {distribution.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800/90 bg-[#0a101d] p-5">
          <h3 className="text-sm font-bold text-white mb-1">
            Merchant Risk Monitoring
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Average risk scores and block rates by merchant
          </p>

          {merchants.length === 0 ? (
            <p className="text-xs text-slate-500 py-12 text-center">
              No merchant activity recorded yet.
            </p>
          ) : (
            <div className="space-y-3">
              {merchants.map((m) => (
                <div
                  key={m.merchant}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#060a12] p-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{m.merchant}</span>
                      <Badge variant={m.isTrusted ? "success" : "warning"}>
                        {m.isTrusted ? "Trusted" : "Untrusted"}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Proposals: {m.totalCount} • Blocked: {m.blockedCount}
                    </p>
                  </div>
                  <div className="text-right font-mono">
                    <span className="text-[10px] text-slate-500 block">
                      Avg Risk
                    </span>
                    <span
                      className={`font-bold ${
                        m.avgRiskScore >= 50
                          ? "text-rose-400"
                          : m.avgRiskScore >= 25
                          ? "text-amber-400"
                          : "text-emerald-400"
                      }`}
                    >
                      {m.avgRiskScore}/100
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detailed Risk Decisions & Reasons Inspector */}
      <div className="rounded-xl border border-slate-800/90 bg-[#0a101d] p-5">
        <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
          <Shield className="h-4 w-4 text-blue-400" />
          Risk Decision Inspector (Reasons Behind Every Verdict)
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Inspect the exact AI risk signals and deterministic policy reasons for
          every transaction
        </p>

        {decisions.length === 0 ? (
          <p className="text-xs text-slate-500 py-8 text-center">
            No risk decisions recorded yet.
          </p>
        ) : (
          <div className="space-y-3">
            {decisions.map((d) => (
              <div
                key={d.id}
                className="rounded-xl border border-slate-800 bg-[#060a12] p-4 text-xs space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold text-white text-sm">
                    {d.productName} ({d.merchantName}) —{" "}
                    <span className="font-mono text-blue-400">
                      {formatCurrency(d.amountMajor, d.currency)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        d.riskScore >= 50
                          ? "danger"
                          : d.riskScore >= 25
                          ? "warning"
                          : "success"
                      }
                    >
                      Risk Score: {d.riskScore}/100 ({d.riskLevel})
                    </Badge>
                    <Badge
                      variant={
                        d.firewallDecision === "AUTO_APPROVED"
                          ? "success"
                          : d.firewallDecision === "REQUIRES_APPROVAL"
                          ? "warning"
                          : "danger"
                      }
                    >
                      {d.firewallDecision}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-slate-400 font-semibold block mb-1">
                      AI Risk Reasons:
                    </span>
                    <ul className="list-disc pl-5 text-slate-300 space-y-0.5">
                      {d.riskReasons?.map((r: string, i: number) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block mb-1">
                      Deterministic Policy Reasons:
                    </span>
                    <ul className="list-disc pl-5 text-slate-300 space-y-0.5">
                      {d.policyReasons?.map((r: string, i: number) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Security Audit Events */}
      <div className="rounded-xl border border-slate-800/90 bg-[#0a101d] p-5">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-violet-400" />
          Recent Security Audit Events
        </h3>
        <div className="space-y-2">
          {events.map((ev) => (
            <div
              key={ev.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800/80 bg-[#060a12] px-3.5 py-2.5 text-xs"
            >
              <div className="flex items-center gap-2.5">
                <Badge variant="outline" className="font-mono text-[10px]">
                  {ev.actorRole}
                </Badge>
                <span className="font-mono font-semibold text-white">
                  {ev.action}
                </span>
                <span className="text-slate-400">({ev.entityType})</span>
              </div>
              <span className="text-[11px] text-slate-500">
                {new Date(ev.createdAt).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

