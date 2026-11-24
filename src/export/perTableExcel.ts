import ExcelJS from 'exceljs';
import { download } from './excel';

/** The parts of the on-screen % PER table this export needs (see buildTable in ReportPer). */
export interface PerTableCell { text: string; below?: boolean; raw?: string | number | null }
export interface PerTableData {
  head: string[]; headSub: string[]; weekend: boolean[]; colGroup: string; colStart: number; firstNum: number;
  body: { cells: PerTableCell[]; group?: boolean }[]; foot?: PerTableCell[];
}

// The same colours as the table on screen.
const FILL = { ok: 'FFE3F7EC', bad: 'FFFEEBF0', sunday: 'FFF6F5FB', group: 'FFF1EFFB', head: 'FFF4F3FA', foot: 'FFF4F3FA' };
const FONT = { ok: 'FF08703F', bad: 'FFF0446F', accent: 'FF5B4BD6', muted: 'FF8A87A6' };
const fill = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const thin: Partial<ExcelJS.Borders> = { bottom: { style: 'thin', color: { argb: 'FFE6E4F2' } } };

/**
 * Builds the % PER table as it looks on screen: the same columns (the line view hides its
 * Setter column and shows Setter rows instead), the dates with their weekday, Setter rows,
 * the all-lines row with the target, and green / red cells for on / below target.
 */
export async function buildPerTableWorkbook(t: PerTableData, title: string, line: boolean): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('ตาราง % PER');
  const from = line ? 1 : 0; // the line view shows Setters as group rows, not as a column
  const head = t.head.slice(from);
  const lead = t.colStart - from; // columns before the dates
  const nDates = head.length - lead - 1;
  const last = head.length; // 1-based index of the "เฉลี่ย" column

  ws.addRow([title]).font = { bold: true, size: 13 };
  // Header: left headings and "เฉลี่ย" span two rows; the dates sit under one group heading.
  const h1 = ws.addRow([...head.slice(0, lead), t.colGroup, ...Array(Math.max(nDates - 1, 0)).fill(null), 'เฉลี่ย']);
  const h2 = ws.addRow([...Array(lead).fill(null), ...head.slice(lead, -1).map((h, i) => {
    const sub = t.headSub[i + t.colStart];
    return sub ? `${h}\n${sub}` : h;
  }), null]);
  for (let c = 1; c <= lead; c++) ws.mergeCells(2, c, 3, c);
  if (nDates > 1) ws.mergeCells(2, lead + 1, 2, lead + nDates);
  ws.mergeCells(2, last, 3, last);
  for (const r of [h1, h2]) {
    r.font = { bold: true };
    r.eachCell({ includeEmpty: true }, (cell, c) => {
      cell.fill = fill(t.weekend[c - 1 + from] && r === h2 ? FILL.sunday : FILL.head);
      cell.alignment = { vertical: 'middle', horizontal: c <= lead ? 'left' : 'center', wrapText: true };
    });
  }
  h2.height = 30;

  const number = (c: PerTableCell) => (c.raw === undefined ? c.text : c.raw === null ? '–' : Number(c.raw));
  for (const r of t.body) {
    if (r.group && line) {
      const row = ws.addRow([`Setter: ${r.cells[0].text || 'ยังไม่ได้กำหนด'} (เฉลี่ย Setter)`, ...Array(last - 2).fill(null), number(r.cells[r.cells.length - 1])]);
      if (lead > 1) ws.mergeCells(row.number, 1, row.number, lead);
      row.eachCell({ includeEmpty: true }, (cell) => { cell.fill = fill(FILL.group); cell.font = { bold: true, color: { argb: FONT.accent } }; });
      const avg = row.getCell(last);
      avg.numFmt = '0.0'; avg.alignment = { horizontal: 'right' };
      if (r.cells[r.cells.length - 1].below) avg.font = { bold: true, color: { argb: FONT.bad } };
      continue;
    }
    const cells = r.cells.slice(from);
    const row = ws.addRow(cells.map(number));
    cells.forEach((c, k) => {
      const j = k + from;
      const cell = row.getCell(k + 1);
      cell.border = thin;
      if (j >= t.firstNum) { cell.alignment = { horizontal: 'right' }; if (typeof cell.value === 'number' && j >= t.colStart) cell.numFmt = '0.0'; }
      if (k === 0 && line) cell.font = { bold: true };
      if (j >= t.colStart && c.raw !== undefined && c.raw !== null) {
        cell.fill = fill(c.below ? FILL.bad : FILL.ok);
        cell.font = { bold: !!c.below, color: { argb: c.below ? FONT.bad : FONT.ok } };
      } else if (t.weekend[j]) cell.fill = fill(FILL.sunday);
    });
  }
  if (t.foot) {
    const cells = t.foot.slice(from);
    const row = ws.addRow(cells.map(number));
    cells.forEach((c, k) => {
      const j = k + from;
      const cell = row.getCell(k + 1);
      cell.fill = fill(FILL.foot);
      cell.font = { bold: true, color: c.below ? { argb: FONT.bad } : undefined };
      if (j >= t.firstNum) { cell.alignment = { horizontal: 'right' }; if (typeof cell.value === 'number') cell.numFmt = '0.0'; }
    });
  }
  ws.addRow([]);
  ws.addRow(['สีเขียว = ถึงเป้า, สีแดง = ต่ำกว่าเป้าของเดือนนั้น, สีเทา = วันอาทิตย์']).font = { italic: true, color: { argb: FONT.muted } };

  ws.columns.forEach((col, i) => {
    const c = i + 1;
    col.width = c > lead ? (c === last ? 9 : 7) : head[i] === 'พนักงาน' ? (line ? 30 : 28) : 12;
  });
  ws.views = [{ state: 'frozen', xSplit: lead, ySplit: 3 }];
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

export async function exportPerTable(t: PerTableData, title: string, line: boolean, filename: string) {
  await download(await buildPerTableWorkbook(t, title, line), filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}
