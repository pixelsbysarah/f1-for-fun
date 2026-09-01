-- Fix: predictions could not be inserted or updated.
--
-- 20260824120100_rls_policies.sql created the predictions write policies as
-- `AS RESTRICTIVE` but never paired them with a PERMISSIVE policy. In Postgres
-- RLS a write is allowed only when at least one PERMISSIVE policy passes AND
-- every RESTRICTIVE policy passes. With no permissive INSERT/UPDATE policy,
-- every write was denied — even for the row's owner in an MFA-verified (aal2)
-- session. (Missed until now because it only surfaces once a session actually
-- reaches aal2.)
--
-- This migration splits the two concerns into separate policies so both are
-- enforced independently:
--   * PERMISSIVE  — grants the write, scoped to the owner (auth.uid() = user_id)
--   * RESTRICTIVE — the MFA gate: the session's `aal` claim must be `aal2`
--
-- Keeping the aal2 check in its own restrictive policy preserves the original
-- security intent (CLAUDE.md #4): MFA enforcement stays structurally separate,
-- so a future permissive policy can't accidentally re-open writes to
-- password-only (aal1) sessions. Net effect vs. the broken state: owner +
-- aal2 can now write; nothing else can that couldn't before (nothing could).
--
-- Unchanged: SELECT stays permissive for any authenticated user (head-to-head
-- dashboard); there is still no DELETE policy (predictions are edit-in-place).

-- Drop the unpaired restrictive policies from 20260824120100.
drop policy if exists
  "Users can insert their own predictions when MFA-verified" on public.predictions;
drop policy if exists
  "Users can update their own predictions when MFA-verified" on public.predictions;

-- ---------------------------------------------------------------------------
-- PERMISSIVE: a user may write only their own prediction rows.
-- ---------------------------------------------------------------------------
create policy "Users can insert their own predictions"
  on public.predictions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own predictions"
  on public.predictions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- RESTRICTIVE: every prediction write additionally requires an MFA-verified
-- (aal2) session. A password-only (aal1) session cannot write, even to its
-- own rows. This ANDs with the permissive policies above.
-- ---------------------------------------------------------------------------
create policy "Prediction inserts require an MFA-verified session"
  on public.predictions as restrictive
  for insert
  to authenticated
  with check ((select auth.jwt() ->> 'aal') = 'aal2');

create policy "Prediction updates require an MFA-verified session"
  on public.predictions as restrictive
  for update
  to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2')
  with check ((select auth.jwt() ->> 'aal') = 'aal2');
