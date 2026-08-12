import type {
  ChangePayload,
  ChangeRequest,
  LifecycleState,
} from "@/domain/change-request";
import { canTransition } from "@/domain/change-request";
import type {
  ApproveRequestCommand,
  ExecuteRequestCommand,
  RejectRequestCommand,
  SubmitFlagChangeCommand,
  SubmitKycDecisionCommand,
  SubmitRefundCommand,
} from "@/domain/commands";
import { commandSchema } from "@/domain/commands";
import type { ActivityEventType } from "@/domain/events";
import { outcomeForEventType } from "@/domain/events";
import { evaluateApproval, evaluateSubmission } from "@/domain/policies";
import type { Actor, RiskLevel, WorkflowDomain } from "@/domain/shared";
import { assertNever } from "@/domain/shared";
import type {
  ActivityEventRepository,
  ChangeRequestRepository,
  Clock,
  FeatureFlagProvider,
  FeatureFlagRepository,
  IdGenerator,
  KycCaseRepository,
  KycProvider,
  PaymentProvider,
  ProviderExecutionRepository,
  ProviderResult,
  RefundCaseRepository,
  UnitOfWork,
} from "./ports";
import type { CommandResult } from "./results";
import { err, ok } from "./results";

export interface CommandContext {
  uow: UnitOfWork;
  clock: Clock;
  ids: IdGenerator;
  changeRequests: ChangeRequestRepository;
  events: ActivityEventRepository;
  refundCases: RefundCaseRepository;
  kycCases: KycCaseRepository;
  featureFlags: FeatureFlagRepository;
  providerExecutions: ProviderExecutionRepository;
  paymentProvider: PaymentProvider;
  kycProvider: KycProvider;
  flagProvider: FeatureFlagProvider;
}

/**
 * Single entry point for every mutation in the product:
 * receive typed command → validate → load actor and target → authorize →
 * evaluate policy → persist attempt or transition → approve or execute
 * adapter → persist outcome.
 */
export async function dispatchCommand(
  ctx: CommandContext,
  actor: Actor,
  input: unknown,
): Promise<CommandResult> {
  const parsed = commandSchema.safeParse(input);
  if (!parsed.success) {
    return err({
      kind: "validation",
      issues: parsed.error.issues.map((issue) => issue.message),
    });
  }
  const command = parsed.data;
  switch (command.kind) {
    case "submit_refund":
      return submitRefund(ctx, actor, command);
    case "submit_kyc_decision":
      return submitKycDecision(ctx, actor, command);
    case "submit_flag_change":
      return submitFlagChange(ctx, actor, command);
    case "approve_request":
      return approveRequest(ctx, actor, command);
    case "reject_request":
      return rejectRequest(ctx, actor, command);
    case "execute_request":
      return executeRequest(ctx, actor, command);
    default:
      return assertNever(command);
  }
}

function recordEvent(
  ctx: CommandContext,
  input: {
    requestId: string | null;
    correlationId: string;
    domain: WorkflowDomain;
    type: ActivityEventType;
    actor: Actor;
    summary: string;
    metadata?: Record<string, string>;
  },
): Promise<void> {
  return ctx.events.insert({
    id: ctx.ids.newId("evt"),
    requestId: input.requestId,
    correlationId: input.correlationId,
    domain: input.domain,
    type: input.type,
    outcome: outcomeForEventType(input.type),
    actorId: input.actor.id,
    actorName: input.actor.name,
    summary: input.summary,
    metadata: input.metadata ?? {},
    occurredAt: ctx.clock.now(),
  });
}

