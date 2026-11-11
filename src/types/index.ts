export type UserRole = "USER" | "ADMIN";
export type AccountStatus = "ACTIVE" | "SUSPENDED" | "DISABLED";
export type CurrencyCode = "INR" | "USD" | "EUR" | "GBP";
export type PolicyPreset = "RELAXED" | "BALANCED" | "STRICT" | "CUSTOM";

export type FirewallDecision =
  | "AUTO_APPROVED"
  | "REQUIRES_APPROVAL"
  | "BLOCKED";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type RiskRecommendation = "ALLOW" | "REVIEW" | "BLOCK";

export type ApprovalStatus =
  | "NOT_REQUIRED"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED";

export type TransactionState =
  | "PROPOSED"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "BLOCKED"
  | "PAYPAL_ORDER_CREATED"
  | "CUSTOMER_CHECKOUT_APPROVED"
  | "CAPTURE_PENDING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED";

export interface RiskAssessmentResult {
  riskLevel: RiskLevel;
  riskScore: number; // 0 to 100
  reasons: string[];
  recommendation: RiskRecommendation;
  flags?: string[];
}

export interface PolicyEvaluationResult {
  decision: FirewallDecision;
  allowed: boolean;
  requiresApproval: boolean;
  blocked: boolean;
  reasons: string[];
  violatedRules: string[];
  policyVersion: number;
  dailySpentMinor: number;
  weeklySpentMinor: number;
  monthlySpentMinor: number;
}

export interface ProductProposalItem {
  id: string;
  name: string;
  category: string;
  merchant: string;
  merchantDomain: string;
  priceMajor: number;
  priceMinor: number;
  currency: CurrencyCode;
  specs: string[];
  rating: number;
  stockStatus: "IN_STOCK" | "LOW_STOCK";
  isSampleData: boolean;
  matchScore: number;
  summary: string;
}

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  preferredCurrency: CurrencyCode;
  onboardingCompleted: boolean;
  iat?: number;
  exp?: number;
}

