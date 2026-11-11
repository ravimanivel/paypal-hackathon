"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Bot,
  Shield,
  CheckCircle2,
  AlertTriangle,
  XOctagon,
  Loader2,
  Sparkles,
  Store,
  Star,
  Lock,
  Info,
  CreditCard,
  XCircle,
  Plus,
  Search,
  PanelLeftClose,
  PanelLeft,
  MessageSquare,
  LogOut,
  Bell,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  SquarePen,
  Sliders,
  Trash2,
  ClipboardCheck,
  CopyCheck,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  PayPalCheckoutModal,
  PayPalModalOrderTarget,
  PayPalSmartButtons,
} from "@/components/paypal/paypal-checkout-modal";
import { formatCurrency } from "@/lib/utils/currency";
import { CurrencyCode, ProductProposalItem } from "@/types";

const DEMO_PROMPTS = [
  {
    id: "demo-1",
    compactLabel: "Demo 1: Laptop ₹80k (Approval)",
    shortLabel: "Demo 1: Laptop under ₹80,000 (Manual Approval)",
    label: "Demo 1: Laptop under ₹80,000 (Manual Approval)",
    prompt: "Find me a laptop under ₹80,000 with 16GB RAM",
    badge: "REQUIRES_APPROVAL",
    badgeVariant: "warning" as const,
  },
  {
    id: "demo-2",
    compactLabel: "Demo 2: Headphones ₹10k (Auto)",
    shortLabel: "Demo 2: Headphones under ₹10,000 (Auto-Approved)",
    label: "Demo 2: Headphones under ₹10,000 (Auto-Approved)",
    prompt: "Find me wireless noise-cancelling headphones under ₹10,000",
    badge: "AUTO_APPROVED",
    badgeVariant: "success" as const,
  },
  {
    id: "demo-3",
    compactLabel: "Demo 3: Workstation ₹1.35L (Blocked)",
    shortLabel: "Demo 3: Workstation ₹1,35,000 (Blocked — Exceeds Limit)",
    label: "Demo 3: Workstation ₹1,35,000 (Blocked — Exceeds Limit)",
    prompt: "Find me an RTX 4080 workstation laptop for ₹1,35,000",
    badge: "BLOCKED (LIMIT)",
    badgeVariant: "danger" as const,
  },
  {
    id: "demo-4",
    compactLabel: "Demo 4: DarkMarket (Blocked Merchant)",
    shortLabel: "Demo 4: Blocked Merchant ('DarkMarket Electronics')",
    label: "Demo 4: Blocked Merchant ('DarkMarket Electronics')",
    prompt: "Find graphics card hardware from DarkMarket Electronics",
    badge: "BLOCKED (MERCHANT)",
    badgeVariant: "danger" as const,
  },
];

interface ConversationSummary {
  id: string;
  title: string;
  messageCount: number;
  updatedAt: string;
}

function cleanMessageText(content: string): string {
  if (!content) return "";
  return content.replace(/\*\*(.*?)\*\*/g, "$1");
}

function isDuplicateRuleOnly(violatedRules?: string[]): boolean {
  if (!Array.isArray(violatedRules) || violatedRules.length === 0) return false;
  return (
    violatedRules.includes("DUPLICATE_TRANSACTION_DETECTED") &&
    violatedRules.every(
      (r) =>
        r === "DUPLICATE_TRANSACTION_DETECTED" ||
        r === "CRITICAL_SECURITY_RISK_BLOCK"
    )
  );
}

