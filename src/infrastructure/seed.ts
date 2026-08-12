import type { Actor } from "@/domain/shared";
import type { SqliteDatabase } from "./db";

export const SEED_USERS: readonly Actor[] = [
  {
    id: "usr_maya",
    name: "Maya Chen",
    title: "Finance Operations Lead",
    roles: ["operations", "finance_approver"],
  },
  {
    id: "usr_theo",
    name: "Theo Grant",
    title: "Finance Approver",
    roles: ["finance_approver"],
  },
  {
    id: "usr_priya",
    name: "Priya Shah",
    title: "Compliance Officer",
    roles: ["compliance_approver"],
  },
  {
    id: "usr_alex",
    name: "Alex Morgan",
    title: "Release Manager",
    roles: ["release_approver"],
  },
];

export const DEFAULT_USER_ID = "usr_maya";

interface SeedRefundCase {
  id: string;
  orderId: string;
  customerName: string;
  customerEmail: string;
  chargeAmountCents: number;
  chargedAt: string;
  paymentMethod: string;
  riskSignals: string[];
  riskLevel: string;
}

const REFUND_CASES: readonly SeedRefundCase[] = [
  {
    id: "rfc_001",
    orderId: "ORD-48213",
    customerName: "Daniel Okafor",
    customerEmail: "d.okafor@example.com",
    chargeAmountCents: 125_000,
    chargedAt: "2026-08-03T14:22:00.000Z",
    paymentMethod: "Visa •••• 4242",
    riskSignals: [
      "Chargeback filed on a prior order",
      "Refund amount above the $500 finance threshold",
      "Account created less than 90 days ago",
    ],
    riskLevel: "high",
  },
  {
    id: "rfc_002",
    orderId: "ORD-48166",
    customerName: "Sofia Almeida",
    customerEmail: "s.almeida@example.com",
    chargeAmountCents: 18_900,
    chargedAt: "2026-08-05T09:41:00.000Z",
    paymentMethod: "Mastercard •••• 5119",
    riskSignals: ["Duplicate charge reported by customer support"],
    riskLevel: "low",
  },
  {
    id: "rfc_003",
    orderId: "ORD-47902",
    customerName: "Marcus Webb",
    customerEmail: "m.webb@example.com",
    chargeAmountCents: 74_050,
    chargedAt: "2026-07-29T18:03:00.000Z",
    paymentMethod: "Amex •••• 1006",
    riskSignals: [
      "Refund amount above the $500 finance threshold",
      "Second refund request in 30 days",
    ],
    riskLevel: "medium",
  },
  {
    id: "rfc_004",
    orderId: "ORD-48244",
    customerName: "Lena Fischer",
    customerEmail: "l.fischer@example.com",
    chargeAmountCents: 4_575,
    chargedAt: "2026-08-07T11:15:00.000Z",
    paymentMethod: "Visa •••• 8801",
    riskSignals: ["Service outage credit approved by support"],
    riskLevel: "low",
  },
];

interface SeedKycCase {
  id: string;
  customerName: string;
  customerEmail: string;
  reviewTrigger: string;
  riskLevel: string;
  riskRationale: string;
  state: string;
  evidence: { label: string; value: string; masked: boolean }[];
  openedAt: string;
}

const KYC_CASES: readonly SeedKycCase[] = [
  {
    id: "kyc_001",
    customerName: "Ravi Narayanan",
    customerEmail: "r.narayanan@example.com",
    reviewTrigger: "Watchlist name similarity",
    riskLevel: "high",
    riskRationale:
      "Partial name match against a sanctions watchlist entry combined with a recent change of registered address.",
    state: "pending_review",
    evidence: [
      { label: "Legal name", value: "Ravi Narayanan", masked: false },
      { label: "Date of birth", value: "••••-••-14", masked: true },
      { label: "Government ID", value: "P•••••••982", masked: true },
      {
        label: "Registered address",
        value: "Updated 12 days ago",
        masked: false,
      },
      {
        label: "Watchlist screen",
        value: "1 partial match (87% similarity)",
        masked: false,
      },
    ],
    openedAt: "2026-08-06T08:30:00.000Z",
  },
  {
    id: "kyc_002",
    customerName: "Emma Kowalski",
    customerEmail: "e.kowalski@example.com",
    reviewTrigger: "Document re-verification cycle",
    riskLevel: "low",
    riskRationale:
      "Routine periodic re-verification. Documents consistent with the existing profile; no adverse signals.",
    state: "pending_review",
    evidence: [
      { label: "Legal name", value: "Emma Kowalski", masked: false },
      { label: "Date of birth", value: "••••-••-02", masked: true },
      { label: "Government ID", value: "D•••••••441", masked: true },
      {
        label: "Document check",
        value: "Passed automated verification",
        masked: false,
      },
    ],
    openedAt: "2026-08-08T13:05:00.000Z",
  },
  {
    id: "kyc_003",
    customerName: "Tomás Herrera",
    customerEmail: "t.herrera@example.com",
    reviewTrigger: "Unusual transaction velocity",
    riskLevel: "high",
    riskRationale:
      "Inbound transfer volume increased 14x over the trailing 30 days with counterparties in three new jurisdictions.",
    state: "pending_review",
    evidence: [
      { label: "Legal name", value: "Tomás Herrera", masked: false },
      { label: "Date of birth", value: "••••-••-27", masked: true },
      { label: "Government ID", value: "N•••••••305", masked: true },
      {
        label: "30-day inbound volume",
        value: "$412,800 (14x baseline)",
        masked: false,
      },
      {
        label: "New jurisdictions",
        value: "3 since last review",
        masked: false,
      },
    ],
    openedAt: "2026-08-04T16:47:00.000Z",
  },
  {
    id: "kyc_004",
    customerName: "Grace Adeyemi",
    customerEmail: "g.adeyemi@example.com",
    reviewTrigger: "Address change verification",
    riskLevel: "low",
    riskRationale:
      "Customer-initiated address update supported by a matching utility bill; profile otherwise unchanged.",
    state: "pending_review",
    evidence: [
      { label: "Legal name", value: "Grace Adeyemi", masked: false },
      { label: "Date of birth", value: "••••-••-19", masked: true },
      { label: "Government ID", value: "P•••••••118", masked: true },
      {
        label: "Proof of address",
        value: "Utility bill, dated within 60 days",
        masked: false,
      },
    ],
    openedAt: "2026-08-09T10:12:00.000Z",
  },
];

