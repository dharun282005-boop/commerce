# Decisions log

| Date | Decision | Reason | Alternatives rejected |
|------|----------|--------|-----------------------|
| 2026-10-28 | Fixture-only data mode | Owner: "for now use dummy datasets or customised datas" | Real sources (need keys, approvals and Terms review) |
| 2026-10-28 | Fixture restaurants and property listings are fictional | Avoids inventing ratings for real businesses (rule 3) | Real restaurant names with fake ratings |
| 2026-10-28 | Fixture sources named `"<Platform> (sample)"`, `isSample: true` on every offer | No sample price can be mistaken for a real one | Generic "Store A/B" names (less realistic for learning) |
| 2026-10-28 | npm workspaces monorepo | npm ships with Node; small repo | pnpm, Turborepo, Nx |
| 2026-10-28 | Fastify 5 over NestJS | Lighter, easier to learn, first-class schema validation | NestJS, Express |
| 2026-10-28 | Drizzle over Prisma; hand-written SQL migrations | pgvector, pg_trgm and triggers need SQL anyway; SQL stays visible for study | Prisma |
| 2026-10-28 | TypeScript 6.0.3, not 7.0.2 | typescript-eslint 8.72.1 peer range is `<6.1.0` | TS 7 (breaks lint) |
| 2026-10-28 | Cache behind an interface (memory + Redis) | Unit tests run without Docker | Redis-only |
| 2026-10-28 | Per-source rate limit in process | One API instance for now; see PROPOSALS P1 | Redis token bucket |
| 2026-10-28 | Run TS with `tsx` (no build step) in dev and in the container | Simpler for a student project | `tsc` build + `node dist` (revisit in Phase G) |
| 2026-10-28 | Fixtures as typed TS modules | Compile-time checking against the schemas | JSON files (see PROPOSALS P2) |
| 2026-10-28 | Supertest against `app.server` | Brief asks for Supertest | Fastify `inject` only |
