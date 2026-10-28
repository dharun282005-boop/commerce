# 06 · Data acquisition and compliance

## Current status: fixture-only mode

The owner decided on 2026-10-28 to use **dummy/sample data for now**. Every real-source adapter is
**disabled**. In code, the only enabled adapters are `FixtureAdapter` instances. Each one copies the
*name* of a platform so the comparison looks realistic, but is labelled `(sample)` and has
`compliance.tier = "fixture"` and `isSample = true`.

## Tier policy (implemented in `packages/core/src/adapters/types.ts` + `guarded.ts`)

| Tier | Route | Allowed when |
|------|-------|--------------|
| 1 | Official API / affiliate feed | Owner has credentials and accepts the API terms |
| 2 | ONDC buyer-side client (Beckn) | Owner completes ONDC onboarding as a network participant |
| 3 | Partner files, manual CSV/JSON import, user-submitted prices | Data supplied by its owner or by the user from their own session |
| 4 | Respectful fetch of public pages | robots.txt **and** Terms permit it, **and** the owner approved this source in writing (rule 1) |
| fixture | Sample data | Always (dev/test), always labelled |

Every adapter declares:

```ts
compliance: {
  tier: 1 | 2 | 3 | 4 | "fixture",
  termsUrl: string | null,
  robotsAllowed: boolean | null,   // null = not reviewed / not applicable
  lastReviewed: string | null,     // ISO date
  enabledByDefault: boolean,
  notes: string,
}
```

The `GuardedAdapter` refuses to call an adapter when any of these is true:
- `KILL_SWITCH_ALL=true` (global kill switch);
- its id is in `DISABLED_SOURCES` (per-source kill switch);
- it is not enabled (`enabledByDefault=false` and not listed in `ENABLED_SOURCES`);
- it is tier 4 and `robotsAllowed !== true`.

## robots.txt snapshot (2026-10-28)

Fetched once with an honest User-Agent (`ChennaiCommerceResearch/0.1 (student project; robots.txt review)`),
as public documents. **robots.txt is not permission.** Terms of Service govern too, and none of these
Terms have been reviewed in full yet, so every source stays disabled.

| Source | Vertical(s) | robots.txt result | Notes |
|--------|-------------|-------------------|-------|
| Amazon.in | shopping | 200 OK. 103 user-agent groups; 100 groups get `Disallow: /`, **including ClaudeBot and other AI crawlers**. Generic `*` group disallows many search paths. | Use the official PA-API / Creators API (tier 1) only `[VERIFY current API name, eligibility and terms]` |
| Flipkart | shopping | 200 OK. 68 Disallow rules across 15 groups | Affiliate API (tier 1) `[VERIFY availability]` |
| Croma | shopping | 403 "Access Denied" to our request | Bot protection; no automated route |
| Reliance Digital | shopping | 200 OK. `*` group allowed with path exclusions; 4 named bots fully blocked | Terms not reviewed |
| Myntra | shopping | Connection failed (no response) | — |
| Swiggy (food + Instamart) | food, grocery | 200 OK. `*` allowed except `/product` and others | No public menu catalogue; app-only. ONDC is the route |
| Zomato | food | Connection failed (no response) | App-only data; ONDC is the route |
| Blinkit | grocery | 403, HTML error page instead of robots.txt | Bot protection |
| Zepto | grocery | 200 OK, `Allow: /` (22 bytes) | robots.txt alone is not permission; Terms not reviewed |
| BigBasket | grocery | 200 OK. `*` allowed with 28 path exclusions | Terms not reviewed |
| MagicBricks | property | 200 OK. 9 groups get `Disallow: /`, including `anthropic-ai` | Terms not reviewed |
| 99acres | property | 403 "Access Denied" | Bot protection |
| NoBroker | property | 200 OK. `*` group with 49 path exclusions | Terms not reviewed |
| Housing.com | property | 406, HTML page instead of robots.txt | Bot protection |

**Before any tier-4 adapter is written, we stop and ask the owner** with a summary of that site's
robots.txt and Terms (rule 1). The snapshot above is input to that conversation, not a decision.

## Adapters built (Phase D, 2026-10-29)

| Adapter id | Tier | Default | What it does | Compliance basis |
|------------|------|---------|--------------|------------------|
| `fixture-*` (17) | fixture | on | Labelled sample data imitating each platform | No platform contacted |
| `manual-import` | 3 | on | Loads the owner's CSV/JSON files from `data/imports/` (+ admin endpoint) | Owner's own data; rows are sample unless marked otherwise |
| `user-submitted` | 3 | on | Prices users saw in their own session, with a link | Link checked (https, allow-list, public IPs only) and **never fetched**; confidence 0.5; expires (1 day grocery, 3 days shopping) |
| `ondc-mock` | 2 | **off** | Beckn `search` against a mock gateway (`/mock/ondc`) | Real ONDC needs onboarding; only `search` exists, never `select/init/confirm` |
| `amazon-in-official` | 1 | **off** | Stub; throws "not configured" | Needs credentials + owner approval |
| `flipkart-affiliate` | 1 | **off** | Stub; throws "not configured" | Needs credentials + owner approval |

**No tier-4 (scraping) adapter exists.** None was requested, and the robots.txt snapshot below
shows most sources forbid or block it.

Every adapter's compliance record and live health is visible at `GET /v1/sources`.

## Compliance matrix (who could be enabled, and how)

| Source | Best legal route | Status |
|--------|-----------------|--------|
| Amazon.in | Tier 1 official API (needs an Associates account with qualifying sales `[VERIFY]`) | Disabled, fixture used |
| Flipkart | Tier 1 affiliate API `[VERIFY]` | Disabled, fixture used |
| Croma, Reliance Digital, Myntra | Tier 3 partner feed / user-submitted | Disabled, fixture used |
| Swiggy, Zomato, Instamart, Blinkit, Zepto, BigBasket | Tier 2 ONDC sellers + tier 3 user-submitted | Disabled, fixture used |
| ONDC network | Tier 2 | Not onboarded |
| MagicBricks, 99acres, NoBroker, Housing.com | Tier 3 partner feed / user-submitted link | Disabled, fixture used |

## ONDC notes (to confirm in Phase D)

- ONDC is an open network built on the Beckn protocol. Buyer apps send `search`, `select`, `init`,
  `confirm` and related calls through gateways, and sellers respond asynchronously (`on_search`, …).
  Spec: https://github.com/beckn/protocol-specifications and ONDC's own API contracts
  `[VERIFY current repo/URL for ONDC retail and F&B specs]`.
- Joining needs registration as a **Network Participant**: a legal entity, signing and encryption
  key pairs, subscription to the ONDC registry, then staging → pre-production → production with log
  verification `[VERIFY all steps at https://ondc.org]`.
- For this project, only `search`/`on_search` (catalogue discovery) is in scope. We never call
  `confirm` (rule 2: no purchases).
- An individual student may not be able to onboard. In that case the ONDC adapter is built against a
  mock gateway that follows the published schema `[VERIFY eligibility]`.

## Sample data policy

- Shopping fixtures use **real product names** (needed to test matching) with **made-up prices and
  ratings**. They are labelled sample data and attributed to `"<Platform> (sample)"`.
- Food fixtures use **fictional restaurants**. Property fixtures use **fictional listings** with no
  contact details. Grocery fixtures use generic and common brand products with made-up prices.
- The UI must show a "Sample data" badge on every fixture offer (Phase F).
