"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, XOctagon, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/controls";
import { formatCurrency } from "@/lib/utils/currency";

export default function AdminRiskMonitoringPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/risk");
        const json = await res.json();
        if (json.success) setData(json.data);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <Skeleton className="h-80 w-full" />;

  const blocked: any[] = data?.blockedTransactions || [];
  const alerts: any[] = data?.securityAlerts || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white">
          Global Fraud & Risk Monitoring
        </h2>
        <p className="text-xs text-slate-400">
          Inspect blocked transactions, policy violations, and platform-wide
          security alerts.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-800 bg-[#0a101d] p-4">
          <span className="text-xs text-slate-400">Total Blocked</span>
          <p className="mt-1 text-2xl font-bold font-mono text-rose-400">
            {data?.summary?.totalBlocked || 0}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0a101d] p-4">
          <span className="text-xs text-slate-400">High / Critical Risk</span>
          <p className="mt-1 text-2xl font-bold font-mono text-amber-400">
            {data?.summary?.totalHighRisk || 0}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0a101d] p-4">
          <span className="text-xs text-slate-400">Security Audit Alerts</span>
          <p className="mt-1 text-2xl font-bold font-mono text-violet-400">
            {data?.summary?.securityAlertCount || 0}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-[#0a101d] p-5 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <XOctagon className="h-4 w-4 text-rose-400" />
          Blocked Transactions & Violated Rules
        </h3>
        {blocked.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">
            No blocked transactions recorded.
          </p>
        ) : (
          <div className="space-y-3">
            {blocked.map((b) => (
              <div
                key={b.id}
                className="rounded-lg border border-rose-500/30 bg-rose-950/15 p-4 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">
                    {b.productName} ({b.merchantName}) —{" "}
                    {formatCurrency(b.amountMajor, b.currency)}
                  </span>
                  <Badge variant="danger">
                    Risk: {b.riskScore}/100 ({b.riskLevel})
                  </Badge>
                </div>
                <p className="text-slate-300">
                  {b.policyReasons?.join(" • ")}
                </p>
                {b.violatedRules?.length > 0 && (
                  <p className="font-mono text-rose-300 text-[11px]">
                    Violated Rules: {b.violatedRules.join(", ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-800 bg-[#0a101d] p-5 space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          Security & Access Control Alerts
        </h3>
        {alerts.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#060a12] px-4 py-2.5 text-xs"
          >
            <div className="flex items-center gap-2">
              <Badge variant="danger">{a.action}</Badge>
              <span className="text-slate-400">
                Actor: {a.actorRole} • Entity: {a.entityType}
              </span>
            </div>
            <span className="text-slate-500">
              {new Date(a.createdAt).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

