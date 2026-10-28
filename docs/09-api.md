# 09 · API

Base URL (local): `http://localhost:4100`. OpenAPI UI: `/docs`. JSON spec: `/docs/json`.
All bodies are validated with Zod. Every response has an `x-request-id` header.

## Phase B endpoints (implemented)

### `GET /health`
Liveness and dependency status (the Docker health check uses it): `{ status: "ok", db: "up"|"down"|"disabled", redis: "up"|"down"|"disabled", fixtureMode: true }`.

### `GET /metrics`
Plain-text counters in Prometheus text format: requests, searches per vertical, source results by
status, cache hits.

### `GET /v1/localities?q=adyar`
Chennai localities matching a name, alias or pincode. Without `q`, returns all of them.

### `GET /v1/sources`
Every registered source with its `compliance` block, enabled state and live `health()`
(circuit state, last success, last error).

### `POST /v1/search`

```json
{
  "vertical": "food",
  "q": "veg biryani",
  "locality": "Adyar",
  "filters": { "maxPricePaise": 30000, "vegOnly": true, "maxEtaMinutes": 40, "minServings": 2 }
}
```

`locality` accepts a name, alias or pincode. Filters (all optional): `maxPricePaise`, `vegOnly`,
`maxEtaMinutes`, `minServings`, `bhk`, `listingType` (`rent`|`buy`), `furnishing`.

Response:

```json
{
  "requestId": "…",
  "vertical": "food",
  "locality": { "id": "adyar", "name": "Adyar", "pincode": "600020" },
  "sampleData": true,
  "offers": [ { "id": "fixture-swiggy:food-…", "pricePaise": 24900, "provenance": { "sourceName": "Swiggy (sample)", "observedAt": "…", "isSample": true } } ],
  "sources": [
    { "sourceId": "fixture-swiggy", "status": "ok", "offerCount": 3, "fromCache": false, "latencyMs": 2 },
    { "sourceId": "fixture-zomato", "status": "unavailable", "error": { "kind": "timeout" } }
  ],
  "generatedAt": "…"
}
```

Since Phase C the response has `results[]` (ranked), `groups[]` (same item across platforms) and
`weights`. Each result has `offer`, `rank`, `score`, `landed` (cost lines), `adjustedRating`,
`components`, `contributions` (sum = score), `flags`, `notes`; property results also have
`property` (price per sqft vs median, age) and `alsoListedOn` (duplicates on other portals).
Optional body fields: `preset` (`cheapest|best_rated|fastest|balanced`) or `weights`.
`maxPricePaise` is checked against the landed cost.

### `POST /v1/explain`
Same body as search plus `offerId`; returns plain-language lines for "Why is this ranked here?".

### `POST /v1/cart/plan`
`{ list: "2 kg rice, 1 L milk, 12 eggs", locality: "T Nagar" }` → parsed needs, per-platform orders
with fees, total, `bestSinglePlatform` for comparison, and `unavailable` items.

### `GET /v1/offers/:id` and `GET /v1/offers/:id/history?days=30`
Offer detail with the same item on other platforms, similar items and an MRP check; price history
points (sample history is marked `isSample: true`).

### Phase D: data endpoints
- `POST /v1/submissions`: report a price you saw (`vertical`, `url`, `title`, `priceRs`, `locality`, optional `deliveryRs`, `brand`, `quantity`). 201 or 400 with a reason.
- `GET /v1/imports`: rows imported and per-row rejection reasons.
- `POST /v1/admin/import` (`x-admin-token`): add rows; `POST /v1/admin/import/reload`: re-read `data/imports/`.
- `POST /mock/ondc/search`: development mock of an ONDC gateway (`on_search`).

### Phase E: agent
- `POST /v1/agent` `{ message, sessionId?, preferences? }` → `{ sessionId, text, cards[], toolCalls[], grounding, limitsHit, usage, model, live }`.
  With `?stream=true`: Server-Sent Events `session`, `status`, `text`, `tool_call`, `tool_result`, `done` (or `error`).
- `GET /v1/agent/status`; `DELETE /v1/agent/sessions/:id`.

## Planned endpoints

| Endpoint | Phase |
|----------|-------|
| `POST /v1/alerts`, `GET /v1/me/export`, `DELETE /v1/me` | F/G |

## Errors

`400` validation (Zod issues), `404` unknown locality, `429` rate limited, `500` internal. A source
failing is **not** an error. It shows up in `sources[]`.
