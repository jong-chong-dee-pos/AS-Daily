import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { parseOtdHistory, parseOtdSheet, readOtdWorkbook, toOtdMonth, type Grid } from '../../src/import/otdExcel';
import { otdBand, opsDerived, otdWeekly } from '../../src/calc/ops';
import { HISTORY, SHEET } from './otdFixture';

const grid = (rows: unknown[][]): Grid => ({
  get: (r, c) => rows[r - 1]?.[c - 1] ?? null, rowCount: rows.length, colCount: Math.max(...rows.map((r) => r.length)),
});

describe('%OTD workbook', () => {
  it('reads the groups, weeks, totals and the Update date', () => {
    const p = parseOtdSheet(grid(SHEET));
    expect(p.updated).toBe('2026-11-24');
    expect(p.rows.map((r) => [r.group, r.kind])).toEqual([
      ['1Smart', 'group'], ['AOEM', 'group'], ['Total', 'total'], ['Stock Item', 'stock'], ['Non Stock Item', 'nonstock']]);
    expect(p.rows[0].weeks[3]).toEqual({ plan: 400, otd: 120 });
    expect(p.rows[2].onPlan).toEqual({ plan: 4400, gr: 3000 });
    const m = toOtdMonth('2026-11', p);
    expect(m.pct).toBeCloseTo(0.6341, 4); // 2790 / 4400, the Total OTD of the sheet
    expect(otdWeekly(m).map((v) => Math.round(v! * 100))).toEqual([95, 95, 80, 30]);
  });
  it('tells the user when the sheet is not the OTD table', () => {
    expect(() => parseOtdSheet(grid([['x'], ['y']]))).toThrow('ไม่พบหัวตาราง "Group"');
  });
  it('reads monthly history, carrying the year down and skipping months without a value', () => {
    expect(parseOtdHistory(grid(HISTORY))).toEqual([
      { month: '2024-12', pct: 0.71 }, { month: '2025-12', pct: 0.92 }, { month: '2026-01', pct: 0.88 }, { month: '2026-02', pct: 0.85 }]);
  });
  it('opens a real .xlsx with formula cells and other sheets', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Plan').addRow(['other data']);
    const ws = wb.addWorksheet('OTD FG81');
    SHEET.forEach((r) => ws.addRow(r));
    ws.getCell('D7').value = { formula: 'C7-10', result: 90 } as ExcelJS.CellFormulaValue;
    const h = wb.addWorksheet('81');
    HISTORY.forEach((r) => h.addRow(r));
    const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
    const r = await readOtdWorkbook(buf);
    expect(r.rows[0].weeks[0]).toEqual({ plan: 100, otd: 90 });
    expect(r.updated).toBe('2026-11-24');
    expect(r.history).toHaveLength(4);
  });
  it('rejects a workbook without the OTD FG81 sheet', async () => {
    const wb = new ExcelJS.Workbook(); wb.addWorksheet('Sheet1').addRow([1]);
    await expect(readOtdWorkbook((await wb.xlsx.writeBuffer()) as ArrayBuffer)).rejects.toThrow('ไม่พบชีต "OTD FG81"');
  });
});

describe('monthly figures', () => {
  it('computes per-piece values from what was entered (Jan 2026 in the old report)', () => {
    const c = opsDerived({ month: '2026-01', prodPlan: 76580, prodActual: 84761, matStd: 62.24, matAct: 62.17,
      processCost: 605521, headcount: 61.17, expense: 414595, prodForHead: 86374 });
    expect(c.processPerPcs).toBeCloseTo(7.14, 2);
    expect(Math.round(c.pcsPerHead!)).toBe(1412);
    expect(c.expensePerPcs).toBeCloseTo(4.8, 1);
    expect(c.matVariance).toBeCloseTo(0.07, 2);
    expect(c.prodDiff).toBe(8181);
  });
  it('uses ACTUAL for Pcs./head when no separate figure is given; blanks stay blank', () => {
    const c = opsDerived({ month: '2026-02', prodPlan: null, prodActual: 1000, matStd: null, matAct: null, processCost: null, headcount: 4, expense: null });
    expect(c.pcsPerHead).toBe(250);
    expect(c.processPerPcs).toBeNull();
    expect(c.expensePerPcs).toBeNull();
  });
  it('colours %OTD like the report: ≥80 green, 60–79 yellow, below 60 red', () => {
    expect([0.8, 0.79, 0.6, 0.59, null].map(otdBand)).toEqual(['good', 'warn', 'warn', 'bad', 'none']);
  });
});
