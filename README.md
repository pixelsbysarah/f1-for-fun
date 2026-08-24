# f1-for-fun

Showcasing F1 predictions made by my spouse and me and, of course, keeping score!

A personal, two-user F1 prediction tracker for the 2026 season. Portfolio
piece — not a commercial product. See [`CLAUDE.md`](./CLAUDE.md) for project
rules and [`docs/build-spec.md`](./docs/build-spec.md) for the full spec.

## Stack

- **Next.js** (App Router) + React + TypeScript
- **Tailwind CSS** + **DaisyUI** (fixed dark theme)
- **Supabase** (Postgres + Auth, TOTP MFA) via `@supabase/ssr`
- **Vitest** + React Testing Library
- **ESLint**
- Hosted on **Vercel** (auto-deploy from `main`)

## Getting started

Install dependencies and run the dev server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Scripts

| Command         | What it does                          |
| --------------- | ------------------------------------- |
| `npm run dev`   | Start the Next.js dev server          |
| `npm run build` | Production build                      |
| `npm run lint`  | Run ESLint                            |
| `npm test`      | Run the Vitest suite once             |
| `npm run test:watch` | Run Vitest in watch mode         |

## Environment variables

Copy `.env.example` to `.env.local` and fill in values there. `.env.local` is
gitignored and must never be committed. **No real secrets belong in the repo**
(CLAUDE.md rule #1) — production secrets live in Vercel's dashboard.

```bash
cp .env.example .env.local
```

## Local development environment (Supabase CLI + Docker)

Supabase runs locally via the Supabase CLI + Docker for development only. This
is a throwaway local Postgres/Auth/Storage stack — it never touches the hosted
production project. (Supabase isn't wired into the app yet; this gets the stack
ready for the next ticket.)

**Prerequisites:** [Docker](https://docs.docker.com/get-docker/) running, and
the [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
# Start the local stack (Postgres, Auth, Storage, Studio, mail catcher).
supabase start
```

`supabase start` prints a local **API URL** and **anon key**. Paste those into
`.env.local` (they are local-only values, not the hosted project's keys — never
commit them):

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from `supabase start` output>
```

Then run the app against the local stack:

```bash
npm run dev
```

Useful endpoints while the stack is up:

- Studio (DB UI): http://127.0.0.1:54323
- Inbucket (captured emails, e.g. MFA): http://127.0.0.1:54324

Stop the stack with `supabase stop`. Local config lives in
[`supabase/config.toml`](./supabase/config.toml). CI does **not** need Docker
or Supabase — it runs `lint` and `test` against the codebase directly.

### Applying the schema & RLS locally

The database schema and Row Level Security policies live as SQL migrations in
[`supabase/migrations/`](./supabase/migrations). Apply them to the local stack:

```bash
# Applies all migrations, then loads supabase/seed.sql (sample 2026 races).
supabase db reset
```

`supabase start` also applies migrations + seed on first boot. To apply new
migrations without wiping data, use `supabase migration up`. When you change
the schema, add a new timestamped file with `supabase migration new <name>`
rather than editing an applied migration.

What the migrations create:

- **`races`** — the season calendar (season, round, name, circuit, date,
  `is_completed`). Public read; the app never writes it (the data adapter in a
  later ticket writes via the service role).
- **`predictions`** — one row per (user, race) with P1/P2/P3, fastest-lap
  driver, DNF count, and red-flag count. Readable by any authenticated user
  (for the head-to-head dashboard); a user may insert/update **only their own
  rows**, and **only from an MFA-verified (`aal2`) session** — a password-only
  session cannot write. No user identity is hardcoded; ownership is enforced
  dynamically via `auth.uid()`.

## Authentication & accounts

There is **no sign-up route anywhere in the app** — login is the only auth
entry point (CLAUDE.md #2). The two accounts are created manually in Supabase.

### Creating the two user accounts (manual, one-time)

Do this in the **Supabase dashboard** (hosted project) for production, or in
local **Studio** (http://127.0.0.1:54323) for local testing:

1. Go to **Authentication → Users → Add user**.
2. Enter the person's **email** and a **temporary password**. Enable
   "Auto Confirm User" (local dev has email confirmation off already).
3. Leave user metadata empty — do **not** set `password_set`. The absence of
   that flag is what forces the first-login password change.
4. Repeat for the second user.

Never create accounts through application code, and never commit these
credentials. That's the entire access-control surface: since no signup route
exists, only accounts created here can ever authenticate.

### First-login flow

On first login each user is walked through onboarding before they can reach the
predictions portal or write anything:

1. **Sign in** with the temporary password (`/login`).
2. **Set a permanent password** (`/onboarding`).
3. **Enroll TOTP MFA** — scan the QR code with an authenticator app and verify
   a code. Locally, there's no SMS/email step; the QR is shown in-page.
4. Land on the **predictions portal** (`/portal`), now MFA-verified (`aal2`).

On every subsequent login, after the password step the user must pass an **MFA
challenge** (`/login/mfa`) before the session reaches `aal2`. Writing
predictions requires `aal2`, enforced at the database by RLS — MFA is
mandatory for writes, not optional.

Sessions are stored in **httpOnly, secure cookies** via `@supabase/ssr` (not
localStorage/sessionStorage), keeping tokens out of reach of client-side
JavaScript.

## Project structure

```
app/                 App Router entry (layout, page, global styles)
  login/             Login form + MFA challenge (only auth entry point)
  onboarding/        First-login: set password + enroll TOTP
  portal/            Authenticated predictions portal + save action
  auth/next/         Central post-auth routing hub
components/
  layout/            Site header + footer
  sections/          Hero, score summary, dashboard placeholders
lib/
  config/            Editable design tokens + site copy (single source)
  supabase/          Browser/server/middleware Supabase clients + env
  auth/              Auth-state reading + routing logic
  predictions/       Prediction types + input validation
  fonts.ts           Google Font loaders (swappable)
middleware.ts        Session refresh + protected-route guard
supabase/
  config.toml        Local dev stack config
  migrations/        Schema + RLS (applied via `supabase db reset`)
  seed.sql           Sample 2026 races for local dev
```

Design tokens (team colors, fonts) and site copy live under `lib/config/` so
they stay editable in one place per CLAUDE.md.
