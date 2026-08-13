import Link from "next/link";
import { listActivity, listPendingApprovals } from "@/application/queries";
import type { ChangeRequest } from "@/domain/change-request";
import { assertNever } from "@/domain/shared";
import { getContainer } from "@/infrastructure/container";
import { RiskBadge } from "@/presentation/components/badges";
import { EmptyState } from "@/presentation/components/empty-state";
import { PageHeader } from "@/presentation/components/page-header";
import { formatAge, formatMoney } from "@/presentation/format";
import {
  DOMAIN_LABELS,
  EVENT_TYPE_LABELS,
  ROLE_LABELS,
} from "@/presentation/labels";

export const dynamic = "force-dynamic";

function requestHref(request: ChangeRequest): string {
  const payload = request.payload;
  switch (payload.domain) {
    case "refund":
      return `/refunds/${payload.refundCaseId}`;
    case "kyc":
      return `/kyc/${payload.kycCaseId}`;
    case "feature_flag":
      return `/flags/${payload.flagId}`;
    default:
      return assertNever(payload);
  }
}

function requestTitle(request: ChangeRequest): string {
  const payload = request.payload;
  switch (payload.domain) {
    case "refund":
      return `Refund ${formatMoney(payload.amount)} · ${payload.customerName}`;
    case "kyc":
      return `KYC ${payload.decision} · ${payload.customerName}`;
    case "feature_flag":
      return `${payload.flagKey} (${payload.environment}) → ${payload.proposedRolloutPercent}%`;
    default:
      return assertNever(payload);
  }
}

export default async function OverviewPage() {
  const { context, identity } = await getContainer();
  const actor = await identity.getCurrentActor();
  const pending = await listPendingApprovals(context, actor);
  const highRisk = pending.filter((request) => request.riskLevel === "high");
  const recentActivity = await listActivity(context, { limit: 8 });

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Approvals waiting on your teams and the latest consequential activity."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="pending-heading">
          <h2
            id="pending-heading"
            className="mb-3 text-sm font-semibold text-zinc-900"
          >
            Pending approvals
          </h2>
          {pending.length === 0 ? (
            <EmptyState title="No pending approvals" />
          ) : (
            <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
              {pending.map((request) => (
                <li key={request.id}>
                  <Link
                    href={requestHref(request)}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-900">
                        {requestTitle(request)}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {DOMAIN_LABELS[request.domain]} · requested by{" "}
                        {request.requesterName} · {formatAge(request.createdAt)}{" "}
                        ago · needs {ROLE_LABELS[request.requiredApproverRole]}
                      </p>
                    </div>
                    <RiskBadge level={request.riskLevel} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {highRisk.length > 0 ? (
            <p className="mt-2 text-xs text-zinc-500">
              {highRisk.length} high-risk{" "}
              {highRisk.length === 1 ? "item" : "items"} waiting for review.
            </p>
          ) : null}
        </section>
        <section aria-labelledby="activity-heading">
          <h2
            id="activity-heading"
            className="mb-3 text-sm font-semibold text-zinc-900"
          >
            Recent activity
          </h2>
          {recentActivity.length === 0 ? (
            <EmptyState title="No activity yet" />
          ) : (
            <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
              {recentActivity.map((event) => (
                <li key={event.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-zinc-900">
                      {EVENT_TYPE_LABELS[event.type]}
                    </p>
                    <span className="text-xs whitespace-nowrap text-zinc-400">
                      {formatAge(event.occurredAt)} ago
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-sm text-zinc-600">
                    {event.summary}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-center text-xs">
            <Link
              href="/activity"
              className="font-medium text-indigo-600 hover:text-indigo-700"
            >
              View all activity
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
