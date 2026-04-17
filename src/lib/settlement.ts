/** Współdzielona logika rozliczeń — importowana przez UI i testy Vitest. */

export function plnToCents(pln: unknown): number {
  const n = Number(pln);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export type DebtEntry = { name: string; phone?: string; cents: number };

export function settleDebts(entries: DebtEntry[]) {
  const debtors = entries
    .filter(b => b.cents < 0)
    .map(b => ({ ...b, cents: -b.cents }))
    .sort((a, b) => b.cents - a.cents);
  const creditors = entries
    .filter(b => b.cents > 0)
    .map(b => ({ ...b }))
    .sort((a, b) => b.cents - a.cents);
  const transactions: { from: string; to: string; amount: number; toPhone?: string }[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];
    const cents = Math.min(d.cents, c.cents);
    transactions.push({
      from: d.name,
      to: c.name,
      amount: cents / 100,
      toPhone: c.phone,
    });
    d.cents -= cents;
    c.cents -= cents;
    if (d.cents === 0) i++;
    if (c.cents === 0) j++;
  }
  return transactions;
}

export function pluralPL(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

export function formatPln(amount: unknown): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
