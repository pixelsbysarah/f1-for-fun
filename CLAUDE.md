# Project: For Fun — F1 Personal Prediction Tracker

A personal, two-user F1 prediction tracker for the 2026 season. Public repo,
portfolio piece. Not a commercial product. Read the full build spec at
`/docs/build-spec.md` before starting any ticket.

## Stack
- Next.js (React, Node, TypeScript), App Router
- Tailwind CSS + DaisyUI
- Supabase (Postgres + Auth) for data and authentication
- Vitest + React Testing Library for tests
- ESLint for linting
- Hosted on Vercel, auto-deploy from `main`

## Non-negotiable rules

1. **No secrets in code, ever.** Nothing resembling an API key, connection
   string, or token is committed. All secrets live in Vercel environment
   variables or GitHub repo secrets. A `.env.example` with placeholder names
   only is the one exception.
2. **No public signup route.** The only auth entry point is login. Accounts
   are created manually via the Supabase dashboard, never through
   application code.
3. **No hardcoded user identity.** Never gate features by a specific email,
   UUID, or name in application code. All access control is enforced through
   Supabase Row Level Security, scoped dynamically to `auth.uid()`.
4. **MFA is required for writes, not optional.** Any insert/update to the
   predictions table must be blocked at the RLS layer unless the session's
   assurance level is `aal2` (MFA-verified) — a password-only session must
   not be able to write.
5. **External API data is untrusted.** Anything pulled from the F1 data
   source (OpenF1 by default) is sanitized and validated before being
   stored or rendered. Never render raw external API fields directly.
6. **Keep the data source swappable.** All calls to the external F1 API go
   through the adapter layer (`/lib/f1-adapter` or equivalent) — nothing
   elsewhere in the app should know or care whether the source is OpenF1,
   Jolpica, or something else.
7. **Design tokens stay editable.** Team colors, fonts, and similar design
   values live in a single config file, not scattered inline in components.
8. **Clear, concise responses.** Please keep responses and feedback concise yet
   informative. Skip verbose preambles. Provide direct answers, including 
   necessary details like file names, code examples, and solutions where relevant.

## Scoring rules (implement exactly as specified)
- Podium (P1/P2/P3): 3 correct drivers + correct order = 4 points; 3 correct
  drivers, wrong order = 3 points; 2 correct drivers (any order) = 2 points;
  1 correct driver (any order) = 1 point; otherwise 0.
- Fastest lap, DNF count, red flags: 1 point if correct, 0 if not.
- A missing prediction displays as `-` per field and scores 0.
- Per-race maximum is 7 (podium 4 + three flat categories), or 6 when
  red-flag data is unavailable. Season accuracy is total points over that
  maximum, so it is podium-weighted, not an even category average.

## Design constraints
- Fixed dark theme only — no light/dark toggle.
- Correct predictions keep full team color + a CSS-drawn green checkmark.
  Incorrect predictions render in greyscale.
- Headlines: Merriweather + serif fallback. Body: Lato + sans-serif fallback.
  Both swappable via config.
- Icons: Heroicons throughout, used sparingly; GitHub icon uses the official
  SVG mark.

## Testing expectations
- Any scoring logic, the F1 API adapter/sanitization layer, and any
  auth-adjacent logic must have unit test coverage before merge.
- Don't write tests that just assert static markup renders — test behavior.

## Workflow
- Work happens on a feature branch per ticket, opened as a PR against `main`.
- No agent merges its own PR or any other PR. A human merges after review.
