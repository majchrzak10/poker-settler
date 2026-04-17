// @ts-nocheck
import React from 'react';
import { plnToCents, settleDebts, formatPln } from '../../lib/settlement';

export function calculateAllTimeStats(history) {
  const map = history.reduce((acc, session) => {
    for (const p of session.players) {
      if (!acc[p.id])
        acc[p.id] = {
          id: p.id,
          name: p.name,
          gamesPlayed: 0,
          allTimeBuyIn: 0,
          allTimeCashOut: 0,
          totalNetBalance: 0,
        };
      acc[p.id].gamesPlayed += 1;
      acc[p.id].allTimeBuyIn += p.totalBuyIn;
      acc[p.id].allTimeCashOut += p.cashOut;
      acc[p.id].totalNetBalance += p.netBalance;
    }
    return acc;
  }, {});
  return Object.values(map).sort((a, b) => b.totalNetBalance - a.totalNetBalance);
}

export function recalculateSession(session, updatedPlayers) {
  const players = updatedPlayers.map(p => ({
    ...p,
    netBalance: (plnToCents(p.cashOut) - plnToCents(p.totalBuyIn)) / 100,
  }));
  const totalPot = players.reduce((sum, p) => sum + plnToCents(p.totalBuyIn), 0) / 100;
  const entries = players.map(p => ({
    name: p.name,
    phone: p.phone ?? '',
    cents: plnToCents(p.cashOut) - plnToCents(p.totalBuyIn),
  }));
  const transfers = settleDebts(entries);
  return { ...session, totalPot, players, transfers };
}

export function NetBadge({ value }) {
  if (value > 0) return <span className="font-bold text-green-500">+{formatPln(value)} PLN</span>;
  if (value < 0) return <span className="font-bold text-red-500">−{formatPln(-value)} PLN</span>;
  return <span className="font-bold text-green-200/55 tabular-nums">{formatPln(0)} PLN</span>;
}

export const MEDALS = ['🥇', '🥈', '🥉'];
export const PERIODS = [
  { label: '5 gier', value: 5 },
  { label: '10 gier', value: 10 },
  { label: '15 gier', value: 15 },
  { label: 'All time', value: null },
];
