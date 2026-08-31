# For Fun: An F1 Personal Prediction Tracker — Build Spec

## Overview
A personal, two-person F1 prediction tracker for the 2026 season. Not a commercial product — a portfolio piece and a fun way for two people (you and your spouse) to track prediction accuracy race by race.

---

## Tech Stack
- **Framework:** Next.js (React, Node, TypeScript)
- **Styling:** Tailwind CSS + DaisyUI
- **Database/Auth:** Supabase (Postgres, free tier) — built-in auth with TOTP MFA
- **Testing:** Vitest + React Testing Library
- **Linting:** ESLint
- **Hosting:** Vercel (free tier), auto-deploy from GitHub `main`
- **Data source:** OpenF1 API (openf1.org, free, no auth, CC BY-NC-SA 4.0) — built behind an adapter layer so it can be swapped for Jolpica or another source later

---

## Features

### Prediction Dashboard
- Displays predictions for remaining 2026 races: **P1, P2, P3, fastest lap, number of DNFs, red flags**
- Two featured users (you + spouse) to start
- Most recent races displayed first

### Completed Races
- Shows actual outcome next to each person's prediction
- Displays **season accuracy percentage** per person
- Missing predictions display as `-` for each field and score **zero points**

### Scoring Rules
- **Non-podium categories** (fastest lap, DNF count, red flags): 1 point correct, 0 incorrect
- **Podium scoring (P1/P2/P3):**
  - 3 correct drivers, correct order → 4 points
  - 3 correct drivers, wrong order → 3 points
  - 2 correct drivers, any order → 2 points
  - 1 correct driver, any order → 1 point
  - Otherwise → 0 points
- Because the podium is worth up to 4 and each other category up to 1, the
  per-race maximum is 7 (or 6 when red-flag data is unavailable), and the
  season accuracy percentage is deliberately podium-weighted, not an even
  average across the four categories.

### Auth & Prediction Portal
- Username/password login via Supabase Auth
- **MFA required** (TOTP, e.g. Google Authenticator) — built into Supabase Auth
- Authenticated users can add/edit predictions for upcoming races via a simple form
- No public write access; read-only dashboard for anyone else visiting

---

## Layout

- **Header:** small user-provided logo
- **Heading:** app name — "For Fun: An F1 Personal Prediction Tracker"
- **Hero subheading:** "a non-serious prediction tracker"
- **Hero text (right side):** "I casually watch F1. My spouse has followed and watched for years. Let's see how we do with predicting the remaining races of the 2026 season of Formula 1!"
- **Score summary section:** simple head-to-head score, you vs. spouse
- **Dashboard:** full prediction/results detail, most recent race first
- **Footer (two-line layout):**
  - Line 1: data source credit (e.g. "Data via Jolpica F1")
  - Line 2: GitHub icon + repo link, alongside a link to `www.pixelsbysarah.com`
  - Right-aligned or centered, tasteful and low-visual-weight — not competing with the dashboard content

---

## Design

- **No light/dark mode toggle** — one fixed design
- **Background:** dark charcoal (near-black), CSS-textured to suggest racing asphalt (layered gradients/noise, no image asset)
- **Text:** off-white by default; black only when placed on a bright accent background (e.g. yellow)
- **Accent colors:** team colors applied to a driver's name/text when selected (e.g. McLaren orange/black), stored in an easily editable config (JSON/TS object)
  - Incorrect predictions render in greyscale
  - Correct predictions keep full team color
  - Correct predictions get a small CSS-drawn green checkmark (no icon asset)
- **Fonts (Google Fonts, easily swappable):**
  - Headlines: Merriweather + serif fallback stack
  - Body: Lato + sans-serif fallback stack
- **Track-limit detail:** thin (~1rem) white-and-red dashed line along the left and right viewport gutters
- **Icons:** Heroicons throughout, used sparingly and purposefully; GitHub icon uses the standard official SVG

---

## Technical Details

