interface CsvSessionPlayer {
  name: string;
  totalBuyIn: number;
  cashOut: number;
  netBalance: number;
  [key: string]: unknown;
}

interface CsvSession {
  id: string;
  date: string;
  totalPot: number;
  players?: CsvSessionPlayer[];
  [key: string]: unknown;
}

function escapeCsv(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatCents(pln: number): string {
  return pln.toFixed(2);
}

export function exportHistoryToCsv(history: CsvSession[]): string {
  const header = ['session_id', 'date', 'player_name', 'total_buy_in', 'cash_out', 'net_balance', 'total_pot'];
  const rows: string[][] = [header];

  for (const session of history) {
    const players = session.players ?? [];
    if (players.length === 0) {
      rows.push([
        escapeCsv(session.id),
        escapeCsv(session.date),
        '',
        '',
        '',
        '',
        escapeCsv(formatCents(session.totalPot)),
      ]);
    } else {
      for (const p of players) {
        rows.push([
          escapeCsv(session.id),
          escapeCsv(session.date),
          escapeCsv(p.name),
          escapeCsv(formatCents(p.totalBuyIn)),
          escapeCsv(formatCents(p.cashOut)),
          escapeCsv(formatCents(p.netBalance)),
          escapeCsv(formatCents(session.totalPot)),
        ]);
      }
    }
  }

  return rows.map(r => r.join(',')).join('\r\n');
}
