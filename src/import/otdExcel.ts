import type { OtdMonth, OtdRow } from '../types';
import { otdTotals } from '../calc/ops';

/** A sheet as a cell lookup (1-based row and column), so parsing is testable without Excel. */
export interface Grid { get(r: number, c: number): unknown; rowCount: number; colCount: number }

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const text = (v: unknown) => (v == null ? '' : v instanceof Date ? '' : String(v).trim());
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function find(g: Grid, test: (s: string) => boolean, rows = g.rowCount): [number, number] | null {
  for (let r = 1; r <= Math.min(rows, g.rowCount); r++) for (let c = 1; c <= g.colCount; c++) if (test(text(g.get(r, c)))) return [r, c];
  return null;
}

/**
 * Reads the "OTD FG81" sheet: the Update date and, per product group, Plan and OTD
 * for W1–W4 plus Total On Plan. Finds the table by its "Group" and "W1".."W4"
 * headings, so moved columns or extra groups still read correctly.
 */
export function parseOtdSheet(g: Grid): { updated: string | null; rows: OtdRow[] } {
  const head = find(g, (s) => s === 'Group');
  if (!head) throw new Error('ไม่พบหัวตาราง "Group" ในชีต OTD FG81');
  const [hr, gc] = head;
  const weekCols: number[] = [];
  let onPlanCol = 0;
  for (let c = gc + 1; c <= g.colCount; c++) {
    const s = text(g.get(hr - 1, c)).replace(/\s+/g, ' ');
    const w = /^W ?([1-4])\b/i.exec(s);
    if (w && !weekCols[Number(w[1]) - 1]) weekCols[Number(w[1]) - 1] = c;
    if (/^Total On Plan/i.test(s) && !onPlanCol) onPlanCol = c;
  }
  if (weekCols.filter(Boolean).length !== 4) throw new Error('ไม่พบคอลัมน์ W1–W4 ในชีต OTD FG81');

  const rows: OtdRow[] = [];
  let blanks = 0;
  for (let r = hr + 1; r <= g.rowCount && blanks < 2; r++) {
    const name = text(g.get(r, gc));
    if (!name) { blanks++; continue; }
    blanks = 0;
    const kind: OtdRow['kind'] = /^total$/i.test(name) ? 'total' : /^stock item$/i.test(name) ? 'stock' : /^non ?stock item$/i.test(name) ? 'nonstock' : 'group';
    rows.push({
      group: name, kind,
      weeks: weekCols.map((c) => ({ plan: num(g.get(r, c)), otd: num(g.get(r, c + 1)) })),
      ...(onPlanCol ? { onPlan: { plan: num(g.get(r, onPlanCol)), gr: num(g.get(r, onPlanCol + 1)) } } : {}),
    });
  }
  if (!rows.some((r) => r.kind === 'total')) throw new Error('ไม่พบแถว Total ในชีต OTD FG81');

  const up = find(g, (s) => /^update/i.test(s), hr);
  let updated: string | null = null;
  if (up) for (let c = up[1] + 1; c <= Math.min(g.colCount, up[1] + 4); c++) {
    const v = g.get(up[0], c);
    if (v instanceof Date) { updated = iso(v); break; }
  }
  return { updated, rows };
}

/**
 * Monthly %OTD history from the "81" sheet (columns Year, Type = Jan..Dec, FG 81).
 * The year carries down from the row above, as it does in the sheet.
 */
export function parseOtdHistory(g: Grid): { month: string; pct: number }[] {
  const head = find(g, (s) => s === 'Year', 40);
  if (!head) return [];
  const [hr] = head;
  let typeCol = 0, valCol = 0;
  for (let c = 1; c <= g.colCount; c++) {
    const s = text(g.get(hr, c));
    if (s === 'Type' && !typeCol) typeCol = c;
    if (/^FG ?81$/i.test(s) && !valCol) valCol = c;
  }
  if (!typeCol || !valCol) return [];
  const out: { month: string; pct: number }[] = [];
  let year = 0;
  for (let r = hr + 1; r <= g.rowCount; r++) {
    const y = g.get(r, head[1]);
    if (typeof y === 'number' && y > 2000) year = y;
    const m = MONTHS.indexOf(text(g.get(r, typeCol)).slice(0, 3).toLowerCase());
    const v = g.get(r, valCol);
    if (!year || m < 0 || typeof v !== 'number') continue;
    out.push({ month: `${year}-${String(m + 1).padStart(2, '0')}`, pct: v });
  }
  return out;
}

/** The month's record built from the parsed table; its %OTD is the Total row's month total. */
export function toOtdMonth(month: string, parsed: { updated: string | null; rows: OtdRow[] }): OtdMonth {
  const total = parsed.rows.find((r) => r.kind === 'total')!;
  return { month, pct: otdTotals(total).pct, rows: parsed.rows, ...(parsed.updated ? { updated: parsed.updated } : {}), source: 'upload' };
}

/** Plain value of an exceljs cell: formula results, rich text and hyperlinks flattened. */
function cellValue(v: unknown): unknown {
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    const o = v as Record<string, unknown>;
    if ('result' in o) return cellValue(o.result);
    if ('formula' in o || 'sharedFormula' in o) return null;
    if (Array.isArray(o.richText)) return (o.richText as { text: string }[]).map((t) => t.text).join('');
    if ('text' in o) return o.text;
    if ('error' in o) return null;
  }
  return v;
}

/** Opens an uploaded workbook and reads the OTD FG81 table and the "81" history. */
export async function readOtdWorkbook(buf: ArrayBuffer) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const grid = (name: string): Grid | null => {
    const ws = wb.worksheets.find((w) => w.name.trim().toLowerCase() === name.toLowerCase());
    return ws ? { get: (r, c) => cellValue(ws.getCell(r, c).value), rowCount: ws.rowCount, colCount: ws.columnCount } : null;
  };
  const sheet = grid('OTD FG81');
  if (!sheet) throw new Error('ไม่พบชีต "OTD FG81" ในไฟล์นี้');
  const parsed = parseOtdSheet(sheet);
  const hist = grid('81');
  return { ...parsed, history: hist ? parseOtdHistory(hist) : [] };
}
