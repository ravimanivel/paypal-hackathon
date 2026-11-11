"use client";

import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  Shield,
  Lock,
  CreditCard,
  Building2,
  ShoppingCart,
  X,
  Loader2,
  RotateCcw,
  ExternalLink,
  SlidersHorizontal,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { CurrencyCode } from "@/types";

declare global {
  interface Window {
    paypal?: {
      Buttons: (config: {
        style?: {
          layout?: "vertical" | "horizontal";
          color?: "gold" | "blue" | "silver" | "white" | "black";
          shape?: "rect" | "pill";
          label?: "paypal" | "checkout" | "buynow" | "pay";
          height?: number;
          tagline?: boolean;
        };
        fundingSource?: string;
        createOrder: (data: any, actions: any) => Promise<string>;
        onApprove: (data: { orderID: string; payerID?: string }, actions: any) => Promise<void>;
        onCancel?: (data: Record<string, unknown>) => void;
        onError?: (err: unknown) => void;
      }) => {
        render: (container: HTMLElement | string) => Promise<void>;
        close?: () => Promise<void>;
        isEligible?: () => boolean;
      };
    };
  }
}

export interface PayPalModalOrderTarget {
  transactionId: string;
  paypalOrderId: string;
  approveUrl?: string;
  productName: string;
  merchantName: string;
  amountMajor: number;
  currency: CurrencyCode;
  payerEmail?: string;
  initialMode?: "PAYPAL" | "CARD";
}

interface CachedPayPalConfig {
  configured: boolean;
  clientId: string;
  environment: string;
}

let cachedConfigPromise: Promise<CachedPayPalConfig> | null = null;
let activeSdkScriptPromise: Promise<boolean> | null = null;
let loadedSdkKey: string | null = null;

async function fetchPayPalClientConfig(): Promise<CachedPayPalConfig> {
  if (!cachedConfigPromise) {
    cachedConfigPromise = fetch("/api/paypal/config")
      .then((r) => r.json())
      .then((res) => ({
        configured: Boolean(res?.data?.configured),
        clientId: res?.data?.clientId || "sb",
        environment: res?.data?.environment || "sandbox",
      }))
      .catch(() => ({
        configured: false,
        clientId: "sb",
        environment: "sandbox",
      }));
  }
  return cachedConfigPromise;
}

/**
 * Loads the official PayPal Real-Time Sandbox JavaScript SDK (`https://www.paypal.com/sdk/js`)
 * using the configured PAYPAL_CLIENT_ID from `/api/paypal/config`.
 */
