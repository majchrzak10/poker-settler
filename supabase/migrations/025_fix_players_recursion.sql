-- 025: fix infinite recursion w policy players_insert_reciprocal_friend
-- Problem: po 024 (rewrite z auth.uid() → (select auth.uid())), policy z EXISTS
-- na tej samej tabeli players triggerowała pętlę RLS — Postgres rzucał
-- "infinite recursion detected in policy for relation players" przy każdym INSERT.
--
-- Rozwiązanie: wynieść EXISTS-check do SECURITY DEFINER function. Taka funkcja
-- bypassuje RLS, więc wewnętrzny SELECT z players nie triggeruje SELECT policies.
-- Wzorzec rekomendowany przez Supabase dla self-referencing RLS.

CREATE OR REPLACE FUNCTION public.has_reciprocal_link_to(p_target_owner uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.players
    WHERE owner_id = auth.uid()
      AND linked_user_id = p_target_owner
  )
$$;

REVOKE EXECUTE ON FUNCTION public.has_reciprocal_link_to(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_reciprocal_link_to(uuid) TO authenticated;

DROP POLICY IF EXISTS players_insert_reciprocal_friend ON public.players;
CREATE POLICY players_insert_reciprocal_friend ON public.players
  FOR INSERT TO authenticated
  WITH CHECK (
    linked_user_id = (select auth.uid())
    AND public.has_reciprocal_link_to(owner_id)
  );
