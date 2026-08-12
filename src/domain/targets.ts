import type { RiskLevel } from "./shared";

/** Money is always integer minor units (cents), USD. */
export interface Money {
  amountCents: number;
  currency: "USD";
}

export interface RefundCase {
  id: string;
  orderId: string;
  customerName: string;
  customerEmail: string;
  chargeAmount: Money;
  chargedAt: string;
  paymentMethod: string;
  riskSignals: readonly string[];
  riskLevel: RiskLevel;
}

export const KYC_STATES = [
  "pending_review",
  "approved",
  "rejected",
  "escalated",
] as const;
export type KycState = (typeof KYC_STATES)[number];

export const KYC_DECISIONS = ["approve", "reject", "escalate"] as const;
export type KycDecision = (typeof KYC_DECISIONS)[number];

export interface KycEvidenceItem {
  label: string;
  value: string;
  masked: boolean;
}

export interface KycCase {
  id: string;
  customerName: string;
  customerEmail: string;
  reviewTrigger: string;
  riskLevel: RiskLevel;
  riskRationale: string;
  state: KycState;
  evidence: readonly KycEvidenceItem[];
  openedAt: string;
}

export const FLAG_ENVIRONMENTS = ["staging", "production"] as const;
export type FlagEnvironment = (typeof FLAG_ENVIRONMENTS)[number];

export interface FeatureFlag {
  id: string;
  key: string;
  description: string;
  environment: FlagEnvironment;
  rolloutPercent: number;
  ownerTeam: string;
  enabled: boolean;
  lastChangedAt: string | null;
}
