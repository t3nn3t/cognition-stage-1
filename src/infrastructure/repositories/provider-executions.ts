import type {
  ProviderExecutionRecord,
  ProviderExecutionRepository,
} from "@/application/ports";
import type { SqliteDatabase } from "../db";

interface ProviderExecutionRow {
  request_id: string;
  idempotency_key: string;
  status: ProviderExecutionRecord["status"];
  provider_reference: string | null;
  detail: string | null;
  created_at: string;
  completed_at: string | null;
}

function toRecord(row: ProviderExecutionRow): ProviderExecutionRecord {
  return {
    requestId: row.request_id,
    idempotencyKey: row.idempotency_key,
    status: row.status,
    providerReference: row.provider_reference,
    detail: row.detail,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

export function createProviderExecutionRepository(
  db: SqliteDatabase,
): ProviderExecutionRepository {
  return {
    getByRequestId(requestId) {
      const row = db
        .prepare("SELECT * FROM provider_executions WHERE request_id = ?")
        .get(requestId) as ProviderExecutionRow | undefined;
      return row ? toRecord(row) : null;
    },
    recordIntent(record) {
      db.prepare(
        `INSERT INTO provider_executions (
          request_id, idempotency_key, status, provider_reference, detail,
          created_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        record.requestId,
        record.idempotencyKey,
        record.status,
        record.providerReference,
        record.detail,
        record.createdAt,
        record.completedAt,
      );
    },
    recordOutcome(requestId, status, providerReference, detail, completedAt) {
      db.prepare(
        `UPDATE provider_executions
         SET status = ?, provider_reference = ?, detail = ?, completed_at = ?
         WHERE request_id = ?`,
      ).run(status, providerReference, detail, completedAt, requestId);
    },
  };
}
