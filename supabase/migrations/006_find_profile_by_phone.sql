-- Migration 006: SECURITY DEFINER RPC for phone-based friend lookup
-- Uses a server-side function instead of direct table scan to avoid
-- exposing the full profiles.phone column to client-side queries.

CREATE OR REPLACE FUNCTION public.find_profile_by_phone(p_phone TEXT)
RETURNS TABLE(id UUID, display_name TEXT, email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT pr.id, pr.display_name, pr.email
    FROM public.profiles pr
    WHERE pr.phone = p_phone
    LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.find_profile_by_phone(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_profile_by_phone(TEXT) TO authenticated;