### Data Layer
- Adapter/translation layer between the external F1 API (OpenF1) and the app's internal data shape, so the source API can be swapped with minimal changes elsewhere in the app
- OpenF1 is matched to a race by session date, not round ordinal (it exposes no round number), and composes four per-session endpoints (`session_result`, `laps`, `race_control`, `drivers`) into one internal result. It provides all six scored categories, including the Track-scope RED-flag count that Jolpica/Ergast does not
- Final race results are fetched, sanitized, and validated before being stored in the database — API responses are not trusted or rendered directly
- Stored `last_fetched` timestamp (in the DB, not in-memory — required since Vercel serverless functions don't persist memory between requests) drives refresh logic
- Data refresh triggers on page load, but is rate-limited to once per 5 minutes to stay well under OpenF1's published 3 req/s, 30 req/min limit; each run also caps the number of races fetched (~4 requests each) so a backlog can't burst the limit in a single run
- OpenF1's free tier excludes the paid "live" window (30 min before a session start to 30 min after it ends), so a refresh during or just after a race legitimately returns nothing yet — the adapter treats that as "no results yet" and retries on the next cycle, not as an error
- Footer credits the data source (OpenF1, openf1.org) and carries the CC BY-NC-SA 4.0 non-affiliation disclaimer per its license terms

### Local Development Environment
- Supabase CLI + Docker are used for **local development only** — this runs a local Postgres/Auth/Storage stack so changes (including MRs/PRs) can be previewed and tested before merging, without touching the hosted production Supabase project
- `supabase start` spins up the local stack; `.env.local` points the Next.js app at the local instance's URL and local anon key (never the hosted project's keys)
- `npm run dev` runs the app against this local stack for day-to-day development and PR review
- Local dev is separate from CI: the GitHub Actions agents (reviewer/tester) do not require Docker or a local Supabase stack — they run against the codebase directly, not a live database
- Docker is not required for deployment — Vercel's hosted build does not use it

### Secrets & Deployment
- GitHub repo is public — no secrets committed, ever
- Repo connects directly to Vercel; every push to `main` auto-deploys (no manual/local deploy step)
- All secrets (Supabase keys, etc.) live in Vercel's environment variable dashboard
- `.env.example` committed with placeholder variable names only
- `.env.local` in `.gitignore` from the first commit
- Any secret needed by GitHub Actions (e.g. for agent workflows) lives in GitHub repo secrets, never in code

### Testing & Quality
- ESLint configured from project init
- Vitest + React Testing Library for unit/component tests
- A plain (non-AI) CI workflow runs `lint` and `test` on every PR and is set as a **required status check** in branch protection — this is the actual merge gate, independent of what the Claude reviewer/tester agents comment. A failing build cannot be merged, full stop.
- Vercel's own build (triggered by its GitHub integration) catches compile errors but does **not** run lint or the test suite on its own — the CI workflow above is what covers that gap
- Dependabot enabled via `.github/dependabot.yml` for weekly npm and GitHub Actions dependency update PRs
- GitHub code scanning / secret scanning already enabled at the repo level (confirmed, no action needed)

---

## Account Setup & Access Control

### Account Creation
- No public sign-up route exists anywhere in the app — login form only
- The two accounts (you + spouse) are created manually via the Supabase dashboard (Authentication → Users), with a temporary password each
- On first login, each user is forced to:
  1. Set a permanent password
  2. Enroll MFA (TOTP) before gaining write access to predictions
- No new accounts can be created after this without direct Supabase dashboard access — closing off the public-repo attack surface entirely

### No Hardcoded User Restriction
- User access is not restricted by hardcoding IDs/emails in the codebase
- Restriction is structural: since no signup route exists, only the accounts manually created in Supabase can ever authenticate
- All write permissions are enforced dynamically via Supabase Row Level Security (RLS), scoped to `auth.uid()` — each prediction row is tied to the authenticated user who created it, with no user-identifying logic in application code

### Row Level Security (RLS)
- Dashboard/results data: readable without restriction (public-facing, read-only)
- Predictions table:
  - Insert/update allowed only where `auth.uid()` matches the row's owning user
  - Write operations additionally require an MFA-verified session (Supabase's `aal2` assurance level claim), so a password-only session cannot write predictions even if authenticated — MFA enrollment is enforced, not just offered

### Session & Token Security
- Supabase issues short-lived JWT access tokens with httpOnly, secure refresh token cookies (via the `@supabase/ssr` package for Next.js) — tokens are not accessible to client-side JavaScript, mitigating XSS-based token theft
- Refresh tokens rotate automatically on use
- Login attempts are rate-limited at the Supabase Auth layer by default
- API responses only return the fields the UI needs (e.g. no incidental exposure of other users' emails or account metadata through prediction endpoints)

---

## SDLC Agent Architecture

Agents run via Claude Code, orchestrated through GitHub Actions on PRs:

1. **Implementer agent** — writes code for a given feature/ticket on a branch, opens a PR
2. **Reviewer agent** — reviews the PR for correctness, style, and security; specifically checks for secret leakage, injection risks, and auth-logic issues given this app handles login/MFA; requests changes if needed
3. **Tester agent** — writes/runs unit tests for changed code via Vitest, flags coverage gaps
4. **Human (you)** — final review and merge; no auto-merge

---

## Open Items / Notes
- The data source is OpenF1: it supplies all six scored categories (Jolpica/Ergast exposes no red-flag data, leaving that category permanently unscoreable), which is why we swapped off Jolpica. If OpenF1 ever becomes unreliable or shuts down, the adapter layer means swapping to Jolpica or another source should only require changes in one place
- Two-user model now; schema should stay simple but not preclude adding more users later if you want to expand it
