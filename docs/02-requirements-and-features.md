# 02 · Requirements and features

Priority uses MoSCoW: **M**ust, **S**hould, **C**ould. The "Phase" column is where it is built.

## Headline user stories (definition of done)

| ID | Story | Acceptance test |
|----|-------|-----------------|
| US-1 | "Best price for Samsung Galaxy S24 FE 128GB delivered to Velachery" | Results list only the 128 GB variant from ≥ 3 sources, ranked by landed cost, each with source and "checked X min ago". The 256 GB variant is never merged in. |
| US-2 | "Cheapest veg biryani for 2 under Rs 300, delivered in 40 min to Adyar" | Only veg dishes with ≥ 2 servings, landed cost ≤ ₹300 and ETA ≤ 40 min that deliver to 600020. |
| US-3 | "Weekly groceries: 2 kg rice, 1 L milk, 12 eggs, cheapest split" | Cart plan with per-platform subtotal, fees and minimum-order handling. Total equals the exhaustive optimum on this list. |
| US-4 | "2 BHK for rent near OMR, up to Rs 30,000, semi-furnished" | Only 2 BHK rentals ≤ ₹30,000 in OMR-corridor localities, semi-furnished, with duplicates across portals collapsed, and no phone numbers shown. |

## Functional requirements

| ID | Requirement | Pri | Phase | Acceptance |
|----|-------------|-----|-------|------------|
| FR-ADP-01 | `SourceAdapter` interface (`search`, `getOffer`, `health`, `capabilities`, `compliance`) | M | B | Type-checked; FixtureAdapter implements it |
| FR-ADP-02 | Wrapper: compliance gate, rate limit, timeout, retry with jitter, circuit breaker, cache with TTL per vertical | M | B | Unit test per behaviour |
| FR-ADP-03 | Global and per-source kill switches | M | B | Test: switched-off source returns `disabled` and is never called |
| FR-ADP-04 | One failing source never fails the whole search | M | B | Test: one adapter throws, others still return; response lists "unavailable" |
| FR-ADP-05 | Real adapters (official API, ONDC, manual import, user-submitted) | S | D | Per-source compliance record and owner approval |
| FR-NRM-01 | Canonical offer schema per vertical; money in integer paise; ISO timestamps | M | B | Zod schema tests |
| FR-NRM-02 | Unit normalisation (g/kg, ml/L, pack size) and price per 100 g / 100 ml | M | B | Unit tests |
| FR-MAT-01 | Layered matching (identifiers → rules → fuzzy → embeddings) with confidence and reason | M | C | Eval report P/R |
| FR-MAT-02 | Never merge different variants | M | C | Hard-negative pairs all rejected |
| FR-RNK-01 | Landed cost (fees, verifiable coupons only) | M | C | Hand-computed tests |
| FR-RNK-02 | Bayesian-adjusted rating | M | C | 4.9×3 < 4.5×5000 test |
| FR-RNK-03 | Weighted score with presets and a breakdown | M | C | Breakdown sums to score |
| FR-RNK-04 | Price anomaly flag | S | C | Test with an outlier |
| FR-RNK-05 | Ranking independent of affiliate status | M | C | Property test: toggling `affiliate` never changes order |
| FR-CRT-01 | Cart-split solver (greedy + local search) | M | C | Matches exhaustive on small lists |
| FR-PRP-01 | Property dedupe (≤ 50 m, area and price tolerance) | M | C | Fixture duplicates collapse |
| FR-PRP-02 | Price per sqft vs locality median; stale and scam flags | S | C | Tests |
| FR-PRP-03 | Never show scraped phone numbers | M | B | Schema has no phone field |
| FR-HIS-01 | Append-only price observations | M | B | DB table without update path; insert on every search |
| FR-HIS-02 | 30/90-day chart and MRP-inflation check | S | F/C | Tests |
| FR-ALR-01 | Price alerts behind an interface; email via a dev mail catcher | S | F | e2e |
| FR-AGT-01..07 | Agent tools, single clarifying question, grounding, streaming, caps, prompt caching, consented preferences | M | E | `npm run eval` |
| FR-WEB-01..09 | Pages listed in the brief §8, English/Tamil, PWA, offline saved lists | M | F | Playwright e2e for US-1..4 |
| FR-LOC-01 | Seeded Chennai locality → pincode → coordinates list | M | B | ≥ 20 localities; lookup by name or pincode |
| FR-SHR-01 | WhatsApp share of a comparison (`wa.me` link with text) | S | F | e2e |

## Non-functional requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-PERF-01 | LCP on mid-range mobile | < 2.5 s |
| NFR-PERF-02 | Fixture search API p95 | < 300 ms locally |
| NFR-A11Y-01 | WCAG 2.2 AA | 0 serious axe violations |
| NFR-SEC-01 | Rate limit, CSRF, CSP, SSRF guard, input validation | Phase G review |
| NFR-PRIV-01 | Pincode-level location only; export and delete | Phase G |
| NFR-OBS-01 | pino logs with request IDs; `/metrics`; per-source health and freshness | B (API), F (dashboard) |
| NFR-I18N-01 | English and Tamil strings from day one | F |
| NFR-CMP-01 | Every price shows source, timestamp and confidence | B (schema), F (UI) |
