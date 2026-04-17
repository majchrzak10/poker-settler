// @ts-nocheck
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { plnToCents, settleDebts, pluralPL, formatPln } from './lib/settlement';
import { supabase } from './lib/supabase';
import {
  FAILED_CLOUD_SAVES_KEY,
  SYNC_META_KEY,
  ONBOARDING_KEY,
} from './app/keys';
import { buildSessionRpcArgs } from './sync/sessionRpc';
import {
  isRpcMissingError,
  isFriendLinkRpcMissing,
  isMissingLiveSessionTableError,
  sanitizeSyncMeta,
  summarizeSyncError,
  formatSyncStamp,
  isSessionPlayerFkError,
} from './sync/errors';
import { logClientEvent } from './sync/telemetry';
import {
  loadLS,
  saveLS,
  generateId,
  useDebouncedLocalStorage,
  normalizeDraftSessionPlayers,
  buildDraftHash,
  isoToMs,
} from './lib/storage';
import { getTotalBuyIn, normalizePhoneDigits } from './lib/format';
import { mapSharedParticipations } from './lib/historyShared';
import { useAuth } from './auth/useAuth';
import { LoadingScreen, EmailConfirmedScreen, AuthScreen } from './features/auth/AuthScreens';
import { PlayersTab } from './features/players/PlayersTab';
import { SessionTab } from './features/session/SessionTab';
import { SettlementTab } from './features/settlement/SettlementTab';
import { HistoryTab } from './features/history/HistoryTab';
import { ProfileView } from './features/profile/ProfileView';
import { TABS, SCREEN_META } from './app/navigation';

