import type { ChangeRequest } from "@/domain/change-request";
import type { ActivityEvent } from "@/domain/events";
import type { FeatureFlag, KycCase, RefundCase } from "@/domain/targets";
import type { CommandContext } from "./command-pipeline";
import type { ActivityEventFilter } from "./ports";

export interface RefundQueueItem {
  refundCase: RefundCase;
  request: ChangeRequest | null;
}

export function listRefundQueue(ctx: CommandContext): RefundQueueItem[] {
  const requests = ctx.changeRequests.list({ domain: "refund" });
  const latestByCase = new Map<string, ChangeRequest>();
  for (const request of requests) {
    if (request.payload.domain !== "refund") {
      continue;
    }
    const caseId = request.payload.refundCaseId;
    if (!latestByCase.has(caseId)) {
      latestByCase.set(caseId, request);
    }
  }
  return ctx.refundCases.list().map((refundCase) => ({
    refundCase,
    request: latestByCase.get(refundCase.id) ?? null,
  }));
}

export interface RefundDetail extends RefundQueueItem {
  timeline: ActivityEvent[];
}

export function getRefundDetail(
  ctx: CommandContext,
  refundCaseId: string,
): RefundDetail | null {
  const refundCase = ctx.refundCases.getById(refundCaseId);
  if (!refundCase) {
    return null;
  }
  const request =
    listRefundQueue(ctx).find((item) => item.refundCase.id === refundCaseId)
      ?.request ?? null;
  const timeline = request
    ? ctx.events.list({ correlationId: request.correlationId })
    : [];
  return { refundCase, request, timeline };
}

export interface KycQueueItem {
  kycCase: KycCase;
  request: ChangeRequest | null;
}

export function listKycQueue(ctx: CommandContext): KycQueueItem[] {
  const requests = ctx.changeRequests.list({ domain: "kyc" });
  const latestByCase = new Map<string, ChangeRequest>();
  for (const request of requests) {
    if (request.payload.domain !== "kyc") {
      continue;
    }
    const caseId = request.payload.kycCaseId;
    if (!latestByCase.has(caseId)) {
      latestByCase.set(caseId, request);
    }
  }
  return ctx.kycCases.list().map((kycCase) => ({
    kycCase,
    request: latestByCase.get(kycCase.id) ?? null,
  }));
}

export interface KycDetail extends KycQueueItem {
  timeline: ActivityEvent[];
}

export function getKycDetail(
  ctx: CommandContext,
  kycCaseId: string,
): KycDetail | null {
  const kycCase = ctx.kycCases.getById(kycCaseId);
  if (!kycCase) {
    return null;
  }
  const request =
    listKycQueue(ctx).find((item) => item.kycCase.id === kycCaseId)?.request ??
    null;
  const timeline = request
    ? ctx.events.list({ correlationId: request.correlationId })
    : [];
  return { kycCase, request, timeline };
}

export interface FlagListItem {
  flag: FeatureFlag;
  request: ChangeRequest | null;
}

export function listFlags(ctx: CommandContext): FlagListItem[] {
  const requests = ctx.changeRequests.list({ domain: "feature_flag" });
  const latestByFlag = new Map<string, ChangeRequest>();
  for (const request of requests) {
    if (request.payload.domain !== "feature_flag") {
      continue;
    }
    const flagId = request.payload.flagId;
    if (!latestByFlag.has(flagId)) {
      latestByFlag.set(flagId, request);
    }
  }
  return ctx.featureFlags.list().map((flag) => ({
    flag,
    request: latestByFlag.get(flag.id) ?? null,
  }));
}

export interface FlagDetail extends FlagListItem {
  timeline: ActivityEvent[];
}

export function getFlagDetail(
  ctx: CommandContext,
  flagId: string,
): FlagDetail | null {
  const flag = ctx.featureFlags.getById(flagId);
  if (!flag) {
    return null;
  }
  const request =
    listFlags(ctx).find((item) => item.flag.id === flagId)?.request ?? null;
  const timeline = request
    ? ctx.events.list({ correlationId: request.correlationId })
    : [];
  return { flag, request, timeline };
}

export function listPendingApprovals(ctx: CommandContext): ChangeRequest[] {
  return ctx.changeRequests.list({ state: "pending" });
}

export function listActivity(
  ctx: CommandContext,
  filter?: ActivityEventFilter,
): ActivityEvent[] {
  return ctx.events.list(filter);
}

export function getRequestWithTimeline(
  ctx: CommandContext,
  requestId: string,
): { request: ChangeRequest; timeline: ActivityEvent[] } | null {
  const request = ctx.changeRequests.getById(requestId);
  if (!request) {
    return null;
  }
  return {
    request,
    timeline: ctx.events.list({ correlationId: request.correlationId }),
  };
}
