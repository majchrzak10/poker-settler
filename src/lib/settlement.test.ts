import { describe, it, expect } from 'vitest';
import { plnToCents, settleDebts, pluralPL, formatPln, IMBALANCE_NAME } from './settlement';

describe('settlement', () => {
  it('formatPln uses pl locale', () => {
    expect(formatPln(1234.5)).toMatch(/1[\s ]?234/);
  });

  it('plnToCents rounds to integer grosze', () => {
    expect(plnToCents(10.5)).toBe(1050);
    expect(plnToCents('3.33')).toBe(333);
    expect(plnToCents(NaN)).toBe(0);
  });

  it('plnToCents accepts polish comma decimal', () => {
    expect(plnToCents('50,5')).toBe(5050);
    expect(plnToCents('3,33')).toBe(333);
  });

  it('pluralPL polish rules', () => {
    expect(pluralPL(1, 'a', 'b', 'c')).toBe('a');
    expect(pluralPL(2, 'a', 'b', 'c')).toBe('b');
    expect(pluralPL(5, 'a', 'b', 'c')).toBe('c');
    expect(pluralPL(22, 'a', 'b', 'c')).toBe('b');
    expect(pluralPL(25, 'a', 'b', 'c')).toBe('c');
  });

  it('settleDebts matches creditors and debtors', () => {
    const t = settleDebts([
      { name: 'A', phone: '', cents: -1000 },
      { name: 'B', phone: '', cents: 1000 },
    ]);
    expect(t.length).toBe(1);
    expect(t[0].from).toBe('A');
    expect(t[0].to).toBe('B');
    expect(t[0].amount).toBe(10);
  });

  it('settleDebts three players', () => {
    const t = settleDebts([
      { name: 'A', phone: '', cents: -50 },
      { name: 'B', phone: '', cents: -50 },
      { name: 'C', phone: '', cents: 100 },
    ]);
    const sum = t.reduce((s, x) => s + x.amount, 0);
    expect(sum).toBe(1);
  });

  it('settleDebts returns empty for empty input', () => {
    expect(settleDebts([])).toEqual([]);
  });

  it('settleDebts ignores zero-balance players', () => {
    const t = settleDebts([
      { name: 'A', phone: '', cents: 0 },
      { name: 'B', phone: '', cents: 0 },
    ]);
    expect(t).toEqual([]);
  });

  it('settleDebts is deterministic when debtors tie', () => {
    const t1 = settleDebts([
      { name: 'Anna', cents: -5000 },
      { name: 'Zenon', cents: -5000 },
      { name: 'Marek', cents: 10000 },
    ]);
    const t2 = settleDebts([
      { name: 'Zenon', cents: -5000 },
      { name: 'Anna', cents: -5000 },
      { name: 'Marek', cents: 10000 },
    ]);
    expect(t1).toEqual(t2);
  });

  it('settleDebts injects virtual entry when pool is short (missing cash)', () => {
    // 100 zł buy-in, only 50 zł reported as cash-out -> 50 zł brakuje
    const t = settleDebts([
      { name: 'A', cents: -10000 },
      { name: 'B', cents: 5000 },
    ]);
    expect(t.some(x => x.from === IMBALANCE_NAME || x.to === IMBALANCE_NAME)).toBe(true);
    // every złoty from A is accounted for
    const fromA = t.filter(x => x.from === 'A').reduce((s, x) => s + x.amount, 0);
    expect(fromA).toBe(100);
  });

  it('settleDebts injects virtual entry when pool is over (excess cash)', () => {
    const t = settleDebts([
      { name: 'A', cents: -5000 },
      { name: 'B', cents: 10000 },
    ]);
    const toB = t.filter(x => x.to === 'B').reduce((s, x) => s + x.amount, 0);
    expect(toB).toBe(100);
    expect(t.some(x => x.from === IMBALANCE_NAME)).toBe(true);
  });

  it('settleDebts handles single player with non-zero balance via virtual entry', () => {
    const t = settleDebts([{ name: 'A', cents: -5000 }]);
    expect(t.length).toBe(1);
    expect(t[0].from).toBe('A');
    expect(t[0].to).toBe(IMBALANCE_NAME);
    expect(t[0].amount).toBe(50);
  });

  it('settleDebts: 3-debtors vs 1-creditor minimum transfers', () => {
    // A loses 100, B loses 50, C loses 50, D wins 200 -> exactly 3 transfers
    const t = settleDebts([
      { name: 'A', cents: -10000 },
      { name: 'B', cents: -5000 },
      { name: 'C', cents: -5000 },
      { name: 'D', cents: 20000 },
    ]);
    expect(t.length).toBe(3);
    expect(t.every(x => x.to === 'D')).toBe(true);
  });
});
