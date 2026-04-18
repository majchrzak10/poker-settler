import { supabase } from '../lib/supabase';
import { CLIENT_LOG_SESSION_KEY } from '../app/keys';

let _cachedLogSessionId: string | null = null;

function getLogSessionId() {
  if (_cachedLogSessionId) return _cachedLogSessionId;
  try {
    let v = sessionStorage.getItem(CLIENT_LOG_SESSION_KEY);
    if (!v) {
      v =
        window.crypto?.randomUUID?.() ||
        Date.now().toString(36) + Math.random().toString(36).slice(2);
      sessionStorage.setItem(CLIENT_LOG_SESSION_KEY, v);
    }
    _cachedLogSessionId = v;
    return v;
  } catch {
    return null;
  }
}

/** Fire-and-forget — nie blokuje UI. */
export async function logClientEvent(
  level: 'error' | 'warn' | 'info',
  event: string,
  context: Record<string, unknown> | string | number | null | undefined
) {
  try {
    const sessionRes = await supabase.auth.getSession();
    const user_id = sessionRes?.data?.session?.user?.id || null;
    if (!user_id) return;
    const device = ((typeof navigator !== 'undefined' && navigator.userAgent) || '').slice(0, 200);
    const safeContext =
      context && typeof context === 'object' && !Array.isArray(context)
        ? (context as Record<string, unknown>)
        : { value: String(context ?? '') };
    const payload = {
      user_id,
      session_id: getLogSessionId(),
      level,
      event: String(event || 'unknown').slice(0, 120),
      context: safeContext as import('../types/database.types').Json,
      device,
      app_version: (window as unknown as { POKER_APP_VERSION?: string }).POKER_APP_VERSION || null,
    };
    const { error } = await supabase.from('client_logs').insert(payload);
    if (error) {
      try {
        console.warn('client_logs insert failed:', error.message);
      } catch {
        /* ignore */
      }
    }
  } catch (e) {
    try {
      console.warn('logClientEvent threw:', (e as Error)?.message || e);
    } catch {
      /* ignore */
    }
  }
}

export function initClientTelemetry() {
  (window as unknown as { logClientEvent?: typeof logClientEvent }).logClientEvent = logClientEvent;

  window.addEventListener('error', ev => {
    try {
      void logClientEvent('error', 'window_error', {
        message: (ev as ErrorEvent)?.error?.message || ev?.message || 'unknown',
        stack: ((ev as ErrorEvent)?.error?.stack || '').slice(0, 800),
        filename: (ev as ErrorEvent).filename,
        lineno: (ev as ErrorEvent).lineno,
        colno: (ev as ErrorEvent).colno,
      });
    } catch {
      /* ignore */
    }
  });
  window.addEventListener('unhandledrejection', ev => {
    try {
      const r = (ev as PromiseRejectionEvent)?.reason;
      void logClientEvent('error', 'unhandled_rejection', {
        message: r?.message || String(r || 'unknown'),
        stack: (r?.stack || '').slice(0, 800),
      });
    } catch {
      /* ignore */
    }
  });
}
