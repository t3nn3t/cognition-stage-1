import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { CommandContext } from "@/application/command-pipeline";
import { dispatchCommand } from "@/application/command-pipeline";
import type { PaymentProvider } from "@/application/ports";
import type { CommandResult } from "@/application/results";
import type { Actor } from "@/domain/shared";
import type { Container } from "@/infrastructure/container";
import { buildContainer } from "@/infrastructure/container";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://ops:ops@localhost:5432/ops_test";

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

beforeAll(async () => {
  container = await buildContainer(TEST_DATABASE_URL);
});

afterAll(async () => {
  await container.db.close();
});

beforeEach(async () => {
  await container.reset();
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

function requestIdOf(result: CommandResult): string {
  if (!result.ok || result.value.kind !== "submitted") {
    throw new Error(`Expected submission, got ${JSON.stringify(result)}`);
  }
  return result.value.requestId;
}

describe("validation", () => {
  it("rejects an empty reason on a KYC decision", async () => {
    const result = await dispatchCommand(ctx, maya, {
      kind: "submit_kyc_decision",
      kycCaseId: "kyc_001",
      decision: "approve",
      reason: "   ",
    });
    expect(result).toEqual({
      ok: false,
      error: {
        kind: "validation",
        issues: ["A reason is required for this action."],
      },
    });
    expect(await ctx.changeRequests.list()).toHaveLength(0);
  });

  it("rejects malformed commands", async () => {
    const result = await dispatchCommand(ctx, maya, {
      kind: "submit_refund",
      amountCents: "not-a-number",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("validation");
    }
  });

  it("rejects unknown command kinds", async () => {
    const result = await dispatchCommand(ctx, maya, { kind: "drop_tables" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("validation");
    }
  });
});

describe("authorization", () => {
  it("cannot be bypassed through client input: submission requires the operations role", async () => {
    const result = await dispatchCommand(ctx, theo, {
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

  it("blocks approval by an actor without the required role and records the attempt", async () => {
    const requestId = requestIdOf(await submitRefund());
    const result = await dispatchCommand(ctx, priya, {
      kind: "approve_request",
      requestId,
      expectedVersion: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("policy_blocked");
    }
    const blocked = await ctx.events.list({ outcome: "blocked" });
    expect(blocked).toHaveLength(1);
    expect((await ctx.changeRequests.getById(requestId))?.state).toBe(
      "pending",
    );
  });
});

describe("separation of duties", () => {
  it("blocks self-approval independently of role denial and keeps the request pending", async () => {
    const requestId = requestIdOf(await submitRefund());
    const result = await dispatchCommand(ctx, maya, {
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
    const request = await ctx.changeRequests.getById(requestId);
    expect(request?.state).toBe("pending");
    expect(request?.version).toBe(0);
    const blocked = await ctx.events.list({ outcome: "blocked" });
    expect(blocked).toHaveLength(1);
    expect(blocked[0]?.actorId).toBe("usr_maya");
  });
});

describe("refund journey", () => {
  it("submits, blocks self-approval, approves by Theo, executes once, and replays idempotently", async () => {
    const requestId = requestIdOf(await submitRefund());

    const selfApproval = await dispatchCommand(ctx, maya, {
      kind: "approve_request",
      requestId,
      expectedVersion: 0,
    });
    expect(selfApproval.ok).toBe(false);

    const approval = await dispatchCommand(ctx, theo, {
      kind: "approve_request",
      requestId,
      expectedVersion: 0,
    });
    expect(approval.ok).toBe(true);
    expect((await ctx.changeRequests.getById(requestId))?.approvedByName).toBe(
      "Theo Grant",
    );

    const execution = await dispatchCommand(ctx, maya, {
      kind: "execute_request",
      requestId,
    });
    expect(execution.ok).toBe(true);
    if (execution.ok && execution.value.kind === "executed") {
      const replay = await dispatchCommand(ctx, maya, {
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

    const record = await ctx.providerExecutions.getByRequestId(requestId);
    expect(record?.status).toBe("succeeded");
    expect(record?.idempotencyKey).not.toBe(requestId);

    const events = await ctx.events.list({ requestId });
    const types = events.map((event) => event.type).sort();
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

  it("uses an idempotency key distinct from request and correlation IDs", async () => {
    const requestId = requestIdOf(await submitRefund());
    await dispatchCommand(ctx, theo, {
      kind: "approve_request",
      requestId,
      expectedVersion: 0,
    });
    await dispatchCommand(ctx, maya, { kind: "execute_request", requestId });
    const request = await ctx.changeRequests.getById(requestId);
    const record = await ctx.providerExecutions.getByRequestId(requestId);
    expect(record?.idempotencyKey).toBeTruthy();
    expect(record?.idempotencyKey).not.toBe(requestId);
    expect(record?.idempotencyKey).not.toBe(request?.correlationId);
  });
});

describe("optimistic concurrency", () => {
  it("rejects a stale approval after the request has changed", async () => {
    const requestId = requestIdOf(await submitRefund());
    const first = await dispatchCommand(ctx, theo, {
      kind: "approve_request",
      requestId,
      expectedVersion: 0,
    });
    expect(first.ok).toBe(true);
    const stale = await dispatchCommand(ctx, theo, {
      kind: "approve_request",
      requestId,
      expectedVersion: 0,
    });
    expect(stale.ok).toBe(false);
    if (!stale.ok) {
      expect(stale.error.kind).toBe("invalid_transition");
    }
  });

  it("rejects an approval with a stale version even while pending", async () => {
    const requestId = requestIdOf(await submitRefund());
    const result = await dispatchCommand(ctx, theo, {
      kind: "approve_request",
      requestId,
      expectedVersion: 5,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("conflict");
    }
    expect((await ctx.changeRequests.getById(requestId))?.state).toBe(
      "pending",
    );
  });
});

describe("provider failure and retry", () => {
  it("marks the request failed, records the event, and allows a safe retry", async () => {
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

    const requestId = requestIdOf(await submitRefund());
    await dispatchCommand(ctx, theo, {
      kind: "approve_request",
      requestId,
      expectedVersion: 0,
    });

    const failure = await dispatchCommand(ctx, maya, {
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
    expect((await ctx.changeRequests.getById(requestId))?.state).toBe("failed");
    expect(
      await ctx.events.list({ requestId, types: ["execution_failed"] }),
    ).toHaveLength(1);

    const firstRecord = await ctx.providerExecutions.getByRequestId(requestId);
    const firstKey = firstRecord?.idempotencyKey;
    const retry = await dispatchCommand(ctx, maya, {
      kind: "execute_request",
      requestId,
    });
    expect(retry.ok).toBe(true);
    expect((await ctx.changeRequests.getById(requestId))?.state).toBe(
      "executed",
    );
    const retryRecord = await ctx.providerExecutions.getByRequestId(requestId);
    expect(retryRecord?.idempotencyKey).toBe(firstKey);
    expect(calls).toBe(2);
  });

  it("treats a failed request as open, blocking a second request for the same target", async () => {
    const broken: PaymentProvider = {
      refund() {
        return { kind: "failed", detail: "Provider timeout" };
      },
    };
    ctx = { ...ctx, paymentProvider: broken };

    const requestId = requestIdOf(await submitRefund());
    await dispatchCommand(ctx, theo, {
      kind: "approve_request",
      requestId,
      expectedVersion: 0,
    });
    await dispatchCommand(ctx, maya, { kind: "execute_request", requestId });
    expect((await ctx.changeRequests.getById(requestId))?.state).toBe("failed");

    const duplicate = await submitRefund();
    expect(duplicate).toEqual({
      ok: false,
      error: {
        kind: "conflict",
        message: "An open refund request already exists for this case.",
      },
    });
  });
});

describe("KYC workflow through the shared path", () => {
  it("routes a high-risk decision to compliance and applies it on execution", async () => {
    const submission = await dispatchCommand(ctx, maya, {
      kind: "submit_kyc_decision",
      kycCaseId: "kyc_001",
      decision: "approve",
      reason: "Watchlist match reviewed; documents verified in person",
    });
    const requestId = requestIdOf(submission);
    const request = await ctx.changeRequests.getById(requestId);
    expect(request?.requiredApproverRole).toBe("compliance_approver");
    expect(request?.riskLevel).toBe("high");

    const wrongApprover = await dispatchCommand(ctx, theo, {
      kind: "approve_request",
      requestId,
      expectedVersion: 0,
    });
    expect(wrongApprover.ok).toBe(false);

    const approval = await dispatchCommand(ctx, priya, {
      kind: "approve_request",
      requestId,
      expectedVersion: 0,
    });
    expect(approval.ok).toBe(true);

    const execution = await dispatchCommand(ctx, priya, {
      kind: "execute_request",
      requestId,
    });
    expect(execution.ok).toBe(true);
    expect((await ctx.kycCases.getById("kyc_001"))?.state).toBe("approved");
  });
});

describe("feature-flag workflow through the shared path", () => {
  it("accepts 10% → 100%, routes to the release manager, and applies on execution", async () => {
    const submission = await dispatchCommand(ctx, maya, {
      kind: "submit_flag_change",
      flagId: "flg_001",
      environment: "production",
      proposedRolloutPercent: 100,
      reason: "Full rollout of instant payouts",
    });
    const requestId = requestIdOf(submission);
    expect(
      (await ctx.changeRequests.getById(requestId))?.requiredApproverRole,
    ).toBe("release_approver");

    const approval = await dispatchCommand(ctx, alex, {
      kind: "approve_request",
      requestId,
      expectedVersion: 0,
    });
    expect(approval.ok).toBe(true);

    const execution = await dispatchCommand(ctx, alex, {
      kind: "execute_request",
      requestId,
    });
    expect(execution.ok).toBe(true);
    expect((await ctx.featureFlags.getById("flg_001"))?.rolloutPercent).toBe(
      100,
    );
  });
});

describe("rejection", () => {
  it("lets the required approver reject with a reason", async () => {
    const requestId = requestIdOf(await submitRefund());
    const result = await dispatchCommand(ctx, theo, {
      kind: "reject_request",
      requestId,
      expectedVersion: 0,
      reason: "Insufficient supporting evidence",
    });
    expect(result.ok).toBe(true);
    expect((await ctx.changeRequests.getById(requestId))?.state).toBe(
      "rejected",
    );
    expect(
      await ctx.events.list({ requestId, types: ["request_rejected"] }),
    ).toHaveLength(1);
  });
});

describe("reseeding", () => {
  it("restores the deterministic starting state", async () => {
    const requestId = requestIdOf(await submitRefund());
    await dispatchCommand(ctx, theo, {
      kind: "approve_request",
      requestId,
      expectedVersion: 0,
    });
    await container.reset();
    expect(await ctx.changeRequests.list()).toHaveLength(0);
    expect(await ctx.events.list()).toHaveLength(0);
    expect(await ctx.refundCases.list()).toHaveLength(4);
    expect((await ctx.kycCases.getById("kyc_001"))?.state).toBe(
      "pending_review",
    );
    expect((await ctx.featureFlags.getById("flg_001"))?.rolloutPercent).toBe(
      10,
    );
  });
});
