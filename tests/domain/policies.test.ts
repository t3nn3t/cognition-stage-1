import { describe, expect, it } from "vitest";
import type { ChangeRequest } from "@/domain/change-request";
import { canTransition } from "@/domain/change-request";
import { evaluateApproval, evaluateSubmission } from "@/domain/policies";
import type { Actor } from "@/domain/shared";

const maya: Actor = {
  id: "usr_maya",
  name: "Maya Chen",
  title: "Finance Operations Lead",
  roles: ["operations", "finance_approver"],
};

const theo: Actor = {
  id: "usr_theo",
  name: "Theo Grant",
  title: "Finance Approver",
  roles: ["finance_approver"],
};

const priya: Actor = {
  id: "usr_priya",
  name: "Priya Shah",
  title: "Compliance Officer",
  roles: ["compliance_approver"],
};

function refundPayload(amountCents: number) {
  return {
    domain: "refund",
    refundCaseId: "rfc_001",
    orderId: "ORD-1",
    customerName: "Customer",
    amount: { amountCents, currency: "USD" },
    chargeAmount: { amountCents: 200_000, currency: "USD" },
  } as const;
}

describe("evaluateSubmission — refunds", () => {
  it("routes refunds above $500 to a finance approver with the threshold policy", () => {
    const decision = evaluateSubmission(refundPayload(125_000), "high");
    expect(decision.kind).toBe("accepted");
    if (decision.kind === "accepted") {
      expect(decision.evaluation.requiredApproverRole).toBe("finance_approver");
      expect(decision.evaluation.matchedPolicyIds).toContain(
        "refund.finance_approval_over_500",
      );
      expect(decision.evaluation.riskLevel).toBe("high");
    }
  });

  it("still requires finance approval below $500", () => {
    const decision = evaluateSubmission(refundPayload(10_000), "low");
    expect(decision.kind).toBe("accepted");
    if (decision.kind === "accepted") {
      expect(decision.evaluation.requiredApproverRole).toBe("finance_approver");
    }
  });

  it("blocks refunds above the original charge", () => {
    const decision = evaluateSubmission(refundPayload(250_000), "low");
    expect(decision).toEqual({
      kind: "blocked",
      policyId: "refund.amount_exceeds_charge",
      message: "A refund cannot exceed the original charge amount.",
    });
  });
});

describe("evaluateSubmission — KYC", () => {
  it("routes high-risk decisions to compliance with the high-risk policy", () => {
    const decision = evaluateSubmission(
      {
        domain: "kyc",
        kycCaseId: "kyc_001",
        customerName: "Customer",
        decision: "approve",
        previousState: "pending_review",
      },
      "high",
    );
    expect(decision.kind).toBe("accepted");
    if (decision.kind === "accepted") {
      expect(decision.evaluation.requiredApproverRole).toBe(
        "compliance_approver",
      );
      expect(decision.evaluation.matchedPolicyIds).toContain(
        "kyc.high_risk_compliance_approval",
      );
    }
  });
});

describe("evaluateSubmission — feature flags", () => {
  function flagPayload(
    current: number,
    proposed: number,
    environment: "production" | "staging" = "production",
  ) {
    return {
      domain: "feature_flag",
      flagId: "flg_001",
      flagKey: "instant-payouts",
      environment,
      currentRolloutPercent: current,
      proposedRolloutPercent: proposed,
    } as const;
  }

  it("routes any production increase to the release approver", () => {
    const decision = evaluateSubmission(flagPayload(10, 100), "low");
    expect(decision.kind).toBe("accepted");
    if (decision.kind === "accepted") {
      expect(decision.evaluation.requiredApproverRole).toBe("release_approver");
      expect(decision.evaluation.riskLevel).toBe("medium");
    }
  });

  it("allows production decreases of any size", () => {
    const decision = evaluateSubmission(flagPayload(100, 0), "low");
    expect(decision.kind).toBe("accepted");
  });

  it("treats staging changes as low risk", () => {
    const decision = evaluateSubmission(flagPayload(0, 100, "staging"), "low");
    expect(decision.kind).toBe("accepted");
    if (decision.kind === "accepted") {
      expect(decision.evaluation.riskLevel).toBe("low");
    }
  });
});

describe("evaluateApproval", () => {
  function pendingRequest(overrides: Partial<ChangeRequest>): ChangeRequest {
    return {
      id: "req_1",
      correlationId: "cor_1",
      domain: "refund",
      payload: refundPayload(125_000),
      requesterId: "usr_maya",
      requesterName: "Maya Chen",
      requesterRoles: ["operations", "finance_approver"],
      reason: "Customer chargeback settled",
      riskLevel: "high",
      matchedPolicyIds: ["refund.finance_approval_over_500"],
      requiredApproverRole: "finance_approver",
      state: "pending",
      approvedById: null,
      approvedByName: null,
      approvedAt: null,
      executedAt: null,
      failureReason: null,
      version: 0,
      createdAt: "2026-08-10T00:00:00.000Z",
      updatedAt: "2026-08-10T00:00:00.000Z",
      ...overrides,
    };
  }

  it("blocks self-approval even when the requester holds the approver role", () => {
    const decision = evaluateApproval(pendingRequest({}), maya);
    expect(decision).toEqual({
      kind: "blocked",
      policyId: "approval.separation_of_duties",
      message: "A requester cannot approve their own request.",
    });
  });

  it("blocks approvers without the required role", () => {
    const decision = evaluateApproval(pendingRequest({}), priya);
    expect(decision.kind).toBe("blocked");
    if (decision.kind === "blocked") {
      expect(decision.policyId).toBe("approval.required_role");
    }
  });

  it("allows a different holder of the required role", () => {
    const decision = evaluateApproval(pendingRequest({}), theo);
    expect(decision).toEqual({ kind: "allowed" });
  });
});

describe("lifecycle transitions", () => {
  it("permits only valid transitions", () => {
    expect(canTransition("pending", "approved")).toBe(true);
    expect(canTransition("pending", "rejected")).toBe(true);
    expect(canTransition("approved", "executing")).toBe(true);
    expect(canTransition("executing", "executed")).toBe(true);
    expect(canTransition("executing", "failed")).toBe(true);
    expect(canTransition("failed", "executing")).toBe(true);
  });

  it("rejects invalid transitions", () => {
    expect(canTransition("pending", "executed")).toBe(false);
    expect(canTransition("executed", "pending")).toBe(false);
    expect(canTransition("rejected", "approved")).toBe(false);
    expect(canTransition("executed", "executing")).toBe(false);
  });
});
