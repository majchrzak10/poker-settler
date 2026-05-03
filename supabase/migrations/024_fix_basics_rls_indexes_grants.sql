-- 020: fix basic issues found by Supabase advisors
-- Wykonane: 2026-05-03 przez MCP apply_migration
-- 1) usuwa zduplikowane policies z baseline (own ALL public)
-- 2) przepisuje policies z auth.uid() -> (select auth.uid()) dla performance
-- 3) dodaje brakujące indeksy na FK
-- 4) revoke EXECUTE on anon dla SECURITY DEFINER functions które wymagają zalogowania

-- 1. Drop duplicate baseline policies
DROP POLICY IF EXISTS "own" ON public.profiles;
DROP POLICY IF EXISTS "own" ON public.session_players;
DROP POLICY IF EXISTS "own" ON public.transfers;
DROP POLICY IF EXISTS "own" ON public.sessions;

-- 2. Rewrite policies with (select auth.uid())

-- client_logs
DROP POLICY IF EXISTS client_logs_insert_own ON public.client_logs;
CREATE POLICY client_logs_insert_own ON public.client_logs
  FOR INSERT TO authenticated
  WITH CHECK ((user_id IS NULL) OR (user_id = (select auth.uid())));

DROP POLICY IF EXISTS client_logs_select_own ON public.client_logs;
CREATE POLICY client_logs_select_own ON public.client_logs
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

-- friend_invites
DROP POLICY IF EXISTS friend_invites_insert_own ON public.friend_invites;
CREATE POLICY friend_invites_insert_own ON public.friend_invites
  FOR INSERT TO authenticated
  WITH CHECK (
    (requester_user_id = (select auth.uid()))
    AND EXISTS (
      SELECT 1 FROM players p
      WHERE p.id = friend_invites.requester_player_id
        AND p.owner_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS friend_invites_select_related ON public.friend_invites;
CREATE POLICY friend_invites_select_related ON public.friend_invites
  FOR SELECT TO authenticated
  USING (
    (requester_user_id = (select auth.uid()))
    OR (invitee_user_id = (select auth.uid()))
    OR (lower(invitee_email) = lower(COALESCE(
      (SELECT profiles.email FROM profiles WHERE profiles.id = (select auth.uid())),
      ''
    )))
  );

-- live_session_state
DROP POLICY IF EXISTS live_session_select_own ON public.live_session_state;
CREATE POLICY live_session_select_own ON public.live_session_state
  FOR SELECT
  USING ((select auth.uid()) = owner_id);

DROP POLICY IF EXISTS live_session_insert_own ON public.live_session_state;
CREATE POLICY live_session_insert_own ON public.live_session_state
  FOR INSERT
  WITH CHECK ((select auth.uid()) = owner_id);

DROP POLICY IF EXISTS live_session_update_own ON public.live_session_state;
CREATE POLICY live_session_update_own ON public.live_session_state
  FOR UPDATE
  USING ((select auth.uid()) = owner_id)
  WITH CHECK ((select auth.uid()) = owner_id);

DROP POLICY IF EXISTS live_session_delete_own ON public.live_session_state;
CREATE POLICY live_session_delete_own ON public.live_session_state
  FOR DELETE
  USING ((select auth.uid()) = owner_id);

-- participations
DROP POLICY IF EXISTS select_own ON public.participations;
CREATE POLICY select_own ON public.participations
  FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS insert_owner_or_self ON public.participations;
CREATE POLICY insert_owner_or_self ON public.participations
  FOR INSERT TO authenticated
  WITH CHECK (
    ((select auth.uid()) = user_id)
    OR EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = participations.session_id
        AND s.owner_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS delete_own_or_session_owner ON public.participations;
CREATE POLICY delete_own_or_session_owner ON public.participations
  FOR DELETE TO authenticated
  USING (
    ((select auth.uid()) = user_id)
    OR EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = participations.session_id
        AND s.owner_id = (select auth.uid())
    )
  );

-- players
DROP POLICY IF EXISTS players_select_own ON public.players;
CREATE POLICY players_select_own ON public.players
  FOR SELECT TO authenticated
  USING (owner_id = (select auth.uid()));

DROP POLICY IF EXISTS players_insert_own ON public.players;
CREATE POLICY players_insert_own ON public.players
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = (select auth.uid()));

DROP POLICY IF EXISTS players_insert_reciprocal_friend ON public.players;
CREATE POLICY players_insert_reciprocal_friend ON public.players
  FOR INSERT TO authenticated
  WITH CHECK (
    (linked_user_id = (select auth.uid()))
    AND EXISTS (
      SELECT 1 FROM players p
      WHERE p.owner_id = (select auth.uid())
        AND p.linked_user_id = players.owner_id
    )
  );

DROP POLICY IF EXISTS players_update_own ON public.players;
CREATE POLICY players_update_own ON public.players
  FOR UPDATE TO authenticated
  USING (owner_id = (select auth.uid()))
  WITH CHECK (owner_id = (select auth.uid()));

DROP POLICY IF EXISTS players_delete_own ON public.players;
CREATE POLICY players_delete_own ON public.players
  FOR DELETE TO authenticated
  USING (owner_id = (select auth.uid()));

DROP POLICY IF EXISTS players_delete_reciprocal_as_linked ON public.players;
CREATE POLICY players_delete_reciprocal_as_linked ON public.players
  FOR DELETE TO authenticated
  USING (linked_user_id = (select auth.uid()));

-- profiles
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

-- sessions
CREATE POLICY sessions_own ON public.sessions
  FOR ALL TO authenticated
  USING ((select auth.uid()) = owner_id)
  WITH CHECK ((select auth.uid()) = owner_id);

-- session_players
DROP POLICY IF EXISTS session_players_select_owner_or_participant ON public.session_players;
CREATE POLICY session_players_select_owner_or_participant ON public.session_players
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_players.session_id
        AND s.owner_id = (select auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM participations p
      WHERE p.session_id = session_players.session_id
        AND p.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS session_players_insert_owner ON public.session_players;
CREATE POLICY session_players_insert_owner ON public.session_players
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_players.session_id
        AND s.owner_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS session_players_update_owner ON public.session_players;
CREATE POLICY session_players_update_owner ON public.session_players
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_players.session_id
        AND s.owner_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS session_players_delete_owner ON public.session_players;
CREATE POLICY session_players_delete_owner ON public.session_players
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_players.session_id
        AND s.owner_id = (select auth.uid())
    )
  );

