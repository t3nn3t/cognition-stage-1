import type { ChangeRequestRepository } from "@/application/ports";
import type {
  ChangePayload,
  ChangeRequest,
  LifecycleState,
} from "@/domain/change-request";
import type { Role, WorkflowDomain } from "@/domain/shared";
import { assertNever } from "@/domain/shared";
import type { Db } from "../db";

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

export function createChangeRequestRepository(db: Db): ChangeRequestRepository {
  return {
    async getById(id) {
      const { rows } = await db.query<ChangeRequestRow>(
        "SELECT * FROM change_requests WHERE id = $1",
        [id],
      );
      return rows[0] ? toChangeRequest(rows[0]) : null;
    },
    async insert(request) {
      await db.query(
        `INSERT INTO change_requests (
          id, correlation_id, domain, payload, target_id, requester_id,
          requester_name, requester_roles, reason, risk_level,
          matched_policy_ids, required_approver_role, state, approved_by_id,
          approved_by_name, approved_at, executed_at, failure_reason, version,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
          $15, $16, $17, $18, $19, $20, $21)`,
        [
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
        ],
      );
    },
    async update(id, expectedVersion, changes) {
      const { rows } = await db.query<ChangeRequestRow>(
        "SELECT * FROM change_requests WHERE id = $1",
        [id],
      );
      const current = rows[0];
      if (!current) {
        return false;
      }
      const { rowCount } = await db.query(
        `UPDATE change_requests SET
          state = $1, approved_by_id = $2, approved_by_name = $3,
          approved_at = $4, executed_at = $5, failure_reason = $6,
          updated_at = $7, version = version + 1
        WHERE id = $8 AND version = $9`,
        [
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
        ],
      );
      return rowCount === 1;
    },
    async list(filter) {
      const clauses: string[] = [];
      const params: string[] = [];
      if (filter?.domain) {
        params.push(filter.domain);
        clauses.push(`domain = $${params.length}`);
      }
      if (filter?.state) {
        params.push(filter.state);
        clauses.push(`state = $${params.length}`);
      }
      const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
      const { rows } = await db.query<ChangeRequestRow>(
        `SELECT * FROM change_requests ${where} ORDER BY created_at DESC, id DESC`,
        params,
      );
      return rows.map(toChangeRequest);
    },
    async findOpenByTarget(domain, targetId) {
      const { rows } = await db.query<ChangeRequestRow>(
        `SELECT * FROM change_requests
         WHERE domain = $1 AND target_id = $2 AND state = ANY($3)`,
        [domain, targetId, OPEN_STATES],
      );
      return rows.map(toChangeRequest);
    },
  };
}
