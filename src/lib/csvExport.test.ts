import { describe, it, expect } from 'vitest';
import { exportHistoryToCsv } from './csvExport';

describe('exportHistoryToCsv', () => {
  it('produces header row', () => {
    const csv = exportHistoryToCsv([]);
    expect(csv).toBe('session_id,date,player_name,total_buy_in,cash_out,net_balance,total_pot');
  });

  it('formats player rows correctly', () => {
    const csv = exportHistoryToCsv([{
      id: 'abc-123',
      date: '2024-01-15',
      totalPot: 200,
      players: [
        { name: 'Anna', totalBuyIn: 100, cashOut: 150, netBalance: 50 },
        { name: 'Bartek', totalBuyIn: 100, cashOut: 50, netBalance: -50 },
      ],
    }]);
    const lines = csv.split('\r\n');
    expect(lines[1]).toBe('abc-123,2024-01-15,Anna,100.00,150.00,50.00,200.00');
    expect(lines[2]).toBe('abc-123,2024-01-15,Bartek,100.00,50.00,-50.00,200.00');
  });

  it('escapes commas in player names', () => {
    const csv = exportHistoryToCsv([{
      id: 'x',
      date: '2024-01-01',
      totalPot: 0,
      players: [{ name: 'Smith, John', totalBuyIn: 0, cashOut: 0, netBalance: 0 }],
    }]);
    expect(csv).toContain('"Smith, John"');
  });

  it('escapes quotes in player names', () => {
    const csv = exportHistoryToCsv([{
      id: 'x',
      date: '2024-01-01',
      totalPot: 0,
      players: [{ name: 'He said "hi"', totalBuyIn: 0, cashOut: 0, netBalance: 0 }],
    }]);
    expect(csv).toContain('"He said ""hi"""');
  });

  it('handles session with no players', () => {
    const csv = exportHistoryToCsv([{ id: 'x', date: '2024-01-01', totalPot: 50 }]);
    const lines = csv.split('\r\n');
    expect(lines.length).toBe(2);
    expect(lines[1].startsWith('x,2024-01-01,,,,,')).toBe(true);
  });
});
