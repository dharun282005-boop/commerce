# Phase G progress: hardening and delivery

Date: 2026-10-29.

## Gate

| Gate item | Result |
|-----------|--------|
| Security review | ✅ [security-review.md](../security-review.md): checklist with tests; residual risks listed |
| Load test | ✅ below (autocannon, 20 connections × 15 s, Postgres + Redis, rate limit off for measurement) |
| Observability | ✅ pino JSON logs with request ids (no bodies, secrets redacted), `/metrics`, `x-ratelimit-*` headers, source health page |
| Deployment guide | ✅ [deployment-guide.md](../deployment-guide.md) (not deployed) |
| Final report + demo script | ✅ [01 §10–11](../01-project-report.md), [demo-script.md](../demo-script.md) |

## Built
- API: helmet security headers, locked-down CSP for JSON, per-IP rate limits (stricter for agent, submissions, alerts, admin), Redis-backed counters, `TRUST_PROXY`.
- `npm run secrets` (in CI) and `npm run audit`; `npm run loadtest`.
- Docker Compose now runs postgres, redis, mailpit, api and web.

## Real command output

```
$ npm run ci   (tail)
> chennai-universal-commerce@0.1.0 secrets
> node scripts/secrets-scan.mjs

secrets scan: 190 tracked files, no findings
```

```
$ npm run test:integration   (tail)
      Tests  5 passed (5)
   Start at  00:52:54
   Duration  718ms (tests 48%, import 40%, transform 11%, worker 1%)
```

```
$ npm run eval   (summary)
| Vertical | Scenarios | Passed |
|---|---|---|
| shopping | 42 | 42 |
| food | 40 | 40 |
| grocery | 40 | 40 |
| property | 40 | 40 |
| **all** | **162** | **162** |
```

```
$ npm run e2e
  ✓   1 US-1: S24 FE 128GB in Velachery: only 128 GB, several sources, fresh and labelled, scam listing last (462ms)
  ✓   2 US-2: veg biryani for 2 under ₹300 in 40 min to Adyar (333ms)
  ✓   3 US-3: weekly grocery list split across apps in T Nagar (303ms)
  ✓   4 US-4: 2 BHK rent near OMR ≤ ₹30,000, semi-furnished: duplicates merged, scams flagged, no phone numbers (291ms)
  ✓   5 assistant answers from tools and shows what it checked (313ms)
  ✓   6 Tamil UI (220ms)
  ✓   7 accessibility: no serious or critical axe violations on /en (1.1s)
  ✓   8 accessibility: no serious or critical axe violations on /en/results?vertical=food&q=veg+biryani&locality=Adyar (1.4s)
  ✓   9 accessibility: no serious or critical axe violations on /en/grocery (1.1s)
  ✓  10 accessibility: no serious or critical axe violations on /en/agent (1.1s)
  ✓  11 accessibility: no serious or critical axe violations on /en/about (1.0s)
  ✓  12 accessibility: no serious or critical axe violations on /en/saved (1.0s)
  ✓  13 accessibility: no serious or critical axe violations on /ta (1.2s)
LCP (4x CPU, ~1.6 Mbps, 150 ms RTT): 548 ms
  ✓  14 performance: home LCP under 2.5 s on a throttled mobile profile (1.4s)
  ✓  15 offline: saved items still show without a network (325ms)
  15 passed (18.0s)
```

```
$ node scripts/loadtest.mjs http://localhost:4198 15
┌─────────┬───────────────────────────────────────────────────┬─────────────┬────────┬────────┬────────┬────────┬──────────┬────────┬────────┐
│ (index) │ test                                              │ req/s (avg) │ p50 ms │ p90 ms │ p99 ms │ max ms │ requests │ errors │ non2xx │
├─────────┼───────────────────────────────────────────────────┼─────────────┼────────┼────────┼────────┼────────┼──────────┼────────┼────────┤
│ 0       │ 'GET /health'                                     │ 12077       │ 1      │ 2      │ 3      │ 57     │ 181149   │ 0      │ 0      │
│ 1       │ 'POST /v1/search (5 popular queries, cache warm)' │ 3166        │ 6      │ 7      │ 12     │ 95     │ 47484    │ 0      │ 0      │
│ 2       │ 'POST /v1/search (unique queries, cache cold)'    │ 2039        │ 9      │ 12     │ 18     │ 40     │ 30573    │ 0      │ 0      │
└─────────┴───────────────────────────────────────────────────┴─────────────┴────────┴────────┴────────┴────────┴──────────┴────────┴────────┘
```

```
$ npm audit --omit=dev
found 0 vulnerabilities
```

```
# live Docker stack smoke test
$ curl localhost:4100/health
{"status":"ok","db":"up","redis":"up","fixtureMode":false}
$ curl -I localhost:3100/en (web)
HTTP 200, 26035 bytes
<html lang="ta"
$ search (US-1, cheapest)
{"area":"Velachery","results":6,"top":{"name":"Samsung Galaxy S24 FE 5G (Mint, 8GB RAM, 128GB Storage)","total_rs":34999,"source":"Amazon.in (sample)"},"last_flags":["price_anomaly","suspicious_text"],"imported_in_group":[6]}
$ agent
{"model":"offline-planner","live":false,"tools":["search_properties"],"cards":3,"grounding":true}
$ ONDC mock enabled in compose
[{"status":"ok","offerCount":1}]
$ alert: create
{"status":"confirmation_sent","message":"Check your email to confirm the alert."}
mailpit: [{"to":"demo@example.com","subject":"Confirm your price alert"}]
$ alert: verify
access token received: eyJwdXJwb3Nl…
mailpit after a fresh observation: ["Price alert: Apple iPhone 16 128GB Black","Confirm your price alert"]
$ export my data
{"email":"demo@example.com","alerts":1}
$ psql: tables
alerts|1
price_observations|12831
$ rate limit headers
x-ratelimit-limit: 30
x-ratelimit-remaining: 28
x-ratelimit-reset: 58
content-security-policy: default-src 'none'; frame-ancestors 'none'
```
