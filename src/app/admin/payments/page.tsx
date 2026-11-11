"use client";

import React, { useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/controls";
import { formatCurrency } from "@/lib/utils/currency";

export default function AdminPaymentsMonitoringPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/transactions");
        const data = await res.json();
        if (data.success) {
          setTransactions(
            (data.data.transactions || []).filter(
              (t: any) =>
                t.paypalOrderId ||
                t.paymentStatus === "COMPLETED" ||
                t.paymentStatus === "APPROVED"
            )
          );
        }
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
        <h2 className="text-lg font-bold text-white">
          PayPal Payment & Settlement Monitoring
        </h2>
        <p className="text-xs text-slate-400">
          Track PayPal Order IDs, Capture IDs, and settlement verification across
          all customer transactions.
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-[#0a101d] overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800 bg-[#070c17] text-slate-400">
              <th className="p-4">Customer</th>
              <th className="p-4">Product</th>
              <th className="p-4">Amount</th>
              <th className="p-4">PayPal Order ID</th>
              <th className="p-4">PayPal Capture ID</th>
              <th className="p-4">Settlement State</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">
                  <CreditCard className="h-6 w-6 mx-auto mb-2 text-slate-600" />
                  No PayPal orders or captures recorded yet.
                </td>
              </tr>
            ) : (
              transactions.map((t) => (
                <tr key={t.id}>
                  <td className="p-4 text-white">{t.userName}</td>
                  <td className="p-4 text-slate-300">{t.product.name}</td>
                  <td className="p-4 font-mono font-bold text-white">
                    {formatCurrency(t.amountMajor, t.currency)}
                  </td>
                  <td className="p-4 font-mono text-blue-400">
                    {t.paypalOrderId || "Awaiting Order"}
                  </td>
                  <td className="p-4 font-mono text-emerald-400">
                    {t.paypalCaptureId || "—"}
                  </td>
                  <td className="p-4">
                    <Badge
                      variant={
                        t.paymentStatus === "COMPLETED" ? "success" : "outline"
                      }
                    >
                      {t.paymentStatus}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

