-- 021: Naprawa konfliktu między triggerem z 020 a RPC z 001
--
-- Problem: 020 dodał trigger `auto_create_participation` na session_players, który
-- automatycznie wstawia participations dla graczy z linked_user_id. Ale RPC
-- save_session_atomic / update_session_atomic z migracji 001 najpierw wstawia
-- session_players (trigger strzela → wiersz w participations już jest), a potem
-- próbuje wstawić tę samą participation → UNIQUE INDEX participations_user_session_unique
-- rzuca błąd i całe RPC (transakcja) rolluje się back.
--
-- Naprawa: w obu RPC używamy ON CONFLICT (user_id, session_id) DO UPDATE,
-- dzięki czemu kolejność nie ma znaczenia — kto pierwszy wstawi, ten rządzi;
-- drugi dopisze/nadpisze.

CREATE OR REPLACE FUNCTION public.save_session_atomic(
  p_session_id uuid,
  p_owner_id uuid,
  p_played_at timestamptz,
  p_total_pot bigint,
  p_session_players jsonb,
  p_transfers jsonb,
  p_participations jsonb
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

  IF EXISTS (SELECT 1 FROM public.sessions WHERE id = p_session_id) THEN
    RETURN;
  END IF;

  INSERT INTO public.sessions (id, owner_id, played_at, total_pot)
  VALUES (p_session_id, p_owner_id, p_played_at, p_total_pot);

  INSERT INTO public.session_players (session_id, player_id, player_name, total_buy_in, cash_out)
  SELECT p_session_id,
         (elem->>'player_id')::uuid,
         COALESCE(elem->>'player_name', '?'),
         COALESCE((elem->>'total_buy_in')::bigint, 0),
         COALESCE((elem->>'cash_out')::bigint, 0)
  FROM jsonb_array_elements(COALESCE(p_session_players, '[]'::jsonb)) AS elem;

  INSERT INTO public.transfers (session_id, from_name, to_name, amount)
  SELECT p_session_id,
         elem->>'from_name',
         elem->>'to_name',
         COALESCE((elem->>'amount')::bigint, 0)
  FROM jsonb_array_elements(COALESCE(p_transfers, '[]'::jsonb)) AS elem;

  INSERT INTO public.participations (user_id, session_id, player_name, total_buy_in, cash_out, session_date, total_pot)
  SELECT (elem->>'user_id')::uuid,
         p_session_id,
         COALESCE(elem->>'player_name', '?'),
         COALESCE((elem->>'total_buy_in')::bigint, 0),
         COALESCE((elem->>'cash_out')::bigint, 0),
         (elem->>'session_date')::timestamptz,
         COALESCE((elem->>'total_pot')::bigint, 0)
  FROM jsonb_array_elements(COALESCE(p_participations, '[]'::jsonb)) AS elem
  ON CONFLICT (user_id, session_id) DO UPDATE SET
    player_name = EXCLUDED.player_name,
    total_buy_in = EXCLUDED.total_buy_in,
    cash_out = EXCLUDED.cash_out,
    session_date = EXCLUDED.session_date,
    total_pot = EXCLUDED.total_pot;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_session_atomic(
  p_session_id uuid,
  p_owner_id uuid,
  p_played_at timestamptz,
  p_total_pot bigint,
  p_session_players jsonb,
  p_transfers jsonb,
  p_participations jsonb
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

  IF NOT EXISTS (SELECT 1 FROM public.sessions WHERE id = p_session_id AND owner_id = p_owner_id) THEN
    RAISE EXCEPTION 'session not found';
  END IF;

  UPDATE public.sessions
  SET played_at = p_played_at, total_pot = p_total_pot
  WHERE id = p_session_id;

  DELETE FROM public.session_players WHERE session_id = p_session_id;
  DELETE FROM public.transfers WHERE session_id = p_session_id;
  DELETE FROM public.participations WHERE session_id = p_session_id;

  INSERT INTO public.session_players (session_id, player_id, player_name, total_buy_in, cash_out)
  SELECT p_session_id,
         (elem->>'player_id')::uuid,
         COALESCE(elem->>'player_name', '?'),
         COALESCE((elem->>'total_buy_in')::bigint, 0),
         COALESCE((elem->>'cash_out')::bigint, 0)
  FROM jsonb_array_elements(COALESCE(p_session_players, '[]'::jsonb)) AS elem;

  INSERT INTO public.transfers (session_id, from_name, to_name, amount)
  SELECT p_session_id,
         elem->>'from_name',
         elem->>'to_name',
         COALESCE((elem->>'amount')::bigint, 0)
  FROM jsonb_array_elements(COALESCE(p_transfers, '[]'::jsonb)) AS elem;

  INSERT INTO public.participations (user_id, session_id, player_name, total_buy_in, cash_out, session_date, total_pot)
  SELECT (elem->>'user_id')::uuid,
         p_session_id,
         COALESCE(elem->>'player_name', '?'),
         COALESCE((elem->>'total_buy_in')::bigint, 0),
         COALESCE((elem->>'cash_out')::bigint, 0),
         (elem->>'session_date')::timestamptz,
         COALESCE((elem->>'total_pot')::bigint, 0)
  FROM jsonb_array_elements(COALESCE(p_participations, '[]'::jsonb)) AS elem
  ON CONFLICT (user_id, session_id) DO UPDATE SET
    player_name = EXCLUDED.player_name,
    total_buy_in = EXCLUDED.total_buy_in,
    cash_out = EXCLUDED.cash_out,
    session_date = EXCLUDED.session_date,
    total_pot = EXCLUDED.total_pot;
END;
$$;

REVOKE ALL ON FUNCTION public.save_session_atomic(uuid, uuid, timestamptz, bigint, jsonb, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_session_atomic(uuid, uuid, timestamptz, bigint, jsonb, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_session_atomic(uuid, uuid, timestamptz, bigint, jsonb, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_session_atomic(uuid, uuid, timestamptz, bigint, jsonb, jsonb, jsonb) TO authenticated;
