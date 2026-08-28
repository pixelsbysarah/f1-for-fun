-- Grant the table privileges the app's Postgres roles need.
--
-- Symptom: "permission denied for table fetch_metadata" (SQLSTATE 42501) from
-- maybeRefreshRaceResults() in the deployed project. The service_role bypasses
-- Row Level Security but still needs table-level GRANTs. Supabase normally
-- provides these to anon / authenticated / service_role via ALTER DEFAULT
-- PRIVILEGES on the postgres role; that did not take effect for the objects
-- created by the earlier migrations in the linked project, so grant them
-- explicitly and stop depending on that implicit platform behaviour.
--
-- The same gap also affects the service-role UPDATE to public.races in
-- saveRaceResult(); it just fails later than the fetch_metadata read. The
-- public-read policies on fetch_metadata and races are likewise no-ops for
-- anon / authenticated without an underlying GRANT SELECT.
--
-- RLS and the existing policies are unchanged: grants and RLS are independent
-- layers. All three tables use uuid / text primary keys (no sequences), so no
-- GRANT ... ON SEQUENCE is required.

-- ---------------------------------------------------------------------------
-- fetch_metadata: service role reads + upserts the last_fetched row; anon and
-- authenticated get read parity with the "viewable by everyone" policy.
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.fetch_metadata to service_role;
grant select                         on public.fetch_metadata to anon, authenticated;

-- ---------------------------------------------------------------------------
-- races: the data adapter writes result columns via the service role; public
-- read for the dashboard.
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.races to service_role;
grant select                         on public.races to anon, authenticated;

-- ---------------------------------------------------------------------------
-- predictions: owner writes run as the authenticated role (RLS still scopes
-- them to auth.uid() + an aal2 session). service_role retained for
-- maintenance / backfill.
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.predictions to service_role;
grant select, insert, update         on public.predictions to authenticated;

-- ---------------------------------------------------------------------------
-- Stop a future migration run from reintroducing the gap for new tables.
-- ---------------------------------------------------------------------------
alter default privileges in schema public
  grant select on tables to anon, authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
