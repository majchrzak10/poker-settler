import { useState } from 'react';
import { IconCheck, IconX } from '../../ui/icons';

export interface IncomingInvite {
  id: string;
  requester_user_id: string;
  requester_name: string;
  requester_email: string;
  created_at: string;
}

interface IncomingInvitesCardProps {
  invites: IncomingInvite[];
  onAccept: (id: string) => Promise<string | null>;
  onReject: (id: string) => Promise<string | null>;
}

export function IncomingInvitesCard({ invites, onAccept, onReject }: IncomingInvitesCardProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  if (invites.length === 0) return null;

  const handleAccept = async (id: string) => {
    setBusyId(id);
    setErrorMsg('');
    const err = await onAccept(id);
    setBusyId(null);
    if (err) setErrorMsg(err);
  };

  const handleReject = async (id: string) => {
    setBusyId(id);
    setErrorMsg('');
    const err = await onReject(id);
    setBusyId(null);
    if (err) setErrorMsg(err);
  };

  return (
    <div className="bg-emerald-950/30 border border-emerald-800/60 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-emerald-100 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Zaproszenia do znajomych
        </h3>
        <span className="text-[11px] text-emerald-300/70 tabular-nums">
          {invites.length} {invites.length === 1 ? 'nowe' : 'nowych'}
        </span>
      </div>

      <ul className="space-y-2">
        {invites.map(inv => {
          const isBusy = busyId === inv.id;
          return (
            <li
              key={inv.id}
              className="bg-black/30 rounded-xl border border-emerald-900/40 p-3 space-y-2.5"
            >
              <div className="min-w-0">
                <p className="font-semibold text-white text-sm truncate">{inv.requester_name}</p>
                {inv.requester_email && (
                  <p className="text-[11px] text-emerald-200/55 truncate">{inv.requester_email}</p>
                )}
                <p className="text-xs text-emerald-100/70 mt-0.5">
                  chce być Twoim znajomym w pokerze
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleAccept(inv.id)}
                  disabled={isBusy}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg py-2 text-sm font-semibold text-white transition-colors"
                >
                  <IconCheck size={14} />
                  {isBusy ? '...' : 'Akceptuj'}
                </button>
                <button
                  type="button"
                  onClick={() => handleReject(inv.id)}
                  disabled={isBusy}
                  className="flex items-center justify-center gap-1.5 bg-black/40 hover:bg-rose-950/40 border border-rose-900/50 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-4 py-2 text-sm text-rose-300 transition-colors"
                >
                  <IconX size={14} />
                  Odrzuć
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {errorMsg && <p className="text-xs text-rose-400 px-1">{errorMsg}</p>}
    </div>
  );
}
