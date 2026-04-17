// @ts-nocheck
import React, { useState } from 'react';
import { formatPln } from '../../lib/settlement';
import { IconX, IconMinus, IconPlus, IconChevUp, IconChevDown, IconPlusCircle } from '../../ui/icons';

export function SessionTab({ players, sessionPlayers, defaultBuyIn, totalPot, autoAddMeToSession, onToggleAutoAddMe, onDefaultBuyInChange, onAddBuyIn, onRemoveBuyIn, onRemoveFromSession, onAddToSession, onGoToSettlement }) {
  const [showAdd, setShowAdd] = useState(false);
  const [buyInInput, setBuyInInput] = useState(String(defaultBuyIn));

  const available = players.filter(p => !sessionPlayers.some(sp => sp.playerId === p.id));

  const handleBuyInChange = e => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setBuyInInput(raw);
    const val = parseInt(raw, 10);
    if (!isNaN(val) && val > 0) onDefaultBuyInChange(val);
  };
  const handleBuyInBlur = () => {
    const val = parseInt(buyInInput, 10);
    if (isNaN(val) || val <= 0) setBuyInInput(String(defaultBuyIn));
  };

  return (
    <div className="p-4 space-y-4">
      <div className="px-1">
        <h2 className="text-lg font-bold text-white tracking-tight">Sesja</h2>
        <p className="text-xs text-green-200/55 mt-0.5">Buy-iny i skład przy stole</p>
      </div>
      <div className="bg-gradient-to-br from-green-900/60 to-black/60 border border-green-800/60 rounded-2xl p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-green-200/60 uppercase tracking-wider font-medium">Total Pot</p>
          <p className="text-3xl font-bold text-white mt-1 tabular-nums">{formatPln(totalPot)} <span className="text-base text-green-200/55 font-normal">PLN</span></p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-yellow-400">{sessionPlayers.length}</p>
          <p className="text-xs text-green-200/50">graczy</p>
        </div>
      </div>

      <div className="bg-black/30 border border-green-900 rounded-2xl p-4">
        <label className="text-xs text-green-200/60 uppercase tracking-wider block mb-2">Domyślny Buy-in</label>
        <div className="flex items-center gap-3">
          <input type="number" min="1" value={buyInInput} onChange={handleBuyInChange} onBlur={handleBuyInBlur}
            className="w-28 bg-black/40 border border-green-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-rose-600 transition-colors" />
          <span className="text-green-200/50 text-sm">PLN / wejście</span>
        </div>
        <label className="mt-3 flex items-center justify-between gap-3 text-xs text-green-200/65">
          <span>Automatycznie dodawaj mnie do nowej sesji</span>
          <input
            type="checkbox"
            checked={!!autoAddMeToSession}
            onChange={e => onToggleAutoAddMe?.(e.target.checked)}
            className="accent-rose-700 w-4 h-4"
          />
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-green-200/60 uppercase tracking-wider px-1">W Sesji</p>
        {sessionPlayers.length === 0 ? (
          <div className="text-center py-10 bg-black/20 rounded-2xl border border-dashed border-green-900">
            <p className="text-green-200/50 text-sm">Brak graczy w sesji.</p>
            <p className="text-green-200/45 text-xs mt-1">Dodaj graczy z listy poniżej.</p>
          </div>
        ) : sessionPlayers.map(sp => {
          const player = players.find(p => p.id === sp.playerId);
          if (!player) return null;
          const total = getTotalBuyIn(sp);
          return (
            <div key={sp.playerId} className="bg-black/30 border border-green-900 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-900/70 text-green-200 flex items-center justify-center text-sm font-bold shrink-0">
                  {player.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white truncate">{player.name}</p>
                </div>
                <div className="text-right mr-1 shrink-0">
                  <p className="text-yellow-400 font-bold text-lg tabular-nums">{formatPln(total)}</p>
                  <p className="text-xs text-green-200/50">PLN</p>
                </div>
                <button onClick={() => onRemoveFromSession(sp.playerId)} className="text-green-900 hover:text-rose-400 transition-colors p-1 shrink-0">
                  <IconX />
                </button>
              </div>
              <div className="flex items-stretch rounded-xl overflow-hidden border border-green-900 gap-px bg-green-900">
                <button onClick={() => onRemoveBuyIn(sp.playerId)} disabled={sp.buyIns.length <= 1}
                  className="w-16 flex items-center justify-center bg-black/50 text-white hover:bg-black/70 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <IconMinus />
                </button>
                <div className="flex-1 flex flex-col items-center justify-center py-3 bg-black/30">
                  <p className="font-bold text-white leading-tight">
                    {sp.buyIns.length}<span className="text-green-200/50 font-normal">×</span> <span className="text-yellow-400 tabular-nums">{formatPln(defaultBuyIn)}</span> <span className="text-green-200/50 text-sm font-normal">PLN</span>
                  </p>
                  <p className="text-xs text-green-200/55 mt-0.5">= {formatPln(total)} PLN łącznie</p>
                </div>
                <button onClick={() => onAddBuyIn(sp.playerId)}
                  className="w-16 flex items-center justify-center bg-rose-800 hover:bg-rose-900 text-white transition-colors">
                  <IconPlus size={18} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {available.length > 0 && (
        <div className="bg-black/30 border border-green-900 rounded-2xl overflow-hidden">
          <button onClick={() => setShowAdd(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3.5 text-sm text-green-200 hover:bg-black/40 transition-colors">
            <span className="font-medium">Dodaj gracza do sesji ({available.length})</span>
            {showAdd ? <IconChevUp /> : <IconChevDown />}
          </button>
          {showAdd && (
            <div className="border-t border-green-900">
              {available.map(p => (
                <button key={p.id} onClick={() => { onAddToSession(p.id); if (available.length <= 1) setShowAdd(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-black/40 transition-colors border-b border-green-900 last:border-b-0 text-left">
                  <div className="w-8 h-8 rounded-full bg-green-900/60 text-green-200 flex items-center justify-center text-sm font-bold shrink-0">
                    {p.name[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{p.name}</p>
                    <p className="text-xs text-green-200/50">{p.phone || 'Brak numeru'}</p>
                  </div>
                  <IconPlusCircle />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {sessionPlayers.length >= 2 && (
        <button onClick={onGoToSettlement}
          className="w-full flex items-center justify-center gap-2 bg-rose-800 hover:bg-rose-900 rounded-xl py-4 text-sm font-semibold transition-colors">
          Przejdź do rozliczenia →
        </button>
      )}
    </div>
  );
}
