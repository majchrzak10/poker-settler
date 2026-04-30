import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { formatPhone } from '../../lib/format';
import { IconUserPlus, IconCheck, IconX, IconPlus, IconPencil, IconTrash } from '../../ui/icons';

interface Player {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  linked_user_id: string | null;
}

interface SessionPlayer {
  playerId: string;
}

interface InviteMeta {
  id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  created_at: string;
  responded_at: string | null;
}

interface AccountProfile {
  display_name: string | null;
  phone: string | null;
}

interface PlayersTabProps {
  players: Player[];
  sessionPlayers: SessionPlayer[];
  onAddPlayer: (name: string, phone: string, email: string) => void;
  onUpdatePlayer: (id: string, name: string, phone: string, email: string) => void;
  onRemovePlayer: (id: string) => void;
  onAddToSession: (id: string) => void;
  onUnlinkPlayer: (id: string) => Promise<void>;
  currentUserId: string | null | undefined;
  accountByEmail: Record<string, boolean>;
  outgoingInviteMetaByEmail: Record<string, InviteMeta | null>;
  accountProfile: AccountProfile | null;
  accountEmail: string | null | undefined;
}

export function PlayersTab({
  players,
  sessionPlayers,
  onAddPlayer,
  onUpdatePlayer,
  onRemovePlayer,
  onAddToSession,
  onUnlinkPlayer,
  currentUserId,
  accountByEmail,
  outgoingInviteMetaByEmail,
  accountProfile,
  accountEmail,
}: PlayersTabProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: '', phone: '', email: '' });

  const phoneValid = phone.length === 11;
  const phoneError = phone.length > 0 && phone.length < 11;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase());
  const emailError = email.trim().length > 0 && !emailValid;
  const canSubmit = name.trim().length > 0 && !phoneError && !emailError;

  const draftPhoneDigits = draft.phone.replace(/\D/g, '');
  const draftPhoneValid = draft.phone.length === 11;
  const draftPhoneError = draft.phone.length > 0 && draft.phone.length < 11;
  const draftPhoneOkSelf = draftPhoneDigits.length === 0 || draftPhoneDigits.length === 9;
  const draftEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((draft.email || '').trim().toLowerCase());
  const draftEmailError = (draft.email || '').trim().length > 0 && !draftEmailValid;
  const canSaveDraft = draft.name.trim().length > 0 && !draftPhoneError && !draftEmailError;

  const handlePhoneChange = (e: ChangeEvent<HTMLInputElement>) => setPhone(formatPhone(e.target.value));

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;
    onAddPlayer(name.trim(), phone, email.trim().toLowerCase());
    setName(''); setPhone(''); setEmail('');
  };

  const enterEdit = (p: Player) => {
    const isSelf = p.linked_user_id === currentUserId;
    const playerName = isSelf ? ((accountProfile?.display_name || '').trim() || p.name) : p.name;
    const phoneRaw = isSelf ? (accountProfile?.phone ?? p.phone) : p.phone;
    const emailForRow = isSelf ? (accountEmail || p.email || '') : (p.email || '');
    setEditingId(p.id);
    setDraft({ name: playerName, phone: formatPhone(String(phoneRaw || '')), email: emailForRow });
  };
  const cancelEdit = () => { setEditingId(null); setDraft({ name: '', phone: '', email: '' }); };
  const confirmEdit = (id: string, isSelfPlayer: boolean) => {
    if (isSelfPlayer) {
      const emailNorm = (accountEmail || '').trim().toLowerCase();
      const digits = draft.phone.replace(/\D/g, '');
      if (digits.length > 0 && digits.length !== 9) return;
      if (!draft.name.trim()) return;
      onUpdatePlayer(id, draft.name.trim(), draft.phone, emailNorm);
    } else {
      if (!canSaveDraft) return;
      onUpdatePlayer(id, draft.name.trim(), draft.phone, draft.email.trim().toLowerCase());
    }
    cancelEdit();
  };

  return (
    <div className="p-4 space-y-5">
      <div>
        <h2 className="text-lg font-bold text-white tracking-tight">Gracze</h2>
        <p className="text-xs text-green-200/55 mt-0.5">{players.length} zapisanych · baza na kolejne sesje</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-black/30 rounded-2xl p-4 border border-green-900 space-y-3">
        <input value={name} onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)} placeholder="Imię gracza *"
          className="w-full bg-black/40 rounded-xl px-4 py-3 text-sm text-white placeholder-green-700 border border-green-800 focus:outline-none focus:border-rose-600 transition-colors" />
        <div className="space-y-1">
          <input value={phone} onChange={handlePhoneChange} placeholder="Numer telefonu (opcjonalnie)" type="tel" inputMode="numeric" maxLength={11}
            className={`w-full bg-black/40 rounded-xl px-4 py-3 text-sm text-white placeholder-green-700 border transition-colors focus:outline-none ${phoneError ? 'border-red-500' : 'border-green-800 focus:border-rose-600'}`} />
          {phoneError && <p className="text-xs text-red-400 px-1">Podaj pełny, 9-cyfrowy numer telefonu</p>}
        </div>
        <div className="space-y-1">
          <input value={email} onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} placeholder="Email znajomego (opcjonalnie)" type="email" autoComplete="off"
            className={`w-full bg-black/40 rounded-xl px-4 py-3 text-sm text-white placeholder-green-700 border transition-colors focus:outline-none ${emailError ? 'border-red-500' : 'border-green-800 focus:border-rose-600'}`} />
          {emailError && <p className="text-xs text-red-400 px-1">Podaj poprawny adres email</p>}
          {!emailError && email.trim().length > 0 && <p className="text-xs text-green-300/50 px-1">Jeśli email nie ma konta, gracz zostanie dodany ze statusem „Brak konta" (bez zaproszenia).</p>}
        </div>
        <button type="submit" disabled={!canSubmit}
          className="w-full flex items-center justify-center gap-2 bg-rose-800 hover:bg-rose-900 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl py-3 text-sm font-semibold transition-colors">
          <IconUserPlus /> Dodaj gracza
        </button>
      </form>

      <div className="space-y-2">
        {players.length === 0 ? (
          <div className="text-center py-12 bg-black/20 rounded-2xl border border-dashed border-green-900">
            <p className="text-green-200/50 text-sm">Brak graczy.</p>
            <p className="text-green-200/45 text-xs mt-1">Dodaj stałych bywalców powyżej.</p>
          </div>
        ) : players.map(p => {
          const inSession = sessionPlayers.some(sp => sp.playerId === p.id);
          const isEditing = editingId === p.id;
          const isSelfPlayer = p.linked_user_id === currentUserId;
          const displayName = isSelfPlayer ? ((accountProfile?.display_name || '').trim() || p.name) : p.name;
          const displayPhoneRaw = isSelfPlayer ? (accountProfile?.phone ?? p.phone) : p.phone;
          const displayPhone = displayPhoneRaw ? formatPhone(String(displayPhoneRaw)) : 'Brak numeru';
          const displayEmail = isSelfPlayer ? (accountEmail || '') : ((p.email || '').trim().toLowerCase());
          const emailNorm = (p.email || '').trim().toLowerCase();
          const lookupEmail = isSelfPlayer ? (accountEmail || '').trim().toLowerCase() : emailNorm;
          const hasAccount = lookupEmail ? accountByEmail[lookupEmail] : undefined;
          const inviteMeta = emailNorm ? outgoingInviteMetaByEmail[emailNorm] : null;
          const inviteStatus = inviteMeta?.status || null;
          const statusKey = p.linked_user_id
            ? 'accepted'
            : inviteStatus === 'pending'
              ? 'invited'
              : inviteStatus === 'rejected'
                ? 'rejected'
                : inviteStatus === 'cancelled'
                  ? 'revoked'
                  : inviteStatus === 'accepted'
                    ? 'accepted'
              : hasAccount === false
                ? 'Brak konta'
                : hasAccount === true
                  ? 'Konto aktywne'
                  : 'Niezweryfikowany';
          const statusDotClass = statusKey === 'accepted' ? 'bg-emerald-400' : '';

          return (
            <div key={p.id} className="bg-black/30 rounded-2xl border border-green-900 px-4 py-3">
              {isEditing ? (
                <div className="space-y-2">
                  <input value={draft.name} onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft(d => ({ ...d, name: e.target.value }))}
                    placeholder="Imię gracza" autoFocus
                    className="w-full bg-black/40 rounded-xl px-3 py-2.5 text-sm text-white placeholder-green-700 border border-green-800 focus:outline-none focus:border-rose-600 transition-colors" />
                  <div className="space-y-1">
                    <input value={draft.phone} onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft(d => ({ ...d, phone: formatPhone(e.target.value) }))}
                      placeholder="Numer telefonu" type="tel" inputMode="numeric" maxLength={11}
                      className={`w-full bg-black/40 rounded-xl px-3 py-2.5 text-sm text-white placeholder-green-700 border transition-colors focus:outline-none ${draftPhoneError ? 'border-red-500' : 'border-green-800 focus:border-rose-600'}`} />
                    {draftPhoneError && !isSelfPlayer && <p className="text-xs text-red-400 px-1">Podaj pełny, 9-cyfrowy numer</p>}
                    {isSelfPlayer && draftPhoneDigits.length > 0 && draftPhoneDigits.length !== 9 && (
                      <p className="text-xs text-red-400 px-1">Podaj pełny numer (9 cyfr) lub zostaw puste.</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <input value={isSelfPlayer ? (accountEmail || '') : draft.email} onChange={(e: ChangeEvent<HTMLInputElement>) => !isSelfPlayer && setDraft(d => ({ ...d, email: e.target.value }))}
                      placeholder="Email znajomego" type="email" autoComplete="off" readOnly={isSelfPlayer}
                      className={`w-full bg-black/40 rounded-xl px-3 py-2.5 text-sm text-white placeholder-green-700 border transition-colors focus:outline-none ${!isSelfPlayer && draftEmailError ? 'border-red-500' : 'border-green-800 focus:border-rose-600'} ${isSelfPlayer ? 'opacity-80 cursor-not-allowed' : ''}`} />
                    {!isSelfPlayer && draftEmailError && <p className="text-xs text-red-400 px-1">Podaj poprawny email</p>}
                    {isSelfPlayer && <p className="text-[11px] text-green-200/40 px-1">Email konta jest ustawiany przy rejestracji (jak w Profilu).</p>}
                  </div>
                  <div className="flex gap-2 pt-0.5">
                    <button onClick={() => confirmEdit(p.id, isSelfPlayer)} disabled={isSelfPlayer ? !(draft.name.trim() && draftPhoneOkSelf) : !canSaveDraft}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-rose-800 hover:bg-rose-900 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl py-2 text-sm font-semibold transition-colors">
                      <IconCheck size={14} /> Zapisz
                    </button>
                    <button onClick={cancelEdit}
                      className="flex items-center justify-center gap-1 bg-black/40 hover:bg-black/60 border border-green-900 rounded-xl px-4 py-2 text-sm text-green-200/60 hover:text-white transition-colors">
                      <IconX size={14} /> Anuluj
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-white text-base leading-tight">{displayName}</p>
                        {statusDotClass && (
                          <span
                            className={`inline-block w-2 h-2 rounded-full ${statusDotClass}`}
                            title={statusKey}
                            aria-label={statusKey}
                          />
                        )}
                      </div>
                      <p className="text-xs text-green-300/60">{displayPhone}</p>
                      {displayEmail ? <p className="text-[11px] text-green-300/45 truncate">{displayEmail}</p> : null}
                      {isSelfPlayer && <p className="text-[10px] text-green-200/35">To Twoje konto — imię i numer jak w Profilu.</p>}
                    </div>
                    <button onClick={() => onAddToSession(p.id)} disabled={inSession}
                      className={`shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${inSession ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800 cursor-default' : 'bg-black/30 text-green-200 border-green-800 hover:bg-green-900/50'}`}>
                      {inSession ? <IconCheck /> : <IconPlus />}
                      {inSession ? 'W sesji' : 'Sesja'}
                    </button>
                    {p.linked_user_id && p.linked_user_id !== currentUserId && (
                      <button
                        onClick={async () => { await onUnlinkPlayer(p.id); }}
                        className="shrink-0 text-xs text-rose-300 border border-rose-900/60 hover:bg-rose-900/25 rounded-lg px-2.5 py-1.5 transition-colors"
                        title="Odepnij konto"
                      >
                        Odepnij
                      </button>
                    )}
                    <button onClick={() => enterEdit(p)} className="shrink-0 text-green-700 hover:text-green-300 transition-colors p-1">
                      <IconPencil />
                    </button>
                    <button
                      onClick={() => onRemovePlayer(p.id)}
                      disabled={isSelfPlayer}
                      title={isSelfPlayer ? 'Nie możesz usunąć własnego profilu gracza' : 'Usuń gracza'}
                      className={`shrink-0 transition-colors p-1 ${isSelfPlayer ? 'text-green-900/40 cursor-not-allowed' : 'text-green-900 hover:text-rose-400'}`}
                    >
                      <IconTrash />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── SessionTab ───────────────────────────────────────────────────────────────
