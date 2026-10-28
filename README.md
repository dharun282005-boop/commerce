# Chennai Universal Commerce

Compare the **total** price you'd pay across shopping, food delivery, quick-commerce and rental apps in Chennai,
with an explainable ranking, price history, alerts, and an AI shopping assistant. English and Tamil.

> **Sample data only.** Every price, rating and listing is made up and labelled "(sample)". No real platform is
> contacted. Add your own data in `data/imports/`. See [docs/06](docs/06-data-acquisition-and-compliance.md).

## Run it

```bash
npm install
docker compose up --build
```

| What                   | URL                        |
| ---------------------- | -------------------------- |
| Web app                | http://localhost:3100      |
| API + OpenAPI docs     | http://localhost:4100/docs |
| Alert emails (Mailpit) | http://localhost:8025      |

Optional: put `ANTHROPIC_API_KEY=…` and `ANTHROPIC_MODEL=claude-opus-5-5` in `.env` (or your shell) before
`docker compose up` to use Claude for the assistant. Without them a rule-based offline assistant is used.

## Check it

```bash
npm run ci                 # lint, type-check, 130+ tests, secrets scan
npm run test:integration   # Postgres + Redis tests (stack running)
npm run eval               # 162 assistant scenarios incl. prompt-injection
npm run e2e                # browser tests: 4 headline stories, a11y, LCP, offline
```

## Status: all phases done (A–G)

Reports with real output: [docs/progress/](docs/progress/). Start reading at
[docs/14-study-guide-and-glossary.md](docs/14-study-guide-and-glossary.md); the 10-minute walkthrough is
[docs/demo-script.md](docs/demo-script.md).
