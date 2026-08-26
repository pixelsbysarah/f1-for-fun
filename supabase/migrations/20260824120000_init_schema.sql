-- Initial schema for For Fun: F1 prediction tracker.
--
-- Two tables:
--   * races        — the season calendar; which races exist and whether they
--                    are completed. Written only by the data adapter (Ticket 3)
--                    via the service role; read-only from the app's POV.
--   * predictions  — one row per (user, race) with that user's guesses.
--
-- No user identity is hardcoded anywhere: a prediction is tied to its owner by
-- `user_id`, defaulted to `auth.uid()` and enforced by RLS (see the RLS
-- migration). Access is structural, never keyed to a specific email/UUID.

-- ---------------------------------------------------------------------------
-- races
-- ---------------------------------------------------------------------------
create table if not exists public.races (
  id           uuid primary key default gen_random_uuid(),
  season       integer not null,
  round        integer not null,
  name         text not null,
  circuit      text,
  race_date    timestamptz,
  is_completed boolean not null default false,
  created_at   timestamptz not null default now(),
  -- A season has one race per round number.
  unique (season, round)
);

comment on table public.races is
  'F1 race calendar. Written by the data adapter (service role) only; the app treats it as read-only.';

-- Dashboard lists races most-recent-first and filters upcoming vs completed.
create index if not exists races_season_round_idx
  on public.races (season, round desc);

-- ---------------------------------------------------------------------------
-- predictions
-- ---------------------------------------------------------------------------
create table if not exists public.predictions (
  id                 uuid primary key default gen_random_uuid(),
  -- Owning user. Defaults to the caller so inserts never have to trust a
  -- client-supplied id; RLS additionally enforces auth.uid() = user_id.
  user_id            uuid not null default auth.uid()
                       references auth.users (id) on delete cascade,
  race_id            uuid not null
                       references public.races (id) on delete cascade,
  -- All guesses are nullable: a partial prediction is allowed and any missing
  -- field renders as `-` and scores zero (build-spec scoring rules).
  p1_driver          text,
  p2_driver          text,
  p3_driver          text,
  fastest_lap_driver text,
  dnf_count          integer,
  red_flag_count     integer,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- One prediction per user per race; the portal upserts on this.
  unique (user_id, race_id),
  -- Defensive bounds mirroring app-layer validation.
  constraint predictions_dnf_count_range
    check (dnf_count is null or (dnf_count >= 0 and dnf_count <= 22)),
  constraint predictions_red_flag_count_range
    check (red_flag_count is null or (red_flag_count >= 0 and red_flag_count <= 10))
);

comment on table public.predictions is
  'Per-user, per-race F1 predictions. Readable by any authenticated user (head-to-head dashboard); writable only by the owner in an MFA-verified (aal2) session.';

create index if not exists predictions_race_id_idx
  on public.predictions (race_id);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists predictions_set_updated_at on public.predictions;
create trigger predictions_set_updated_at
  before update on public.predictions
  for each row
  execute function public.set_updated_at();
