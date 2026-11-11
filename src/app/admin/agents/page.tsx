"use client";

import React, { useEffect, useState } from "react";
import { Cpu, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/controls";

export default function AdminAgentsMonitoringPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/dashboard");
        const data = await res.json();
        if (data.success) setAgents(data.data.recentAgents || []);
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
        <h2 className="text-lg font-bold text-white">AI Agent Monitoring</h2>
        <p className="text-xs text-slate-400">
          Monitor registered autonomous shopping agents, proposal volume, and
          firewall enforcement across the platform.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {agents.map((a) => (
          <div
            key={a.id}
            className="rounded-xl border border-slate-800 bg-[#0a101d] p-5 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/15 border border-violet-500/30">
                <Cpu className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">{a.name}</h3>
                <p className="text-xs text-slate-400 font-mono">
                  Owner ID: {a.userId.slice(-8)} • Proposals: {a.totalProposals}{" "}
                  • Blocked: {a.blockedProposals}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <Badge variant={a.status === "ACTIVE" ? "success" : "warning"}>
                {a.status}
              </Badge>
              <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                <Shield className="h-3 w-3" />
                Capture Restricted
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

