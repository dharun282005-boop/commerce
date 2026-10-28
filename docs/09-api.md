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

In Phase B, offers are filtered and sorted by **item price only**. They are not yet ranked, and
`maxPricePaise` checks item price, not landed cost. Ranking, landed cost and anomaly flags arrive in
Phase C. This is why the deliberate "too cheap" trap listings sort first for now.

## Planned endpoints

| Endpoint | Phase |
|----------|-------|
| `POST /v1/compare` (groups + scores + breakdown) | C |
| `POST /v1/cart/plan` | C |
| `GET /v1/offers/:id/history?days=30` | C/F |
| `POST /v1/import` (tier-3 CSV/JSON), `POST /v1/submissions` (user price) | D |
| `POST /v1/agent` (SSE stream) | E |
| `POST /v1/alerts`, `GET /v1/me/export`, `DELETE /v1/me` | F/G |

## Errors

`400` validation (Zod issues), `404` unknown locality, `429` rate limited, `500` internal. A source
failing is **not** an error. It shows up in `sources[]`.
