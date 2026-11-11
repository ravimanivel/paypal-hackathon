"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  CheckSquare,
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  ArrowRight,
  Loader2,
  Eye,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/controls";
import { formatCurrency } from "@/lib/utils/currency";

export default function PendingApprovalsPage() {
  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<any | null>(null);
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">(
    "ALL"
  );

  async function loadApprovals() {
    setLoading(true);
    try {
      const res = await fetch(`/api/approvals?status=${filter}`);
      const data = await res.json();
      if (data.success) setApprovals(data.data.approvals || []);
    } catch {
      toast.error("Failed to load approvals");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadApprovals();
  }, [filter]);

  async function handleDecision(
    approvalId: string,
    decision: "approve" | "reject"
  ) {
    setActionId(approvalId);
    try {
      const res = await fetch(`/api/approvals/${approvalId}/${decision}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decisionNote:
            decision === "approve"
              ? "Authorized by customer in Approval Center"
              : "Rejected by customer in Approval Center",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.message || `Failed to ${decision}`);
        return;
      }

      if (decision === "approve") {
        toast.success(
          "Transaction authorized! Proceed to PayPal Checkout to complete payment."
        );
      } else {
        toast.info("Transaction proposal rejected. No funds will move.");
      }

      loadApprovals();
    } catch {
      toast.error("Network error");
    } finally {
      setActionId(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((n) => (
          <Skeleton key={n} className="h-36 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">
            Human-in-the-Loop Approval Center
          </h2>
          <p className="text-xs text-slate-400">
            Approvals are single-use, time-limited (30m), and cryptographically
            bound to the exact transaction amount, currency, merchant, and
            proposal ID.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {(["ALL", "PENDING", "APPROVED", "REJECTED"] as const).map((st) => (
            <Button
              key={st}
              variant={filter === st ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(st)}
            >
              {st}
            </Button>
          ))}
        </div>
      </div>

      {/* Security Notice */}
      <div className="rounded-xl border border-slate-800 bg-[#0a101d] p-4 flex items-center gap-3 text-xs text-slate-300">
        <Lock className="h-4 w-4 text-blue-400 shrink-0" />
        <span>
          <strong>Two-Stage Protection:</strong> Approving a purchase in
          AgentGuard authorizes order creation, not automatic capture. You still
          review and approve the payment in{" "}
          <strong>PayPal Sandbox Checkout</strong> before capture occurs.
        </span>
      </div>

      {approvals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-[#0a101d] p-12 text-center">
          <CheckSquare className="h-10 w-10 text-blue-400 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-white">
            No approval requests matching filter ({filter})
          </h3>
          <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto">
            When an AI Shopping Agent proposes a purchase above your
            auto-approval threshold (e.g., a laptop under ₹80,000), it will
            appear here for your authorization.
          </p>
          <Link href="/shopping-agent" className="mt-4 inline-block">
            <Button variant="violet" size="sm">
              Test Manual Approval Scenario
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {approvals.map((app) => {
            const tx = app.transaction;
            return (
              <div
                key={app.id}
                className="rounded-xl border border-slate-800/90 bg-[#0a101d] p-5 space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          app.status === "PENDING"
                            ? "warning"
                            : app.status === "APPROVED"
                            ? "success"
                            : "danger"
                        }
                      >
                        {app.status}
                      </Badge>
                      <Badge variant="outline" className="font-mono">
                        Firewall:{" "}
                        {tx?.firewallDecision || "REQUIRES_APPROVAL"}
                      </Badge>
                      <Badge
                        variant={
                          (tx?.riskScore || 0) >= 50
                            ? "danger"
                            : (tx?.riskScore || 0) >= 25
                            ? "warning"
                            : "success"
                        }
                      >
                        Risk Score: {tx?.riskScore ?? 15}/100 (
                        {tx?.riskLevel || "LOW"})
                      </Badge>
                    </div>

                    <h3 className="text-base font-bold text-white">
                      {tx?.productName || "AI Purchase Proposal"} —{" "}
                      <span className="font-mono text-blue-400">
                        {formatCurrency(app.amountMajor, app.currency)}
                      </span>
                    </h3>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                      <span>
                        Merchant:{" "}
                        <strong className="text-slate-200">
                          {app.merchant}
                        </strong>
                      </span>
                      <span>
                        AI Agent:{" "}
                        <strong className="text-slate-200">
                          {tx?.agentName || "AgentGuard Shopping Concierge"}
                        </strong>
                      </span>
                      <span>
                        Requested: {new Date(app.createdAt).toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-amber-400" />
                        Expires: {new Date(app.expiresAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>

                  {/* Actions: Approve, Reject, View Details */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setSelectedDetail(
                          selectedDetail?.id === app.id ? null : app
                        )
                      }
                    >
                      <Eye className="h-3.5 w-3.5" />
                      {selectedDetail?.id === app.id
                        ? "Hide Details"
                        : "View Details"}
                    </Button>

                    {app.status === "PENDING" && (
                      <>
                        <Button
                          variant="success"
                          size="sm"
                          disabled={actionId === app.id}
                          onClick={() => handleDecision(app.id, "approve")}
                        >
                          {actionId === app.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                          Approve
                        </Button>

                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={actionId === app.id}
                          onClick={() => handleDecision(app.id, "reject")}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Reject
                        </Button>
                      </>
                    )}

                    {app.status === "APPROVED" &&
                      tx?.paymentStatus !== "COMPLETED" && (
                        <Link href={`/transactions?highlight=${app.transactionId}`}>
                          <Button variant="violet" size="sm">
                            Proceed to PayPal Checkout
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      )}
                  </div>
                </div>

                {/* Policy Explanation */}
                <div className="rounded-lg border border-slate-800/80 bg-[#060a12] p-3.5 text-xs space-y-1">
                  <p className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-amber-400" />
                    Why AgentGuard Requested Human Approval:
                  </p>
                  <ul className="list-disc pl-5 text-slate-400 space-y-0.5">
                    {(tx?.policyReasons || []).map((r: string, idx: number) => (
                      <li key={idx}>{r}</li>
                    ))}
                  </ul>
                </div>

                {/* Expanded Details Drawer */}
                {selectedDetail?.id === app.id && (
                  <div className="rounded-lg border border-blue-500/30 bg-blue-950/15 p-4 text-xs space-y-2">
                    <h4 className="font-bold text-white">
                      Bound Cryptographic Approval Parameters
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-slate-300">
                      <div>
                        <span className="text-slate-500 block">Proposal ID</span>
                        <span className="font-mono">{app.boundProposalId}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">
                          Bound Minor Amount
                        </span>
                        <span className="font-mono">
                          {app.amountMinor} ({app.currency})
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">
                          Bound Merchant
                        </span>
                        <span>{app.merchant}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">
                          Payment Status
                        </span>
                        <span className="font-mono">
                          {tx?.paymentStatus || "N/A"}
                        </span>
                      </div>
                    </div>
                    {tx?.riskReasons && (
                      <div className="pt-2 border-t border-slate-800/80">
                        <span className="text-slate-400 font-semibold block mb-1">
                          AI Risk Intelligence Breakdown:
                        </span>
                        <ul className="list-disc pl-5 text-slate-300">
                          {tx.riskReasons.map((rr: string, i: number) => (
                            <li key={i}>{rr}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

