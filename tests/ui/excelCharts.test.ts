import { describe, expect, it } from 'vitest';
import type { ReportData } from '../../src/data/useReportData';
import { costSeries, lotChartMonth, lotDailySeries, lotMonthSeries, lotWeekSeries, perMonthSeries } from '../../src/ui/ExcelCharts';
import { L } from './fakeRepo';

// Daily.xlsx 2026: monthly summaries Jan–Oct, Nov from daily rows.
const perJanOct = [128, 124, 125, 127, 126, 127, 126, 129, 138, 134];
const sent = [566, 670, 700, 561, 587, 525, 448, 627, 568, 630];
const out = [1, 5, 4, 0, 4, 2, 5, 4, 0, 3];
const novSent = [0, 10, 23, 39, 23, 11, 35, 0, 19, 26, 18];
const d: ReportData = {
  lines: [L('a', 'S')], workers: [],
  per: [{ date: '2026-11-02', lineId: 'a', workerIds: [], per: 138.3333333 }],
  lot: novSent.map((s, i) => ({ date: `2026-11-${String(i + 1).padStart(2, '0')}`, sent: s, patrol: 0, fg: i + 1 === 7 || i + 1 === 11 ? 1 : 0 })),
  cost: [{ month: '2026-10', standard: { electric: 26548.43, laborOT: null, laborSub: null, consumed: null }, actual: { electric: 54594.25, laborOT: null, laborSub: null, consumed: null } }],
  targets: [{ month: '2026-01', perTarget: 120, lotOutTarget: 0.5 }],
  summaries: perJanOct.map((p, i) => ({ month: `2026-${String(i + 1).padStart(2, '0')}`, per: p, lotSent: sent[i], lotOut: out[i] })),
  prevYear: { lot: [], summaries: [], yearSummary: { month: '2025', per: 124, lotSent: 8938, lotOut: 42 } },
  prev2Year: { month: '2024', per: 122, lotSent: null, lotOut: null },
};

describe('Excel-style chart series', () => {
  it('% PER months then AVG-26/25/24 like sheet "% Per (Month)_"', () => {
    const s = perMonthSeries(d, 2026);
    expect(s.map((p) => p.name).slice(-3)).toEqual(['AVG-26', 'AVG-25', 'AVG-24']);
    expect(s[0]).toMatchObject({ name: 'Jan', per: 128, target: 120 });
    expect(s[10].per).toBeCloseTo(138.33, 2);
    expect(s[11].per).toBeNull();
    expect(s[12].per as number).toBeCloseTo(129.30, 2);
    expect([s[13].per, s[14].per]).toEqual([124, 122]);
  });
  it('Lot out % months then year and previous year like "Lot out (Month)_26"', () => {
    const s = lotMonthSeries(d, 2026);
    expect(s[0].pct as number).toBeCloseTo(0.1767, 3);
    expect(s[10].pct as number).toBeCloseTo(0.9804, 3);
    expect(s[12]).toMatchObject({ name: '2026' });
    expect(s[12].pct as number).toBeCloseTo(0.4929, 3);
    expect(s[13].pct as number).toBeCloseTo(0.4699, 3);
    // Month columns carry their month so a click opens that month's Lot out FG detail; the year columns do not.
    expect(s[10].month).toBe('2026-11');
    expect(s[12].month).toBeUndefined();
  });
  it('daily and weekly Lot out % for the month', () => {
    const day = lotDailySeries(d.lot, '2026-11', d.targets);
    expect(day).toHaveLength(30);
    expect(day[6].pct as number).toBeCloseTo(2.857, 2);
    expect(day[0].pct).toBeNull();
    const w = lotWeekSeries(d.lot, '2026-11', d.targets);
    expect(w[0].pct as number).toBeCloseTo(0.709, 2);
    expect(w[1].pct as number).toBeCloseTo(1.587, 2);
    expect(lotChartMonth({ kind: 'year', year: 2026 }, d.lot)).toBe('2026-11');
  });
  it('cost series carries standard, actual and variance', () => {
    const c = costSeries(d, 2026, 'electric');
    expect(c[9]).toMatchObject({ name: 'Oct', standard: 26548.43, actual: 54594.25 });
    expect(c[9].variance as number).toBeCloseTo(-28045.82, 2);
  });
});
