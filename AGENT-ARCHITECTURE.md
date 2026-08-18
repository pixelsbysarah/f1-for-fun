# SDLC Agent Architecture — Setup Guide

## What this is
Three GitHub Actions workflows, each running Claude Code in a distinct role:

| Agent | File | Trigger | Model | Job |
|---|---|---|---|---|
| Implementer | `claude-implement.yml` | `@claude` mention on an issue/PR comment | Opus 4.8 | Writes code for a ticket on a new branch, opens a PR |
| Reviewer | `claude-review.yml` | PR opened/updated | Sonnet 5 | Reviews the diff, flags security/RLS/secret issues inline |
| Tester | `claude-test.yml` | PR opened/updated | Sonnet 5 | Ensures test coverage exists, writes gaps, runs the suite |
| CI (not an agent) | `ci.yml` | PR opened/updated | — | Runs lint + test as a required, blocking status check |

Dependabot (`.github/dependabot.yml`) runs separately on a weekly schedule,
opening PRs for outdated npm and GitHub Actions dependencies. Not an agent —
just config.

You merge every PR by hand. No agent merges anything.

## Why this model split
- **Opus 4.8 for implementation**: strong reasoning for turning a spec into
  working code, at a fraction of the cost of Fable 5. Fable 5 pulls ahead on
  very large, long-horizon refactors across huge codebases — not this
  project's scale — and runs roughly 2x the cost, with a tendency to run
  longer than needed on tasks. Not worth it here.
- **Sonnet 5 for review and testing**: these are narrower, checklist-style
  tasks (does this follow the rules in CLAUDE.md, does this have tests) where
  a faster, cheaper model performs well.
- **OAuth token, not API key**: authenticating with `CLAUDE_CODE_OAUTH_TOKEN`
  runs these agents against your existing Claude Pro subscription instead of
  metered per-token API billing — keeps this at $0 beyond what you already
  pay for Pro. Subscription usage has its own rate limits, but a solo
  two-person project won't come close to them.

## One-time setup

1. **Install the Claude GitHub App** on the repo (or run `/install-github-app`
   from Claude Code locally, which does steps 1–3 for you).
2. **Generate a subscription OAuth token**: run `claude setup-token` locally,
   signed in with your Pro account.
3. **Add the token as a repo secret** named `CLAUDE_CODE_OAUTH_TOKEN`
   (Settings → Secrets and variables → Actions).
4. **Add the three workflow files** (already written) to
   `.github/workflows/` in the repo.
5. **Add `CLAUDE.md`** to the repo root — every agent reads it automatically
   on every run.
6. **Turn on branch protection** on `main`: require a pull request before
   merging, require at least one review (yours) before merge is allowed, and
   set the `CI / lint-and-test` job from `ci.yml` as a **required status
   check**. This is what actually enforces "no broken code merges" — the
   Claude agents comment and advise, but only this blocks a failing build.

## Running it
Open a GitHub issue with a ticket's content (see breakdown below), then
comment `@claude implement this issue` on it. The implementer opens a PR,
the reviewer and tester agents run automatically against that PR, and you
merge once you're satisfied.

## Recommended ticket breakdown
Feeding the whole build spec as one ticket is too much for one PR to do well
— split it into sequential, reviewable chunks instead:

1. **Project scaffold** — Next.js + TypeScript + Tailwind + DaisyUI + ESLint
   + Vitest setup; base layout shell; fonts; CSS-textured asphalt background;
   track-limit gutter lines.
2. **Supabase integration** — schema (users, predictions, races, results);
   Row Level Security policies; manual-account login flow (no signup); MFA
   (TOTP) enrollment and enforcement.
3. **F1 data adapter** — Jolpica API client behind the swappable adapter
   layer; response sanitization/validation; `last_fetched` timestamp and
   5-minute rate-limited refresh.
4. **Scoring engine** — podium partial-credit logic, per-category scoring,
   season accuracy calculation, with full unit test coverage.
5. **Dashboard & prediction portal UI** — hero section, score summary,
   dashboard cards (most recent race first), prediction form, correct/
   incorrect styling (team colors, greyscale, checkmark).
6. **Footer & polish** — API credit line, GitHub + pixelsbysarah.com links,
   final responsive/accessibility pass.

Feed these one at a time. Each becomes its own issue → PR → review → merge
cycle, so problems stay isolated and easy to review.
