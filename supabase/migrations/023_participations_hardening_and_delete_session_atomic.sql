-- 023: Harden participations INSERT policy and add atomic session delete RPC.
--
-- Why:
-- - `insert_any` allowed any authenticated user to insert arbitrary participations.
-- - Session delete in client was multi-step and non-atomic.
--
-- Scope:
-- 1) Replace permissive INSERT policy on participations.
-- 2) Add `delete_session_atomic` RPC for transactional delete by session owner.

ALTER TABLE public.participations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insert_any" ON public.participations;
DROP POLICY IF EXISTS "insert_owner_or_self" ON public.participations;
CREATE POLICY "insert_owner_or_self"
  ON public.participations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.sessions s
      WHERE s.id = participations.session_id
        AND s.owner_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.delete_session_atomic(
  p_session_id uuid,
  p_owner_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_owner_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.sessions s
    WHERE s.id = p_session_id
      AND s.owner_id = p_owner_id
  ) THEN
    RAISE EXCEPTION 'session not found';
  END IF;

  DELETE FROM public.transfers WHERE session_id = p_session_id;
  DELETE FROM public.session_players WHERE session_id = p_session_id;
  DELETE FROM public.participations WHERE session_id = p_session_id;
  DELETE FROM public.sessions WHERE id = p_session_id AND owner_id = p_owner_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_session_atomic(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_session_atomic(uuid, uuid) TO authenticated;
