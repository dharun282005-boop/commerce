# 12 · Testing and evaluation

## Commands

| Command | Runs |
|---------|------|
| `npm test` | Vitest across all workspaces |
| `npm run lint` | ESLint + Prettier check |
| `npm run typecheck` | `tsc --noEmit` per workspace |
| `npm run ci` | lint + typecheck + test (no Docker needed) |
| `npm run test:integration` | API + Postgres + Redis tests (needs `docker compose up -d postgres redis`) |
| `npm run eval` | Agent scenarios (Phase E) |

## Test pyramid

| Level | Tool | Examples |
|-------|------|----------|
| Unit | Vitest | money formatting, unit parsing, schema validation, each `GuardedAdapter` behaviour, fixture search per headline story |
| Service | Vitest + Supertest | `/v1/search` validation, partial failure, `/v1/sources` compliance output |
| Integration | Vitest + real Postgres/Redis | migrations apply, append-only trigger blocks UPDATE, Redis cache round trip |
| Evaluation | scripts | Matching P/R (C), cart gap vs exhaustive (C), agent scenarios (E) |
| End-to-end | Playwright | US-1..US-4 in the browser (F) |

## Phase B coverage of requirements

| Requirement | Test file |
|-------------|-----------|
| FR-NRM-01/02 | `packages/core/test/money.test.ts`, `units.test.ts`, `schemas.test.ts` |
| FR-LOC-01 | `packages/core/test/localities.test.ts` |
| FR-ADP-02/03 | `packages/core/test/guarded.test.ts` |
| FR-ADP-04 | `packages/core/test/search.test.ts`, `apps/api/test/search.test.ts` |
| US-1..4 data present | `packages/core/test/fixtures.test.ts` |
| FR-HIS-01 | `packages/db/test/db.integration.test.ts` |

## Determinism

Fixture data is static. Tests inject a clock (`ctx.now`) and a seeded random function, so retry
jitter and timestamps are reproducible.
