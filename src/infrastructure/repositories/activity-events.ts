import type { ActivityEventRepository } from "@/application/ports";
import type {
  ActivityEvent,
  ActivityEventOutcome,
  ActivityEventType,
} from "@/domain/events";
import type { WorkflowDomain } from "@/domain/shared";
import type { Db } from "../db";

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

export function createActivityEventRepository(db: Db): ActivityEventRepository {
  return {
    async insert(event) {
      await db.query(
        `INSERT INTO activity_events (
          id, request_id, correlation_id, domain, type, outcome, actor_id,
          actor_name, summary, metadata, occurred_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
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
        ],
      );
    },
    async list(filter) {
      const clauses: string[] = [];
      const params: unknown[] = [];
      if (filter?.domain) {
        params.push(filter.domain);
        clauses.push(`domain = $${params.length}`);
      }
      if (filter?.actorId) {
        params.push(filter.actorId);
        clauses.push(`actor_id = $${params.length}`);
      }
      if (filter?.outcome) {
        params.push(filter.outcome);
        clauses.push(`outcome = $${params.length}`);
      }
      if (filter?.requestId) {
        params.push(filter.requestId);
        clauses.push(`request_id = $${params.length}`);
      }
      if (filter?.correlationId) {
        params.push(filter.correlationId);
        clauses.push(`correlation_id = $${params.length}`);
      }
      if (filter?.types && filter.types.length > 0) {
        params.push([...filter.types]);
        clauses.push(`type = ANY($${params.length})`);
      }
      if (filter?.since) {
        params.push(filter.since);
        clauses.push(`occurred_at >= $${params.length}`);
      }
      const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
      params.push(filter?.limit ?? 200);
      const { rows } = await db.query<ActivityEventRow>(
        `SELECT * FROM activity_events ${where} ORDER BY occurred_at DESC, id DESC LIMIT $${params.length}`,
        params,
      );
      return rows.map(toActivityEvent);
    },
  };
}
