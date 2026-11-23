import { Photo } from '../ui/Photo';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useRepo } from '../data/RepoContext';
import { daysInMonth } from '../calc/period';
import { lotTotals } from '../calc/lotout';
import type { Line, LotEntry, MonthlySummary } from '../types';
import { fmtDate, fmtMonth, fmtNum, todayIso } from '../ui/format';

const shift = (m: string, n: number) => {
  const [y, mm] = m.split('-').map(Number); const t = y * 12 + (mm - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
};

/** Jobs that were Lot out FG in one month: date, U-Line, product, problem and photos. */
export function LotFgDetail() {
  const repo = useRepo();
  const [sp, setSp] = useSearchParams();
  const month = /^\d{4}-\d{2}$/.test(sp.get('m') ?? '') ? sp.get('m')! : todayIso().slice(0, 7);
  const [lot, setLot] = useState<LotEntry[] | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  useEffect(() => {
    let live = true;
    setLot(null);
    Promise.all([
      repo.getLotEntries(`${month}-01`, `${month}-${String(daysInMonth(month)).padStart(2, '0')}`),
      repo.listLines(), repo.getMonthlySummaries(month, month),
    ]).then(([l, ls, s]) => { if (live) { setLot(l); setLines(ls); setSummary(s[0] ?? null); } });
    return () => { live = false; };
  }, [repo, month]);
  const rows = useMemo(() => (lot ?? []).flatMap((e) => (e.items ?? []).filter((i) => i.kind === 'fg').map((i) => ({ ...i, date: e.date }))), [lot]);
  const t = lot && lot.length ? lotTotals(lot) : null;
  const sent = t ? t.sent : summary?.lotSent ?? null;
  const fg = t ? t.fg : summary ? summary.lotFg ?? summary.lotOut ?? null : null;
  const lineName = (id?: string) => lines.find((l) => l.id === id)?.code ?? '—';
  const go = (m: string) => setSp({ m });

  return (
    <section>
      <div className="page-head">
        <h1>รายละเอียด Lot out FG</h1>
        <Link to={`/report/lot?y=${month.slice(0, 4)}`} className="muted">‹ กลับไปหน้า Lot out</Link>
      </div>
      <div className="toolbar">
        <button type="button" className="secondary sm" aria-label="เดือนก่อนหน้า" onClick={() => go(shift(month, -1))}>‹</button>
        <label>เดือน <input type="month" value={month} onChange={(e) => e.target.value && go(e.target.value)} /></label>
        <button type="button" className="secondary sm" aria-label="เดือนถัดไป" onClick={() => go(shift(month, 1))}>›</button>
      </div>
      <div className="cards" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        <div className="card c-lot"><div className="card-head"><span className="label">Lot ส่งตรวจ {fmtMonth(month)}</span></div><div className="value" data-testid="fg-sent">{fmtNum(sent, 0)}</div></div>
        <div className="card c-cost"><div className="card-head"><span className="label">Lot out FG</span></div><div className="value neg" data-testid="fg-count">{fmtNum(fg, 0)}</div>
          <div className="target">{sent && fg !== null ? `${fmtNum((fg / sent) * 100, 2)}% ของ Lot ส่งตรวจ` : ''}</div></div>
        <div className="card c-per"><div className="card-head"><span className="label">บันทึกรายละเอียดแล้ว</span></div><div className="value">{rows.length}<span className="hint"> รายการ</span></div>
          <div className="target">{fg !== null && rows.length < fg && t ? `ยังขาดรายละเอียด ${fg - rows.length} รายการ` : ''}</div></div>
      </div>
      {lot === null && <p className="empty">กำลังโหลด…</p>}
      {lot !== null && (
        <div className="tablewrap">
          <table>
            <thead><tr><th>วันที่</th><th>U-Line</th><th>Part No.</th><th>ชื่อ Product</th><th>รายละเอียดปัญหา</th><th>รูปภาพ</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ whiteSpace: 'nowrap' }}><Link to={`/entry/daily?d=${r.date}`}>{fmtDate(r.date)}</Link></td>
                  <td><b>{lineName(r.lineId)}</b></td>
                  <td>{r.partNo || '—'}</td>
                  <td>{r.product || '—'}</td>
                  <td className="note-cell" style={{ color: 'var(--ink)' }}>{r.note || '—'}</td>
                  <td>
                    <div className="thumbs big">
                      {r.images.map((u) => <Photo key={u} src={u} alt={`รูป ${r.partNo}`} />)}
                      {r.images.length === 0 && <span className="hint">ไม่มีรูป</span>}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="empty">
                  {t ? 'เดือนนี้ยังไม่มีรายละเอียด Lot out FG บันทึกได้ที่หน้ากรอกข้อมูลรายวัน ส่วน “รายละเอียด Lot out”'
                    : summary ? 'เดือนนี้นำเข้าจาก Excel มีแต่ยอดรวม ไม่มีรายละเอียดรายงาน' : 'ยังไม่มีข้อมูลของเดือนนี้'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
