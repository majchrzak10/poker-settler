-- 026: Drop unused RPCs that posed security risk.
--
-- complete_friend_player_link (009): allowed forced friend-linking without
--   the friend's consent. Replaced entirely by friend_invites flow (010).
-- find_profile_by_phone (006): permitted phone enumeration of all users
--   (returned email + display_name). Not referenced by client code.
--
-- Grep across src/ confirms neither is called from the client (only
-- type-bindings in database.types.ts and an error-string check in
-- sync/errors.ts that gracefully handles "function does not exist").

DROP FUNCTION IF EXISTS public.complete_friend_player_link(uuid, uuid);
DROP FUNCTION IF EXISTS public.find_profile_by_phone(text);
