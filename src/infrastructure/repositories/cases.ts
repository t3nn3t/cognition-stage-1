import type {
  KycCaseRepository,
  RefundCaseRepository,
} from "@/application/ports";
import type { RiskLevel } from "@/domain/shared";
import type {
  KycCase,
  KycEvidenceItem,
  KycState,
  RefundCase,
} from "@/domain/targets";
import type { SqliteDatabase } from "../db";

interface RefundCaseRow {
  id: string;
  order_id: string;
  customer_name: string;
  customer_email: string;
  charge_amount_cents: number;
  charged_at: string;
  payment_method: string;
  risk_signals: string;
  risk_level: RiskLevel;
}

function toRefundCase(row: RefundCaseRow): RefundCase {
  return {
    id: row.id,
    orderId: row.order_id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    chargeAmount: { amountCents: row.charge_amount_cents, currency: "USD" },
    chargedAt: row.charged_at,
    paymentMethod: row.payment_method,
    riskSignals: JSON.parse(row.risk_signals) as string[],
    riskLevel: row.risk_level,
  };
}

export function createRefundCaseRepository(
  db: SqliteDatabase,
): RefundCaseRepository {
  return {
    getById(id) {
      const row = db
        .prepare("SELECT * FROM refund_cases WHERE id = ?")
        .get(id) as RefundCaseRow | undefined;
      return row ? toRefundCase(row) : null;
    },
    list() {
      const rows = db
        .prepare("SELECT * FROM refund_cases ORDER BY charged_at DESC")
        .all() as RefundCaseRow[];
      return rows.map(toRefundCase);
    },
  };
}

interface KycCaseRow {
  id: string;
  customer_name: string;
  customer_email: string;
  review_trigger: string;
  risk_level: RiskLevel;
  risk_rationale: string;
  state: KycState;
  evidence: string;
  opened_at: string;
}

function toKycCase(row: KycCaseRow): KycCase {
  return {
    id: row.id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    reviewTrigger: row.review_trigger,
    riskLevel: row.risk_level,
    riskRationale: row.risk_rationale,
    state: row.state,
    evidence: JSON.parse(row.evidence) as KycEvidenceItem[],
    openedAt: row.opened_at,
  };
}

export function createKycCaseRepository(
  db: SqliteDatabase,
): KycCaseRepository {
  return {
    getById(id) {
      const row = db.prepare("SELECT * FROM kyc_cases WHERE id = ?").get(id) as
        | KycCaseRow
        | undefined;
      return row ? toKycCase(row) : null;
    },
    list() {
      const rows = db
        .prepare("SELECT * FROM kyc_cases ORDER BY opened_at DESC")
        .all() as KycCaseRow[];
      return rows.map(toKycCase);
    },
    setState(id, state, updatedAt) {
      db.prepare(
        "UPDATE kyc_cases SET state = ?, updated_at = ? WHERE id = ?",
      ).run(state, updatedAt, id);
    },
  };
}
