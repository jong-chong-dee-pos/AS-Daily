import type { LotEntry } from '../types';
import { weekOf, type Week } from './weeks';

export interface LotTotals {
  sent: number;
  patrol: number;
  fg: number;
  out: number;
  /** (patrol + fg) / sent × 100, or null when nothing was sent. */
  pct: number | null;
}

export function lotTotals(entries: LotEntry[]): LotTotals {
  const sent = entries.reduce((a, e) => a + e.sent, 0);
  const patrol = entries.reduce((a, e) => a + e.patrol, 0);
  const fg = entries.reduce((a, e) => a + e.fg, 0);
  const out = patrol + fg;
  return { sent, patrol, fg, out, pct: sent > 0 ? (out / sent) * 100 : null };
}

export function lotByWeek(entries: LotEntry[], month: string): Record<Week, LotTotals> {
  const inMonth = entries.filter((e) => e.date.startsWith(month));
  const by = (w: Week) => lotTotals(inMonth.filter((e) => weekOf(e.date) === w));
  return { 1: by(1), 2: by(2), 3: by(3), 4: by(4) };
}
