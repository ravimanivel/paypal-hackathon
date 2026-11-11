"use client";

import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/controls";

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [entityType, setEntityType] = useState("ALL");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/admin/audit-logs?entityType=${entityType}`
        );
        const data = await res.json();
        if (data.success) setLogs(data.data.logs || []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [entityType]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">
            Append-Only Security Audit Logs
          </h2>
          <p className="text-xs text-slate-400">
            Immutable security log of logins, failed auth attempts, policy
            updates, firewall decisions, approvals, PayPal captures, and admin
            actions. Secrets are automatically scrubbed.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            "ALL",
            "USER",
            "POLICY",
            "AGENT",
            "TRANSACTION",
            "APPROVAL",
            "PAYPAL",
          ].map((et) => (
            <Button
              key={et}
              size="sm"
              variant={entityType === et ? "default" : "outline"}
              onClick={() => setEntityType(et)}
            >
              {et}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <div className="rounded-xl border border-slate-800 bg-[#0a101d] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-[#070c17] text-slate-400">
                  <th className="p-4">Timestamp</th>
                  <th className="p-4">Actor Role</th>
                  <th className="p-4">Action</th>
                  <th className="p-4">Entity</th>
                  <th className="p-4">Sanitized Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {logs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-900/40">
                    <td className="p-4 font-mono text-slate-400 whitespace-nowrap">
                      {new Date(l.createdAt).toLocaleString()}
                    </td>
                    <td className="p-4">
                      <Badge variant="outline" className="font-mono">
                        {l.actorRole}
                      </Badge>
                    </td>
                    <td className="p-4 font-mono font-bold text-white">
                      {l.action}
                    </td>
                    <td className="p-4 text-slate-300">
                      {l.entityType}{" "}
                      {l.entityId ? `(#${String(l.entityId).slice(-6)})` : ""}
                    </td>
                    <td className="p-4 font-mono text-[11px] text-slate-400 max-w-md truncate">
                      {JSON.stringify(l.metadata || {})}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

