import { notFound } from "next/navigation";
import { getRefundDetail } from "@/application/queries";
import { getContainer } from "@/infrastructure/container";
import { RiskBadge, StatusBadge } from "@/presentation/components/badges";
import { PageHeader } from "@/presentation/components/page-header";
import { RefundRequestForm } from "@/presentation/components/refund-request-form";
import { RequestActions } from "@/presentation/components/request-actions";
import { TechnicalDetails } from "@/presentation/components/technical-details";
import { Timeline } from "@/presentation/components/timeline";
import { formatDateTime, formatMoney } from "@/presentation/format";
import { ROLE_LABELS } from "@/presentation/labels";

export const dynamic = "force-dynamic";

export default async function RefundDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { context } = getContainer();
  const detail = getRefundDetail(context, id);
  if (!detail) {
    notFound();
  }
  const { refundCase, request, timeline } = detail;

  return (
    <div>
      <PageHeader
        title={`Refund · ${refundCase.customerName}`}
        description={`Order ${refundCase.orderId} · charged ${formatMoney(refundCase.chargeAmount)} on ${formatDateTime(refundCase.chargedAt)}`}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-zinc-900">
              Transaction context
            </h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-xs text-zinc-500">Customer</dt>
                <dd className="mt-0.5 text-zinc-900">
                  {refundCase.customerName}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Email</dt>
                <dd className="mt-0.5 text-zinc-900">
                  {refundCase.customerEmail}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Payment method</dt>
                <dd className="mt-0.5 text-zinc-900">
                  {refundCase.paymentMethod}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Original charge</dt>
                <dd className="mt-0.5 text-zinc-900">
                  {formatMoney(refundCase.chargeAmount)}
                </dd>
              </div>
            </dl>
          </section>
          <section className="rounded-lg border border-zinc-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">
                Risk signals
              </h2>
              <RiskBadge level={refundCase.riskLevel} />
            </div>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-600">
              {refundCase.riskSignals.map((signal) => (
                <li key={signal}>{signal}</li>
              ))}
            </ul>
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
                    Refund request
                  </h2>
                  <StatusBadge state={request.state} />
                </div>
                <p className="mt-3 text-2xl font-semibold text-zinc-900">
                  {request.payload.domain === "refund"
                    ? formatMoney(request.payload.amount)
                    : null}
                </p>
                <dl className="mt-3 space-y-2 text-sm">
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
                  {request.failureReason && request.state !== "rejected" ? (
                    <div>
                      <dt className="text-xs text-zinc-500">Last failure</dt>
                      <dd className="mt-0.5 text-red-700">
                        {request.failureReason}
                      </dd>
                    </div>
                  ) : null}
                </dl>
                <div className="mt-4">
                  <RequestActions
                    requestId={request.id}
                    state={request.state}
                    version={request.version}
                    executeLabel="Execute refund"
                  />
                </div>
              </>
            ) : (
              <>
                <h2 className="text-sm font-semibold text-zinc-900">
                  Request a refund
                </h2>
                <div className="mt-4">
                  <RefundRequestForm
                    refundCaseId={refundCase.id}
                    maxAmount={formatMoney(refundCase.chargeAmount)}
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
