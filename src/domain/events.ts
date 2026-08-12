import type { WorkflowDomain } from "./shared";

export const EVENT_TYPES = [
  "request_submitted",
  "attempt_blocked",
  "request_approved",
  "request_rejected",
  "execution_started",
  "execution_succeeded",
  "execution_failed",
  "execution_replayed",
] as const;
export type ActivityEventType = (typeof EVENT_TYPES)[number];

export const EVENT_OUTCOMES = ["allowed", "blocked", "failed"] as const;
export type ActivityEventOutcome = (typeof EVENT_OUTCOMES)[number];

export interface ActivityEvent {
  id: string;
  requestId: string | null;
  correlationId: string;
  domain: WorkflowDomain;
  type: ActivityEventType;
  outcome: ActivityEventOutcome;
  actorId: string;
  actorName: string;
  summary: string;
  metadata: Record<string, string>;
  occurredAt: string;
}

export function outcomeForEventType(
  type: ActivityEventType,
): ActivityEventOutcome {
  switch (type) {
    case "request_submitted":
    case "request_approved":
    case "request_rejected":
    case "execution_started":
    case "execution_succeeded":
    case "execution_replayed":
      return "allowed";
    case "attempt_blocked":
      return "blocked";
    case "execution_failed":
      return "failed";
  }
}
