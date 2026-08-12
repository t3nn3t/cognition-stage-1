import type { ChangeRequest } from "@/domain/change-request";
import type { ActivityEvent } from "@/domain/events";
import type { FeatureFlag, KycCase, RefundCase } from "@/domain/targets";
import type { CommandContext } from "./command-pipeline";
import type { ActivityEventFilter } from "./ports";

export interface RefundQueueItem {
  refundCase: RefundCase;
  request: ChangeRequest | null;
}

export async function listRefundQueue(
  ctx: CommandContext,
): Promise<RefundQueueItem[]> {
  const requests = await ctx.changeRequests.list({ domain: "refund" });
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
  const cases = await ctx.refundCases.list();
  return cases.map((refundCase) => ({
    refundCase,
    request: latestByCase.get(refundCase.id) ?? null,
  }));
}

export interface RefundDetail extends RefundQueueItem {
  timeline: ActivityEvent[];
}

export async function getRefundDetail(
  ctx: CommandContext,
  refundCaseId: string,
): Promise<RefundDetail | null> {
  const refundCase = await ctx.refundCases.getById(refundCaseId);
  if (!refundCase) {
    return null;
  }
  const queue = await listRefundQueue(ctx);
  const request =
    queue.find((item) => item.refundCase.id === refundCaseId)?.request ?? null;
  const timeline = request
    ? await ctx.events.list({ correlationId: request.correlationId })
    : [];
  return { refundCase, request, timeline };
}

export interface KycQueueItem {
  kycCase: KycCase;
  request: ChangeRequest | null;
}

export async function listKycQueue(
  ctx: CommandContext,
): Promise<KycQueueItem[]> {
  const requests = await ctx.changeRequests.list({ domain: "kyc" });
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
  const cases = await ctx.kycCases.list();
  return cases.map((kycCase) => ({
    kycCase,
    request: latestByCase.get(kycCase.id) ?? null,
  }));
}

export interface KycDetail extends KycQueueItem {
  timeline: ActivityEvent[];
}

export async function getKycDetail(
  ctx: CommandContext,
  kycCaseId: string,
): Promise<KycDetail | null> {
  const kycCase = await ctx.kycCases.getById(kycCaseId);
  if (!kycCase) {
    return null;
  }
  const queue = await listKycQueue(ctx);
  const request =
    queue.find((item) => item.kycCase.id === kycCaseId)?.request ?? null;
  const timeline = request
    ? await ctx.events.list({ correlationId: request.correlationId })
    : [];
  return { kycCase, request, timeline };
}

export interface FlagListItem {
  flag: FeatureFlag;
  request: ChangeRequest | null;
}

export async function listFlags(ctx: CommandContext): Promise<FlagListItem[]> {
  const requests = await ctx.changeRequests.list({ domain: "feature_flag" });
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
  const flags = await ctx.featureFlags.list();
  return flags.map((flag) => ({
    flag,
    request: latestByFlag.get(flag.id) ?? null,
  }));
}

export interface FlagDetail extends FlagListItem {
  timeline: ActivityEvent[];
}

export async function getFlagDetail(
  ctx: CommandContext,
  flagId: string,
): Promise<FlagDetail | null> {
  const flag = await ctx.featureFlags.getById(flagId);
  if (!flag) {
    return null;
  }
  const items = await listFlags(ctx);
  const request =
    items.find((item) => item.flag.id === flagId)?.request ?? null;
  const timeline = request
    ? await ctx.events.list({ correlationId: request.correlationId })
    : [];
  return { flag, request, timeline };
}

export function listPendingApprovals(
  ctx: CommandContext,
): Promise<ChangeRequest[]> {
  return ctx.changeRequests.list({ state: "pending" });
}

export function listActivity(
  ctx: CommandContext,
  filter?: ActivityEventFilter,
): Promise<ActivityEvent[]> {
  return ctx.events.list(filter);
}

export async function getRequestWithTimeline(
  ctx: CommandContext,
  requestId: string,
): Promise<{ request: ChangeRequest; timeline: ActivityEvent[] } | null> {
  const request = await ctx.changeRequests.getById(requestId);
  if (!request) {
    return null;
  }
  return {
    request,
    timeline: await ctx.events.list({ correlationId: request.correlationId }),
  };
}
