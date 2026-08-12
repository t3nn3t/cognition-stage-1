import type { RiskLevel, Role, WorkflowDomain } from "./shared";
import type { FlagEnvironment, KycDecision, Money } from "./targets";

export const LIFECYCLE_STATES = [
  "pending",
  "approved",
  "executing",
  "executed",
  "rejected",
  "failed",
] as const;
export type LifecycleState = (typeof LIFECYCLE_STATES)[number];

export type ChangePayload =
  | {
      domain: "refund";
      refundCaseId: string;
      orderId: string;
      customerName: string;
      amount: Money;
      chargeAmount: Money;
    }
  | {
      domain: "kyc";
      kycCaseId: string;
      customerName: string;
      decision: KycDecision;
      previousState: string;
    }
  | {
      domain: "feature_flag";
      flagId: string;
      flagKey: string;
      environment: FlagEnvironment;
      currentRolloutPercent: number;
      proposedRolloutPercent: number;
    };

export interface ChangeRequest {
  id: string;
  correlationId: string;
  domain: WorkflowDomain;
  payload: ChangePayload;
  requesterId: string;
  requesterName: string;
  requesterRoles: readonly Role[];
  reason: string;
  riskLevel: RiskLevel;
  matchedPolicyIds: readonly string[];
  requiredApproverRole: Role;
  state: LifecycleState;
  approvedById: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  executedAt: string | null;
  failureReason: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

const TRANSITIONS: Record<LifecycleState, readonly LifecycleState[]> = {
  pending: ["approved", "rejected"],
  approved: ["executing"],
  executing: ["executed", "failed"],
  executed: [],
  rejected: [],
  failed: ["executing"],
};

export function canTransition(
  from: LifecycleState,
  to: LifecycleState,
): boolean {
  return TRANSITIONS[from].includes(to);
}
