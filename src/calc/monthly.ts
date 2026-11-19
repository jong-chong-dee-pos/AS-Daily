import type { Line, LotEntry, MonthlySummary, PerEntry } from '../types';
import { overallAverage } from './per';
import { lotTotals, type LotTotals } from './lotout';

/** Overall % PER per month; months without daily entries fall back to imported summaries. */
export function monthlyPer(months: string[], per: PerEntry[], lines: Line[], summaries: MonthlySummary[]): (number | null)[] {
  return months.map((m) => {
    const e = per.filter((p) => p.date.startsWith(m));
    if (e.length) return overallAverage(e, lines);
    return summaries.find((s) => s.month === m)?.per ?? null;
  });
}

/** Lot totals per month; months without daily entries fall back to imported summaries. */
export function monthlyLot(months: string[], lot: LotEntry[], summaries: MonthlySummary[]): LotTotals[] {
  return months.map((m) => {
    const e = lot.filter((l) => l.date.startsWith(m));
    if (e.length) return lotTotals(e);
    const s = summaries.find((x) => x.month === m);
    if (!s || s.lotSent === null) return lotTotals([]);
    const out = s.lotOut ?? 0;
    return { sent: s.lotSent, patrol: 0, fg: out, out, pct: s.lotSent > 0 ? (out / s.lotSent) * 100 : null };
  });
}

/** Sum of several LotTotals, percentage recomputed from counts. */
export function sumLot(ts: LotTotals[]): LotTotals {
  const sent = ts.reduce((a, t) => a + t.sent, 0);
  const patrol = ts.reduce((a, t) => a + t.patrol, 0);
  const fg = ts.reduce((a, t) => a + t.fg, 0);
  return { sent, patrol, fg, out: patrol + fg, pct: sent > 0 ? ((patrol + fg) / sent) * 100 : null };
}
