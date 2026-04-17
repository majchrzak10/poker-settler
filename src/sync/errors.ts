export function isRpcMissingError(err: { code?: string; message?: string; details?: string } | null | undefined) {
  const m = (err?.message || '') + (err?.details || '');
  return (
    err?.code === 'PGRST202' ||
    err?.code === '42883' ||
    /save_session_atomic|update_session_atomic|function.*does not exist/i.test(m)
  );
}

export function isFriendLinkRpcMissing(err: { code?: string; message?: string; details?: string } | null | undefined) {
  const m = (err?.message || '') + (err?.details || '');
  return (
    err?.code === 'PGRST202' ||
    err?.code === '42883' ||
    /complete_friend_player_link|remove_friend_player_link|function.*does not exist/i.test(m)
  );
}

export function isMissingLiveSessionTableError(err: { code?: string; message?: string; details?: string; hint?: string } | null | undefined) {
  if (!err) return false;
  const m = `${err.message || ''} ${err.details || ''} ${err.hint || ''}`;
  if (err.code === 'PGRST205') return /live_session|public\.live|schema cache/i.test(m);
  return (
    /live_session_state|public\.live_session|Could not find the table|schema cache|does not exist/i.test(m) &&
    /live_session|public\.live/i.test(m)
  );
}

export function sanitizeSyncMeta(meta: { lastError?: string | null } | null | undefined) {
  if (!meta?.lastError) return meta;
  const e = meta.lastError;
  if (/PGRST205|schema cache|Could not find the table/i.test(e) && /live_session|public\.live\b/i.test(e)) {
    return { ...meta, lastError: null };
  }
  return meta;
}

export function summarizeSyncError(errMsg: string | null | undefined) {
  const msg = (errMsg || '').toLowerCase();
  if (!msg) return 'Błąd synchronizacji.';
  if (msg.includes('network') || msg.includes('failed to fetch')) return 'Brak połączenia z internetem. Sprawdź sieć i spróbuj ponownie.';
  if (msg.includes('jwt') || msg.includes('auth') || msg.includes('token')) return 'Sesja wygasła lub jest nieprawidłowa. Zaloguj się ponownie.';
  if (msg.includes('permission') || msg.includes('rls') || msg.includes('policy')) return 'Brak uprawnień do tej operacji.';
  if (msg.includes('timeout')) return 'Serwer odpowiada zbyt długo. Spróbuj ponownie za chwilę.';
  if (msg.includes('session_players_player_id_fkey') || (msg.includes('session_players') && msg.includes('foreign key'))) {
    return 'Sesja zawiera gracza, który nie istnieje już w chmurze. Wybierz graczy ponownie z aktualnej listy.';
  }
  if (msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('pgrst')) {
    return 'Brakuje migracji w bazie danych. Uruchom najnowsze skrypty SQL.';
  }
  return 'Wystąpił problem z synchronizacją danych.';
}

export function formatSyncStamp(isoString: string | null | undefined) {
  if (!isoString) return 'brak';
  const dt = new Date(isoString);
  if (Number.isNaN(dt.getTime())) return 'brak';
  return dt.toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function isSessionPlayerFkError(err: { message?: string; details?: string } | null | undefined) {
  const msg = `${err?.message || ''} ${err?.details || ''}`.toLowerCase();
  return msg.includes('session_players_player_id_fkey') || (msg.includes('session_players') && msg.includes('foreign key'));
}
