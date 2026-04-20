import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { formatPln } from '../../lib/settlement';
import { formatDate } from '../../lib/format';

interface Proposal {
  id: string;
  session_id: string;
  proposer_user_id: string;
  payload: {
    players?: { player_name: string; cash_out: number }[];
    note?: string;
  };
  note: string | null;
  status: string;
  created_at: string;
}

interface Session {
  id: string;
  date: string;
  players?: { id: string; name: string; cashOut: number; totalBuyIn: number }[];
  [key: string]: unknown;
}

interface PendingEditsPanelProps {
  userId: string;
  ownedHistory: Session[];
  onApplied: () => void;
}

export function PendingEditsPanel({ userId, ownedHistory, onApplied }: PendingEditsPanelProps) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const sessionIds = ownedHistory.map(s => s.id);
    if (sessionIds.length === 0) return;
    const { data } = await supabase
      .from('session_edit_proposals')
      .select('*')
      .in('session_id', sessionIds)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    setProposals((data as Proposal[]) ?? []);
  };

  useEffect(() => {
    void load();
  }, [userId, ownedHistory.length]);

  const respond = async (proposalId: string, decision: 'accepted' | 'rejected') => {
    setBusy(proposalId);
    const { error } = await supabase.rpc('respond_session_edit', {
      p_proposal_id: proposalId,
      p_decision: decision,
    });
    setBusy(null);
    if (!error) {
      setProposals(prev => prev.filter(p => p.id !== proposalId));
      if (decision === 'accepted') onApplied();
    }
  };

  if (proposals.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs text-green-200/60 uppercase tracking-wider px-1">Propozycje zmian od gości</p>
      {proposals.map(proposal => {
        const session = ownedHistory.find(s => s.id === proposal.session_id);
        const players = proposal.payload?.players ?? [];
        return (
          <div key={proposal.id} className="bg-amber-950/40 border border-amber-800/50 rounded-2xl px-4 py-3 space-y-3">
            <div>
              <p className="text-sm font-semibold text-amber-200">
                Zmiana w sesji: {session ? formatDate(session.date) : proposal.session_id.slice(0, 8)}
              </p>
              <p className="text-xs text-amber-300/70 mt-0.5">
                {new Date(proposal.created_at).toLocaleDateString('pl-PL')}
              </p>
              {proposal.note && (
                <p className="text-xs text-amber-100/80 mt-1 italic">„{proposal.note}"</p>
              )}
            </div>
            {players.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-amber-300/60 uppercase tracking-wider">Proponowane cash-outy:</p>
                {players.map(p => {
                  const orig = session?.players?.find(sp => sp.name === p.player_name);
                  const origCashOut = orig?.cashOut ?? null;
                  const newCashOut = p.cash_out / 100;
                  const changed = origCashOut !== null && origCashOut !== newCashOut;
                  return (
                    <div key={p.player_name} className="flex items-center justify-between">
                      <span className="text-sm text-white">{p.player_name}</span>
                      <span className={`text-sm tabular-nums ${changed ? 'text-amber-300 font-semibold' : 'text-green-200/60'}`}>
                        {origCashOut !== null && changed && (
                          <span className="line-through text-green-200/40 mr-1">{formatPln(origCashOut)}</span>
                        )}
                        {formatPln(newCashOut)} PLN
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => respond(proposal.id, 'accepted')}
                disabled={!!busy}
                className="flex-1 text-xs bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl py-2 font-semibold transition-colors">
                {busy === proposal.id ? '...' : 'Zaakceptuj'}
              </button>
              <button
                onClick={() => respond(proposal.id, 'rejected')}
                disabled={!!busy}
                className="flex-1 text-xs bg-black/40 hover:bg-black/60 border border-green-900 disabled:opacity-50 text-green-200/60 hover:text-white rounded-xl py-2 transition-colors">
                Odrzuć
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
