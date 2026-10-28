# 01 · Project report

*Chennai Universal Commerce: an explainable, compliance-first price comparison system with an AI shopping agent.*

## Abstract

Shoppers in Chennai split purchases across e-commerce, food delivery, quick-commerce and property
portals. Each one shows its prices, fees and ratings in its own way. This project designs and builds a
system that brings offers into one canonical model. It matches the same item across platforms with
layered entity resolution, works out the **total landed cost**, adjusts ratings for review volume, and
ranks offers with a transparent, user-weighted score. A Claude-based agent answers natural-language
requests using only tool results, and cites a source and freshness for every number. Data is acquired
through a tiered legal policy (official APIs → ONDC → partner/user data → permitted public pages).
Under the owner's current decision, the system runs on labelled sample data.

## 1. Problem

1. **Fragmented prices.** The same phone, dish or grocery basket costs different amounts on different
   apps. The listed price also hides delivery, handling, platform and packaging fees.
2. **Misleading signals.** A 4.9★ rating from 3 reviews looks better than 4.5★ from 5,000. "MRP"
   discounts can be inflated.
3. **Hard to compare like with like.** Titles differ ("Galaxy S24 FE 5G (8GB/128GB)" vs "Samsung
   S24FE 128 GB"). Merging different variants (128 GB vs 256 GB) gives wrong answers.
4. **Legal constraints.** Most platforms forbid automated collection in their Terms, so a comparison
   tool must be built on permitted data routes.

## 2. Objectives

- O1: One canonical offer model for four verticals, with money in integer paise and normalised units.
- O2: Cross-platform matching with ≥ 0.95 precision on a labelled set of ≥ 200 pairs (Phase C target).
- O3: A transparent ranking ("Why is this #1?") that affiliate status can never change.
- O4: Cart splitting for grocery lists that is within 2% of the exhaustive optimum on small lists.
- O5: An agent that grounds every number in tool output and passes ≥ 40 scenarios per vertical,
  including prompt-injection cases.
- O6: A mobile-first, bilingual (English/Tamil), WCAG 2.2 AA web app.

## 3. Literature and market survey

Only sources that can be checked are listed. Details still to confirm are marked `[VERIFY]`.

**Record linkage and entity resolution**
- Fellegi, I. P. & Sunter, A. B. (1969). *A Theory for Record Linkage.* Journal of the American
  Statistical Association, 64(328), 1183–1210. The probabilistic basis for match/non-match/possible
  match decisions. It is the origin of our three-way "same / possible match / different" output.
- Christen, P. (2012). *Data Matching.* Springer. A textbook on blocking, comparison functions and
  evaluation (precision, recall, F1).
- Köpcke, H., Thor, A. & Rahm, E. (2010). *Evaluation of entity resolution approaches on real-world
  match problems.* PVLDB 3(1). Shows that product matching across shops is harder than bibliographic
  matching. This motivates using identifiers and rules before fuzzy text.

**Ratings and ranking**
- Bayesian average (damped mean). Popularised for ratings by IMDb's Top 250 weighting and by Evan
  Miller's essays on rating sorting (evanmiller.org) `[VERIFY exact article URL]`.

**Optimisation**
- Cart splitting with per-store fixed fees is a variant of the uncapacitated facility location problem,
  which is NP-hard (Cornuéjols, Nemhauser & Wolsey, "The Uncapacitated Facility Location Problem", in
  *Discrete Location Theory*, 1990) `[VERIFY citation details]`. So we use a heuristic and check it
  against exhaustive search on small inputs.

**LLM agent safety**
- Greshake, K. et al. (2023). *Not what you've signed up for: Compromising Real-World LLM-Integrated
  Applications with Indirect Prompt Injection.* arXiv:2302.12173. The threat model for listing text that
  tries to steer the agent.
- OWASP Top 10 for LLM Applications, LLM01 Prompt Injection (owasp.org).

**Open commerce infrastructure in India**
- ONDC (Open Network for Digital Commerce), https://ondc.org. Built on the open Beckn protocol
  (https://becknprotocol.io). See [06](06-data-acquisition-and-compliance.md) for onboarding notes.

**Existing products (market)**
- Price trackers and comparison tools: Keepa (keepa.com, Amazon price history), BuyHatke
  (buyhatke.com, Indian browser extension), Smartprix (smartprix.com, Indian electronics comparison),
  Google Shopping.
- Gap: none of these, as far as we found, covers **all four** verticals with landed-cost and
  volume-adjusted ratings, a public compliance policy, and an explainable agent. `[VERIFY by a fresh market scan before the final report]`

**Regulation and standards**
- Digital Personal Data Protection Act, 2023 (India). Informs data minimisation, consent and erasure
  `[VERIFY status of the DPDP Rules]`.
- WCAG 2.2, https://www.w3.org/TR/WCAG22/.
- Core Web Vitals, LCP "good" threshold 2.5 s, https://web.dev/articles/lcp.

## 4. Gap

Existing tools compare list prices on one or two platforms. They rarely include fees, rarely adjust
ratings for volume, and do not explain their ranking. Most do not say how they get their data.

## 5. Methodology

Design-science approach: build an artefact in phases (A–G), each with a measurable gate. See
[11](11-implementation-walkthrough.md). Algorithms are evaluated with labelled data (matching),
hand-computed cases (ranking maths), exhaustive baselines (cart split) and scripted scenarios (agent).

## 6. Design summary

Adapter framework → normalisation → matching → ranking → API → web app and agent. See
[03](03-architecture.md), [05](05-data-model.md), [07](07-matching-and-ranking-algorithms.md) and
[08](08-agent-design-and-safety.md).

## 7. Evaluation plan

| What | Metric | Target | Phase |
|------|--------|--------|-------|
| Matching | Precision / recall / F1 on ≥ 200 labelled pairs | P ≥ 0.95, R ≥ 0.85 | C |
| Ranking maths | Hand-computed unit cases | 100% pass | C |
| Cart split | Gap vs exhaustive optimum (≤ 6 items, ≤ 4 platforms) | ≤ 2% mean | C |
| Agent | Scripted scenarios per vertical, incl. injection | ≥ 40 each, 100% safety cases pass | E |
| Web | Lighthouse LCP (mobile), axe a11y violations | < 2.5 s, 0 serious | F |
| Robustness | One source failing never fails a search | Test passes | B |

## 8. Limitations

- Under the current decision, **all data is sample data**. Results show how the system works, not
  real market prices.
- Food and quick-commerce apps have no public catalogue. Real data for them depends on ONDC or partner
  access, which needs a legal entity `[VERIFY]`.
- Prices change at checkout (coupons, surge, stock). The UI must say so.

## 9. Ethics

No scraping against Terms, no anti-bot evasion, no purchases, no stored credentials, no invented
ratings, labelled sample data, affiliate links that never change ranking, and minimal personal data.

## 10. Results (measured 2026-10-29, sample data)

| What | Result | Target | Evidence |
|------|--------|--------|----------|
| Matching | 391 labelled pairs (224 hard negatives): precision 1.000, recall 0.988; held-out 60 pairs P 1.000 / R 0.923 (optimistic: rules were tuned after a first run at P 0.714 / R 0.577) | P ≥ 0.95, R ≥ 0.85 | progress/phase-C-eval.md |
| Ranking maths | Hand-computed cases pass (₹276.45 landed; 4.051 vs 4.495; score 0.85) | 100% | phase-c.test.ts |
| Affiliate independence | 200 randomised trials, identical order and scores | always | phase-c.test.ts |
| Cart split | App uses exact search for ≤ 20,000 combinations; heuristic optimal in 97% of 1,000 random lists, mean gap 0.22%, worst 21.6% | ≤ 2% mean | progress/phase-C.md |
| Agent | 162 scenarios (≥ 40 per vertical) incl. 12 injection + universal safety checks: 162/162 with the **offline planner**; Claude not yet evaluated (no API key) | ≥ 40 each | progress/phase-E-eval.md |
| Web | 4 headline stories pass end to end; axe 0 serious/critical on 7 pages; LCP 552 ms throttled mobile | LCP < 2.5 s | progress/phase-F.md |
| Robustness | One source failing never fails a search; circuit breaker, retries, timeouts tested | — | guarded.test.ts, eval "source_down" |
| Load | Search ~3,200 req/s cached, ~2,000 req/s uncached, p99 ≤ 18 ms (20 connections, laptop) | — | progress/phase-G.md |

## 11. Conclusion

The project shows that an explainable, compliance-first comparison service across four very different verticals is
practical: a single canonical offer model, landed cost, volume-adjusted ratings and a transparent weighted score make
rankings both useful and defensible, and a deterministic matcher with a variant veto avoids the most damaging error
(merging different variants). Building the data layer as a tiered, switchable adapter framework kept the legal
question explicit: today every price is labelled sample data, and the routes to real data (official APIs, ONDC,
owner and user data) are implemented or stubbed but switched off pending approval.

The main limitations are the sample data itself, matching numbers measured partly on data written for the project,
the agent being evaluated only with the offline planner, and Tamil strings awaiting a native reviewer. Next steps:
run `EVAL_MODEL=claude npm run eval` with an API key, collect a fresh set of real product titles for matching,
and seek approval for the first real source (most likely an official affiliate API).
