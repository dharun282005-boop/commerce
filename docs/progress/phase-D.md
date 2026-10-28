# Phase D progress: data sources (approval-free only)

Date: 2026-10-29. Owner decision still in force: **no real platform data**. So Phase D built every
route that needs no platform permission, and left the platform routes as disabled, documented stubs.

## Gate

| Gate item | Result |
|-----------|--------|
| Per-source compliance record | ✅ every adapter declares `compliance`; table in docs/06; live at `GET /v1/sources` |
| Health checks | ✅ `health()` on each adapter + breaker state; stubs report "not configured" |
| Owner approval for real sources | ⏸ none given, so none enabled; no scraper written |

## Built
- `ManualImportAdapter` (tier 3): CSV/JSON from `data/imports/` (your **customised data** goes here), admin import endpoint, per-row error reports. Example files included (labelled sample).
- `UserSubmittedAdapter` (tier 3): user-reported prices; SSRF guard (https only, no credentials/ports/IPs, platform allow-list, all resolved IPs must be public); never fetches the link; confidence 0.5; expiry.
- `OndcAdapter` (tier 2): Beckn `search` request builder + `on_search` parser with schema validation, against a mock gateway; fees marked unknown because ONDC quotes them later.
- Official API stubs for Amazon.in and Flipkart (tier 1): disabled, need credentials and approval.
- Local sources skip the cache so new imports/reports show at once.

## Real command output
```
$ npm run ci   (tail)
  70:9  error  The value assigned to 'files' is not used in subsequent statements  no-useless-assignment

✖ 1 problem (1 error, 0 warnings)
```
