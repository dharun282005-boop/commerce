# 07 · Matching and ranking algorithms

Built in Phase C (`packages/core/src/{rank,match,cart,property,history}`). The hand-computed examples here are unit tests in `packages/core/test/phase-c.test.ts`. Results: [phase-C-eval.md](progress/phase-C-eval.md).

## 1. Landed cost

```
landed = price + delivery + handling + platform + packaging + taxesNotIncluded − Σ(verifiable coupons)
```

`null` fees count as 0 **and** the offer is marked "fees unknown" (we don't pretend a missing fee is
a known zero). Coupons with `verifiable = false` are listed as "possible savings" and never subtracted.

**Worked example (food).** Biryani ₹249, delivery ₹35, packaging ₹20, platform ₹10, GST not included
5% of ₹249 = ₹12.45, verifiable coupon ₹50. In paise: 24,900 + 3,500 + 2,000 + 1,000 + 1,245 − 5,000
= **27,645 paise = ₹276.45**.

## 2. Bayesian-adjusted rating

```
R* = (C·m + n·r̄) / (C + n)
```

- `r̄` = reported average, `n` = number of ratings, `m` = prior mean (the average rating across the
  vertical), `C` = prior weight ("how many ratings before we trust the source's average").
- Default `m = 4.0`, `C = 50` per vertical (to be tuned on data).

**Worked example.**
- 4.9★ from 3 ratings: (50·4.0 + 3·4.9) / 53 = 214.7 / 53 = **4.051**
- 4.5★ from 5,000 ratings: (200 + 22,500) / 5,050 = **4.495**

So 4.5★ × 5,000 correctly ranks above 4.9★ × 3. Why this formula: it is a weighted average of the
prior and the observation, so it moves smoothly towards the observed mean as `n` grows. It is the
posterior mean under a conjugate normal prior, and it is easy to explain to users.

## 3. Best-value score

Four components, each scaled to [0, 1] **within the comparable set** (same match group, or the same
search for food/property):

| Component | Raw value | Scaling (1 = best) |
|-----------|-----------|--------------------|
| cost | landed cost | `(max − x) / (max − min)` |
| rating | R* | `(x − min) / (max − min)` |
| speed | ETA minutes | `(max − x) / (max − min)` |
| trust | mean of available trust signals (fulfilled-by-platform = 1, return policy ≥ 7 days = 1, seller rating / 5) | as is |

If `max = min`, every offer gets 1 for that component. A missing value gets 0 and a visible note
("no ETA from source"), so missing data never helps an offer.

```
score = Σ wₖ · sₖ / Σ wₖ
```

| Preset | cost | rating | speed | trust |
|--------|------|--------|-------|-------|
| Cheapest | 0.70 | 0.10 | 0.10 | 0.10 |
| Best rated | 0.15 | 0.60 | 0.05 | 0.20 |
| Fastest | 0.15 | 0.10 | 0.65 | 0.10 |
| Balanced (default) | 0.40 | 0.25 | 0.20 | 0.15 |

"Why is this #1?" shows each `wₖ · sₖ / Σw`, and these add up exactly to the score.

**Flagged offers are listed last.** An offer with a price anomaly, suspicious (instruction-like) text,
a below-market property price, or a request for money/ID before a visit keeps its honest score and
breakdown, but is sorted after all unflagged offers and shown with a warning. Without this, "Cheapest"
would put likely scams first.
`affiliate` is **not an input** to any function above. A property-based test toggles it on random
inputs and checks the order never changes.

**Price anomaly flag.** In a match group with ≥ 3 offers, flag when `landed < 0.6 × median(landed)`.
For property, flag when price per sqft is below 0.6 × the locality median (needs ≥ 5 listings).

## 4. Entity resolution (shopping and grocery)