-- transfers
DROP POLICY IF EXISTS transfers_select_owner_or_participant ON public.transfers;
CREATE POLICY transfers_select_owner_or_participant ON public.transfers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = transfers.session_id
        AND s.owner_id = (select auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM participations p
      WHERE p.session_id = transfers.session_id
        AND p.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS transfers_insert_owner ON public.transfers;
CREATE POLICY transfers_insert_owner ON public.transfers
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = transfers.session_id
        AND s.owner_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS transfers_update_owner ON public.transfers;
CREATE POLICY transfers_update_owner ON public.transfers
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = transfers.session_id
        AND s.owner_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS transfers_delete_owner ON public.transfers;
CREATE POLICY transfers_delete_owner ON public.transfers
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = transfers.session_id
        AND s.owner_id = (select auth.uid())
    )
  );

-- 3. Indexes on foreign keys
CREATE INDEX IF NOT EXISTS players_linked_user_id_idx ON public.players (linked_user_id);
CREATE INDEX IF NOT EXISTS session_players_player_id_idx ON public.session_players (player_id);
CREATE INDEX IF NOT EXISTS session_players_session_id_idx ON public.session_players (session_id);
CREATE INDEX IF NOT EXISTS sessions_owner_id_idx ON public.sessions (owner_id);
CREATE INDEX IF NOT EXISTS transfers_session_id_idx ON public.transfers (session_id);

-- 4. Revoke anon EXECUTE on SECURITY DEFINER functions that need a logged-in user
REVOKE EXECUTE ON FUNCTION public.accept_friend_invite(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reject_friend_invite(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancel_friend_invite(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.complete_friend_player_link(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.remove_friend_player_link(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.save_session_atomic(uuid, uuid, timestamptz, bigint, jsonb, jsonb, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_session_atomic(uuid, uuid, timestamptz, bigint, jsonb, jsonb, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_session_atomic(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_self_player() FROM anon;
REVOKE EXECUTE ON FUNCTION public.backfill_participations_for_player(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.find_profile_by_phone(text) FROM anon;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_profile_email_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_create_participation() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;
