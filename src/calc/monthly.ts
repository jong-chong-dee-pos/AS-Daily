import type { Line, LotEntry, MonthlySummary, PerEntry } from '../types';
import { overallAverage } from './per';
import { lotPct, lotTotals, type LotTotals } from './lotout';

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
    const fg = s.lotFg ?? out;
    return { sent: s.lotSent, patrol: Math.max(0, out - fg), fg, out, pct: lotPct(fg, s.lotSent) };
  });
}

/** Lot sent and Lot out FG per month; imported months use their Lot out count unless an FG count was entered. */
export function monthlySentFg(months: string[], lot: LotEntry[], summaries: MonthlySummary[]): { month: string; sent: number | null; fg: number | null; detail: boolean }[] {
  return months.map((m) => {
    const e = lot.filter((l) => l.date.startsWith(m));
    if (e.length) { const t = lotTotals(e); return { month: m, sent: t.sent, fg: t.fg, detail: true }; }
    const s = summaries.find((x) => x.month === m);
    // In Daily.xlsx the monthly "Lot out (ครั้ง)" row is the FG total (='Lot out (Daily)'!AG21), so it stands in for FG.
    return { month: m, sent: s?.lotSent ?? null, fg: s?.lotFg ?? s?.lotOut ?? null, detail: false };
  });
}

/** Sum of several LotTotals, percentage (FG / sent) recomputed from counts. */
export function sumLot(ts: LotTotals[]): LotTotals {
  const sent = ts.reduce((a, t) => a + t.sent, 0);
  const patrol = ts.reduce((a, t) => a + t.patrol, 0);
  const fg = ts.reduce((a, t) => a + t.fg, 0);
  return { sent, patrol, fg, out: patrol + fg, pct: lotPct(fg, sent) };
}
