# 15 · Open questions and decisions needed

## Decisions needed from the owner

| # | Question | Default until answered |
|---|----------|------------------------|
| D1 | Data mode | **Answered 2026-10-28: dummy/sample data for now.** All real sources disabled. |
| D2 | Which API keys do you have? (Amazon Associates/PA-API, Flipkart Affiliate, Google Maps or another maps API, Anthropic API) | None. Agent (Phase E) needs an Anthropic key to run against the real model; evals can use a recorded/mock model without one. |
| D3 | Which real sources, if any, should Phase D enable? | None (fixtures only) |
| D4 | Will you pursue ONDC onboarding (needs a legal entity)? | No. Build an ONDC adapter against a mock gateway. |
| D5 | Hosting target for Phase G | Document a free/low-cost option; no deploy |
| D6 | Show affiliate links at all? | No affiliate links |
| D7 | Is it OK that shopping fixtures use real product names with made-up, clearly labelled prices? | Yes (needed to test matching) |

## Items to verify (`[VERIFY]` / `[FILL IN]` in docs)

| Where | Item |
|-------|------|
| 01 §3 | Exact URL of Evan Miller's Bayesian rating article |
| 01 §3 | Citation details for Cornuéjols, Nemhauser & Wolsey (1990) |
| 01 §3 | Fresh market scan for existing four-vertical comparison products |
| 01 §3 | Status of India's DPDP Rules |
| 01 §8, 06 | ONDC onboarding steps and whether an individual can join |
| 05, `localities.ts` | Locality centroid coordinates and pincodes against India Post / OpenStreetMap |
| 05, `localities.ts` | Tamil locality names, checked by a native reader |
| 06 | Current Amazon product API name (PA-API 5.0 vs Creators API), eligibility and terms |
| 06 | Flipkart affiliate API availability and terms |
| 06 | Current ONDC retail and F&B API spec location |
| 06 | Full Terms of Service review for every source before any change to "disabled" |
| 08 | Current prompt-caching syntax and minimum cacheable length in the Claude docs |
| 07, eval | A fresh, unseen set of real product titles to measure matching honestly (the held-out set was used to improve the rules) |
| 07 | Embedding layer: no embedding model chosen yet (needs an API or local model); pgvector is installed but unused |
| `fixtures/sources.ts` | Terms-of-Service URLs for each platform have not been opened/verified |
| 10, `messages/ta.json` | Tamil UI strings, checked by a native reader |
| 10 | Manual screen-reader pass (VoiceOver/TalkBack) |
