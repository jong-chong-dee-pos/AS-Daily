import ExcelJS from 'exceljs';

/** The layout of the "OTD FG81" sheet: title rows, week headings, then Group rows. */
export const SHEET: (string | number | Date | null)[][] = [
  [null, 'ONTIME DELIVERY FG 81'],
  [],
  [null, 'Target: 80%', ...Array(16).fill(null), 'Update: ', new Date(2026, 10, 24)],
  [null, 81],
  [null, null, 'W1', null, null, 'W2', null, null, 'W3', null, null, 'W4', null, null, 'Total OTD', null, null, null, 'Total On Plan'],
  [null, 'Group', 'Plan', 'OTD', '%OTD', 'Plan', 'OTD', '%OTD', 'Plan', 'OTD', '%OTD', 'Plan', 'OTD', '%OTD', 'Plan', 'OTD', '%OTD', null, 'Total Plan', 'GR', '%On Plan'],
  [null, '1Smart', 100, 90, 0.9, 200, 170, 0.85, 300, 240, 0.8, 400, 120, 0.3, 1000, 620, 0.62, null, 1000, 700, 0.7],
  [null, 'AOEM', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, null, 0, 0, 0],
  [null, 'Total', 1000, 950, 0.95, 800, 760, 0.95, 600, 480, 0.8, 2000, 600, 0.3, 4400, 2790, 0.63, null, 4400, 3000, 0.68],
  [null, 'Stock Item', 700, 680, 0.97, 500, 480, 0.96, 400, 330, 0.83, 1500, 450, 0.3, 3100, 1940, 0.63, null, 3100, 2100, 0.68],
  [null, 'Non Stock Item', 300, 270, 0.9, 300, 280, 0.93, 200, 150, 0.75, 500, 150, 0.3, 1300, 850, 0.65, null, 1300, 900, 0.69],
];
export const HISTORY: (string | number | null)[][] = [
  ['Year', 'Type', 'Target', 'FG 81'],
  [null, null, 0.8, null],
  [2024, 'Dec', 0.8, 0.71],
  [2025, 'Dec', 0.8, 0.92],
  [2026, 'Jan', 0.8, 0.88],
  [null, 'Feb', 0.8, 0.85],
  [null, 'Dec', 0.8, null],
];

/** A small workbook laid out like Plan Week: another sheet, "OTD FG81" and the "81" history. */
export async function otdWorkbook(): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet('Plan').addRow(['other data']);
  const ws = wb.addWorksheet('OTD FG81');
  SHEET.forEach((r) => ws.addRow(r));
  const h = wb.addWorksheet('81');
  HISTORY.forEach((r) => h.addRow(r));
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
