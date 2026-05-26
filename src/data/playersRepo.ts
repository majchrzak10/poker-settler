/**
 * Data layer for the `players` table.
 *
 * Throws on Supabase errors; callers translate into UI banners.
 * The 23505 unique-violation code is preserved so callers can surface
 * the "duplicate phone" message specifically.
 */
import { supabase } from '../lib/supabase';

export interface NewPlayerInput {
  id: string;
  owner_id: string;
  name: string;
  phone: string;
  email: string;
}

export interface PlayerPatch {
  name: string;
  phone: string;
  email: string;
}

export async function insertPlayer(input: NewPlayerInput): Promise<void> {
  const { error } = await supabase.from('players').insert({
    id: input.id,
    owner_id: input.owner_id,
    name: input.name,
    phone: input.phone || null,
    email: input.email || null,
  });
  if (error) throw error;
}

export async function updatePlayerRow(id: string, patch: PlayerPatch): Promise<void> {
  const { error } = await supabase.from('players').update({
    name: patch.name,
    phone: patch.phone || null,
    email: patch.email || null,
  }).eq('id', id);
  if (error) throw error;
}

export async function deletePlayer(id: string): Promise<void> {
  const { error } = await supabase.from('players').delete().eq('id', id);
  if (error) throw error;
}

export async function removeFriendPlayerLink(playerId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_friend_player_link', {
    p_player_id: playerId,
  });
  if (error) throw error;
}
