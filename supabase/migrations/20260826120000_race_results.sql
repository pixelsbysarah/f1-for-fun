-- Race results + fetch bookkeeping for the F1 data adapter (Ticket 3).
--
-- Adds the columns the adapter writes once a race is complete, plus a small
-- table that records when each external resource was last polled. Both are
-- written only by the service role (the adapter); the app treats them as
-- read-only, same as the rest of the `races` table.

-- ---------------------------------------------------------------------------
-- races: final result columns
-- ---------------------------------------------------------------------------
alter table public.races
  add column if not exists result_classification jsonb,
  add column if not exists fastest_lap_driver     text,
  add column if not exists result_dnf_count        integer,
  add column if not exists red_flag                boolean,
  add column if not exists results_fetched_at      timestamptz;

comment on column public.races.result_classification is
  'Final finishing order as a sanitized JSON array of entries '
  '(position, driverCode, driverName, constructorName, status, finished). '
  'Written by the data adapter (service role); never raw external fields.';

comment on column public.races.fastest_lap_driver is
  'Driver code credited with the fastest lap, sanitized. Null if unavailable.';

comment on column public.races.result_dnf_count is
  'Number of classified non-finishers, derived from each entry''s status.';

comment on column public.races.red_flag is
  'Whether a red flag occurred. NULL = unknown: Jolpica/Ergast does not expose '
  'red-flag data, so this stays null until a source that provides it is added.';

comment on column public.races.results_fetched_at is
  'When this race''s result row was last written by the adapter.';

-- Defensive bound mirroring the app-layer sanitizer (full 2026 grid is 22).
alter table public.races
  drop constraint if exists races_result_dnf_count_range;
alter table public.races
  add constraint races_result_dnf_count_range
    check (result_dnf_count is null or (result_dnf_count >= 0 and result_dnf_count <= 22));

-- ---------------------------------------------------------------------------
-- fetch_metadata: persistent last_fetched, one row per polled resource
-- ---------------------------------------------------------------------------
-- Stored in the DB (not memory) because Vercel serverless invocations don't
-- share memory. `last_fetched` drives the adapter's 5-minute refresh gate.
create table if not exists public.fetch_metadata (
  resource     text primary key,
  last_fetched timestamptz not null default now()
);

comment on table public.fetch_metadata is
  'Bookkeeping for external data fetches. `last_fetched` per resource drives '
  'the adapter''s 5-minute refresh rate limit. Written by the service role only.';

alter table public.fetch_metadata enable row level security;

-- Public read (same posture as races); no write policy, so only the service
-- role (adapter) can write, bypassing RLS.
create policy "Fetch metadata is viewable by everyone"
  on public.fetch_metadata
  for select
  using (true);
