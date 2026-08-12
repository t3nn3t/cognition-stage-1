import { notFound } from "next/navigation";
import { getFlagDetail } from "@/application/queries";
import { getContainer } from "@/infrastructure/container";
import {
  EnvironmentBadge,
  StatusBadge,
} from "@/presentation/components/badges";
import { FlagChangeForm } from "@/presentation/components/flag-change-form";
import { PageHeader } from "@/presentation/components/page-header";
import { RequestActions } from "@/presentation/components/request-actions";
import { TechnicalDetails } from "@/presentation/components/technical-details";
import { Timeline } from "@/presentation/components/timeline";
import { ROLE_LABELS } from "@/presentation/labels";

export const dynamic = "force-dynamic";

export default async function FlagDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { context } = getContainer();
  const detail = getFlagDetail(context, id);
  if (!detail) {
    notFound();
  }
  const { flag, request, timeline } = detail;
  const openRequest =
    request &&
    (request.state === "pending" ||
      request.state === "approved" ||
      request.state === "executing" ||
      request.state === "failed");

  return (
    <div>
      <PageHeader
        title={flag.key}
        description={flag.description}
        actions={<EnvironmentBadge environment={flag.environment} />}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-zinc-900">
              Current state
            </h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-xs text-zinc-500">Rollout</dt>
                <dd className="mt-0.5 text-2xl font-semibold text-zinc-900">
                  {flag.rolloutPercent}%
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Owner</dt>
                <dd className="mt-0.5 text-zinc-900">{flag.ownerTeam}</dd>
              </div>
            </dl>
          </section>
          <section className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-zinc-900">Activity</h2>
            <div className="mt-4">
              <Timeline events={timeline} />
            </div>
          </section>
        </div>
        <div className="space-y-6">
          <section className="rounded-lg border border-zinc-200 bg-white p-5">
            {openRequest ? (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-zinc-900">
                    Change request
                  </h2>
                  <StatusBadge state={request.state} />
                </div>
                <dl className="mt-3 space-y-2 text-sm">
                  <div>
                    <dt className="text-xs text-zinc-500">Proposed change</dt>
                    <dd className="mt-0.5 text-zinc-900">
                      {request.payload.domain === "feature_flag"
                        ? `${request.payload.currentRolloutPercent}% → ${request.payload.proposedRolloutPercent}%`
                        : null}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-zinc-500">Reason</dt>
                    <dd className="mt-0.5 text-zinc-900">{request.reason}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-zinc-500">Requested by</dt>
                    <dd className="mt-0.5 text-zinc-900">
                      {request.requesterName}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-zinc-500">Approval</dt>
                    <dd className="mt-0.5 text-zinc-900">
                      {request.approvedByName
                        ? `Approved by ${request.approvedByName}`
                        : `Requires ${ROLE_LABELS[request.requiredApproverRole]}`}
                    </dd>
                  </div>
                </dl>
                <div className="mt-4">
                  <RequestActions
                    requestId={request.id}
                    state={request.state}
                    version={request.version}
                    executeLabel="Apply change"
                  />
                </div>
              </>
            ) : (
              <>
                <h2 className="text-sm font-semibold text-zinc-900">
                  Propose a rollout change
                </h2>
                <div className="mt-4">
                  <FlagChangeForm
                    flagId={flag.id}
                    environment={flag.environment}
                    currentRolloutPercent={flag.rolloutPercent}
                  />
                </div>
              </>
            )}
          </section>
          {request ? (
            <TechnicalDetails
              entries={[
                { label: "Request ID", value: request.id },
                { label: "Correlation ID", value: request.correlationId },
                {
                  label: "Matched policies",
                  value: request.matchedPolicyIds.join(", "),
                },
                { label: "Version", value: String(request.version) },
              ]}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
