# Phase F progress: web app

Date: 2026-10-29.

## Gate

| Gate item | Result |
|-----------|--------|
| Playwright e2e for US-1..US-4 | ✅ all four, in a production build on a mobile (Pixel 7) profile |
| i18n English/Tamil | ✅ every string in `messages/{en,ta}.json` (identical key sets); `/ta` sets `lang="ta"` |
| Accessibility | ✅ axe: 0 serious/critical violations on 7 pages (automated only) |
| Performance | ✅ home LCP 552 ms under 4× CPU + slow network throttling (budget 2,500 ms) |
| PWA / offline | ✅ manifest + service worker; saved items load offline |

## Built
Pages: home, results (presets, weight sliders, filters, compare table, "Why is this #N?"), item and property detail
(price history chart, MRP check, same item elsewhere, alert form), assistant (full page + side panel on every page),
grocery planner, saved items + my data (export/delete), source health, about/transparency, alert confirmation.
Backend additions: price alerts (double opt-in email, Mailpit in Docker), export/delete my data, CORS.

## Bugs found by the e2e/axe run and fixed
- A React effect returned a value instead of a cleanup function, crashing the assistant after the first message.
- Two controls shared the label "What are you looking for?"; `<dd>` elements without `<dt>` (axe: definition-list).

## Real command output
```
$ npm run e2e
  ✓   1 US-1: S24 FE 128GB in Velachery: only 128 GB, several sources, fresh and labelled, scam listing last (562ms)
  ✓   2 US-2: veg biryani for 2 under ₹300 in 40 min to Adyar (274ms)
  ✓   3 US-3: weekly grocery list split across apps in T Nagar (298ms)
  ✓   4 US-4: 2 BHK rent near OMR ≤ ₹30,000, semi-furnished: duplicates merged, scams flagged, no phone numbers (290ms)
  ✓   5 assistant answers from tools and shows what it checked (296ms)
  ✓   6 Tamil UI (209ms)
  ✓   7 accessibility: no serious or critical axe violations on /en (1.1s)
  ✓   8 accessibility: no serious or critical axe violations on /en/results?vertical=food&q=veg+biryani&locality=Adyar (1.4s)
  ✓   9 accessibility: no serious or critical axe violations on /en/grocery (1.0s)
  ✓  10 accessibility: no serious or critical axe violations on /en/agent (1.0s)
  ✓  11 accessibility: no serious or critical axe violations on /en/about (1.0s)
  ✓  12 accessibility: no serious or critical axe violations on /en/saved (1.0s)
  ✓  13 accessibility: no serious or critical axe violations on /ta (1.2s)
LCP (4x CPU, ~1.6 Mbps, 150 ms RTT): 552 ms
  ✓  14 performance: home LCP under 2.5 s on a throttled mobile profile (1.4s)
  ✓  15 offline: saved items still show without a network (332ms)
  15 passed (20.1s)
```
