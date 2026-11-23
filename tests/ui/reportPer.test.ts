import { describe, expect, it } from 'vitest';
import { buildTable, importedNote, periodPerTarget, perRanking } from '../../src/pages/ReportPer';
import type { ReportData } from '../../src/data/useReportData';
import { L } from './fakeRepo';

const base: ReportData = {
  lines: [L('sl1', 'A'), L('sl2', 'A', { includeInTotal: false }), L('sl3', 'B')],
  workers: [{ id: 'w1', name: 'สมชาย', active: true }, { id: 'w2', name: 'สมหญิง', active: true }],
  per: [
    { date: '2026-11-02', lineId: 'sl1', workerIds: ['w1'], per: 130 },
    { date: '2026-11-03', lineId: 'sl1', workerIds: ['w1'], per: 110 },
    { date: '2026-11-02', lineId: 'sl3', workerIds: ['w2', 'w1'], per: 150 },
  ],
  lot: [], cost: [], summaries: [{ month: '2026-10', per: 134, lotSent: 630, lotOut: 3 }],
  targets: [{ month: '2026-11', perTarget: 125, lotOutTarget: 0.5 }],
  prevYear: { lot: [], summaries: [], yearSummary: null },
};

describe('ReportPer table', () => {
  it('month view: line × day, below-target marked, overall from included lines', () => {
    const t = buildTable(base, { kind: 'month', month: '2026-11' }, 'line');
    expect(t.head).toHaveLength(3 + 30 + 1);
    const sl1 = t.body.find((r) => r.cells[1].text === 'SL1')!;
    expect(sl1.cells[3 + 1].text).toBe('130.0');
    expect(sl1.cells[3 + 2].below).toBe(true);
    expect(sl1.cells.at(-1)!.text).toBe('120.0');
    expect(t.foot!.at(-1)!.text).toBe('135.0'); // (120 + 150) / 2, sl2 excluded
  });
  it('year view uses summaries for months before the system', () => {
    const t = buildTable(base, { kind: 'year', year: 2026 }, 'line');
    expect(t.foot![3 + 9].text).toBe('134.0'); // Oct
    expect(t.foot![3 + 10].text).toBe('135.0'); // Nov
  });
  it('person view credits both workers on a shared line', () => {
    const t = buildTable(base, { kind: 'month', month: '2026-11' }, 'person');
    const w1 = t.body.find((r) => r.cells[0].text === 'สมชาย')!;
    expect(w1.cells[1].text).toBe('3');
    expect(w1.cells.at(-1)!.text).toBe('130.0');
  });
});

describe('ReportPer views', () => {
  const nov = { kind: 'month', month: '2026-11' } as const;
  it('each tab gives its own comparison rows', () => {
    expect(perRanking(base, nov, 'line').map((r) => [r.name, r.per])).toEqual([['SL1', 120], ['SL3', 150]]);
    expect(perRanking(base, nov, 'setter').map((r) => [r.name, r.per])).toEqual([['A', 120], ['B', 150]]);
    expect(perRanking(base, nov, 'person').map((r) => [r.name, r.per, r.days])).toEqual([['สมชาย', 130, 3], ['สมหญิง', 150, 1]]);
  });
  it('a period average is compared with the targets of months that have data', () => {
    const d = { ...base, targets: [{ month: '2026-01', perTarget: 110, lotOutTarget: 0.5 }, { month: '2026-11', perTarget: 125, lotOutTarget: 0.5 }] };
    expect(periodPerTarget(d, { kind: 'year', year: 2026 })).toBe(125);
    const t = buildTable(d, { kind: 'year', year: 2026 }, 'setter');
    expect(t.body.find((r) => r.cells[0].text === 'A')!.cells.at(-1)!.below).toBe(true); // 120 < 125
  });
  it('an imported month explains that only the monthly total exists', () => {
    const n = importedNote(base, { kind: 'month', month: '2026-10' })!;
    expect(n.text).toContain('134.0');
    expect(importedNote(base, nov)).toBeNull();
    expect(importedNote(base, { kind: 'year', year: 2026 })!.text).toContain('ต.ค.');
  });
});
