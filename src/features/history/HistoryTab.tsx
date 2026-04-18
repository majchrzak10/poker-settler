import { useState, useMemo } from 'react';
import type { ChangeEvent } from 'react';
import { pluralPL, formatPln, plnToCents } from '../../lib/settlement';
import { formatDate } from '../../lib/format';
import { calculateAllTimeStats, recalculateSession, NetBadge, MEDALS, PERIODS } from './historyUtils';
import { IconCheck, IconShare, IconChevUp, IconChevDown, IconPencil, IconTrash, IconRefresh, IconX, IconArrow, IconPhone } from '../../ui/icons';

interface SessionPlayer {
  id: string;
  name: string;
  totalBuyIn: number;
  cashOut: number;
  netBalance: number;
  phone?: string;
  [key: string]: unknown;
}

interface Transfer {
  from: string;
  to: string;
  amount: number;
  toPhone?: string;
}

interface Session {
  id: string;
  date: string;
  totalPot: number;
  players?: SessionPlayer[];
  transfers?: Transfer[];
  shared?: boolean;
  sharedNote?: string;
  [key: string]: unknown;
}

interface HistoryTabProps {
  history: Session[];
  onUpdateSession: (id: string, updated: Session) => Promise<string | null>;
  onDeleteSession: (id: string) => void;
  failedSyncCount: number;
  failedSessionIds: string[];
  onRetryFailedSaves: () => void;
  retryingFailedSaves: boolean;
}

