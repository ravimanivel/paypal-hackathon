"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Sliders,
  Shield,
  Save,
  Loader2,
  Plus,
  X,
  Info,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress, Skeleton, Switch } from "@/components/ui/controls";
import { CurrencyCode } from "@/types";
import { formatCurrency, toMajorUnits } from "@/lib/utils/currency";

export default function FinancialPoliciesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [policyId, setPolicyId] = useState("");
  const [policyVersion, setPolicyVersion] = useState(1);
  const [preset, setPreset] = useState<
    "RELAXED" | "BALANCED" | "STRICT" | "CUSTOM"
  >("BALANCED");
  const [currency, setCurrency] = useState<CurrencyCode>("INR");

  const [maxTransactionAmountMajor, setMaxTransactionAmountMajor] =
    useState(80000);
  const [dailyLimitMajor, setDailyLimitMajor] = useState(100000);
  const [weeklyLimitMajor, setWeeklyLimitMajor] = useState(250000);
  const [monthlyLimitMajor, setMonthlyLimitMajor] = useState(500000);
  const [autoApprovalThresholdMajor, setAutoApprovalThresholdMajor] =
    useState(10000);
  const [manualApprovalThresholdMajor, setManualApprovalThresholdMajor] =
    useState(50000);

  const [trustedMerchants, setTrustedMerchants] = useState<string[]>([]);
  const [blockedMerchants, setBlockedMerchants] = useState<string[]>([]);
  const [newTrusted, setNewTrusted] = useState("");
  const [newBlocked, setNewBlocked] = useState("");

  const [requireTrustedMerchantForAuto, setRequireTrustedMerchantForAuto] =
    useState(true);
  const [duplicateProtection, setDuplicateProtection] = useState(true);
  const [duplicateWindowMinutes, setDuplicateWindowMinutes] = useState(30);
  const [autoApprovalEnabled, setAutoApprovalEnabled] = useState(true);

  const [spending, setSpending] = useState<any>({
    dailySpentMajor: 0,
    weeklySpentMajor: 0,
    monthlySpentMajor: 0,
  });
  const [presetsMap, setPresetsMap] = useState<any>(null);

  async function loadPolicy() {
    setLoading(true);
    try {
      const res = await fetch("/api/policies");
      const data = await res.json();
      if (data.success && data.data.policy) {
        const p = data.data.policy;
        setPolicyId(p.id);
        setPolicyVersion(p.policyVersion);
        setPreset(p.preset);
        setCurrency(p.currency);
        setMaxTransactionAmountMajor(p.maxTransactionAmountMajor);
        setDailyLimitMajor(p.dailyLimitMajor);
        setWeeklyLimitMajor(p.weeklyLimitMajor);
        setMonthlyLimitMajor(p.monthlyLimitMajor);
        setAutoApprovalThresholdMajor(p.autoApprovalThresholdMajor);
        setManualApprovalThresholdMajor(p.manualApprovalThresholdMajor);
        setTrustedMerchants(p.trustedMerchants || []);
        setBlockedMerchants(p.blockedMerchants || []);
        setRequireTrustedMerchantForAuto(
          Boolean(p.requireTrustedMerchantForAuto)
        );
        setDuplicateProtection(Boolean(p.duplicateProtection));
        setDuplicateWindowMinutes(p.duplicateWindowMinutes || 30);
        setAutoApprovalEnabled(Boolean(p.autoApprovalEnabled));
        setSpending(data.data.spending);
        setPresetsMap(data.data.presets);
      }
    } catch {
      toast.error("Failed to load financial policy");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPolicy();
  }, []);

  function applyPresetLocally(presetKey: "RELAXED" | "BALANCED" | "STRICT") {
    if (!presetsMap || !presetsMap[presetKey]) return;
    const p = presetsMap[presetKey];
    setPreset(presetKey);
    setMaxTransactionAmountMajor(toMajorUnits(p.maxTransactionAmount));
    setDailyLimitMajor(toMajorUnits(p.dailyLimit));
    setWeeklyLimitMajor(toMajorUnits(p.weeklyLimit));
    setMonthlyLimitMajor(toMajorUnits(p.monthlyLimit));
    setAutoApprovalThresholdMajor(toMajorUnits(p.autoApprovalThreshold));
    setManualApprovalThresholdMajor(toMajorUnits(p.manualApprovalThreshold));
    setRequireTrustedMerchantForAuto(p.requireTrustedMerchantForAuto);
    setDuplicateProtection(p.duplicateProtection);
    setAutoApprovalEnabled(p.autoApprovalEnabled);
    toast.info(
      `Loaded ${presetKey} preset values into form. Click "Save & Enforce Policy" to apply.`
    );
  }

  async function handleSavePolicy(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const endpoint = policyId ? `/api/policies/${policyId}` : "/api/policies";
      const method = policyId ? "PATCH" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preset,
          currency,
          maxTransactionAmountMajor: Number(maxTransactionAmountMajor),
          dailyLimitMajor: Number(dailyLimitMajor),
          weeklyLimitMajor: Number(weeklyLimitMajor),
          monthlyLimitMajor: Number(monthlyLimitMajor),
          autoApprovalThresholdMajor: Number(autoApprovalThresholdMajor),
          manualApprovalThresholdMajor: Number(manualApprovalThresholdMajor),
          trustedMerchants,
          blockedMerchants,
          requireTrustedMerchantForAuto,
          duplicateProtection,
          duplicateWindowMinutes: Number(duplicateWindowMinutes),
          autoApprovalEnabled,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.message || "Validation failed");
        return;
      }

      toast.success(data.message || "Financial policy updated");
      loadPolicy();
    } catch {
      toast.error("Failed to save policy");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-6">
      {/* Header & Version */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800/90 bg-[#0a101d] p-5">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="violet">
              <Shield className="h-3.5 w-3.5" />
              Policy Version v{policyVersion}
            </Badge>
            <Badge variant="outline">Preset: {preset}</Badge>
          </div>
          <h2 className="mt-1.5 text-lg font-bold text-white">
            Deterministic Financial Policy Engine
          </h2>
          <p className="text-xs text-slate-400">
            Hard spending rules are enforced by server-side code in integer
            minor units. AI models can never override or weaken these limits.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(["RELAXED", "BALANCED", "STRICT"] as const).map((pKey) => (
            <Button
              key={pKey}
              type="button"
              variant={preset === pKey ? "default" : "outline"}
              size="sm"
              onClick={() => applyPresetLocally(pKey)}
            >
              Load {pKey} Preset
            </Button>
          ))}
        </div>
      </div>

      {/* Clearly Labelled Example Balanced Policy Reference Banner */}
      <div className="rounded-xl border border-blue-500/25 bg-blue-950/15 p-4 text-xs text-slate-300 flex items-start gap-3">
        <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-white">
            Reference Example — Balanced Policy (INR):
          </span>{" "}
          Maximum single transaction: <strong>₹80,000</strong> • Daily spending
          limit: <strong>₹1,00,000</strong> • Automatic approval under:{" "}
          <strong>₹10,000</strong> • Mandatory manual approval at or above:{" "}
          <strong>₹50,000</strong> • Trusted merchant checks enabled • Duplicate
          transaction protection enabled.
        </div>
      </div>

      {/* Live Spending Aggregation Meters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-800 bg-[#0a101d] p-4">
          <div className="flex justify-between text-xs text-slate-400 mb-1.5">
            <span>Today&apos;s Aggregated Spending</span>
            <span className="font-mono text-white">
              {formatCurrency(spending.dailySpentMajor, currency)} /{" "}
              {formatCurrency(dailyLimitMajor, currency)}
            </span>
          </div>
          <Progress
            value={
              dailyLimitMajor > 0
                ? (spending.dailySpentMajor / dailyLimitMajor) * 100
                : 0
            }
          />
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0a101d] p-4">
          <div className="flex justify-between text-xs text-slate-400 mb-1.5">
            <span>7-Day Weekly Spending</span>
            <span className="font-mono text-white">
              {formatCurrency(spending.weeklySpentMajor, currency)} /{" "}
              {formatCurrency(weeklyLimitMajor, currency)}
            </span>
          </div>
          <Progress
            value={
              weeklyLimitMajor > 0
                ? (spending.weeklySpentMajor / weeklyLimitMajor) * 100
                : 0
            }
          />
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0a101d] p-4">
          <div className="flex justify-between text-xs text-slate-400 mb-1.5">
            <span>30-Day Monthly Spending</span>
            <span className="font-mono text-white">
              {formatCurrency(spending.monthlySpentMajor, currency)} /{" "}
              {formatCurrency(monthlyLimitMajor, currency)}
            </span>
          </div>
          <Progress
            value={
              monthlyLimitMajor > 0
                ? (spending.monthlySpentMajor / monthlyLimitMajor) * 100
                : 0
            }
          />
        </div>
      </div>

      {/* Main Policy Form */}
      <form onSubmit={handleSavePolicy} className="space-y-6">
        <div className="rounded-xl border border-slate-800/90 bg-[#0a101d] p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sliders className="h-4 w-4 text-blue-400" />
                Spending Caps & Approval Thresholds ({currency})
              </h3>
              <p className="text-xs text-slate-400">
                Any purchase exceeding Maximum Transaction or Daily/Weekly/Monthly
                limits is deterministically BLOCKED.
              </p>
            </div>

            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
              className="rounded-lg border border-slate-800 bg-[#060a12] px-3 py-1.5 text-xs font-semibold text-white"
            >
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-semibold text-white mb-1">
                Maximum Single Transaction ({currency})
              </label>
              <Input
                type="number"
                value={maxTransactionAmountMajor}
                onChange={(e) => {
                  setPreset("CUSTOM");
                  setMaxTransactionAmountMajor(Number(e.target.value));
                }}
                min={1}
                required
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Hard ceiling for any single AI purchase proposal.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white mb-1">
                Daily Spending Limit ({currency})
              </label>
              <Input
                type="number"
                value={dailyLimitMajor}
                onChange={(e) => {
                  setPreset("CUSTOM");
                  setDailyLimitMajor(Number(e.target.value));
                }}
                min={1}
                required
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Maximum cumulative spending allowed per calendar day.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white mb-1">
                Weekly Spending Limit ({currency})
              </label>
              <Input
                type="number"
                value={weeklyLimitMajor}
                onChange={(e) => {
                  setPreset("CUSTOM");
                  setWeeklyLimitMajor(Number(e.target.value));
                }}
                min={1}
                required
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Rolling 7-day cumulative spending limit.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white mb-1">
                Monthly Spending Limit ({currency})
              </label>
              <Input
                type="number"
                value={monthlyLimitMajor}
                onChange={(e) => {
                  setPreset("CUSTOM");
                  setMonthlyLimitMajor(Number(e.target.value));
                }}
                min={1}
                required
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Rolling 30-day cumulative spending limit.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-emerald-400 mb-1">
                Automatic Approval Threshold ({currency})
              </label>
              <Input
                type="number"
                value={autoApprovalThresholdMajor}
                onChange={(e) => {
                  setPreset("CUSTOM");
                  setAutoApprovalThresholdMajor(Number(e.target.value));
                }}
                min={0}
                required
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Low-risk purchases at or below this amount can be AUTO_APPROVED.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-amber-400 mb-1">
                Mandatory Manual Approval Threshold ({currency})
              </label>
              <Input
                type="number"
                value={manualApprovalThresholdMajor}
                onChange={(e) => {
                  setPreset("CUSTOM");
                  setManualApprovalThresholdMajor(Number(e.target.value));
                }}
                min={0}
                required
              />
              <p className="mt-1 text-[11px] text-slate-500">
                High-value orders meeting this threshold require explicit human
                sign-off.
              </p>
            </div>
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#060a12] p-3.5">
              <div className="pr-3">
                <p className="text-xs font-semibold text-white">
                  Enable Automatic Approvals
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Allow safe purchases under threshold without manual prompt
                </p>
              </div>
              <Switch
                checked={autoApprovalEnabled}
                onCheckedChange={setAutoApprovalEnabled}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#060a12] p-3.5">
              <div className="pr-3">
                <p className="text-xs font-semibold text-white">
                  Require Trusted Merchant for Auto
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Untrusted merchants always require manual approval
                </p>
              </div>
              <Switch
                checked={requireTrustedMerchantForAuto}
                onCheckedChange={setRequireTrustedMerchantForAuto}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#060a12] p-3.5">
              <div className="pr-3">
                <p className="text-xs font-semibold text-white">
                  Duplicate Transaction Protection
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Block identical product/merchant/amount within{" "}
                  {duplicateWindowMinutes}m
                </p>
              </div>
              <Switch
                checked={duplicateProtection}
                onCheckedChange={setDuplicateProtection}
              />
            </div>
          </div>
        </div>

        {/* Trusted & Blocked Merchants */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-xl border border-slate-800/90 bg-[#0a101d] p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                Trusted Merchants Allowlist
              </h3>
              <p className="text-xs text-slate-400">
                Merchants eligible for automatic approval under your threshold.
              </p>
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="Add trusted merchant (e.g., Apple Store)"
                value={newTrusted}
                onChange={(e) => setNewTrusted(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const v = newTrusted.trim();
                  if (v && !trustedMerchants.includes(v)) {
                    setTrustedMerchants([...trustedMerchants, v]);
                    setNewTrusted("");
                  }
                }}
              >
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {trustedMerchants.map((m) => (
                <Badge key={m} variant="success" className="py-1 px-2.5">
                  <span>{m}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setTrustedMerchants(
                        trustedMerchants.filter((item) => item !== m)
                      )
                    }
                    className="ml-1 hover:text-white cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/90 bg-[#0a101d] p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Shield className="h-4 w-4 text-rose-400" />
                Blocked Merchants Denylist
              </h3>
              <p className="text-xs text-slate-400">
                Any proposal targeting these merchants is immediately BLOCKED.
              </p>
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="Add blocked merchant (e.g., DarkMarket Electronics)"
                value={newBlocked}
                onChange={(e) => setNewBlocked(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const v = newBlocked.trim();
                  if (v && !blockedMerchants.includes(v)) {
                    setBlockedMerchants([...blockedMerchants, v]);
                    setNewBlocked("");
                  }
                }}
              >
                <Plus className="h-4 w-4" />
                Block
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {blockedMerchants.map((m) => (
                <Badge key={m} variant="danger" className="py-1 px-2.5">
                  <span>{m}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setBlockedMerchants(
                        blockedMerchants.filter((item) => item !== m)
                      )
                    }
                    className="ml-1 hover:text-white cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" variant="violet" size="lg" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving & Incrementing Policy Version...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save & Enforce Policy (v{policyVersion + 1})
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

