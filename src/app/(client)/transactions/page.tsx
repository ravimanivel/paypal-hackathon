"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CreditCard,
  Shield,
  CheckCircle2,
  XOctagon,
  Clock,
  ExternalLink,
  Loader2,
  Lock,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/controls";
import { formatCurrency } from "@/lib/utils/currency";

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [paypalConfig, setPaypalConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [decisionFilter, setDecisionFilter] = useState("ALL");
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  async function loadTransactions() {
    setLoading(true);
    try {
      const [txRes, ppRes] = await Promise.all([
        fetch(`/api/transactions?decision=${decisionFilter}`),
        fetch("/api/paypal/config"),
      ]);
      const txData = await txRes.json();
      const ppData = await ppRes.json();
      if (txData.success) setTransactions(txData.data.transactions || []);
      if (ppData.success) setPaypalConfig(ppData.data);
    } catch {
      toast.error("Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTransactions();
  }, [decisionFilter]);

  async function handleCreatePayPalOrder(tx: any) {
    setProcessingId(tx.id);
    try {
      const res = await fetch("/api/paypal/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: tx.id,
          clientReportedAmountMajor: tx.amountMajor,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.message || "Could not create PayPal Sandbox Order");
        return;
      }

      toast.success(`PayPal Order Created (${data.data.paypalOrderId})`);
      if (data.data.approveUrl) {
        window.open(data.data.approveUrl, "_blank", "noopener,noreferrer");
      }
      loadTransactions();
    } catch {
      toast.error("Network error while creating PayPal order");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleCapturePayPalOrder(tx: any) {
    if (!tx.paypalOrderId) return;
    setProcessingId(tx.id);
    try {
      const res = await fetch("/api/paypal/checkout/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: tx.id,
          paypalOrderId: tx.paypalOrderId,
          clientReportedAmountMajor: tx.amountMajor,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.message || "PayPal capture failed verification");
        return;
      }

      toast.success(
        `Payment Captured! Capture ID: ${data.data.paypalCaptureId}`
      );
      loadTransactions();
    } catch {
      toast.error("Network error during payment capture");
    } finally {
      setProcessingId(null);
    }
  }

  if (loading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">
            Transaction Ledger & PayPal Settlement
          </h2>
          <p className="text-xs text-slate-400">
            Complete audit trail of AI purchase proposals, firewall decisions,
            PayPal Order IDs, and 9-point server payment captures.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(["ALL", "AUTO_APPROVED", "REQUIRES_APPROVAL", "BLOCKED"] as const).map(
            (dec) => (
              <Button
                key={dec}
                variant={decisionFilter === dec ? "default" : "outline"}
                size="sm"
                onClick={() => setDecisionFilter(dec)}
              >
                {dec}
              </Button>
            )
          )}
        </div>
      </div>

      {!paypalConfig?.configured && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Lock className="h-4 w-4 text-amber-400 shrink-0" />
            <span>
              <strong>PayPal Sandbox Credentials Notice:</strong> Add your{" "}
              <code className="text-white">PAYPAL_CLIENT_ID</code> and{" "}
              <code className="text-white">PAYPAL_CLIENT_SECRET</code> in{" "}
              <code className="text-white">.env.local</code> to execute live
              PayPal Sandbox Order creation & capture. AgentGuard never fakes
              simulated payment success as a real PayPal transaction.
            </span>
          </div>
        </div>
      )}

      {selectedTx && (
        <div className="rounded-2xl border border-blue-500/40 bg-[#0a101d] p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <span className="text-xs font-mono text-blue-400">
                Transaction ID: {selectedTx.id}
              </span>
              <h3 className="text-base font-bold text-white">
                {selectedTx.product.name} —{" "}
                {formatCurrency(selectedTx.amountMajor, selectedTx.currency)}
              </h3>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedTx(null)}
            >
              Close Inspector
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="rounded-lg border border-slate-800 bg-[#060a12] p-4 space-y-2">
              <p className="font-bold text-white flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-blue-400" />
                Firewall Policy Reasons ({selectedTx.firewallDecision})
              </p>
              <ul className="list-disc pl-5 text-slate-300 space-y-1">
                {selectedTx.policyReasons?.map((r: string, i: number) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
              {selectedTx.violatedRules?.length > 0 && (
                <div className="pt-2">
                  <span className="text-rose-400 font-semibold">
                    Violated Hard Rules:{" "}
                  </span>
                  <span className="font-mono text-rose-300">
                    {selectedTx.violatedRules.join(", ")}
                  </span>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-slate-800 bg-[#060a12] p-4 space-y-2">
              <p className="font-bold text-white">
                AI Risk Intelligence ({selectedTx.riskScore}/100 —{" "}
                {selectedTx.riskLevel})
              </p>
              <ul className="list-disc pl-5 text-slate-300 space-y-1">
                {selectedTx.riskReasons?.map((r: string, i: number) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
              <div className="pt-2 text-slate-400 font-mono">
                PayPal Order ID: {selectedTx.paypalOrderId || "None"} • Capture
                ID: {selectedTx.paypalCaptureId || "None"}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-800/90 bg-[#0a101d] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-[#080d19] text-slate-400">
                <th className="p-4 font-medium">Tx ID / Timestamp</th>
                <th className="p-4 font-medium">Product & Merchant</th>
                <th className="p-4 font-medium">Amount</th>
                <th className="p-4 font-medium">Agent</th>
                <th className="p-4 font-medium">Policy Decision</th>
                <th className="p-4 font-medium">Risk</th>
                <th className="p-4 font-medium">PayPal Order / Status</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    No transactions found.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => {
                  const canCreatePayPalOrder =
                    tx.paymentStatus === "APPROVED" &&
                    (tx.firewallDecision === "AUTO_APPROVED" ||
                      tx.approvalStatus === "APPROVED");

                  const canCapturePayPalOrder =
                    Boolean(tx.paypalOrderId) &&
                    (tx.paymentStatus === "PAYPAL_ORDER_CREATED" ||
                      tx.paymentStatus === "CUSTOMER_CHECKOUT_APPROVED");

                  return (
                    <tr key={tx.id} className="hover:bg-slate-900/40">
                      <td className="p-4 font-mono text-slate-400">
                        <div className="text-white font-semibold">
                          #{tx.id.slice(-8)}
                        </div>
                        <div className="text-[11px]">
                          {new Date(tx.createdAt).toLocaleString()}
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="font-semibold text-white">
                          {tx.product.name}
                        </div>
                        <div className="text-slate-400">{tx.merchant.name}</div>
                      </td>

                      <td className="p-4 font-mono font-bold text-white">
                        {formatCurrency(tx.amountMajor, tx.currency)}
                      </td>

                      <td className="p-4 text-slate-300">{tx.agentName}</td>

                      <td className="p-4">
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

                      <td className="p-4 font-mono">
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

                      <td className="p-4">
                        <Badge
                          variant={
                            tx.paymentStatus === "COMPLETED"
                              ? "success"
                              : tx.paymentStatus === "BLOCKED" ||
                                tx.paymentStatus === "REJECTED" ||
                                tx.paymentStatus === "FAILED"
                              ? "danger"
                              : "outline"
                          }
                        >
                          {tx.paymentStatus}
                        </Badge>
                        {tx.paypalOrderId && (
                          <div className="mt-1 font-mono text-[10px] text-slate-400">
                            Order: {tx.paypalOrderId}
                          </div>
                        )}
                      </td>

                      <td className="p-4 text-right space-x-2 whitespace-nowrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedTx(tx)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Inspect
                        </Button>

                        {canCreatePayPalOrder && (
                          <Button
                            variant="violet"
                            size="sm"
                            disabled={processingId === tx.id}
                            onClick={() => handleCreatePayPalOrder(tx)}
                          >
                            {processingId === tx.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <CreditCard className="h-3.5 w-3.5" />
                            )}
                            PayPal Checkout
                          </Button>
                        )}

                        {canCapturePayPalOrder && (
                          <>
                            <a
                              href={`https://www.sandbox.paypal.com/checkoutnow?token=${tx.paypalOrderId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-md border border-blue-500/40 bg-blue-500/10 px-2.5 py-1.5 text-xs font-medium text-blue-300 hover:bg-blue-500/20"
                            >
                              Approve on PayPal
                              <ExternalLink className="h-3 w-3" />
                            </a>
                            <Button
                              variant="success"
                              size="sm"
                              disabled={processingId === tx.id}
                              onClick={() => handleCapturePayPalOrder(tx)}
                            >
                              {processingId === tx.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              )}
                              Verify & Capture
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

