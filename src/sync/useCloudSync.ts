import { MutableRefObject, useCallback, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import {
  buildDraftHash,
  generateId,
  isoToMs,
  loadLS,
  normalizeDraftSessionPlayers,
  saveLS,
} from '../lib/storage';
import { mapSharedParticipations } from '../lib/historyShared';
import { isMissingLiveSessionTableError } from './errors';
import { logClientEvent } from './telemetry';

const normalizeEmail = (value: unknown) => ((value as string) || '').trim().toLowerCase();

// ─── App-level state shapes ───────────────────────────────────────────────────

export interface CloudPlayer {
  id: string;
  name: string;
  phone: string;
  email: string;
  linked_user_id: string | null;
}

interface CloudSessionPlayer {
  id: string;
  name: string;
  phone: string;
  totalBuyIn: number;
  cashOut: number;
  netBalance: number;
}

interface CloudSession {
  id: string;
  date: string;
  totalPot: number;
  players: CloudSessionPlayer[];
  transfers: { from: string; to: string; amount: number }[];
}

interface SyncMeta {
  lastError: string | null;
  [key: string]: unknown;
}

interface InviteMeta {
  id: string;
  status: string;
  created_at: string;
  responded_at: string | null;
}

interface DraftSessionPlayer {
  playerId: unknown;
  buyIns: number[];
  cashOut: string;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface UseCloudSyncProps {
  user: User | null;
  players: CloudPlayer[];
  skipLiveSessionCloud: boolean;
  setSkipLiveSessionCloud: (v: boolean) => void;
  syncChannelNonce: number;
  setSyncChannelNonce: (fn: (n: number) => number) => void;
  setSyncMeta: (fn: (prev: SyncMeta) => SyncMeta) => void;
  setPlayers: (fn: (prev: CloudPlayer[]) => CloudPlayer[]) => void;
  setHistory: (fn: (prev: CloudSession[]) => CloudSession[]) => void;
  setSharedHistory: (v: CloudSession[]) => void;
  setPendingInvites: (v: unknown[]) => void;
  setOutgoingInvites: (v: unknown[]) => void;
  setOutgoingInviteMetaByEmail: (v: Record<string, InviteMeta>) => void;
  setAccountByEmail: (v: Record<string, boolean>) => void;
  setDefaultBuyIn: (v: number) => void;
  setSessionPlayers: (v: DraftSessionPlayer[]) => void;
  sessionPlayersRef: MutableRefObject<DraftSessionPlayer[]>;
  defaultBuyInRef: MutableRefObject<number>;
  lastDraftHashRef: MutableRefObject<string | null>;
  lastMergedLiveUpdatedAtRef: MutableRefObject<string | null>;
  applyingRemoteSessionRef: MutableRefObject<boolean>;
  pendingPlayerIdsRef: MutableRefObject<Set<string>>;
  failedCloudSaves: { sessionId: string }[];
  notifyCloudFailure: (msg: string) => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Odświeżanie stanu z Supabase, merge live draft, Realtime + polling.
 */
export function useCloudSync({
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
  pendingPlayerIdsRef,
  failedCloudSaves,
  notifyCloudFailure,
}: UseCloudSyncProps) {
  useEffect(() => {
    lastMergedLiveUpdatedAtRef.current = null;
    setSkipLiveSessionCloud(false);
  }, [user?.id]);

  const refreshCloudData = useCallback(async () => {
    if (!user) return;
    const [playersRes, sessionsRes, sharedRes, invitesRes] = await Promise.all([
      supabase.from('players').select('*').eq('owner_id', user.id).order('created_at'),
      supabase
        .from('sessions')
        .select(
          'id, played_at, total_pot, session_players(player_id, player_name, total_buy_in, cash_out, net_balance), transfers(from_name, to_name, amount)'
        )
        .eq('owner_id', user.id)
        .order('played_at'),
      supabase.from('participations').select('*').eq('user_id', user.id).order('session_date'),
      supabase
        .from('friend_invites')
        .select(
          'id, requester_user_id, requester_player_id, invitee_email, invitee_user_id, status, created_at, responded_at'
        )
        .order('created_at', { ascending: false })
        .limit(400),
    ]);

    let liveData: { default_buy_in: number; session_players: unknown; updated_at: string } | null =
      null;
    let liveError: { message: string } | null = null;

    if (!skipLiveSessionCloud) {
      const liveRes = await supabase
        .from('live_session_state')
        .select('default_buy_in, session_players, updated_at')
        .eq('owner_id', user.id)
        .maybeSingle();
      if (liveRes.error) {
        if (isMissingLiveSessionTableError(liveRes.error)) {
          setSkipLiveSessionCloud(true);
          setSyncMeta(prev => ({ ...prev, lastError: null }));
        } else {
          console.warn('refreshCloudData live_session_state', liveRes.error);
          liveError = liveRes.error;
        }
      } else {
        liveData = liveRes.data;
      }
    }

    if (playersRes.error || sessionsRes.error) {
      console.warn('refreshCloudData players/sessions', playersRes.error, sessionsRes.error);
      try {
        void logClientEvent('error', 'refresh_cloud_failed', {
          players_error: playersRes.error?.message || null,
          players_code: playersRes.error?.code || null,
          sessions_error: sessionsRes.error?.message || null,
          sessions_code: sessionsRes.error?.code || null,
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

    const cloudPlayers: CloudPlayer[] = (pData || []).map(p => ({
      id: p.id,
      name: p.name,
      phone: p.phone || '',
      email: p.email || '',
      linked_user_id: p.linked_user_id || null,
    }));
    setPlayers(prev => {
      const seen = new Set(cloudPlayers.map(p => p.id));
      const pending = pendingPlayerIdsRef.current;
      const extras = prev.filter(p => !seen.has(p.id) && pending.has(p.id));
      return extras.length ? [...cloudPlayers, ...extras] : cloudPlayers;
    });

    type SessionRow = NonNullable<typeof sData>[number];
    const mapSessionRow = (s: SessionRow): CloudSession => ({
      id: s.id,
      date: s.played_at,
      totalPot: s.total_pot / 100,
      players: ((s as { session_players?: unknown[] }).session_players || []).map(
        (sp: unknown) => {
          const row = sp as {
            player_id?: string | null;
            player_name: string;
            total_buy_in: number;
            cash_out: number | null;
            net_balance: number | null;
          };
          return {
            id: row.player_id || generateId(),
            name: row.player_name,
            phone: '',
            totalBuyIn: row.total_buy_in / 100,
            cashOut: row.cash_out != null ? row.cash_out / 100 : 0,
            netBalance: row.net_balance != null ? row.net_balance / 100 : 0,
          };
        }
      ),
      transfers: ((s as { transfers?: unknown[] }).transfers || []).map((t: unknown) => {
        const row = t as { from_name: string; to_name: string; amount: number };
        return { from: row.from_name, to: row.to_name, amount: row.amount / 100 };
      }),
    });

    const cloudHistory = (sData || []).map(mapSessionRow);
    const failedIds = new Set(failedCloudSaves.map(f => f.sessionId));
    setHistory(prev => {
      const ids = new Set(cloudHistory.map(s => s.id));
      const localOnly = prev.filter(
        s => !ids.has(s.id) && !String(s.id).startsWith('shared:') && failedIds.has(s.id)
      );
      if (localOnly.length === 0) return cloudHistory;
      return [...cloudHistory, ...localOnly].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
    });

    if (!sharedRes.error) {
      const sharedSessionIds = Array.from(
        new Set((sharedData || []).map(r => r.session_id).filter(Boolean))
      ) as string[];
      let sharedSessionPlayers: Record<string, unknown>[] = [];
      let sharedTransfers: Record<string, unknown>[] = [];
      if (sharedSessionIds.length) {
        const [spRes, trRes] = await Promise.all([
          supabase
            .from('session_players')
            .select('session_id, player_id, player_name, total_buy_in, cash_out')
            .in('session_id', sharedSessionIds),
          supabase
            .from('transfers')
            .select('session_id, from_name, to_name, amount')
            .in('session_id', sharedSessionIds),
        ]);
        if (!spRes.error && spRes.data) sharedSessionPlayers = spRes.data;
        if (!trRes.error && trRes.data) sharedTransfers = trRes.data;
      }
      setSharedHistory(
        mapSharedParticipations(sharedData || [], sharedSessionPlayers, sharedTransfers)
      );
    }
    if (!invitesRes.error) {
      const myEmail = (user.email || '').trim().toLowerCase();
      const incoming = (invitesData || []).filter(
        inv =>
          inv.status === 'pending' &&
          inv.requester_user_id !== user.id &&
          (inv.invitee_user_id === user.id ||
            (inv.invitee_email || '').trim().toLowerCase() === myEmail)
      );
      setPendingInvites(incoming);
      const outgoing = (invitesData || []).filter(
        inv => inv.requester_user_id === user.id && inv.status !== 'accepted'
      );
      setOutgoingInvites(outgoing);
      const outgoingMap: Record<string, InviteMeta> = {};
      for (const inv of outgoing) {
        const emailKey = normalizeEmail(inv.invitee_email);
        if (!emailKey) continue;
        const prev = outgoingMap[emailKey];
        if (
          !prev ||
          new Date(inv.created_at).getTime() > new Date(prev.created_at).getTime()
        ) {
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

    const playerEmails = [
      ...new Set((cloudPlayers || []).map(p => normalizeEmail(p.email)).filter(Boolean)),
    ];
    if (playerEmails.length === 0) {
      setAccountByEmail({});
    } else {
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('email')
        .in('email', playerEmails);
      const existing = new Set((profileRows || []).map(r => normalizeEmail(r.email)));
      const map: Record<string, boolean> = {};
      for (const email of playerEmails) map[email] = existing.has(email);
      setAccountByEmail(map);
    }

    if (liveData && !liveError) {
      const remoteTs = liveData.updated_at;
      const lastPushMeta = loadLS(`poker_live_push_${user.id}`, null) as {
        updated_at: string;
      } | null;
      const lastLocalPushAt = lastPushMeta?.updated_at;
      const pushFailedMeta = loadLS(`poker_live_push_failed_${user.id}`, null) as {
        at: string;
      } | null;
      const hasPendingFailedPush = !!pushFailedMeta?.at;
      const remoteIsNewerThanOurPush =
        !lastLocalPushAt || isoToMs(remoteTs) > isoToMs(lastLocalPushAt);
      const mergedRef = lastMergedLiveUpdatedAtRef.current;
      const remoteNewerThanLastMerge = !mergedRef || isoToMs(remoteTs) > isoToMs(mergedRef);

      if (remoteIsNewerThanOurPush && remoteNewerThanLastMerge) {
        const remoteDefaultBuyIn = Number(liveData.default_buy_in) || 50;
        const remoteSessionPlayers = normalizeDraftSessionPlayers(liveData.session_players);
        const localNorm = normalizeDraftSessionPlayers(sessionPlayersRef.current);
        if (hasPendingFailedPush && localNorm.length > 0) {
          // Lokalne zmiany nie zostały wypchnięte (błąd sieci). Nie nadpisuj;
          // nie aktualizuj lastDraftHashRef — pozwól useLiveSessionPush spróbować ponownie.
          lastMergedLiveUpdatedAtRef.current = remoteTs;
        } else if (!lastLocalPushAt && localNorm.length > 0 && remoteSessionPlayers.length === 0) {
          lastMergedLiveUpdatedAtRef.current = remoteTs;
          lastDraftHashRef.current = buildDraftHash(
            defaultBuyInRef.current,
            sessionPlayersRef.current
          );
          saveLS(`poker_live_push_${user.id}`, { updated_at: remoteTs });
        } else {
          const remoteHash = buildDraftHash(remoteDefaultBuyIn, remoteSessionPlayers);
          applyingRemoteSessionRef.current = true;
          lastMergedLiveUpdatedAtRef.current = remoteTs;
          lastDraftHashRef.current = remoteHash;
          saveLS(`poker_live_push_${user.id}`, { updated_at: remoteTs });
          setDefaultBuyIn(remoteDefaultBuyIn);
          setSessionPlayers(remoteSessionPlayers as DraftSessionPlayer[]);
        }
      }
    }
  }, [user?.id, skipLiveSessionCloud]);

  useEffect(() => {
    if (!user || !skipLiveSessionCloud) return;
    const probe = async () => {
      const { error } = await supabase
        .from('live_session_state')
        .select('owner_id')
        .eq('owner_id', user.id)
        .limit(1)
        .maybeSingle();
      if (!error) setSkipLiveSessionCloud(false);
    };
    const soon = setTimeout(probe, 4000);
    const id = setInterval(probe, 90000);
    return () => {
      clearTimeout(soon);
      clearInterval(id);
    };
  }, [user?.id, skipLiveSessionCloud]);

  useEffect(() => {
    refreshCloudData();
  }, [refreshCloudData]);

  useEffect(() => {
    if (!user) return;
    const ensureSelfPlayer = async () => {
      const { error: rpcErr } = await supabase.rpc('sync_self_player' as never);
      if (rpcErr) {
        const isMissing =
          (rpcErr as { code?: string }).code === 'PGRST202' ||
          (rpcErr as { code?: string }).code === '42883';
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
    let timer: ReturnType<typeof setTimeout> | null = null;
    let inFlight = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectScheduled = false;
    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer);
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
    const scheduleReconnect = (reason: string) => {
      if (reconnectScheduled) return;
      reconnectScheduled = true;
      reconnectTimer = setTimeout(() => {
        reconnectScheduled = false;
        setSyncChannelNonce(n => n + 1);
      }, 1200);
      if (reason) {
        try {
          console.warn('sync channel reconnect scheduled:', reason);
        } catch (_) {}
        try {
          void logClientEvent('warn', 'realtime_reconnect', { reason: String(reason) });
        } catch (_) {}
      }
    };
    let channel = supabase
      .channel(`sync-${user.id}-${syncChannelNonce}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `owner_id=eq.${user.id}` },
        scheduleRefresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sessions', filter: `owner_id=eq.${user.id}` },
        scheduleRefresh
      );
    if (!skipLiveSessionCloud) {
      channel = channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_session_state',
          filter: `owner_id=eq.${user.id}`,
        },
        scheduleRefresh
      );
    }
    channel = channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'participations',
          filter: `user_id=eq.${user.id}`,
        },
        scheduleRefresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friend_invites' },
        scheduleRefresh
      )
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
      if (timer) clearTimeout(timer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearInterval(poll);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisibility);
      supabase.removeChannel(channel);
    };
  }, [user?.id, refreshCloudData, skipLiveSessionCloud, syncChannelNonce]);

  return { refreshCloudData };
}
