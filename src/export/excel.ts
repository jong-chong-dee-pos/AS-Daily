import ExcelJS from 'exceljs';

export interface SheetSpec { name: string; rows: (string | number | null)[][] }

/** Builds an .xlsx workbook. Row 1 is a title, row 2 the header (bold). */
export async function buildWorkbook(sheets: SheetSpec[]): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31));
    s.rows.forEach((r) => ws.addRow(r));
    ws.getRow(1).font = { bold: true, size: 13 };
    ws.getRow(2).font = { bold: true };
    ws.columns.forEach((c) => { c.width = 12; });
  }
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

export function download(data: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportExcel(sheets: SheetSpec[], filename: string) {
  download(await buildWorkbook(sheets), filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}
