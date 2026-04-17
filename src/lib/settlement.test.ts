import { describe, it, expect } from 'vitest';
import { plnToCents, settleDebts, pluralPL, formatPln } from './settlement';

describe('settlement', () => {
  it('formatPln uses pl locale', () => {
    expect(formatPln(1234.5)).toMatch(/1[\s\u00a0]?234/);
  });

  it('plnToCents rounds to integer grosze', () => {
    expect(plnToCents(10.5)).toBe(1050);
    expect(plnToCents('3.33')).toBe(333);
    expect(plnToCents(NaN)).toBe(0);
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
});
