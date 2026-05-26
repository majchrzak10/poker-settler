import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildDraftHash,
  generateId,
  isoToMs,
  loadLS,
  normalizeDraftSessionPlayers,
  saveLS,
} from './storage';

// Minimal localStorage shim for the node test env.
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(k: string) { return this.store.get(k) ?? null; }
  setItem(k: string, v: string) { this.store.set(k, v); }
  removeItem(k: string) { this.store.delete(k); }
  clear() { this.store.clear(); }
}

beforeEach(() => {
  // @ts-expect-error — assigning to a non-existent global in node env
  globalThis.localStorage = new MemoryStorage();
});

describe('generateId', () => {
  it('returns a uuid-shaped string', () => {
    const id = generateId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[14][0-9a-f]{3}-[89ab0-9a-f][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('is unique across calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});

describe('loadLS / saveLS', () => {
  it('roundtrips JSON-serialisable values', () => {
    saveLS('x', { n: 5, s: 'a' });
    expect(loadLS('x', null)).toEqual({ n: 5, s: 'a' });
  });

  it('returns fallback when key is missing', () => {
    expect(loadLS('missing', 'fb')).toBe('fb');
    expect(loadLS<number[]>('missing', [])).toEqual([]);
  });

  it('returns fallback when stored value is malformed JSON', () => {
    localStorage.setItem('bad', '{not json');
    expect(loadLS('bad', 'fb')).toBe('fb');
  });

  it('saveLS swallows localStorage failures', () => {
    const broken = {
      setItem: () => { throw new Error('quota'); },
      getItem: () => null,
      removeItem: () => {},
    };
    // @ts-expect-error — assigning a partial stand-in
    globalThis.localStorage = broken;
    expect(() => saveLS('x', { a: 1 })).not.toThrow();
  });
});

describe('normalizeDraftSessionPlayers', () => {
  it('returns [] for non-array input', () => {
    expect(normalizeDraftSessionPlayers(null)).toEqual([]);
    expect(normalizeDraftSessionPlayers('garbage')).toEqual([]);
    expect(normalizeDraftSessionPlayers({})).toEqual([]);
  });

  it('drops rows without a string playerId', () => {
    const out = normalizeDraftSessionPlayers([
      { playerId: 'a', buyIns: [50], cashOut: '0' },
      { playerId: '', buyIns: [50], cashOut: '0' },
      { playerId: 123, buyIns: [50], cashOut: '0' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].playerId).toBe('a');
  });

  it('filters non-positive buy-ins and coerces strings', () => {
    const out = normalizeDraftSessionPlayers([
      { playerId: 'a', buyIns: [50, '30', 0, -10, 'bad', null], cashOut: '100' },
    ]);
    expect(out[0].buyIns).toEqual([50, 30]);
  });

  it('clamps negative or NaN cashOut to "0"', () => {
    const out = normalizeDraftSessionPlayers([
      { playerId: 'a', buyIns: [50], cashOut: '-5' },
      { playerId: 'b', buyIns: [50], cashOut: 'abc' },
      { playerId: 'c', buyIns: [50], cashOut: '' },
    ]);
    expect(out.map(r => r.cashOut)).toEqual(['0', '0', '0']);
  });
});

describe('buildDraftHash', () => {
  it('produces identical hash for equivalent state regardless of input shape', () => {
    const h1 = buildDraftHash(50, [{ playerId: 'a', buyIns: [50], cashOut: '0' }]);
    const h2 = buildDraftHash(50, [{ playerId: 'a', buyIns: [50, 0, -1], cashOut: '0' }]);
    expect(h1).toBe(h2);
  });

  it('differs when defaultBuyIn changes', () => {
    expect(buildDraftHash(50, [])).not.toBe(buildDraftHash(100, []));
  });

  it('coerces non-numeric defaultBuyIn to 0', () => {
    expect(buildDraftHash(NaN as unknown as number, [])).toBe(
      buildDraftHash(0, []),
    );
  });
});

describe('isoToMs', () => {
  it('parses ISO timestamps', () => {
    expect(isoToMs('2026-01-15T12:00:00Z')).toBeGreaterThan(0);
  });

  it('returns 0 for nullish / unparseable input', () => {
    expect(isoToMs(null)).toBe(0);
    expect(isoToMs(undefined)).toBe(0);
    expect(isoToMs('')).toBe(0);
    expect(isoToMs('not a date')).toBe(0);
  });
});
