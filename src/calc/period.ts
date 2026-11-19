import type { Period } from '../types';

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** First and last date (YYYY-MM-DD) covered by a period. */
export function bounds(p: Period): { from: string; to: string } {
  if (p.kind === 'range') return { from: p.from, to: p.to };
  if (p.kind === 'month') return { from: `${p.month}-01`, to: `${p.month}-${pad(daysInMonth(p.month))}` };
  return { from: `${p.year}-01-01`, to: `${p.year}-12-31` };
}

export function datesIn(p: Period): string[] {
  const { from, to } = bounds(p);
  const out: string[] = [];
  const d = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (d <= end) {
    out.push(iso(d));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export function monthsIn(p: Period): string[] {
  const { from, to } = bounds(p);
  const out: string[] = [];
  let [y, m] = from.slice(0, 7).split('-').map(Number);
  const last = to.slice(0, 7);
  for (;;) {
    const cur = `${y}-${pad(m)}`;
    out.push(cur);
    if (cur >= last) break;
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

export const monthOf = (date: string) => date.slice(0, 7);
