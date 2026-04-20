/** Mapowanie udziałów (participations) na wpisy „współdzielonej” historii. */
type Row = Record<string, unknown>;

interface SharedPlayer {
  id: string;
  name: string;
  phone: string;
  totalBuyIn: number;
  cashOut: number;
  netBalance: number;
}

export interface SharedSession {
  id: string;
  date: string;
  totalPot: number;
  players: SharedPlayer[];
  transfers: { from: string; to: string; amount: number }[];
  shared: true;
  sourceSessionId: string;
  sharedNote: string;
}

function normalizeKey(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

export function mapSharedParticipations(
  rows: Row[] | null | undefined,
  sessionPlayersRows?: Row[] | null,
  transferRows?: Row[] | null
): SharedSession[] {
  const bySession = new Map<string, Row>();
  for (const row of rows || []) {
    if (!row?.session_id) continue;
    const key = String(row.session_id);
    const existing = bySession.get(key);
    if (
      !existing ||
      new Date(String(row.session_date)).getTime() >
        new Date(String(existing.session_date)).getTime()
    ) {
      bySession.set(key, row);
    }
  }

  const spBySession = new Map<string, Row[]>();
  for (const sp of sessionPlayersRows || []) {
    if (!sp?.session_id) continue;
    const key = String(sp.session_id);
    if (!spBySession.has(key)) spBySession.set(key, []);
    spBySession.get(key)!.push(sp);
  }

  const trBySession = new Map<string, Row[]>();
  for (const tr of transferRows || []) {
    if (!tr?.session_id) continue;
    const key = String(tr.session_id);
    if (!trBySession.has(key)) trBySession.set(key, []);
    trBySession.get(key)!.push(tr);
  }

  return Array.from(bySession.values()).map(r => {
    const sessionId = String(r.session_id);
    const fullSp = spBySession.get(sessionId);
    const fullTr = trBySession.get(sessionId);

    let players: SharedPlayer[];
    if (fullSp && fullSp.length > 0) {
      players = fullSp.map(sp => {
        const totalBuyIn = ((sp.total_buy_in as number) || 0) / 100;
        const cashOut = ((sp.cash_out as number) || 0) / 100;
        const name = (sp.player_name as string) || '?';
        return {
          id: `shared-player:${normalizeKey(name)}`,
          name,
          phone: '',
          totalBuyIn,
          cashOut,
          netBalance: cashOut - totalBuyIn,
        };
      });
    } else {
      const totalBuyIn = ((r.total_buy_in as number) || 0) / 100;
      const cashOut = ((r.cash_out as number) || 0) / 100;
      const name = (r.player_name as string) || 'Połączony gracz';
      players = [
        {
          id: `shared-player:${normalizeKey(name)}`,
          name,
          phone: '',
          totalBuyIn,
          cashOut,
          netBalance: cashOut - totalBuyIn,
        },
      ];
    }

    const transfers = (fullTr || []).map(tr => ({
      from: String(tr.from_name ?? ''),
      to: String(tr.to_name ?? ''),
      amount: ((tr.amount as number) || 0) / 100,
    }));

    return {
      id: `shared:${sessionId}`,
      date: (r.session_date as string) || '',
      totalPot: ((r.total_pot as number) || 0) / 100,
      players,
      transfers,
      shared: true,
      sourceSessionId: sessionId,
      sharedNote:
        fullSp && fullSp.length > 0
          ? 'Sesja u znajomego — podgląd pełnej listy graczy i przelewów.'
          : 'Twój wynik w sesji u innego gracza — pełna lista i przelewy są u organizatora.',
    };
  });
}
