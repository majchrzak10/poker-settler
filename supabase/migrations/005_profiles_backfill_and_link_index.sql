-- Backfill missing profiles rows for accounts created before trigger rollout.
-- Also guarantee conflict target used by players reverse-link upsert.

INSERT INTO public.profiles (id, email, display_name)
SELECT
  au.id,
  LOWER(TRIM(COALESCE(au.email, ''))),
  COALESCE(
    NULLIF(TRIM(au.raw_user_meta_data->>'display_name'), ''),
    NULLIF(SPLIT_PART(COALESCE(au.email, ''), '@', 1), ''),
    'Gracz'
  )
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL;

UPDATE public.profiles p
SET email = LOWER(TRIM(au.email))
FROM auth.users au
WHERE p.id = au.id
  AND COALESCE(NULLIF(TRIM(p.email), ''), '') = ''
  AND COALESCE(NULLIF(TRIM(au.email), ''), '') <> '';

CREATE UNIQUE INDEX IF NOT EXISTS players_owner_linked_user_unique_idx
  ON public.players (owner_id, linked_user_id)
  WHERE linked_user_id IS NOT NULL;
