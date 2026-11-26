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

  it('month without daily rows uses the imported monthly summary', () => {
    const d: ReportData = {
      lines: [L('a', 'S')], workers: [], per: [], lot: [], cost: [], targets: [],
      summaries: [{ month: '2026-10', per: 134.2, lotSent: 630, lotOut: 3 }],
      prevYear: { lot: [], summaries: [], yearSummary: null },
    };
    const s = summarize(d, { kind: 'month', month: '2026-10' });
    expect(s.per).toBeCloseTo(134.2, 1);
    expect(s.lot).toMatchObject({ sent: 630, out: 3 });
    expect(s.lot.pct).toBeCloseTo(0.48, 2);
  });
});

import { missingCostMonths } from '../../src/ui/CostMissing';
describe('cost not entered', () => {
  it('lists months up to today that have no cost', () => {
    const d = { lines: [], workers: [], per: [], lot: [], targets: [], summaries: [], prevYear: { lot: [], summaries: [], yearSummary: null },
      cost: [{ month: '2026-10', standard: { electric: 1, laborOT: null, laborSub: null, consumed: null }, actual: { electric: 1, laborOT: null, laborSub: null, consumed: null } }] } as ReportData;
    expect(missingCostMonths(d, { kind: 'month', month: '2026-11' }, '2026-11-23')).toEqual(['2026-11']);
    expect(missingCostMonths(d, { kind: 'month', month: '2026-10' }, '2026-11-23')).toEqual([]);
    expect(missingCostMonths(d, { kind: 'year', year: 2026 }, '2026-11-23')).toHaveLength(10);
  });
});

import { opsSeries, otdMonthSeries } from '../../src/ui/OpsCharts';
import { costSeries, lotDailySeries, lotMonthSeries, perMonthSeries } from '../../src/ui/ExcelCharts';
describe('Dashboard monthly figures and %OTD', () => {
  const base = { lines: [], workers: [], per: [], lot: [], cost: [], targets: [], summaries: [], prevYear: { lot: [], summaries: [], yearSummary: null } };
  it('one point per month with computed per-piece values', () => {
    const d = { ...base, ops: [{ month: '2026-02', prodPlan: 77164, prodActual: 79420, matStd: 64.09, matAct: 63.62, processCost: 710644, headcount: 62, expense: null }] } as ReportData;
    const s = opsSeries(d, 2026);
    expect(s).toHaveLength(12);
    expect(s[1]).toMatchObject({ prodPlan: 77164, prodActual: 79420, prodHead: 79420 });
    expect(s[1].processPerPcs as number).toBeCloseTo(8.95, 2);
    expect(s[0].prodActual).toBeNull();
  });
  it('%OTD by month starts with the previous Decembers that are known', () => {
    const d = { ...base, otd: [{ month: '2024-12', pct: 0.71, source: 'history' }, { month: '2026-11', pct: 0.6341, source: 'upload' }] } as ReportData;
    const s = otdMonthSeries(d, 2026);
    expect(s.map((p) => p.name).slice(0, 2)).toEqual(['Dec-24', 'Jan']);
    expect(s).toHaveLength(13);
    expect(s.find((p) => p.name === 'Nov')!.pct).toBe(63.4);
  });
});

describe('Assembly chart notes ride along for the tooltip', () => {
  const base = { lines: [], workers: [], per: [], lot: [], cost: [], targets: [], summaries: [], prevYear: { lot: [], summaries: [], yearSummary: null } };
  it('monthly notes reach each chart series; blank notes stay null', () => {
    const d = { ...base,
      ops: [{ month: '2026-03', prodPlan: 100, prodActual: 90, matStd: null, matAct: null, processCost: null, headcount: null, expense: null,
        notes: { per: 'ไลน์ใหม่', lot: 'งานด่วน', prod: 'หยุดยาว', mat: 'ราคาขึ้น', process: 'ค่าไฟ', head: 'คนลาออก', otd: 'ส่งช้า' } },
      { month: '2026-04', prodPlan: 1, prodActual: 1, matStd: null, matAct: null, processCost: null, headcount: null, expense: null, notes: { prod: '  ' } }],
      otd: [{ month: '2026-03', pct: 0.8, source: 'upload' }],
    } as ReportData;
    const s = opsSeries(d, 2026);
    expect(s[2]).toMatchObject({ noteProd: 'หยุดยาว', noteMat: 'ราคาขึ้น', noteProcess: 'ค่าไฟ', noteHead: 'คนลาออก' });
    expect(s[3].noteProd).toBeNull();
    expect(otdMonthSeries(d, 2026).find((p) => p.name === 'Mar')!.note).toBe('ส่งช้า');
    expect(perMonthSeries(d, 2026)[2].note).toBe('ไลน์ใหม่');
    expect(lotMonthSeries(d, 2026)[2].note).toBe('งานด่วน');
    expect(perMonthSeries(d, 2026)[3].note).toBeNull();
  });
  it('a day note shows on its day of the daily Lot out chart', () => {
    const s = lotDailySeries([{ date: '2026-11-05', sent: 10, patrol: 0, fg: 1, note: 'เครื่องเสีย' }], '2026-11', []);
    expect(s[4].note).toBe('เครื่องเสีย');
    expect(s[3].note).toBeNull();
  });
  it('the cost notes reach the cost chart', () => {
    const d = { ...base, cost: [{ month: '2026-10', standard: { electric: 1, laborOT: null, laborSub: null, consumed: null }, actual: { electric: 2, laborOT: null, laborSub: null, consumed: null }, note: { electric: 'แอร์เสีย' } }] } as ReportData;
    expect(costSeries(d, 2026, 'electric').find((p) => p.name === 'Oct')!.note).toBe('แอร์เสีย');
  });
});
