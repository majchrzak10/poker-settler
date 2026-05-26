/**
 * Data layer for the `profiles` table.
 * Updates the current user's row; insert via upsert when update fails (no row yet).
 */
import { supabase } from '../lib/supabase';

export interface ProfilePatch {
  display_name: string;
  phone: string | null;
  email: string;
}

/**
 * Update the current user's profile. Falls back to upsert when the row
 * doesn't exist yet (e.g. fresh sign-in before the trigger fired).
 */
export async function updateOrUpsertProfile(userId: string, patch: ProfilePatch): Promise<void> {
  const { error: updateErr } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId);
  if (!updateErr) return;
  const { error: upsertErr } = await supabase.from('profiles').upsert({ id: userId, ...patch });
  if (upsertErr) throw upsertErr;
}
