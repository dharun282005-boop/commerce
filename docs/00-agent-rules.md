# 00 · Agent rules (how this project is built)

These are the working rules for anyone, human or AI, who changes this repo. The full brief is
[PROMPT.md](../PROMPT.md). This page is the short version, plus the decisions the owner has made since.

## Current operating mode (owner decision, 2026-10-28)

> "for now use dummy datasets or customised datas"

- **Every real source adapter is disabled.** The app runs only on the `FixtureAdapter`, which uses
  sample data written for this project.
- Sample data is always labelled. Each offer carries `provenance.isSample = true`. Sources are named
  like `Amazon.in (sample)`, so nobody can mistake a fixture price for a real one.
- Food restaurants and property listings in fixtures are **fictional**. Ratings are never attached to
  real restaurant or landlord names, because that would be an invented rating for a real business
  (rule 3).
- Moving to real data needs a fresh, per-source owner decision (see [06](06-data-acquisition-and-compliance.md)).

## The nine non-negotiables (summary)

| # | Rule | How the code enforces it |
|---|------|--------------------------|
| 1 | Tiered, lawful data acquisition | `compliance` block on every adapter; `GuardedAdapter` refuses disabled or not-permitted sources; global and per-source kill switches (`KILL_SWITCH_ALL`, `DISABLED_SOURCES`) |
| 2 | No autonomous purchases | No order, payment or login tool exists. Only deep links out. |
| 3 | No fabricated data | Every offer has `provenance { sourceId, observedAt, confidence, isSample }`. Missing values are `null`, never guessed. |
| 4 | Prompt-injection safety | Listing text is data only (Phase E: delimiting, tool allow-list, injection evals) |
| 5 | Privacy | Pincode or locality only; no precise location; export and delete (Phase G) |
| 6 | Secrets | `.env` is git-ignored; `.env.example` is committed; pino redacts query text and auth headers |
| 7 | Official docs first | Versions and doc links in [04](04-tech-stack-and-mac-setup.md) |
| 8 | No scope creep | Ideas go to [PROPOSALS.md](PROPOSALS.md) |
| 9 | Phases with gates | `docs/progress/phase-X.md` with real command output, tag `phase-X-done` |

## Workflow

1. Plan the phase, then build in small steps. Commit each step as `phase-X: message`.
2. Run the gate commands and paste the **real** output into `docs/progress/phase-X.md`.
3. Tag `phase-X-done`, then stop for owner review.
4. Anything uncertain is marked `[VERIFY]` or `[FILL IN]` and listed in [15](15-open-questions.md).
