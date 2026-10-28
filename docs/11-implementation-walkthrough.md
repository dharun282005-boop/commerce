# 11 · Implementation walkthrough

| Phase | Builds | Gate (must pass, output pasted in `docs/progress/phase-X.md`) | Status |
|-------|--------|---------------------------------------------------------------|--------|
| A | Docs blueprint, compliance matrix, decision list | Docs reviewed by owner | Done (2026-10-28) |
| B | Monorepo, Docker Compose, migrations, schemas, localities, FixtureAdapter (4 verticals), GuardedAdapter, search API | `npm run ci` green; `docker compose up` healthy; fixture search returns data | Done (2026-10-28) |
| C | Normalisation, matching + eval set, Bayesian rating, landed cost, score, cart split, property dedupe | Eval report (P/R/F1) and hand-computed unit tests | Next |
| D | Real adapters, **only with per-source approval** | Compliance record + health checks per source | Waiting on owner |
| E | Agent tools, system prompt, streaming, safety, evals | `npm run eval` report | — |
| F | Web app, i18n, a11y, perf, PWA | Playwright e2e for US-1..US-4 | — |
| G | Security review, load test, observability, deployment guide, final report | Review checklist + load test numbers | — |

## Phase B steps (as built)

1. Root workspace: `package.json` (npm workspaces), `tsconfig.base.json`, ESLint flat config, Prettier,
   `.gitignore`, `.env.example`.
2. `packages/core`: money, units, Zod schemas, localities.
3. `packages/core`: adapter types, `GuardedAdapter` (gate, cache, rate limit, timeout, retry, breaker),
   registry + kill switches.
4. `packages/core`: fixture data for four verticals and `FixtureAdapter`; `searchAll()`.
5. `packages/db`: Drizzle schema, SQL migrations (extensions, append-only trigger), seed script,
   observation store.
6. `apps/api`: Fastify app, routes, Redis cache, metrics, OpenAPI, Dockerfile.
7. `docker-compose.yml`, end-to-end smoke run, progress report.

## How to work on a later phase

1. Read the phase section here and the matching blueprint doc (07 for C, 06 for D, 08 for E, 10 for F).
2. Check current library versions and docs; update [04](04-tech-stack-and-mac-setup.md).
3. Build in small commits (`phase-X: …`), run `npm run ci` often.
4. Write `docs/progress/phase-X.md` with real output, then tag `phase-X-done`.
