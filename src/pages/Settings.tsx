import { useEffect, useState } from 'react';
import { useRepo } from '../data/RepoContext';
import { targetFor } from '../calc/cost';
import { monthsIn } from '../calc/period';
import type { AppUser, Line, Role, Target, Worker } from '../types';
import { THAI_MONTHS } from '../ui/format';
import { parseNum } from './EntryDaily';

const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}`;

export function Settings() {
  return (
    <section>
      <div className="page-head"><h1>ตั้งค่า</h1><span className="muted">สำหรับผู้ดูแลระบบ</span></div>
      <LinesSection />
      <WorkersSection />
      <TargetsSection />
      <UsersSection />
    </section>
  );
}

function useSaver() {
  const [status, setStatus] = useState('');
  const run = async (f: () => Promise<unknown>, ok: string) => {
    setStatus('กำลังบันทึก…');
    try { await f(); setStatus(ok); } catch { setStatus('บันทึกไม่สำเร็จ ลองอีกครั้ง'); }
  };
  return { status, run };
}

export function LinesSection() {
  const repo = useRepo();
  const [lines, setLines] = useState<Line[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const { status, run } = useSaver();
  useEffect(() => { Promise.all([repo.listLines(), repo.listWorkers()]).then(([l, w]) => { setLines(l); setWorkers(w); }); }, [repo]);
  const edit = (id: string, patch: Partial<Line>) => {
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    setDirty((d) => new Set(d).add(id));
  };
  const add = () => {
    const id = newId('line');
    setLines((ls) => [...ls, { id, code: '', order: (ls[ls.length - 1]?.order ?? 0) + 1, setter: ls[ls.length - 1]?.setter ?? '', defaultWorkerIds: [], includeInTotal: false, active: true }]);
    setDirty((d) => new Set(d).add(id));
  };
  const invalid = lines.some((l) => dirty.has(l.id) && (!l.code.trim() || !l.setter.trim()));
  const active = workers.filter((w) => w.active);
  return (
    <>
      <h2>ไลน์และ Setter</h2>
      <div className="tablewrap"><table>
        <thead><tr><th className="num">ลำดับ</th><th>ไลน์</th><th>Setter</th><th>พนักงานประจำ</th><th>นับเข้าค่ารวม</th><th>ใช้งาน</th></tr></thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id}>
              <td className="num"><input aria-label={`ลำดับ ${l.code}`} style={{ width: 56 }} value={l.order} onChange={(e) => edit(l.id, { order: Number(e.target.value) || 0 })} /></td>
              <td><input aria-label={`รหัสไลน์ ${l.code}`} className="wide" value={l.code} onChange={(e) => edit(l.id, { code: e.target.value })} /></td>
              <td><input aria-label={`Setter ${l.code}`} className="wide" value={l.setter} onChange={(e) => edit(l.id, { setter: e.target.value })} /></td>
              <td>{[0, 1].map((i) => (
                <select key={i} aria-label={`พนักงานประจำ ${i + 1} ${l.code}`} value={l.defaultWorkerIds[i] ?? ''}
                  onChange={(e) => { const n = [...l.defaultWorkerIds]; n[i] = e.target.value; edit(l.id, { defaultWorkerIds: n.filter(Boolean) }); }}>
                  <option value="">—</option>
                  {active.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              ))}</td>
              <td><input type="checkbox" aria-label={`นับเข้าค่ารวม ${l.code}`} checked={l.includeInTotal} onChange={(e) => edit(l.id, { includeInTotal: e.target.checked })} /></td>
              <td><input type="checkbox" aria-label={`ใช้งาน ${l.code}`} checked={l.active} onChange={(e) => edit(l.id, { active: e.target.checked })} /></td>
            </tr>
          ))}
        </tbody>
      </table></div>
      {invalid && <p className="error" role="alert">กรอกรหัสไลน์และ Setter ให้ครบ</p>}
      <div className="actions">
        <button type="button" className="secondary" onClick={add}>เพิ่มไลน์</button>
        <button type="button" disabled={!dirty.size || invalid} onClick={() => run(async () => {
          for (const l of lines.filter((x) => dirty.has(x.id))) await repo.saveLine({ ...l, code: l.code.trim(), setter: l.setter.trim() });
          setDirty(new Set());
        }, 'บันทึกไลน์แล้ว')}>บันทึกไลน์</button>
        <span className="status" role="status">{status}</span>
      </div>
      <p className="muted">ไลน์ที่ปิดใช้งานจะไม่แสดงในหน้ากรอก แต่ข้อมูลเดิมยังอยู่ในรายงาน</p>
    </>
  );
}

function WorkersSection() {
  const repo = useRepo();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const { status, run } = useSaver();
  useEffect(() => { repo.listWorkers().then((w) => setWorkers(w.sort((a, b) => a.name.localeCompare(b.name, 'th')))); }, [repo]);
  const edit = (id: string, patch: Partial<Worker>) => { setWorkers((ws) => ws.map((w) => (w.id === id ? { ...w, ...patch } : w))); setDirty((d) => new Set(d).add(id)); };
  const invalid = workers.some((w) => dirty.has(w.id) && !w.name.trim());
  return (
    <>
      <h2>พนักงาน</h2>
      <div className="tablewrap"><table>
        <thead><tr><th>ชื่อ</th><th>ใช้งาน</th></tr></thead>
        <tbody>{workers.map((w) => (
          <tr key={w.id}>
            <td><input aria-label="ชื่อพนักงาน" className="wide" value={w.name} onChange={(e) => edit(w.id, { name: e.target.value })} /></td>
            <td><input type="checkbox" aria-label={`ใช้งาน ${w.name}`} checked={w.active} onChange={(e) => edit(w.id, { active: e.target.checked })} /></td>
          </tr>
        ))}</tbody>
      </table></div>
      <div className="actions">
        <button type="button" className="secondary" onClick={() => { const id = newId('w'); setWorkers((ws) => [...ws, { id, name: '', active: true }]); setDirty((d) => new Set(d).add(id)); }}>เพิ่มพนักงาน</button>
        <button type="button" disabled={!dirty.size || invalid} onClick={() => run(async () => {
          for (const w of workers.filter((x) => dirty.has(x.id))) await repo.saveWorker({ ...w, name: w.name.trim() });
          setDirty(new Set());
        }, 'บันทึกพนักงานแล้ว')}>บันทึกพนักงาน</button>
        <span className="status" role="status">{status}</span>
      </div>
    </>
  );
}

function TargetsSection() {
  const repo = useRepo();
  const [year, setYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState<{ month: string; per: string; lot: string }[]>([]);
  const { status, run } = useSaver();
  useEffect(() => {
    repo.listTargets().then((ts: Target[]) => setRows(monthsIn({ kind: 'year', year }).map((m) => {
      const t = targetFor(ts, m);
      return { month: m, per: String(t.perTarget), lot: String(t.lotOutTarget) };
    })));
  }, [repo, year]);
  const invalid = rows.some((r) => parseNum(r.per) === null || Number.isNaN(parseNum(r.per)) || parseNum(r.lot) === null || Number.isNaN(parseNum(r.lot)));
  return (
    <>
      <h2>เป้าหมายรายเดือน</h2>
      <label className="muted">ปี <select aria-label="ปีของเป้าหมาย" value={year} onChange={(e) => setYear(Number(e.target.value))}>
        {[2024, 2025, 2026, 2027, 2028].map((y) => <option key={y}>{y}</option>)}</select></label>
      <div className="tablewrap" style={{ marginTop: 8 }}><table>
        <thead><tr><th>เดือน</th><th className="num">เป้า % PER (≥)</th><th className="num">เป้า Lot out % (≤)</th></tr></thead>
        <tbody>{rows.map((r, i) => (
          <tr key={r.month}><td>{THAI_MONTHS[i]}</td>
            <td className="num"><input aria-label={`เป้า % PER ${THAI_MONTHS[i]}`} value={r.per} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, per: e.target.value } : x)))} /></td>
            <td className="num"><input aria-label={`เป้า Lot out ${THAI_MONTHS[i]}`} value={r.lot} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, lot: e.target.value } : x)))} /></td>
          </tr>
        ))}</tbody>
      </table></div>
      {invalid && <p className="error" role="alert">กรอกเป้าเป็นตัวเลขให้ครบทุกเดือน</p>}
      <div className="actions">
        <button type="button" disabled={invalid} onClick={() => run(async () => {
          for (const r of rows) await repo.saveTarget({ month: r.month, perTarget: parseNum(r.per)!, lotOutTarget: parseNum(r.lot)! });
        }, `บันทึกเป้าปี ${year} แล้ว`)}>บันทึกเป้าหมาย</button>
        <span className="status" role="status">{status}</span>
      </div>
    </>
  );
}

function UsersSection() {
  const repo = useRepo();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [form, setForm] = useState({ uid: '', name: '', email: '', role: 'viewer' as Role });
  const { status, run } = useSaver();
  const reload = () => repo.listUsers().then(setUsers);
  useEffect(() => { reload(); }, [repo]); // eslint-disable-line react-hooks/exhaustive-deps
  const ROLE: Record<Role, string> = { admin: 'ผู้ดูแล', editor: 'ผู้กรอก', viewer: 'ผู้ดู' };
  return (
    <>
      <h2>ผู้ใช้และสิทธิ์</h2>
      <div className="tablewrap"><table>
        <thead><tr><th>ชื่อ</th><th>อีเมล</th><th>สิทธิ์</th></tr></thead>
        <tbody>{users.map((u) => (
          <tr key={u.uid}><td>{u.name}</td><td>{u.email}</td>
            <td><select aria-label={`สิทธิ์ ${u.name}`} value={u.role} onChange={(e) => run(async () => {
              await repo.saveUser({ ...u, role: e.target.value as Role }); await reload();
            }, `เปลี่ยนสิทธิ์ ${u.name} แล้ว`)}>
              {(['admin', 'editor', 'viewer'] as Role[]).map((r) => <option key={r} value={r}>{ROLE[r]}</option>)}
            </select></td></tr>
        ))}</tbody>
      </table></div>
      <p className="muted">เพิ่มผู้ใช้ใหม่: สร้างบัญชีใน Firebase Console › Authentication ก่อน แล้วคัดลอก User UID มาใส่ด้านล่าง</p>
      <div className="actions">
        <input aria-label="User UID" placeholder="User UID" value={form.uid} onChange={(e) => setForm({ ...form, uid: e.target.value })} />
        <input aria-label="ชื่อ" placeholder="ชื่อ" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input aria-label="อีเมล" placeholder="อีเมล" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <select aria-label="สิทธิ์ผู้ใช้ใหม่" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
          {(['admin', 'editor', 'viewer'] as Role[]).map((r) => <option key={r} value={r}>{ROLE[r]}</option>)}
        </select>
        <button type="button" disabled={!form.uid.trim() || !form.name.trim()} onClick={() => run(async () => {
          await repo.saveUser({ uid: form.uid.trim(), name: form.name.trim(), email: form.email.trim(), role: form.role });
          setForm({ uid: '', name: '', email: '', role: 'viewer' }); await reload();
        }, 'เพิ่มผู้ใช้แล้ว')}>เพิ่มผู้ใช้</button>
        <span className="status" role="status">{status}</span>
      </div>
    </>
  );
}
