import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { saveLS, normalizeDraftSessionPlayers, buildDraftHash } from '../lib/storage';
import { isMissingLiveSessionTableError } from './errors';

/**
 * Debounced upsert aktywnej sesji do `live_session_state` (multi-device draft).
 */
export function useLiveSessionPush({
  user,
  skipLiveSessionCloud,
  defaultBuyIn,
  sessionPlayers,
  applyingRemoteSessionRef,
  lastDraftHashRef,
  lastMergedLiveUpdatedAtRef,
  setSkipLiveSessionCloud,
  setSyncMeta,
  recordSyncError,
}) {
  useEffect(() => {
    if (!user || skipLiveSessionCloud) return;
    if (applyingRemoteSessionRef.current) {
      applyingRemoteSessionRef.current = false;
      return;
    }
    const draftHash = buildDraftHash(defaultBuyIn, sessionPlayers);
    if (draftHash === lastDraftHashRef.current) return;
    const timer = setTimeout(async () => {
      const payload = {
        owner_id: user.id,
        default_buy_in: Number(defaultBuyIn) || 50,
        session_players: normalizeDraftSessionPlayers(sessionPlayers),
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('live_session_state').upsert(payload, { onConflict: 'owner_id' });
      if (error) {
        if (isMissingLiveSessionTableError(error)) {
          setSkipLiveSessionCloud(true);
          setSyncMeta(prev => ({ ...prev, lastError: null }));
          console.warn('Supabase: brak tabeli live_session_state. W Dashboard → SQL uruchom plik supabase/migrations/002_live_session_state.sql');
        } else {
          recordSyncError(error.message || 'Błąd synchronizacji aktywnej sesji');
        }
      } else {
        lastDraftHashRef.current = draftHash;
        lastMergedLiveUpdatedAtRef.current = payload.updated_at;
        saveLS(`poker_live_push_${user.id}`, { updated_at: payload.updated_at });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [user?.id, defaultBuyIn, sessionPlayers, skipLiveSessionCloud]);
}
