# 04 · Tech stack and Mac setup

Versions were checked on **2026-10-28** with `npm view <pkg> version` (the npm registry is the source
of truth for package versions) and pinned exactly in `package.json`.

## Machine (owner's Mac)

| Tool | Version found | Official docs |
|------|---------------|---------------|
| macOS on Apple Silicon | arm64 | — |
| Node.js | 24.22.0 (LTS line 24) | https://nodejs.org/en/about/previous-releases |
| npm | 11.19.1 | https://docs.npmjs.com/cli |
| Docker Engine / Compose | 29.9.1 / v5.6.0 | https://docs.docker.com/compose/ |
| git | 2.55.0 | https://git-scm.com/doc |

## Packages (pinned)

| Package | Version | Purpose | Docs |
|---------|---------|---------|------|
| typescript | 6.0.3 | Language | https://www.typescriptlang.org/docs/ |
| tsx | 4.23.15 | Run TS directly in Node | https://tsx.is |
| zod | 4.6.7 | Runtime validation and schemas | https://zod.dev |
| fastify | 5.12.7 | HTTP API | https://fastify.dev/docs/latest/ |
| fastify-type-provider-zod | 7.0.0 | Zod ↔ Fastify schemas and OpenAPI | https://github.com/turkerdev/fastify-type-provider-zod |
| @fastify/swagger / swagger-ui | 9.9.2 / 6.1.2 | OpenAPI document and UI | https://github.com/fastify/fastify-swagger |
| pino | 10.4.0 (via Fastify) | Structured logs | https://getpino.io |
| drizzle-orm / drizzle-kit | 0.45.4 / 0.31.11 | Schema, queries, migrations | https://orm.drizzle.team/docs/overview |
| pg | 8.23.1 | Postgres driver | https://node-postgres.com |
| ioredis | 6.0.0 | Redis client | https://github.com/redis/ioredis |
| vitest | 5.0.5 | Unit tests | https://vitest.dev |
| supertest | 7.3.1 | HTTP tests | https://github.com/ladjs/supertest |
| eslint / typescript-eslint | 10.13.0 / 8.72.1 | Lint | https://eslint.org/docs/latest/ · https://typescript-eslint.io |
| prettier | 3.9.10 | Formatting | https://prettier.io/docs/ |

Later phases (versions checked again when the phase starts): next 16.x, react 19.x, next-intl 4.x,
tailwindcss 4.x, bullmq 6.x, @anthropic-ai/sdk, Playwright.

### Why TypeScript 6.0 and not 7.0

`typescript@latest` is 7.0.2. typescript-eslint 8.72.1 declares the peer range `typescript >=4.8.4 <6.1.0`,
so 7.x would break linting. We pin 6.0.3 and revisit when typescript-eslint supports 7.

## Docker images

| Image | Why |
|-------|-----|
| `pgvector/pgvector:pg17` | Official pgvector image: Postgres 17 with the `vector` extension. `pg_trgm` ships with Postgres contrib. https://github.com/pgvector/pgvector |
| `redis:8-alpine` | Official Redis image. https://hub.docker.com/_/redis |
| `node:24-alpine` | API container base. https://hub.docker.com/_/node |

## Setup from scratch

```bash
# 1. Install tools (once)
brew install node@24 git          # or the installer from nodejs.org
# Docker Desktop: https://docs.docker.com/desktop/setup/install/mac-install/

# 2. Project
cd ~/dharun                       # this repo
cp .env.example .env              # nothing secret is needed for fixture mode
npm install

# 3. Run everything in Docker
docker compose up --build         # postgres + redis + api on http://localhost:4100
                                  # (port 4100 because 4000 was already in use on the owner's Mac)

# or run the API on the host with only the databases in Docker
docker compose up -d postgres redis
npm run db:migrate && npm run db:seed
npm run dev:api

# 4. Checks
npm run ci                        # lint + typecheck + tests
```

The OpenAPI UI is at http://localhost:4100/docs.
