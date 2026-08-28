-- Fix the red-flag column type for the OpenF1 source swap (Ticket 3).
--
-- The initial results migration (20260826120000) added `races.red_flag` as a
-- boolean, matching Jolpica, which exposes no red-flag data. OpenF1 provides a
-- count of Track-scope RED events, and `public.predictions.red_flag_count` is
-- an integer with a 0–10 check — scoring compares them by equality, so a
-- boolean actual could never match an integer prediction. Replace the column
-- with an integer mirroring the predictions constraint.
--
-- This is a NEW migration rather than an edit to 20260826120000, which may
-- already be applied locally.

alter table public.races
  drop column if exists red_flag;

alter table public.races
  add column if not exists red_flag_count integer;

alter table public.races
  drop constraint if exists races_red_flag_count_range;
alter table public.races
  add constraint races_red_flag_count_range
    check (red_flag_count is null or (red_flag_count >= 0 and red_flag_count <= 10));

comment on column public.races.red_flag_count is
  'Count of Track-scope RED events during the race (from OpenF1 race_control). '
  'NULL only if results have not yet been fetched.';
