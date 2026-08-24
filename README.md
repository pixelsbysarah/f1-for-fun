# f1-for-fun

Showcasing F1 predictions made by my spouse and me and, of course, keeping score!

A personal, two-user F1 prediction tracker for the 2026 season. Portfolio
piece — not a commercial product. See [`CLAUDE.md`](./CLAUDE.md) for project
rules and [`docs/build-spec.md`](./docs/build-spec.md) for the full spec.

## Stack

- **Next.js** (App Router) + React + TypeScript
- **Tailwind CSS** + **DaisyUI** (fixed dark theme)
- **Supabase** (Postgres + Auth, TOTP MFA) — _wired up in a later ticket_
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

## Project structure

```
app/                 App Router entry (layout, page, global styles)
components/
  layout/            Site header + footer
  sections/          Hero, score summary, dashboard placeholders
lib/
  config/            Editable design tokens + site copy (single source)
  fonts.ts           Google Font loaders (swappable)
supabase/            Local dev stack config
```

Design tokens (team colors, fonts) and site copy live under `lib/config/` so
they stay editable in one place per CLAUDE.md.
