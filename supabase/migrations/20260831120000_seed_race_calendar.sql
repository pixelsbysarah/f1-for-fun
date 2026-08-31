-- Seed the 2026 race calendar into `public.races`.
--
-- Why this is a migration and not `supabase/seed.sql`:
--   `seed.sql` is loaded only by the local Supabase CLI (`supabase db reset` /
--   `supabase start`) and never runs against the hosted project. The F1 data
--   adapter (Ticket 3) only ever *updates* existing race rows with results
--   (`SupabaseRaceResultsStore.saveRaceResult` is an UPDATE ... WHERE id = ...)
--   — nothing in the app inserts the calendar. So on the hosted project the
--   `races` table stayed empty after deploy while `fetch_metadata` populated
--   (the adapter's 5-minute gate upserts its bookkeeping row regardless of
--   whether any races exist). This migration is the calendar's population path
--   for production.
--
-- Matching note: the adapter matches an OpenF1 session to a race by UTC
-- calendar day (`selectRaceSessionKey` in lib/f1-adapter/openf1.ts), never by
-- round ordinal. `race_date` below therefore only needs to land on the correct
-- UTC day. Times are the scheduled race start in UTC, best-effort from the
-- published 2026 calendar; OpenF1's `/sessions?year=2026&session_type=Race` is
-- the canonical source and any correction here is a one-line UPDATE. The Las
-- Vegas race runs Saturday night local, which is Sunday in UTC — round 22 is
-- deliberately dated 2026-11-22.
--
-- All rows start `is_completed = false`; the adapter flips that when it writes
-- a race's results. `on conflict (season, round) do nothing` keeps this
-- idempotent and non-destructive if some rows already exist.

insert into public.races (season, round, name, circuit, race_date, is_completed)
values
  (2026,  1, 'Australian Grand Prix',      'Albert Park Circuit',                '2026-03-08 04:00:00+00', false),
  (2026,  2, 'Chinese Grand Prix',         'Shanghai International Circuit',      '2026-03-15 07:00:00+00', false),
  (2026,  3, 'Japanese Grand Prix',        'Suzuka International Racing Course',  '2026-03-29 05:00:00+00', false),
  (2026,  4, 'Bahrain Grand Prix',         'Bahrain International Circuit',       '2026-04-12 15:00:00+00', false),
  (2026,  5, 'Saudi Arabian Grand Prix',   'Jeddah Corniche Circuit',            '2026-04-19 17:00:00+00', false),
  (2026,  6, 'Miami Grand Prix',           'Miami International Autodrome',       '2026-05-03 20:00:00+00', false),
  (2026,  7, 'Canadian Grand Prix',        'Circuit Gilles Villeneuve',          '2026-05-24 18:00:00+00', false),
  (2026,  8, 'Monaco Grand Prix',          'Circuit de Monaco',                  '2026-06-07 13:00:00+00', false),
  (2026,  9, 'Spanish Grand Prix',         'Circuit de Barcelona-Catalunya',     '2026-06-14 13:00:00+00', false),
  (2026, 10, 'Austrian Grand Prix',        'Red Bull Ring',                      '2026-06-28 13:00:00+00', false),
  (2026, 11, 'British Grand Prix',         'Silverstone Circuit',                '2026-07-05 14:00:00+00', false),
  (2026, 12, 'Belgian Grand Prix',         'Circuit de Spa-Francorchamps',       '2026-07-19 13:00:00+00', false),
  (2026, 13, 'Hungarian Grand Prix',       'Hungaroring',                        '2026-07-26 13:00:00+00', false),
  (2026, 14, 'Dutch Grand Prix',           'Circuit Zandvoort',                  '2026-08-23 13:00:00+00', false),
  (2026, 15, 'Italian Grand Prix',         'Autodromo Nazionale Monza',          '2026-09-06 13:00:00+00', false),
  (2026, 16, 'Spanish Grand Prix (Madrid)','Madring',                            '2026-09-13 13:00:00+00', false),
  (2026, 17, 'Azerbaijan Grand Prix',      'Baku City Circuit',                  '2026-09-27 11:00:00+00', false),
  (2026, 18, 'Singapore Grand Prix',       'Marina Bay Street Circuit',          '2026-10-11 12:00:00+00', false),
  (2026, 19, 'United States Grand Prix',   'Circuit of the Americas',            '2026-10-25 19:00:00+00', false),
  (2026, 20, 'Mexico City Grand Prix',     'Autodromo Hermanos Rodriguez',       '2026-11-01 20:00:00+00', false),
  (2026, 21, 'Sao Paulo Grand Prix',       'Autodromo Jose Carlos Pace',         '2026-11-08 17:00:00+00', false),
  (2026, 22, 'Las Vegas Grand Prix',       'Las Vegas Strip Circuit',            '2026-11-22 06:00:00+00', false),
  (2026, 23, 'Qatar Grand Prix',           'Lusail International Circuit',        '2026-11-29 16:00:00+00', false),
  (2026, 24, 'Abu Dhabi Grand Prix',       'Yas Marina Circuit',                 '2026-12-06 13:00:00+00', false)
on conflict (season, round) do nothing;
