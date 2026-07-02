-- 033: Fix 42P17 infinite recursion between friend_invites and profiles RLS.
--
-- Cycle introduced by 024 + 029:
--   friend_invites_select_related  -> subquery on profiles (own email lookup)
--   profiles_self_or_linked        -> subquery on friend_invites
--
-- Every SELECT on friend_invites failed with:
--   "infinite recursion detected in policy for relation friend_invites"
-- which silently broke loading pending/outgoing invites in the client
-- (refreshCloudData logged a warning and returned no invites).
--
-- Fix: the friend_invites policy no longer touches profiles. The caller's
-- email comes from the JWT (auth.jwt()->>'email') — identical to
-- profiles.email by design (013/031 lock profile email to the signup email).
--
-- Applied to production 2026-07-02 via Supabase MCP (apply_migration).

DROP POLICY IF EXISTS friend_invites_select_related ON public.friend_invites;
CREATE POLICY friend_invites_select_related ON public.friend_invites
  FOR SELECT TO authenticated
  USING (
    (requester_user_id = (select auth.uid()))
    OR (invitee_user_id = (select auth.uid()))
    OR (lower(invitee_email) = lower(coalesce((select auth.jwt() ->> 'email'), '')))
  );
