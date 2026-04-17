-- 017: Usuwanie gracza nie blokuje się na FK z historii sesji.
-- session_players ma snapshot player_name — po usunięciu gracza player_id może być NULL.

ALTER TABLE public.session_players
  ALTER COLUMN player_id DROP NOT NULL;

DO $$
DECLARE
  cname text;
BEGIN
  SELECT tc.constraint_name INTO cname
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_schema = kcu.constraint_schema
   AND tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'session_players'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'player_id'
  LIMIT 1;

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.session_players DROP CONSTRAINT %I', cname);
  END IF;
END;
$$;

ALTER TABLE public.session_players
  ADD CONSTRAINT session_players_player_id_fkey
  FOREIGN KEY (player_id)
  REFERENCES public.players(id)
  ON DELETE SET NULL;