export async function ensurePayPalSandboxSdkLoaded(
  currency: CurrencyCode = "INR"
): Promise<{ loaded: boolean; clientId: string; sdkCurrency: string }> {
  if (typeof window === "undefined") {
    return { loaded: false, clientId: "sb", sdkCurrency: "USD" };
  }

  const config = await fetchPayPalClientConfig();
  const clientId = config.clientId || "sb";
  // INR settles in USD on PayPal Sandbox REST Orders v2
  const sdkCurrency = currency === "INR" ? "USD" : currency || "USD";
  const targetKey = `${clientId}:${sdkCurrency}`;

  if (window.paypal?.Buttons && loadedSdkKey === targetKey) {
    return { loaded: true, clientId, sdkCurrency };
  }

  if (activeSdkScriptPromise && loadedSdkKey === targetKey) {
    const ok = await activeSdkScriptPromise;
    return { loaded: ok, clientId, sdkCurrency };
  }

  loadedSdkKey = targetKey;
  activeSdkScriptPromise = new Promise<boolean>((resolve) => {
    // Remove any previous PayPal SDK script with different currency/client-id
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-agentguard-paypal-sdk="true"]'
    );
    if (existingScript) {
      if (
        existingScript.dataset.sdkKey === targetKey &&
        window.paypal?.Buttons
      ) {
        resolve(true);
        return;
      }
      existingScript.remove();
      delete window.paypal;
    }

    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(
      clientId
    )}&currency=${encodeURIComponent(
      sdkCurrency
    )}&intent=capture&components=buttons&enable-funding=card`;
    script.async = true;
    script.dataset.agentguardPaypalSdk = "true";
    script.dataset.sdkKey = targetKey;
    script.setAttribute("data-sdk-integration-source", "button-factory");

    script.onload = () => {
      resolve(Boolean(window.paypal?.Buttons));
    };
    script.onerror = () => {
      resolve(false);
    };

    document.head.appendChild(script);
  });

  const loaded = await activeSdkScriptPromise;
  return { loaded, clientId, sdkCurrency };
}

export interface PayPalSmartButtonsProps {
  transactionId?: string;
  amountMajor?: number;
  currency?: CurrencyCode;
  disabled?: boolean;
  loading?: boolean;
  orderId?: string;
  compact?: boolean;
  onSelectPayPal?: () => void;
  onSelectCard?: () => void;
  onOrderCreated?: (result: {
    paypalOrderId: string;
    approveUrl?: string;
  }) => void;
  onPaymentCaptured?: (result: {
    paypalOrderId: string;
    paypalCaptureId: string;
    paymentStatus: string;
  }) => void;
  onOrderCancelled?: () => void;
}

/**
 * Official Real-Time PayPal Sandbox JS SDK Buttons (`window.paypal.Buttons`)
 * Renders the genuine live iframe from `https://www.paypal.com/sdk/js`:
 *  1. Gold "PayPal" button (opens real sandbox.paypal.com checkout popup)
 *  2. Dark "Debit or Credit Card" button (expands real inline PayPal card checkout form)
 *  3. "Powered by PayPal" footer watermark
 */
