-- Migration 005: Add phone to profiles + fix UNIQUE constraint for friend linking

-- Add phone number to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- Fix the crash in linkPlayer: upsert was using onConflict: 'owner_id,linked_user_id'
-- but no such unique constraint existed in the DB, causing a crash on every friend link attempt.
ALTER TABLE public.players
  ADD CONSTRAINT players_owner_linked_unique
  UNIQUE (owner_id, linked_user_id);

-- Indexes for fast friend search by email or phone
CREATE INDEX IF NOT EXISTS profiles_phone_idx ON public.profiles (phone);
CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles (email);

-- Updated handle_new_user trigger: also stores phone from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, phone)
  VALUES (
    NEW.id,
    LOWER(TRIM(COALESCE(NEW.email, ''))),
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'display_name'), ''),
      NULLIF(SPLIT_PART(COALESCE(NEW.email, ''), '@', 1), ''),
      'Gracz'
    ),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'phone', '')), '')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(NULLIF(EXCLUDED.email, ''), public.profiles.email),
    phone = COALESCE(public.profiles.phone, EXCLUDED.phone);
  RETURN NEW;
END;
$$;

-- NOTE: If the ADD CONSTRAINT fails due to duplicate (owner_id, linked_user_id) pairs
-- (caused by previous crashes of the buggy upsert), first run:
--   DELETE FROM players
--   WHERE id NOT IN (
--     SELECT MIN(id) FROM players
--     GROUP BY owner_id, linked_user_id
--   );
-- Then re-run this migration.
