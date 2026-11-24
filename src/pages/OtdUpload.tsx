import { useEffect, useState } from 'react';
import { useRepo } from '../data/RepoContext';
import { readOtdWorkbook, toOtdMonth } from '../import/otdExcel';
import { otdBand, otdWeekly } from '../calc/ops';
import type { OtdMonth } from '../types';
import { fmtMonth, fmtNum } from '../ui/format';

type Read = Awaited<ReturnType<typeof readOtdWorkbook>>;
const pct = (v: number | null) => (v === null ? '–' : `${fmtNum(v * 100, 0)}%`);

/**
 * Uploads the %OTD workbook: reads the "OTD FG81" sheet, shows what was found, and on
 * confirmation replaces only that month. Monthly %OTD history in the file fills months
 * that have nothing yet.
 */
export function OtdUpload() {
  const repo = useRepo();
  const [file, setFile] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [read, setRead] = useState<Read | null>(null);
  const [month, setMonth] = useState('');
  const [done, setDone] = useState('');
  const [existing, setExisting] = useState<OtdMonth | null>(null);

  useEffect(() => {
    if (!month) { setExisting(null); return; }
    repo.getOtdMonths(month, month).then(([m]) => setExisting(m ?? null)).catch(() => setExisting(null));
  }, [repo, month, done]);

  const pick = (f: File | undefined) => {
    if (!f) return;
    setFile(f.name); setError(''); setRead(null); setDone(''); setBusy('กำลังอ่านไฟล์… (ไฟล์ใหญ่อาจใช้เวลาประมาณ 10–20 วินาที)');
    const fr = new FileReader();
    fr.onload = async () => {
      try {
        const r = await readOtdWorkbook(fr.result as ArrayBuffer);
        setRead(r); setMonth((r.updated ?? '').slice(0, 7));
      } catch (e) {
        setError(e instanceof Error && /[฀-๿]/.test(e.message) ? e.message : 'อ่านไฟล์ไม่ได้ ตรวจว่าเป็นไฟล์ .xlsx ที่มีชีต OTD FG81');
      } finally { setBusy(''); }
    };
    fr.onerror = () => { setError('อ่านไฟล์ไม่ได้'); setBusy(''); };
    fr.readAsArrayBuffer(f);
  };

  const rec = read && /^\d{4}-\d{2}$/.test(month) ? toOtdMonth(month, read) : null;
  const history = read && rec ? read.history.filter((h) => h.month < month) : [];
  const save = async () => {
    if (!rec) return;
    setBusy('กำลังบันทึก…'); setError('');
    try {
      const added = await repo.saveOtdUpload(rec, history);
      setDone(`บันทึก %OTD เดือน ${fmtMonth(month)} แล้ว${added.length ? ` และเติม %OTD รายเดือนย้อนหลัง ${added.length} เดือนที่ยังไม่มีข้อมูล` : ''}`);
      setRead(null); setFile('');
    } catch { setError('บันทึกไม่สำเร็จ ลองอีกครั้ง'); } finally { setBusy(''); }
  };

  const groups = rec?.rows?.filter((r) => r.kind === 'group') ?? [];
  return (
    <div className="panel" style={{ maxWidth: 1100, marginTop: 28 }}>
      <div className="panel-head"><h2>%OTD FG 81</h2><span className="hint">อัปโหลดไฟล์ Plan Week (.xlsx) ระบบอ่านชีต OTD FG81 และทับเฉพาะเดือนนั้น</span></div>
      <label className="upload otd-upload">
        {file ? `ไฟล์: ${file}` : 'เลือกไฟล์ Excel'}
        <input type="file" accept=".xlsx" aria-label="ไฟล์ %OTD" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      </label>
      {busy && <p className="hint" role="status">{busy}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {done && <p className="met" role="status">{done}</p>}
      {read && (
        <div className="otd-preview">
          <label>เดือนของข้อมูล <input type="month" aria-label="เดือนของ %OTD" value={month} onChange={(e) => setMonth(e.target.value)} />
            {read.updated && <span className="hint"> (ในไฟล์ Update: {read.updated})</span>}</label>
          {rec && (
            <>
              <p>
                %OTD ทั้งเดือน <b className={`otd-${otdBand(rec.pct)}`}>{pct(rec.pct)}</b>
                {' · '}W1–W4: {otdWeekly(rec).map(pct).join(' / ')}
                {' · '}{groups.length} กลุ่มสินค้า
              </p>
              {history.length > 0 && <p className="hint">ในไฟล์มี %OTD รายเดือนย้อนหลัง {history.length} เดือน จะเติมให้เฉพาะเดือนที่ยังไม่มีข้อมูล</p>}
              {existing?.source === 'upload' && <p className="hint">เดือน {fmtMonth(month)} มีข้อมูลอยู่แล้ว (Update {existing.updated ?? '–'}) จะถูกแทนที่ด้วยไฟล์นี้</p>}
              <div className="actions">
                <button type="button" onClick={save} disabled={!!busy}>บันทึก %OTD เดือน {fmtMonth(month)}</button>
                <button type="button" className="secondary" onClick={() => { setRead(null); setFile(''); }}>ยกเลิก</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
