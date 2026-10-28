# Security review (Phase G)

Date: 2026-10-29. Scope: `apps/api`, `apps/web`, `packages/*`, Docker Compose. Method: checklist from the brief §9
plus OWASP API Top 10 / OWASP Top 10 for LLM apps, each item with how it is handled and how it is tested.

| Area | Status | How | Test / evidence |
|------|--------|-----|-----------------|
| Input validation | ✅ | Zod schemas on every route body/query/param; 256 KB body limit | `security.test.ts` (malformed, oversized), route tests |
| Rate limiting | ✅ | `@fastify/rate-limit` per IP: 300/min default; agent 30, submissions 10, alerts 5, verify 20, admin import 20; Redis-backed when `REDIS_URL` set (shared across instances) | `security.test.ts` 429 test; headers seen in the live stack |
| Security headers | ✅ | `@fastify/helmet` (HSTS, nosniff, frame options, referrer policy); API CSP `default-src 'none'` | `security.test.ts` |
| Web CSP | ⚠ partial | Strict CSP except `script-src 'unsafe-inline'` (Next.js inline scripts). Nonce CSP = proposal P3 | `next.config.ts` |
| CORS | ✅ | Only `WEB_ORIGIN` may call from browsers | `alerts.test.ts` CORS test |
| CSRF | ✅ n/a | API uses no cookies; identity is a bearer token in an `Authorization` header that browsers never attach automatically | design |
| Authentication | ✅ | Optional; email magic link (double opt-in) → HMAC-signed, expiring access token; no passwords stored | `alerts.test.ts` token tamper/expiry |
| Admin endpoints | ✅ | `x-admin-token`, constant-time compare; disabled when `ADMIN_TOKEN` unset | `phase-d.test.ts` |
| SSRF | ✅ | User URLs: https only, no credentials/ports/IP literals, platform allow-list, every resolved IP must be public; URLs are never fetched | `phase-d.test.ts` (incl. DNS-rebinding case) |
| Output encoding | ✅ | React escapes all text; no `dangerouslySetInnerHTML`; API returns JSON | code search |
| Prompt injection | ✅ | Untrusted text wrapped + sanitised; read-only tools; grounding check; flagged offers never recommended or carted | 162 eval scenarios, `agent.test.ts` |
| Secrets | ✅ | `.env` git-ignored; `npm run secrets` scans every tracked file (in `npm run ci`) | `scripts/secrets-scan.mjs` |
| Logging & privacy | ✅ | No bodies or search text logged; auth/admin headers redacted; pincode-level location only | `security.test.ts` log capture |
| Data export / delete | ✅ | `GET/DELETE /v1/me` | `alerts.test.ts` |
| Dependency audit | ⚠ dev only | `npm audit --omit=dev`: **0** vulnerabilities. Full audit: 7 moderate in dev tools only (drizzle-kit's bundled esbuild dev-server issue; autocannon → uuid). Neither ships in the API or web images' runtime path. | `npm run audit` |
| Database | ✅ | Parameterised queries only (Drizzle / `pg` placeholders); append-only trigger on price history | `db.integration.test.ts` |
| Containers | ✅ | Run as non-root `node` user; dev passwords only in Compose and flagged as dev-only | Dockerfiles |

## Residual risks and follow-ups

1. Web CSP still allows inline scripts (P3).
2. Dev credentials in `docker-compose.yml` (`cuc_dev_password`, `dev-only-alert-secret-change-me`) must be replaced for any deployment (see deployment guide).
3. The offline planner is rule-based; a live Claude run of the eval suite is still needed to measure real model behaviour.
4. No WAF / bot protection in front of the API; rate limits are per IP only.
