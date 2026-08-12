export function assertNever(value: never): never {
  throw new Error(`Unhandled variant: ${JSON.stringify(value)}`);
}

export const ROLES = [
  "operations",
  "finance_approver",
  "compliance_approver",
  "release_approver",
] as const;
export type Role = (typeof ROLES)[number];

export const DOMAINS = ["refund", "kyc", "feature_flag"] as const;
export type WorkflowDomain = (typeof DOMAINS)[number];

export const RISK_LEVELS = ["low", "medium", "high"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export interface Actor {
  id: string;
  name: string;
  title: string;
  roles: readonly Role[];
}
