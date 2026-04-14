const test = require('node:test');
const assert = require('node:assert/strict');
const { plnToCents, settleDebts, pluralPL, formatPln } = require('../lib/settlement.js');

test('formatPln uses pl locale', () => {
  assert.match(formatPln(1234.5), /1[\s\u00a0]?234/);
});

test('plnToCents rounds to integer grosze', () => {
  assert.equal(plnToCents(10.5), 1050);
  assert.equal(plnToCents('3.33'), 333);
  assert.equal(plnToCents(NaN), 0);
});

test('pluralPL polish rules', () => {
  assert.equal(pluralPL(1, 'a', 'b', 'c'), 'a');
  assert.equal(pluralPL(2, 'a', 'b', 'c'), 'b');
  assert.equal(pluralPL(5, 'a', 'b', 'c'), 'c');
  assert.equal(pluralPL(22, 'a', 'b', 'c'), 'b');
  assert.equal(pluralPL(25, 'a', 'b', 'c'), 'c');
});

test('settleDebts matches creditors and debtors', () => {
  const t = settleDebts([
    { name: 'A', phone: '', cents: -1000 },
    { name: 'B', phone: '', cents: 1000 },
  ]);
  assert.equal(t.length, 1);
  assert.equal(t[0].from, 'A');
  assert.equal(t[0].to, 'B');
  assert.equal(t[0].amount, 10);
});

test('settleDebts three players', () => {
  const t = settleDebts([
    { name: 'A', phone: '', cents: -50 },
    { name: 'B', phone: '', cents: -50 },
    { name: 'C', phone: '', cents: 100 },
  ]);
  const sum = t.reduce((s, x) => s + x.amount, 0);
  assert.ok(sum >= 0.99 && sum <= 1.01);
});
