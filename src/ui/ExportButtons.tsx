import { useState } from 'react';
import { exportExcel, type SheetSpec } from '../export/excel';
import { exportPdf } from '../export/pdf';

/** Excel + PDF buttons. `target` is the id of the element captured into the PDF. */
export function ExportButtons({ name, sheets, target }: { name: string; sheets: SheetSpec[]; target: string }) {
  const [busy, setBusy] = useState(false);
  const run = async (f: () => Promise<void>) => { setBusy(true); try { await f(); } finally { setBusy(false); } };
  return (
    <>
      <button type="button" className="secondary" disabled={busy} onClick={() => run(() => exportExcel(sheets, `${name}.xlsx`))}>Excel</button>
      <button type="button" className="secondary" disabled={busy} onClick={() => run(async () => {
        const el = document.getElementById(target);
        if (el) await exportPdf(el, `${name}.pdf`, sheets[0]?.rows[0]?.[0] ? String(sheets[0].rows[0][0]) : name);
      })}>PDF</button>
    </>
  );
}
