import type { ActivityEventRepository } from "@/application/ports";
import type {
  ActivityEvent,
  ActivityEventOutcome,
  ActivityEventType,
} from "@/domain/events";
import type { WorkflowDomain } from "@/domain/shared";
import type { SqliteDatabase } from "../db";

interface ActivityEventRow {
  id: string;
  request_id: string | null;
  correlation_id: string;
  domain: WorkflowDomain;
  type: ActivityEventType;
  outcome: ActivityEventOutcome;
  actor_id: string;
  actor_name: string;
  summary: string;
  metadata: string;
  occurred_at: string;
}

function toActivityEvent(row: ActivityEventRow): ActivityEvent {
  return {
    id: row.id,
    requestId: row.request_id,
    correlationId: row.correlation_id,
    domain: row.domain,
    type: row.type,
    outcome: row.outcome,
    actorId: row.actor_id,
    actorName: row.actor_name,
    summary: row.summary,
    metadata: JSON.parse(row.metadata) as Record<string, string>,
    occurredAt: row.occurred_at,
  };
}

export function createActivityEventRepository(
  db: SqliteDatabase,
): ActivityEventRepository {
  return {
    insert(event) {
      db.prepare(
        `INSERT INTO activity_events (
          id, request_id, correlation_id, domain, type, outcome, actor_id,
          actor_name, summary, metadata, occurred_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        event.id,
        event.requestId,
        event.correlationId,
        event.domain,
        event.type,
        event.outcome,
        event.actorId,
        event.actorName,
        event.summary,
        JSON.stringify(event.metadata),
        event.occurredAt,
      );
    },
    list(filter) {
      const clauses: string[] = [];
      const params: (string | number)[] = [];
      if (filter?.domain) {
        clauses.push("domain = ?");
        params.push(filter.domain);
      }
      if (filter?.actorId) {
        clauses.push("actor_id = ?");
        params.push(filter.actorId);
      }
      if (filter?.outcome) {
        clauses.push("outcome = ?");
        params.push(filter.outcome);
      }
      if (filter?.requestId) {
        clauses.push("request_id = ?");
        params.push(filter.requestId);
      }
      if (filter?.correlationId) {
        clauses.push("correlation_id = ?");
        params.push(filter.correlationId);
      }
      if (filter?.types && filter.types.length > 0) {
        clauses.push(
          `type IN (${filter.types.map(() => "?").join(", ")})`,
        );
        params.push(...filter.types);
      }
      if (filter?.since) {
        clauses.push("occurred_at >= ?");
        params.push(filter.since);
      }
      const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
      const limit = filter?.limit ?? 200;
      const rows = db
        .prepare(
          `SELECT * FROM activity_events ${where} ORDER BY occurred_at DESC, id DESC LIMIT ?`,
        )
        .all(...params, limit) as ActivityEventRow[];
      return rows.map(toActivityEvent);
    },
  };
}
