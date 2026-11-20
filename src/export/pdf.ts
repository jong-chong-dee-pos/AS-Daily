import { saveFile } from './save';

/** Renders an element to an A4-landscape PDF via a canvas snapshot, so Thai text keeps its font. */
export async function exportPdf(el: HTMLElement, filename: string, title: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', windowWidth: Math.max(el.scrollWidth, 1200) });
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth(), pageH = pdf.internal.pageSize.getHeight();
  const margin = 10, w = pageW - margin * 2;
  const h = (canvas.height * w) / canvas.width;
  // Title drawn as an image too (jsPDF's built-in fonts have no Thai glyphs).
  const t = document.createElement('canvas');
  t.width = 2000; t.height = 80;
  const ctx = t.getContext('2d')!;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, t.width, t.height);
  ctx.fillStyle = '#1c2529'; ctx.font = '600 44px "IBM Plex Sans Thai", Tahoma, sans-serif';
  ctx.fillText(title, 0, 56);
  pdf.addImage(t.toDataURL('image/png'), 'PNG', margin, margin, w, (80 * w) / 2000);
  const top = margin + (80 * w) / 2000 + 2;
  const img = canvas.toDataURL('image/png');
  let offset = 0;
  const avail = pageH - top - margin;
  pdf.addImage(img, 'PNG', margin, top, w, h);
  offset += avail;
  while (offset < h) {
    pdf.addPage();
    pdf.addImage(img, 'PNG', margin, margin - offset, w, h);
    offset += pageH - margin * 2;
  }
  await saveFile(pdf.output('blob'), filename);
}
