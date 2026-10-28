# Chennai Universal Commerce

Compare prices across shopping, food delivery, quick-commerce and property platforms in Chennai,
with an explainable ranking and (later) an AI shopping agent.

> **Sample data only.** All prices, ratings and listings are made up and labelled "(sample)".
> No real platform is contacted. See [docs/06](docs/06-data-acquisition-and-compliance.md).

## Quick start (macOS, Node 24, Docker)

```bash
npm install
docker compose up --build      # API on http://localhost:4100, OpenAPI UI at /docs
npm run ci                     # lint + type-check + unit tests
npm run test:integration       # needs postgres + redis from docker compose
```

Try a search:

```bash
curl -s -X POST localhost:4100/v1/search -H 'content-type: application/json' \
  -d '{"vertical":"food","q":"veg biryani","locality":"Adyar","filters":{"vegOnly":true,"minServings":2}}'
```

## Status

| Phase | What                                                         | Status  |
| ----- | ------------------------------------------------------------ | ------- |
| A     | Research and blueprint docs                                  | ✅ done |
| B     | Monorepo, DB, schemas, fixtures, adapter wrapper, search API | ✅ done |
| C     | Matching, ranking, cart splitting                            | next    |
| D–G   | Real sources (with approval), agent, web app, hardening      | planned |

Start reading at [docs/14-study-guide-and-glossary.md](docs/14-study-guide-and-glossary.md).