async function submitChangeRequest(
  ctx: CommandContext,
  actor: Actor,
  payload: ChangePayload,
  reason: string,
  targetRiskLevel: RiskLevel,
  summaries: { submitted: string; blocked: (message: string) => string },
): Promise<CommandResult> {
  if (!actor.roles.includes("operations")) {
    return err({
      kind: "authorization",
      message: "Only operations team members can submit requests.",
    });
  }
  const correlationId = ctx.ids.newId("cor");
  const decision = evaluateSubmission(payload, targetRiskLevel);
  const now = ctx.clock.now();
  if (decision.kind === "blocked") {
    await ctx.uow.transact(async () => {
      await recordEvent(ctx, {
        requestId: null,
        correlationId,
        domain: payload.domain,
        type: "attempt_blocked",
        actor,
        summary: summaries.blocked(decision.message),
        metadata: { policyId: decision.policyId, reason },
      });
    });
    return err({
      kind: "policy_blocked",
      policyId: decision.policyId,
      message: decision.message,
    });
  }
  const request: ChangeRequest = {
    id: ctx.ids.newId("req"),
    correlationId,
    domain: payload.domain,
    payload,
    requesterId: actor.id,
    requesterName: actor.name,
    requesterRoles: actor.roles,
    reason,
    riskLevel: decision.evaluation.riskLevel,
    matchedPolicyIds: decision.evaluation.matchedPolicyIds,
    requiredApproverRole: decision.evaluation.requiredApproverRole,
    state: "pending",
    approvedById: null,
    approvedByName: null,
    approvedAt: null,
    executedAt: null,
    failureReason: null,
    version: 0,
    createdAt: now,
    updatedAt: now,
  };
  await ctx.uow.transact(async () => {
    await ctx.changeRequests.insert(request);
    await recordEvent(ctx, {
      requestId: request.id,
      correlationId,
      domain: payload.domain,
      type: "request_submitted",
      actor,
      summary: summaries.submitted,
      metadata: { reason },
    });
  });
  return ok({ kind: "submitted", requestId: request.id });
}

async function submitRefund(
  ctx: CommandContext,
  actor: Actor,
  command: SubmitRefundCommand,
): Promise<CommandResult> {
  const refundCase = await ctx.refundCases.getById(command.refundCaseId);
  if (!refundCase) {
    return err({ kind: "not_found", message: "Refund case not found." });
  }
  const open = await ctx.changeRequests.findOpenByTarget(
    "refund",
    refundCase.id,
  );
  if (open.length > 0) {
    return err({
      kind: "conflict",
      message: "An open refund request already exists for this case.",
    });
  }
  return submitChangeRequest(
    ctx,
    actor,
    {
      domain: "refund",
      refundCaseId: refundCase.id,
      orderId: refundCase.orderId,
      customerName: refundCase.customerName,
      amount: { amountCents: command.amountCents, currency: "USD" },
      chargeAmount: refundCase.chargeAmount,
    },
    command.reason,
    refundCase.riskLevel,
    {
      submitted: `Requested a refund of ${formatCents(command.amountCents)} for order ${refundCase.orderId}`,
      blocked: (message) =>
        `Refund request for order ${refundCase.orderId} was blocked: ${message}`,
    },
  );
}

async function submitKycDecision(
  ctx: CommandContext,
  actor: Actor,
  command: SubmitKycDecisionCommand,
): Promise<CommandResult> {
  const kycCase = await ctx.kycCases.getById(command.kycCaseId);
  if (!kycCase) {
    return err({ kind: "not_found", message: "KYC case not found." });
  }
  if (kycCase.state !== "pending_review") {
    return err({
      kind: "invalid_transition",
      message: "This KYC case has already been decided.",
    });
  }
  const open = await ctx.changeRequests.findOpenByTarget("kyc", kycCase.id);
  if (open.length > 0) {
    return err({
      kind: "conflict",
      message: "An open decision request already exists for this case.",
    });
  }
  return submitChangeRequest(
    ctx,
    actor,
    {
      domain: "kyc",
      kycCaseId: kycCase.id,
      customerName: kycCase.customerName,
      decision: command.decision,
      previousState: kycCase.state,
    },
    command.reason,
    kycCase.riskLevel,
    {
      submitted: `Proposed to ${command.decision} the KYC review for ${kycCase.customerName}`,
      blocked: (message) =>
        `KYC decision for ${kycCase.customerName} was blocked: ${message}`,
    },
  );
}

