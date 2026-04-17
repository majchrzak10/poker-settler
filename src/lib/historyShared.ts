/** Mapowanie udziałów (participations) na wpisy „współdzielonej” historii. */
export function mapSharedParticipations(rows: Record<string, unknown>[] | null | undefined) {
  const bySession = new Map<string, Record<string, unknown>>();
  for (const row of rows || []) {
    if (!row?.session_id) continue;
    const existing = bySession.get(String(row.session_id));
    if (!existing || new Date(String(row.session_date)).getTime() > new Date(String(existing.session_date)).getTime()) {
      bySession.set(String(row.session_id), row);
    }
  }
  return Array.from(bySession.values()).map(r => {
    const totalBuyIn = ((r.total_buy_in as number) || 0) / 100;
    const cashOut = ((r.cash_out as number) || 0) / 100;
    return {
      id: `shared:${r.session_id}`,
      date: r.session_date,
      totalPot: ((r.total_pot as number) || 0) / 100,
      players: [
        {
          id: `shared-player:${r.id}`,
          name: (r.player_name as string) || 'Połączony gracz',
          phone: '',
          totalBuyIn,
          cashOut,
          netBalance: cashOut - totalBuyIn,
        },
      ],
      transfers: [],
      shared: true,
      sourceSessionId: r.session_id,
      sharedNote:
        'Twój wynik w sesji u innego gracza — pełna lista i przelewy są u organizatora.',
    };
  });
}
