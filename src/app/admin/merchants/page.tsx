"use client";

import React, { useEffect, useState } from "react";
import { Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/controls";

export default function AdminMerchantsPage() {
  const [merchants, setMerchants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/risk");
        const data = await res.json();
        if (data.success) setMerchants(data.data.merchants || []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <Skeleton className="h-80 w-full" />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white">Merchant Management</h2>
        <p className="text-xs text-slate-400">
          Platform-wide merchant trust telemetry, average risk scores, and
          block metrics.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {merchants.map((m) => (
          <div
            key={m.name}
            className="rounded-xl border border-slate-800 bg-[#0a101d] p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-blue-400" />
                <span className="font-bold text-white text-sm">{m.name}</span>
              </div>
              <Badge variant={m.isTrusted ? "success" : "warning"}>
                {m.isTrusted ? "Trusted" : "Unverified"}
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-slate-800">
              <div>
                <span className="text-slate-500 block text-[10px]">
                  Proposals
                </span>
                <span className="font-mono font-bold text-white">
                  {m.totalProposals}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">
                  Blocked
                </span>
                <span className="font-mono font-bold text-rose-400">
                  {m.blockedCount}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">
                  Avg Risk
                </span>
                <span className="font-mono font-bold text-amber-400">
                  {m.avgRiskScore}/100
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

