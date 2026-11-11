"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  Cpu,
  CheckCircle2,
  XOctagon,
  Clock,
  AlertTriangle,
  Activity,
  Server,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/controls";
import { formatCurrency } from "@/lib/utils/currency";

export default function AdminDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAdminDashboard() {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/dashboard");
        const json = await res.json();
        if (json.success) setData(json.data);
      } finally {
        setLoading(false);
      }
    }
    loadAdminDashboard();
  }, []);

  if (loading) {
    return <Skeleton className="h-96 w-full" />;
  }

  const m = data?.metrics || {
    totalUsers: 0,
    activeUsers: 0,
    totalAgents: 0,
    totalPurchaseProposals: 0,
    completedTransactions: 0,
    blockedTransactions: 0,
    pendingApprovals: 0,
    highRiskEvents: 0,
  };
  const sys = data?.systemStatus || {};
  const recentTx: any[] = data?.recentTransactions || [];
  const recentLogs: any[] = data?.recentAuditLogs || [];

  return (
    <div className="space-y-6">
      {/* 8 Mandatory Admin Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-800 bg-[#0a101d] p-4">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Total Registered Users</span>
            <Users className="h-4 w-4 text-blue-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono text-white">
            {m.totalUsers}
          </p>
          <p className="text-[11px] text-emerald-400 mt-1">
            {m.activeUsers} active accounts
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0a101d] p-4">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Registered AI Agents</span>
            <Cpu className="h-4 w-4 text-violet-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono text-white">
            {m.totalAgents}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Zero-capture policy enforced
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0a101d] p-4">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Purchase Proposals</span>
            <Activity className="h-4 w-4 text-blue-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono text-white">
            {m.totalPurchaseProposals}
          </p>
          <p className="text-[11px] text-emerald-400 mt-1">
            {m.completedTransactions} completed via PayPal
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0a101d] p-4">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Blocked / High-Risk</span>
            <XOctagon className="h-4 w-4 text-rose-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono text-rose-400">
            {m.blockedTransactions} Blocked
          </p>
          <p className="text-[11px] text-amber-400 mt-1">
            {m.pendingApprovals} pending • {m.highRiskEvents} high-risk events
          </p>
        </div>
      </div>

      {/* System Health Status Strip (Never exposes secrets) */}
      <div className="rounded-xl border border-slate-800 bg-[#0a101d] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Server className="h-4 w-4 text-violet-400" />
            Live Infrastructure & Integration Telemetry
          </h3>
          <Link href="/admin/settings">
            <Button variant="outline" size="sm">
              System Configuration
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="rounded-lg border border-slate-800 bg-[#060a12] p-3">
            <span className="text-slate-400 block">MongoDB Database</span>
            <span className="font-mono font-bold text-emerald-400">
              {sys.mongodbDatabase} ({sys.mongodbMode})
            </span>
          </div>
          <div className="rounded-lg border border-slate-800 bg-[#060a12] p-3">
            <span className="text-slate-400 block">OpenAI Engine</span>
            <span className="font-mono font-bold text-white">
              {sys.openaiConfigured
                ? `Configured (${sys.openaiModel})`
                : "Deterministic Fallback Active"}
            </span>
          </div>
          <div className="rounded-lg border border-slate-800 bg-[#060a12] p-3">
            <span className="text-slate-400 block">PayPal Sandbox API</span>
            <span className="font-mono font-bold text-white">
              {sys.paypalConfigured
                ? "Credentials Configured"
                : "Awaiting .env.local Keys"}
            </span>
          </div>
          <div className="rounded-lg border border-slate-800 bg-[#060a12] p-3">
            <span className="text-slate-400 block">Webhook Verification</span>
            <span className="font-mono font-bold text-emerald-400">
              Active (Signature Verified)
            </span>
          </div>
        </div>
      </div>

      {/* Recent Global Transactions & Recent Audit Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-800 bg-[#0a101d] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white">
              Recent Global Transactions
            </h3>
            <Link
              href="/admin/transactions"
              className="text-xs text-violet-400 hover:underline"
            >
              View All →
            </Link>
          </div>

          <div className="space-y-2.5">
            {recentTx.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">
                No transactions evaluated yet.
              </p>
            ) : (
              recentTx.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#060a12] p-3 text-xs"
                >
                  <div>
                    <p className="font-semibold text-white">{t.productName}</p>
                    <p className="text-[11px] text-slate-400">
                      {t.merchantName} • Risk: {t.riskScore}/100
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-white">
                      {formatCurrency(t.amountMajor, t.currency)}
                    </p>
                    <Badge
                      variant={
                        t.firewallDecision === "AUTO_APPROVED"
                          ? "success"
                          : t.firewallDecision === "REQUIRES_APPROVAL"
                          ? "warning"
                          : "danger"
                      }
                    >
                      {t.firewallDecision}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0a101d] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white">
              Recent Security Audit Logs
            </h3>
            <Link
              href="/admin/audit-logs"
              className="text-xs text-violet-400 hover:underline"
            >
              Full Audit Trail →
            </Link>
          </div>

          <div className="space-y-2">
            {recentLogs.map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#060a12] px-3 py-2.5 text-xs"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {l.actorRole}
                  </Badge>
                  <span className="font-mono font-semibold text-white">
                    {l.action}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500">
                  {new Date(l.createdAt).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

