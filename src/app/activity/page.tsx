import Link from "next/link";
import { listActivity } from "@/application/queries";
import { EVENT_OUTCOMES } from "@/domain/events";
import type { ActivityEventOutcome } from "@/domain/events";
import { DOMAINS } from "@/domain/shared";
import type { WorkflowDomain } from "@/domain/shared";
import { getContainer } from "@/infrastructure/container";
import { OutcomeBadge } from "@/presentation/components/badges";
import { CopyButton } from "@/presentation/components/copy-button";
import { EmptyState } from "@/presentation/components/empty-state";
import { PageHeader } from "@/presentation/components/page-header";
import {
  Table,
  TableCell,
  TableHead,
  TableRow,
} from "@/presentation/components/table";
import { formatDateTime } from "@/presentation/format";
import {
  DOMAIN_LABELS,
  EVENT_TYPE_LABELS,
  OUTCOME_LABELS,
} from "@/presentation/labels";

export const dynamic = "force-dynamic";

function isDomain(value: string): value is WorkflowDomain {
  return (DOMAINS as readonly string[]).includes(value);
}

function isOutcome(value: string): value is ActivityEventOutcome {
  return (EVENT_OUTCOMES as readonly string[]).includes(value);
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const domainParam = typeof params.domain === "string" ? params.domain : "";
  const outcomeParam = typeof params.outcome === "string" ? params.outcome : "";
  const actorParam = typeof params.actor === "string" ? params.actor : "";
  const eventParam = typeof params.event === "string" ? params.event : "";

  const { context, identity } = getContainer();
  const events = listActivity(context, {
    domain: isDomain(domainParam) ? domainParam : undefined,
    outcome: isOutcome(outcomeParam) ? outcomeParam : undefined,
    actorId: actorParam || undefined,
  });
  const selected = eventParam
    ? (events.find((event) => event.id === eventParam) ?? null)
    : null;
  const actors = identity.listActors();

  const filterHref = (overrides: Record<string, string> = {}) => {
    const next = new URLSearchParams();
    const merged = {
      domain: domainParam,
      outcome: outcomeParam,
      actor: actorParam,
      ...overrides,
    };
    for (const [key, value] of Object.entries(merged)) {
      if (value) {
        next.set(key, value);
      }
    }
    const query = next.toString();
    return query ? `/activity?${query}` : "/activity";
  };

  return (
    <div>
      <PageHeader
        title="Activity"
        description="Attributable record of allowed and blocked attempts across all workflows."
      />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label
            htmlFor="filter-domain"
            className="block text-xs font-medium text-zinc-500"
          >
            Domain
          </label>
          <select
            id="filter-domain"
            name="domain"
            defaultValue={domainParam}
            className="mt-1 rounded-md border-0 bg-white px-2 py-1.5 text-sm ring-1 ring-inset ring-zinc-300"
          >
            <option value="">All domains</option>
            {DOMAINS.map((domain) => (
              <option key={domain} value={domain}>
                {DOMAIN_LABELS[domain]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="filter-outcome"
            className="block text-xs font-medium text-zinc-500"
          >
            Outcome
          </label>
          <select
            id="filter-outcome"
            name="outcome"
            defaultValue={outcomeParam}
            className="mt-1 rounded-md border-0 bg-white px-2 py-1.5 text-sm ring-1 ring-inset ring-zinc-300"
          >
            <option value="">All outcomes</option>
            {EVENT_OUTCOMES.map((outcome) => (
              <option key={outcome} value={outcome}>
                {OUTCOME_LABELS[outcome]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="filter-actor"
            className="block text-xs font-medium text-zinc-500"
          >
            Actor
          </label>
          <select
            id="filter-actor"
            name="actor"
            defaultValue={actorParam}
            className="mt-1 rounded-md border-0 bg-white px-2 py-1.5 text-sm ring-1 ring-inset ring-zinc-300"
          >
            <option value="">All actors</option>
            {actors.map((actor) => (
              <option key={actor.id} value={actor.id}>
                {actor.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50"
        >
          Apply filters
        </button>
        {domainParam || outcomeParam || actorParam ? (
          <Link
            href="/activity"
            className="py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            Clear
          </Link>
        ) : null}
      </form>
      <div className={selected ? "grid gap-6 lg:grid-cols-3" : ""}>
        <div className={selected ? "lg:col-span-2" : ""}>
          {events.length === 0 ? (
            <EmptyState
              title="No matching activity"
              description="Adjust the filters or take an action in one of the workflows."
            />
          ) : (
            <Table>
              <TableHead
                columns={["Event", "Outcome", "Domain", "Actor", "When", ""]}
              />
              <tbody>
                {events.map((event) => (
                  <TableRow
                    key={event.id}
                    href={filterHref({ event: event.id })}
                  >
                    <TableCell>
                      <span className="font-medium text-zinc-900">
                        {EVENT_TYPE_LABELS[event.type]}
                      </span>
                      <span className="block max-w-md truncate text-xs text-zinc-500">
                        {event.summary}
                      </span>
                    </TableCell>
                    <TableCell>
                      <OutcomeBadge outcome={event.outcome} />
                    </TableCell>
                    <TableCell>{DOMAIN_LABELS[event.domain]}</TableCell>
                    <TableCell>{event.actorName}</TableCell>
                    <TableCell className="whitespace-nowrap text-zinc-500">
                      {formatDateTime(event.occurredAt)}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={filterHref({ event: event.id })}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                      >
                        Details
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </tbody>
            </Table>
          )}
        </div>
        {selected ? (
          <aside
            aria-label="Event details"
            className="h-fit rounded-lg border border-zinc-200 bg-white p-5"
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-sm font-semibold text-zinc-900">
                {EVENT_TYPE_LABELS[selected.type]}
              </h2>
              <Link
                href={filterHref()}
                aria-label="Close details"
                className="text-sm text-zinc-400 hover:text-zinc-700"
              >
                ✕
              </Link>
            </div>
            <p className="mt-2 text-sm text-zinc-600">{selected.summary}</p>
            <dl className="mt-4 space-y-2 text-sm">
              <div>
                <dt className="text-xs text-zinc-500">Actor</dt>
                <dd className="mt-0.5 text-zinc-900">{selected.actorName}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Occurred</dt>
                <dd className="mt-0.5 text-zinc-900">
                  {formatDateTime(selected.occurredAt)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Event ID</dt>
                <dd className="mt-0.5 flex items-center gap-1 font-mono text-xs text-zinc-700">
                  <span className="truncate">{selected.id}</span>
                  <CopyButton value={selected.id} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Correlation ID</dt>
                <dd className="mt-0.5 flex items-center gap-1 font-mono text-xs text-zinc-700">
                  <span className="truncate">{selected.correlationId}</span>
                  <CopyButton value={selected.correlationId} />
                </dd>
              </div>
              {selected.requestId ? (
                <div>
                  <dt className="text-xs text-zinc-500">Request ID</dt>
                  <dd className="mt-0.5 flex items-center gap-1 font-mono text-xs text-zinc-700">
                    <span className="truncate">{selected.requestId}</span>
                    <CopyButton value={selected.requestId} />
                  </dd>
                </div>
              ) : null}
            </dl>
            {Object.keys(selected.metadata).length > 0 ? (
              <div className="mt-4">
                <p className="text-xs font-medium text-zinc-500">
                  Raw metadata
                </p>
                <pre className="mt-1 overflow-x-auto rounded-md bg-zinc-50 p-3 font-mono text-xs text-zinc-700">
                  {JSON.stringify(selected.metadata, null, 2)}
                </pre>
              </div>
            ) : null}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