```
function match(a, b):
  # Layer 0: veto. Different variants are never the same product.
  for attr in [storageGb, ramGb, size, quantity]:
    if a.attr and b.attr and normalise(a.attr) != normalise(b.attr):
      return {decision: "different", confidence: 0.99, reason: "variant differs: " + attr}
  # Layer 0b (titles): only one title has a variant word (pro, max, plus, ultra, mini, lite, anc, fe, …)
  #   or the model codes conflict ("A55" vs "A35", "1.5 ton" vs "1 ton") → different
  # Layer 1: exact identifiers, or a shared long model code ("FHM1207SDW")
  if shared non-null id among (gtin, asin, mpn, modelNumber) and equal:
    return {decision: "same", confidence: 0.99, reason: "same " + idName}
  # Layer 2: rules
  if brand(a) == brand(b) and model(a) == model(b) and variant attrs equal:
    return {decision: "same", confidence: 0.93, reason: "brand + model + variant"}
  # Layer 3: fuzzy text
  s = 0.5 · trigramSim(clean(a.title), clean(b.title)) + 0.5 · tokenSetRatio(...)
  # Layer 4: embeddings only nudge a fuzzy score, capped at ±0.05
  if embeddingsAvailable: s = s + clamp(0.1 · (cos(a, b) − 0.8), −0.05, 0.05)
  if s ≥ 0.90: same;  elif s ≥ 0.70: "possible match";  else: different
```

- `trigramSim` is the Jaccard index of 3-character shingles, the same idea as Postgres `pg_trgm`
  `similarity()`.
- `tokenSetRatio` compares the shared tokens against each side's remaining tokens, so word order and
  extra words ("5G", "with charger") hurt less.
- **Blocking**: only compare offers within the same brand (or the same first title token) so we don't
  compare all pairs. That takes the work from O(N²) to roughly O(Σ bᵢ²) over blocks.
- **Evaluation**: 391 labelled pairs built by `packages/core/eval/match-eval.ts` (fixture pairs with known ground truth + 60 hand-written title pairs in `eval/heldout-pairs.ts`), including hard
  negatives (128 vs 256 GB, different colours, 500 g vs 1 kg). We report precision, recall and F1.

## 5. Cart splitting (grocery)

**Problem.** Items `I`, platforms `P`. `c(i, p)` is the landed item price (∞ if unavailable or not
delivering to the pincode). Each platform used costs a per-order fee `f(p, subtotal)` (delivery +
handling, which can be waived above a free-delivery threshold) and must reach `minOrder(p)`.
Minimise the total over all assignments `a: I → P`.

This is a variant of uncapacitated facility location, which is NP-hard in general. Real lists are
small (≤ 30 items, ≤ 5 platforms), so a heuristic that we check against exhaustive search works.

```
greedy:      assign each item to its cheapest platform
repair:      for each platform below minOrder, move its items to the next-cheapest open platform
local search (repeat until no improvement):
  move:      move one item to another platform if the total drops
  close:     move all items of one platform to their best other open platform if the total drops
```

- The heuristic restarts from several points (greedy, and "all on platform P" for each P) and keeps the best.
- Exhaustive: `|P|^|I|` assignments.
- **What the app runs:** exact search when there are ≤ 20,000 combinations (e.g. 6 items × 5 platforms),
  otherwise the heuristic. Benchmark on 1,000 random lists (2–6 items, 2–4 platforms): heuristic optimal
  in 97%, mean gap 0.22%, worst 21.6% (see the eval report). That worst case is why exact search is used
  whenever it is cheap.
- Heuristic cost: O(s · k · |I| · |P|) for s starts and k improving passes.
- A platform below its minimum order gets a penalty of 10¹² + 1000 × shortfall, so local search is
  pulled steeply towards feasible plans.

## 6. Property dedupe

Two listings are the **same property** when all of these hold:
- same BHK and listing type;
- haversine distance ≤ 50 m;
- `|areaA − areaB| / max(areaA, areaB) ≤ 5%`;
- `|priceA − priceB| / max(priceA, priceB) ≤ 5%`.

The locality median needs ≥ 5 listings of the same type; with fewer, the zone median (e.g. all OMR
localities) is used, and the basis is shown to the user.

Perceptual image hashing is used only if image access is legally permitted (not in fixture mode).
Stale: posted more than 45 days ago. Scam signals: below 0.6 × locality median per sqft, zero
photos, or listing text asking for advance payment (flagged, never acted on).
