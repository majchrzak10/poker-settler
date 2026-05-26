export const FAILED_CLOUD_SAVES_KEY = 'poker_failed_cloud_saves';
export const SYNC_META_KEY = 'poker_sync_meta';
export const ONBOARDING_KEY = 'poker_onboarding_dismissed';
export const CLIENT_LOG_SESSION_KEY = 'poker_client_log_session';

/**
 * Clear every app-managed localStorage entry on sign-out. Anything keyed
 * `poker_*` is owned by this app, including per-user keys (`poker_live_push_<uid>`).
 * This survives schema changes — no need to keep a hardcoded list in App.tsx.
 */
export function clearAllPokerKeys(): void {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('poker_')) toRemove.push(key);
    }
    for (const key of toRemove) localStorage.removeItem(key);
  } catch (err) {
    console.warn('[poker] clearAllPokerKeys failed', err);
  }
}
