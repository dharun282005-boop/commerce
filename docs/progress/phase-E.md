# Phase E progress: the agent

Date: 2026-10-29.

## Gate

| Gate item | Result |
|-----------|--------|
| `npm run eval` report | ✅ [phase-E-eval.md](phase-E-eval.md): 162 scenarios (≥ 40 per vertical), all pass **with the offline planner** |
| Prompt-injection tests | ✅ hostile seller in every eval run; 12 injection scenarios + universal "no echo / no phone / no flagged card" checks on all 162 |
| Live Claude evaluation | ⏸ not run: no API credentials on this machine (and it costs money). Command: `EVAL_MODEL=claude npm run eval` |

## Built
- `agent/tools.ts`: nine read-only tools, Zod-validated inputs, compact JSON results, untrusted text wrapped as `{"untrusted_text": …}` and sanitised.
- `agent/prompt.ts`: static system prompt (cacheable).
- `agent/models.ts`: `ClaudeModel` (streaming, caching, effort, refusal fallback, model id from env) and the interface.
- `agent/scripted.ts`: offline planner used without a key.
- `agent/loop.ts`: tool loop with caps, refusal handling, grounding check; cards built from tool data.
- `routes/agent.ts`: `POST /v1/agent` (JSON or SSE), in-memory sessions (30 min), status, delete session.

## Honest notes
- The first eval runs found real bugs, which were fixed: per-source rate limits starved sample sources under load (now strict only for real sources); **the cart planner could pick a hostile listing** (now flagged offers are excluded from carts); planner phrasing gaps. The planner was then adjusted until all scenarios passed, so the 162/162 describes the planner on these phrasings, not general language understanding.
- Claude's behaviour has not been measured. The same suite is ready to run against it.

## Real command output
```
$ npm run eval   (summary)
| Vertical | Scenarios | Passed |
|---|---|---|
| shopping | 42 | 42 |
| food | 40 | 40 |
| grocery | 40 | 40 |
| property | 40 | 40 |
| **all** | **162** | **162** |
```
