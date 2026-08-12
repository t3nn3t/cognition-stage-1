import type { ChangeRequestRepository } from "@/application/ports";
import type {
  ChangePayload,
  ChangeRequest,
  LifecycleState,
} from "@/domain/change-request";
import type { Role, WorkflowDomain } from "@/domain/shared";
import { assertNever } from "@/domain/shared";
import type { SqliteDatabase } from "../db";

interface ChangeRequestRow {
  id: string;
  correlation_id: string;
  domain: WorkflowDomain;
  payload: string;
  requester_id: string;
  requester_name: string;
  requester_roles: string;
  reason: string;
  risk_level: ChangeRequest["riskLevel"];
  matched_policy_ids: string;
  required_approver_role: Role;
  state: LifecycleState;
  approved_by_id: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  executed_at: string | null;
  failure_reason: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

function targetIdOf(payload: ChangePayload): string {
  switch (payload.domain) {
    case "refund":
      return payload.refundCaseId;
    case "kyc":
      return payload.kycCaseId;
    case "feature_flag":
      return payload.flagId;
    default:
      return assertNever(payload);
  }
}

function toChangeRequest(row: ChangeRequestRow): ChangeRequest {
  return {
    id: row.id,
    correlationId: row.correlation_id,
    domain: row.domain,
    payload: JSON.parse(row.payload) as ChangePayload,
    requesterId: row.requester_id,
    requesterName: row.requester_name,
    requesterRoles: JSON.parse(row.requester_roles) as Role[],
    reason: row.reason,
    riskLevel: row.risk_level,
    matchedPolicyIds: JSON.parse(row.matched_policy_ids) as string[],
    requiredApproverRole: row.required_approver_role,
    state: row.state,
    approvedById: row.approved_by_id,
    approvedByName: row.approved_by_name,
    approvedAt: row.approved_at,
    executedAt: row.executed_at,
    failureReason: row.failure_reason,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const OPEN_STATES: readonly LifecycleState[] = [
  "pending",
  "approved",
  "executing",
];

export function createChangeRequestRepository(
  db: SqliteDatabase,
): ChangeRequestRepository {
  return {
    getById(id) {
      const row = db
        .prepare("SELECT * FROM change_requests WHERE id = ?")
        .get(id) as ChangeRequestRow | undefined;
      return row ? toChangeRequest(row) : null;
    },
    insert(request) {
      db.prepare(
        `INSERT INTO change_requests (
          id, correlation_id, domain, payload, target_id, requester_id,
          requester_name, requester_roles, reason, risk_level,
          matched_policy_ids, required_approver_role, state, approved_by_id,
          approved_by_name, approved_at, executed_at, failure_reason, version,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        request.id,
        request.correlationId,
        request.domain,
        JSON.stringify(request.payload),
        targetIdOf(request.payload),
        request.requesterId,
        request.requesterName,
        JSON.stringify(request.requesterRoles),
        request.reason,
        request.riskLevel,
        JSON.stringify(request.matchedPolicyIds),
        request.requiredApproverRole,
        request.state,
        request.approvedById,
        request.approvedByName,
        request.approvedAt,
        request.executedAt,
        request.failureReason,
        request.version,
        request.createdAt,
        request.updatedAt,
      );
    },
    update(id, expectedVersion, changes) {
      const current = db
        .prepare("SELECT * FROM change_requests WHERE id = ?")
        .get(id) as ChangeRequestRow | undefined;
      if (!current) {
        return false;
      }
      const result = db
        .prepare(
          `UPDATE change_requests SET
            state = ?, approved_by_id = ?, approved_by_name = ?,
            approved_at = ?, executed_at = ?, failure_reason = ?,
            updated_at = ?, version = version + 1
          WHERE id = ? AND version = ?`,
        )
        .run(
          changes.state ?? current.state,
          changes.approvedById !== undefined
            ? changes.approvedById
            : current.approved_by_id,
          changes.approvedByName !== undefined
            ? changes.approvedByName
            : current.approved_by_name,
          changes.approvedAt !== undefined
            ? changes.approvedAt
            : current.approved_at,
          changes.executedAt !== undefined
            ? changes.executedAt
            : current.executed_at,
          changes.failureReason !== undefined
            ? changes.failureReason
            : current.failure_reason,
          changes.updatedAt,
          id,
          expectedVersion,
        );
      return result.changes === 1;
    },
    list(filter) {
      const clauses: string[] = [];
      const params: string[] = [];
      if (filter?.domain) {
        clauses.push("domain = ?");
        params.push(filter.domain);
      }
      if (filter?.state) {
        clauses.push("state = ?");
        params.push(filter.state);
      }
      const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
      const rows = db
        .prepare(
          `SELECT * FROM change_requests ${where} ORDER BY created_at DESC, id DESC`,
        )
        .all(...params) as ChangeRequestRow[];
      return rows.map(toChangeRequest);
    },
    findOpenByTarget(domain, targetId) {
      const rows = db
        .prepare(
          `SELECT * FROM change_requests
           WHERE domain = ? AND target_id = ? AND state IN (${OPEN_STATES.map(() => "?").join(", ")})`,
        )
        .all(domain, targetId, ...OPEN_STATES) as ChangeRequestRow[];
      return rows.map(toChangeRequest);
    },
  };
}
