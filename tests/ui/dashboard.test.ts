import { describe, expect, it } from 'vitest';
import { summarize } from '../../src/pages/Dashboard';
import type { ReportData } from '../../src/data/useReportData';
import { L } from './fakeRepo';

describe('Dashboard summary', () => {
  it('month: per vs target, lot out from counts, variance', () => {
    const d: ReportData = {
      lines: [L('a', 'S'), L('b', 'S')], workers: [],
      per: [{ date: '2026-11-02', lineId: 'a', workerIds: [], per: 130 }, { date: '2026-11-02', lineId: 'b', workerIds: [], per: 146.6 }],
      lot: [{ date: '2026-11-02', sent: 204, patrol: 0, fg: 2 }],
      cost: [{ month: '2026-11', standard: { electric: 100, laborOT: null, laborSub: null, consumed: null }, actual: { electric: 150, laborOT: null, laborSub: null, consumed: null } }],
      targets: [], summaries: [], prevYear: { lot: [], summaries: [], yearSummary: null },
    };
    const s = summarize(d, { kind: 'month', month: '2026-11' });
    expect(s.per).toBeCloseTo(138.3, 1);
    expect(s.perTarget).toBe(125);
    expect(s.lot.pct).toBeCloseTo(0.98, 2);
    expect(s.cost[0].variance).toBe(-50);
  });
});