async function submitFlagChange(
  ctx: CommandContext,
  actor: Actor,
  command: SubmitFlagChangeCommand,
): Promise<CommandResult> {
  const flag = await ctx.featureFlags.getById(command.flagId);
  if (!flag) {
    return err({ kind: "not_found", message: "Feature flag not found." });
  }
  if (flag.environment !== command.environment) {
    return err({
      kind: "validation",
      issues: ["The flag does not belong to the requested environment."],
    });
  }
  if (flag.rolloutPercent === command.proposedRolloutPercent) {
    return err({
      kind: "validation",
      issues: ["The proposed rollout matches the current rollout."],
    });
  }
  const open = await ctx.changeRequests.findOpenByTarget(
    "feature_flag",
    flag.id,
  );
  if (open.length > 0) {
    return err({
      kind: "conflict",
      message: "An open change request already exists for this flag.",
    });
  }
  return submitChangeRequest(
    ctx,
    actor,
    {
      domain: "feature_flag",
      flagId: flag.id,
      flagKey: flag.key,
      environment: flag.environment,
      currentRolloutPercent: flag.rolloutPercent,
      proposedRolloutPercent: command.proposedRolloutPercent,
    },
    command.reason,
    "low",
    {
      submitted: `Proposed changing ${flag.key} (${flag.environment}) rollout from ${flag.rolloutPercent}% to ${command.proposedRolloutPercent}%`,
      blocked: (message) =>
        `Rollout change for ${flag.key} (${flag.environment}) was blocked: ${message}`,
    },
  );
}

async function approveRequest(
  ctx: CommandContext,
  actor: Actor,
  command: ApproveRequestCommand,
): Promise<CommandResult> {
  const request = await ctx.changeRequests.getById(command.requestId);
  if (!request) {
    return err({ kind: "not_found", message: "Request not found." });
  }
  if (request.state !== "pending") {
    return err({
      kind: "invalid_transition",
      message: `Only pending requests can be approved; this request is ${request.state}.`,
    });
  }
  const decision = evaluateApproval(request, actor);
  if (decision.kind === "blocked") {
    await ctx.uow.transact(async () => {
      await recordEvent(ctx, {
        requestId: request.id,
        correlationId: request.correlationId,
        domain: request.domain,
        type: "attempt_blocked",
        actor,
        summary: `Approval attempt was blocked: ${decision.message}`,
        metadata: { policyId: decision.policyId },
      });
    });
    return err({
      kind: "policy_blocked",
      policyId: decision.policyId,
      message: decision.message,
    });
  }
  const now = ctx.clock.now();
  return ctx.uow.transact(async () => {
    const updated = await ctx.changeRequests.update(
      request.id,
      command.expectedVersion,
      {
        state: "approved",
        approvedById: actor.id,
        approvedByName: actor.name,
        approvedAt: now,
        updatedAt: now,
      },
    );
    if (!updated) {
      return err({
        kind: "conflict",
        message:
          "This request changed while you were reviewing it. Reload and try again.",
      });
    }
    await recordEvent(ctx, {
      requestId: request.id,
      correlationId: request.correlationId,
      domain: request.domain,
      type: "request_approved",
      actor,
      summary: describeApproval(request),
    });
    return ok({ kind: "approved", requestId: request.id });
  });
}

