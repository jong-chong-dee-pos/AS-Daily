import { describe, expect, it } from 'vitest';
import { monthlyPer, monthlyLot, sumLot } from '../../src/calc/monthly';
import type { Line } from '../../src/types';

const line: Line = { id: 'a', code: 'A', order: 0, setter: 'S', defaultWorkerIds: [], includeInTotal: true, active: true };

describe('monthly rollups', () => {
  it('uses daily data when present, summaries otherwise', () => {
    const r = monthlyPer(['2026-10', '2026-11', '2026-12'],
      [{ date: '2026-11-02', lineId: 'a', workerIds: [], per: 140 }], [line],
      [{ month: '2026-10', per: 134, lotSent: 630, lotOut: 3 }, { month: '2026-11', per: 1, lotSent: 1, lotOut: 1 }]);
    expect(r).toEqual([134, 140, null]);
  });
  it('lot from summaries and year total (Excel: 6086 sent, 30 out)', () => {
    const sent = [566, 670, 700, 561, 587, 525, 448, 627, 568, 630];
    const out = [1, 5, 4, 0, 4, 2, 5, 4, 0, 3];
    const months = sent.map((_, i) => `2026-${String(i + 1).padStart(2, '0')}`);
    const summaries = months.map((m, i) => ({ month: m, per: null, lotSent: sent[i], lotOut: out[i] }));
    const nov = [{ date: '2026-11-07', sent: 204, patrol: 0, fg: 2 }];
    const t = sumLot(monthlyLot([...months, '2026-11', '2026-12'], nov, summaries));
    expect(t.sent).toBe(6086);
    expect(t.out).toBe(30);
    expect(t.pct).toBeCloseTo(0.4929, 3);
  });
});
