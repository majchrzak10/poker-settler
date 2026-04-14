(function (g) {
  function plnToCents(pln) {
    const n = Number(pln);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100);
  }

  function settleDebts(entries) {
    const debtors = entries
      .filter(b => b.cents < 0)
      .map(b => ({ ...b, cents: -b.cents }))
      .sort((a, b) => b.cents - a.cents);
    const creditors = entries
      .filter(b => b.cents > 0)
      .map(b => ({ ...b }))
      .sort((a, b) => b.cents - a.cents);
    const transactions = [];
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const d = debtors[i], c = creditors[j];
      const cents = Math.min(d.cents, c.cents);
      transactions.push({ from: d.name, to: c.name, amount: cents / 100, toPhone: c.phone });
      d.cents -= cents; c.cents -= cents;
      if (d.cents === 0) i++;
      if (c.cents === 0) j++;
    }
    return transactions;
  }

  function pluralPL(n, one, few, many) {
    if (n === 1) return one;
    const mod10 = n % 10, mod100 = n % 100;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
    return many;
  }

  /** Wyświetlanie kwot PLN (locale pl, 0–2 miejsca po przecinku). */
  function formatPln(amount) {
    const n = Number(amount);
    if (!Number.isFinite(n)) return '0';
    return n.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  const api = { plnToCents, settleDebts, pluralPL, formatPln };
  g.PokerSettlerCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : globalThis);
