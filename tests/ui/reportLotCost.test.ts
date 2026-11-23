import { describe, expect, it } from 'vitest';
import { buildLotRows } from '../../src/pages/ReportLot';
import { buildCostRows, costTotal } from '../../src/pages/ReportCost';
import type { ReportData } from '../../src/data/useReportData';

const empty: ReportData = { lines: [], workers: [], per: [], lot: [], cost: [], targets: [], summaries: [],
  prevYear: { lot: [], summaries: [], yearSummary: null } };

describe('ReportLot rows', () => {
  it('month view: days with data, W1–W4, total; empty week pct null', () => {
    const d = { ...empty, lot: [
      { date: '2026-11-02', sent: 10, patrol: 0, fg: 0 }, { date: '2026-11-07', sent: 35, patrol: 0, fg: 1 },
      { date: '2026-11-11', sent: 18, patrol: 0, fg: 1 }] };
    const { rows } = buildLotRows(d, { kind: 'month', month: '2026-11' });
    expect(rows.map((r) => r.label)).toEqual(['02/11/2026', '07/11/2026', '11/11/2026', 'W1', 'W2', 'W3', 'W4', 'รวม']);
    expect(rows[3].t.sent).toBe(45);
    expect(rows[5].t.pct).toBeNull();
    expect(rows.at(-1)!.t.out).toBe(2);
  });
  it('an imported month has only its total, no empty week rows', () => {
    const d = { ...empty, summaries: [{ month: '2026-10', per: 134, lotSent: 630, lotOut: 3 }] };
    const { rows } = buildLotRows(d, { kind: 'month', month: '2026-10' });
    expect(rows.map((r) => r.label)).toEqual(['รวม']);
    expect(rows[0].t).toMatchObject({ sent: 630, out: 3 });
  });
  it('year view compares with previous year summary (2025: 8938 / 42)', () => {
    const d = { ...empty, prevYear: { lot: [], summaries: [], yearSummary: { month: '2025', per: 124, lotSent: 8938, lotOut: 42 } } };
    const { prevYearTotal } = buildLotRows(d, { kind: 'year', year: 2026 });
    expect(prevYearTotal!.pct).toBeCloseTo(0.4699, 3);
  });
});

describe('ReportCost rows', () => {
  it('variance per month and totals', () => {
    const d = { ...empty, cost: [{ month: '2026-10',
      standard: { electric: 26548.43, laborOT: null, laborSub: null, consumed: null },
      actual: { electric: 54594.25, laborOT: null, laborSub: null, consumed: null } }] };
    const rows = buildCostRows(d, { kind: 'year', year: 2026 });
    expect(rows).toHaveLength(48);
    expect(costTotal(rows, 'electric').variance).toBeCloseTo(-28045.82, 2);
    expect(costTotal(rows, 'laborOT').variance).toBeNull();
  });
});
