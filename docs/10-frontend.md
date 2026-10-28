# 10 · Frontend (Phase F blueprint)

## Stack

Next.js (App Router) + React + Tailwind CSS, next-intl for English (`en`) and Tamil (`ta`), PWA
(manifest + service worker for offline saved lists). Versions are pinned when Phase F starts.

## Pages

| Route | Content |
|-------|---------|
| `/[locale]` | Search box, vertical tabs (Shopping, Food, Grocery, Property), locality picker (name or pincode) |
| `/[locale]/results` | Filters, sort presets (Cheapest / Best rated / Fastest / Balanced) + sliders, compare table, "Why this ranking" drawer, per-source status strip |
| `/[locale]/item/[id]` | Offers across platforms, 30/90-day price history chart, similar items |
| `/[locale]/property/[id]` | Listing facts, price per sqft vs locality median, flags, duplicates on other portals, link out (no phone numbers) |
| `/[locale]/agent` + side panel | Streaming chat, "What I checked" panel, result cards |
| `/[locale]/grocery` | List planner → cart split result |
| `/[locale]/saved` | Saved items and alerts (works offline) |
| `/[locale]/admin/sources` | Source health and freshness |
| `/[locale]/about` | Transparency: sources, tiers, sample-data notice, "prices may differ at checkout", affiliate disclosure |

## Display rules

- Every price shows **source**, **"checked X min ago"** and a **Sample data** badge when `isSample`.
- Money uses `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`, for example ₹1,23,456.
- Affiliate links carry a visible "affiliate link" label.
- WhatsApp share uses `https://wa.me/?text=<encoded summary>` with no personal data.

## Quality budgets

LCP < 2.5 s on a mid-range mobile profile (Lighthouse), WCAG 2.2 AA (axe: 0 serious), mobile-first
layouts from 360 px wide, Tamil text checked for line-height and wrapping.
