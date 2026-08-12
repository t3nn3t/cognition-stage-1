import type { LifecycleState } from "@/domain/change-request";
import type { ActivityEventOutcome } from "@/domain/events";
import type { RiskLevel } from "@/domain/shared";
import type { FlagEnvironment, KycState } from "@/domain/targets";
import {
  KYC_STATE_LABELS,
  LIFECYCLE_LABELS,
  OUTCOME_LABELS,
  RISK_LABELS,
} from "../labels";

function Badge({
  tone,
  children,
}: {
  tone: "neutral" | "green" | "amber" | "red" | "blue";
  children: React.ReactNode;
}) {
  const tones: Record<typeof tone, string> = {
    neutral: "bg-zinc-100 text-zinc-700 ring-zinc-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    red: "bg-red-50 text-red-700 ring-red-200",
    blue: "bg-blue-50 text-blue-700 ring-blue-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ state }: { state: LifecycleState }) {
  const tone =
    state === "executed"
      ? "green"
      : state === "approved" || state === "executing"
        ? "blue"
        : state === "pending"
          ? "amber"
          : "red";
  return <Badge tone={tone}>{LIFECYCLE_LABELS[state]}</Badge>;
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  const tone =
    level === "high" ? "red" : level === "medium" ? "amber" : "neutral";
  return <Badge tone={tone}>{RISK_LABELS[level]}</Badge>;
}

export function OutcomeBadge({ outcome }: { outcome: ActivityEventOutcome }) {
  const tone =
    outcome === "allowed" ? "green" : outcome === "blocked" ? "amber" : "red";
  return <Badge tone={tone}>{OUTCOME_LABELS[outcome]}</Badge>;
}

export function KycStateBadge({ state }: { state: KycState }) {
  const tone =
    state === "approved"
      ? "green"
      : state === "pending_review"
        ? "amber"
        : state === "escalated"
          ? "blue"
          : "red";
  return <Badge tone={tone}>{KYC_STATE_LABELS[state]}</Badge>;
}

export function EnvironmentBadge({
  environment,
}: {
  environment: FlagEnvironment;
}) {
  return (
    <Badge tone={environment === "production" ? "blue" : "neutral"}>
      {environment === "production" ? "Production" : "Staging"}
    </Badge>
  );
}
