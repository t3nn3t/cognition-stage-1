import type {
  ProviderExecutionRecord,
  ProviderExecutionRepository,
} from "@/application/ports";
import type { Db } from "../db";

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
  db: Db,
): ProviderExecutionRepository {
  return {
    async getByRequestId(requestId) {
      const { rows } = await db.query<ProviderExecutionRow>(
        "SELECT * FROM provider_executions WHERE request_id = $1",
        [requestId],
      );
      return rows[0] ? toRecord(rows[0]) : null;
    },
    async recordIntent(record) {
      await db.query(
        `INSERT INTO provider_executions (
          request_id, idempotency_key, status, provider_reference, detail,
          created_at, completed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          record.requestId,
          record.idempotencyKey,
          record.status,
          record.providerReference,
          record.detail,
          record.createdAt,
          record.completedAt,
        ],
      );
    },
    async recordOutcome(
      requestId,
      status,
      providerReference,
      detail,
      completedAt,
    ) {
      await db.query(
        `UPDATE provider_executions
         SET status = $1, provider_reference = $2, detail = $3, completed_at = $4
         WHERE request_id = $5`,
        [status, providerReference, detail, completedAt, requestId],
      );
    },
  };
}
