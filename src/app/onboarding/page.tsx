"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Shield,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  CreditCard,
  Sliders,
  Globe,
  Loader2,
  Lock,
  Wrench,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/controls";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { CurrencyCode } from "@/types";
import {
  formatCurrency,
  formatCurrencyFromMinor,
  toMajorUnits,
} from "@/lib/utils/currency";
import { getPresetPolicyValues } from "@/lib/utils/presets";

const CURRENCIES: {
  code: CurrencyCode;
  symbol: string;
  name: string;
  region: string;
}[] = [
  { code: "INR", symbol: "₹", name: "Indian Rupee", region: "India (Default)" },
  { code: "USD", symbol: "$", name: "US Dollar", region: "United States" },
  { code: "EUR", symbol: "€", name: "Euro", region: "Eurozone" },
  { code: "GBP", symbol: "£", name: "British Pound", region: "United Kingdom" },
];

const LOCAL_DRAFT_KEY = "agentguard_onboarding_draft";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [currency, setCurrency] = useState<CurrencyCode>("INR");
  const [preset, setPreset] = useState<
    "RELAXED" | "BALANCED" | "STRICT" | "CUSTOM"
  >("BALANCED");

  // Custom policy state (initialized from BALANCED)
  const [maxTransactionAmountMajor, setMaxTransactionAmountMajor] =
    useState<number>(80000);
  const [dailyLimitMajor, setDailyLimitMajor] = useState<number>(100000);
  const [weeklyLimitMajor, setWeeklyLimitMajor] = useState<number>(250000);
  const [monthlyLimitMajor, setMonthlyLimitMajor] = useState<number>(500000);
  const [autoApprovalThresholdMajor, setAutoApprovalThresholdMajor] =
    useState<number>(10000);
  const [manualApprovalThresholdMajor, setManualApprovalThresholdMajor] =
    useState<number>(50000);
  const [requireTrustedMerchantForAuto, setRequireTrustedMerchantForAuto] =
    useState<boolean>(true);
  const [duplicateProtection, setDuplicateProtection] = useState<boolean>(true);
  const [autoApprovalEnabled, setAutoApprovalEnabled] = useState<boolean>(true);

  const [connectPayPal, setConnectPayPal] = useState<boolean>(false);
  const [sandboxEmail, setSandboxEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [restored, setRestored] = useState(false);

  // Restore saved onboarding step and draft on mount
  useEffect(() => {
    async function restoreProgress() {
      try {
        const res = await fetch("/api/users/me");
        const data = await res.json();
        const user = data?.data?.user;

        const savedStep = user?.onboardingStep;
        const draft = user?.onboardingDraft;

        if (draft && Object.keys(draft).length > 0) {
          applyDraft(savedStep || draft.step, draft);
          setRestored(true);
          return;
        }
      } catch {
        // Fallback to localStorage draft
      }

      try {
        const rawLocal = localStorage.getItem(LOCAL_DRAFT_KEY);
        if (rawLocal) {
          const parsedLocal = JSON.parse(rawLocal);
          applyDraft(parsedLocal.step, parsedLocal);
        }
      } catch {
        // Ignore parse error
      } finally {
        setRestored(true);
      }
    }
    restoreProgress();
  }, []);

  function applyDraft(savedStep: any, draft: Record<string, any>) {
    if (savedStep === 1 || savedStep === 2 || savedStep === 3) {
      setStep(savedStep);
    }
    if (draft.currency) setCurrency(draft.currency);
    if (draft.preset) setPreset(draft.preset);
    if (typeof draft.maxTransactionAmountMajor === "number")
      setMaxTransactionAmountMajor(draft.maxTransactionAmountMajor);
    if (typeof draft.dailyLimitMajor === "number")
      setDailyLimitMajor(draft.dailyLimitMajor);
    if (typeof draft.weeklyLimitMajor === "number")
      setWeeklyLimitMajor(draft.weeklyLimitMajor);
    if (typeof draft.monthlyLimitMajor === "number")
      setMonthlyLimitMajor(draft.monthlyLimitMajor);
    if (typeof draft.autoApprovalThresholdMajor === "number")
      setAutoApprovalThresholdMajor(draft.autoApprovalThresholdMajor);
    if (typeof draft.manualApprovalThresholdMajor === "number")
      setManualApprovalThresholdMajor(draft.manualApprovalThresholdMajor);
    if (typeof draft.requireTrustedMerchantForAuto === "boolean")
      setRequireTrustedMerchantForAuto(draft.requireTrustedMerchantForAuto);
    if (typeof draft.duplicateProtection === "boolean")
      setDuplicateProtection(draft.duplicateProtection);
    if (typeof draft.autoApprovalEnabled === "boolean")
      setAutoApprovalEnabled(draft.autoApprovalEnabled);
    if (typeof draft.connectPayPal === "boolean")
      setConnectPayPal(draft.connectPayPal);
    if (typeof draft.sandboxEmail === "string")
      setSandboxEmail(draft.sandboxEmail);
  }

  function buildCurrentDraft(targetStep: 1 | 2 | 3 = step) {
    return {
      step: targetStep,
      currency,
      preset,
      maxTransactionAmountMajor,
      dailyLimitMajor,
      weeklyLimitMajor,
      monthlyLimitMajor,
      autoApprovalThresholdMajor,
      manualApprovalThresholdMajor,
      requireTrustedMerchantForAuto,
      duplicateProtection,
      autoApprovalEnabled,
      connectPayPal,
      sandboxEmail,
    };
  }

  async function persistProgress(targetStep: 1 | 2 | 3 = step) {
    const draft = buildCurrentDraft(targetStep);
    try {
      localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(draft));
      localStorage.setItem("agentguard_last_path", "/onboarding");
      await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          onboardingStep: targetStep,
          onboardingDraft: draft,
          lastActivePath: "/onboarding",
        }),
      });
    } catch {
      // Ignore transient network error
    }
  }

  // Auto-save whenever draft fields change after initial restore
  useEffect(() => {
    if (!restored) return;
    const draft = buildCurrentDraft(step);
    try {
      localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(draft));
      localStorage.setItem("agentguard_last_path", "/onboarding");
    } catch {
      // Ignore storage error
    }

    const timer = setTimeout(() => {
      fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          onboardingStep: step,
          onboardingDraft: draft,
          lastActivePath: "/onboarding",
        }),
      }).catch(() => {});
    }, 350);

    return () => clearTimeout(timer);
  }, [
    restored,
    step,
    currency,
    preset,
    maxTransactionAmountMajor,
    dailyLimitMajor,
    weeklyLimitMajor,
    monthlyLimitMajor,
    autoApprovalThresholdMajor,
    manualApprovalThresholdMajor,
    requireTrustedMerchantForAuto,
    duplicateProtection,
    autoApprovalEnabled,
    connectPayPal,
    sandboxEmail,
  ]);

  async function goToStep(nextStep: 1 | 2 | 3) {
    setStep(nextStep);
    await persistProgress(nextStep);
  }

  async function handleLogoutFromOnboarding() {
    setLoggingOut(true);
    try {
      await persistProgress(step);
      await fetch("/api/auth/logout", { method: "POST" });
      toast.success(
        `Signed out. Your progress at Step ${step} of 3 has been saved.`
      );
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Failed to sign out");
    } finally {
      setLoggingOut(false);
    }
  }

  const presets = [
    getPresetPolicyValues("RELAXED", currency),
    getPresetPolicyValues("BALANCED", currency),
    getPresetPolicyValues("STRICT", currency),
  ];

  function handleSelectPreset(
    selected: "RELAXED" | "BALANCED" | "STRICT" | "CUSTOM"
  ) {
    setPreset(selected);
    if (selected !== "CUSTOM") {
      const p = getPresetPolicyValues(selected, currency);
      setMaxTransactionAmountMajor(toMajorUnits(p.maxTransactionAmount));
      setDailyLimitMajor(toMajorUnits(p.dailyLimit));
      setWeeklyLimitMajor(toMajorUnits(p.weeklyLimit));
      setMonthlyLimitMajor(toMajorUnits(p.monthlyLimit));
      setAutoApprovalThresholdMajor(toMajorUnits(p.autoApprovalThreshold));
      setManualApprovalThresholdMajor(
        toMajorUnits(p.manualApprovalThreshold)
      );
      setRequireTrustedMerchantForAuto(p.requireTrustedMerchantForAuto);
      setDuplicateProtection(p.duplicateProtection);
      setAutoApprovalEnabled(p.autoApprovalEnabled);
    }
  }

  function handleCurrencySelect(code: CurrencyCode) {
    setCurrency(code);
    if (preset !== "CUSTOM") {
      const p = getPresetPolicyValues(preset, code);
      setMaxTransactionAmountMajor(toMajorUnits(p.maxTransactionAmount));
      setDailyLimitMajor(toMajorUnits(p.dailyLimit));
      setWeeklyLimitMajor(toMajorUnits(p.weeklyLimit));
      setMonthlyLimitMajor(toMajorUnits(p.monthlyLimit));
      setAutoApprovalThresholdMajor(toMajorUnits(p.autoApprovalThreshold));
      setManualApprovalThresholdMajor(
        toMajorUnits(p.manualApprovalThreshold)
      );
    }
  }

  async function validateStep2AndContinue() {
    if (preset === "CUSTOM") {
      if (maxTransactionAmountMajor <= 0 || dailyLimitMajor <= 0) {
        toast.error("Spending limits must be greater than zero.");
        return;
      }
      if (dailyLimitMajor < maxTransactionAmountMajor) {
        toast.error(
          "Daily spending limit must be at least the maximum single transaction amount."
        );
        return;
      }
      if (weeklyLimitMajor < dailyLimitMajor) {
        toast.error(
          "Weekly spending limit must be at least the daily spending limit."
        );
        return;
      }
      if (monthlyLimitMajor < weeklyLimitMajor) {
        toast.error(
          "Monthly spending limit must be at least the weekly spending limit."
        );
        return;
      }
      if (manualApprovalThresholdMajor < autoApprovalThresholdMajor) {
        toast.error(
          "Manual approval threshold must be greater than or equal to automatic approval threshold."
        );
        return;
      }
    }
    await goToStep(3);
  }

  async function handleFinish(withPayPal: boolean) {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        preferredCurrency: currency,
        preset,
        connectPayPal: withPayPal,
        paypalSandboxPayerEmail: sandboxEmail.trim() || undefined,
      };

      if (preset === "CUSTOM") {
        payload.customPolicy = {
          maxTransactionAmountMajor: Number(maxTransactionAmountMajor),
          dailyLimitMajor: Number(dailyLimitMajor),
          weeklyLimitMajor: Number(weeklyLimitMajor),
          monthlyLimitMajor: Number(monthlyLimitMajor),
          autoApprovalThresholdMajor: Number(autoApprovalThresholdMajor),
          manualApprovalThresholdMajor: Number(manualApprovalThresholdMajor),
          requireTrustedMerchantForAuto,
          duplicateProtection,
          autoApprovalEnabled,
        };
      }

      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.message || "Failed to save onboarding preferences");
        return;
      }

      localStorage.removeItem(LOCAL_DRAFT_KEY);
      localStorage.setItem("agentguard_last_path", "/shopping-agent");
      toast.success(
        `AgentGuard Firewall configured with ${preset} protection!`
      );
      router.push("/shopping-agent");
      router.refresh();
    } catch {
      toast.error("Network error while saving onboarding setup");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#060a12] text-slate-100 flex flex-col justify-between p-4 sm:p-8">
      <header className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 py-2">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-violet-600">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="font-bold text-white">AgentGuard AI</span>
            <span className="ml-2 text-xs text-slate-400">
              First-Time Security Setup
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-400">
          <div className="flex items-center gap-2">
            <span>Step {step} of 3</span>
            <div className="flex gap-1.5 ml-1">
              {([1, 2, 3] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => goToStep(s)}
                  title={`Go to Step ${s}`}
                  className={`h-2 w-8 rounded-full transition-colors cursor-pointer ${
                    step >= s ? "bg-blue-500" : "bg-slate-800"
                  }`}
                />
              ))}
            </div>
          </div>

          <ThemeToggle showLabel />

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loggingOut}
            onClick={handleLogoutFromOnboarding}
          >
            {loggingOut ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <LogOut className="h-3.5 w-3.5 text-rose-400" />
            )}
            Sign Out
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl my-auto py-8">
        {/* STEP 1: PREFERRED CURRENCY */}
        {step === 1 && (
          <div className="rounded-2xl border border-slate-800/90 bg-[#0a101d] p-6 sm:p-10 shadow-2xl">
            <Badge variant="default" className="mb-3">
              <Globe className="h-3.5 w-3.5" />
              Step 1 — Preferred Currency
            </Badge>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              Select your primary spending currency
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              All financial firewall policies, daily spending limits, and AI
              shopping budgets will be enforced in this currency. Defaults to
              INR for Indian users; you can change this anytime in Settings.
            </p>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {CURRENCIES.map((c) => {
                const active = currency === c.code;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => handleCurrencySelect(c.code)}
                    className={`flex items-center justify-between rounded-xl border p-5 text-left transition-all cursor-pointer ${
                      active
                        ? "border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/10"
                        : "border-slate-800 bg-[#060a12] hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-xl text-xl font-bold ${
                          active
                            ? "bg-blue-600 text-white"
                            : "bg-slate-800/80 text-slate-300"
                        }`}
                      >
                        {c.symbol}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-base">
                            {c.code}
                          </span>
                          <span className="text-xs text-slate-400">
                            — {c.name}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {c.region}
                        </p>
                      </div>
                    </div>
                    {active && (
                      <CheckCircle2 className="h-5 w-5 text-blue-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-8 flex justify-end">
              <Button
                variant="violet"
                size="lg"
                onClick={() => goToStep(2)}
              >
                Continue to Protection Level
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: FINANCIAL PROTECTION LEVEL + FULL CUSTOMIZATION */}
        {step === 2 && (
          <div className="rounded-2xl border border-slate-800/90 bg-[#0a101d] p-6 sm:p-10 shadow-2xl space-y-6">
            <div>
              <Badge variant="violet" className="mb-3">
                <Sliders className="h-3.5 w-3.5" />
                Step 2 — Financial Protection Level
              </Badge>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                Choose your AI Firewall protection preset or fully customize
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                Select one of the three security presets or choose{" "}
                <strong className="text-white">Fully Customize (CUSTOM)</strong>{" "}
                to configure your own exact spending limits and approval
                thresholds right now.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {presets.map((p) => {
                const isSelected = preset === p.preset;
                return (
                  <button
                    key={p.preset}
                    type="button"
                    onClick={() =>
                      handleSelectPreset(
                        p.preset as "RELAXED" | "BALANCED" | "STRICT"
                      )
                    }
                    className={`flex flex-col justify-between rounded-xl border p-5 text-left transition-all cursor-pointer ${
                      isSelected
                        ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/40"
                        : "border-slate-800 bg-[#060a12] hover:border-slate-700"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-white">
                          {p.preset}
                        </span>
                        {p.preset === "BALANCED" && (
                          <Badge variant="success">Recommended</Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 font-medium">
                        {p.tagline}
                      </p>
                      <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                        {p.description}
                      </p>
                    </div>

                    <div className="mt-5 space-y-2 border-t border-slate-800/80 pt-4 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Max Single Tx:</span>
                        <span className="font-mono font-semibold text-white">
                          {formatCurrencyFromMinor(
                            p.maxTransactionAmount,
                            currency
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Daily Limit:</span>
                        <span className="font-mono font-semibold text-white">
                          {formatCurrencyFromMinor(p.dailyLimit, currency)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">
                          Auto-Approve Under:
                        </span>
                        <span className="font-mono font-semibold text-emerald-400">
                          {p.autoApprovalEnabled
                            ? formatCurrencyFromMinor(
                                p.autoApprovalThreshold,
                                currency
                              )
                            : "Manual Only"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">
                          Manual Approval ≥
                        </span>
                        <span className="font-mono font-semibold text-amber-400">
                          {formatCurrencyFromMinor(
                            p.manualApprovalThreshold,
                            currency
                          )}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}

              {/* 4th Card: Fully Customize (CUSTOM) */}
              <button
                type="button"
                onClick={() => handleSelectPreset("CUSTOM")}
                className={`flex flex-col justify-between rounded-xl border p-5 text-left transition-all cursor-pointer ${
                  preset === "CUSTOM"
                    ? "border-violet-500 bg-violet-500/15 ring-1 ring-violet-500/40"
                    : "border-slate-800 bg-[#060a12] hover:border-slate-700"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-white flex items-center gap-1.5">
                      <Wrench className="h-3.5 w-3.5 text-violet-400" />
                      CUSTOM
                    </span>
                    <Badge variant="violet">Fully Customize</Badge>
                  </div>
                  <p className="text-xs text-slate-300 font-medium">
                    Tailor every spending cap and approval rule
                  </p>
                  <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                    Set your own exact single-transaction ceiling, daily/weekly/monthly
                    budgets, auto-approval threshold, and security switches.
                  </p>
                </div>

                <div className="mt-5 space-y-2 border-t border-slate-800/80 pt-4 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Max Single Tx:</span>
                    <span className="font-mono font-semibold text-white">
                      {formatCurrency(maxTransactionAmountMajor, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Daily Limit:</span>
                    <span className="font-mono font-semibold text-white">
                      {formatCurrency(dailyLimitMajor, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Auto-Approve Under:</span>
                    <span className="font-mono font-semibold text-emerald-400">
                      {autoApprovalEnabled
                        ? formatCurrency(autoApprovalThresholdMajor, currency)
                        : "Manual Only"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Manual Approval ≥</span>
                    <span className="font-mono font-semibold text-amber-400">
                      {formatCurrency(manualApprovalThresholdMajor, currency)}
                    </span>
                  </div>
                </div>
              </button>
            </div>

            {/* Interactive Full Customization Panel */}
            {preset === "CUSTOM" && (
              <div className="rounded-xl border border-violet-500/40 bg-[#060a12] p-5 sm:p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-violet-400" />
                      Custom Financial Policy Configuration ({currency})
                    </h3>
                    <p className="text-xs text-slate-400">
                      Define your exact deterministic limits in {currency}.
                    </p>
                  </div>
                  <Badge variant="violet">CUSTOM MODE</Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-white mb-1">
                      Maximum Single Transaction ({currency})
                    </label>
                    <Input
                      type="number"
                      min={1}
                      value={maxTransactionAmountMajor}
                      onChange={(e) =>
                        setMaxTransactionAmountMajor(Number(e.target.value))
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-white mb-1">
                      Daily Spending Limit ({currency})
                    </label>
                    <Input
                      type="number"
                      min={1}
                      value={dailyLimitMajor}
                      onChange={(e) =>
                        setDailyLimitMajor(Number(e.target.value))
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-white mb-1">
                      Weekly Spending Limit ({currency})
                    </label>
                    <Input
                      type="number"
                      min={1}
                      value={weeklyLimitMajor}
                      onChange={(e) =>
                        setWeeklyLimitMajor(Number(e.target.value))
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-white mb-1">
                      Monthly Spending Limit ({currency})
                    </label>
                    <Input
                      type="number"
                      min={1}
                      value={monthlyLimitMajor}
                      onChange={(e) =>
                        setMonthlyLimitMajor(Number(e.target.value))
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-emerald-400 mb-1">
                      Auto-Approval Threshold ({currency})
                    </label>
                    <Input
                      type="number"
                      min={0}
                      value={autoApprovalThresholdMajor}
                      onChange={(e) =>
                        setAutoApprovalThresholdMajor(Number(e.target.value))
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-amber-400 mb-1">
                      Mandatory Manual Approval ≥ ({currency})
                    </label>
                    <Input
                      type="number"
                      min={0}
                      value={manualApprovalThresholdMajor}
                      onChange={(e) =>
                        setManualApprovalThresholdMajor(Number(e.target.value))
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-800">
                  <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#0a101d] p-3">
                    <div className="pr-2">
                      <span className="text-xs font-semibold text-white block">
                        Enable Auto-Approval
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Allow safe orders under threshold
                      </span>
                    </div>
                    <Switch
                      checked={autoApprovalEnabled}
                      onCheckedChange={setAutoApprovalEnabled}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#0a101d] p-3">
                    <div className="pr-2">
                      <span className="text-xs font-semibold text-white block">
                        Trusted Merchant Check
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Require allowlist for auto-approval
                      </span>
                    </div>
                    <Switch
                      checked={requireTrustedMerchantForAuto}
                      onCheckedChange={setRequireTrustedMerchantForAuto}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#0a101d] p-3">
                    <div className="pr-2">
                      <span className="text-xs font-semibold text-white block">
                        Duplicate Protection
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Block repeat identical orders
                      </span>
                    </div>
                    <Switch
                      checked={duplicateProtection}
                      onCheckedChange={setDuplicateProtection}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" onClick={() => goToStep(1)}>
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button
                variant="violet"
                size="lg"
                onClick={validateStep2AndContinue}
              >
                Continue to Payment Setup
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: PAYMENT SETUP */}
        {step === 3 && (
          <div className="rounded-2xl border border-slate-800/90 bg-[#0a101d] p-6 sm:p-10 shadow-2xl">
            <Badge variant="success" className="mb-3">
              <CreditCard className="h-3.5 w-3.5" />
              Step 3 — Payment Setup
            </Badge>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              PayPal Sandbox Checkout Preferences
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Enable PayPal Sandbox Checkout for approved AI purchases, or
              explore the AgentGuard AI platform first without connecting
              PayPal. You are never forced to link payment during registration.
            </p>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                onClick={() => setConnectPayPal(true)}
                className={`rounded-xl border p-5 cursor-pointer transition-all ${
                  connectPayPal
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-slate-800 bg-[#060a12]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">
                    Enable PayPal Checkout / Sandbox
                  </span>
                  <CheckCircle2
                    className={`h-5 w-5 ${
                      connectPayPal ? "text-blue-400" : "text-slate-700"
                    }`}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                  Use PayPal Sandbox Checkout to complete transactions that pass
                  AgentGuard Firewall policy & human approval checks.
                </p>
                {connectPayPal && (
                  <div className="mt-4">
                    <label className="block text-xs text-slate-300 mb-1">
                      Optional PayPal Sandbox Buyer Email (for reference):
                    </label>
                    <Input
                      type="email"
                      placeholder="sb-buyer@personal.example.com"
                      value={sandboxEmail}
                      onChange={(e) => setSandboxEmail(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div
                onClick={() => setConnectPayPal(false)}
                className={`rounded-xl border p-5 cursor-pointer transition-all ${
                  !connectPayPal
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-slate-800 bg-[#060a12]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">
                    Explore Without Connecting PayPal
                  </span>
                  <CheckCircle2
                    className={`h-5 w-5 ${
                      !connectPayPal ? "text-blue-400" : "text-slate-700"
                    }`}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                  Test the AI Shopping Agent, Financial Policy Engine, Risk
                  Intelligence, and Pending Approvals right away. You can
                  configure PayPal anytime in the PayPal Connection tab.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-slate-800 bg-[#060a12] p-4 flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <Lock className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>
                Summary: Currency <strong>{currency}</strong> • Policy Mode{" "}
                <strong>{preset}</strong> • Max Single Tx{" "}
                <strong>
                  {formatCurrency(maxTransactionAmountMajor, currency)}
                </strong>{" "}
                • Daily Limit{" "}
                <strong>{formatCurrency(dailyLimitMajor, currency)}</strong>
              </span>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <Button variant="outline" onClick={() => goToStep(2)}>
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  disabled={saving}
                  onClick={() => handleFinish(false)}
                >
                  Explore Without PayPal
                </Button>
                <Button
                  variant="violet"
                  size="lg"
                  disabled={saving}
                  onClick={() => handleFinish(connectPayPal)}
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Activating Firewall...
                    </>
                  ) : (
                    <>
                      Complete Setup & Launch Dashboard
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-slate-500 py-2">
        AgentGuard AI — Deterministic Financial Policy Engine
      </footer>
    </div>
  );
}
