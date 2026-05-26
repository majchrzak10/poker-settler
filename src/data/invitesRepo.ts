/**
 * Data layer for friend invites.
 *
 * Keeps Supabase access for invites in one place so feature components and
 * hooks don't reach for `supabase.from(...)` directly. Pure functions —
 * no state, no React.
 */
import { supabase } from '../lib/supabase';

const normalizeEmail = (value: string | null | undefined) =>
  (value || '').trim().toLowerCase();

/** Look up a profile id by exact email. Returns null when no account exists. */
export async function findProfileIdByEmail(emailNorm: string): Promise<string | null> {
  if (!emailNorm) return null;
  const { data, error } = await supabase.rpc('find_profile_id_by_email', {
    p_email: emailNorm,
  });
  if (error) throw error;
  return (data as string | null) || null;
}

/**
 * Create a friend invite for `emailNorm` from `playerId` owned by `userId`.
 * No-op when the email matches the caller's own email or no account exists.
 * Silently accepts 23505 (unique-violation) — invite already pending.
 * Returns `true` when an invite was successfully created or already existed.
 */
export async function createInviteIfPossible(
  userId: string,
  callerEmail: string | null | undefined,
  playerId: string,
  emailNorm: string,
): Promise<boolean> {
  if (!emailNorm || emailNorm === normalizeEmail(callerEmail)) return false;
  const profileId = await findProfileIdByEmail(emailNorm);
  if (!profileId) return false;
  const { error: inviteErr } = await supabase.from('friend_invites').insert({
    requester_user_id: userId,
    requester_player_id: playerId,
    invitee_email: emailNorm,
  });
  if (inviteErr && inviteErr.code !== '23505') throw inviteErr;
  return true;
}

/** Cancel an outgoing pending invite. */
export async function cancelInvite(inviteId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_friend_invite', { p_invite_id: inviteId });
  if (error) throw error;
}

/** Accept an incoming pending invite. */
export async function acceptInvite(inviteId: string): Promise<void> {
  const { error } = await supabase.rpc('accept_friend_invite', { p_invite_id: inviteId });
  if (error) throw error;
}

/** Reject an incoming pending invite. */
export async function rejectInvite(inviteId: string): Promise<void> {
  const { error } = await supabase.rpc('reject_friend_invite', { p_invite_id: inviteId });
  if (error) throw error;
}
