import { useEffect, useRef, useState } from 'react';
import { useRepo } from '../../data/RepoContext';
import type { PwBaseline, PwTargets } from '../../types';
import { bucketTotal } from '../../calc/pw';
import { fmtNum } from '../../ui/format';
import { parseNum } from '../EntryDaily';
import { ImportSection, UsersSection } from '../Settings';
import { NumInput, useEnterMovesDown } from '../../ui/entryKit';

const FIELDS: { key: keyof PwTargets; label: string; hint: string }[] = [
  { key: 'missingMax', label: 'Missing Part: MAX', hint: 'รายการต่อเดือน' },
  { key: 'stockDiff', label: 'Stock Diff: Target', hint: 'Amt' },
  { key: 'per', label: '% Performance: เป้า', hint: 'ทั้งสองทีม (%)' },
  { key: 'countItem', label: 'นับสต๊อก: Target Item', hint: 'รายการ' },
  { key: 'manpower', label: 'แผนประกอบ: กำลังพล', hint: 'ชิ้นต่อวัน' },
];
type Tab = 'targets' | 'history' | 'users' | 'import';

/** Part Warehouse settings (admins): targets, the earlier-year columns, users and import. */
export function PwSettings({ manageUsers = true }: { manageUsers?: boolean }) {
  const [tab, setTab] = useState<Tab>('targets');
  const canImport = !!useRepo().importDocs;
  const tabs: [Tab, string][] = [['targets', 'เป้าหมาย'], ['history', 'ข้อมูลปีก่อน'],
    ...(manageUsers ? [['users', 'ผู้ใช้และสิทธิ์'] as [Tab, string]] : []), ...(canImport ? [['import', 'นำเข้าข้อมูล'] as [Tab, string]] : [])];
  return (
    <section>
      <div className="page-head"><h1>ตั้งค่า Part Warehouse</h1></div>
      <div className="tabs seg" role="tablist" aria-label="หมวดการตั้งค่า">
        {tabs.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'targets' && <TargetsForm />}
      {tab === 'history' && <BaselineTable />}
      {tab === 'users' && <UsersSection />}
      {tab === 'import' && <ImportSection />}
    </section>
  );
}

export function TargetsForm() {
  const repo = useRepo();
  const [vals, setVals] = useState<Record<keyof PwTargets, string> | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const form = useRef<HTMLDivElement>(null);
  useEnterMovesDown(form);
  useEffect(() => {
    repo.getPwTargets().then((t) => setVals(Object.fromEntries(FIELDS.map((f) => [f.key, String(t[f.key])])) as Record<keyof PwTargets, string>))
      .catch(() => setStatus('โหลดข้อมูลไม่ได้ ลองอีกครั้ง'));
  }, [repo]);
  if (!vals) return <p className="empty">{status || 'กำลังโหลด…'}</p>;
  const invalid = FIELDS.some((f) => { const n = parseNum(vals[f.key]); return n === null || Number.isNaN(n); });
  const save = async () => {
    setBusy(true); setStatus('กำลังบันทึก…');
    try {
      await repo.savePwTargets(Object.fromEntries(FIELDS.map((f) => [f.key, parseNum(vals[f.key])])) as unknown as PwTargets);
      setStatus('บันทึกเป้าหมายแล้ว กราฟใช้ค่าใหม่ทันที');
    } catch { setStatus('บันทึกไม่สำเร็จ ลองอีกครั้ง (ต้องเป็นผู้ดูแล)'); }
    finally { setBusy(false); }
  };
  return (
    <div className="panel" ref={form} style={{ maxWidth: 900 }}>
      <div className="panel-head"><h2>เป้าหมาย</h2><span className="hint">ใช้กับทุกเดือนในกราฟ ส่วนคอลัมน์ปีก่อนใช้เป้าของปีนั้น</span></div>
      <div className="ops-grid">
        {FIELDS.map((f) => (
          <label key={f.key} className="ops-field">
            <span>{f.label}<small> {f.hint}</small></span>
            <NumInput aria-label={f.label} inputMode="decimal" value={vals[f.key]} className={(() => { const n = parseNum(vals[f.key]); return n === null || Number.isNaN(n) ? 'invalid' : ''; })()}
              onChange={(e) => { const v = e.target.value; setVals((s) => ({ ...s!, [f.key]: v })); setStatus(''); }} />
          </label>
        ))}
      </div>
      {invalid && <p className="error" role="alert">กรอกตัวเลขให้ครบทุกช่อง</p>}
      <div className="actions">
        <button type="button" onClick={save} disabled={busy || invalid}>บันทึก</button>
        <span className="status" role="status">{status}</span>
      </div>
    </div>
  );
}

/** The columns before January on the charts, as imported, so the admin can check them. */
function BaselineTable() {
  const repo = useRepo();
  const [base, setBase] = useState<{ forYear: number | null; columns: PwBaseline[] } | null>(null);
  useEffect(() => { repo.getPwBaselines().then(setBase).catch(() => setBase({ forYear: null, columns: [] })); }, [repo]);
  if (!base) return <p className="empty">กำลังโหลด…</p>;
  if (!base.columns.length) return <p className="empty">ยังไม่มีข้อมูลปีก่อน นำเข้าได้ที่แท็บ นำเข้าข้อมูล</p>;
  const n = (v: number | null | undefined, d = 2) => (v == null ? '' : fmtNum(v, d));
  return (
    <div className="panel">
      <div className="panel-head"><h2>ข้อมูลปีก่อน</h2><span className="hint">แสดงหน้ากราฟของปี {base.forYear} ก่อนเดือน Jan · แก้ไขโดยนำเข้าไฟล์ใหม่</span></div>
      <div className="tablewrap">
        <table>
          <thead><tr><th>คอลัมน์</th><th className="num">PUR</th><th className="num">WIP</th><th className="num">Missing Part</th><th className="num">MAX</th>
            <th className="num">Stock Diff</th><th className="num">Target</th><th className="num">% ทีมจ่าย</th><th className="num">เป้า</th><th className="num">% ทีมนับ</th><th className="num">เป้า</th><th className="num">Target Item</th></tr></thead>
          <tbody>
            {base.columns.map((c) => (
              <tr key={c.id}>
                <td>{c.label}</td><td className="num">{n(bucketTotal(c.pur))}</td><td className="num">{n(bucketTotal(c.inh))}</td>
                <td className="num">{n(c.missingCount, 0)}</td><td className="num">{n(c.missingMax, 0)}</td>
                <td className="num">{n(c.stockDiff, 3)}</td><td className="num">{n(c.stockDiffTarget, 2)}</td>
                <td className="num">{n(c.perIssue, 0)}</td><td className="num">{n(c.perIssueTarget, 0)}</td>
                <td className="num">{n(c.perCount, 0)}</td><td className="num">{n(c.perCountTarget, 0)}</td><td className="num">{n(c.countItemTarget, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