export function PayPalSmartButtons({
  transactionId,
  amountMajor,
  currency = "INR",
  disabled = false,
  loading = false,
  orderId,
  compact = false,
  onSelectPayPal,
  onSelectCard,
  onOrderCreated,
  onPaymentCaptured,
  onOrderCancelled,
}: PayPalSmartButtonsProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [sdkState, setSdkState] = useState<"LOADING" | "READY" | "FALLBACK">(
    "LOADING"
  );
  const [creatingOrCapturing, setCreatingOrCapturing] = useState(false);

  // Keep latest callbacks/values in a ref so the PayPal SDK iframe doesn't remount on parent re-renders
  const latestPropsRef = useRef({
    transactionId,
    amountMajor,
    currency,
    orderId,
    onSelectPayPal,
    onSelectCard,
    onOrderCreated,
    onPaymentCaptured,
    onOrderCancelled,
  });

  useEffect(() => {
    latestPropsRef.current = {
      transactionId,
      amountMajor,
      currency,
      orderId,
      onSelectPayPal,
      onSelectCard,
      onOrderCreated,
      onPaymentCaptured,
      onOrderCancelled,
    };
  }, [
    transactionId,
    amountMajor,
    currency,
    orderId,
    onSelectPayPal,
    onSelectCard,
    onOrderCreated,
    onPaymentCaptured,
    onOrderCancelled,
  ]);

  useEffect(() => {
    let cancelled = false;
    let buttonsInstance: {
      render: (container: HTMLElement | string) => Promise<void>;
      close?: () => Promise<void>;
    } | null = null;

    async function mountOfficialPayPalButtons() {
      if (!transactionId) {
        setSdkState("FALLBACK");
        return;
      }

      setSdkState("LOADING");
      const { loaded } = await ensurePayPalSandboxSdkLoaded(currency);
      if (cancelled) return;

      if (!loaded || !window.paypal?.Buttons || !containerRef.current) {
        setSdkState("FALLBACK");
        return;
      }

      containerRef.current.innerHTML = "";

      try {
        buttonsInstance = window.paypal.Buttons({
          style: {
            layout: "vertical",
            color: "gold",
            shape: "rect",
            label: "paypal",
            height: compact ? 38 : 42,
          },
          createOrder: async () => {
            const current = latestPropsRef.current;
            if (!current.transactionId) {
              throw new Error("Transaction ID is missing");
            }
            setCreatingOrCapturing(true);
            try {
              const res = await fetch("/api/paypal/checkout/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  transactionId: current.transactionId,
                  clientReportedAmountMajor: current.amountMajor,
                }),
              });
              const data = await res.json();
              if (!res.ok || !data.success || !data.data?.paypalOrderId) {
                const errMsg =
                  data.message || "Failed to create PayPal Sandbox Order";
                toast.error(errMsg);
                throw new Error(errMsg);
              }

              const createdOrderId: string = data.data.paypalOrderId;
              current.onOrderCreated?.({
                paypalOrderId: createdOrderId,
                approveUrl: data.data.approveUrl,
              });
              return createdOrderId;
            } finally {
              setCreatingOrCapturing(false);
            }
          },
          onApprove: async (data: { orderID: string }) => {
            const current = latestPropsRef.current;
            if (!current.transactionId) return;
            setCreatingOrCapturing(true);
            try {
              const res = await fetch("/api/paypal/checkout/capture", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  transactionId: current.transactionId,
                  paypalOrderId: data.orderID,
                  clientReportedAmountMajor: current.amountMajor,
                }),
              });
              const capData = await res.json();
              if (!res.ok || !capData.success) {
                const errMsg =
                  capData.message ||
                  "PayPal Sandbox payment capture failed verification";
                toast.error(errMsg);
                return;
              }

              toast.success(
                `PayPal Sandbox Payment Captured! Capture ID: ${capData.data.paypalCaptureId}`
              );
              current.onPaymentCaptured?.({
                paypalOrderId: capData.data.paypalOrderId || data.orderID,
                paypalCaptureId: capData.data.paypalCaptureId,
                paymentStatus: capData.data.paymentStatus || "COMPLETED",
              });
            } finally {
              setCreatingOrCapturing(false);
            }
          },
          onCancel: () => {
            toast.info(
              "PayPal Sandbox checkout closed. Your order remains ready whenever you want to complete payment."
            );
            latestPropsRef.current.onOrderCancelled?.();
          },
          onError: (err: unknown) => {
            console.error("[AgentGuard PayPal JS SDK Error]:", err);
          },
        });

        await buttonsInstance.render(containerRef.current);
        if (!cancelled) {
          setSdkState("READY");
        }
      } catch (err) {
        console.error("[AgentGuard PayPal SDK Render Fallback]:", err);
        if (!cancelled) {
          setSdkState("FALLBACK");
        }
      }
    }

    mountOfficialPayPalButtons();

    return () => {
      cancelled = true;
      if (buttonsInstance?.close) {
        buttonsInstance.close().catch(() => {});
      }
    };
  }, [transactionId, currency, compact]);

  const isBusy = loading || creatingOrCapturing;

  return (
    <div className="rounded-xl bg-white p-3 shadow-sm border border-slate-200/90 space-y-2 text-slate-900">
      {/* Header Status Row inside PayPal Card */}
      <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pb-1 border-b border-slate-100">
        <span className="inline-flex items-center gap-1 font-semibold text-[#003087]">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          PayPal Sandbox SDK
        </span>
        {orderId ? (
          <span className="font-semibold text-[#0070ba] truncate max-w-[130px]">
            ID: {orderId}
          </span>
        ) : (
          <span className="text-slate-400">Live v2 Orders</span>
        )}
      </div>

      {/* Official PayPal JavaScript SDK Buttons Container (`window.paypal.Buttons`) */}
      {sdkState !== "FALLBACK" && (
        <div className="relative min-h-[96px]">
          {sdkState === "LOADING" && (
            <div className="flex flex-col items-center justify-center py-6 gap-1.5 text-xs text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin text-[#003087]" />
              <span className="text-[11px] font-medium">
                Loading official PayPal Sandbox SDK...
              </span>
            </div>
          )}
          <div
            ref={containerRef}
            className={
              disabled || isBusy ? "pointer-events-none opacity-60" : "w-full"
            }
          />
        </div>
      )}

      {/* Fallback Buttons if offline or no transactionId passed */}
      {sdkState === "FALLBACK" && (
        <div className="space-y-2">
          <button
            type="button"
            disabled={disabled || isBusy}
            onClick={onSelectPayPal}
            className={`w-full rounded-[4px] bg-[#ffc439] hover:bg-[#f2ba36] active:bg-[#e5ae2d] ${
              compact ? "h-[38px]" : "h-[42px]"
            } px-4 flex items-center justify-center transition-all shadow-2xs cursor-pointer disabled:opacity-60`}
            aria-label="Pay with PayPal"
          >
            {isBusy ? (
              <Loader2 className="h-4 w-4 animate-spin text-[#003087]" />
            ) : (
              <span className="inline-flex items-baseline font-black italic tracking-tight text-lg leading-none select-none">
                <span className="text-[#003087]">Pay</span>
                <span className="text-[#0079c1]">Pal</span>
              </span>
            )}
          </button>

          <button
            type="button"
            disabled={disabled || isBusy}
            onClick={onSelectCard}
            className={`w-full rounded-[4px] bg-[#2c2e2f] hover:bg-[#1f2122] active:bg-[#141516] ${
              compact ? "h-[38px]" : "h-[42px]"
            } px-4 flex items-center justify-center gap-2 text-white text-xs sm:text-[13px] font-semibold transition-all shadow-2xs cursor-pointer disabled:opacity-60`}
            aria-label="Pay with Debit or Credit Card"
          >
            <CreditCard className="h-4 w-4 text-white shrink-0 stroke-[1.75]" />
            <span>Debit or Credit Card</span>
          </button>

          <div className="pt-0.5 flex items-center justify-center gap-1 select-none">
            <span className="text-[11px] italic text-slate-400 font-medium">
              Powered by
            </span>
            <span className="inline-flex items-baseline font-black italic tracking-tight text-xs leading-none">
              <span className="text-[#003087]">Pay</span>
              <span className="text-[#0079c1]">Pal</span>
            </span>
          </div>
        </div>
      )}

      {/* Optional Hackathon Sandbox Simulator Trigger (for testing bank declines / instant capture) */}
      {onSelectPayPal && sdkState === "READY" && (
        <button
          type="button"
          disabled={disabled || isBusy}
          onClick={onSelectPayPal}
          className="w-full pt-1 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[10px] font-semibold text-[#0070ba] hover:text-[#003087] hover:underline cursor-pointer"
        >
          <SlidersHorizontal className="h-3 w-3" />
          <span>Open Sandbox Simulator (Test Success / Decline)</span>
        </button>
      )}
    </div>
  );
}

