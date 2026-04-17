// @ts-nocheck
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { plnToCents, settleDebts, formatPln } from './lib/settlement';
import { supabase } from './lib/supabase';
import {
  FAILED_CLOUD_SAVES_KEY,
  SYNC_META_KEY,
  ONBOARDING_KEY,
} from './app/keys';
import { persistSessionSaveCloud, persistSessionUpdateCloud } from './sync/persistSession';
import {
  isFriendLinkRpcMissing,
  sanitizeSyncMeta,
  summarizeSyncError,
  formatSyncStamp,
  isSessionPlayerFkError,
} from './sync/errors';
import { logClientEvent } from './sync/telemetry';
import { useCloudSync } from './sync/useCloudSync';
import { useLiveSessionPush } from './sync/useLiveSessionPush';
import {
  loadLS,
  saveLS,
  generateId,
  useDebouncedLocalStorage,
  buildDraftHash,
} from './lib/storage';
import { getTotalBuyIn, normalizePhoneDigits } from './lib/format';
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

  const { refreshCloudData } = useCloudSync({
    user,
    players,
    skipLiveSessionCloud,
    setSkipLiveSessionCloud,
    syncChannelNonce,
    setSyncChannelNonce,
    setSyncMeta,
    setPlayers,
    setHistory,
    setSharedHistory,
    setPendingInvites,
    setOutgoingInvites,
    setOutgoingInviteMetaByEmail,
    setAccountByEmail,
    setDefaultBuyIn,
    setSessionPlayers,
    sessionPlayersRef,
    defaultBuyInRef,
    lastDraftHashRef,
    lastMergedLiveUpdatedAtRef,
    applyingRemoteSessionRef,
    notifyCloudFailure,
  });

  useLiveSessionPush({
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
  });

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

  const retryFailedSaves = async () => {
    if (!user || failedCloudSaves.length === 0 || retryingFailedSaves) return;
    setRetryingFailedSaves(true);
    recordSyncAttempt();
    let success = 0;
    let failed = 0;
    let lastErr = null;
    for (const item of failedCloudSaves) {
      try {
        await persistSessionSaveCloud(item.sessionRow, item.sessionPlayersRows, item.transferRows, item.participationRows, setCloudBanner);
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
        await persistSessionSaveCloud(sessionRow, sessionPlayersRows, transferRows, participationRows, setCloudBanner);
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
      await persistSessionUpdateCloud(sessionRow, sessionPlayersRows, transferRows, participationRows, setCloudBanner);
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
