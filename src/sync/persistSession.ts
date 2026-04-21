import { pluralPL } from '../lib/settlement';
import { supabase } from '../lib/supabase';
import { buildSessionRpcArgs } from './sessionRpc';
import { isRpcMissingError } from './errors';

type Row = Record<string, unknown>;

interface AppError extends Error {
  code: string;
}

async function insertRows(table: string, rows: Row[]) {
  if (!rows || rows.length === 0) return;
  // Dynamiczna nazwa tabeli — Supabase-js zna tylko statyczne nazwy, rzutujemy.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from(table).insert(rows);
  if (error && (error as { code?: string }).code !== '23505') throw error;
}

function createMissingSessionPlayersError(message?: string): AppError {
  const err = new Error(
    message || 'Nie znaleziono części graczy użytych w sesji.'
  ) as AppError;
  err.code = 'MISSING_SESSION_PLAYERS';
  return err;
}

/**
 * Gdy `player_id` w wierszach nie istnieje już w `players`, próbuje dopasować po nazwie (jednoznacznie).
 */
export async function repairSessionPlayersRows(
  ownerId: string,
  sessionPlayersRows: Row[] = [],
  setCloudBanner?: (msg: string) => void
): Promise<Row[]> {
  if (!ownerId || !sessionPlayersRows.length) return sessionPlayersRows;
  const ids = [...new Set(sessionPlayersRows.map(r => r.player_id).filter(Boolean))] as string[];
  if (!ids.length) return sessionPlayersRows;
  const { data: existingRows, error: existingErr } = await supabase
    .from('players')
    .select('id')
    .eq('owner_id', ownerId)
    .in('id', ids);
  if (existingErr) throw existingErr;
  const existing = new Set((existingRows || []).map(r => r.id));
  const missing = sessionPlayersRows.filter(r => !existing.has(r.player_id as string));
  if (missing.length === 0) return sessionPlayersRows;

  const { data: allPlayers, error: allErr } = await supabase
    .from('players')
    .select('id,name')
    .eq('owner_id', ownerId);
  if (allErr) throw allErr;
  const byName = new Map<string, string[]>();
  for (const p of allPlayers || []) {
    const key = (p.name || '').trim().toLowerCase();
    if (!key) continue;
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(p.id);
  }
  const patched = sessionPlayersRows.map(r => ({ ...r }));
  const usedIds = new Set(
    patched.filter(r => existing.has(r.player_id as string)).map(r => r.player_id as string)
  );
  let repaired = 0;
  for (const row of patched) {
    if (existing.has(row.player_id as string)) continue;
    const key = ((row.player_name as string) || '').trim().toLowerCase();
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
    setCloudBanner(
      `Naprawiono ${repaired} ${pluralPL(repaired, 'powiązanie gracza', 'powiązania graczy', 'powiązań graczy')} przed zapisem do chmury.`
    );
  }
  return patched;
}

async function persistSessionInsertsSequential(
  sessionRow: Row,
  sessionPlayersRows: Row[],
  transferRows: Row[],
  participationRows: Row[]
) {
  const { error: sessionErr } = await supabase.from('sessions').insert(sessionRow as never);
  if (sessionErr) throw sessionErr;
  await insertRows('session_players', sessionPlayersRows);
  await insertRows('transfers', transferRows);
  await insertRows('participations', participationRows);
}

export async function persistSessionSaveCloud(
  sessionRow: Row,
  sessionPlayersRows: Row[],
  transferRows: Row[],
  participationRows: Row[],
  setCloudBanner?: (msg: string) => void
): Promise<Row[]> {
  const ownerId = sessionRow?.owner_id as string;
  const repairedSessionPlayersRows = await repairSessionPlayersRows(
    ownerId,
    sessionPlayersRows,
    setCloudBanner
  );
  const args = buildSessionRpcArgs(sessionRow, repairedSessionPlayersRows, transferRows, participationRows);
  const { error } = await supabase.rpc('save_session_atomic', args);
  if (!error) return repairedSessionPlayersRows;
  if (!isRpcMissingError(error)) throw error;
  await persistSessionInsertsSequential(sessionRow, repairedSessionPlayersRows, transferRows, participationRows);
  return repairedSessionPlayersRows;
}

export async function persistSessionUpdateCloud(
  sessionRow: Row,
  sessionPlayersRows: Row[],
  transferRows: Row[],
  participationRows: Row[],
  setCloudBanner?: (msg: string) => void
): Promise<void> {
  const ownerId = sessionRow?.owner_id as string;
  const repairedSessionPlayersRows = await repairSessionPlayersRows(
    ownerId,
    sessionPlayersRows,
    setCloudBanner
  );
  const args = buildSessionRpcArgs(sessionRow, repairedSessionPlayersRows, transferRows, participationRows);
  const { error } = await supabase.rpc('update_session_atomic', args);
  if (!error) return;
  if (!isRpcMissingError(error)) throw error;
  const { error: uErr } = await supabase
    .from('sessions')
    .update({ played_at: sessionRow.played_at as string, total_pot: sessionRow.total_pot as number })
    .eq('id', sessionRow.id as string)
    .eq('owner_id', sessionRow.owner_id as string);
  if (uErr) throw uErr;
  const { error: d1 } = await supabase.from('session_players').delete().eq('session_id', sessionRow.id as string);
  if (d1) throw d1;
  const { error: d2 } = await supabase.from('transfers').delete().eq('session_id', sessionRow.id as string);
  if (d2) throw d2;
  const { error: d3 } = await supabase.from('participations').delete().eq('session_id', sessionRow.id as string);
  if (d3) throw d3;
  await insertRows('session_players', repairedSessionPlayersRows);
  await insertRows('transfers', transferRows);
  await insertRows('participations', participationRows);
}

export async function persistSessionDeleteCloud(
  sessionId: string,
  ownerId: string
): Promise<void> {
  const { error } = await supabase.rpc('delete_session_atomic', {
    p_session_id: sessionId,
    p_owner_id: ownerId,
  } as never);
  if (!error) return;
  if (!isRpcMissingError(error)) throw error;

  const { error: e1 } = await supabase.from('transfers').delete().eq('session_id', sessionId);
  if (e1) throw e1;
  const { error: e2 } = await supabase.from('session_players').delete().eq('session_id', sessionId);
  if (e2) throw e2;
  const { error: e3 } = await supabase.from('participations').delete().eq('session_id', sessionId);
  if (e3) throw e3;
  const { error: e4 } = await supabase
    .from('sessions')
    .delete()
    .eq('id', sessionId)
    .eq('owner_id', ownerId);
  if (e4) throw e4;
}
