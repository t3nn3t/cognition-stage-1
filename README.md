# Operations Console

An internal fintech operations tool for **refunds**, **KYC review**, and
**feature-flag administration**. Every change runs through one shared,
server-enforced path: an operations member requests it, business policies are
checked, a different person with the right approver role approves it, the
external action executes once, and everything is tracked in the activity history.

## Running it

Requires Node >= 20 and Docker.

```bash
npm ci                                        # install dependencies
npx playwright install chromium               # browser for the e2e tests
docker compose up -d                          # start local Postgres 16
npm run db:reset                              # migrate + seed the database
OPS_IDENTITY_SWITCHING=enabled npm run dev    # http://localhost:3000
```

The `OPS_IDENTITY_SWITCHING` flag enables the development-only user switcher
in the account menu (top right). The three seeded users are:

- **Maya Chen** — Operations Lead (submits requests, approves finance)
- **Theo Grant** — Finance & Compliance approver
- **Priya Shah** — Release approver

Run `npm run db:reset` anytime to restore the deterministic seed data.

## Other commands

```bash
npm test              # unit + integration tests (uses the ops_test database)
npm run test:e2e      # Playwright browser tests (uses the ops_e2e database)
npm run lint          # eslint
npm run typecheck     # tsc --noEmit
npm run build         # production build
```

External providers (payment, KYC, feature flags) are deterministic in-process
mocks; the data is fictional seed data. See `AGENTS.md` for architecture
details.
