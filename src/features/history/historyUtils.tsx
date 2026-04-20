import { plnToCents, settleDebts, formatPln } from '../../lib/settlement';

interface SessionPlayer {
  id: string;
  name: string;
  totalBuyIn: number;
  cashOut: number;
  netBalance: number;
  phone?: string;
}

interface Session {
  id: string;
  players?: SessionPlayer[];
  [key: string]: unknown;
}

interface StatEntry {
  id: string;
  name: string;
  gamesPlayed: number;
  allTimeBuyIn: number;
  allTimeCashOut: number;
  totalNetBalance: number;
}

export function calculateAllTimeStats(history: Session[]): StatEntry[] {
  const map = history.reduce<Record<string, StatEntry>>((acc, session) => {
    for (const p of session.players ?? []) {
      const key = String(p.name || '').trim().toLowerCase();
      if (!key) continue;
      if (!acc[key])
        acc[key] = {
          id: key,
          name: p.name,
          gamesPlayed: 0,
          allTimeBuyIn: 0,
          allTimeCashOut: 0,
          totalNetBalance: 0,
        };
      acc[key].gamesPlayed += 1;
      acc[key].allTimeBuyIn += p.totalBuyIn;
      acc[key].allTimeCashOut += p.cashOut;
      acc[key].totalNetBalance += p.netBalance;
    }
    return acc;
  }, {});
  return Object.values(map).sort((a, b) => b.totalNetBalance - a.totalNetBalance);
}

interface UpdatablePlayer extends SessionPlayer {
  [key: string]: unknown;
}

export function recalculateSession(session: Session, updatedPlayers: UpdatablePlayer[]) {
  const players = updatedPlayers.map(p => ({
    ...p,
    netBalance: (plnToCents(p.cashOut) - plnToCents(p.totalBuyIn)) / 100,
  }));
  const totalPot = players.reduce((sum, p) => sum + plnToCents(p.totalBuyIn), 0) / 100;
  const entries = players.map(p => ({
    name: p.name,
    phone: (p.phone as string) ?? '',
    cents: plnToCents(p.cashOut) - plnToCents(p.totalBuyIn),
  }));
  const transfers = settleDebts(entries);
  return { ...session, totalPot, players, transfers };
}

export function NetBadge({ value }: { value: number }) {
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
