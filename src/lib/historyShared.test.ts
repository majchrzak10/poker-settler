import { describe, it, expect } from 'vitest';
import { mapSharedParticipations } from './historyShared';

describe('mapSharedParticipations', () => {
  it('returns [] for empty / null input', () => {
    expect(mapSharedParticipations(null)).toEqual([]);
    expect(mapSharedParticipations([])).toEqual([]);
  });

  it('skips rows without session_id', () => {
    const out = mapSharedParticipations([
      { player_name: 'Anna', total_buy_in: 1000, cash_out: 1500, total_pot: 2500, session_date: '2026-01-01' },
    ]);
    expect(out).toEqual([]);
  });

  it('maps a single participation to my-result-only shared session', () => {
    const out = mapSharedParticipations([
      {
        session_id: 's1',
        player_name: 'Anna',
        total_buy_in: 5000,
        cash_out: 7500,
        total_pot: 20000,
        session_date: '2026-01-15',
      },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('shared:s1');
    expect(out[0].sourceSessionId).toBe('s1');
    expect(out[0].totalPot).toBe(200);
    expect(out[0].players).toEqual([
      {
        id: 'shared-player:anna',
        name: 'Anna',
        phone: '',
        totalBuyIn: 50,
        cashOut: 75,
        netBalance: 25,
      },
    ]);
    expect(out[0].transfers).toEqual([]);
    expect(out[0].sharedNote).toMatch(/u innego gracza/);
  });

  it('prefers full session_players + transfers over my-result-only view', () => {
    const out = mapSharedParticipations(
      [
        {
          session_id: 's1',
          player_name: 'Anna',
          total_buy_in: 5000,
          cash_out: 7500,
          total_pot: 20000,
          session_date: '2026-01-15',
        },
      ],
      [
        { session_id: 's1', player_name: 'Anna', total_buy_in: 5000, cash_out: 7500 },
        { session_id: 's1', player_name: 'Bartek', total_buy_in: 5000, cash_out: 2500 },
      ],
      [
        { session_id: 's1', from_name: 'Bartek', to_name: 'Anna', amount: 2500 },
      ],
    );
    expect(out).toHaveLength(1);
    expect(out[0].players.map(p => p.name)).toEqual(['Anna', 'Bartek']);
    expect(out[0].transfers).toEqual([{ from: 'Bartek', to: 'Anna', amount: 25 }]);
    expect(out[0].sharedNote).toMatch(/u znajomego/);
  });

  it('deduplicates participations per session, keeping the most recent date', () => {
    const out = mapSharedParticipations([
      { session_id: 's1', player_name: 'Anna', total_buy_in: 1000, cash_out: 0, total_pot: 1000, session_date: '2026-01-01T10:00:00Z' },
      { session_id: 's1', player_name: 'Anna', total_buy_in: 2000, cash_out: 500, total_pot: 2500, session_date: '2026-01-01T12:00:00Z' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].players[0].totalBuyIn).toBe(20);
    expect(out[0].totalPot).toBe(25);
  });

  it('coerces missing numeric fields to 0', () => {
    const out = mapSharedParticipations([
      { session_id: 's1', player_name: 'Anna', session_date: '2026-01-15' },
    ]);
    expect(out[0].players[0].totalBuyIn).toBe(0);
    expect(out[0].players[0].cashOut).toBe(0);
    expect(out[0].players[0].netBalance).toBe(0);
    expect(out[0].totalPot).toBe(0);
  });
});
