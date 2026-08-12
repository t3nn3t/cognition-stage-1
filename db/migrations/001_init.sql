CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  roles TEXT NOT NULL
);

CREATE TABLE refund_cases (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  charge_amount_cents INTEGER NOT NULL,
  charged_at TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  risk_signals TEXT NOT NULL,
  risk_level TEXT NOT NULL
);

CREATE TABLE kyc_cases (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  review_trigger TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  risk_rationale TEXT NOT NULL,
  state TEXT NOT NULL,
  evidence TEXT NOT NULL,
  opened_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE TABLE feature_flags (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL,
  description TEXT NOT NULL,
  environment TEXT NOT NULL,
  rollout_percent INTEGER NOT NULL,
  owner_team TEXT NOT NULL,
  enabled INTEGER NOT NULL,
  last_changed_at TEXT
);

CREATE TABLE change_requests (
  id TEXT PRIMARY KEY,
  correlation_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  payload TEXT NOT NULL,
  target_id TEXT NOT NULL,
  requester_id TEXT NOT NULL,
  requester_name TEXT NOT NULL,
  requester_roles TEXT NOT NULL,
  reason TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  matched_policy_ids TEXT NOT NULL,
  required_approver_role TEXT NOT NULL,
  state TEXT NOT NULL,
  approved_by_id TEXT,
  approved_by_name TEXT,
  approved_at TEXT,
  executed_at TEXT,
  failure_reason TEXT,
  version INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_change_requests_domain_state ON change_requests (domain, state);
CREATE INDEX idx_change_requests_target ON change_requests (domain, target_id);

CREATE TABLE activity_events (
  id TEXT PRIMARY KEY,
  request_id TEXT,
  correlation_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  type TEXT NOT NULL,
  outcome TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  summary TEXT NOT NULL,
  metadata TEXT NOT NULL,
  occurred_at TEXT NOT NULL
);

CREATE INDEX idx_activity_events_domain ON activity_events (domain);
CREATE INDEX idx_activity_events_request ON activity_events (request_id);
CREATE INDEX idx_activity_events_occurred ON activity_events (occurred_at);

CREATE TABLE provider_executions (
  request_id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  provider_reference TEXT,
  detail TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);
