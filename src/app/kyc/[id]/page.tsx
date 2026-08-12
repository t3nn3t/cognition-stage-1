import { notFound } from "next/navigation";
import { getKycDetail } from "@/application/queries";
import { getContainer } from "@/infrastructure/container";
import {
  KycStateBadge,
  RiskBadge,
  StatusBadge,
} from "@/presentation/components/badges";
import { KycDecisionForm } from "@/presentation/components/kyc-decision-form";
import { PageHeader } from "@/presentation/components/page-header";
import { RequestActions } from "@/presentation/components/request-actions";
import { TechnicalDetails } from "@/presentation/components/technical-details";
import { Timeline } from "@/presentation/components/timeline";
import { KYC_DECISION_LABELS, ROLE_LABELS } from "@/presentation/labels";

export const dynamic = "force-dynamic";

export default async function KycDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const container = getContainer();
  const { context } = container;
  const actor = await container.identity.getCurrentActor();
  const detail = getKycDetail(context, id);
  if (!detail) {
    notFound();
  }
  const { kycCase, request, timeline } = detail;
  const openDecision = kycCase.state === "pending_review" && !request;

  return (
    <div>
      <PageHeader
        title={`KYC · ${kycCase.customerName}`}
        description={kycCase.reviewTrigger}
        actions={<KycStateBadge state={kycCase.state} />}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-zinc-900">Evidence</h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {kycCase.evidence.map((item) => (
                <div key={item.label}>
                  <dt className="text-xs text-zinc-500">{item.label}</dt>
                  <dd
                    className={`mt-0.5 ${item.masked ? "font-mono" : ""} text-zinc-900`}
                  >
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="rounded-lg border border-zinc-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">
                Risk rationale
              </h2>
              <RiskBadge level={kycCase.riskLevel} />
            </div>
            <p className="mt-3 text-sm text-zinc-600">
              {kycCase.riskRationale}
            </p>
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
            {request ? (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-zinc-900">
                    Decision request
                  </h2>
                  <StatusBadge state={request.state} />
                </div>
                <dl className="mt-3 space-y-2 text-sm">
                  <div>
                    <dt className="text-xs text-zinc-500">Proposed decision</dt>
                    <dd className="mt-0.5 text-zinc-900">
                      {request.payload.domain === "kyc"
                        ? KYC_DECISION_LABELS[request.payload.decision]
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
                    executeLabel="Apply decision"
                    canDecide={actor.roles.includes(
                      request.requiredApproverRole,
                    )}
                    canExecute={
                      actor.roles.includes("operations") ||
                      actor.roles.includes(request.requiredApproverRole)
                    }
                    isRequester={actor.id === request.requesterId}
                  />
                </div>
              </>
            ) : openDecision ? (
              <>
                <h2 className="text-sm font-semibold text-zinc-900">
                  Record a decision
                </h2>
                {actor.roles.includes("operations") ? (
                  <div className="mt-4">
                    <KycDecisionForm
                      kycCaseId={kycCase.id}
                      highRisk={kycCase.riskLevel === "high"}
                    />
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-zinc-500">
                    Only operations team members can record decisions.
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-zinc-500">
                This case has been decided.
              </p>
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
