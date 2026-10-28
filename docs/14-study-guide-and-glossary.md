# 14 · Study guide and glossary

## Suggested reading order

1. [PROMPT.md](../PROMPT.md): what we are building and the rules.
2. [03 Architecture](03-architecture.md): the big picture and the search sequence diagram.
3. `packages/core/src/money.ts` and `units.ts`: small, pure functions. Read the tests next to them.
4. `packages/core/src/schemas.ts`: how Zod describes the canonical offer, and how `z.infer` turns a
   schema into a TypeScript type.
5. `packages/core/src/adapters/guarded.ts`: the most important file in Phase B. Trace one call
   through gate → cache → rate limit → breaker → timeout → retry.
6. `packages/core/src/search.ts`: why `Promise.allSettled` keeps one source failure from failing
   the whole search.
7. `apps/api/src/app.ts`: how an HTTP request becomes a `searchAll()` call.
8. `packages/db/migrations/*.sql`: real SQL, including the append-only trigger.

## Exercises

- Add a new fixture locality and write a test that looks it up by pincode.
- Make `fixture-zomato` time out (`FIXTURE_FAIL=fixture-zomato:timeout`) and watch the API report it
  as unavailable while other sources still answer.
- Try `UPDATE price_observations SET price_paise = 1;` in `psql` and read the error.
- Work out the Bayesian ratings in [07](07-matching-and-ranking-algorithms.md) §2 by hand.

## Glossary

| Term | Meaning |
|------|---------|
| Adapter | Code that talks to one data source and returns offers in a common shape |
| Affiliate link | A link that pays a commission. Here it is labelled and never affects ranking |
| Bayesian average | A rating pulled towards a prior mean until there are enough reviews |
| Beckn | Open protocol for discovery and transactions; ONDC is built on it |
| Blocking | Only comparing records that share a cheap key (such as brand) before detailed matching |
| Circuit breaker | Stops calling a failing source for a cool-down period, then tries one test call (half-open) |
| Entity resolution | Deciding whether two records describe the same real-world thing |
| Fixture | Fixed sample data used for development and tests |
| GST | Goods and Services Tax (India); prices here are GST-inclusive unless stated |
| Idempotent | Safe to repeat with the same result |
| Jitter | Random delay added to retries so many clients don't retry at the same moment |
| Landed cost | Everything you actually pay: price + fees + taxes − applicable coupons |
| LCP | Largest Contentful Paint, a Core Web Vitals loading metric |
| MRP | Maximum Retail Price printed on Indian packaged goods |
| ONDC | Open Network for Digital Commerce, India's open e-commerce network |
| Paise | 1/100 of a rupee; we store money as whole paise |
| pg_trgm | Postgres extension for similarity using 3-character shingles |
| pgvector | Postgres extension for storing and searching embedding vectors |
| Pincode | Indian 6-digit postal code (PIN = Postal Index Number) |
| Precision / recall | Of the matches we claimed, how many were right / of the real matches, how many we found |
| Prompt injection | Text in data that tries to give instructions to an AI model |
| robots.txt | A site's file telling automated crawlers which paths they may fetch |
| TTL | Time to live: how long a cached value is kept |
| Token bucket | Rate-limit algorithm: tokens refill at a fixed rate, and each call spends one |
| Zod | TypeScript library to describe and validate data at runtime |
