import { CurrencyCode } from "@/types";

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

export const CURRENCY_LOCALES: Record<CurrencyCode, string> = {
  INR: "en-IN",
  USD: "en-US",
  EUR: "de-DE",
  GBP: "en-GB",
};

/**
 * Converts major currency units (e.g., 80000.50) to integer minor units (paise/cents: 8000050).
 * Uses string splitting / Math.round safely to avoid IEEE 754 floating-point drift.
 */
export function toMinorUnits(majorAmount: number | string): number {
  const num = typeof majorAmount === "string" ? parseFloat(majorAmount) : majorAmount;
  if (!Number.isFinite(num) || num < 0) {
    throw new Error(`Invalid monetary amount: ${majorAmount}`);
  }
  return Math.round(num * 100);
}

/**
 * Converts integer minor units (e.g., 8000050) to major currency units (80000.5).
 */
export function toMajorUnits(minorAmount: number): number {
  if (!Number.isFinite(minorAmount)) {
    return 0;
  }
  return Math.round(minorAmount) / 100;
}

/**
 * Formats integer minor units as a PayPal-compatible 2-decimal string (e.g., "80000.00").
 */
export function formatMinorForPayPal(minorAmount: number): string {
  const whole = Math.floor(Math.abs(minorAmount) / 100);
  const fraction = Math.abs(Math.round(minorAmount)) % 100;
  const sign = minorAmount < 0 ? "-" : "";
  return `${sign}${whole}.${fraction.toString().padStart(2, "0")}`;
}

/**
 * Formats integer minor units for UI display (e.g., "₹80,000").
 */
export function formatCurrencyFromMinor(
  minorAmount: number,
  currency: CurrencyCode = "INR",
  showDecimals = false
): string {
  const major = toMajorUnits(minorAmount);
  const locale = CURRENCY_LOCALES[currency] || "en-IN";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: showDecimals ? 2 : major % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(major);
}

/**
 * Formats major units for UI display.
 */
export function formatCurrency(
  majorAmount: number,
  currency: CurrencyCode = "INR"
): string {
  return formatCurrencyFromMinor(toMinorUnits(majorAmount), currency);
}

