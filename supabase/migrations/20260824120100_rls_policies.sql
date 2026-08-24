-- Row Level Security for races and predictions.
--
-- Security model (build-spec "Row Level Security"):
--   * races        — public read; NO write policy, so only the service role
--                    (data adapter, Ticket 3) can write, bypassing RLS.
--   * predictions  — any authenticated user may read (needed for the
--                    head-to-head dashboard); a user may insert/update ONLY
--                    their own rows, and ONLY from an MFA-verified session
--                    (assurance level aal2). A password-only (aal1) session
--                    cannot write, even for its own rows.
--
-- The aal2 requirement is what makes MFA mandatory for writes rather than
-- optional: it is enforced here at the database, independent of any app code.

alter table public.races enable row level security;
alter table public.predictions enable row level security;

-- ---------------------------------------------------------------------------
-- races: public, read-only from the app
-- ---------------------------------------------------------------------------
-- Readable by everyone (anon + authenticated) for the public dashboard.
create policy "Races are viewable by everyone"
  on public.races
  for select
  using (true);

-- Intentionally NO insert/update/delete policies: with RLS enabled and no
-- write policy, all writes are denied for anon/authenticated roles. The data
-- adapter uses the service role key, which bypasses RLS.

-- ---------------------------------------------------------------------------
-- predictions
-- ---------------------------------------------------------------------------
-- Read: any authenticated user can see all predictions (head-to-head view).
-- Anonymous visitors cannot read predictions directly (the public dashboard is
-- served pre-scored in a later ticket); scope read to the authenticated role.
create policy "Predictions are viewable by authenticated users"
  on public.predictions
  for select
  to authenticated
  using (true);

-- Insert: only your own row, and only with an MFA-verified (aal2) session.
create policy "Users can insert their own predictions when MFA-verified"
  on public.predictions
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

-- Update: only your own row, and only with an MFA-verified (aal2) session.
-- Both USING (the row as it exists) and WITH CHECK (the row after update) are
-- constrained so a user can neither edit someone else's row nor reassign
-- ownership to themselves.
create policy "Users can update their own predictions when MFA-verified"
  on public.predictions
  for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    (select auth.uid()) = user_id
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

-- No delete policy: predictions are not user-deletable (edit-in-place only).
