// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { pluralPL, formatPln } from '../../lib/settlement';
import { formatPhone, formatDate } from '../../lib/format';
import { summarizeSyncError } from '../../sync/errors';
import { NetBadge } from '../history/historyUtils';
import { IconRefresh, IconPencil } from '../../ui/icons';

export function ProfileView({ user, accountProfile, reloadAccountProfile, history, players, pendingInvites, outgoingInvites, onAcceptInvite, onRejectInvite, onCancelInvite, onUnlinkPlayer, onSignOut, onRefresh, onRenameSelf, refreshBusy, syncMeta, onRetrySyncFailed, retryingFailedSaves, failedCloudSavesCount }) {
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameSaveError, setNameSaveError] = useState('');
  const [myGames, setMyGames] = useState([]);
  const [editingPhone, setEditingPhone] = useState(false);
  const [draftPhone, setDraftPhone] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneSaveError, setPhoneSaveError] = useState('');
  const [inviteBusyId, setInviteBusyId] = useState(null);
  const [inviteMsg, setInviteMsg] = useState('');
  const [showSyncDetails, setShowSyncDetails] = useState(false);

  useEffect(() => {
    supabase.from('participations').select('*').eq('user_id', user.id).order('session_date', { ascending: false }).then(({ data }) => {
      if (data) setMyGames(data);
    });
    supabase.from('profiles').update({ email: (user.email || '').trim().toLowerCase() }).eq('id', user.id);
  }, [user.id]);

  useEffect(() => {
    if (!accountProfile) return;
    setDraftName(accountProfile.display_name || user.email?.split('@')[0] || '');
    setDraftPhone(accountProfile.phone ? formatPhone(accountProfile.phone) : '');
  }, [accountProfile, user.email]);

  const buildProfilePayload = (patch = {}) => {
    const safeName = (patch.display_name ?? draftName ?? accountProfile?.display_name ?? user.email?.split('@')[0] ?? 'Gracz').trim() || 'Gracz';
    const safeEmailRaw = (accountProfile?.email ?? user.email ?? '').trim().toLowerCase();
    const safePhoneRaw = patch.phone !== undefined
      ? patch.phone
      : (draftPhone ? draftPhone.replace(/\s/g, '') : (accountProfile?.phone ?? null));
    const safePhone = safePhoneRaw ? String(safePhoneRaw).replace(/\s/g, '') : null;
    return {
      id: user.id,
      display_name: safeName,
      email: safeEmailRaw || null,
      phone: safePhone,
    };
  };

  const persistProfilePatch = async (patch = {}) => {
    const payload = buildProfilePayload(patch);
    const { error: updateErr } = await supabase.from('profiles').update(payload).eq('id', user.id);
    if (!updateErr) return { error: null, payload };
    const { error: upsertErr } = await supabase.from('profiles').upsert(payload);
    return { error: upsertErr, payload };
  };

  const saveDisplayName = async () => {
    if (!draftName.trim()) return;
    setSavingName(true);
    setNameSaveError('');
    const nextName = draftName.trim();
    const { error } = await persistProfilePatch({ display_name: nextName });
    setSavingName(false);
    if (error) {
      setNameSaveError('Nie udało się zapisać. Spróbuj ponownie.');
      return;
    }
    setEditingName(false);
    if (onRenameSelf) await onRenameSelf(nextName);
    await reloadAccountProfile();
    if (onRefresh) await onRefresh();
  };

  const savePhone = async () => {
    setSavingPhone(true);
    setPhoneSaveError('');
    const digits = draftPhone.replace(/\s/g, '') || null;
    const { error } = await persistProfilePatch({ phone: digits });
    setSavingPhone(false);
    if (error) {
      const hint = (error.message || '').replace(/\s+/g, ' ').trim();
      setPhoneSaveError(hint ? hint.slice(0, 200) : 'Nie udało się zapisać numeru. Spróbuj ponownie.');
      return;
    }
    await supabase.from('players').update({ phone: digits }).eq('owner_id', user.id).eq('linked_user_id', user.id);
    setEditingPhone(false);
    await reloadAccountProfile();
    if (onRefresh) await onRefresh();
  };

  const totalMyGamesBalance = useMemo(
    () => myGames.reduce((sum, g) => sum + (g.net_balance || 0), 0) / 100,
    [myGames]
  );

  const displayName = accountProfile?.display_name || user.email?.split('@')[0] || 'Gracz';

  return (
    <div className="p-4 space-y-5 pb-6">
      <div className="px-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-white tracking-tight">Profil</h2>
          <button
            onClick={onRefresh}
            disabled={refreshBusy}
            title="Odśwież dane z chmury"
            className="text-xs border border-green-800 bg-black/30 hover:bg-black/50 disabled:opacity-40 rounded-lg px-2.5 py-1.5 text-green-200/80 flex items-center gap-1.5"
          >
            <IconRefresh />
            {refreshBusy ? 'Sync...' : 'Sync'}
          </button>
        </div>
        <p className="text-xs text-green-200/55 mt-0.5">Konto i synchronizacja</p>
        <div className="mt-2 inline-flex items-center gap-2 text-xs text-emerald-300 bg-emerald-900/20 border border-emerald-800 rounded-lg px-2.5 py-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
          Synchronizacja OK
        </div>
      </div>
      <div className="bg-black/30 border border-green-900 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-rose-800 flex items-center justify-center text-2xl font-bold text-white shrink-0">
            {displayName[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-bold text-white text-lg truncate">{displayName}</p>
              {!editingName && (
                <button onClick={() => { setEditingName(true); setNameSaveError(''); }} className="text-green-700 hover:text-green-300 transition-colors shrink-0">
                  <IconPencil size={14} />
                </button>
              )}
            </div>
            <div className="mt-0.5">
              <p className="text-xs text-green-200/50 truncate">{accountProfile?.email || user.email}</p>
              <p className="text-[11px] text-green-200/35">Email konta jest stały po rejestracji.</p>
            </div>
            {!editingPhone ? (
              <div className="flex items-center gap-1.5 mt-0.5">
                <p className="text-xs text-green-200/40 truncate">
                  {accountProfile?.phone ? formatPhone(accountProfile.phone) : 'Brak numeru telefonu'}
                </p>
                <button onClick={() => { setEditingPhone(true); setPhoneSaveError(''); }}
                  className="text-green-800 hover:text-green-400 transition-colors shrink-0">
                  <IconPencil />
                </button>
              </div>
            ) : (
              <div className="mt-1 space-y-1">
                <div className="flex gap-2 items-center">
                  <input value={draftPhone} onChange={e => { setDraftPhone(formatPhone(e.target.value)); setPhoneSaveError(''); }}
                    type="tel" inputMode="numeric" maxLength={11} autoFocus placeholder="Numer telefonu"
                    className="flex-1 bg-black/40 rounded-xl px-3 py-1.5 text-sm text-white border border-green-800 focus:outline-none focus:border-rose-600 transition-colors" />
                  <button onClick={savePhone} disabled={savingPhone}
                    className="shrink-0 text-xs bg-rose-800 hover:bg-rose-900 disabled:opacity-40 rounded-xl px-3 py-1.5 font-semibold transition-colors">
                    {savingPhone ? '...' : 'Zapisz'}
                  </button>
                  <button onClick={() => { setEditingPhone(false); setDraftPhone(accountProfile?.phone ? formatPhone(accountProfile.phone) : ''); }}
                    className="shrink-0 text-green-200/50 hover:text-white transition-colors px-1">✕</button>
                </div>
                {phoneSaveError && <p className="text-xs text-rose-400 px-1">{phoneSaveError}</p>}
              </div>
            )}
          </div>
          <button onClick={onSignOut}
            className="shrink-0 text-xs text-rose-400 border border-rose-900/50 hover:bg-rose-900/30 px-3 py-2 rounded-xl transition-colors">
            Wyloguj
          </button>
        </div>
        {editingName && (
          <div className="space-y-1 pt-1">
            <div className="flex gap-2 items-center">
              <input value={draftName} onChange={e => { setDraftName(e.target.value); setNameSaveError(''); }} autoFocus
                className="flex-1 bg-black/40 rounded-xl px-3 py-2 text-sm text-white border border-green-800 focus:outline-none focus:border-rose-600 transition-colors" />
              <button onClick={saveDisplayName} disabled={savingName || !draftName.trim()}
                className="shrink-0 text-sm bg-rose-800 hover:bg-rose-900 disabled:opacity-40 rounded-xl px-4 py-2 font-semibold transition-colors">
                {savingName ? '...' : 'Zapisz'}
              </button>
              <button onClick={() => { setEditingName(false); setDraftName(accountProfile?.display_name || user.email?.split('@')[0] || ''); setNameSaveError(''); }}
                className="shrink-0 text-green-200/50 hover:text-white transition-colors px-1">✕</button>
            </div>
            {nameSaveError && <p className="text-xs text-rose-400 px-1">{nameSaveError}</p>}
          </div>
        )}
        {syncMeta?.lastError && (
          <div className="space-y-1">
            <p className="text-xs text-rose-300">{summarizeSyncError(syncMeta.lastError)}</p>
            <button
              type="button"
              onClick={() => setShowSyncDetails(v => !v)}
              className="text-[11px] text-green-300/70 hover:text-green-200 underline"
            >
              {showSyncDetails ? 'Ukryj szczegóły' : 'Pokaż szczegóły'}
            </button>
            {showSyncDetails && <p className="text-[11px] text-rose-300/85 break-words">{syncMeta.lastError}</p>}
          </div>
        )}
      </div>

      {(syncMeta?.lastError || failedCloudSavesCount > 0) && (
        <div className="bg-amber-950/35 border border-amber-800/45 rounded-2xl p-4 space-y-2">
          <p className="text-xs font-semibold text-amber-200/90">Uwaga — synchronizacja sesji</p>
          {syncMeta?.lastError && <p className="text-xs text-rose-300/95 break-words">{summarizeSyncError(syncMeta.lastError)}</p>}
          {failedCloudSavesCount > 0 && (
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs text-amber-100/85">{failedCloudSavesCount} {pluralPL(failedCloudSavesCount, 'sesja nie doszła do chmury', 'sesje nie doszły do chmury', 'sesji nie doszło do chmury')}.</p>
              <button type="button" onClick={onRetrySyncFailed} disabled={retryingFailedSaves}
                className="text-xs bg-amber-800 hover:bg-amber-700 disabled:opacity-50 rounded-lg px-3 py-1.5 font-semibold transition-colors shrink-0">
                {retryingFailedSaves ? '...' : 'Ponów zapis'}
              </button>
            </div>
          )}
        </div>
      )}
      <p className="text-[11px] text-green-200/35 px-1">Konto i historia sesji są przechowywane w chmurze po zalogowaniu.</p>

      <div className="bg-black/30 border border-green-900 rounded-2xl p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Zaproszenia do znajomych</h3>
          <p className="text-xs text-green-200/50 mt-0.5">Akceptuj zaproszenia, aby połączyć konta automatycznie.</p>
        </div>
        {(pendingInvites || []).length === 0 ? (
          <p className="text-xs text-green-200/45">Brak oczekujących zaproszeń.</p>
        ) : (pendingInvites || []).map(invite => (
          <div key={invite.id} className="rounded-xl border border-green-900/80 bg-black/25 p-3">
            <p className="text-sm text-white">Zaproszenie dla: <span className="text-emerald-300">{invite.invitee_email}</span></p>
            <p className="text-xs text-green-200/45 mt-1">Wysłane: {formatDate(invite.created_at)}</p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={async () => {
                  setInviteBusyId(invite.id);
                  setInviteMsg('');
                  const err = await onAcceptInvite(invite.id);
                  setInviteBusyId(null);
                  setInviteMsg(err ? err : 'Zaproszenie zaakceptowane.');
                }}
                disabled={inviteBusyId === invite.id}
                className="text-xs bg-emerald-800 hover:bg-emerald-700 disabled:opacity-40 rounded-xl px-3 py-2 font-semibold transition-colors"
              >
                Akceptuj
              </button>
              <button
                onClick={async () => {
                  setInviteBusyId(invite.id);
                  setInviteMsg('');
                  const err = await onRejectInvite(invite.id);
                  setInviteBusyId(null);
                  setInviteMsg(err ? err : 'Zaproszenie odrzucone.');
                }}
                disabled={inviteBusyId === invite.id}
                className="text-xs bg-rose-900/50 hover:bg-rose-800 border border-rose-800 text-rose-300 rounded-xl px-3 py-2 transition-colors"
              >
                Odrzuć
              </button>
            </div>
          </div>
        ))}
        {inviteMsg && <p className={`text-xs ${inviteMsg.includes('zaakceptowane') ? 'text-emerald-400' : inviteMsg.includes('odrzucone') ? 'text-green-300/70' : 'text-rose-400'}`}>{inviteMsg}</p>}
      </div>

      <div className="bg-black/30 border border-green-900 rounded-2xl p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Wysłane zaproszenia</h3>
          <p className="text-xs text-green-200/50 mt-0.5">Statusy relacji: invited / accepted / rejected / revoked.</p>
        </div>
        {(outgoingInvites || []).length === 0 ? (
          <p className="text-xs text-green-200/45">Brak wysłanych zaproszeń.</p>
        ) : (outgoingInvites || []).map(invite => (
          <div key={invite.id} className="rounded-xl border border-green-900/80 bg-black/25 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-white truncate">{invite.invitee_email}</p>
              <span className="text-[10px] border rounded-md px-1.5 py-0.5 text-green-200/80 border-green-800 bg-black/30">
                {invite.status}
              </span>
            </div>
            <p className="text-xs text-green-200/45">
              Wysłane: {formatDate(invite.created_at)}
              {invite.responded_at ? ` · Odpowiedź: ${formatDate(invite.responded_at)}` : ''}
            </p>
            {invite.status === 'pending' && (
              <button
                onClick={async () => {
                  setInviteBusyId(invite.id);
                  setInviteMsg('');
                  const err = await onCancelInvite(invite.id);
                  setInviteBusyId(null);
                  setInviteMsg(err ? err : 'Zaproszenie cofnięte.');
                }}
                disabled={inviteBusyId === invite.id}
                className="text-xs bg-orange-900/45 hover:bg-orange-800 border border-orange-800 text-orange-200 rounded-xl px-3 py-2 transition-colors"
              >
                {inviteBusyId === invite.id ? '...' : 'Cofnij zaproszenie'}
              </button>
            )}
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-bold text-white tracking-tight mb-3">Moje gry ({myGames.length})</h2>
        {myGames.length > 0 && (
          <div className={`rounded-2xl border p-4 mb-3 flex items-center justify-between ${totalMyGamesBalance > 0 ? 'bg-emerald-900/20 border-emerald-800' : totalMyGamesBalance < 0 ? 'bg-red-900/20 border-red-800/60' : 'bg-black/30 border-green-900'}`}>
            <div>
              <p className="text-xs text-green-200/60 uppercase tracking-wider font-medium">Łączny bilans</p>
              <p className="text-xs text-green-200/40 mt-0.5">{myGames.length} {pluralPL(myGames.length, 'gra', 'gry', 'gier')} jako uczestnik</p>
            </div>
            <NetBadge value={totalMyGamesBalance} />
          </div>
        )}
        {myGames.length === 0 ? (
          <div className="text-center py-10 bg-black/20 rounded-2xl border border-dashed border-green-900">
            <p className="text-green-200/50 text-sm">Brak gier.</p>
            <p className="text-green-200/45 text-xs mt-1">Organizator musi połączyć Cię z kontem.</p>
          </div>
        ) : myGames.map(g => {
          const net = g.net_balance != null ? g.net_balance / 100 : null;
          const buyIn = g.total_buy_in / 100;
          const cashOut = g.cash_out != null ? g.cash_out / 100 : null;
          const date = new Date(g.session_date).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
          return (
            <div key={g.id} className="bg-black/30 border border-green-900 rounded-2xl px-4 py-3 flex items-center gap-3 mb-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm">{date}</p>
                <p className="text-xs text-green-200/55 tabular-nums">Pula: <span className="text-yellow-400">{formatPln(g.total_pot / 100)} PLN</span> · Buy-in: {formatPln(buyIn)} PLN</p>
              </div>
              {net != null ? <NetBadge value={net} /> : <span className="text-xs text-green-200/55">–</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
