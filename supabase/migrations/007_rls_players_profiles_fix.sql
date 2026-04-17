-- 007: Fix RLS so users can update their own profile (phone, display name, email) and
--      complete symmetric friend links (INSERT into another owner's `players` row).
--
-- Without INSERT/UPDATE on profiles, client upserts fail with RLS violations.
-- Without reciprocal INSERT on players, linkPlayer() fails after updating your row
-- ("new row violates row-level security policy for table players").

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ---------------------------------------------------------------------------
-- players: own rows + reciprocal friend row (owner = friend, linked_user = you)
-- ---------------------------------------------------------------------------
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "players_select_own" ON public.players;
CREATE POLICY "players_select_own" ON public.players
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "players_insert_own" ON public.players;
CREATE POLICY "players_insert_own" ON public.players
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- After you set linked_user_id on YOUR player pointing to a friend, you may INSERT
-- the mirror row on the friend's list (owner_id = friend, linked_user_id = you).
DROP POLICY IF EXISTS "players_insert_reciprocal_friend" ON public.players;
CREATE POLICY "players_insert_reciprocal_friend" ON public.players
  FOR INSERT TO authenticated
  WITH CHECK (
    linked_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.players AS p
      WHERE p.owner_id = auth.uid()
        AND p.linked_user_id = players.owner_id
    )
  );

DROP POLICY IF EXISTS "players_update_own" ON public.players;
CREATE POLICY "players_update_own" ON public.players
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "players_delete_own" ON public.players;
CREATE POLICY "players_delete_own" ON public.players
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- Unlink: remove the row your friend had pointing at you (you are linked_user_id).
DROP POLICY IF EXISTS "players_delete_reciprocal_as_linked" ON public.players;
CREATE POLICY "players_delete_reciprocal_as_linked" ON public.players
  FOR DELETE TO authenticated
  USING (linked_user_id = auth.uid());
