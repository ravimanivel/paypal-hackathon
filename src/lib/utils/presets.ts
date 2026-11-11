import { CurrencyCode, PolicyPreset } from "@/types";
import { toMinorUnits } from "@/lib/utils/currency";

export interface PresetConfig {
  preset: PolicyPreset;
  label: string;
  tagline: string;
  description: string;
  currency: CurrencyCode;
  maxTransactionAmount: number;
  dailyLimit: number;
  weeklyLimit: number;
  monthlyLimit: number;
  autoApprovalThreshold: number;
  manualApprovalThreshold: number;
  requireTrustedMerchantForAuto: boolean;
  duplicateProtection: boolean;
  autoApprovalEnabled: boolean;
}

export function getPresetPolicyValues(
  preset: "RELAXED" | "BALANCED" | "STRICT",
  currency: CurrencyCode = "INR"
): PresetConfig {
  const isInr = currency === "INR";
  const mult = isInr ? 1 : 0.015;

  const roundMajor = (val: number) =>
    isInr ? val : Math.max(10, Math.round((val * mult) / 10) * 10);

  if (preset === "RELAXED") {
    return {
      preset: "RELAXED",
      label: "Relaxed Protection",
      tagline: "Higher spending flexibility with fewer manual prompts",
      description:
        "Ideal for frequent AI-assisted shopping. Enforces all hard daily/monthly caps while allowing automatic approval on moderate purchases.",
      currency,
      maxTransactionAmount: toMinorUnits(roundMajor(150000)),
      dailyLimit: toMinorUnits(roundMajor(250000)),
      weeklyLimit: toMinorUnits(roundMajor(600000)),
      monthlyLimit: toMinorUnits(roundMajor(1200000)),
      autoApprovalThreshold: toMinorUnits(roundMajor(35000)),
      manualApprovalThreshold: toMinorUnits(roundMajor(80000)),
      requireTrustedMerchantForAuto: false,
      duplicateProtection: true,
      autoApprovalEnabled: true,
    };
  }

  if (preset === "STRICT") {
    return {
      preset: "STRICT",
      label: "Strict Lockdown",
      tagline: "Zero-trust manual approval for almost every transaction",
      description:
        "Maximum security posture. Disables autonomous approvals by default, enforces strict merchant allowlists, and caps single purchases tightly.",
      currency,
      maxTransactionAmount: toMinorUnits(roundMajor(40000)),
      dailyLimit: toMinorUnits(roundMajor(50000)),
      weeklyLimit: toMinorUnits(roundMajor(120000)),
      monthlyLimit: toMinorUnits(roundMajor(250000)),
      autoApprovalThreshold: toMinorUnits(roundMajor(2000)),
      manualApprovalThreshold: toMinorUnits(roundMajor(5000)),
      requireTrustedMerchantForAuto: true,
      duplicateProtection: true,
      autoApprovalEnabled: false,
    };
  }

  // Default: BALANCED
  return {
    preset: "BALANCED",
    label: "Balanced Firewall (Recommended)",
    tagline: "Smart automation for small items, human control for big purchases",
    description:
      "Auto-approves low-risk purchases from trusted merchants while requiring human sign-off for higher-value orders and blocking hard limit violations.",
    currency,
    maxTransactionAmount: toMinorUnits(roundMajor(80000)),
    dailyLimit: toMinorUnits(roundMajor(100000)),
    weeklyLimit: toMinorUnits(roundMajor(250000)),
    monthlyLimit: toMinorUnits(roundMajor(500000)),
    autoApprovalThreshold: toMinorUnits(roundMajor(10000)),
    manualApprovalThreshold: toMinorUnits(roundMajor(50000)),
    requireTrustedMerchantForAuto: true,
    duplicateProtection: true,
    autoApprovalEnabled: true,
  };
}

