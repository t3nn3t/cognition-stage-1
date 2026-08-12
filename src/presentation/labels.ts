import type { LifecycleState } from "@/domain/change-request";
import type { ActivityEventOutcome, ActivityEventType } from "@/domain/events";
import type { RiskLevel, Role, WorkflowDomain } from "@/domain/shared";
import type { KycDecision, KycState } from "@/domain/targets";

export const LIFECYCLE_LABELS: Record<LifecycleState, string> = {
  pending: "Pending approval",
  approved: "Approved",
  executing: "Executing",
  executed: "Executed",
  rejected: "Rejected",
  failed: "Failed",
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  low: "Low risk",
  medium: "Medium risk",
  high: "High risk",
};

export const DOMAIN_LABELS: Record<WorkflowDomain, string> = {
  refund: "Refunds",
  kyc: "KYC",
  feature_flag: "Feature flags",
};

export const ROLE_LABELS: Record<Role, string> = {
  operations: "Operations",
  finance_approver: "Finance",
  compliance_approver: "Compliance",
  release_approver: "Release Approver",
};

export const EVENT_TYPE_LABELS: Record<ActivityEventType, string> = {
  request_submitted: "Request submitted",
  attempt_blocked: "Attempt blocked",
  request_approved: "Request approved",
  request_rejected: "Request rejected",
  execution_started: "Execution started",
  execution_succeeded: "Execution completed",
  execution_failed: "Execution failed",
  execution_replayed: "Execution replayed",
};

export const OUTCOME_LABELS: Record<ActivityEventOutcome, string> = {
  allowed: "Allowed",
  blocked: "Blocked",
  failed: "Failed",
};

export const KYC_STATE_LABELS: Record<KycState, string> = {
  pending_review: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
  escalated: "Escalated",
};

export const KYC_DECISION_LABELS: Record<KycDecision, string> = {
  approve: "Approve",
  reject: "Reject",
  escalate: "Escalate",
};
