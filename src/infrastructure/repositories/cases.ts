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
import type { Db } from "../db";

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

export function createRefundCaseRepository(db: Db): RefundCaseRepository {
  return {
    async getById(id) {
      const { rows } = await db.query<RefundCaseRow>(
        "SELECT * FROM refund_cases WHERE id = $1",
        [id],
      );
      return rows[0] ? toRefundCase(rows[0]) : null;
    },
    async list() {
      const { rows } = await db.query<RefundCaseRow>(
        "SELECT * FROM refund_cases ORDER BY charged_at DESC",
      );
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

export function createKycCaseRepository(db: Db): KycCaseRepository {
  return {
    async getById(id) {
      const { rows } = await db.query<KycCaseRow>(
        "SELECT * FROM kyc_cases WHERE id = $1",
        [id],
      );
      return rows[0] ? toKycCase(rows[0]) : null;
    },
    async list() {
      const { rows } = await db.query<KycCaseRow>(
        "SELECT * FROM kyc_cases ORDER BY opened_at DESC",
      );
      return rows.map(toKycCase);
    },
    async setState(id, state, updatedAt) {
      await db.query(
        "UPDATE kyc_cases SET state = $1, updated_at = $2 WHERE id = $3",
        [state, updatedAt, id],
      );
    },
  };
}