async function rejectRequest(
  ctx: CommandContext,
  actor: Actor,
  command: RejectRequestCommand,
): Promise<CommandResult> {
  const request = await ctx.changeRequests.getById(command.requestId);
  if (!request) {
    return err({ kind: "not_found", message: "Request not found." });
  }
  if (request.state !== "pending") {
    return err({
      kind: "invalid_transition",
      message: `Only pending requests can be rejected; this request is ${request.state}.`,
    });
  }
  if (!actor.roles.includes(request.requiredApproverRole)) {
    await ctx.uow.transact(async () => {
      await recordEvent(ctx, {
        requestId: request.id,
        correlationId: request.correlationId,
        domain: request.domain,
        type: "attempt_blocked",
        actor,
        summary: `Rejection attempt was blocked: requires the ${request.requiredApproverRole.replace("_", " ")} role.`,
        metadata: { policyId: "approval.required_role" },
      });
    });
    return err({
      kind: "authorization",
      message: `Rejecting this request requires the ${request.requiredApproverRole.replace("_", " ")} role.`,
    });
  }
  const now = ctx.clock.now();
  return ctx.uow.transact(async () => {
    const updated = await ctx.changeRequests.update(
      request.id,
      command.expectedVersion,
      {
        state: "rejected",
        failureReason: command.reason,
        updatedAt: now,
      },
    );
    if (!updated) {
      return err({
        kind: "conflict",
        message:
          "This request changed while you were reviewing it. Reload and try again.",
      });
    }
    await recordEvent(ctx, {
      requestId: request.id,
      correlationId: request.correlationId,
      domain: request.domain,
      type: "request_rejected",
      actor,
      summary: `Rejected the request: ${command.reason}`,
      metadata: { reason: command.reason },
    });
    return ok({ kind: "rejected", requestId: request.id });
  });
}

async function executeRequest(
  ctx: CommandContext,
  actor: Actor,
  command: ExecuteRequestCommand,
): Promise<CommandResult> {
  const request = await ctx.changeRequests.getById(command.requestId);
  if (!request) {
    return err({ kind: "not_found", message: "Request not found." });
  }
  if (
    !actor.roles.includes("operations") &&
    !actor.roles.includes(request.requiredApproverRole)
  ) {
    return err({
      kind: "authorization",
      message: "You are not authorized to execute this request.",
    });
  }

  const existing = await ctx.providerExecutions.getByRequestId(request.id);
  if (existing && existing.status === "succeeded") {
    await ctx.uow.transact(async () => {
      await recordEvent(ctx, {
        requestId: request.id,
        correlationId: request.correlationId,
        domain: request.domain,
        type: "execution_replayed",
        actor,
        summary:
          "Execution was retried after completion; the original provider result was returned without a second execution.",
        metadata: {
          idempotencyKey: existing.idempotencyKey,
          providerReference: existing.providerReference ?? "",
        },
      });
    });
    return ok({
      kind: "idempotent_replay",
      requestId: request.id,
      providerReference: existing.providerReference ?? "",
    });
  }

  if (!canTransition(request.state, "executing")) {
    return err({
      kind: "invalid_transition",
      message: `Only approved requests can be executed; this request is ${request.state}.`,
    });
  }

  const idempotencyKey = existing
    ? existing.idempotencyKey
    : ctx.ids.newId("idem");
  const startedAt = ctx.clock.now();
  const started = await ctx.uow.transact(async () => {
    const updated = await ctx.changeRequests.update(
      request.id,
      request.version,
      {
        state: "executing",
        updatedAt: startedAt,
      },
    );
    if (!updated) {
      return false;
    }
    if (!existing) {
      await ctx.providerExecutions.recordIntent({
        requestId: request.id,
        idempotencyKey,
        status: "intent",
        providerReference: null,
        detail: null,
        createdAt: startedAt,
        completedAt: null,
      });
    }
    await recordEvent(ctx, {
      requestId: request.id,
      correlationId: request.correlationId,
      domain: request.domain,
      type: "execution_started",
      actor,
      summary: describeExecutionStart(request),
      metadata: { idempotencyKey },
    });
    return true;
  });
  if (!started) {
    return err({
      kind: "conflict",
      message:
        "This request changed while you were reviewing it. Reload and try again.",
    });
  }

  const result = callProvider(ctx, request, idempotencyKey);
  const completedAt = ctx.clock.now();
  const executingVersion = request.version + 1;

  return ctx.uow.transact(async () => {
    if (result.kind === "failed") {
      await ctx.providerExecutions.recordOutcome(
        request.id,
        "failed",
        null,
        result.detail,
        completedAt,
      );
      await ctx.changeRequests.update(request.id, executingVersion, {
        state: "failed",
        failureReason: result.detail,
        updatedAt: completedAt,
      });
      await recordEvent(ctx, {
        requestId: request.id,
        correlationId: request.correlationId,
        domain: request.domain,
        type: "execution_failed",
        actor,
        summary: `Provider execution failed: ${result.detail}`,
        metadata: { idempotencyKey },
      });
      return err({ kind: "provider_failure", message: result.detail });
    }
    await ctx.providerExecutions.recordOutcome(
      request.id,
      "succeeded",
      result.providerReference,
      result.detail,
      completedAt,
    );
    await ctx.changeRequests.update(request.id, executingVersion, {
      state: "executed",
      executedAt: completedAt,
      updatedAt: completedAt,
    });
    await applyDomainEffect(ctx, request, completedAt);
    await recordEvent(ctx, {
      requestId: request.id,
      correlationId: request.correlationId,
      domain: request.domain,
      type: "execution_succeeded",
      actor,
      summary: describeExecutionSuccess(request),
      metadata: {
        idempotencyKey,
        providerReference: result.providerReference,
      },
    });
    return ok({
      kind: "executed",
      requestId: request.id,
      providerReference: result.providerReference,
    });
  });
}

