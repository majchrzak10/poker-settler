export function getTotalBuyIn(sp: { buyIns: number[] }) {
  return sp.buyIns.reduce((sum, b) => sum + b, 0);
}

export function formatDate(isoDate: string | number | Date) {
  return new Date(isoDate).toLocaleDateString('pl-PL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatPhone(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 9);
  return digits.replace(/(\d{3})(?=\d)/g, '$1 ');
}

export function normalizePhoneDigits(raw: string | null | undefined) {
  if (raw == null) return '';
  return String(raw).replace(/\D/g, '').slice(0, 9);
}
