import { useState } from 'react';
import { formatPln } from '../../lib/settlement';
import { getTotalBuyIn } from '../../lib/format';
import {
  IconCheck,
  IconCalc,
  IconArrow,
  IconPhone,
  IconSave,
  IconShare,
  IconRefresh,
} from '../../ui/icons';

interface Player {
  id: string;
  name: string;
}

interface SessionPlayer {
  playerId: string;
  buyIns: number[];
  cashOut: string;
}

interface Transaction {
  from: string;
  to: string;
  amount: number;
  toPhone?: string;
}

interface SaveStatus {
  type: 'ok' | 'error';
  message: string;
}

interface SettlementTabProps {
  players: Player[];
  sessionPlayers: SessionPlayer[];
  transactions: Transaction[];
  settled: boolean;
  totalPot: number;
  onSetCashOut: (playerId: string, value: string) => void;
  onCalculate: () => void;
  onResetSession: () => void;
  onSaveAndFinish: () => void;
  savingSession: boolean;
  saveStatus: SaveStatus | null;
}

export function SettlementTab({
  players,
  sessionPlayers,
  transactions,
  settled,
  totalPot,
  onSetCashOut,
  onCalculate,
  onResetSession,
  onSaveAndFinish,
  savingSession,
  saveStatus,
}: SettlementTabProps) {
  const [copied, setCopied] = useState(false);

  const totalCashOut = sessionPlayers.reduce((sum, sp) => {
    const val = parseFloat(sp.cashOut);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const diff = totalPot - totalCashOut;
  const isBalanced = Math.abs(diff) < 0.01 && sessionPlayers.length > 0;
  const allFilled = sessionPlayers.every(sp => sp.cashOut !== '');
  const progress = totalPot > 0 ? Math.min((totalCashOut / totalPot) * 100, 100) : 0;

  const buildReport = () => {
    const date = new Date().toLocaleDateString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const results = sessionPlayers.map(sp => {
      const player = players.find(p => p.id === sp.playerId);
      const buyInTotal = getTotalBuyIn(sp);
      const cashOut = parseFloat(sp.cashOut) || 0;
      const net = cashOut - buyInTotal;
      return `  ${player?.name ?? '?'}: ${net >= 0 ? '+' : ''}${formatPln(net)} PLN`;
    });
    const transferLines =
      transactions.length === 0
        ? ['  Nikt nikomu nie jest winien!']
        : transactions.map(
            t =>
              `  ${t.from} → ${t.to}: ${formatPln(t.amount)} PLN${t.toPhone ? ` (Tel: ${t.toPhone})` : ''}`
          );
    return [
      `♠ Rozliczenie Poker — ${date}`,
      `Pula: ${formatPln(totalPot)} PLN`,
      '',
      'Wyniki:',
      ...results,
      '',
      'Przelewy:',
      ...transferLines,
    ].join('\n');
  };

  const copyReport = async () => {
    const report = buildReport();
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // clipboard unavailable
    }
  };

  if (sessionPlayers.length === 0)
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <p className="text-green-200/50 text-sm">Brak aktywnej sesji.</p>
        <p className="text-green-200/45 text-xs mt-1">Dodaj graczy w zakładce Sesja.</p>
      </div>
    );

  return (
    <div className="p-4 space-y-5">
      <div className="px-1">
        <h2 className="text-lg font-bold text-white tracking-tight">Wyniki</h2>
        <p className="text-xs text-green-200/55 mt-0.5">Cash-outy i minimalna lista przelewów</p>
      </div>
      <div
        className={`rounded-2xl border p-4 transition-colors ${isBalanced ? 'bg-emerald-900/20 border-emerald-800' : allFilled ? 'bg-red-900/20 border-red-800/60' : 'bg-black/30 border-green-900'}`}
      >
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs text-green-200/60 uppercase tracking-wider font-medium">
            Bilans
          </span>
          {isBalanced ? (
            <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold">
              <IconCheck size={12} /> Zbilansowane
            </span>
          ) : allFilled ? (
            <span className="text-xs text-rose-400 font-semibold tabular-nums">
              {diff > 0
                ? `Brakuje ${formatPln(diff)} PLN`
                : `Nadwyżka ${formatPln(Math.abs(diff))} PLN`}
            </span>
          ) : (
            <span className="text-xs text-green-200/55">Uzupełnij cash-outy</span>
          )}
        </div>
        <div className="flex items-end gap-3 text-sm mb-3">
          <div className="flex-1">
            <p className="text-xs text-green-200/55 mb-0.5">Buy-iny (pula)</p>
            <p className="text-xl font-bold text-white tabular-nums">{formatPln(totalPot)} PLN</p>
          </div>
          <div className="text-green-700 pb-1 text-xs">vs</div>
          <div className="flex-1 text-right">
            <p className="text-xs text-green-200/55 mb-0.5">Cash-outy</p>
            <p
              className={`text-xl font-bold tabular-nums ${isBalanced ? 'text-emerald-400' : allFilled ? 'text-rose-400' : 'text-white'}`}
            >
              {formatPln(totalCashOut)} PLN
            </p>
          </div>
        </div>
        <div className="w-full bg-black/40 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${isBalanced ? 'bg-emerald-500' : 'bg-red-500'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-[11px] text-green-200/55 mt-2 leading-snug">
          Suma wpisanych cash-outów powinna być równa sumie buy-inów (puli). Różnica = błąd lub
          brakująca gotówka przy stole.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-green-200/60 uppercase tracking-wider px-1">Cash Out</p>
        {sessionPlayers.map(sp => {
          const player = players.find(p => p.id === sp.playerId);
          if (!player) return null;
          const buyInTotal = getTotalBuyIn(sp);
          const cashOutVal = parseFloat(sp.cashOut);
          const net = isNaN(cashOutVal) ? null : cashOutVal - buyInTotal;
          return (
            <div key={sp.playerId} className="bg-black/30 border border-green-900 rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full bg-green-900/70 text-green-200 flex items-center justify-center text-sm font-bold shrink-0">
                  {player.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">{player.name}</p>
                  <p className="text-xs text-green-300/65">Buy-in: {formatPln(buyInTotal)} PLN</p>
                </div>
                {net !== null && (
                  <div
                    className={`text-sm font-bold tabular-nums ${net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                  >
                    {net >= 0 ? '+' : ''}
                    {formatPln(net)} PLN
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={sp.cashOut}
                  onChange={e => onSetCashOut(sp.playerId, e.target.value)}
                  className="flex-1 bg-black/40 border border-green-800 rounded-xl px-4 py-3 text-white text-base font-medium focus:outline-none focus:border-rose-600 transition-colors"
                />
                <span className="text-green-200/50 text-sm font-medium">PLN</span>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={onCalculate}
        disabled={!allFilled}
        className="w-full flex items-center justify-center gap-2 bg-rose-800 hover:bg-rose-900 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl py-4 text-base font-bold transition-colors"
      >
        <IconCalc /> {isBalanced ? 'Oblicz rozliczenia' : 'Oblicz mimo różnicy'}
      </button>

      {settled && (
        <div className="space-y-3">
          <p className="text-xs text-green-200/60 uppercase tracking-wider px-1">
            Przelewy ({transactions.length})
          </p>
          {transactions.length === 0 ? (
            <div className="bg-emerald-900/20 border border-emerald-800 rounded-2xl p-5 text-center">
              <p className="text-emerald-400 font-semibold text-base">
                🎉 Nikt nikomu nie jest winien!
              </p>
              <p className="text-green-200/50 text-xs mt-1">Wszyscy wyszli na zero.</p>
            </div>
          ) : (
            transactions.map((t, idx) => (
              <div key={idx} className="bg-black/30 border border-green-900 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-semibold text-white text-sm">{t.from}</span>
                  <IconArrow />
                  <span className="font-semibold text-white text-sm">{t.to}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-yellow-400 tabular-nums">
                    {formatPln(t.amount)} PLN
                  </span>
                  {t.toPhone && (
                    <a
                      href={`tel:${t.toPhone.replace(/\s/g, '')}`}
                      className="flex items-center gap-1.5 text-xs text-green-200 bg-black/40 border border-green-800 hover:bg-black/60 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <IconPhone /> {t.toPhone}
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {settled && (
        <div className="space-y-2 pb-4">
          <button
            onClick={onSaveAndFinish}
            disabled={savingSession}
            className="w-full flex items-center justify-center gap-2 bg-rose-800 hover:bg-rose-900 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl py-4 text-base font-bold transition-colors"
          >
            <IconSave /> {savingSession ? 'Zapisywanie...' : 'Zakończ i Zapisz Sesję'}
          </button>
          {saveStatus && (
            <p
              className={`text-xs px-1 ${saveStatus.type === 'error' ? 'text-rose-400' : 'text-emerald-400'}`}
            >
              {saveStatus.message}
            </p>
          )}
          <button
            onClick={copyReport}
            className="w-full flex items-center justify-center gap-2 bg-black/30 hover:bg-black/50 border border-green-900 rounded-xl py-3.5 text-sm font-semibold transition-colors"
          >
            {copied ? <IconCheck /> : <IconShare />} {copied ? 'Skopiowano!' : 'Kopiuj rozliczenie'}
          </button>
          <button
            onClick={onResetSession}
            className="w-full flex items-center justify-center gap-2 bg-rose-950/50 hover:bg-rose-900/50 border border-rose-900/50 rounded-xl py-3.5 text-sm font-semibold text-rose-400 transition-colors"
          >
            <IconRefresh /> Nowa sesja (bez zapisywania)
          </button>
        </div>
      )}
    </div>
  );
}
