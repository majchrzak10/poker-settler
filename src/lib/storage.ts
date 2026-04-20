import { useEffect } from 'react';

export function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function loadLS<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
}

export function saveLS(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export const ACTIVE_USER_ID_KEY = 'poker_active_user_id';

const USER_DATA_KEYS = [
  'poker_players',
  'poker_session',
  'poker_default_buyin',
  'poker_auto_add_me',
  'poker_sessions_history',
  'poker_failed_cloud_saves',
  'poker_sync_meta',
  'poker_client_log_session',
  'poker_seen_shared',
  'poker_seen_invites',
];

/** Na wylogowaniu / zmianie konta — zdmuchuje dane zalogowanego użytkownika.
 *  Zostawia preferencje typu onboarding. */
export function clearUserScopedLocalStorage() {
  try {
    for (const key of USER_DATA_KEYS) localStorage.removeItem(key);
    localStorage.removeItem(ACTIVE_USER_ID_KEY);
  } catch {
    /* ignore */
  }
}

/** Jeśli zalogowany user jest inny niż zapisany w localStorage — czyści dane,
 *  zapisuje bieżący user id i zwraca `true`. Dzięki temu nie ma wycieku danych
 *  między kontami na jednym urządzeniu. Dla użytkownika niezalogowanego nie
 *  robi nic. Zwraca `true` jeśli było czyszczenie, `false` w każdym innym
 *  przypadku. */
export function ensureActiveUserScope(userId: string | null | undefined): boolean {
  if (!userId) return false;
  try {
    const stored = localStorage.getItem(ACTIVE_USER_ID_KEY);
    if (stored === userId) return false;
    const hadStored = !!stored;
    for (const key of USER_DATA_KEYS) localStorage.removeItem(key);
    localStorage.setItem(ACTIVE_USER_ID_KEY, userId);
    return hadStored;
  } catch {
    return false;
  }
}

export function useDebouncedLocalStorage(key: string, value: unknown, delay = 220) {
  useEffect(() => {
    const timer = setTimeout(() => saveLS(key, value), delay);
    return () => clearTimeout(timer);
  }, [key, value, delay]);
}

export function normalizeDraftSessionPlayers(rows: unknown) {
  const list = Array.isArray(rows) ? rows : [];
  return list.map((sp: Record<string, unknown>) => ({
    playerId: sp.playerId,
    buyIns: Array.isArray(sp.buyIns) ? sp.buyIns.map((n: unknown) => Number(n) || 0) : [],
    cashOut: typeof sp.cashOut === 'string' ? sp.cashOut : String(sp.cashOut ?? ''),
  }));
}

export function buildDraftHash(defaultBuyIn: number, sessionPlayers: unknown[]) {
  return JSON.stringify({
    defaultBuyIn: Number(defaultBuyIn) || 0,
    sessionPlayers: normalizeDraftSessionPlayers(sessionPlayers),
  });
}

export function isoToMs(iso: string | null | undefined) {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}
