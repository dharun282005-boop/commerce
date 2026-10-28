# Deployment guide

Everything runs locally with `docker compose up --build`. This page describes a free or low-cost hosted option.
Provider names, free tiers and prices change often: **[VERIFY each provider's current free tier and terms before
choosing]**. Nothing has been deployed.

## Option 0: Vercel (web app with the API built in) — simplest

The web app embeds the API at `/api/*`, so one Vercel project runs the whole site on sample data (in-memory: no
Postgres/Redis; price history is generated sample history; alerts are off unless you add SMTP).

1. Push this repo to GitHub (or GitLab/Bitbucket) and import it in Vercel.
2. **Root Directory:** `apps/web`. Framework: Next.js (detected). `apps/web/vercel.json` already sets the install
   command (`npm ci` at the repo root, so workspace packages are installed) and the build command.
3. **Node.js version:** 24.x (from `apps/web/package.json` `engines`).
4. **Environment variables** (Project → Settings → Environment Variables), all optional:
   - `GEMINI_API_KEY` (secret) and `GEMINI_MODEL=gemini-3.8-flash,gemini-flash-latest` for the live assistant;
   - or `ANTHROPIC_API_KEY` + `ANTHROPIC_MODEL` for Claude;
   - `ALERT_SECRET` (random 32+ chars) and `SMTP_URL` to enable email price alerts.
   Do **not** set `NEXT_PUBLIC_API_URL` (empty = use the built-in `/api`).
5. Deploy. Check `https://<your-app>/api/health` → `{"status":"ok",…}`.

Limits on Vercel: rate limits and assistant sessions are per serverless instance (in memory); the assistant's
streaming works but long Gemini calls count against the function's 60 s limit.

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
