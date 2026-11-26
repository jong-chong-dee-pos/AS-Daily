import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { buildWorkbook } from '../src/export/excel';

describe('excel export', () => {
  it('writes sheets with Thai text and numbers', async () => {
    const buf = await buildWorkbook([{ name: '% PER', rows: [['% PER Nov 2026'], ['ไลน์', '1', 'เฉลี่ย'], ['SL1', 120.5, null]] }]);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const ws = wb.getWorksheet('% PER')!;
    expect(ws.getCell('A1').value).toBe('% PER Nov 2026');
    expect(ws.getCell('A2').value).toBe('ไลน์');
    expect(ws.getCell('B3').value).toBe(120.5);
  });
});
