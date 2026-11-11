"use client";

import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/controls";
import { formatCurrency } from "@/lib/utils/currency";

export default function AdminGlobalTransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [decision, setDecision] = useState("ALL");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/transactions?decision=${decision}`);
        const data = await res.json();
        if (data.success) setTransactions(data.data.transactions || []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [decision]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">Global Transactions</h2>
          <p className="text-xs text-slate-400">
            Platform-wide transaction proposals, firewall verdicts, and PayPal
            settlement states.
          </p>
        </div>

        <div className="flex gap-2">
          {["ALL", "AUTO_APPROVED", "REQUIRES_APPROVAL", "BLOCKED"].map((d) => (
            <Button
              key={d}
              size="sm"
              variant={decision === d ? "default" : "outline"}
              onClick={() => setDecision(d)}
            >
              {d}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-80 w-full" />
      ) : (
        <div className="rounded-xl border border-slate-800 bg-[#0a101d] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-[#070c17] text-slate-400">
                  <th className="p-4">Tx ID</th>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Product & Merchant</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Firewall Decision</th>
                  <th className="p-4">Risk Score</th>
                  <th className="p-4">Payment Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-900/40">
                    <td className="p-4 font-mono text-slate-300">
                      #{t.id.slice(-8)}
                    </td>
                    <td className="p-4">
                      <div className="font-semibold text-white">
                        {t.userName}
                      </div>
                      <div className="text-slate-500">{t.userEmail}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-semibold text-white">
                        {t.product.name}
                      </div>
                      <div className="text-slate-400">{t.merchant.name}</div>
                    </td>
                    <td className="p-4 font-mono font-bold text-white">
                      {formatCurrency(t.amountMajor, t.currency)}
                    </td>
                    <td className="p-4">
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
                    </td>
                    <td className="p-4 font-mono">
                      {t.riskScore}/100 ({t.riskLevel})
                    </td>
                    <td className="p-4">
                      <Badge variant="outline">{t.paymentStatus}</Badge>
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

