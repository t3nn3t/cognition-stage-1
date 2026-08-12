# Operations Console

An internal operations product for a fintech: **refund operations**, **KYC
review**, and **feature-flag administration**, built on one shared,
server-enforced controlled-action foundation.

## Hypothesis and scope

These three workflows can share a single foundation — typed commands, policy
evaluation, separation of duties, reason capture, approval, idempotent provider
execution, and attributable activity history — while each team keeps a
purpose-built interface. This repository deliberately builds exactly those
three tools plus the reusable engineering foundation. It is intentionally
**not** a low-code editor, JSON app renderer, or workflow DSL.

## Architecture

Every mutation flows through one application command path:

```
typed command → validate → load actor and target → authorize → evaluate policy
→ persist attempt or transition → approve / execute provider adapter → persist outcome
```

```
src/
  domain/           Entities, value objects, typed commands (zod), events,
                    pure policy functions, lifecycle transitions. No I/O.
  application/      command-pipeline.ts (the shared path), queries, typed
                    results, and the port interfaces it depends on.
  infrastructure/   better-sqlite3 repositories, migration runner, seed data,
                    IdentityProvider, clock/IDs, deterministic provider adapters,
                    container.ts (composition root).
  presentation/     Shared UI primitives (table, badges, dialog, forms,
                    timeline, empty states), centralized labels and formatting.
  app/              Next.js App Router routes and server actions. Routes are
                    thin: parse input, resolve identity, call the pipeline.
db/migrations/      Checked-in SQL migrations.
tests/              Vitest unit (policies, labels) and integration (pipeline).
e2e/                Playwright acceptance journey.
```

Key invariants:

- Consequential rules run only on the server path; the UI never enforces policy alone.
- State changes and activity events are written in one SQLite transaction.
- Approvals use optimistic concurrency (`version` checks); stale or repeated
  approvals are rejected.
- Refund execution uses a provider idempotency key **distinct from** the
  request and correlation IDs; repeated execution of an executed request
  returns the original provider result.
- Blocked attempts are recorded as activity events without advancing the request.

## Getting started

```bash
npm ci                # install (Node >= 20)
npm run db:reset      # create + migrate + seed data/ops.sqlite
npm run dev           # http://localhost:3000
```

Enable development identity switching (used for the demonstration journey) by
running with:

```bash
OPS_IDENTITY_SWITCHING=enabled npm run dev
```

The switcher then appears inside the account menu (top right); switching
always returns to the Overview page. The server only accepts the three seeded
identities — Maya Chen (Operations Lead), Theo Grant (Finance & Compliance),
Priya Shah (Release Approver). Only operations members
can submit requests, and approve/reject controls are shown only to holders of
the required approver role (the server enforces both regardless); with the flag off, the switcher is absent
and identity falls back to the default seed user. The same `IdentityProvider`
interface is where OIDC/SSO claims would be mapped in production.

Other commands: `npm run format` / `format:check`, `npm run lint`,
`npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run build`.

## Demonstration journey

From a clean seed (`npm run db:reset`, or `POST /dev/reset` when the
development flag is enabled):

1. As **Maya Chen**, open Refunds → Daniel Okafor and request a **$1,250**
   refund with a reason. It routes to Finance approval and stays pending.
2. Maya holds the Finance Approver role, but approving her own request is
   blocked by separation of duties; the blocked attempt appears in Activity
   and the request remains pending.
3. Switch to **Theo Grant** (switching always returns to Overview) and
   approve.
4. Execute the refund — the payment adapter runs exactly once with its own
   idempotency key.
5. Retry execution — the original provider result is returned; Activity shows
   an idempotent replay, not a second payment.
6. As Maya, submit an **approve** decision on the high-risk KYC case
   (Ravi Narayanan). It routes to **Theo Grant** (Compliance) for approval.
7. On the production `instant-payouts` flag, propose 10% → 100% — blocked by
   policy (max 25-point production increase). Propose 10% → 35% — accepted and
   routed to **Priya Shah** (Release Approver).
8. Activity shows every allowed and blocked attempt in human-readable form,
   with filters and a raw-metadata detail panel.
9. Reset/reseed restores the deterministic starting state.

The same journey runs automatically in `e2e/acceptance.spec.ts`.

## Policies enforced on the server path

- Every consequential action requires a non-empty reason.
- A requester cannot approve their own request, even with the approver role.
- High-risk KYC outcomes require Compliance approval.
- Refunds above $500 require Finance approval.
- Every production feature-flag increase requires Release approval.
- A production rollout cannot increase by more than 25 percentage points per change.
- Blocked, rejected, failed, approved, executing, executed, and idempotently
  replayed attempts all create attributable activity events.

## Real versus mocked

| Area                  | Status                                                                           |
| --------------------- | -------------------------------------------------------------------------------- |
| Command pipeline      | Real — validation, authorization, policy, transactions, concurrency, idempotency |
| Policies              | Real — pure functions with unit tests                                            |
| Persistence           | Real SQLite with checked-in migrations; local file, not a managed database       |
| Activity history      | Real — recorded transactionally with state changes                               |
| Identity              | Seeded allowlist behind an `IdentityProvider` interface; no real OIDC/SSO        |
| Payment provider      | Deterministic in-process adapter; no real PSP call                               |
| KYC provider          | Deterministic in-process adapter; no real vendor call                            |
| Feature-flag provider | Deterministic in-process adapter; applies rollout to the local store             |
| Customer/case data    | Fictional seed data                                                              |

## Production mapping

- **Identity**: replace the cookie-based development switcher with OIDC/SSO
  claim mapping inside `IdentityProvider`; keep server-side role resolution.
- **Persistence**: the repository interfaces in `src/application/ports.ts` are
  the seam for moving to managed Postgres; domain policy and UI code do not
  change. Add connection pooling and migration tooling in CI.
- **Authorization**: the pipeline already refuses client-supplied identity;
  production adds token verification and audience checks at the boundary.
- **Providers**: real adapters need provider-side idempotency support, durable
  idempotency-key storage, an outbox or recovery worker for crash windows
  between intent and outcome, and periodic reconciliation against provider
  records. The `provider_executions` table records intent before execution and
  the outcome afterwards to make that recovery possible.
- **Event retention**: activity events are operational history, not a
  tamper-evident audit log; production needs retention policy, export, and
  access controls.
- **Observability**: add structured logs with correlation IDs, metrics on
  command outcomes, and alerting on execution failures.
- **CI/CD & on-call**: run the full verification suite in CI; page the owning
  team (Payments for refunds, Risk for KYC, Release for flags) on execution
  failure alerts.

## Adding a fourth controlled workflow

1. Add the domain payload variant to `ChangePayload` and a typed submit
   command in `src/domain/commands.ts`.
2. Add its policy branch to `evaluateSubmission` with a required approver role.
3. Add the target repository interface + SQLite implementation and seed data.
4. Add a provider adapter interface and deterministic implementation, and wire
   both into `container.ts` and the pipeline's `callProvider`/`applyDomainEffect`.
5. Build the queue/detail pages from the existing primitives; approvals,
   execution, activity, and the Overview queue work without foundation changes.

Exhaustive `switch` statements over the payload union make the compiler point
at every site that needs the new variant.

## Notes

The SQLite database is a local file (`data/`, gitignored); the mock adapters
are deterministic so the acceptance journey is reproducible. Generated code in
this repository still requires normal code review, security review, and
compliance controls before production use.
