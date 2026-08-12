import type { ChangePayload, ChangeRequest } from "./change-request";
import type { Actor, RiskLevel, Role } from "./shared";
import { assertNever } from "./shared";

export const FINANCE_APPROVAL_THRESHOLD_CENTS = 500_00;
export const MAX_PRODUCTION_ROLLOUT_INCREASE = 25;

export interface PolicyEvaluation {
  matchedPolicyIds: readonly string[];
  riskLevel: RiskLevel;
  requiredApproverRole: Role;
}

export type PolicyDecision =
  | { kind: "accepted"; evaluation: PolicyEvaluation }
  | { kind: "blocked"; policyId: string; message: string };

/**
 * Evaluates submission policy for a proposed change. Risk level for refunds
 * and KYC comes from the underlying case; flags derive risk from the change.
 */
export function evaluateSubmission(
  payload: ChangePayload,
  targetRiskLevel: RiskLevel,
): PolicyDecision {
  switch (payload.domain) {
    case "refund": {
      const matched: string[] = [];
      if (payload.amount.amountCents > payload.chargeAmount.amountCents) {
        return {
          kind: "blocked",
          policyId: "refund.amount_exceeds_charge",
          message: "A refund cannot exceed the original charge amount.",
        };
      }
      matched.push(
        payload.amount.amountCents > FINANCE_APPROVAL_THRESHOLD_CENTS
          ? "refund.finance_approval_over_500"
          : "refund.finance_approval",
      );
      return {
        kind: "accepted",
        evaluation: {
          matchedPolicyIds: matched,
          riskLevel: targetRiskLevel,
          requiredApproverRole: "finance_approver",
        },
      };
    }
    case "kyc": {
      const matched =
        targetRiskLevel === "high"
          ? ["kyc.high_risk_compliance_approval"]
          : ["kyc.compliance_approval"];
      return {
        kind: "accepted",
        evaluation: {
          matchedPolicyIds: matched,
          riskLevel: targetRiskLevel,
          requiredApproverRole: "compliance_approver",
        },
      };
    }
    case "feature_flag": {
      const increase =
        payload.proposedRolloutPercent - payload.currentRolloutPercent;
      if (payload.environment === "production") {
        if (increase > MAX_PRODUCTION_ROLLOUT_INCREASE) {
          return {
            kind: "blocked",
            policyId: "flag.production_increase_limit",
            message: `A production rollout cannot increase by more than ${MAX_PRODUCTION_ROLLOUT_INCREASE} percentage points in one change.`,
          };
        }
        return {
          kind: "accepted",
          evaluation: {
            matchedPolicyIds: ["flag.production_release_approval"],
            riskLevel: increase > 0 ? "medium" : "low",
            requiredApproverRole: "release_approver",
          },
        };
      }
      return {
        kind: "accepted",
        evaluation: {
          matchedPolicyIds: ["flag.staging_release_approval"],
          riskLevel: "low",
          requiredApproverRole: "release_approver",
        },
      };
    }
    default:
      return assertNever(payload);
  }
}

export type ApprovalDecision =
  | { kind: "allowed" }
  | { kind: "blocked"; policyId: string; message: string };

export function evaluateApproval(
  request: ChangeRequest,
  approver: Actor,
): ApprovalDecision {
  if (!approver.roles.includes(request.requiredApproverRole)) {
    return {
      kind: "blocked",
      policyId: "approval.required_role",
      message: `This request requires approval from a ${request.requiredApproverRole.replace("_", " ")}.`,
    };
  }
  if (approver.id === request.requesterId) {
    return {
      kind: "blocked",
      policyId: "approval.separation_of_duties",
      message: "A requester cannot approve their own request.",
    };
  }
  return { kind: "allowed" };
}