export function HistoryTab({
  history,
  onUpdateSession,
  onDeleteSession,
  failedSyncCount,
  failedSessionIds,
  onRetryFailedSaves,
  retryingFailedSaves,
}: HistoryTabProps) {
  const [period, setPeriod] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingIds, setEditingIds] = useState<Record<string, boolean>>({});
  const [sessionDrafts, setSessionDrafts] = useState<Record<string, SessionPlayer[]>>({});
  const [sessionEditErrors, setSessionEditErrors] = useState<Record<string, string | null>>({});
  const [savingEditId, setSavingEditId] = useState<string | null>(null);
  const [copiedIds, setCopiedIds] = useState<Record<string, boolean>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [archiveLimit, setArchiveLimit] = useState(25);

  const ownedHistoryForStats = useMemo(() => history.filter(s => !s.shared), [history]);
  const filteredHistory = period === null ? ownedHistoryForStats : ownedHistoryForStats.slice(-period);
  const stats = calculateAllTimeStats(filteredHistory);
  const sorted = [...history].reverse();
  const drilldownSessions = sorted;
  const archiveSlice = drilldownSessions.slice(0, archiveLimit);
  const failedSessionIdSet = useMemo(() => new Set(failedSessionIds), [failedSessionIds]);

  const enterEdit = (session: Session) => {
    setSessionDrafts(prev => ({ ...prev, [session.id]: (session.players ?? []).map(p => ({ ...p })) }));
    setEditingIds(prev => ({ ...prev, [session.id]: true }));
    setSessionEditErrors(prev => ({ ...prev, [session.id]: null }));
  };
  const cancelEdit = (id: string) => {
    setSessionDrafts(prev => { const n = { ...prev }; delete n[id]; return n; });
    setEditingIds(prev => { const n = { ...prev }; delete n[id]; return n; });
    setSessionEditErrors(prev => { const n = { ...prev }; delete n[id]; return n; });
  };
  const updateDraft = (sessionId: string, playerId: string, field: 'totalBuyIn' | 'cashOut', raw: string) => {
    const value = Math.max(0, parseFloat(raw.replace(/[^0-9.]/g, '')) || 0);
    setSessionDrafts(prev => ({ ...prev, [sessionId]: (prev[sessionId] ?? []).map(p => p.id === playerId ? { ...p, [field]: value } : p) }));
  };
  const confirmEdit = async (session: Session) => {
    const draft = sessionDrafts[session.id];
    if (!draft) return;
    setSessionEditErrors(prev => ({ ...prev, [session.id]: null }));
    setSavingEditId(session.id);
    const err = await onUpdateSession(session.id, recalculateSession(session, draft) as Session);
    setSavingEditId(null);
    if (err) {
      setSessionEditErrors(prev => ({ ...prev, [session.id]: err }));
      return;
    }
    cancelEdit(session.id);
  };
  const shareSession = async (session: Session) => {
    const date = new Date(session.date).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const playerLines = [...(session.players ?? [])].sort((a, b) => b.netBalance - a.netBalance).map(p => {
      const emoji = p.netBalance > 0 ? '🟢' : p.netBalance < 0 ? '🔴' : '⚪️';
      const sign = p.netBalance > 0 ? '+' : '';
      return `${emoji} ${p.name}: *${sign}${formatPln(p.netBalance)} PLN*`;
    });
    const transfers = session.transfers ?? [];
    const transferLines = transfers.length > 0
      ? transfers.map(t => `• ${t.from} ➜ ${t.to}: *${formatPln(t.amount)} PLN*${t.toPhone ? `  📱 ${t.toPhone}` : ''}`)
      : ['✅ Brak przelewów — wszyscy wyszli na zero!'];
    const text = [`♠️ *Poker Night — ${date}*`, `💰 *Pula: ${formatPln(session.totalPot)} PLN*`, '', '📊 *Wyniki:*', ...playerLines, '', '💸 *Przelewy:*', ...transferLines].join('\n');
    if (navigator.share) { try { await navigator.share({ text }); return; } catch {} }
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIds(prev => ({ ...prev, [session.id]: true }));
      setTimeout(() => setCopiedIds(prev => { const n = { ...prev }; delete n[session.id]; return n; }), 2500);
    } catch {}
  };

  return (
    <div className="p-4 space-y-4">
      {failedSyncCount > 0 && (
        <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-2xl p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-yellow-200/80">
              {failedSyncCount} {pluralPL(failedSyncCount, 'sesja czeka', 'sesje czekają', 'sesji czeka')} na zapis do chmury.
            </p>
            <button onClick={onRetryFailedSaves} disabled={retryingFailedSaves}
              className="text-xs bg-yellow-700 hover:bg-yellow-800 disabled:opacity-50 rounded-lg px-3 py-1.5 font-semibold transition-colors">
              {retryingFailedSaves ? 'Ponawianie...' : 'Ponów zapis'}
            </button>
          </div>
        </div>
      )}
      <div>
        <h2 className="text-lg font-bold text-white tracking-tight">Historia</h2>
        <p className="text-xs text-green-200/55 mt-0.5">{history.length} {pluralPL(history.length, 'sesja', 'sesje', 'sesji')} w archiwum · podsumowanie All time</p>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {PERIODS.map(({ label, value }) => {
          const active = period === value;
          const available = value === null || ownedHistoryForStats.length >= value;
          return (
            <button key={label} onClick={() => { setPeriod(value); setArchiveLimit(25); }} disabled={!available}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${active ? 'bg-rose-800 border-rose-800 text-white' : available ? 'bg-black/30 border-green-800 text-green-200/70 hover:border-green-600 hover:text-green-200' : 'bg-black/10 border-green-900/40 text-green-200/20 cursor-not-allowed'}`}>
              {label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-green-200/60 uppercase tracking-wider px-1">
        {period === null ? 'All time' : `Ostatnie ${Math.min(period, ownedHistoryForStats.length)} ${pluralPL(Math.min(period, ownedHistoryForStats.length), 'gra', 'gry', 'gier')}`}
      </p>

      <div className="space-y-2">
        <p className="text-xs text-green-200/60 uppercase tracking-wider px-1">Bilans graczy</p>
        {stats.length === 0 ? (
          <div className="text-center py-12 bg-black/20 rounded-2xl border border-dashed border-green-900">
            <p className="text-green-200/50 text-sm">Brak danych.</p>
            <p className="text-green-200/30 text-xs mt-1">Zagraj i zapisz pierwszą sesję.</p>
          </div>
        ) : stats.map((s, idx) => {
          return (
            <div key={s.id}
              className="w-full bg-black/30 border rounded-2xl px-4 py-3 flex items-center gap-3 text-left border-green-900">
              <div className="w-8 text-center shrink-0">
                {idx < 3 ? <span className="text-lg">{MEDALS[idx]}</span> : <span className="text-sm text-green-200/40 font-semibold">#{idx + 1}</span>}
              </div>
              <div className="w-9 h-9 rounded-full bg-green-900/70 text-green-200 flex items-center justify-center text-sm font-bold shrink-0">
                {s.name[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm truncate">{s.name}</p>
                <p className="text-xs text-green-200/40">{s.gamesPlayed} {pluralPL(s.gamesPlayed, 'gra', 'gry', 'gier')}</p>
              </div>
              <NetBadge value={s.totalNetBalance} />
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
          <p className="text-xs text-green-200/60 uppercase tracking-wider px-1">Zapisane sesje</p>
          {drilldownSessions.length === 0 ? (
            <div className="text-center py-12 bg-black/20 rounded-2xl border border-dashed border-green-900">
              <p className="text-green-200/50 text-sm">Brak sesji.</p>
              <p className="text-green-200/30 text-xs mt-1">Zakończ i zapisz pierwszą grę.</p>
            </div>
          ) : (
            <>
          {archiveSlice.map(session => {
            const isExpanded = expandedId === session.id;
            const isEditing = !!editingIds[session.id];
            const draft = sessionDrafts[session.id];
            const isCopied = !!copiedIds[session.id];
            const isPendingSync = failedSessionIdSet.has(session.id);
            const isShared = !!session.shared;
            return (
              <div key={session.id} className="bg-black/30 border border-green-900 rounded-2xl overflow-hidden">
                <div className="flex items-center">
                  <button onClick={() => setExpandedId(prev => prev === session.id ? null : session.id)}
                    className="flex-1 flex items-center gap-3 px-4 py-3 hover:bg-black/40 transition-colors text-left min-w-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{formatDate(session.date)}</p>
                      <p className="text-xs text-green-200/50 mt-0.5">
                        Pula: <span className="text-yellow-400 font-semibold tabular-nums">{formatPln(session.totalPot)} PLN</span> · {(session.players ?? []).length} graczy
                      </p>
                      {isPendingSync && <p className="text-[11px] text-yellow-300 mt-0.5">Oczekuje na zapis do chmury</p>}
                      {isShared && (
                        <p className="text-[11px] text-emerald-300/90 mt-0.5 inline-flex items-center gap-1">
                          <span aria-label="info" title={session.sharedNote || 'Sesja współdzielona'}>i</span>
                        </p>
                      )}
                    </div>
                  </button>
                  <button onClick={() => shareSession(session)} disabled={isShared}
                    className={`p-3 transition-colors shrink-0 ${isCopied ? 'text-green-400' : 'text-green-700 hover:text-green-300'} ${isShared ? 'opacity-40 cursor-not-allowed' : ''}`}>
                    {isCopied ? <IconCheck size={16} /> : <IconShare />}
                  </button>
                  <button onClick={() => setExpandedId(prev => prev === session.id ? null : session.id)}
                    className="pr-3 text-green-700 hover:text-green-400 transition-colors shrink-0">
                    {isExpanded ? <IconChevUp /> : <IconChevDown />}
                  </button>
                </div>

                {isExpanded && (
                  <div className="border-t border-green-900 px-4 py-3 space-y-4">
                    {!isEditing && !isShared && (
                      <div className="flex items-center justify-between">
                        <button onClick={() => enterEdit(session)}
                          className="flex items-center gap-1.5 text-xs text-green-400/70 hover:text-green-300 transition-colors">
                          <IconPencil /> Edytuj wyniki
                        </button>
                        {confirmDeleteId === session.id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-rose-400">Na pewno usunąć?</span>
                            <button onClick={() => { onDeleteSession(session.id); setConfirmDeleteId(null); setExpandedId(null); }}
                              className="text-xs bg-rose-800 hover:bg-rose-700 text-white px-2.5 py-1 rounded-lg transition-colors font-semibold">
                              Usuń
                            </button>
                            <button onClick={() => setConfirmDeleteId(null)}
                              className="text-xs text-green-200/50 hover:text-white transition-colors px-1">
                              Anuluj
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDeleteId(session.id)}
                            className="flex items-center gap-1 text-xs text-green-900 hover:text-rose-400 transition-colors">
                            <IconTrash /> Usuń sesję
                          </button>
                        )}
                      </div>
                    )}
                    {!isEditing && isShared && (
                      <p className="text-xs text-emerald-300/80">Ta sesja jest współdzielona przez połączone konto i jest tylko do podglądu.</p>
                    )}
                    <div>
                      <p className="text-xs text-green-200/50 uppercase tracking-wider mb-2">Wyniki graczy</p>
                      {isEditing ? (
                        <div className="space-y-2">
                          {(draft ?? session.players ?? []).map(p => (
                            <div key={p.id} className="bg-black/20 border border-green-900/60 rounded-xl p-3 space-y-2">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-green-900/60 text-green-200 flex items-center justify-center text-xs font-bold shrink-0">
                                  {p.name[0]?.toUpperCase()}
                                </div>
                                <span className="text-sm font-semibold text-white flex-1">{p.name}</span>
                                <span className="text-xs text-green-200/40">bilans: <NetBadge value={(plnToCents(p.cashOut) - plnToCents(p.totalBuyIn)) / 100} /></span>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-xs text-green-200/40 block mb-1">Buy-in (PLN)</label>
                                  <input type="number" min="0" value={p.totalBuyIn}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => updateDraft(session.id, p.id, 'totalBuyIn', e.target.value)}
                                    className="w-full bg-black/40 border border-green-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-600 transition-colors" />
                                </div>
                                <div>
                                  <label className="text-xs text-green-200/40 block mb-1">Cash-out (PLN)</label>
                                  <input type="number" min="0" value={p.cashOut}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => updateDraft(session.id, p.id, 'cashOut', e.target.value)}
                                    className="w-full bg-black/40 border border-green-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-600 transition-colors" />
                                </div>
                              </div>
                            </div>
                          ))}
                          {sessionEditErrors[session.id] && (
                            <p className="text-xs text-rose-400 px-1">{sessionEditErrors[session.id]}</p>
                          )}
                          <div className="flex gap-2 pt-1">
                            <button onClick={() => confirmEdit(session)} disabled={savingEditId === session.id}
                              className="flex-1 flex items-center justify-center gap-1.5 bg-rose-800 hover:bg-rose-900 disabled:opacity-50 rounded-xl py-2.5 text-sm font-semibold transition-colors">
                              <IconRefresh /> {savingEditId === session.id ? 'Zapisywanie...' : 'Przelicz i Zapisz'}
                            </button>
                            <button onClick={() => cancelEdit(session.id)}
                              className="flex items-center justify-center gap-1 bg-black/40 hover:bg-black/60 border border-green-900 rounded-xl px-4 py-2.5 text-sm text-green-200/60 hover:text-white transition-colors">
                              <IconX /> Anuluj
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {(session.players ?? []).map(p => (
                            <div key={p.id} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-green-900/60 text-green-200 flex items-center justify-center text-xs font-bold shrink-0">
                                  {p.name[0]?.toUpperCase()}
                                </div>
                                <span className="text-sm text-white">{p.name}</span>
                              </div>
                              <div className="text-right">
                                <NetBadge value={p.netBalance} />
                                <p className="text-xs text-green-200/55 tabular-nums">{formatPln(p.totalBuyIn)} → {formatPln(p.cashOut)} PLN</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {!isEditing && (
                      (session.transfers ?? []).length > 0 ? (
                        <div>
                          <p className="text-xs text-green-200/50 uppercase tracking-wider mb-2">Przelewy</p>
                          <div className="space-y-1.5">
                            {(session.transfers ?? []).map((t, idx) => (
                              <div key={idx} className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-sm text-white min-w-0">
                                  <span className="truncate max-w-[80px]">{t.from}</span>
                                  <IconArrow />
                                  <span className="truncate max-w-[80px]">{t.to}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-yellow-400 font-semibold text-sm tabular-nums">{formatPln(t.amount)} PLN</span>
                                  {t.toPhone && (
                                    <a href={`tel:${t.toPhone.replace(/\s/g, '')}`} className="text-green-200/60 hover:text-green-200 transition-colors">
                                      <IconPhone />
                                    </a>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : <p className="text-xs text-emerald-400">{isShared ? 'Brak szczegółowych przelewów w widoku współdzielonym.' : '🎉 Wszyscy wyszli na zero — brak przelewów.'}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {drilldownSessions.length > archiveLimit && (
            <button type="button" onClick={() => setArchiveLimit(l => l + 25)}
              className="w-full py-3 text-sm font-medium text-green-200/70 border border-green-900 rounded-2xl hover:bg-black/30 transition-colors">
              Pokaż więcej ({drilldownSessions.length - archiveLimit} pozostało)
            </button>
          )}
            </>
          )}
        </div>
    </div>
  );
}
