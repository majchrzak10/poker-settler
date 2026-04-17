-- 015_backfill_user_player.sql
-- Naprawa dwóch problemów wykrytych przez scripts/diagnose.mjs (2026-04-17):
--
--   1. Istnieją userzy bez wiersza w public.profiles
--      (3 userów, 2 profile — 1 "duch" z perspektywy apki).
--      Trigger on_auth_user_created tworzy profile dla NOWYCH userów,
--      ale nie było pełnego backfillu dla userów sprzed jego wdrożenia.
--
--   2. Obecny trigger handle_new_user tworzy tylko profile, a UI zakłada,
--      że self-player też istnieje (players z owner_id = linked_user_id = user.id).
--      Zgodnie z decyzją "user = player" (PLAN.md §2.4), trigger tworzy
--      teraz oba wiersze atomowo przy rejestracji.
--
-- Migracja jest idempotentna — można bez obaw wykonać wielokrotnie.

-- Krok 1: backfill profili dla istniejących userów bez profilu.
INSERT INTO public.profiles (id, email, display_name)
SELECT
  u.id,
  LOWER(TRIM(COALESCE(u.email, ''))),
  COALESCE(
    NULLIF(TRIM(u.raw_user_meta_data->>'display_name'), ''),
    NULLIF(SPLIT_PART(COALESCE(u.email, ''), '@', 1), ''),
    'Gracz'
  )
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;

-- Krok 2: backfill self-playera dla każdego usera, który go jeszcze nie ma.
INSERT INTO public.players (id, owner_id, linked_user_id, name, email, phone)
SELECT
  gen_random_uuid(),
  u.id,
  u.id,
  COALESCE(
    NULLIF(TRIM(pr.display_name), ''),
    NULLIF(SPLIT_PART(LOWER(TRIM(COALESCE(pr.email, u.email, ''))), '@', 1), ''),
    'Ja'
  ),
  NULLIF(LOWER(TRIM(COALESCE(pr.email, u.email, ''))), ''),
  NULLIF(TRIM(COALESCE(pr.phone, '')), '')
FROM auth.users u
LEFT JOIN public.profiles pr ON pr.id = u.id
WHERE NOT EXISTS (
  SELECT 1 FROM public.players pl
  WHERE pl.owner_id = u.id AND pl.linked_user_id = u.id
);

-- Krok 3: rozszerzony handle_new_user — od razu tworzy profil + self-player.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_name  TEXT;
BEGIN
  v_email := LOWER(TRIM(COALESCE(NEW.email, '')));
  v_name  := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'display_name'), ''),
    NULLIF(SPLIT_PART(COALESCE(NEW.email, ''), '@', 1), ''),
    'Gracz'
  );

  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, v_email, v_name)
  ON CONFLICT (id) DO UPDATE SET
    email        = COALESCE(NULLIF(EXCLUDED.email, ''), public.profiles.email),
    display_name = COALESCE(NULLIF(public.profiles.display_name, ''), EXCLUDED.display_name);

  -- user = player (decyzja z 2026-04-17): każdy zarejestrowany user
  -- automatycznie dostaje rekord gracza (owner_id = linked_user_id = user.id).
  INSERT INTO public.players (id, owner_id, linked_user_id, name, email)
  VALUES (
    gen_random_uuid(),
    NEW.id,
    NEW.id,
    COALESCE(NULLIF(v_name, ''), 'Ja'),
    NULLIF(v_email, '')
  )
  ON CONFLICT (owner_id, linked_user_id) DO NOTHING;

  RETURN NEW;
END;
$$;
