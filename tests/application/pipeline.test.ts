import { beforeEach, describe, expect, it } from "vitest";
import type { CommandContext } from "@/application/command-pipeline";
import { dispatchCommand } from "@/application/command-pipeline";
import type { PaymentProvider } from "@/application/ports";
import type { Actor } from "@/domain/shared";
import type { Container } from "@/infrastructure/container";
import { buildContainer } from "@/infrastructure/container";

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
const alex: Actor = {
  id: "usr_alex",
  name: "Alex Morgan",
  title: "Release Manager",
  roles: ["release_approver"],
};

let container: Container;
let ctx: CommandContext;

beforeEach(() => {
  container = buildContainer(":memory:");
  container.reset();
  ctx = container.context;
});

function submitRefund(amountCents = 125_000) {
  return dispatchCommand(ctx, maya, {
    kind: "submit_refund",
    refundCaseId: "rfc_001",
    amountCents,
    reason: "Chargeback settled in the customer's favour",
  });
}

function requestIdOf(result: ReturnType<typeof submitRefund>): string {
  if (!result.ok || result.value.kind !== "submitted") {
    throw new Error(`Expected submission, got ${JSON.stringify(result)}`);
  }
  return result.value.requestId;
}

describe("validation", () => {
  it("rejects an empty reason", () => {
    const result = dispatchCommand(ctx, maya, {
      kind: "submit_refund",
      refundCaseId: "rfc_001",
      amountCents: 125_000,
      reason: "   ",
    });
    expect(result).toEqual({
      ok: false,
      error: {
        kind: "validation",
        issues: ["A reason is required for this action."],
      },
    });
    expect(ctx.changeRequests.list()).toHaveLength(0);
  });

  it("rejects malformed commands", () => {
    const result = dispatchCommand(ctx, maya, {
      kind: "submit_refund",
      amountCents: "not-a-number",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("validation");
    }
  });

  it("rejects unknown command kinds", () => {
    const result = dispatchCommand(ctx, maya, { kind: "drop_tables" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("validation");
    }
  });
});

describe("authorization", () => {
  it("cannot be bypassed through client input: submission requires the operations role", () => {
    const result = dispatchCommand(ctx, theo, {
      kind: "submit_refund",
      refundCaseId: "rfc_001",
      amountCents: 10_000,
      reason: "Attempting to submit without operations role",
    });
    expect(result).toEqual({
      ok: false,
      error: {
        kind: "authorization",
        message: "Only operations team members can submit requests.",
      },
    });
  });

  it("blocks approval by an actor without the required role and records the attempt", () => {
    const requestId = requestIdOf(submitRefund());
    const result = dispatchCommand(ctx, priya, {
      kind: "approve_request",
      requestId,
      expectedVersion: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("policy_blocked");
    }
    const blocked = ctx.events.list({ outcome: "blocked" });
    expect(blocked).toHaveLength(1);
    expect(ctx.changeRequests.getById(requestId)?.state).toBe("pending");
  });
});

describe("separation of duties", () => {
  it("blocks self-approval independently of role denial and keeps the request pending", () => {
    const requestId = requestIdOf(submitRefund());
    const result = dispatchCommand(ctx, maya, {
      kind: "approve_request",
      requestId,
      expectedVersion: 0,
    });
    expect(result).toEqual({
      ok: false,
      error: {
        kind: "policy_blocked",
        policyId: "approval.separation_of_duties",
        message: "A requester cannot approve their own request.",
      },
    });
    const request = ctx.changeRequests.getById(requestId);
    expect(request?.state).toBe("pending");
    expect(request?.version).toBe(0);
    const blocked = ctx.events.list({ outcome: "blocked" });
    expect(blocked).toHaveLength(1);
    expect(blocked[0]?.actorId).toBe("usr_maya");
  });
});

describe("refund journey", () => {
  it("submits, blocks self-approval, approves by Theo, executes once, and replays idempotently", () => {
    const requestId = requestIdOf(submitRefund());

    const selfApproval = dispatchCommand(ctx, maya, {
      kind: "approve_request",
      requestId,
      expectedVersion: 0,
    });
    expect(selfApproval.ok).toBe(false);

    const approval = dispatchCommand(ctx, theo, {
      kind: "approve_request",
      requestId,
      expectedVersion: 0,
    });
    expect(approval.ok).toBe(true);
    expect(ctx.changeRequests.getById(requestId)?.approvedByName).toBe(
      "Theo Grant",
    );

    const execution = dispatchCommand(ctx, maya, {
      kind: "execute_request",
      requestId,
    });
    expect(execution.ok).toBe(true);
    if (execution.ok && execution.value.kind === "executed") {
      const replay = dispatchCommand(ctx, maya, {
        kind: "execute_request",
        requestId,
      });
      expect(replay.ok).toBe(true);
      if (replay.ok) {
        expect(replay.value.kind).toBe("idempotent_replay");
        if (replay.value.kind === "idempotent_replay") {
          expect(replay.value.providerReference).toBe(
            execution.value.providerReference,
          );
        }
      }
    }

    const record = ctx.providerExecutions.getByRequestId(requestId);
    expect(record?.status).toBe("succeeded");
    expect(record?.idempotencyKey).not.toBe(requestId);

    const types = ctx.events
      .list({ requestId })
      .map((event) => event.type)
      .sort();
    expect(types).toEqual(
      [
        "attempt_blocked",
        "execution_replayed",
        "execution_started",
        "execution_succeeded",
        "request_approved",
        "request_submitted",
      ].sort(),
    );
  });

  it("uses an idempotency key distinct from request and correlation IDs", () => {
    const requestId = requestIdOf(submitRefund());
    dispatchCommand(ctx, theo, {
      kind: "approve_request",
      requestId,
      expectedVersion: 0,
    });
    dispatchCommand(ctx, maya, { kind: "execute_request", requestId });
    const request = ctx.changeRequests.getById(requestId);
    const record = ctx.providerExecutions.getByRequestId(requestId);
    expect(record?.idempotencyKey).toBeTruthy();
    expect(record?.idempotencyKey).not.toBe(requestId);
    expect(record?.idempotencyKey).not.toBe(request?.correlationId);
  });
});

describe("optimistic concurrency", () => {
  it("rejects a stale approval after the request has changed", () => {
    const requestId = requestIdOf(submitRefund());
    const first = dispatchCommand(ctx, theo, {
      kind: "approve_request",
      requestId,
      expectedVersion: 0,
    });
    expect(first.ok).toBe(true);
    const stale = dispatchCommand(ctx, theo, {
      kind: "approve_request",
      requestId,
      expectedVersion: 0,
    });
    expect(stale.ok).toBe(false);
    if (!stale.ok) {
      expect(stale.error.kind).toBe("invalid_transition");
    }
  });

  it("rejects an approval with a stale version even while pending", () => {
    const requestId = requestIdOf(submitRefund());
    const result = dispatchCommand(ctx, theo, {
      kind: "approve_request",
      requestId,
      expectedVersion: 5,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("conflict");
    }
    expect(ctx.changeRequests.getById(requestId)?.state).toBe("pending");
  });
});

describe("provider failure and retry", () => {
  it("marks the request failed, records the event, and allows a safe retry", () => {
    let calls = 0;
    const flaky: PaymentProvider = {
      refund(input) {
        calls += 1;
        if (calls === 1) {
          return { kind: "failed", detail: "Provider timeout" };
        }
        return {
          kind: "succeeded",
          providerReference: `pay_ref_retry_${input.idempotencyKey}`,
          detail: "ok",
        };
      },
    };
    ctx = { ...ctx, paymentProvider: flaky };

    const requestId = requestIdOf(submitRefund());
    dispatchCommand(ctx, theo, {
      kind: "approve_request",
      requestId,
      expectedVersion: 0,
    });

    const failure = dispatchCommand(ctx, maya, {
      kind: "execute_request",
      requestId,
    });
    expect(failure.ok).toBe(false);
    if (!failure.ok) {
      expect(failure.error).toEqual({
        kind: "provider_failure",
        message: "Provider timeout",
      });
    }
    expect(ctx.changeRequests.getById(requestId)?.state).toBe("failed");
    expect(ctx.events.list({ requestId, types: ["execution_failed"] })).toHaveLength(1);

    const firstKey =
      ctx.providerExecutions.getByRequestId(requestId)?.idempotencyKey;
    const retry = dispatchCommand(ctx, maya, {
      kind: "execute_request",
      requestId,
    });
    expect(retry.ok).toBe(true);
    expect(ctx.changeRequests.getById(requestId)?.state).toBe("executed");
    expect(
      ctx.providerExecutions.getByRequestId(requestId)?.idempotencyKey,
    ).toBe(firstKey);
    expect(calls).toBe(2);
  });
});

describe("KYC workflow through the shared path", () => {
  it("routes a high-risk decision to compliance and applies it on execution", () => {
    const submission = dispatchCommand(ctx, maya, {
      kind: "submit_kyc_decision",
      kycCaseId: "kyc_001",
      decision: "approve",
      reason: "Watchlist match reviewed; documents verified in person",
    });
    const requestId = requestIdOf(submission);
    const request = ctx.changeRequests.getById(requestId);
    expect(request?.requiredApproverRole).toBe("compliance_approver");
    expect(request?.riskLevel).toBe("high");

    const wrongApprover = dispatchCommand(ctx, theo, {
      kind: "approve_request",
      requestId,
      expectedVersion: 0,
    });
    expect(wrongApprover.ok).toBe(false);

    const approval = dispatchCommand(ctx, priya, {
      kind: "approve_request",
      requestId,
      expectedVersion: 0,
    });
    expect(approval.ok).toBe(true);

    const execution = dispatchCommand(ctx, priya, {
      kind: "execute_request",
      requestId,
    });
    expect(execution.ok).toBe(true);
    expect(ctx.kycCases.getById("kyc_001")?.state).toBe("approved");
  });
});

describe("feature-flag workflow through the shared path", () => {
  it("blocks 10% → 100% in production and records the blocked attempt", () => {
    const result = dispatchCommand(ctx, maya, {
      kind: "submit_flag_change",
      flagId: "flg_001",
      environment: "production",
      proposedRolloutPercent: 100,
      reason: "Full rollout of instant payouts",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("policy_blocked");
    }
    expect(ctx.changeRequests.list()).toHaveLength(0);
    expect(ctx.events.list({ outcome: "blocked" })).toHaveLength(1);
  });

  it("accepts 10% → 35%, routes to the release manager, and applies on execution", () => {
    const submission = dispatchCommand(ctx, maya, {
      kind: "submit_flag_change",
      flagId: "flg_001",
      environment: "production",
      proposedRolloutPercent: 35,
      reason: "Gradual rollout of instant payouts",
    });
    const requestId = requestIdOf(submission);
    expect(ctx.changeRequests.getById(requestId)?.requiredApproverRole).toBe(
      "release_approver",
    );

    const approval = dispatchCommand(ctx, alex, {
      kind: "approve_request",
      requestId,
      expectedVersion: 0,
    });
    expect(approval.ok).toBe(true);

    const execution = dispatchCommand(ctx, alex, {
      kind: "execute_request",
      requestId,
    });
    expect(execution.ok).toBe(true);
    expect(ctx.featureFlags.getById("flg_001")?.rolloutPercent).toBe(35);
  });
});

describe("rejection", () => {
  it("lets the required approver reject with a reason", () => {
    const requestId = requestIdOf(submitRefund());
    const result = dispatchCommand(ctx, theo, {
      kind: "reject_request",
      requestId,
      expectedVersion: 0,
      reason: "Insufficient supporting evidence",
    });
    expect(result.ok).toBe(true);
    expect(ctx.changeRequests.getById(requestId)?.state).toBe("rejected");
    expect(ctx.events.list({ requestId, types: ["request_rejected"] })).toHaveLength(1);
  });
});

describe("reseeding", () => {
  it("restores the deterministic starting state", () => {
    const requestId = requestIdOf(submitRefund());
    dispatchCommand(ctx, theo, {
      kind: "approve_request",
      requestId,
      expectedVersion: 0,
    });
    container.reset();
    expect(ctx.changeRequests.list()).toHaveLength(0);
    expect(ctx.events.list()).toHaveLength(0);
    expect(ctx.refundCases.list()).toHaveLength(4);
    expect(ctx.kycCases.getById("kyc_001")?.state).toBe("pending_review");
    expect(ctx.featureFlags.getById("flg_001")?.rolloutPercent).toBe(10);
  });
});