export default function App() {
  const { user, loading: authLoading, emailConfirmed, setEmailConfirmed } = useAuth();
  const [players, setPlayers] = useState(() => loadLS('poker_players', []));
  const [sessionPlayers, setSessionPlayers] = useState(() => loadLS('poker_session', []));
  const [defaultBuyIn, setDefaultBuyIn] = useState(() => loadLS('poker_default_buyin', 50));
  const [tab, setTab] = useState('session');
  const [transactions, setTransactions] = useState([]);
  const [settled, setSettled] = useState(false);
  const [history, setHistory] = useState(() => loadLS('poker_sessions_history', []));
  const [sharedHistory, setSharedHistory] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [outgoingInvites, setOutgoingInvites] = useState([]);
  const [outgoingInviteMetaByEmail, setOutgoingInviteMetaByEmail] = useState({});
  const [accountByEmail, setAccountByEmail] = useState({});
  const [autoAddMeToSession, setAutoAddMeToSession] = useState(() => loadLS('poker_auto_add_me', true));
  const [savingSession, setSavingSession] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [manualRefreshBusy, setManualRefreshBusy] = useState(false);
  const [failedCloudSaves, setFailedCloudSaves] = useState(() => loadLS(FAILED_CLOUD_SAVES_KEY, []));
  const [retryingFailedSaves, setRetryingFailedSaves] = useState(false);
  const [syncMeta, setSyncMeta] = useState(() => sanitizeSyncMeta(loadLS(SYNC_META_KEY, { lastAttempt: null, lastSuccess: null, lastError: null })));
  const [skipLiveSessionCloud, setSkipLiveSessionCloud] = useState(false);
  const [cloudBanner, setCloudBanner] = useState(null);
  const [syncChannelNonce, setSyncChannelNonce] = useState(0);
  const [onboardingOpen, setOnboardingOpen] = useState(() => !loadLS(ONBOARDING_KEY, false));
  const applyingRemoteSessionRef = useRef(false);
  const lastDraftHashRef = useRef(buildDraftHash(defaultBuyIn, sessionPlayers));
  const lastMergedLiveUpdatedAtRef = useRef(null);
  const sessionPlayersRef = useRef(sessionPlayers);
  const defaultBuyInRef = useRef(defaultBuyIn);

  useDebouncedLocalStorage('poker_players', players);
  useDebouncedLocalStorage('poker_session', sessionPlayers);
  useDebouncedLocalStorage('poker_default_buyin', defaultBuyIn);
  useDebouncedLocalStorage('poker_auto_add_me', autoAddMeToSession);
  useDebouncedLocalStorage('poker_sessions_history', history);
  useDebouncedLocalStorage(FAILED_CLOUD_SAVES_KEY, failedCloudSaves);
  useDebouncedLocalStorage(SYNC_META_KEY, syncMeta);

  const recordSyncAttempt = () => {
    setSyncMeta(prev => ({ ...prev, lastAttempt: new Date().toISOString() }));
  };
  const recordSyncSuccess = () => {
    setSyncMeta(prev => ({ ...prev, lastSuccess: new Date().toISOString(), lastError: null }));
  };
  const recordSyncError = msg => {
    setSyncMeta(prev => ({ ...prev, lastError: msg || 'Błąd synchronizacji' }));
  };
  const notifyCloudFailure = msg => {
    const m = msg || 'Błąd synchronizacji';
    recordSyncError(m);
    setCloudBanner(m);
  };
  const normalizeEmail = value => (value || '').trim().toLowerCase();
  const findProfileByEmail = async emailNorm => {
    if (!emailNorm) return null;
    const { data, error } = await supabase.from('profiles').select('id').eq('email', emailNorm).maybeSingle();
    if (error) throw error;
    return data?.id || null;
  };
  const createInviteIfPossible = async (playerId, emailNorm) => {
    if (!emailNorm || emailNorm === normalizeEmail(user?.email)) return false;
    const profileId = await findProfileByEmail(emailNorm);
    if (!profileId) return false;
    const { error: inviteErr } = await supabase.from('friend_invites').insert({
      requester_user_id: user.id,
      requester_player_id: playerId,
      invitee_email: emailNorm,
    });
    if (inviteErr && inviteErr.code !== '23505') throw inviteErr;
    return true;
  };

  useEffect(() => {
    if (!cloudBanner) return;
    const t = setTimeout(() => setCloudBanner(null), 10000);
    return () => clearTimeout(t);
  }, [cloudBanner]);

  useEffect(() => {
    sessionPlayersRef.current = sessionPlayers;
  }, [sessionPlayers]);
  useEffect(() => {
    defaultBuyInRef.current = defaultBuyIn;
  }, [defaultBuyIn]);

  useEffect(() => {
    lastMergedLiveUpdatedAtRef.current = null;
    setSkipLiveSessionCloud(false);
  }, [user?.id]);

  const refreshCloudData = useCallback(async () => {
    if (!user) return;
    const [playersRes, sessionsRes, sharedRes, invitesRes] = await Promise.all([
      supabase.from('players').select('*').eq('owner_id', user.id).order('created_at'),
      supabase.from('sessions').select('id, played_at, total_pot, session_players(player_id, player_name, total_buy_in, cash_out, net_balance), transfers(from_name, to_name, amount)').eq('owner_id', user.id).order('played_at'),
      supabase.from('participations').select('*').eq('user_id', user.id).order('session_date'),
      supabase.from('friend_invites').select('id, requester_user_id, requester_player_id, invitee_email, invitee_user_id, status, created_at, responded_at').order('created_at', { ascending: false }).limit(400),
    ]);
    let liveRes = { data: null, error: null };
    if (!skipLiveSessionCloud) {
      liveRes = await supabase.from('live_session_state').select('default_buy_in, session_players, updated_at').eq('owner_id', user.id).maybeSingle();
      if (liveRes.error) {
        if (isMissingLiveSessionTableError(liveRes.error)) {
          setSkipLiveSessionCloud(true);
          setSyncMeta(prev => ({ ...prev, lastError: null }));
          liveRes = { data: null, error: null };
        } else {
          console.warn('refreshCloudData live_session_state', liveRes.error);
        }
      }
    }
    if (playersRes.error || sessionsRes.error) {
      console.warn('refreshCloudData players/sessions', playersRes.error, sessionsRes.error);
      try {
        void logClientEvent('error', 'refresh_cloud_failed', {
          players_error: playersRes.error?.message || null,
          players_code: playersRes.error?.code || null,
          sessions_error: sessionsRes.error?.message || null,
          sessions_code: sessionsRes.error?.code || null
        });
      } catch (_) {}
      return;
    }
    setSyncMeta(prev => (prev.lastError ? { ...prev, lastError: null } : prev));
    if (sharedRes.error) console.warn('refreshCloudData participations', sharedRes.error);
    if (invitesRes.error) console.warn('refreshCloudData friend_invites', invitesRes.error);

    const pData = playersRes.data;
    const sData = sessionsRes.data;
    const sharedData = sharedRes.data;
    const invitesData = invitesRes.data;
    const liveDraft = liveRes.error ? null : liveRes.data;

    const cloudPlayers = (pData || []).map(p => ({ id: p.id, name: p.name, phone: p.phone || '', email: p.email || '', linked_user_id: p.linked_user_id || null }));
    setPlayers(prev => {
      const seen = new Set(cloudPlayers.map(p => p.id));
      const extras = prev.filter(p => !seen.has(p.id));
      return extras.length ? [...cloudPlayers, ...extras] : cloudPlayers;
    });

    const mapSessionRow = s => ({
      id: s.id, date: s.played_at, totalPot: s.total_pot / 100,
      players: (s.session_players || []).map(sp => ({ id: sp.player_id || generateId(), name: sp.player_name, phone: '', totalBuyIn: sp.total_buy_in / 100, cashOut: sp.cash_out != null ? sp.cash_out / 100 : 0, netBalance: sp.net_balance != null ? sp.net_balance / 100 : 0 })),
      transfers: (s.transfers || []).map(t => ({ from: t.from_name, to: t.to_name, amount: t.amount / 100 })),
    });
    const cloudHistory = (sData || []).map(mapSessionRow);
    setHistory(prev => {
      const ids = new Set(cloudHistory.map(s => s.id));
      const localOnly = prev.filter(s => !ids.has(s.id) && !String(s.id).startsWith('shared:'));
      if (localOnly.length === 0) return cloudHistory;
      return [...cloudHistory, ...localOnly].sort((a, b) => new Date(a.date) - new Date(b.date));
    });

    if (!sharedRes.error) setSharedHistory(mapSharedParticipations(sharedData || []));
    if (!invitesRes.error) {
      const myEmail = (user.email || '').trim().toLowerCase();
      const incoming = (invitesData || []).filter(inv =>
        inv.status === 'pending' &&
        inv.requester_user_id !== user.id && (
          inv.invitee_user_id === user.id ||
          (inv.invitee_email || '').trim().toLowerCase() === myEmail
        )
      );
      setPendingInvites(incoming);
      const outgoing = (invitesData || []).filter(inv => inv.requester_user_id === user.id && inv.status !== 'accepted');
      setOutgoingInvites(outgoing);
      const outgoingMap = {};
      for (const inv of outgoing) {
        const emailKey = normalizeEmail(inv.invitee_email);
        if (!emailKey) continue;
        const prev = outgoingMap[emailKey];
        if (!prev || new Date(inv.created_at).getTime() > new Date(prev.created_at).getTime()) {
          outgoingMap[emailKey] = {
            id: inv.id,
            status: inv.status,
            created_at: inv.created_at,
            responded_at: inv.responded_at || null,
          };
        }
      }
      setOutgoingInviteMetaByEmail(outgoingMap);
    }
    const playerEmails = [...new Set((cloudPlayers || []).map(p => normalizeEmail(p.email)).filter(Boolean))];
    if (playerEmails.length === 0) {
      setAccountByEmail({});
    } else {
      const { data: profileRows } = await supabase.from('profiles').select('email').in('email', playerEmails);
      const existing = new Set((profileRows || []).map(r => normalizeEmail(r.email)));
      const map = {};
      for (const email of playerEmails) map[email] = existing.has(email);
      setAccountByEmail(map);
    }

    if (liveDraft && !liveRes.error) {
      const remoteTs = liveDraft.updated_at;
      const lastPushMeta = loadLS(`poker_live_push_${user.id}`, null);
      const lastLocalPushAt = lastPushMeta?.updated_at;
      const remoteIsNewerThanOurPush = !lastLocalPushAt || isoToMs(remoteTs) > isoToMs(lastLocalPushAt);
      const mergedRef = lastMergedLiveUpdatedAtRef.current;
      const remoteNewerThanLastMerge = !mergedRef || isoToMs(remoteTs) > isoToMs(mergedRef);

      if (remoteIsNewerThanOurPush && remoteNewerThanLastMerge) {
        const remoteDefaultBuyIn = Number(liveDraft.default_buy_in) || 50;
        const remoteSessionPlayers = normalizeDraftSessionPlayers(liveDraft.session_players);
        const localNorm = normalizeDraftSessionPlayers(sessionPlayersRef.current);
        if (!lastLocalPushAt && localNorm.length > 0 && remoteSessionPlayers.length === 0) {
          lastMergedLiveUpdatedAtRef.current = remoteTs;
          lastDraftHashRef.current = buildDraftHash(defaultBuyInRef.current, sessionPlayersRef.current);
          saveLS(`poker_live_push_${user.id}`, { updated_at: remoteTs });
        } else {
          const remoteHash = buildDraftHash(remoteDefaultBuyIn, remoteSessionPlayers);
          applyingRemoteSessionRef.current = true;
          lastMergedLiveUpdatedAtRef.current = remoteTs;
          lastDraftHashRef.current = remoteHash;
          saveLS(`poker_live_push_${user.id}`, { updated_at: remoteTs });
          setDefaultBuyIn(remoteDefaultBuyIn);
          setSessionPlayers(remoteSessionPlayers);
        }
      }
    }
  }, [user?.id, skipLiveSessionCloud]);

  useEffect(() => {
    if (!user || !skipLiveSessionCloud) return;
    const probe = async () => {
      const { error } = await supabase.from('live_session_state').select('owner_id').eq('owner_id', user.id).limit(1).maybeSingle();
      if (!error) setSkipLiveSessionCloud(false);
    };
    const soon = setTimeout(probe, 4000);
    const id = setInterval(probe, 90000);
    return () => { clearTimeout(soon); clearInterval(id); };
  }, [user?.id, skipLiveSessionCloud]);

  useEffect(() => {
    refreshCloudData();
  }, [refreshCloudData]);

  useEffect(() => {
    if (!user) return;
    const ensureSelfPlayer = async () => {
      const { error: rpcErr } = await supabase.rpc('sync_self_player');
      if (rpcErr) {
        const isMissing = rpcErr.code === 'PGRST202' || rpcErr.code === '42883';
        if (!isMissing) {
          notifyCloudFailure(rpcErr.message);
        } else {
          const existing = players.find(p => p.linked_user_id === user.id);
          if (!existing) {
            const fallbackName = user.email?.split('@')[0] || 'Ja';
            await supabase.from('players').insert({
              id: generateId(),
              owner_id: user.id,
              linked_user_id: user.id,
              name: fallbackName,
              email: (user.email || '').toLowerCase() || null,
            });
          }
        }
      }
      void refreshCloudData();
    };
    void ensureSelfPlayer();
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    let timer = null;
    let inFlight = false;
    let reconnectTimer = null;
    let reconnectScheduled = false;
    const scheduleRefresh = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        if (inFlight) return;
        inFlight = true;
        try {
          await refreshCloudData();
        } finally {
          inFlight = false;
        }
      }, 300);
    };
    const scheduleReconnect = reason => {
      if (reconnectScheduled) return;
      reconnectScheduled = true;
      reconnectTimer = setTimeout(() => {
        reconnectScheduled = false;
        setSyncChannelNonce(n => n + 1);
      }, 1200);
      if (reason) {
        try { console.warn('sync channel reconnect scheduled:', reason); } catch (_) {}
        try { void logClientEvent('warn', 'realtime_reconnect', { reason: String(reason) }); } catch (_) {}
      }
    };
    let channel = supabase.channel(`sync-${user.id}-${syncChannelNonce}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `owner_id=eq.${user.id}` }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter: `owner_id=eq.${user.id}` }, scheduleRefresh);
    if (!skipLiveSessionCloud) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: 'live_session_state', filter: `owner_id=eq.${user.id}` }, scheduleRefresh);
    }
    channel = channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participations', filter: `user_id=eq.${user.id}` }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_invites' }, scheduleRefresh)
      .subscribe(status => {
        if (status === 'SUBSCRIBED') {
          scheduleRefresh();
          return;
        }
        if (status === 'CHANNEL_ERROR' || status === 'CLOSED' || status === 'TIMED_OUT') {
          scheduleReconnect(status);
        }
      });

    const poll = setInterval(() => {
      if (!document.hidden) scheduleRefresh();
    }, 6000);

    const onFocus = () => scheduleRefresh();
    const onOnline = () => scheduleRefresh();
    const onVisibility = () => {
      if (!document.hidden) scheduleRefresh();
    };
    const onPageShow = () => scheduleRefresh();
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearTimeout(timer);
      clearTimeout(reconnectTimer);
      clearInterval(poll);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisibility);
      supabase.removeChannel(channel);
    };
  }, [user?.id, refreshCloudData, skipLiveSessionCloud, syncChannelNonce]);

  useEffect(() => {
    if (!user || !autoAddMeToSession) return;
    if (sessionPlayers.length > 0) return;
    const selfPlayer = players.find(p => p.linked_user_id === user.id);
    if (!selfPlayer) return;
    setSessionPlayers([{ playerId: selfPlayer.id, buyIns: [defaultBuyIn], cashOut: '' }]);
  }, [user?.id, players, sessionPlayers.length, defaultBuyIn, autoAddMeToSession]);
  const combinedHistory = useMemo(
    () => [...history, ...sharedHistory].sort((a, b) => new Date(a.date) - new Date(b.date)),
    [history, sharedHistory]
  );

  const totalPot = sessionPlayers.reduce((sum, sp) => sum + getTotalBuyIn(sp), 0);
  const addFailedCloudSave = payload => {
    setFailedCloudSaves(prev => {
      const idx = prev.findIndex(p => p.sessionId === payload.sessionId);
      if (idx === -1) return [...prev, payload];
      const next = [...prev];
      next[idx] = payload;
      return next;
    });
  };
  const removeFailedCloudSave = sessionId => {
    setFailedCloudSaves(prev => prev.filter(p => p.sessionId !== sessionId));
  };

  const insertRows = async (table, rows) => {
    if (!rows || rows.length === 0) return;
    const { error } = await supabase.from(table).insert(rows);
    if (error && error.code !== '23505') throw error;
  };

  const createMissingSessionPlayersError = message => {
    const err = new Error(message || 'Nie znaleziono części graczy użytych w sesji.');
    err.code = 'MISSING_SESSION_PLAYERS';
    return err;
  };

  const repairSessionPlayersRows = async (sessionPlayersRows = []) => {
    if (!user || !sessionPlayersRows.length) return sessionPlayersRows;
    const ids = [...new Set(sessionPlayersRows.map(r => r.player_id).filter(Boolean))];
    if (!ids.length) return sessionPlayersRows;
    const { data: existingRows, error: existingErr } = await supabase
      .from('players')
      .select('id')
      .eq('owner_id', user.id)
      .in('id', ids);
    if (existingErr) throw existingErr;
    const existing = new Set((existingRows || []).map(r => r.id));
    const missing = sessionPlayersRows.filter(r => !existing.has(r.player_id));
    if (missing.length === 0) return sessionPlayersRows;

    const { data: allPlayers, error: allErr } = await supabase
      .from('players')
      .select('id,name')
      .eq('owner_id', user.id);
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
    if (repaired > 0) {
      setCloudBanner(`Naprawiono ${repaired} ${pluralPL(repaired, 'powiązanie gracza', 'powiązania graczy', 'powiązań graczy')} przed zapisem do chmury.`);
    }
    return patched;
  };

  const persistSessionInsertsSequential = async (sessionRow, sessionPlayersRows, transferRows, participationRows) => {
    const { error: sessionErr } = await supabase.from('sessions').insert(sessionRow);
    if (sessionErr) throw sessionErr;
    await insertRows('session_players', sessionPlayersRows);
    await insertRows('transfers', transferRows);
    await insertRows('participations', participationRows);
  };

  const persistSessionSaveCloud = async (sessionRow, sessionPlayersRows, transferRows, participationRows) => {
    const repairedSessionPlayersRows = await repairSessionPlayersRows(sessionPlayersRows);
    const args = buildSessionRpcArgs(sessionRow, repairedSessionPlayersRows, transferRows, participationRows);
    const { error } = await supabase.rpc('save_session_atomic', args);
    if (!error) return repairedSessionPlayersRows;
    if (!isRpcMissingError(error)) throw error;
    await persistSessionInsertsSequential(sessionRow, repairedSessionPlayersRows, transferRows, participationRows);
    return repairedSessionPlayersRows;
  };

  const persistSessionUpdateCloud = async (sessionRow, sessionPlayersRows, transferRows, participationRows) => {
    const repairedSessionPlayersRows = await repairSessionPlayersRows(sessionPlayersRows);
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
  };

  const retryFailedSaves = async () => {
    if (!user || failedCloudSaves.length === 0 || retryingFailedSaves) return;
    setRetryingFailedSaves(true);
    recordSyncAttempt();
    let success = 0;
    let failed = 0;
    let lastErr = null;
    for (const item of failedCloudSaves) {
      try {
        await persistSessionSaveCloud(item.sessionRow, item.sessionPlayersRows, item.transferRows, item.participationRows);
        removeFailedCloudSave(item.sessionId);
        success++;
      } catch (e) {
        if (e?.code === 'MISSING_SESSION_PLAYERS' || isSessionPlayerFkError(e)) {
          // This payload is stale and cannot be retried automatically.
          removeFailedCloudSave(item.sessionId);
        }
        failed++;
        lastErr = e?.message || String(e);
        console.error('Retry cloud save failed:', e);
      }
    }
    setRetryingFailedSaves(false);
    if (success > 0) recordSyncSuccess();
    if (failed > 0) recordSyncError(lastErr);
    if (success > 0 && failed === 0) {
      setSaveStatus({ type: 'ok', message: 'Udało się dosłać wszystkie zaległe sesje do chmury.' });
    } else if (success > 0) {
      setSaveStatus({ type: 'error', message: 'Część zaległych sesji nadal czeka na zapis do chmury.' });
    } else if (failed > 0) {
      setSaveStatus({ type: 'error', message: 'Nie udało się dosłać zaległych sesji. Spróbuj ponownie później.' });
    }
  };
  useEffect(() => {
    if (!user || failedCloudSaves.length === 0 || retryingFailedSaves) return;
    const timer = setTimeout(() => {
      retryFailedSaves();
    }, 1200);
    return () => clearTimeout(timer);
  }, [user?.id, failedCloudSaves.length]);

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

  const playerById = useMemo(
    () => Object.fromEntries(players.map(p => [p.id, p])),
    [players]
  );

  const addPlayer = async (name, phone, email) => {
    const emailNorm = normalizeEmail(email);
    const phoneDigits = normalizePhoneDigits(phone);
    if (phoneDigits.length >= 9) {
      const dup = players.some(p => normalizePhoneDigits(p.phone) === phoneDigits);
      if (dup) {
        setCloudBanner('Masz już gracza z tym numerem telefonu. Zmień numer albo edytuj istniejący wpis.');
        return;
      }
    }
    const id = generateId();
    const row = { id, name, phone, email: emailNorm };
    setPlayers(prev => [...prev, row]);
    if (!user) return;
    const { error } = await supabase.from('players').insert({ id, owner_id: user.id, name, phone: phone || null, email: emailNorm || null });
    if (error) {
      setPlayers(prev => prev.filter(p => p.id !== id));
      if (error.code === '23505') {
        notifyCloudFailure('Ten numer jest już przypisany do innego gracza na Twojej liście.');
      } else {
        notifyCloudFailure(error.message);
      }
    } else {
      try {
        const inviteCreated = await createInviteIfPossible(id, emailNorm);
        if (inviteCreated) {
          setCloudBanner('Gracz dodany. Zaproszenie zostało wysłane i pojawi się u znajomego w Profilu.');
        } else if (emailNorm) {
          setCloudBanner('Gracz dodany, ale email nie ma jeszcze konta. Status: Brak konta.');
        }
      } catch (inviteErr) {
        notifyCloudFailure(inviteErr.message);
      }
      void refreshCloudData();
    }
  };
  const updatePlayer = async (id, name, phone, email) => {
    const prevRow = players.find(p => p.id === id);
    const emailNorm = normalizeEmail(email);
    const phoneDigits = normalizePhoneDigits(phone);
    if (phoneDigits.length >= 9) {
      const dup = players.some(p => p.id !== id && normalizePhoneDigits(p.phone) === phoneDigits);
      if (dup) {
        setCloudBanner('Masz już innego gracza z tym numerem telefonu.');
        return;
      }
    }
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, name, phone, email: emailNorm } : p));
    if (!user) return;
    const { error } = await supabase.from('players').update({ name, phone: phone || null, email: emailNorm || null }).eq('id', id);
    if (error && prevRow) {
      setPlayers(prev => prev.map(p => p.id === id ? prevRow : p));
      if (error.code === '23505') {
        notifyCloudFailure('Ten numer jest już przypisany do innego gracza na Twojej liście.');
      } else {
        notifyCloudFailure(error.message);
      }
    } else if (!error) {
      try {
        const inviteCreated = await createInviteIfPossible(id, emailNorm);
        if (inviteCreated && normalizeEmail(prevRow?.email) !== emailNorm) {
          setCloudBanner('Email zaktualizowany. Zaproszenie zostało wysłane.');
        }
      } catch (inviteErr) {
        notifyCloudFailure(inviteErr.message);
      }
      void refreshCloudData();
    }
  };
  const acceptInvite = async (inviteId) => {
    const { error } = await supabase.rpc('accept_friend_invite', { p_invite_id: inviteId });
    if (error) {
      notifyCloudFailure(error.message);
      return 'Nie udało się zaakceptować zaproszenia.';
    }
    void refreshCloudData();
    return null;
  };

  const rejectInvite = async (inviteId) => {
    const { error } = await supabase.rpc('reject_friend_invite', { p_invite_id: inviteId });
    if (error) {
      notifyCloudFailure(error.message);
      return 'Nie udało się odrzucić zaproszenia.';
    }
    void refreshCloudData();
    return null;
  };
  const cancelInvite = async inviteId => {
    const { error } = await supabase.rpc('cancel_friend_invite', { p_invite_id: inviteId });
    if (error) {
      notifyCloudFailure(error.message);
      return 'Nie udało się cofnąć zaproszenia.';
    }
    void refreshCloudData();
    return null;
  };
  const unlinkPlayer = async (playerId) => {
    const prevRow = players.find(p => p.id === playerId);
    setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, linked_user_id: null } : p));
    if (!user) return true;
    const { error: rpcErr } = await supabase.rpc('remove_friend_player_link', { p_player_id: playerId });
    if (rpcErr) {
      if (prevRow) setPlayers(prev => prev.map(p => p.id === playerId ? prevRow : p));
      notifyCloudFailure(rpcErr.message);
      void refreshCloudData();
      if (isFriendLinkRpcMissing(rpcErr)) {
        return false;
      }
      return false;
    }
    void refreshCloudData();
    return true;
  };
  const removePlayer = async id => {
    const prevP = players;
    const prevSp = sessionPlayers;
    const row = players.find(p => p.id === id);
    if (user && row?.linked_user_id === user.id) {
      setCloudBanner('Nie możesz usunąć własnego profilu gracza.');
      return;
    }
    if (user && row?.linked_user_id) {
      const ok = await unlinkPlayer(id);
      if (!ok) return;
    }
    setPlayers(prev => prev.filter(p => p.id !== id));
    setSessionPlayers(prev => prev.filter(sp => sp.playerId !== id));
    if (!user) return;
    const { error } = await supabase.from('players').delete().eq('id', id);
    if (error) {
      setPlayers(prevP);
      setSessionPlayers(prevSp);
      notifyCloudFailure(error.message);
    } else {
      void refreshCloudData();
    }
  };
  const addToSession = playerId => {
    if (sessionPlayers.some(sp => sp.playerId === playerId)) return;
    setSettled(false);
    setSessionPlayers(prev => [...prev, { playerId, buyIns: [defaultBuyIn], cashOut: '' }]);
  };
  const removeFromSession = playerId => { setSettled(false); setSessionPlayers(prev => prev.filter(sp => sp.playerId !== playerId)); };
  const addBuyIn = playerId => { setSettled(false); setSessionPlayers(prev => prev.map(sp => sp.playerId === playerId ? { ...sp, buyIns: [...sp.buyIns, defaultBuyIn] } : sp)); };
  const removeBuyIn = playerId => { setSettled(false); setSessionPlayers(prev => prev.map(sp => sp.playerId === playerId && sp.buyIns.length > 1 ? { ...sp, buyIns: sp.buyIns.slice(0, -1) } : sp)); };
  const setCashOut = (playerId, value) => { setSettled(false); setSessionPlayers(prev => prev.map(sp => sp.playerId === playerId ? { ...sp, cashOut: value.replace(/[^0-9.]/g, '') } : sp)); };

  const handleCalculate = () => {
    const entries = sessionPlayers.flatMap(sp => {
      const p = playerById[sp.playerId] ?? { name: `Gracz (${sp.playerId.slice(0, 6)})`, phone: '' };
      return [{ name: p.name, phone: p.phone, cents: plnToCents(parseFloat(sp.cashOut) || 0) - plnToCents(getTotalBuyIn(sp)) }];
    });
    setTransactions(settleDebts(entries));
    setSettled(true);
  };

  const resetSession = () => { setSessionPlayers([]); setTransactions([]); setSettled(false); setTab('session'); };

  const saveAndFinishSession = async () => {
    if (savingSession) return;
    const sessionId = generateId();
    const sessionDate = new Date().toISOString();
    const sessionPlrs = sessionPlayers.map(sp => {
      const player = playerById[sp.playerId];
      const totalBuyIn = getTotalBuyIn(sp);
      const cashOut = parseFloat(sp.cashOut) || 0;
      return { id: sp.playerId, name: player?.name ?? '?', phone: player?.phone ?? '', totalBuyIn, cashOut, netBalance: cashOut - totalBuyIn };
    });
    const session = { id: sessionId, date: sessionDate, totalPot, players: sessionPlrs, transfers: transactions };
    const sessionRow = {
      id: sessionId,
      owner_id: user?.id,
      played_at: sessionDate,
      total_pot: plnToCents(totalPot),
    };
    const sessionPlayersRows = sessionPlrs.map(p => ({
      session_id: sessionId,
      player_id: p.id,
      player_name: p.name,
      total_buy_in: plnToCents(p.totalBuyIn),
      cash_out: plnToCents(p.cashOut),
    }));
    const transferRows = transactions.map(t => ({
      session_id: sessionId,
      from_name: t.from,
      to_name: t.to,
      amount: plnToCents(t.amount),
    }));
    const linkedPlrs = sessionPlrs.filter(p => playerById[p.id]?.linked_user_id);
    const participationRows = linkedPlrs.map(p => ({
      user_id: playerById[p.id].linked_user_id,
      session_id: sessionId,
      player_name: p.name,
      total_buy_in: plnToCents(p.totalBuyIn),
      cash_out: plnToCents(p.cashOut),
      session_date: sessionDate,
      total_pot: plnToCents(totalPot),
    }));
    setSaveStatus(null);
    setSavingSession(true);
    setHistory(prev => [...prev, session]);
    resetSession();
    setTab('history');
    if (user) {
      recordSyncAttempt();
      try {
        await persistSessionSaveCloud(sessionRow, sessionPlayersRows, transferRows, participationRows);
        removeFailedCloudSave(sessionId);
        void refreshCloudData();
        recordSyncSuccess();
        setSaveStatus({ type: 'ok', message: 'Sesja zapisana w chmurze.' });
      } catch (e) {
        const msg = e?.message || String(e);
        notifyCloudFailure(msg);
        if (e?.code === 'MISSING_SESSION_PLAYERS' || isSessionPlayerFkError(e)) {
          setSaveStatus({
            type: 'error',
            message: 'Sesja zapisana lokalnie. Część graczy nie istnieje już w chmurze — otwórz nową sesję i wybierz graczy ponownie z listy.',
          });
        } else {
          addFailedCloudSave({ sessionId, sessionRow, sessionPlayersRows, transferRows, participationRows });
          setSaveStatus({ type: 'error', message: 'Sesja zapisana lokalnie. Chmura nie zapisała wszystkiego, spróbuj ponownie później.' });
        }
        console.error('Cloud save failed:', e);
        try {
          void logClientEvent('error', 'save_session_failed', {
            message: msg?.slice?.(0, 300) || String(e),
            code: e?.code || null,
            classifier: (e?.code === 'MISSING_SESSION_PLAYERS' || isSessionPlayerFkError(e)) ? 'missing_players' : 'other',
            session_id: sessionId
          });
        } catch (_) {}
      }
    }
    setSavingSession(false);
  };

  const updateSession = async (id, updated) => {
    const prevSnap = history.find(s => s.id === id);
    if (!prevSnap) return 'Nie znaleziono sesji.';
    setHistory(prev => prev.map(s => s.id === id ? updated : s));
    if (!user || String(id).startsWith('shared:')) return null;
    recordSyncAttempt();
    try {
      const sessionRow = {
        id,
        owner_id: user.id,
        played_at: updated.date,
        total_pot: plnToCents(updated.totalPot),
      };
      const sessionPlayersRows = updated.players.map(p => ({
        session_id: id,
        player_id: p.id,
        player_name: p.name,
        total_buy_in: plnToCents(p.totalBuyIn),
        cash_out: plnToCents(p.cashOut),
      }));
      const transferRows = updated.transfers.map(t => ({
        session_id: id,
        from_name: t.from,
        to_name: t.to,
        amount: plnToCents(t.amount),
      }));
      const participationRows = [];
      for (const p of updated.players) {
        const pl = playerById[p.id];
        if (pl?.linked_user_id) {
          participationRows.push({
            user_id: pl.linked_user_id,
            session_id: id,
            player_name: p.name,
            total_buy_in: plnToCents(p.totalBuyIn),
            cash_out: plnToCents(p.cashOut),
            session_date: updated.date,
            total_pot: plnToCents(updated.totalPot),
          });
        }
      }
      await persistSessionUpdateCloud(sessionRow, sessionPlayersRows, transferRows, participationRows);
      void refreshCloudData();
      recordSyncSuccess();
      return null;
    } catch (e) {
      const msg = e?.message || String(e);
      setHistory(prev => prev.map(s => s.id === id ? prevSnap : s));
      notifyCloudFailure(msg);
      console.error('updateSession cloud failed:', e);
      return 'Edycja jest zapisana tylko lokalnie. Chmura nie przyjęła zmian — spróbuj ponownie.';
    }
  };
  const deleteSession = async (id) => {
    if (String(id).startsWith('shared:')) return;
    const prevEntry = history.find(s => s.id === id);
    setHistory(prev => prev.filter(s => s.id !== id));
    if (!user) return;
    const { error: e1 } = await supabase.from('transfers').delete().eq('session_id', id);
    if (e1) {
      if (prevEntry) setHistory(prev => [...prev, prevEntry].sort((a, b) => new Date(a.date) - new Date(b.date)));
      notifyCloudFailure(e1.message);
      return;
    }
    const { error: e2 } = await supabase.from('session_players').delete().eq('session_id', id);
    if (e2) {
      if (prevEntry) setHistory(prev => [...prev, prevEntry].sort((a, b) => new Date(a.date) - new Date(b.date)));
      notifyCloudFailure(e2.message);
      return;
    }
    const { error: e3 } = await supabase.from('participations').delete().eq('session_id', id);
    if (e3) {
      if (prevEntry) setHistory(prev => [...prev, prevEntry].sort((a, b) => new Date(a.date) - new Date(b.date)));
      notifyCloudFailure(e3.message);
      return;
    }
    const { error: e4 } = await supabase.from('sessions').delete().eq('id', id);
    if (e4 && prevEntry) {
      setHistory(prev => [...prev, prevEntry].sort((a, b) => new Date(a.date) - new Date(b.date)));
      notifyCloudFailure(e4.message);
    } else if (!e4) {
      void refreshCloudData();
    }
  };
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setPlayers([]);
    setHistory([]);
    setSharedHistory([]);
    setTab('session');
  };
  const handleManualRefresh = async () => {
    setManualRefreshBusy(true);
    try {
      await refreshCloudData();
    } finally {
      setManualRefreshBusy(false);
    }
  };
  const syncSelfPlayerName = async nextName => {
    if (!user || !nextName) return;
    const myEmail = normalizeEmail(user.email);
    const selfIds = players
      .filter(p => p.linked_user_id === user.id || normalizeEmail(p.email) === myEmail)
      .map(p => p.id);
    if (selfIds.length === 0) return;
    setPlayers(prev => prev.map(p => selfIds.includes(p.id) ? { ...p, name: nextName } : p));
    const { error: playersErr } = await supabase.from('players').update({ name: nextName }).eq('owner_id', user.id).eq('linked_user_id', user.id);
    if (playersErr) notifyCloudFailure(playersErr.message);
  };

  if (authLoading) return <LoadingScreen />;
  if (emailConfirmed) return <EmailConfirmedScreen onContinue={() => setEmailConfirmed(false)} />;
  if (!user) return <AuthScreen />;

  return (
    <div className="min-h-screen bg-green-950 text-white">
      <div className="flex flex-col min-h-screen w-full max-w-lg mx-auto">
        <header className="sticky top-0 z-10 bg-green-950/90 backdrop-blur-sm border-b border-green-900 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="min-w-0 pr-2">
            <h1 className="text-lg font-bold text-white tracking-tight">♠ Poker Settler</h1>
            {sessionPlayers.length > 0 ? (
              <p className="text-xs text-green-200/65 mt-0.5 leading-snug">
                Pula: <span className="text-yellow-400 font-semibold tabular-nums">{formatPln(totalPot)} PLN</span>
                <span className="text-green-200/45"> · {SCREEN_META[tab]}</span>
              </p>
            ) : (
              <p className="text-xs text-green-200/60 mt-0.5 leading-snug">{SCREEN_META[tab]}</p>
            )}
          </div>
          <span className="text-xs text-green-200/60 bg-black/30 rounded-full px-2.5 py-1 shrink-0 text-right leading-tight min-w-[3rem]">
            <span className="block font-semibold tabular-nums">{tab === 'players' ? players.length : sessionPlayers.length}</span>
            <span className="block text-[10px] text-green-200/45 font-normal">{tab === 'players' ? 'w liście' : 'w sesji'}</span>
          </span>
        </header>

        {onboardingOpen && (
          <div className="px-4 py-3 bg-emerald-950/50 border-b border-emerald-900/60 shrink-0" role="region" aria-label="Wprowadzenie">
            <p className="text-xs text-emerald-100/90 leading-relaxed">
              <span className="font-semibold text-emerald-300">Start:</span>{' '}
              <span className="text-emerald-100/85">1) Gracze</span> — baza osób.{' '}
              <span className="text-emerald-100/85">2) Sesja</span> — buy-iny.{' '}
              <span className="text-emerald-100/85">3) Wyniki</span> — cash-outy i przelewy.{' '}
              <span className="text-emerald-100/85">4) Historia</span> — archiwum.
            </p>
            <button
              type="button"
              onClick={() => { saveLS(ONBOARDING_KEY, true); setOnboardingOpen(false); }}
              className="mt-2 text-xs font-semibold bg-emerald-800/80 hover:bg-emerald-700 text-white rounded-lg px-3 py-1.5 transition-colors">
              Rozumiem, ukryj
            </button>
          </div>
        )}

        {cloudBanner && (
          <div className="px-4 py-2 bg-yellow-900/40 border-b border-yellow-800/50 flex items-start justify-between gap-2 shrink-0">
            <p className="text-xs text-yellow-100/90 leading-snug flex-1">{cloudBanner}</p>
            <button type="button" onClick={() => setCloudBanner(null)} className="text-xs text-yellow-200/80 hover:text-white shrink-0 px-1" aria-label="Zamknij">✕</button>
          </div>
        )}

        <main className="flex-1 main-scroll-pad">
          {tab === 'players' && <PlayersTab players={players} sessionPlayers={sessionPlayers} onAddPlayer={addPlayer} onUpdatePlayer={updatePlayer} onRemovePlayer={removePlayer} onAddToSession={addToSession} onUnlinkPlayer={unlinkPlayer} currentUserId={user.id} accountByEmail={accountByEmail} outgoingInviteMetaByEmail={outgoingInviteMetaByEmail} />}
          {tab === 'session' && <SessionTab players={players} sessionPlayers={sessionPlayers} defaultBuyIn={defaultBuyIn} totalPot={totalPot} autoAddMeToSession={autoAddMeToSession} onToggleAutoAddMe={setAutoAddMeToSession} onDefaultBuyInChange={setDefaultBuyIn} onAddBuyIn={addBuyIn} onRemoveBuyIn={removeBuyIn} onRemoveFromSession={removeFromSession} onAddToSession={addToSession} onGoToSettlement={() => setTab('settlement')} />}
          {tab === 'settlement' && <SettlementTab players={players} sessionPlayers={sessionPlayers} transactions={transactions} settled={settled} totalPot={totalPot} onSetCashOut={setCashOut} onCalculate={handleCalculate} onResetSession={resetSession} onSaveAndFinish={saveAndFinishSession} savingSession={savingSession} saveStatus={saveStatus} />}
          {tab === 'history' && <HistoryTab history={combinedHistory} onUpdateSession={updateSession} onDeleteSession={deleteSession} failedSyncCount={failedCloudSaves.length} failedSessionIds={failedCloudSaves.map(x => x.sessionId)} onRetryFailedSaves={retryFailedSaves} retryingFailedSaves={retryingFailedSaves} />}
          {tab === 'profile' && <ProfileView user={user} history={combinedHistory} players={players} pendingInvites={pendingInvites} outgoingInvites={outgoingInvites} onAcceptInvite={acceptInvite} onRejectInvite={rejectInvite} onCancelInvite={cancelInvite} onUnlinkPlayer={unlinkPlayer} onSignOut={handleSignOut} onRefresh={handleManualRefresh} onRenameSelf={syncSelfPlayerName} refreshBusy={manualRefreshBusy} syncMeta={syncMeta} onRetrySyncFailed={retryFailedSaves} retryingFailedSaves={retryingFailedSaves} failedCloudSavesCount={failedCloudSaves.length} />}
        </main>

        <nav className="nav-safe fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-green-950/90 backdrop-blur-sm border-t border-green-900 flex z-10" role="navigation" aria-label="Główne zakładki">
          {TABS.map(({ key, label, Icon, aria }) => {
            const isDisabled = key === 'settlement' && sessionPlayers.length === 0;
            const showFailedSyncBadge = key === 'history' && failedCloudSaves.length > 0;
            const active = tab === key;
            return (
              <button key={key} type="button"
                aria-current={active ? 'page' : undefined}
                aria-label={aria}
                aria-disabled={isDisabled ? true : undefined}
                onClick={() => { if (isDisabled) { setTab('session'); return; } setTab(key); }}
                title={isDisabled ? 'Najpierw dodaj graczy do sesji' : label}
                className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 text-xs font-medium transition-colors border-t-2
                  ${active ? 'text-rose-400 border-rose-500' : 'border-transparent'}
                  ${isDisabled ? 'text-green-900 cursor-not-allowed' : !active ? 'text-green-800 hover:text-green-400' : ''}`}>
                <span className={`relative ${isDisabled ? 'opacity-30' : ''}`} aria-hidden="true">
                  <Icon />
                  {showFailedSyncBadge && (
                    <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-yellow-500 text-[10px] leading-4 text-black font-bold">
                      {failedCloudSaves.length}
                    </span>
                  )}
                </span>
                <span className={`${isDisabled ? 'opacity-30' : ''} leading-tight`}>{label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