interface SeedFlag {
  id: string;
  key: string;
  description: string;
  environment: string;
  rolloutPercent: number;
  ownerTeam: string;
  enabled: number;
  lastChangedAt: string | null;
}

const FEATURE_FLAGS: readonly SeedFlag[] = [
  {
    id: "flg_001",
    key: "instant-payouts",
    description: "Instant payout rail for verified merchants",
    environment: "production",
    rolloutPercent: 10,
    ownerTeam: "Payments",
    enabled: 1,
    lastChangedAt: "2026-08-01T09:00:00.000Z",
  },
  {
    id: "flg_002",
    key: "instant-payouts",
    description: "Instant payout rail for verified merchants",
    environment: "staging",
    rolloutPercent: 100,
    ownerTeam: "Payments",
    enabled: 1,
    lastChangedAt: "2026-07-21T15:30:00.000Z",
  },
  {
    id: "flg_003",
    key: "new-onboarding-flow",
    description: "Redesigned business onboarding with document autofill",
    environment: "production",
    rolloutPercent: 50,
    ownerTeam: "Onboarding",
    enabled: 1,
    lastChangedAt: "2026-08-05T12:00:00.000Z",
  },
  {
    id: "flg_004",
    key: "new-onboarding-flow",
    description: "Redesigned business onboarding with document autofill",
    environment: "staging",
    rolloutPercent: 100,
    ownerTeam: "Onboarding",
    enabled: 1,
    lastChangedAt: "2026-07-18T10:45:00.000Z",
  },
  {
    id: "flg_005",
    key: "risk-scoring-v3",
    description: "Third-generation transaction risk scoring model",
    environment: "production",
    rolloutPercent: 0,
    ownerTeam: "Risk",
    enabled: 0,
    lastChangedAt: null,
  },
];

/** Clears all data and restores the deterministic starting state. */
export function seed(db: SqliteDatabase): void {
  db.transaction(() => {
    db.exec(
      `DELETE FROM activity_events;
       DELETE FROM provider_executions;
       DELETE FROM change_requests;
       DELETE FROM users;
       DELETE FROM refund_cases;
       DELETE FROM kyc_cases;
       DELETE FROM feature_flags;`,
    );
    const insertUser = db.prepare(
      "INSERT INTO users (id, name, title, roles) VALUES (?, ?, ?, ?)",
    );
    for (const user of SEED_USERS) {
      insertUser.run(
        user.id,
        user.name,
        user.title,
        JSON.stringify(user.roles),
      );
    }
    const insertRefund = db.prepare(
      `INSERT INTO refund_cases (
        id, order_id, customer_name, customer_email, charge_amount_cents,
        charged_at, payment_method, risk_signals, risk_level
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const refund of REFUND_CASES) {
      insertRefund.run(
        refund.id,
        refund.orderId,
        refund.customerName,
        refund.customerEmail,
        refund.chargeAmountCents,
        refund.chargedAt,
        refund.paymentMethod,
        JSON.stringify(refund.riskSignals),
        refund.riskLevel,
      );
    }
    const insertKyc = db.prepare(
      `INSERT INTO kyc_cases (
        id, customer_name, customer_email, review_trigger, risk_level,
        risk_rationale, state, evidence, opened_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const kyc of KYC_CASES) {
      insertKyc.run(
        kyc.id,
        kyc.customerName,
        kyc.customerEmail,
        kyc.reviewTrigger,
        kyc.riskLevel,
        kyc.riskRationale,
        kyc.state,
        JSON.stringify(kyc.evidence),
        kyc.openedAt,
      );
    }
    const insertFlag = db.prepare(
      `INSERT INTO feature_flags (
        id, key, description, environment, rollout_percent, owner_team,
        enabled, last_changed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const flag of FEATURE_FLAGS) {
      insertFlag.run(
        flag.id,
        flag.key,
        flag.description,
        flag.environment,
        flag.rolloutPercent,
        flag.ownerTeam,
        flag.enabled,
        flag.lastChangedAt,
      );
    }
  })();
}