interface PayPalCheckoutModalProps {
  order: PayPalModalOrderTarget | null;
  onClose: () => void;
  onSimulateCapture: (params: {
    transactionId: string;
    paypalOrderId: string;
    amountMajor: number;
    simulateOutcome: "SUCCESS" | "FAILED";
    failureReason?: string;
  }) => Promise<{
    ok: boolean;
    paymentStatus?: string;
    paypalCaptureId?: string;
    failureReason?: string;
  }>;
}

const FAILURE_REASONS = [
  {
    code: "INSTRUMENT_DECLINED",
    label: "INSTRUMENT_DECLINED — Issuing bank declined funding source",
  },
  {
    code: "INSUFFICIENT_FUNDS",
    label: "INSUFFICIENT_FUNDS — Insufficient balance in selected account",
  },
  {
    code: "PAYPAL_RISK_DECLINE",
    label: "PAYPAL_RISK_DECLINE — Declined by PayPal risk verification",
  },
];

export function PayPalCheckoutModal({
  order,
  onClose,
  onSimulateCapture,
}: PayPalCheckoutModalProps) {
  const [checkoutTab, setCheckoutTab] = useState<"PAYPAL" | "CARD">(
    order?.initialMode || "PAYPAL"
  );
  const [fundingSource, setFundingSource] = useState<
    "BALANCE" | "VISA" | "MASTERCARD"
  >("BALANCE");
  const [cardNumber, setCardNumber] = useState("4032 0019 4242 0055");
  const [cardExpiry, setCardExpiry] = useState("12/28");
  const [cardCvv, setCardCvv] = useState("842");
  const [cardHolder, setCardHolder] = useState("M Ravi");
  const [selectedFailureCode, setSelectedFailureCode] = useState(
    FAILURE_REASONS[0].label
  );
  const [submittingOutcome, setSubmittingOutcome] = useState<
    "SUCCESS" | "FAILED" | null
  >(null);
  const [step, setStep] = useState<"CHECKOUT" | "SUCCESS" | "FAILED">(
    "CHECKOUT"
  );
  const [captureId, setCaptureId] = useState<string | undefined>();
  const [failureMessage, setFailureMessage] = useState<string | undefined>();

  useEffect(() => {
    if (order) {
      setCheckoutTab(order.initialMode || "PAYPAL");
      setStep("CHECKOUT");
      setCaptureId(undefined);
      setFailureMessage(undefined);
    }
  }, [order]);

  if (!order) return null;

  const usdEquivalent =
    order.currency === "INR"
      ? (order.amountMajor / 83.3333).toFixed(2)
      : null;

  const liveSandboxApproveUrl =
    order.approveUrl ||
    `https://www.sandbox.paypal.com/checkoutnow?token=${order.paypalOrderId}`;

  async function handleAction(outcome: "SUCCESS" | "FAILED") {
    if (!order || submittingOutcome) return;
    setSubmittingOutcome(outcome);
    try {
      const result = await onSimulateCapture({
        transactionId: order.transactionId,
        paypalOrderId: order.paypalOrderId,
        amountMajor: order.amountMajor,
        simulateOutcome: outcome,
        failureReason: outcome === "FAILED" ? selectedFailureCode : undefined,
      });

      if (outcome === "SUCCESS" && result.ok) {
        setCaptureId(result.paypalCaptureId);
        setStep("SUCCESS");
      } else if (outcome === "FAILED" && result.ok) {
        setFailureMessage(result.failureReason || selectedFailureCode);
        setStep("FAILED");
      }
    } finally {
      setSubmittingOutcome(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-[460px] rounded-3xl bg-white text-slate-900 shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Official-Style PayPal Top Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-[#f5f7fa] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <div className="flex items-baseline font-black italic tracking-tight text-xl select-none">
              <span className="text-[#003087]">Pay</span>
              <span className="text-[#0079c1]">Pal</span>
            </div>
            <span className="rounded-full bg-[#003087]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#003087]">
              Sandbox
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#003087]">
              <ShoppingCart className="h-3.5 w-3.5 text-[#0070ba]" />
              <span>{formatCurrency(order.amountMajor, order.currency)}</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 cursor-pointer"
              aria-label="Close PayPal Checkout"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* AgentGuard Firewall Verification Banner */}
        <div className="bg-[#003087] px-5 py-2 text-white flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5 font-medium">
            <Shield className="h-3.5 w-3.5 text-[#00a8ea]" />
            <span>Verified by AgentGuard AI Firewall</span>
          </div>
          <span className="font-mono text-[10px] text-blue-200">
            Order: {order.paypalOrderId}
          </span>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          {step === "CHECKOUT" && (
            <>
              {/* Merchant & Product Summary */}
              <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-3.5 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Merchant: {order.merchantName}</span>
                  <span>
                    {order.payerEmail || "ravimanivel999@gmail.com"}
                  </span>
                </div>
                <p className="text-sm font-bold text-slate-900 leading-snug">
                  {order.productName}
                </p>
                <div className="flex items-baseline justify-between pt-1 border-t border-slate-200/80">
                  <span className="text-xs font-medium text-slate-600">
                    Total Protected Amount
                  </span>
                  <div className="text-right">
                    <span className="text-base font-extrabold text-[#003087]">
                      {formatCurrency(order.amountMajor, order.currency)}
                    </span>
                    {usdEquivalent && (
                      <span className="block text-[10px] font-mono text-slate-500">
                        PayPal Sandbox Settlement: ${usdEquivalent} USD
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Real-Time Official PayPal Sandbox JS SDK Buttons inside Modal */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Live PayPal Sandbox JS SDK Checkout
                </p>
                <PayPalSmartButtons
                  transactionId={order.transactionId}
                  amountMajor={order.amountMajor}
                  currency={order.currency}
                  orderId={order.paypalOrderId}
                  onPaymentCaptured={(res) => {
                    setCaptureId(res.paypalCaptureId);
                    setStep("SUCCESS");
                  }}
                />
              </div>

              {/* Mode Switcher for Sandbox Simulator: PayPal Wallet vs Debit or Credit Card */}
              <div className="pt-2 border-t border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Sandbox Outcome Simulator (Instant Test)
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    Success / Decline
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setCheckoutTab("PAYPAL")}
                    className={`rounded-lg py-1.5 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      checkoutTab === "PAYPAL"
                        ? "bg-[#ffc439] text-[#003087] shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span className="italic font-black">PayPal</span>
                    <span>Account</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCheckoutTab("CARD")}
                    className={`rounded-lg py-1.5 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      checkoutTab === "CARD"
                        ? "bg-[#2c2e2f] text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    <span>Debit or Credit Card</span>
                  </button>
                </div>

                {checkoutTab === "PAYPAL" ? (
                  /* TAB 1: PAYPAL ACCOUNT WALLET FUNDING */
                  <div className="space-y-2">
                    <label
                      onClick={() => setFundingSource("BALANCE")}
                      className={`flex items-center justify-between rounded-xl border p-2.5 cursor-pointer transition-all ${
                        fundingSource === "BALANCE"
                          ? "border-[#0070ba] bg-[#0070ba]/5 ring-1 ring-[#0070ba]"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#003087] text-white font-bold italic text-xs">
                          PP
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">
                            PayPal Sandbox Balance
                          </p>
                          <p className="text-[11px] text-emerald-700 font-medium">
                            Available • Instant Transfer
                          </p>
                        </div>
                      </div>
                      <input
                        type="radio"
                        checked={fundingSource === "BALANCE"}
                        onChange={() => setFundingSource("BALANCE")}
                        className="h-4 w-4 accent-[#0070ba]"
                      />
                    </label>

                    <label
                      onClick={() => setFundingSource("VISA")}
                      className={`flex items-center justify-between rounded-xl border p-2.5 cursor-pointer transition-all ${
                        fundingSource === "VISA"
                          ? "border-[#0070ba] bg-[#0070ba]/5 ring-1 ring-[#0070ba]"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-[#003087]">
                          <CreditCard className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">
                            HDFC Bank Visa •••• 4242
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Debit Card • PayPal Buyer Protection
                          </p>
                        </div>
                      </div>
                      <input
                        type="radio"
                        checked={fundingSource === "VISA"}
                        onChange={() => setFundingSource("VISA")}
                        className="h-4 w-4 accent-[#0070ba]"
                      />
                    </label>

                    <label
                      onClick={() => setFundingSource("MASTERCARD")}
                      className={`flex items-center justify-between rounded-xl border p-2.5 cursor-pointer transition-all ${
                        fundingSource === "MASTERCARD"
                          ? "border-[#0070ba] bg-[#0070ba]/5 ring-1 ring-[#0070ba]"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">
                            ICICI Bank •••• 8819
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Linked Sandbox Bank Account
                          </p>
                        </div>
                      </div>
                      <input
                        type="radio"
                        checked={fundingSource === "MASTERCARD"}
                        onChange={() => setFundingSource("MASTERCARD")}
                        className="h-4 w-4 accent-[#0070ba]"
                      />
                    </label>
                  </div>
                ) : (
                  /* TAB 2: DEBIT OR CREDIT CARD CHECKOUT FORM */
                  <div className="rounded-2xl border border-slate-200 bg-white p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <CreditCard className="h-4 w-4 text-[#0070ba]" />
                        PayPal Guest Card Checkout
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setCardNumber("4032 0019 4242 0055")}
                          className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 hover:bg-emerald-200 cursor-pointer"
                        >
                          Fill Success Card
                        </button>
                        <button
                          type="button"
                          onClick={() => setCardNumber("4032 0019 0000 0002")}
                          className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-800 hover:bg-rose-200 cursor-pointer"
                        >
                          Fill Decline Card
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">
                          Card Number
                        </label>
                        <input
                          type="text"
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono text-slate-900 focus:border-[#0070ba] focus:outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">
                            Expires
                          </label>
                          <input
                            type="text"
                            value={cardExpiry}
                            onChange={(e) => setCardExpiry(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-900 focus:border-[#0070ba] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">
                            CSC / CVV
                          </label>
                          <input
                            type="text"
                            value={cardCvv}
                            onChange={(e) => setCardCvv(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-900 focus:border-[#0070ba] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">
                            Cardholder
                          </label>
                          <input
                            type="text"
                            value={cardHolder}
                            onChange={(e) => setCardHolder(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-[#0070ba] focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons: Simulate Payment Success vs Simulate Payment Failed */}
                <div className="space-y-2.5 pt-1">
                  <button
                    type="button"
                    disabled={Boolean(submittingOutcome)}
                    onClick={() => handleAction("SUCCESS")}
                    className={`w-full rounded-[6px] ${
                      checkoutTab === "CARD"
                        ? "bg-[#2c2e2f] hover:bg-[#1f2122] text-white"
                        : "bg-[#ffc439] hover:bg-[#f2ba36] text-[#003087]"
                    } py-2.5 px-5 text-xs font-extrabold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60`}
                  >
                    {submittingOutcome === "SUCCESS" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Capturing Payment...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        <span>
                          {checkoutTab === "CARD"
                            ? `Simulate Card Capture Success (${formatCurrency(
                                order.amountMajor,
                                order.currency
                              )})`
                            : `Simulate PayPal Capture Success (${formatCurrency(
                                order.amountMajor,
                                order.currency
                              )})`}
                        </span>
                      </>
                    )}
                  </button>

                  {/* Hackathon Payment Failed Simulation Box */}
                  <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-rose-800">
                        Simulate Payment Failure (Decline):
                      </span>
                      <span className="text-[10px] font-mono text-rose-600">
                        Sandbox Test
                      </span>
                    </div>

                    <select
                      value={selectedFailureCode}
                      onChange={(e) => setSelectedFailureCode(e.target.value)}
                      className="w-full rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-800 focus:outline-none"
                    >
                      {FAILURE_REASONS.map((fr) => (
                        <option key={fr.code} value={fr.label}>
                          {fr.label}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      disabled={Boolean(submittingOutcome)}
                      onClick={() => handleAction("FAILED")}
                      className="w-full rounded-[6px] border-2 border-rose-600 bg-white hover:bg-rose-600 hover:text-white py-2 px-4 text-xs font-bold text-rose-600 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                    >
                      {submittingOutcome === "FAILED" ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Simulating Payment Failure...</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3.5 w-3.5" />
                          <span>Simulate Payment Failed (Declined)</span>
                        </>
                      )}
                    </button>
                  </div>

                  <a
                    href={liveSandboxApproveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#0070ba] hover:underline pt-0.5"
                  >
                    <span>
                      Open Direct sandbox.paypal.com Buyer Approval Window
                    </span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </>
          )}

          {/* STATE B: PAYMENT SUCCESS RECEIPT */}
          {step === "SUCCESS" && (
            <div className="py-4 text-center space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-10 w-10" />
              </div>

              <div>
                <span className="inline-block rounded-full bg-emerald-100 px-3 py-0.5 text-[11px] font-bold text-emerald-800 mb-1">
                  PAYMENT SUCCESSFUL
                </span>
                <h3 className="text-lg font-extrabold text-[#003087]">
                  You paid {formatCurrency(order.amountMajor, order.currency)}{" "}
                  to {order.merchantName}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verified & captured via AgentGuard AI Firewall + PayPal
                  Sandbox
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-3.5 text-left space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Item</span>
                  <span className="font-semibold text-slate-900 truncate max-w-[230px]">
                    {order.productName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Funding Method</span>
                  <span className="font-semibold text-slate-900">
                    {checkoutTab === "CARD"
                      ? `Card •••• ${cardNumber.slice(-4)}`
                      : fundingSource === "BALANCE"
                      ? "PayPal Balance"
                      : fundingSource === "VISA"
                      ? "Visa •••• 4242"
                      : "ICICI Bank •••• 8819"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">PayPal Order ID</span>
                  <span className="font-mono font-semibold text-[#003087]">
                    {order.paypalOrderId}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">PayPal Capture ID</span>
                  <span className="font-mono font-semibold text-emerald-700">
                    {captureId}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Status</span>
                  <span className="font-mono font-bold text-emerald-700">
                    COMPLETED
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-full bg-[#0070ba] hover:bg-[#005ea6] py-3 px-5 text-sm font-bold text-white shadow-md transition-colors cursor-pointer"
              >
                Done — Return to AgentGuard
              </button>
            </div>
          )}

          {/* STATE C: PAYMENT FAILED / DECLINED */}
          {step === "FAILED" && (
            <div className="py-4 text-center space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <XCircle className="h-10 w-10" />
              </div>

              <div>
                <span className="inline-block rounded-full bg-rose-100 px-3 py-0.5 text-[11px] font-bold text-rose-800 mb-1">
                  PAYMENT FAILED
                </span>
                <h3 className="text-lg font-extrabold text-slate-900">
                  We couldn&apos;t complete your payment
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  No funds were captured from your PayPal account.
                </p>
              </div>

              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-left space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-rose-700 font-medium">
                    PayPal Order ID
                  </span>
                  <span className="font-mono font-semibold text-slate-900">
                    {order.paypalOrderId}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-rose-700 font-medium">
                    Ledger Status
                  </span>
                  <span className="font-mono font-bold text-rose-700">
                    FAILED
                  </span>
                </div>
                <div className="pt-1 border-t border-rose-200/80 text-rose-800">
                  <span className="font-semibold block">Decline Reason:</span>
                  <span>{failureMessage}</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => setStep("CHECKOUT")}
                  className="flex-1 rounded-full bg-[#ffc439] hover:bg-[#f2ba36] py-2.5 px-4 text-xs font-extrabold text-[#003087] flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Try Again in PayPal
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-full border border-slate-300 bg-white hover:bg-slate-100 py-2.5 px-4 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  Close Window
                </button>
              </div>
            </div>
          )}
        </div>

        {/* PayPal Footer */}
        <div className="border-t border-slate-200 bg-[#f5f7fa] px-5 py-2.5 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <Lock className="h-3 w-3 text-slate-400" />
            Powered by{" "}
            <strong className="italic text-[#003087]">Pay</strong>
            <strong className="italic text-[#0079c1]">Pal</strong> Sandbox
          </span>
          <span>AgentGuard Zero-Trust Capture</span>
        </div>
      </div>
    </div>
  );
}
