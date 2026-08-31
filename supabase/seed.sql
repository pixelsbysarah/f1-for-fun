-- Local development seed data (loaded by `supabase start` / `supabase db reset`,
-- and only after every migration has been applied).
--
-- The 2026 race calendar itself is inserted by
-- `migrations/20260831120000_seed_race_calendar.sql` with every race
-- `is_completed = false`. This file layers local-only test state on top: it
-- marks every race whose start time has already passed as complete, so the
-- predictions portal shows a realistic split of past vs upcoming races without
-- waiting on a live adapter fetch. Re-running a reset later naturally advances
-- the split as more races fall into the past.
--
-- Result columns (`result_classification`, `fastest_lap_driver`,
-- `result_dnf_count`, `red_flag_count`, `results_fetched_at`) are deliberately
-- left null: those are written only by the F1 data adapter from real,
-- sanitized OpenF1 data (CLAUDE.md #5), never seeded here. A completed race
-- with null results simply drops off the portal's upcoming list, which is all
-- this fixture needs to exercise.
--
-- Runs against whatever the calendar migration inserted; if that migration
-- hasn't run this UPDATE just matches zero rows.
update public.races
set is_completed = true
where season = 2026
  and race_date < now();
