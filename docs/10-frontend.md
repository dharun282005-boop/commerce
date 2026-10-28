# 10 · Frontend (built in Phase F)

## Stack

`apps/web`: Next.js 16.4.3 (App Router) + React 19.3.1 + Tailwind CSS 4.3.3, next-intl 4.14.9 for English (`en`)
and Tamil (`ta`) with `src/proxy.ts` locale routing (Next 16 renamed middleware to proxy), PWA (`app/manifest.ts`
+ `public/sw.js`). Pages call the API directly from the browser (`NEXT_PUBLIC_API_URL`, CORS-limited to the web origin).
Docs read: https://next-intl.dev/docs/routing/setup, https://nextjs.org/docs.

**Tamil strings** in `messages/ta.json` were written for this project and need checking by a native reader (docs/15).

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

## Visual design (2026-10-29)

Owner-provided "cream paper storybook" reference: cream `#f5f1e4` canvas, white cards (32 px radius, 50 px for
large sheets), floating white pill navigation, green `#8ed462` structural accent (selected chips, menu toggle,
logo), coral `#ff705d` primary actions with a small white dot, sky `#2ba0ff` dots on secondary actions, yellow
`#f5e211` footer band, Inter 400/500 for everything (Noto Sans Tamil for Tamil), display headings with tight
tracking, flat surfaces (no shadows), paper-cut inline SVG illustrations (`components/Art.tsx`).

WCAG AA deviations from the reference: muted text `#5c5e5a` instead of Stone Gray (3.4:1), ink text on coral
instead of white (2.7:1), green never used for text or focus rings (1.6:1 on cream; focus rings are ink),
display/heading sizes scale down on phones (and further for Tamil) so words fit.

## Components

`SearchForm`, `LocalityInput` (datalist of 22 localities, Tamil names, pincodes), `ResultsView` (presets, weight
sliders, filters, compare table, source strip), `OfferCard` (landed-cost breakdown, "Why is this #N?", flags,
save, WhatsApp share, sample badge, freshness), `DetailView` + `PriceChart` (single-series SVG line, crosshair
tooltip, keyboard arrows, table view), `AlertForm`, `Chat` + `ChatLauncher` (SSE streaming, "What I checked",
cards, consented preferences), `GroceryPlanner`, `SavedView` (localStorage + export/delete my data), `SourcesView`.

Chart colours follow the dataviz reference palette (series-1 `#2a78d6` light / `#3987e5` dark) with a recessive grid.
Light theme only (the reference is light); tokens live in `globals.css`.

## Quality budgets

Measured in Playwright (`npm run e2e`): home LCP **552 ms** with 4× CPU throttling, ~1.6 Mbps and 150 ms RTT on a
Pixel 7 profile (budget 2.5 s); axe (WCAG 2.0/2.1/2.2 A+AA tags) **0 serious/critical** on 7 pages. Earlier budget text:
LCP < 2.5 s on a mid-range mobile profile, WCAG 2.2 AA (axe: 0 serious), mobile-first
layouts from 360 px wide, Tamil text checked for line-height and wrapping.

## Known limits

- CSP allows `'unsafe-inline'` scripts because Next.js App Router injects inline scripts; a nonce-based CSP needs
  dynamic rendering of every page (proposal P3).
- axe covers automated checks only; a manual screen-reader pass and a Tamil reader review are still to do.
