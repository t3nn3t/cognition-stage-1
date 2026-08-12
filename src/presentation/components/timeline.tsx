import type { ActivityEvent } from "@/domain/events";
import { formatDateTime } from "../format";
import { EVENT_TYPE_LABELS } from "../labels";
import { OutcomeBadge } from "./badges";

export function Timeline({ events }: { events: readonly ActivityEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-zinc-500">No activity yet.</p>;
  }
  const ordered = [...events].sort((a, b) =>
    a.occurredAt.localeCompare(b.occurredAt),
  );
  return (
    <ol className="space-y-4">
      {ordered.map((event) => (
        <li key={event.id} className="flex gap-3">
          <div
            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
              event.outcome === "allowed"
                ? "bg-emerald-500"
                : event.outcome === "blocked"
                  ? "bg-amber-500"
                  : "bg-red-500"
            }`}
            aria-hidden
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-zinc-900">
                {EVENT_TYPE_LABELS[event.type]}
              </span>
              <OutcomeBadge outcome={event.outcome} />
            </div>
            <p className="mt-0.5 text-sm text-zinc-600">{event.summary}</p>
            <p className="mt-0.5 text-xs text-zinc-400">
              {event.actorName} · {formatDateTime(event.occurredAt)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