export default function ShoppingAgentPage() {
  const router = useRouter();
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeView, setActiveView] = useState<"CHAT" | "EVALUATED">("CHAT");
  const [evalFilter, setEvalFilter] = useState<string>("ALL");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const [user, setUser] = useState<any>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [messages, setMessages] = useState<any[]>([]);
  const [policy, setPolicy] = useState<any>(null);

  // Evaluated Products state (loaded from /api/transactions)
  const [evaluatedProducts, setEvaluatedProducts] = useState<any[]>([]);
  const [evalSummary, setEvalSummary] = useState<any>({
    totalTransactions: 0,
    autoApprovedCount: 0,
    pendingApprovalsCount: 0,
    blockedCount: 0,
    completedCount: 0,
  });
  const [activeTxActionId, setActiveTxActionId] = useState<string | null>(null);

  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);
  const [evaluatingId, setEvaluatingId] = useState<string | null>(null);
  const [decidingApproval, setDecidingApproval] = useState(false);
  const [processingPayPal, setProcessingPayPal] = useState(false);
  const [latestEvaluation, setLatestEvaluation] = useState<any | null>(null);
  const [evaluationsByConv, setEvaluationsByConv] = useState<
    Record<string, any>
  >({});
  const [paypalModalTarget, setPaypalModalTarget] =
    useState<PayPalModalOrderTarget | null>(null);

  const scrollToBottom = (smooth = true) => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({
        behavior: smooth ? "smooth" : "auto",
        block: "end",
      });
    }
  };

  async function refreshEvaluatedProducts() {
    try {
      const res = await fetch("/api/transactions");
      const data = await res.json();
      if (data?.success && data.data) {
        setEvaluatedProducts(data.data.transactions || []);
        if (data.data.summary) {
          setEvalSummary(data.data.summary);
        }
      }
    } catch {
      // Ignore refresh error
    }
  }

  useEffect(() => {
    let cancelled = false;
    const noStore: RequestInit = { cache: "no-store" };

    // Each loader is independent so one failing API never blocks the others.
    async function loadSession() {
      try {
        const res = await fetch("/api/auth/session", noStore);
        const data = await res.json();
        if (!cancelled && data?.data?.authenticated && data.data.user) {
          setUser(data.data.user);
        }
      } catch {
        // Ignore
      }
    }

    async function loadNotifications() {
      try {
        const res = await fetch("/api/notifications", noStore);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setUnreadCount(data?.data?.unreadCount || 0);
      } catch {
        // Ignore
      }
    }

    async function loadPolicy() {
      try {
        const res = await fetch("/api/policies", noStore);
        const data = await res.json();
        if (!cancelled && data.success) setPolicy(data.data.policy);
      } catch {
        // Ignore
      }
    }

    // The signed-in user's evaluated products (scoped by session userId on the server)
    async function loadEvaluated() {
      try {
        const res = await fetch("/api/transactions", noStore);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data?.success && data.data) {
          setEvaluatedProducts(data.data.transactions || []);
          if (data.data.summary) setEvalSummary(data.data.summary);
        }
      } catch {
        // Ignore
      }
    }

    // The signed-in user's chats (Recents) and their most recent conversation
    async function loadChats() {
      try {
        const res = await fetch("/api/conversations", noStore);
        const data = await res.json();
        const convList: ConversationSummary[] =
          data?.data?.conversations || [];
        if (cancelled) return;
        setConversations(convList);

        if (convList[0]?.id) {
          const detailRes = await fetch(
            `/api/conversations/${convList[0].id}`,
            noStore
          );
          const detailData = await detailRes.json();
          if (
            !cancelled &&
            detailData.success &&
            detailData.data.conversation
          ) {
            setConversationId(detailData.data.conversation.id);
            setMessages(detailData.data.conversation.messages || []);
            setTimeout(() => scrollToBottom(false), 80);
          }
        }
      } catch {
        // Ignore
      }
    }

    async function loadInitial() {
      setInitialLoading(true);
      await Promise.all([
        loadSession(),
        loadNotifications(),
        loadPolicy(),
        loadEvaluated(),
        loadChats(),
      ]);
      if (!cancelled) setInitialLoading(false);
    }

    loadInitial();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (
      activeView === "CHAT" &&
      (messages.length > 0 || latestEvaluation)
    ) {
      setTimeout(() => scrollToBottom(true), 60);
    }
  }, [messages.length, latestEvaluation, activeView]);

  function handleChatScroll() {
    const el = chatScrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBottom(distanceFromBottom > 160);
  }

  async function refreshConversationsList() {
    try {
      const res = await fetch("/api/conversations");
      const data = await res.json();
      if (data?.data?.conversations) {
        setConversations(data.data.conversations);
      }
    } catch {
      // Ignore refresh error
    }
  }

  async function handleSelectConversation(id: string) {
    setActiveView("CHAT");
    try {
      const res = await fetch(`/api/conversations/${id}`);
      const data = await res.json();
      if (data.success && data.data.conversation) {
        const cid = data.data.conversation.id;
        setConversationId(cid);
        setMessages(data.data.conversation.messages || []);
        setLatestEvaluation(evaluationsByConv[cid] || null);
        setTimeout(() => scrollToBottom(false), 50);
      }
    } catch {
      toast.error("Could not load conversation");
    }
  }

  async function handleDeleteConversation(
    e: React.MouseEvent,
    targetId: string
  ) {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/conversations/${targetId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        const remaining = conversations.filter((c) => c.id !== targetId);
        setConversations(remaining);
        if (conversationId === targetId) {
          if (remaining[0]?.id) {
            handleSelectConversation(remaining[0].id);
          } else {
            handleNewChat();
          }
        }
        toast.success("Conversation removed from Recents");
      }
    } catch {
      toast.error("Failed to remove conversation");
    }
  }

  function handleNewChat() {
    setActiveView("CHAT");
    setConversationId(undefined);
    setMessages([]);
    setLatestEvaluation(null);
    setMessageInput("");
    setTimeout(() => inputRef.current?.focus(), 40);
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success("Signed out safely");
    router.push("/login");
    router.refresh();
  }

  async function handleSendPrompt(
    promptText?: string,
    autoEvaluateScenarioId?: string
  ) {
    const text = (promptText ?? messageInput).trim();
    if (!text || sending) return;

    setActiveView("CHAT");
    setSending(true);
    if (!promptText) setMessageInput("");

    const targetConversationId = autoEvaluateScenarioId
      ? undefined
      : conversationId;

    if (autoEvaluateScenarioId) {
      setMessages([]);
      setLatestEvaluation(null);
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          conversationId: targetConversationId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.message || "AI Shopping Agent request failed");
        return;
      }

      const newConvId = data.data.conversationId;
      setConversationId(newConvId);
      const assistantMsg = data.data.assistantMessage;
      setMessages((prev) =>
        autoEvaluateScenarioId
          ? [data.data.userMessage, assistantMsg]
          : [...prev, data.data.userMessage, assistantMsg]
      );
      await refreshConversationsList();

      if (
        autoEvaluateScenarioId &&
        Array.isArray(assistantMsg?.proposals) &&
        assistantMsg.proposals.length > 0
      ) {
        const proposals: ProductProposalItem[] = assistantMsg.proposals;
        let targetProposal = proposals[0];

        if (autoEvaluateScenarioId === "demo-1") {
          targetProposal =
            proposals.find(
              (p) => p.priceMajor > 10000 && p.priceMajor <= 80000
            ) || proposals[0];
        } else if (autoEvaluateScenarioId === "demo-2") {
          targetProposal =
            proposals.find((p) => p.priceMajor <= 10000) || proposals[0];
        } else if (autoEvaluateScenarioId === "demo-3") {
          targetProposal =
            proposals.find((p) => p.priceMajor > 80000) || proposals[0];
        } else if (autoEvaluateScenarioId === "demo-4") {
          targetProposal =
            proposals.find((p) =>
              p.merchant.toLowerCase().includes("darkmarket")
            ) || proposals[0];
        }

        await handleSubmitProposalToFirewall(targetProposal, newConvId);
      }
    } catch {
      toast.error("Failed to communicate with AI Shopping Agent");
    } finally {
      setSending(false);
    }
  }

  async function handleSubmitProposalToFirewall(
    item: ProductProposalItem,
    activeConvId?: string
  ) {
    setEvaluatingId(item.id);
    setLatestEvaluation(null);

    const cid = activeConvId || conversationId;

    try {
      const proposalId = `prop-${item.id}-${Date.now()}`;
      const res = await fetch("/api/transactions/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalId,
          product: {
            name: item.name,
            category: item.category,
            description: item.summary,
            specs: item.specs,
            isSampleData: item.isSampleData,
          },
          merchant: {
            name: item.merchant,
            domain: item.merchantDomain,
            category: item.category,
          },
          amountMajor: item.priceMajor,
          currency: item.currency,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.message || "Firewall evaluation failed");
        return;
      }

      setLatestEvaluation(data.data);
      if (cid) {
        setEvaluationsByConv((prev) => ({ ...prev, [cid]: data.data }));
      }
      await refreshEvaluatedProducts();

      const decision = data.data.firewallDecision;
      const isDup30d = Array.isArray(data.data.violatedRules)
        ? data.data.violatedRules.includes("DUPLICATE_TRANSACTION_DETECTED")
        : false;

      if (decision === "AUTO_APPROVED") {
        toast.success(
          "AUTO_APPROVED by AgentGuard Firewall! Create PayPal Order below or in Evaluated Products."
        );
      } else if (decision === "REQUIRES_APPROVAL") {
        toast.warning(
          "REQUIRES_APPROVAL: Authorize or reject this purchase directly below."
        );
      } else if (isDup30d) {
        toast.warning(
          "Duplicate Payment Within Current 30 Days detected! You can view existing evaluations or authorize a repeat PayPal order below."
        );
      } else {
        toast.error(
          `BLOCKED by AgentGuard Firewall: ${
            data.data.policyReasons?.[0] || "Policy violation"
          }`
        );
      }
    } catch {
      toast.error("Network error during firewall evaluation");
    } finally {
      setEvaluatingId(null);
    }
  }

  function updateEvaluationState(updater: (prev: any) => any) {
    setLatestEvaluation((prev: any) => {
      const next = updater(prev);
      if (conversationId && next) {
        setEvaluationsByConv((map) => ({ ...map, [conversationId]: next }));
      }
      return next;
    });
  }

  async function handleInlineApprovalDecision(
    decision: "approve" | "reject",
    overrideApprovalId?: string,
    overrideTxId?: string
  ) {
    const targetApprovalId = overrideApprovalId || latestEvaluation?.approvalId;
    if (!targetApprovalId) return;

    if (overrideTxId) setActiveTxActionId(overrideTxId);
    setDecidingApproval(true);
    try {
      const res = await fetch(
        `/api/approvals/${targetApprovalId}/${decision}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decisionNote:
              decision === "approve"
                ? "Authorized inline by customer"
                : "Rejected inline by customer",
          }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.message || `Failed to ${decision} proposal`);
        return;
      }

      if (decision === "approve") {
        toast.success(
          "Purchase authorized! You can now create & capture the PayPal Sandbox Order."
        );
        if (!overrideTxId) {
          updateEvaluationState((prev: any) =>
            prev
              ? {
                  ...prev,
                  inlineApprovalStatus: "APPROVED",
                  transaction: {
                    ...prev.transaction,
                    approvalStatus: "APPROVED",
                    paymentStatus: "APPROVED",
                  },
                }
              : prev
          );
        }
      } else {
        toast.info("Purchase proposal rejected. No funds will move.");
        if (!overrideTxId) {
          updateEvaluationState((prev: any) =>
            prev
              ? {
                  ...prev,
                  inlineApprovalStatus: "REJECTED",
                  transaction: {
                    ...prev.transaction,
                    approvalStatus: "REJECTED",
                    paymentStatus: "REJECTED",
                  },
                }
              : prev
          );
        }
      }
      await refreshEvaluatedProducts();
    } catch {
      toast.error("Network error while deciding approval");
    } finally {
      setDecidingApproval(false);
      setActiveTxActionId(null);
    }
  }

  async function handleInlineCreatePayPalOrder(overrideTx?: {
    id: string;
    amountMajor: number;
    productName?: string;
    merchantName?: string;
    currency?: CurrencyCode;
    initialMode?: "PAYPAL" | "CARD";
  }) {
    const tx = overrideTx || latestEvaluation?.transaction;
    if (!tx?.id) return;

    if (overrideTx) setActiveTxActionId(overrideTx.id);
    setProcessingPayPal(true);
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

      const createdOrderId = data.data.paypalOrderId;
      const createdApproveUrl = data.data.approveUrl;

      toast.success(
        `PayPal Sandbox Order Ready (${createdOrderId}) — Choose Payment Success or Payment Failed simulation!`
      );

      if (!overrideTx || latestEvaluation?.transaction?.id === tx.id) {
        updateEvaluationState((prev: any) =>
          prev
            ? {
                ...prev,
                firewallDecision: "AUTO_APPROVED",
                inlineApprovalStatus: "APPROVED",
                paypalOrderId: createdOrderId,
                approveUrl: createdApproveUrl,
                transaction: {
                  ...prev.transaction,
                  firewallDecision: "AUTO_APPROVED",
                  approvalStatus: "APPROVED",
                  paymentStatus: "PAYPAL_ORDER_CREATED",
                  paypalOrderId: createdOrderId,
                },
              }
            : prev
        );
      }
      await refreshEvaluatedProducts();

      // Open the realistic PayPal Checkout Modal with Payment Success & Failed simulations
      setPaypalModalTarget({
        transactionId: tx.id,
        paypalOrderId: createdOrderId,
        approveUrl: createdApproveUrl,
        productName:
          overrideTx?.productName ||
          latestEvaluation?.transaction?.product?.name ||
          "Protected Purchase",
        merchantName:
          overrideTx?.merchantName ||
          latestEvaluation?.transaction?.merchant?.name ||
          "Verified Merchant",
        amountMajor: tx.amountMajor,
        currency:
          overrideTx?.currency ||
          latestEvaluation?.transaction?.currency ||
          currency,
        payerEmail: user?.email,
        initialMode: overrideTx?.initialMode || "PAYPAL",
      });
    } catch {
      toast.error("Network error creating PayPal order");
    } finally {
      setProcessingPayPal(false);
      setActiveTxActionId(null);
    }
  }

  async function handleSimulatePayPalCapture(params: {
    transactionId: string;
    paypalOrderId: string;
    amountMajor: number;
    simulateOutcome: "SUCCESS" | "FAILED";
    failureReason?: string;
  }) {
    setActiveTxActionId(params.transactionId);
    setProcessingPayPal(true);
    try {
      const res = await fetch("/api/paypal/checkout/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: params.transactionId,
          paypalOrderId: params.paypalOrderId,
          clientReportedAmountMajor: params.amountMajor,
          simulateOutcome: params.simulateOutcome,
          failureReason: params.failureReason,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.message || "PayPal capture failed verification");
        return { ok: false };
      }

      if (params.simulateOutcome === "FAILED") {
        toast.error(
          `Simulated PayPal Payment Failed: ${
            data.data.simulatedFailureReason || "Instrument declined"
          }`
        );
        if (latestEvaluation?.transaction?.id === params.transactionId) {
          updateEvaluationState((prev: any) =>
            prev
              ? {
                  ...prev,
                  simulatedFailureReason: data.data.simulatedFailureReason,
                  transaction: {
                    ...prev.transaction,
                    paymentStatus: "FAILED",
                  },
                }
              : prev
          );
        }
        await refreshEvaluatedProducts();
        return {
          ok: true,
          paymentStatus: "FAILED",
          failureReason: data.data.simulatedFailureReason,
        };
      }

      toast.success(
        `PayPal Payment Completed! Capture ID: ${data.data.paypalCaptureId}`
      );
      if (latestEvaluation?.transaction?.id === params.transactionId) {
        updateEvaluationState((prev: any) =>
          prev
            ? {
                ...prev,
                paypalCaptureId: data.data.paypalCaptureId,
                simulatedFailureReason: undefined,
                transaction: {
                  ...prev.transaction,
                  paymentStatus: "COMPLETED",
                  paypalCaptureId: data.data.paypalCaptureId,
                },
              }
            : prev
        );
      }
      await refreshEvaluatedProducts();
      return {
        ok: true,
        paymentStatus: "COMPLETED",
        paypalCaptureId: data.data.paypalCaptureId,
      };
    } catch {
      toast.error("Network error capturing PayPal payment");
      return { ok: false };
    } finally {
      setProcessingPayPal(false);
      setActiveTxActionId(null);
    }
  }

  async function handleInlineCapturePayPalOrder(overrideTx?: {
    id: string;
    paypalOrderId: string;
    amountMajor: number;
    simulateOutcome?: "SUCCESS" | "FAILED";
    failureReason?: string;
  }) {
    const tx = overrideTx || latestEvaluation?.transaction;
    const orderId =
      overrideTx?.paypalOrderId ||
      latestEvaluation?.paypalOrderId ||
      tx?.paypalOrderId;
    if (!tx?.id || !orderId) return;

    await handleSimulatePayPalCapture({
      transactionId: tx.id,
      paypalOrderId: orderId,
      amountMajor: tx.amountMajor,
      simulateOutcome: overrideTx?.simulateOutcome || "SUCCESS",
      failureReason: overrideTx?.failureReason,
    });
  }

  const currency: CurrencyCode = policy?.currency || "INR";

  const isLatestDuplicateOnly = isDuplicateRuleOnly(
    latestEvaluation?.violatedRules
  );

  const canPayInline =
    latestEvaluation &&
    (latestEvaluation.firewallDecision === "AUTO_APPROVED" ||
      latestEvaluation.inlineApprovalStatus === "APPROVED" ||
      latestEvaluation.transaction?.approvalStatus === "APPROVED" ||
      isLatestDuplicateOnly) &&
    latestEvaluation.transaction?.paymentStatus !== "COMPLETED";

  const activeConversationTitle =
    activeView === "EVALUATED"
      ? `Evaluated Products (${evaluatedProducts.length})`
      : conversations.find((c) => c.id === conversationId)?.title ||
        "AgentGuard AI Shopping Concierge";

  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredEvaluatedProducts = evaluatedProducts.filter((tx) => {
    if (evalFilter === "ALL") return true;
    if (evalFilter === "READY_PAYPAL") {
      return (
        tx.paymentStatus === "APPROVED" ||
        tx.paymentStatus === "PAYPAL_ORDER_CREATED" ||
        isDuplicateRuleOnly(tx.violatedRules)
      );
    }
    if (evalFilter === "PENDING") {
      return tx.paymentStatus === "PENDING_APPROVAL";
    }
    if (evalFilter === "DUPLICATE_30D") {
      return Boolean(tx.isDuplicateWithin30Days);
    }
    if (evalFilter === "BLOCKED") {
      return tx.firewallDecision === "BLOCKED" && !tx.isDuplicateWithin30Days;
    }
    if (evalFilter === "COMPLETED") {
      return tx.paymentStatus === "COMPLETED";
    }
    return true;
  });

  const duplicate30dCount = evaluatedProducts.filter((tx) =>
    Boolean(tx.isDuplicateWithin30Days)
  ).length;

  const userInitials = user?.name
    ? user.name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "AG";

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#060a12] text-slate-100">
      {/* LEFT CHAT SIDEBAR (ChatGPT-Style Full-Height Sidebar, Self-Contained Scroll) */}
      <aside
        className={`${
          sidebarOpen ? "w-[272px]" : "w-0 border-r-0"
        } transition-all duration-200 shrink-0 h-full flex flex-col border-r border-slate-800/80 bg-[#080d19] overflow-hidden`}
      >
        {/* Sidebar Top Bar: Brand + Search + Collapse Icon */}
        <div className="flex h-14 shrink-0 items-center justify-between px-3.5 border-b border-slate-800/60">
          <div className="flex items-center gap-2.5 truncate">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-violet-600">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-sm tracking-tight text-white truncate">
              AgentGuard AI
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800/70 hover:text-white cursor-pointer"
              title="Search conversations"
            >
              <Search className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800/70 hover:text-white cursor-pointer"
              title="Close sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Optional Search Filter Input */}
        {searchOpen && (
          <div className="px-3 pt-2.5 shrink-0">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search recent chats..."
              className="w-full rounded-lg border border-slate-800 bg-[#060a12] px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        )}

        {/* Primary Sidebar Actions (New Chat, Evaluated Products + Status, Firewall Control Center) */}
        <div className="p-2.5 space-y-1 shrink-0 border-b border-slate-800/60">
          <button
            type="button"
            onClick={handleNewChat}
            className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
              activeView === "CHAT" && !conversationId
                ? "bg-blue-600/15 text-blue-300 border-blue-500/30 font-semibold"
                : "border-transparent text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <SquarePen className="h-4 w-4 text-blue-400" />
            <span>New chat</span>
          </button>

          {/* NEW SIDEBAR MENU ITEM: Evaluated Products & Evaluation Status + PayPal Order Creation */}
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => {
                setActiveView("EVALUATED");
                refreshEvaluatedProducts();
              }}
              className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs font-medium transition-all cursor-pointer ${
                activeView === "EVALUATED"
                  ? "bg-blue-600/15 text-blue-300 border-blue-500/30 font-semibold"
                  : "border-transparent text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <ClipboardCheck className="h-4 w-4 shrink-0 text-emerald-400" />
                <span className="truncate">Evaluated Products</span>
              </div>
              <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">
                {evaluatedProducts.length}
              </span>
            </button>

            {/* Compact Live Status Pills under Evaluated Products */}
            {evaluatedProducts.length > 0 && (
              <div
                onClick={() => {
                  setActiveView("EVALUATED");
                  refreshEvaluatedProducts();
                }}
                className="mx-1 rounded-lg border border-slate-800/80 bg-[#060a12] px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-1 text-[10px] cursor-pointer hover:border-blue-500/40 transition-colors"
              >
                <span className="text-emerald-400 font-mono">
                  Auto: {evalSummary.autoApprovedCount}
                </span>
                <span className="text-amber-400 font-mono">
                  Pending: {evalSummary.pendingApprovalsCount}
                </span>
                <span className="text-rose-400 font-mono">
                  Blocked: {evalSummary.blockedCount}
                </span>
                <span className="text-blue-400 font-mono">
                  Paid: {evalSummary.completedCount}
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800/60 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Shield className="h-4 w-4 text-emerald-400" />
              <span>Firewall Control Center</span>
            </div>
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          </button>

          <button
            type="button"
            onClick={() => router.push("/policies")}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800/60 transition-colors cursor-pointer"
          >
            <Sliders className="h-4 w-4 text-violet-400" />
            <span>Protection Policies</span>
          </button>
        </div>

        {/* Scrollable Sidebar Body: Hackathon Scenarios + Recents */}
        <div className="flex-1 overflow-y-auto px-2.5 py-2 space-y-5">
          {/* Try Hackathon Scenarios Section */}
          <div>
            <p className="px-2.5 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Try Hackathon Scenarios
            </p>
            <div className="space-y-1">
              {DEMO_PROMPTS.map((dp) => (
                <button
                  key={dp.id}
                  type="button"
                  disabled={sending || Boolean(evaluatingId)}
                  onClick={() => handleSendPrompt(dp.prompt, dp.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-slate-300 hover:bg-slate-800/60 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-400" />
                  <span className="truncate">{dp.shortLabel}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Recent Conversations Section */}
          <div>
            <div className="flex items-center justify-between px-2.5 mb-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Recents
              </p>
              {conversations.length > 0 && (
                <span className="text-[10px] font-mono text-slate-400">
                  {conversations.length}
                </span>
              )}
            </div>

            {initialLoading && conversations.length === 0 ? (
              <div className="flex items-center gap-2 px-2.5 py-2 text-xs text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading your chats...
              </div>
            ) : filteredConversations.length === 0 ? (
              <p className="px-2.5 py-2 text-xs text-slate-400">
                No recent conversations yet
              </p>
            ) : (
              <div className="space-y-1">
                {filteredConversations.map((conv) => {
                  const active =
                    activeView === "CHAT" && conv.id === conversationId;
                  return (
                    <div
                      key={conv.id}
                      onClick={() => handleSelectConversation(conv.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          handleSelectConversation(conv.id);
                        }
                      }}
                      className={`group flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition-all cursor-pointer ${
                        active
                          ? "bg-blue-600/15 text-blue-300 border-blue-500/30 font-semibold"
                          : "border-transparent text-slate-300 hover:bg-slate-800/60 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <MessageSquare
                          className={`h-3.5 w-3.5 shrink-0 ${
                            active ? "text-blue-400" : "text-slate-400"
                          }`}
                        />
                        <span className="truncate">{conv.title}</span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteConversation(e, conv.id)}
                        className="opacity-0 group-hover:opacity-100 rounded p-1 text-slate-400 hover:bg-rose-500/15 hover:text-rose-400 transition-opacity cursor-pointer shrink-0"
                        title="Delete chat"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Bottom User Profile Bar */}
        <div className="shrink-0 border-t border-slate-800/80 p-3 flex items-center justify-between gap-2 bg-[#080d19]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
              {userInitials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white">
                {user?.name || "AgentGuard User"}
              </p>
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="truncate text-[11px] text-blue-400 hover:underline block cursor-pointer"
              >
                {policy?.preset || "BALANCED"} • Update firewall
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg p-2 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* RIGHT MAIN PANE (Full-Height Column, Zero Outer Scroll) */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-[#060a12] relative">
        {/* Compact Top Header Bar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800/70 bg-[#060a12] px-4">
          <div className="flex items-center gap-2.5 min-w-0">
            {!sidebarOpen && (
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
                title="Open sidebar"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                activeView === "EVALUATED"
                  ? setActiveView("CHAT")
                  : handleNewChat()
              }
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-white hover:bg-slate-800/60 transition-colors truncate cursor-pointer"
            >
              <span className="truncate max-w-[200px] sm:max-w-[340px]">
                {activeConversationTitle}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            </button>

            {policy && (
              <div className="hidden xl:flex items-center gap-2 text-[11px] text-slate-400 pl-2">
                <span className="rounded-md border border-slate-800 bg-[#0a101d] px-2 py-0.5 font-mono">
                  Max:{" "}
                  <strong className="text-white">
                    {formatCurrency(policy.maxTransactionAmountMajor, currency)}
                  </strong>
                </span>
                <span className="rounded-md border border-slate-800 bg-[#0a101d] px-2 py-0.5 font-mono">
                  Auto:{" "}
                  <strong className="text-emerald-400">
                    {policy.autoApprovalEnabled
                      ? `≤ ${formatCurrency(
                          policy.autoApprovalThresholdMajor,
                          currency
                        )}`
                      : "Manual"}
                  </strong>
                </span>
              </div>
            )}
          </div>

          {/* Right Header Controls: Chat Mode / Evaluated Products / FIREWALL ACTIVE SETTING Toggle + Theme + Notifications */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center rounded-xl border border-slate-800 bg-[#0a101d] p-0.5">
              <button
                type="button"
                onClick={() => setActiveView("CHAT")}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                  activeView === "CHAT"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Bot className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Chat Mode</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveView("EVALUATED");
                  refreshEvaluatedProducts();
                }}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                  activeView === "EVALUATED"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <ClipboardCheck className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Evaluated</span>
                <span className="rounded-full bg-blue-500/20 px-1.5 py-0.2 text-[10px] font-mono">
                  {evaluatedProducts.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-emerald-400 hover:bg-emerald-500/15 transition-all cursor-pointer"
                title="Open Firewall Active Setting & Security Command Center"
              >
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <Shield className="h-3.5 w-3.5" />
                <span>FIREWALL ACTIVE SETTING</span>
              </button>
            </div>

            <ThemeToggle showLabel />

            <Link
              href="/notifications"
              className="relative rounded-lg border border-slate-800 bg-[#0a101d] p-2 text-slate-300 hover:bg-slate-800 hover:text-white"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </Link>
          </div>
        </header>

        {/* VIEW 1: EVALUATED PRODUCTS & PAYPAL ORDER CENTER (Scrollable Inside Main Pane) */}
        {activeView === "EVALUATED" ? (
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
            <div className="max-w-4xl mx-auto w-full space-y-5 pb-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5 text-blue-400" />
                    Evaluated Products & PayPal Sandbox Order Center
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    View all products evaluated by AgentGuard Firewall, check
                    their evaluation status (including 30-day duplicate payment
                    checks), and create or capture PayPal Sandbox Orders.
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveView("CHAT")}
                >
                  <Bot className="h-3.5 w-3.5" />
                  Back to Shopping Chat
                </Button>
              </div>

              {/* Summary Metrics Row */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="rounded-xl border border-slate-800 bg-[#0a101d] p-3.5">
                  <span className="text-[11px] text-slate-400 block">
                    Total Evaluated
                  </span>
                  <span className="text-xl font-extrabold font-mono text-white mt-0.5 block">
                    {evaluatedProducts.length}
                  </span>
                </div>
                <div className="rounded-xl border border-slate-800 bg-[#0a101d] p-3.5">
                  <span className="text-[11px] text-slate-400 block">
                    Auto-Approved
                  </span>
                  <span className="text-xl font-extrabold font-mono text-emerald-400 mt-0.5 block">
                    {evalSummary.autoApprovedCount}
                  </span>
                </div>
                <div className="rounded-xl border border-slate-800 bg-[#0a101d] p-3.5">
                  <span className="text-[11px] text-slate-400 block">
                    Pending Approval
                  </span>
                  <span className="text-xl font-extrabold font-mono text-amber-400 mt-0.5 block">
                    {evalSummary.pendingApprovalsCount}
                  </span>
                </div>
                <div className="rounded-xl border border-slate-800 bg-[#0a101d] p-3.5">
                  <span className="text-[11px] text-slate-400 block">
                    Duplicate (30d)
                  </span>
                  <span className="text-xl font-extrabold font-mono text-orange-400 mt-0.5 block">
                    {duplicate30dCount}
                  </span>
                </div>
                <div className="rounded-xl border border-slate-800 bg-[#0a101d] p-3.5">
                  <span className="text-[11px] text-slate-400 block">
                    PayPal Completed
                  </span>
                  <span className="text-xl font-extrabold font-mono text-blue-400 mt-0.5 block">
                    {evalSummary.completedCount}
                  </span>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: "ALL", label: `All Evaluated (${evaluatedProducts.length})` },
                  { id: "READY_PAYPAL", label: "Ready for PayPal Order" },
                  { id: "PENDING", label: "Pending Approval" },
                  {
                    id: "DUPLICATE_30D",
                    label: `Duplicate Within 30 Days (${duplicate30dCount})`,
                  },
                  { id: "BLOCKED", label: "Policy Blocked" },
                  { id: "COMPLETED", label: "Paid / Completed" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setEvalFilter(tab.id)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                      evalFilter === tab.id
                        ? "bg-blue-600 text-white border-blue-600"
                        : "border-slate-800 bg-[#0a101d] text-slate-300 hover:border-blue-500/40"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Evaluated Products List */}
              {filteredEvaluatedProducts.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-[#0a101d] p-10 text-center space-y-3">
                  <ClipboardCheck className="h-8 w-8 text-blue-400 mx-auto" />
                  <h3 className="text-sm font-bold text-white">
                    No evaluated products matching this filter
                  </h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Ask the AI Shopping Agent to discover products or click any
                    of the 4 Hackathon Scenarios in the sidebar to evaluate a
                    purchase proposal.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredEvaluatedProducts.map((tx) => {
                    const isDupOnly = isDuplicateRuleOnly(tx.violatedRules);
                    const canCreatePayPal =
                      (tx.firewallDecision === "AUTO_APPROVED" ||
                        tx.approvalStatus === "APPROVED" ||
                        isDupOnly) &&
                      tx.paymentStatus !== "PAYPAL_ORDER_CREATED" &&
                      tx.paymentStatus !== "COMPLETED";

                    const canCapturePayPal =
                      tx.paymentStatus === "PAYPAL_ORDER_CREATED" &&
                      Boolean(tx.paypalOrderId);

                    const isBusy = activeTxActionId === tx.id;

                    return (
                      <div
                        key={tx.id}
                        className="rounded-2xl border border-slate-800 bg-[#0a101d] p-4 sm:p-5 flex flex-col md:flex-row md:items-start justify-between gap-4"
                      >
                        <div className="space-y-2 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {tx.firewallDecision === "AUTO_APPROVED" && (
                              <Badge variant="success">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                AUTO_APPROVED
                              </Badge>
                            )}
                            {tx.firewallDecision === "REQUIRES_APPROVAL" && (
                              <Badge
                                variant={
                                  tx.approvalStatus === "APPROVED"
                                    ? "success"
                                    : tx.approvalStatus === "REJECTED"
                                    ? "danger"
                                    : "warning"
                                }
                              >
                                <AlertTriangle className="h-3.5 w-3.5" />
                                REQUIRES_APPROVAL ({tx.approvalStatus})
                              </Badge>
                            )}
                            {tx.firewallDecision === "BLOCKED" && (
                              <Badge variant="danger">
                                <XOctagon className="h-3.5 w-3.5" />
                                BLOCKED
                              </Badge>
                            )}

                            {tx.isDuplicateWithin30Days && (
                              <Badge variant="warning">
                                <CopyCheck className="h-3.5 w-3.5" />
                                DUPLICATE PAYMENT (WITHIN CURRENT 30 DAYS)
                              </Badge>
                            )}

                            <Badge variant="outline" className="font-mono">
                              Status: {tx.paymentStatus}
                            </Badge>

                            <Badge variant="outline" className="font-mono">
                              Risk: {tx.riskScore}/100 ({tx.riskLevel})
                            </Badge>
                          </div>

                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <h3 className="text-sm sm:text-base font-bold text-white">
                              {tx.product?.name}
                            </h3>
                            <span className="text-base font-extrabold font-mono text-blue-400">
                              {formatCurrency(tx.amountMajor, tx.currency)}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                            <span className="flex items-center gap-1">
                              <Store className="h-3.5 w-3.5" />
                              {tx.merchant?.name}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {new Date(tx.createdAt).toLocaleString()}
                            </span>
                          </div>

                          {Array.isArray(tx.policyReasons) &&
                            tx.policyReasons.length > 0 && (
                              <ul className="list-disc pl-5 text-xs text-slate-300 space-y-0.5 pt-1">
                                {tx.policyReasons.map(
                                  (r: string, idx: number) => (
                                    <li key={idx}>{r}</li>
                                  )
                                )}
                              </ul>
                            )}
                        </div>

                        {/* Direct Action Column for Evaluated Product */}
                        <div className="flex flex-col gap-2 shrink-0 md:w-64">
                          {/* Pending Human Approval */}
                          {tx.paymentStatus === "PENDING_APPROVAL" &&
                            tx.approvalId && (
                              <div className="rounded-xl border border-amber-500/30 bg-[#060a12] p-3 space-y-2">
                                <p className="text-xs font-semibold text-white">
                                  Awaiting Your Approval:
                                </p>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="success"
                                    size="sm"
                                    className="flex-1"
                                    disabled={isBusy}
                                    onClick={() =>
                                      handleInlineApprovalDecision(
                                        "approve",
                                        tx.approvalId,
                                        tx.id
                                      )
                                    }
                                  >
                                    {isBusy ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                    )}
                                    Approve
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    disabled={isBusy}
                                    onClick={() =>
                                      handleInlineApprovalDecision(
                                        "reject",
                                        tx.approvalId,
                                        tx.id
                                      )
                                    }
                                  >
                                    <XCircle className="h-3.5 w-3.5" />
                                    Reject
                                  </Button>
                                </div>
                              </div>
                            )}

                          {/* Official Real-Time PayPal Sandbox JS SDK Buttons (`window.paypal.Buttons`) */}
                          {(canCreatePayPal || canCapturePayPal) && (
                            <div className="space-y-2">
                              <PayPalSmartButtons
                                compact
                                transactionId={tx.id}
                                amountMajor={tx.amountMajor}
                                currency={tx.currency}
                                loading={isBusy}
                                orderId={tx.paypalOrderId}
                                onOrderCreated={({ paypalOrderId, approveUrl }) => {
                                  if (
                                    latestEvaluation &&
                                    latestEvaluation.transaction?.id === tx.id
                                  ) {
                                    setLatestEvaluation((prev: any) =>
                                      prev
                                        ? {
                                            ...prev,
                                            paypalOrderId,
                                            approveUrl,
                                            transaction: {
                                              ...prev.transaction,
                                              paymentStatus:
                                                "PAYPAL_ORDER_CREATED",
                                            },
                                          }
                                        : prev
                                    );
                                  }
                                  refreshEvaluatedProducts();
                                }}
                                onPaymentCaptured={({
                                  paypalOrderId,
                                  paypalCaptureId,
                                  paymentStatus,
                                }) => {
                                  if (
                                    latestEvaluation &&
                                    latestEvaluation.transaction?.id === tx.id
                                  ) {
                                    setLatestEvaluation((prev: any) =>
                                      prev
                                        ? {
                                            ...prev,
                                            paypalOrderId,
                                            paypalCaptureId,
                                            transaction: {
                                              ...prev.transaction,
                                              paymentStatus:
                                                paymentStatus || "COMPLETED",
                                            },
                                          }
                                        : prev
                                    );
                                  }
                                  refreshEvaluatedProducts();
                                }}
                                onOrderCancelled={() => {
                                  refreshEvaluatedProducts();
                                }}
                                onSelectPayPal={() => {
                                  if (canCapturePayPal) {
                                    setPaypalModalTarget({
                                      transactionId: tx.id,
                                      paypalOrderId: tx.paypalOrderId,
                                      productName: tx.product?.name,
                                      merchantName: tx.merchant?.name,
                                      amountMajor: tx.amountMajor,
                                      currency: tx.currency,
                                      payerEmail: user?.email,
                                      initialMode: "PAYPAL",
                                    });
                                  } else {
                                    handleInlineCreatePayPalOrder({
                                      id: tx.id,
                                      amountMajor: tx.amountMajor,
                                      productName: tx.product?.name,
                                      merchantName: tx.merchant?.name,
                                      currency: tx.currency,
                                      initialMode: "PAYPAL",
                                    });
                                  }
                                }}
                                onSelectCard={() => {
                                  if (canCapturePayPal) {
                                    setPaypalModalTarget({
                                      transactionId: tx.id,
                                      paypalOrderId: tx.paypalOrderId,
                                      productName: tx.product?.name,
                                      merchantName: tx.merchant?.name,
                                      amountMajor: tx.amountMajor,
                                      currency: tx.currency,
                                      payerEmail: user?.email,
                                      initialMode: "CARD",
                                    });
                                  } else {
                                    handleInlineCreatePayPalOrder({
                                      id: tx.id,
                                      amountMajor: tx.amountMajor,
                                      productName: tx.product?.name,
                                      merchantName: tx.merchant?.name,
                                      currency: tx.currency,
                                      initialMode: "CARD",
                                    });
                                  }
                                }}
                              />

                              {canCapturePayPal && (
                                <div className="grid grid-cols-2 gap-1.5">
                                  <Button
                                    variant="success"
                                    size="sm"
                                    className="text-[11px] px-2 h-7"
                                    disabled={isBusy}
                                    onClick={() =>
                                      handleInlineCapturePayPalOrder({
                                        id: tx.id,
                                        paypalOrderId: tx.paypalOrderId,
                                        amountMajor: tx.amountMajor,
                                        simulateOutcome: "SUCCESS",
                                      })
                                    }
                                  >
                                    <CheckCircle2 className="h-3 w-3" />
                                    Sim Success
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    className="text-[11px] px-2 h-7"
                                    disabled={isBusy}
                                    onClick={() =>
                                      handleInlineCapturePayPalOrder({
                                        id: tx.id,
                                        paypalOrderId: tx.paypalOrderId,
                                        amountMajor: tx.amountMajor,
                                        simulateOutcome: "FAILED",
                                      })
                                    }
                                  >
                                    <XCircle className="h-3 w-3" />
                                    Sim Failed
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Completed Receipt */}
                          {tx.paymentStatus === "COMPLETED" && (
                            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-300 space-y-1">
                              <div className="font-bold flex items-center gap-1.5">
                                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                PayPal Payment Completed
                              </div>
                              {tx.paypalOrderId && (
                                <div className="font-mono text-[11px] truncate">
                                  Order: {tx.paypalOrderId}
                                </div>
                              )}
                              {tx.paypalCaptureId && (
                                <div className="font-mono text-[11px] truncate">
                                  Capture: {tx.paypalCaptureId}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Hard Policy Blocked (e.g., Over Limit or Blocked Merchant) */}
                          {tx.firewallDecision === "BLOCKED" && !isDupOnly && (
                            <div className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-xs text-rose-200">
                              <Lock className="h-4 w-4 text-rose-400 inline mr-1.5" />
                              Hard Policy Violation — PayPal Order Blocked
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* VIEW 2: SCROLLABLE CHAT STREAM ONLY (flex-1 overflow-y-auto) */
          <>
            <div
              ref={chatScrollRef}
              onScroll={handleChatScroll}
              className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 scroll-smooth"
            >
              <div className="max-w-3xl mx-auto w-full space-y-6 pb-6">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center pt-8 sm:pt-14 pb-6 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600/15 border border-blue-500/30 mb-4">
                      <Bot className="h-6 w-6 text-blue-400" />
                    </div>
                    <h2 className="text-lg sm:text-xl font-bold text-white">
                      What can AgentGuard help you shop for today?
                    </h2>
                    <p className="mt-1.5 text-xs sm:text-sm text-slate-400 max-w-lg">
                      AI agents can discover products and propose purchases,
                      while AgentGuard AI enforces your spending rules before
                      PayPal moves funds.
                    </p>

                    {/* Try Hackathon Scenarios Grid inside Empty Chat State */}
                    <div className="mt-7 w-full text-left">
                      <div className="flex items-center justify-between mb-2.5 px-1">
                        <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                          Try Hackathon Scenarios:
                        </span>
                        <span className="text-[11px] text-slate-400">
                          1-click discovery + live firewall evaluation
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {DEMO_PROMPTS.map((dp) => (
                          <button
                            key={dp.id}
                            type="button"
                            disabled={sending || Boolean(evaluatingId)}
                            onClick={() => handleSendPrompt(dp.prompt, dp.id)}
                            className="flex flex-col justify-between text-left rounded-2xl border border-slate-800/90 bg-[#0a101d] p-3.5 hover:border-blue-500/50 transition-all cursor-pointer disabled:opacity-50"
                          >
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <Badge
                                variant={dp.badgeVariant}
                                className="text-[10px]"
                              >
                                {dp.badge}
                              </Badge>
                            </div>
                            <span className="text-xs font-semibold text-white leading-snug">
                              {dp.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className="space-y-4">
                      {msg.role === "user" ? (
                        <div className="flex justify-end">
                          <div className="max-w-xl rounded-3xl bg-blue-600 px-5 py-3 text-xs sm:text-sm text-white leading-relaxed shadow-sm">
                            {cleanMessageText(msg.content)}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Assistant Response Card */}
                          <div className="rounded-2xl border border-slate-800/90 bg-[#0a101d] p-5 text-xs sm:text-sm text-slate-200 leading-relaxed">
                            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-800/70 text-[11px] text-slate-400">
                              <span className="font-medium flex items-center gap-1.5 text-slate-300">
                                <Bot className="h-3.5 w-3.5 text-blue-400" />
                                AgentGuard Shopping Response
                              </span>
                              <span className="font-mono text-[10px] text-emerald-400">
                                Zero-Capture Mode
                              </span>
                            </div>

                            <p className="leading-relaxed">
                              {cleanMessageText(msg.content)}
                            </p>

                            {msg.extractedIntent && (
                              <div className="mt-3 flex flex-wrap items-center gap-2 pt-2.5 border-t border-slate-800/60 text-[11px]">
                                <Badge variant="outline">
                                  Category: {msg.extractedIntent.category}
                                </Badge>
                                {msg.extractedIntent.budgetMajor && (
                                  <Badge variant="default">
                                    Extracted Budget:{" "}
                                    {formatCurrency(
                                      msg.extractedIntent.budgetMajor,
                                      currency
                                    )}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Product Proposals Grid */}
                          {Array.isArray(msg.proposals) &&
                            msg.proposals.length > 0 && (
                              <div className="space-y-2.5">
                                <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                                  <span className="flex items-center gap-1.5">
                                    <Info className="h-3.5 w-3.5 text-blue-400" />
                                    Discovered Options — Select any product to
                                    evaluate with AgentGuard Firewall:
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  {msg.proposals.map(
                                    (item: ProductProposalItem) => (
                                      <div
                                        key={item.id}
                                        className="flex flex-col justify-between rounded-2xl border border-slate-800/90 bg-[#0a101d] p-4 hover:border-slate-700 transition-all"
                                      >
                                        <div>
                                          <div className="flex items-center justify-between gap-2 mb-2">
                                            <Badge
                                              variant="outline"
                                              className="text-[10px]"
                                            >
                                              {item.category}
                                            </Badge>
                                            <span className="flex items-center gap-1 text-xs text-amber-400 font-medium">
                                              <Star className="h-3 w-3 fill-amber-400" />
                                              {item.rating}
                                            </span>
                                          </div>

                                          <h4 className="text-xs sm:text-sm font-bold text-white leading-snug">
                                            {item.name}
                                          </h4>

                                          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
                                            <Store className="h-3 w-3 text-slate-500" />
                                            <span className="truncate">
                                              {item.merchant}
                                            </span>
                                          </div>

                                          <p className="mt-2 text-base font-extrabold font-mono text-blue-400">
                                            {formatCurrency(
                                              item.priceMajor,
                                              item.currency
                                            )}
                                          </p>

                                          <p className="mt-1.5 text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                                            {item.summary}
                                          </p>

                                          <ul className="mt-2.5 space-y-0.5 border-t border-slate-800/80 pt-2 text-[11px] text-slate-300">
                                            {item.specs
                                              .slice(0, 3)
                                              .map((s, idx) => (
                                                <li
                                                  key={idx}
                                                  className="truncate"
                                                >
                                                  • {s}
                                                </li>
                                              ))}
                                          </ul>
                                        </div>

                                        <div className="mt-3 pt-2.5 border-t border-slate-800/80">
                                          <Button
                                            variant="violet"
                                            size="sm"
                                            className="w-full text-xs"
                                            disabled={evaluatingId === item.id}
                                            onClick={() =>
                                              handleSubmitProposalToFirewall(
                                                item
                                              )
                                            }
                                          >
                                            {evaluatingId === item.id ? (
                                              <>
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                Evaluating...
                                              </>
                                            ) : (
                                              <>
                                                <Shield className="h-3.5 w-3.5" />
                                                Evaluate in Firewall
                                              </>
                                            )}
                                          </Button>
                                        </div>
                                      </div>
                                    )
                                  )}
                                </div>
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                  ))
                )}

                {/* INLINE FIREWALL EVALUATION VERDICT & PAYPAL CHECKOUT CARD (Inside Chat Scroll) */}
                {latestEvaluation && (
                  <div
                    className={`rounded-2xl border p-5 shadow-xl transition-all ${
                      latestEvaluation.firewallDecision === "AUTO_APPROVED" ||
                      latestEvaluation.inlineApprovalStatus === "APPROVED"
                        ? "border-emerald-500/40 bg-[#0a101d]"
                        : latestEvaluation.firewallDecision ===
                          "REQUIRES_APPROVAL"
                        ? "border-amber-500/40 bg-[#0a101d]"
                        : "border-rose-500/40 bg-[#0a101d]"
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="space-y-2.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {latestEvaluation.firewallDecision ===
                            "AUTO_APPROVED" && (
                            <Badge variant="success">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              FIREWALL: AUTO_APPROVED
                            </Badge>
                          )}
                          {latestEvaluation.firewallDecision ===
                            "REQUIRES_APPROVAL" && (
                            <Badge
                              variant={
                                latestEvaluation.inlineApprovalStatus ===
                                "APPROVED"
                                  ? "success"
                                  : latestEvaluation.inlineApprovalStatus ===
                                    "REJECTED"
                                  ? "danger"
                                  : "warning"
                              }
                            >
                              <AlertTriangle className="h-3.5 w-3.5" />
                              FIREWALL: REQUIRES_APPROVAL
                              {latestEvaluation.inlineApprovalStatus
                                ? ` (${latestEvaluation.inlineApprovalStatus})`
                                : ""}
                            </Badge>
                          )}
                          {latestEvaluation.firewallDecision === "BLOCKED" && (
                            <Badge variant="danger">
                              <XOctagon className="h-3.5 w-3.5" />
                              FIREWALL: BLOCKED
                            </Badge>
                          )}

                          {Array.isArray(latestEvaluation.violatedRules) &&
                            latestEvaluation.violatedRules.includes(
                              "DUPLICATE_TRANSACTION_DETECTED"
                            ) && (
                              <Badge variant="warning">
                                <CopyCheck className="h-3.5 w-3.5" />
                                DUPLICATE PAYMENT (WITHIN CURRENT 30 DAYS)
                              </Badge>
                            )}

                          <Badge variant="outline" className="font-mono">
                            Risk Score:{" "}
                            {latestEvaluation.riskAssessment.riskScore}
                            /100 ({latestEvaluation.riskAssessment.riskLevel})
                          </Badge>

                          <Badge variant="outline" className="font-mono">
                            Status: {latestEvaluation.transaction.paymentStatus}
                          </Badge>
                        </div>

                        <h3 className="text-sm sm:text-base font-bold text-white">
                          {latestEvaluation.transaction.product.name} —{" "}
                          <span className="font-mono text-blue-400">
                            {formatCurrency(
                              latestEvaluation.transaction.amountMajor,
                              latestEvaluation.transaction.currency
                            )}
                          </span>{" "}
                          at {latestEvaluation.transaction.merchant.name}
                        </h3>

                        <div className="space-y-1 text-xs text-slate-300">
                          <p className="font-semibold text-white">
                            Deterministic Policy Evaluation:
                          </p>
                          <ul className="list-disc pl-5 space-y-0.5">
                            {latestEvaluation.policyReasons.map(
                              (reason: string, idx: number) => (
                                <li key={idx}>{reason}</li>
                              )
                            )}
                          </ul>
                        </div>

                        <div className="space-y-1 text-xs text-slate-400 pt-1">
                          <p className="font-semibold text-slate-300">
                            AI Risk Intelligence Signals:
                          </p>
                          <ul className="list-disc pl-5 space-y-0.5">
                            {latestEvaluation.riskAssessment.reasons.map(
                              (r: string, idx: number) => (
                                <li key={idx}>{r}</li>
                              )
                            )}
                          </ul>
                        </div>
                      </div>

                      {/* Inline Action Controls in Chat Stream */}
                      <div className="flex flex-col gap-2.5 shrink-0 md:w-64">
                        {/* Demo 1: Manual Approval / Rejection */}
                        {latestEvaluation.firewallDecision ===
                          "REQUIRES_APPROVAL" &&
                          !latestEvaluation.inlineApprovalStatus &&
                          latestEvaluation.approvalId && (
                            <div className="rounded-xl border border-amber-500/30 bg-[#060a12] p-3 space-y-2">
                              <p className="text-xs font-semibold text-white">
                                Human-in-the-Loop Authorization:
                              </p>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="success"
                                  size="sm"
                                  className="flex-1"
                                  disabled={decidingApproval}
                                  onClick={() =>
                                    handleInlineApprovalDecision("approve")
                                  }
                                >
                                  {decidingApproval ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                  )}
                                  Approve
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  disabled={decidingApproval}
                                  onClick={() =>
                                    handleInlineApprovalDecision("reject")
                                  }
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                  Reject
                                </Button>
                              </div>
                            </div>
                          )}

                        {/* Demo 2, Approved Demo 1, or Customer-Authorized 30-Day Duplicate: Official Real-Time PayPal Sandbox JS SDK Buttons */}
                        {canPayInline && (
                          <div className="space-y-2">
                            <PayPalSmartButtons
                              transactionId={latestEvaluation.transaction.id}
                              amountMajor={
                                latestEvaluation.transaction.amountMajor
                              }
                              currency={latestEvaluation.transaction.currency}
                              loading={processingPayPal}
                              orderId={latestEvaluation.paypalOrderId}
                              onOrderCreated={({ paypalOrderId, approveUrl }) => {
                                setLatestEvaluation((prev: any) =>
                                  prev
                                    ? {
                                        ...prev,
                                        paypalOrderId,
                                        approveUrl,
                                        transaction: {
                                          ...prev.transaction,
                                          paymentStatus:
                                            "PAYPAL_ORDER_CREATED",
                                        },
                                      }
                                    : prev
                                );
                                refreshEvaluatedProducts();
                              }}
                              onPaymentCaptured={({
                                paypalOrderId,
                                paypalCaptureId,
                                paymentStatus,
                              }) => {
                                setLatestEvaluation((prev: any) =>
                                  prev
                                    ? {
                                        ...prev,
                                        paypalOrderId,
                                        paypalCaptureId,
                                        transaction: {
                                          ...prev.transaction,
                                          paymentStatus:
                                            paymentStatus || "COMPLETED",
                                        },
                                      }
                                    : prev
                                );
                                refreshEvaluatedProducts();
                              }}
                              onOrderCancelled={() => {
                                refreshEvaluatedProducts();
                              }}
                              onSelectPayPal={() => {
                                if (latestEvaluation.paypalOrderId) {
                                  setPaypalModalTarget({
                                    transactionId:
                                      latestEvaluation.transaction.id,
                                    paypalOrderId:
                                      latestEvaluation.paypalOrderId,
                                    approveUrl: latestEvaluation.approveUrl,
                                    productName:
                                      latestEvaluation.transaction.product.name,
                                    merchantName:
                                      latestEvaluation.transaction.merchant
                                        .name,
                                    amountMajor:
                                      latestEvaluation.transaction.amountMajor,
                                    currency:
                                      latestEvaluation.transaction.currency,
                                    payerEmail: user?.email,
                                    initialMode: "PAYPAL",
                                  });
                                } else {
                                  handleInlineCreatePayPalOrder({
                                    id: latestEvaluation.transaction.id,
                                    amountMajor:
                                      latestEvaluation.transaction.amountMajor,
                                    productName:
                                      latestEvaluation.transaction.product.name,
                                    merchantName:
                                      latestEvaluation.transaction.merchant
                                        .name,
                                    currency:
                                      latestEvaluation.transaction.currency,
                                    initialMode: "PAYPAL",
                                  });
                                }
                              }}
                              onSelectCard={() => {
                                if (latestEvaluation.paypalOrderId) {
                                  setPaypalModalTarget({
                                    transactionId:
                                      latestEvaluation.transaction.id,
                                    paypalOrderId:
                                      latestEvaluation.paypalOrderId,
                                    approveUrl: latestEvaluation.approveUrl,
                                    productName:
                                      latestEvaluation.transaction.product.name,
                                    merchantName:
                                      latestEvaluation.transaction.merchant
                                        .name,
                                    amountMajor:
                                      latestEvaluation.transaction.amountMajor,
                                    currency:
                                      latestEvaluation.transaction.currency,
                                    payerEmail: user?.email,
                                    initialMode: "CARD",
                                  });
                                } else {
                                  handleInlineCreatePayPalOrder({
                                    id: latestEvaluation.transaction.id,
                                    amountMajor:
                                      latestEvaluation.transaction.amountMajor,
                                    productName:
                                      latestEvaluation.transaction.product.name,
                                    merchantName:
                                      latestEvaluation.transaction.merchant
                                        .name,
                                    currency:
                                      latestEvaluation.transaction.currency,
                                    initialMode: "CARD",
                                  });
                                }
                              }}
                            />

                            {latestEvaluation.paypalOrderId && (
                              <div className="grid grid-cols-2 gap-1.5">
                                <Button
                                  variant="success"
                                  size="sm"
                                  className="text-[11px] px-2 h-8"
                                  disabled={processingPayPal}
                                  onClick={() =>
                                    handleInlineCapturePayPalOrder({
                                      id: latestEvaluation.transaction.id,
                                      paypalOrderId:
                                        latestEvaluation.paypalOrderId,
                                      amountMajor:
                                        latestEvaluation.transaction
                                          .amountMajor,
                                      simulateOutcome: "SUCCESS",
                                    })
                                  }
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Sim Success
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="text-[11px] px-2 h-8"
                                  disabled={processingPayPal}
                                  onClick={() =>
                                    handleInlineCapturePayPalOrder({
                                      id: latestEvaluation.transaction.id,
                                      paypalOrderId:
                                        latestEvaluation.paypalOrderId,
                                      amountMajor:
                                        latestEvaluation.transaction
                                          .amountMajor,
                                      simulateOutcome: "FAILED",
                                    })
                                  }
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                  Sim Failed
                                </Button>
                              </div>
                            )}
                          </div>
                        )}

                        {latestEvaluation.transaction?.paymentStatus ===
                          "FAILED" && (
                          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300 space-y-1">
                            <div className="font-bold flex items-center gap-1.5">
                              <XCircle className="h-4 w-4 text-rose-400" />
                              PayPal Payment Failed (Simulated)
                            </div>
                            <div className="text-[11px] text-rose-200/90">
                              {latestEvaluation.simulatedFailureReason ||
                                "Funding instrument was declined."}
                            </div>
                          </div>
                        )}

                        {latestEvaluation.transaction?.paymentStatus ===
                          "COMPLETED" && (
                          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-300 space-y-1">
                            <div className="font-bold flex items-center gap-1.5">
                              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                              PayPal Payment Completed!
                            </div>
                            <div className="font-mono text-[11px] truncate">
                              Order: {latestEvaluation.paypalOrderId}
                            </div>
                            <div className="font-mono text-[11px] truncate">
                              Capture: {latestEvaluation.paypalCaptureId}
                            </div>
                          </div>
                        )}

                        {latestEvaluation.firewallDecision === "BLOCKED" &&
                          !isLatestDuplicateOnly && (
                            <div className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-xs text-rose-200">
                              <Lock className="h-4 w-4 text-rose-400 inline mr-1.5" />
                              Blocked by AgentGuard Firewall. PayPal order
                              creation is prevented.
                            </div>
                          )}

                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs"
                          onClick={() => {
                            setActiveView("EVALUATED");
                            refreshEvaluatedProducts();
                          }}
                        >
                          <ClipboardCheck className="h-3.5 w-3.5" />
                          View All Evaluated Products (
                          {evaluatedProducts.length})
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={chatBottomRef} />
              </div>
            </div>

            {/* Floating Scroll-to-Bottom Button */}
            {showScrollBottom && (
              <button
                type="button"
                onClick={() => scrollToBottom(true)}
                className="absolute bottom-28 left-1/2 -translate-x-1/2 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-[#0a101d] text-slate-200 shadow-lg hover:bg-slate-800 cursor-pointer"
                aria-label="Scroll to bottom"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
            )}

            {/* PINNED BOTTOM COMPOSER BAR */}
            <div className="shrink-0 w-full px-4 pb-4 pt-1 bg-[#060a12]">
              <div className="max-w-3xl mx-auto w-full space-y-2">
                {messages.length > 0 && (
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    {DEMO_PROMPTS.map((dp) => (
                      <button
                        key={dp.id}
                        type="button"
                        disabled={sending || Boolean(evaluatingId)}
                        onClick={() => handleSendPrompt(dp.prompt, dp.id)}
                        className="rounded-full border border-slate-800 bg-[#0a101d] px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:border-blue-500/50 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {dp.compactLabel}
                      </button>
                    ))}
                  </div>
                )}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendPrompt();
                  }}
                  className="flex items-center gap-2.5 rounded-3xl border border-slate-800/90 bg-[#0a101d] px-3.5 py-2 shadow-lg focus-within:border-slate-700"
                >
                  <button
                    type="button"
                    onClick={handleNewChat}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
                    title="Start New Chat"
                  >
                    <Plus className="h-4 w-4" />
                  </button>

                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Ask AgentGuard Shopping Agent..."
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    disabled={sending}
                    className="flex-1 bg-transparent text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none"
                  />

                  <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-slate-800 bg-[#060a12] px-2.5 py-1 text-[11px] font-medium text-slate-300">
                    <Shield className="h-3 w-3 text-blue-400" />
                    <span>Firewall Guard</span>
                  </div>

                  <button
                    type="submit"
                    disabled={sending || !messageInput.trim()}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 transition-all cursor-pointer"
                    aria-label="Send message"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowUp className="h-4 w-4" />
                    )}
                  </button>
                </form>
              </div>
            </div>
          </>
        )}

        {/* Realistic PayPal Sandbox Checkout Modal (Payment Success & Payment Failed Simulations) */}
        <PayPalCheckoutModal
          order={paypalModalTarget}
          onClose={() => setPaypalModalTarget(null)}
          onSimulateCapture={handleSimulatePayPalCapture}
        />
      </div>
    </div>
  );
}
