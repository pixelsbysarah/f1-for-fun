-- Local development seed data (loaded by `supabase start` / `supabase db reset`).
--
-- A handful of 2026 races so the predictions portal has something to list
-- before the F1 data adapter (Ticket 3) populates real calendar data. These
-- are illustrative rows for local testing only — production race data is
-- fetched, sanitized, and written by the adapter, never seeded here.
insert into public.races (season, round, name, circuit, race_date, is_completed)
values
  (2026, 1, 'Australian Grand Prix', 'Albert Park Circuit',        '2026-03-08 05:00:00+00', true),
  (2026, 2, 'Chinese Grand Prix',    'Shanghai International Circuit', '2026-03-22 07:00:00+00', true),
  (2026, 3, 'Japanese Grand Prix',   'Suzuka Circuit',             '2026-04-05 05:00:00+00', false),
  (2026, 4, 'Bahrain Grand Prix',    'Bahrain International Circuit',  '2026-04-12 15:00:00+00', false),
  (2026, 5, 'Miami Grand Prix',      'Miami International Autodrome',  '2026-05-03 19:30:00+00', false)
on conflict (season, round) do nothing;
