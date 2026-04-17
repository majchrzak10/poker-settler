-- 019: Jeden numer (9 cyfr PL) nie może się powtarzać wśród graczy tego samego właściciela.
-- Porównanie po odszumieniu (tylko cyfry), tak jak w kliencie (formatPhone).

-- Jeśli indeks się nie utworzy z powodu istniejących duplikatów, znajdź je:
--   SELECT owner_id,
--          regexp_replace(COALESCE(phone, ''), '\D', '', 'g') AS digits,
--          count(*) AS n,
--          array_agg(id) AS player_ids
--   FROM public.players
--   WHERE length(regexp_replace(COALESCE(phone, ''), '\D', '', 'g')) >= 9
--   GROUP BY owner_id, regexp_replace(COALESCE(phone, ''), '\D', '', 'g')
--   HAVING count(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS players_owner_phone_digits_unique
  ON public.players (
    owner_id,
    (regexp_replace(COALESCE(phone, ''), '\D', '', 'g'))
  )
  WHERE length(regexp_replace(COALESCE(phone, ''), '\D', '', 'g')) >= 9;