function callProvider(
  ctx: CommandContext,
  request: ChangeRequest,
  idempotencyKey: string,
): ProviderResult {
  const payload = request.payload;
  switch (payload.domain) {
    case "refund":
      return ctx.paymentProvider.refund({
        idempotencyKey,
        orderId: payload.orderId,
        amountCents: payload.amount.amountCents,
      });
    case "kyc":
      return ctx.kycProvider.applyDecision({
        idempotencyKey,
        kycCaseId: payload.kycCaseId,
        decision: payload.decision,
      });
    case "feature_flag":
      return ctx.flagProvider.setRollout({
        idempotencyKey,
        flagKey: payload.flagKey,
        environment: payload.environment,
        rolloutPercent: payload.proposedRolloutPercent,
      });
    default:
      return assertNever(payload);
  }
}

async function applyDomainEffect(
  ctx: CommandContext,
  request: ChangeRequest,
  at: string,
): Promise<void> {
  const payload = request.payload;
  switch (payload.domain) {
    case "refund":
      break;
    case "kyc": {
      const state =
        payload.decision === "approve"
          ? "approved"
          : payload.decision === "reject"
            ? "rejected"
            : "escalated";
      await ctx.kycCases.setState(payload.kycCaseId, state, at);
      break;
    }
    case "feature_flag":
      await ctx.featureFlags.setRollout(
        payload.flagId,
        payload.proposedRolloutPercent,
        at,
      );
      break;
    default:
      assertNever(payload);
  }
}

function describeApproval(request: ChangeRequest): string {
  const payload = request.payload;
  switch (payload.domain) {
    case "refund":
      return `Approved the refund of ${formatCents(payload.amount.amountCents)} for order ${payload.orderId}`;
    case "kyc":
      return `Approved the decision to ${payload.decision} the KYC review for ${payload.customerName}`;
    case "feature_flag":
      return `Approved changing ${payload.flagKey} (${payload.environment}) rollout to ${payload.proposedRolloutPercent}%`;
    default:
      return assertNever(payload);
  }
}

function describeExecutionStart(request: ChangeRequest): string {
  const payload = request.payload;
  switch (payload.domain) {
    case "refund":
      return `Started refund execution for order ${payload.orderId}`;
    case "kyc":
      return `Started applying the KYC decision for ${payload.customerName}`;
    case "feature_flag":
      return `Started applying the rollout change for ${payload.flagKey} (${payload.environment})`;
    default:
      return assertNever(payload);
  }
}

function describeExecutionSuccess(request: ChangeRequest): string {
  const payload = request.payload;
  switch (payload.domain) {
    case "refund":
      return `Refund of ${formatCents(payload.amount.amountCents)} for order ${payload.orderId} was executed by the payment provider`;
    case "kyc":
      return `KYC decision (${payload.decision}) for ${payload.customerName} was applied`;
    case "feature_flag":
      return `${payload.flagKey} (${payload.environment}) rollout changed from ${payload.currentRolloutPercent}% to ${payload.proposedRolloutPercent}%`;
    default:
      return assertNever(payload);
  }
}

function formatCents(amountCents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amountCents / 100);
}
