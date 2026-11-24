import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { buildTable, perTableFileName } from '../../src/pages/ReportPer';
import { buildPerTableWorkbook } from '../../src/export/perTableExcel';
import type { ReportData } from '../../src/data/useReportData';
import { L } from '../ui/fakeRepo';

const d: ReportData = {
  lines: [L('sl1', 'A'), L('sl3', 'B')],
  workers: [{ id: 'w1', name: 'สมชาย', active: true }, { id: 'w2', name: 'สมหญิง', active: true }],
  per: [
    { date: '2026-11-02', lineId: 'sl1', workerIds: ['w1'], per: 130 },
    { date: '2026-11-03', lineId: 'sl1', workerIds: ['w1'], per: 110 },
    { date: '2026-11-02', lineId: 'sl3', workerIds: ['w2'], per: 150 },
  ],
  lot: [], cost: [], summaries: [], targets: [{ month: '2026-01', perTarget: 125, lotOutTarget: 0.5 }],
} as unknown as ReportData;
const nov = { kind: 'month', month: '2026-11' } as const;

const read = async (buf: ArrayBuffer) => { const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf); return wb.worksheets[0]; };
const argb = (c: ExcelJS.Cell) => (c.fill as ExcelJS.FillPattern | undefined)?.fgColor?.argb;

describe('% PER table download', () => {
  it('line view: same columns as the screen, dates with weekday, Setter rows, colours and the target row', async () => {
    const ws = await read(await buildPerTableWorkbook(buildTable(d, nov, 'line'), 'ตาราง % PER รายไลน์ · พ.ย. 2026', true));
    expect(ws.getCell('A1').value).toBe('ตาราง % PER รายไลน์ · พ.ย. 2026');
    expect([ws.getCell('A2').value, ws.getCell('B2').value, ws.getCell('C2').value]).toEqual(['ไลน์', 'พนักงาน', 'วันที่ใน พ.ย. 2026']);
    expect(ws.getCell('C3').value).toBe('1\nอา'); // 1 Nov 2026 is a Sunday
    expect(ws.getCell('D3').value).toBe('2\nจ');
    expect(ws.getCell(2, 33).value).toBe('เฉลี่ย'); // 2 + 30 days + 1
    expect(ws.getCell('A4').value).toBe('Setter: A (เฉลี่ย Setter)');
    expect(ws.getCell('A5').value).toBe('SL1');
    expect(ws.getCell('B5').value).toBe('สมชาย');
    expect(ws.getCell('D5').value).toBe(130);
    expect(argb(ws.getCell('D5'))).toBe('FFE3F7EC'); // on target: green
    expect(ws.getCell('E5').value).toBe(110);
    expect(argb(ws.getCell('E5'))).toBe('FFFEEBF0'); // below target: red
    expect(argb(ws.getCell('C5'))).toBe('FFF6F5FB'); // Sunday with no figure: grey
    expect(ws.getCell('A6').value).toBe('Setter: B (เฉลี่ย Setter)');
    const foot = ws.getRow(8);
    expect([foot.getCell(1).value, foot.getCell(2).value, foot.getCell(4).value]).toEqual(['รวมทุกไลน์', 'เป้า 125%', 140]);
    expect(ws.views[0]).toMatchObject({ state: 'frozen', xSplit: 2, ySplit: 3 });
  });
  it('setter and person views keep their own columns', async () => {
    const s = await read(await buildPerTableWorkbook(buildTable(d, nov, 'setter'), 't', false));
    expect([s.getCell('A2').value, s.getCell('A4').value, s.getCell('A5').value]).toEqual(['Setter', 'A', 'B']);
    const p = await read(await buildPerTableWorkbook(buildTable(d, { kind: 'range', from: '2026-11-02', to: '2026-11-03' }, 'person'), 't', false));
    expect([p.getCell('A2').value, p.getCell('B2').value, p.getCell('C2').value]).toEqual(['พนักงาน', 'จำนวนวัน', 'วันที่']);
    expect(p.getCell('A4').value).toBe('สมหญิง');
    expect(p.getCell(2, 5).value).toBe('เฉลี่ย'); // 2 + 2 days + 1
  });
  it('file name says the view and the period', () => {
    expect(perTableFileName(nov, 'line')).toBe('PER_Line_2026-11.xlsx');
    expect(perTableFileName({ kind: 'year', year: 2026 }, 'person')).toBe('PER_Person_2026.xlsx');
  });
});
