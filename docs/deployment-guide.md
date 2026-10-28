# Deployment guide

Everything runs locally with `docker compose up --build`. This page describes a free or low-cost hosted option.
Provider names, free tiers and prices change often: **[VERIFY each provider's current free tier and terms before
choosing]**. Nothing has been deployed.

## Option A: one small VM (simplest, ~₹400–800/month) `[VERIFY prices]`

1. A 1 vCPU / 2 GB Linux VM (any provider, ideally in a Mumbai/Chennai region for latency).
2. Install Docker, clone the repo, create `.env` with **new** secrets:
   `ALERT_SECRET` (32+ random bytes), `ADMIN_TOKEN`, a real `POSTGRES_PASSWORD` (also update `DATABASE_URL`),
   `WEB_ORIGIN=https://your-domain`, `NEXT_PUBLIC_API_URL=https://api.your-domain`, an SMTP URL for real email
   (replace Mailpit), and optionally `ANTHROPIC_API_KEY` + `ANTHROPIC_MODEL`.
3. Put Caddy or nginx in front for HTTPS (Let's Encrypt), set `TRUST_PROXY=true` on the API so rate limits see real client IPs.
4. `docker compose up -d --build`, then remove the `mailpit` service and the published Postgres/Redis ports.

## Option B: managed free tiers `[VERIFY]`

| Part | Example service | Notes |
|------|-----------------|-------|
| Web (Next.js) | Vercel Hobby or Netlify | Set `NEXT_PUBLIC_API_URL` at build time |
| API (Fastify, Docker) | Render / Railway / Fly.io | Uses `apps/api/Dockerfile`; set `SEED_ON_START=true` once |
| Postgres with pgvector | Neon or Supabase free tier | Both offer the `vector` and `pg_trgm` extensions `[VERIFY]` |
| Redis | Upstash free tier | Use the `rediss://` URL |
| Email | Any SMTP provider (e.g. Brevo, Resend) | Set `SMTP_URL` |

## Before going public

- Read [security-review.md](security-review.md) residual risks.
- Real platform data still needs owner approval per source (docs/06). Until then keep the sample-data banner.
- Remove `ENABLED_SOURCES=ondc-mock` unless you want the mock in production.
