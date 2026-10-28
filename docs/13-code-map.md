# 13 · Code map

```
.
├── PROMPT.md, README.md          Brief and quick start
├── docker-compose.yml            postgres(pgvector) · redis · mailpit · api :4100 · web :3100
├── data/imports/                 YOUR data: CSV/JSON files loaded by the manual-import adapter
├── scripts/                      secrets-scan.mjs, loadtest.mjs
├── packages/core/                Pure TypeScript domain logic
│   ├── src/schemas.ts money.ts units.ts localities.ts text.ts safety.ts
│   ├── src/adapters/             types, resilience (cache, token bucket, breaker), guarded wrapper,
│   │                             fixture, manual-import, user-submitted, ondc (+ mock), official stubs, offer-query
│   ├── src/net/url-guard.ts      SSRF guard for submitted links
│   ├── src/rank/                 landed cost, Bayesian rating, best-value score + explanations
│   ├── src/match/match.ts        layered entity resolution + grouping
│   ├── src/cart/cart.ts          list parser, exact + heuristic cart splitting
│   ├── src/property/property.ts  dedupe, price-per-sqft medians, scam/stale flags
│   ├── src/history/history.ts    history store interface, MRP check, sample history
│   ├── src/compare.ts            one call: group → dedupe → rank → flag
│   ├── src/fixtures/             sample data (4 verticals, 17 sources)
│   └── eval/                     matching eval set + report, cart benchmark
├── packages/db/                  Drizzle schema, SQL migrations (0000–0003), seed, observation + history stores
├── apps/api/                     Fastify service
│   ├── src/app.ts server.ts config.ts services.ts schemas.ts metrics.ts redis-cache.ts
│   ├── src/routes/               core (search, explain, cart, offers, localities, sources), data, alerts, agent
│   ├── src/agent/                tools, prompt, models (Claude), scripted (offline planner), loop (caps, grounding)
│   ├── src/alerts/               tokens, stores (memory/Postgres), notifiers (SMTP, memory, web-push stub), service
│   └── eval/                     162 agent scenarios, adversarial seller, runner
└── apps/web/                     Next.js app
    ├── src/app/[locale]/         pages: home, results, item/[id], property/[id], agent, grocery, saved,
    │                             admin/sources, about, alerts/verify
    ├── src/components/           SearchForm, ResultsView, OfferCard, PriceChart, DetailView, Chat, …
    ├── src/i18n/ src/proxy.ts    next-intl routing (en, ta)
    ├── messages/en.json ta.json  every UI string
    ├── public/sw.js              offline service worker
    └── e2e/stories.spec.ts       Playwright tests
```
