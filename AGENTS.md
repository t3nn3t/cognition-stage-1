# AGENTS.md — Operations Console

Internal operations product for a fintech: refunds, KYC review, and feature-flag
administration on one server-enforced controlled-action foundation.

## Architecture rules

Four layers under `src/`. Dependencies point inward only:

- `src/domain` — entities, value objects, commands, events, policies, lifecycle
  transitions. Pure TypeScript. No I/O, no framework imports, no `Date.now()`.
- `src/application` — use cases orchestrating validate → load actor/target →
  authorize → evaluate policy → persist → approve/execute → record outcome.
  Depends only on `domain` and on interfaces it defines (repositories, providers,
  identity, clock, IDs). Never imports `infrastructure` or `presentation`.
- `src/infrastructure` — better-sqlite3 repositories, migrations runner, seed
  data, `IdentityProvider`, clock/ID generation, deterministic provider adapters.
  Implements `application` interfaces.
- `src/presentation` — shared UI primitives, view models, formatting. Server
  components/actions call application use cases via `src/infrastructure/container.ts`.

Hard rules:

- All consequential rules run on the server path. UI never enforces policy alone.
- UI components never touch the database or provider adapters directly.
- Every mutation goes through the shared command pipeline in
  `src/application/command-pipeline.ts` — no per-workflow bypasses.
- State changes and activity events are written in one SQLite transaction.
- Approvals use optimistic concurrency (`version` checks). Refund execution uses
  a provider idempotency key distinct from request/correlation IDs.
- Identity resolves server-side via `IdentityProvider`; only seeded identities
  are accepted. No client-controlled authorization.
- No `any`, no unsafe casts, no stringly typed lifecycle logic. Use discriminated
  unions with exhaustive `switch` (see `assertNever` in `src/domain/shared.ts`).
- Typed results distinguish validation, authorization, policy block, conflict,
  invalid transition, provider failure, and idempotent replay.
- Event labels, status labels, and date/currency formatting live in
  `src/presentation/format.ts` and `src/presentation/labels.ts` only.
- No new dependencies without clear justification in the PR.
- No JSON app renderers, workflow DSLs, or plugin systems.

## Commands

```
npm ci                 # clean install
npm run db:reset       # recreate + migrate + seed data/ops.sqlite
npm run dev            # dev server (http://localhost:3000)
npm run format         # prettier --write
npm run format:check
npm run lint           # eslint, zero warnings expected
npm run typecheck      # tsc --noEmit (strict)
npm test               # vitest unit + integration
npm run test:e2e       # playwright acceptance journey (builds + starts prod server)
npm run build          # production build
```

## Verification required before any PR

1. `npm run format:check`, `npm run lint`, `npm run typecheck` — all clean.
2. `npm test` and `npm run test:e2e` — all green from a clean seed.
3. `npm run build` — no errors or material warnings.
4. `npm ci && npm audit && npm audit --omit=dev` — no high/critical production
   findings; triage anything else explicitly in the PR.

## Coding standards

- Prettier formats everything; do not hand-format.
- Small focused components; no giant page components or nested ternaries.
- Server actions are thin: parse input, resolve identity, call a use case,
  map the typed result to UI feedback.
- Tests live in `tests/` (vitest) and `e2e/` (Playwright). Policy functions get
  focused unit tests; the command pipeline gets integration tests against an
  in-memory SQLite database.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
