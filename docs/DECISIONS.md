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
| 2026-10-29 | Exact cart search when ≤ 20,000 combinations, heuristic above | Heuristic worst case 21.6% on random lists | Heuristic only |
| 2026-10-29 | Flagged offers listed last (not hidden) and never used in carts or agent recommendations | Keeps the honest score visible while protecting users | Hide flagged offers; rank normally |
| 2026-10-29 | Offline rule-based planner when no Anthropic key is configured | No credentials on the owner's machine; keeps the app usable and the eval runnable | Agent disabled without a key |
| 2026-10-29 | Strict per-source rate limits only for real sources | Sample/local sources starved under eval load | One limit for all |
| 2026-10-29 | Alerts identity = signed email link (no passwords, no cookies) | Minimal personal data; no CSRF surface | OAuth / password accounts |
| 2026-10-29 | API port 4100, web 3100 | Port 4000 was in use on the owner's Mac | — |
| 2026-10-29 | Gemini (Google Gen AI SDK 2.31.0) added as an assistant model; provider chosen by `AGENT_PROVIDER` (auto: Claude, else Gemini, else offline) | Owner supplied a Gemini key | Replacing Claude support |
| 2026-10-29 | `ResilientModel`: when the live model fails (overload, quota, timeout) the offline planner answers and the model is skipped for 60 s | Gemini returned 503/504/429 during setup; the site must not break | Show an error to the user |
| 2026-10-29 | API embedded in the web app at `/api/*` (Fastify via `inject`, streamed) | One Vercel deployment serves everything; same tested code | Separate API host (still supported via `NEXT_PUBLIC_API_URL`) |
| 2026-10-29 | Visual design: cream-paper storybook system (owner-provided reference) | Owner request | Previous neutral design |
| 2026-10-29 | Design deviations for WCAG AA: muted text #5c5e5a (not Stone Gray), ink text on coral (not white), green never as text/focus, Tamil display size reduced on narrow screens, headings below 53px on phones | Contrast and fit | Following the reference literally |
