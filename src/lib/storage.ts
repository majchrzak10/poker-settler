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

export function useDebouncedLocalStorage(key: string, value: unknown, delay = 220) {
  useEffect(() => {
    const timer = setTimeout(() => saveLS(key, value), delay);
    return () => clearTimeout(timer);
  }, [key, value, delay]);
}

export function normalizeDraftSessionPlayers(rows: unknown) {
  const list = Array.isArray(rows) ? rows : [];
  return list
    .map((sp: Record<string, unknown>) => {
      const playerId = typeof sp.playerId === 'string' ? sp.playerId.trim() : '';
      if (!playerId) return null;
      const buyIns = Array.isArray(sp.buyIns)
        ? sp.buyIns
            .map((n: unknown) => {
              const num = Number(n);
              return Number.isFinite(num) && num > 0 ? num : 0;
            })
            .filter(n => n > 0)
        : [];
      const rawCashOut = !sp.cashOut ? '0' : String(sp.cashOut);
      const cashNum = Number(rawCashOut);
      const cashOut = Number.isFinite(cashNum) && cashNum >= 0 ? rawCashOut : '0';
      return { playerId, buyIns, cashOut };
    })
    .filter((sp): sp is { playerId: string; buyIns: number[]; cashOut: string } => sp !== null);
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
