import type { LotEntry } from '../types';
import { weekOf, type Week } from './weeks';

export interface LotTotals {
  sent: number;
  patrol: number;
  fg: number;
  out: number;
  /**
   * Lot out FG % = fg / sent × 100, or null when nothing was sent. Patrol is counted (patrol, out)
   * but stays out of the percentage, as in Daily.xlsx, and the target is measured on it.
   */
  pct: number | null;
}

/** The one Lot out % formula of the app: FG lots out of the lots sent. */
export const lotPct = (fg: number, sent: number) => (sent > 0 ? (fg / sent) * 100 : null);

export function lotTotals(entries: LotEntry[]): LotTotals {
  const sent = entries.reduce((a, e) => a + e.sent, 0);
  const patrol = entries.reduce((a, e) => a + e.patrol, 0);
  const fg = entries.reduce((a, e) => a + e.fg, 0);
  const out = patrol + fg;
  return { sent, patrol, fg, out, pct: lotPct(fg, sent) };
}

export function lotByWeek(entries: LotEntry[], month: string): Record<Week, LotTotals> {
  const inMonth = entries.filter((e) => e.date.startsWith(month));
  const by = (w: Week) => lotTotals(inMonth.filter((e) => weekOf(e.date) === w));
  return { 1: by(1), 2: by(2), 3: by(3), 4: by(4) };
}
