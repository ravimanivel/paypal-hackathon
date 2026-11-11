import { z } from "zod";

export const PASSWORD_RULES = {
  minLength: 8,
  maxLength: 128,
  hasUppercase: /[A-Z]/,
  hasLowercase: /[a-z]/,
  hasNumber: /[0-9]/,
  hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/,
};

export interface PasswordCheckResult {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  validMaxLength: boolean;
  score: number; // 0 to 5
  strengthLabel: "Too Short" | "Weak" | "Fair" | "Good" | "Strong";
  isValid: boolean;
}

export function evaluatePasswordStrength(password: string): PasswordCheckResult {
  const minLength = password.length >= PASSWORD_RULES.minLength;
  const validMaxLength = password.length <= PASSWORD_RULES.maxLength;
  const hasUppercase = PASSWORD_RULES.hasUppercase.test(password);
  const hasLowercase = PASSWORD_RULES.hasLowercase.test(password);
  const hasNumber = PASSWORD_RULES.hasNumber.test(password);
  const hasSpecial = PASSWORD_RULES.hasSpecial.test(password);

  const checks = [minLength, hasUppercase, hasLowercase, hasNumber, hasSpecial];
  const score = checks.filter(Boolean).length;

  let strengthLabel: PasswordCheckResult["strengthLabel"] = "Too Short";
  if (password.length > 0) {
    if (score <= 2) strengthLabel = "Weak";
    else if (score === 3) strengthLabel = "Fair";
    else if (score === 4) strengthLabel = "Good";
    else if (score === 5 && validMaxLength) strengthLabel = "Strong";
  }

  return {
    minLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSpecial,
    validMaxLength,
    score,
    strengthLabel,
    isValid: score === 5 && validMaxLength,
  };
}

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .max(128, "Password must not exceed 128 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(
    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/,
    "Password must contain at least one special character"
  );

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Please enter a valid email address")
  .max(254, "Email address is too long");

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Full name must be at least 2 characters")
      .max(100, "Full name must not exceed 100 characters"),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: "You must accept the terms and conditions" }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Password and confirm password do not match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required").max(128, "Invalid input"),
  rememberMe: z.boolean().optional().default(false),
});

export const onboardingSchema = z.object({
  preferredCurrency: z.enum(["INR", "USD", "EUR", "GBP"]).default("INR"),
  preset: z
    .enum(["RELAXED", "BALANCED", "STRICT", "CUSTOM"])
    .default("BALANCED"),
  connectPayPal: z.boolean().optional().default(false),
  paypalSandboxPayerEmail: z.string().email().optional().or(z.literal("")),
  customPolicy: z
    .object({
      maxTransactionAmountMajor: z.number().positive(),
      dailyLimitMajor: z.number().positive(),
      weeklyLimitMajor: z.number().positive(),
      monthlyLimitMajor: z.number().positive(),
      autoApprovalThresholdMajor: z.number().min(0),
      manualApprovalThresholdMajor: z.number().min(0),
      requireTrustedMerchantForAuto: z.boolean().default(true),
      duplicateProtection: z.boolean().default(true),
      autoApprovalEnabled: z.boolean().default(true),
    })
    .optional(),
});

export const policyInputSchema = z
  .object({
    preset: z.enum(["RELAXED", "BALANCED", "STRICT", "CUSTOM"]).optional(),
    currency: z.enum(["INR", "USD", "EUR", "GBP"]),
    maxTransactionAmountMajor: z.number().positive("Max transaction must be positive"),
    dailyLimitMajor: z.number().positive("Daily limit must be positive"),
    weeklyLimitMajor: z.number().positive("Weekly limit must be positive"),
    monthlyLimitMajor: z.number().positive("Monthly limit must be positive"),
    autoApprovalThresholdMajor: z.number().min(0, "Threshold cannot be negative"),
    manualApprovalThresholdMajor: z.number().min(0, "Threshold cannot be negative"),
    trustedMerchants: z.array(z.string().trim().min(1)).default([]),
    blockedMerchants: z.array(z.string().trim().min(1)).default([]),
    requireTrustedMerchantForAuto: z.boolean().default(true),
    duplicateProtection: z.boolean().default(true),
    duplicateWindowMinutes: z.number().int().min(1).max(1440).default(30),
    autoApprovalEnabled: z.boolean().default(true),
  })
  .refine((d) => d.dailyLimitMajor >= d.maxTransactionAmountMajor, {
    message: "Daily spending limit must be at least the maximum single transaction amount",
    path: ["dailyLimitMajor"],
  })
  .refine((d) => d.weeklyLimitMajor >= d.dailyLimitMajor, {
    message: "Weekly spending limit must be at least the daily spending limit",
    path: ["weeklyLimitMajor"],
  })
  .refine((d) => d.monthlyLimitMajor >= d.weeklyLimitMajor, {
    message: "Monthly spending limit must be at least the weekly spending limit",
    path: ["monthlyLimitMajor"],
  })
  .refine((d) => d.manualApprovalThresholdMajor >= d.autoApprovalThresholdMajor, {
    message: "Manual approval threshold must be greater than or equal to automatic approval threshold",
    path: ["manualApprovalThresholdMajor"],
  });

export const evaluateTransactionSchema = z.object({
  proposalId: z.string().trim().min(3).max(120),
  agentId: z.string().optional(),
  agentName: z.string().trim().max(100).optional(),
  product: z.object({
    name: z.string().trim().min(2).max(200),
    category: z.string().trim().max(80).default("Electronics"),
    description: z.string().trim().max(1000).optional(),
    specs: z.array(z.string()).optional(),
    isSampleData: z.boolean().default(true),
  }),
  merchant: z.object({
    name: z.string().trim().min(2).max(120),
    domain: z.string().trim().max(120).optional(),
    category: z.string().trim().max(80).optional(),
  }),
  amountMajor: z.number().positive("Transaction amount must be greater than zero"),
  currency: z.enum(["INR", "USD", "EUR", "GBP"]),
  idempotencyKey: z.string().trim().min(6).max(160).optional(),
  userPromptContext: z.string().max(1000).optional(),
});

export const riskAssessmentOutputSchema = z.object({
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  riskScore: z.number().int().min(0).max(100),
  reasons: z.array(z.string()).min(1),
  recommendation: z.enum(["ALLOW", "REVIEW", "BLOCK"]),
});

