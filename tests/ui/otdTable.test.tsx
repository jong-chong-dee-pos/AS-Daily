// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { OtdTable, opsSeries, otdGroupSeries } from '../../src/ui/OpsCharts';
import type { ReportData } from '../../src/data/useReportData';
import type { OtdMonth, OtdRow } from '../../src/types';

const row = (group: string, kind: OtdRow['kind'], weeks: [number, number][], onPlan?: [number, number]): OtdRow =>
  ({ group, kind, weeks: weeks.map(([plan, otd]) => ({ plan, otd })), ...(onPlan ? { onPlan: { plan: onPlan[0], gr: onPlan[1] } } : {}) });
const rows = [
  row('1Smart', 'group', [[100, 90], [200, 170], [300, 240], [400, 120]], [1000, 700]),
  row('AOEM', 'group', [[0, 0], [0, 0], [0, 0], [0, 0]], [0, 0]),
  row('Total', 'total', [[100, 90], [200, 170], [300, 240], [400, 120]], [1000, 700]),
];

describe('%OTD by group', () => {
  it('one bar per product group with its whole-month %OTD; empty groups have no bar', () => {
    const m: OtdMonth = { month: '2026-11', pct: 0.62, rows, source: 'upload' };
    expect(otdGroupSeries(m)).toEqual([{ name: '1Smart', pct: 62 }, { name: 'AOEM', pct: null }]);
    expect(otdGroupSeries(undefined)).toEqual([]);
  });
  it('the table shows the whole month first and one week at a time on request', () => {
    render(<OtdTable rows={rows} />);
    const smart = () => within(screen.getByText('1Smart').closest('tr')!).getAllByRole('cell').map((c) => c.textContent);
    expect(screen.getByRole('tab', { name: 'ทั้งเดือน' })).toHaveAttribute('aria-selected', 'true');
    expect(smart()).toEqual(['1Smart', '1,000', '620', '62%', '700', '70%']);
    fireEvent.click(screen.getByRole('tab', { name: 'W4' }));
    expect(smart()).toEqual(['1Smart', '400', '120', '30%']);
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Group', 'Plan', 'OTD', '%OTD']);
  });
});

describe('monthly production series', () => {
  it('each card uses its own production figure, falling back to ACTUAL, and only in months with that card\'s figures', () => {
    const d = { ops: [
      { month: '2026-10', prodPlan: 12000, prodActual: 11000, matStd: null, matAct: null, processCost: 96000, prodForCost: 12000, headcount: null, expense: null },
      { month: '2026-11', prodPlan: 12000, prodActual: 8000, matStd: null, matAct: null, processCost: 64000, headcount: 10, expense: null, prodForHead: 9000 },
    ] } as unknown as ReportData;
    const s = opsSeries(d, 2026);
    expect([s[9].prodCost, s[9].processPerPcs, s[9].prodHead]).toEqual([12000, 8, null]); // no head figures that month
    expect([s[10].prodCost, s[10].processPerPcs, s[10].prodHead, s[10].pcsPerHead]).toEqual([8000, 8, 9000, 900]);
  });
});
