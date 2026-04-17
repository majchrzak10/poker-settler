import { pluralPL } from '../lib/settlement';
import { supabase } from '../lib/supabase';
import { buildSessionRpcArgs } from './sessionRpc';
import { isRpcMissingError } from './errors';

async function insertRows(table, rows) {
  if (!rows || rows.length === 0) return;
  const { error } = await supabase.from(table).insert(rows);
  if (error && error.code !== '23505') throw error;
}

function createMissingSessionPlayersError(message) {
  const err = new Error(message || 'Nie znaleziono części graczy użytych w sesji.');
  err.code = 'MISSING_SESSION_PLAYERS';
  return err;
}

/**
 * Gdy `player_id` w wierszach nie istnieje już w `players`, próbuje dopasować po nazwie (jednoznacznie).
 */
export async function repairSessionPlayersRows(ownerId, sessionPlayersRows = [], setCloudBanner) {
  if (!ownerId || !sessionPlayersRows.length) return sessionPlayersRows;
  const ids = [...new Set(sessionPlayersRows.map(r => r.player_id).filter(Boolean))];
  if (!ids.length) return sessionPlayersRows;
  const { data: existingRows, error: existingErr } = await supabase
    .from('players')
    .select('id')
    .eq('owner_id', ownerId)
    .in('id', ids);
  if (existingErr) throw existingErr;
  const existing = new Set((existingRows || []).map(r => r.id));
  const missing = sessionPlayersRows.filter(r => !existing.has(r.player_id));
  if (missing.length === 0) return sessionPlayersRows;

  const { data: allPlayers, error: allErr } = await supabase
    .from('players')
    .select('id,name')
    .eq('owner_id', ownerId);
  if (allErr) throw allErr;
  const byName = new Map();
  for (const p of (allPlayers || [])) {
    const key = (p.name || '').trim().toLowerCase();
    if (!key) continue;
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(p.id);
  }
  const patched = sessionPlayersRows.map(r => ({ ...r }));
  const usedIds = new Set(patched.filter(r => existing.has(r.player_id)).map(r => r.player_id));
  let repaired = 0;
  for (const row of patched) {
    if (existing.has(row.player_id)) continue;
    const key = (row.player_name || '').trim().toLowerCase();
    const candidates = (byName.get(key) || []).filter(id => !usedIds.has(id));
    if (candidates.length !== 1) {
      throw createMissingSessionPlayersError(
        'Nie znaleziono części graczy użytych w tej sesji. Otwórz sesję ponownie i wybierz graczy z aktualnej listy.'
      );
    }
    row.player_id = candidates[0];
    usedIds.add(candidates[0]);
    repaired++;
  }
  if (repaired > 0 && typeof setCloudBanner === 'function') {
    setCloudBanner(`Naprawiono ${repaired} ${pluralPL(repaired, 'powiązanie gracza', 'powiązania graczy', 'powiązań graczy')} przed zapisem do chmury.`);
  }
  return patched;
}

async function persistSessionInsertsSequential(sessionRow, sessionPlayersRows, transferRows, participationRows) {
  const { error: sessionErr } = await supabase.from('sessions').insert(sessionRow);
  if (sessionErr) throw sessionErr;
  await insertRows('session_players', sessionPlayersRows);
  await insertRows('transfers', transferRows);
  await insertRows('participations', participationRows);
}

export async function persistSessionSaveCloud(sessionRow, sessionPlayersRows, transferRows, participationRows, setCloudBanner) {
  const ownerId = sessionRow?.owner_id;
  const repairedSessionPlayersRows = await repairSessionPlayersRows(ownerId, sessionPlayersRows, setCloudBanner);
  const args = buildSessionRpcArgs(sessionRow, repairedSessionPlayersRows, transferRows, participationRows);
  const { error } = await supabase.rpc('save_session_atomic', args);
  if (!error) return repairedSessionPlayersRows;
  if (!isRpcMissingError(error)) throw error;
  await persistSessionInsertsSequential(sessionRow, repairedSessionPlayersRows, transferRows, participationRows);
  return repairedSessionPlayersRows;
}

export async function persistSessionUpdateCloud(sessionRow, sessionPlayersRows, transferRows, participationRows, setCloudBanner) {
  const ownerId = sessionRow?.owner_id;
  const repairedSessionPlayersRows = await repairSessionPlayersRows(ownerId, sessionPlayersRows, setCloudBanner);
  const args = buildSessionRpcArgs(sessionRow, repairedSessionPlayersRows, transferRows, participationRows);
  const { error } = await supabase.rpc('update_session_atomic', args);
  if (!error) return;
  if (!isRpcMissingError(error)) throw error;
  const { error: uErr } = await supabase.from('sessions').update({ played_at: sessionRow.played_at, total_pot: sessionRow.total_pot }).eq('id', sessionRow.id).eq('owner_id', sessionRow.owner_id);
  if (uErr) throw uErr;
  const { error: d1 } = await supabase.from('session_players').delete().eq('session_id', sessionRow.id);
  if (d1) throw d1;
  const { error: d2 } = await supabase.from('transfers').delete().eq('session_id', sessionRow.id);
  if (d2) throw d2;
  const { error: d3 } = await supabase.from('participations').delete().eq('session_id', sessionRow.id);
  if (d3) throw d3;
  await insertRows('session_players', repairedSessionPlayersRows);
  await insertRows('transfers', transferRows);
  await insertRows('participations', participationRows);
}
