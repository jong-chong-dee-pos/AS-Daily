import { useCallback, useEffect, useState } from 'react';
import { useRepo } from '../data/RepoContext';
import { DEFAULT_LOT_OUT_TARGET, DEFAULT_PER_TARGET } from '../calc/cost';
import type { AppUser, Line, MonthlySummary, Role, Target, Worker } from '../types';
import { fmtMonth } from '../ui/format';
import { CrudTable } from '../ui/CrudTable';
import { parseNum } from './EntryDaily';

const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const numOrNull = (s: string) => { const n = parseNum(s); return n === null || Number.isNaN(n) ? null : n; };

type Tab = 'lines' | 'workers' | 'targets' | 'summary' | 'users';

export function Settings({ manageUsers = true }: { manageUsers?: boolean }) {
  const [tab, setTab] = useState<Tab>('lines');
  const tabs: [Tab, string][] = [['lines', 'ไลน์และ Setter'], ['workers', 'พนักงาน'], ['targets', 'เป้าหมายรายเดือน'], ['summary', 'ข้อมูลสรุปย้อนหลัง'],
    ...(manageUsers ? [['users', 'ผู้ใช้และสิทธิ์'] as [Tab, string]] : [])];
  return (
    <section>
      <div className="page-head"><h1>ตั้งค่า</h1><span className="muted">เลือก เพิ่ม แก้ไข ลบ แล้วกดบันทึก</span></div>
      <div className="tabs seg" role="tablist" aria-label="หมวดการตั้งค่า">
        {tabs.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'lines' && <LinesSection />}
      {tab === 'workers' && <WorkersSection />}
      {tab === 'targets' && <TargetsSection />}
      {tab === 'summary' && <SummarySection />}
      {tab === 'users' && <UsersSection />}
    </section>
  );
}

/** Loads a list once and again after each save. */
function useList<T>(load: () => Promise<T[]>) {
  const [rows, setRows] = useState<T[]>([]);
  const reload = useCallback(() => load().then(setRows), [load]);
  useEffect(() => { reload(); }, [reload]);
  return { rows, reload };
}

export function LinesSection() {
  const repo = useRepo();
  const { rows, reload } = useList(useCallback(() => repo.listLines(), [repo]));
  const [workers, setWorkers] = useState<Worker[]>([]);
  useEffect(() => { repo.listWorkers().then(setWorkers); }, [repo]);
  const active = workers.filter((w) => w.active).sort((a, b) => a.name.localeCompare(b.name, 'th'));
  const setters = [...new Set(rows.map((l) => l.setter))];
  return (
    <CrudTable<Line>
      title="ไลน์และ Setter" rows={rows} getId={(l) => l.id} addLabel="เพิ่มไลน์"
      filter={(l, q) => `${l.code} ${l.setter}`.toLowerCase().includes(q)}
      newRow={() => ({ id: newId('line'), code: '', order: (rows[rows.length - 1]?.order ?? 0) + 1, setter: rows[rows.length - 1]?.setter ?? '', defaultWorkerIds: [], includeInTotal: false, active: true })}
      validate={(l) => (!l.code.trim() || !l.setter.trim() ? 'กรอกรหัสไลน์และ Setter ให้ครบ' : null)}
      onSave={async (ups, del) => {
        for (const l of ups) await repo.saveLine({ ...l, code: l.code.trim(), setter: l.setter.trim() });
        for (const id of del) await repo.deleteLine(id);
        await reload();
      }}
      note="ไลน์ที่เลิกใช้แนะนำให้เอาติ๊ก “ใช้งาน” ออกแทนการลบ ข้อมูลเก่ายังแสดงในรายงานได้ ส่วนไลน์ที่ลบจะไม่มีชื่อแสดงในรายงานย้อนหลัง"
      columns={[
        { label: 'ลำดับ', className: 'num', render: (l, set) => <input aria-label={`ลำดับ ${l.code}`} style={{ width: 48 }} value={l.order} onChange={(e) => set({ order: Number(e.target.value) || 0 })} /> },
        { label: 'ไลน์', render: (l, set) => <input aria-label={`รหัสไลน์ ${l.code}`} className="mid" value={l.code} onChange={(e) => set({ code: e.target.value })} /> },
        { label: 'Setter', render: (l, set) => (
          <><input aria-label={`Setter ${l.code}`} className="mid" list="setter-list" value={l.setter} onChange={(e) => set({ setter: e.target.value })} />
            <datalist id="setter-list">{setters.map((s) => <option key={s} value={s} />)}</datalist></>
        ) },
        ...[0, 1].map((i) => ({
          label: `พนักงานประจำ ${i + 1}`,
          render: (l: Line, set: (p: Partial<Line>) => void) => (
            <select aria-label={`พนักงานประจำ ${i + 1} ${l.code}`} value={l.defaultWorkerIds[i] ?? ''}
              onChange={(e) => { const n = [...l.defaultWorkerIds]; n[i] = e.target.value; set({ defaultWorkerIds: n.filter(Boolean) }); }}>
              <option value="">—</option>
              {active.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          ),
        })),
        { label: 'นับเข้าค่ารวม', render: (l, set) => <input type="checkbox" aria-label={`นับเข้าค่ารวม ${l.code}`} checked={l.includeInTotal} onChange={(e) => set({ includeInTotal: e.target.checked })} /> },
        { label: 'ใช้งาน', render: (l, set) => <input type="checkbox" aria-label={`ใช้งาน ${l.code}`} checked={l.active} onChange={(e) => set({ active: e.target.checked })} /> },
      ]}
    />
  );
}

function WorkersSection() {
  const repo = useRepo();
  const { rows, reload } = useList(useCallback(async () => (await repo.listWorkers()).sort((a, b) => a.name.localeCompare(b.name, 'th')), [repo]));
  const [lines, setLines] = useState<Line[]>([]);
  useEffect(() => { repo.listLines().then(setLines); }, [repo, rows]);
  const lineOf = (id: string) => lines.filter((l) => l.defaultWorkerIds.includes(id)).map((l) => l.code).join(', ');
  return (
    <CrudTable<Worker>
      title="พนักงาน" rows={rows} getId={(w) => w.id} addLabel="เพิ่มพนักงาน"
      filter={(w, q) => w.name.toLowerCase().includes(q)}
      newRow={() => ({ id: newId('w'), name: '', active: true })}
      validate={(w, all) => (!w.name.trim() ? 'กรอกชื่อพนักงาน' : all.filter((x) => x.name.trim() === w.name.trim()).length > 1 ? `ชื่อ ${w.name} ซ้ำ` : null)}
      onSave={async (ups, del) => {
        for (const w of ups) await repo.saveWorker({ ...w, name: w.name.trim() });
        for (const id of del) await repo.deleteWorker(id);
        await reload();
      }}
      note="พนักงานที่ลาออกแนะนำให้เอาติ๊ก “ใช้งาน” ออก ชื่อจะไม่แสดงในหน้ากรอก แต่ยังอยู่ในรายงานรายคน"
      columns={[
        { label: 'ชื่อ - สกุล', render: (w, set) => <input aria-label="ชื่อพนักงาน" className="wide" style={{ minWidth: 220 }} value={w.name} onChange={(e) => set({ name: e.target.value })} /> },
        { label: 'ไลน์ประจำ', render: (w) => <span className="muted">{lineOf(w.id) || '—'}</span> },
        { label: 'ใช้งาน', render: (w, set) => <input type="checkbox" aria-label={`ใช้งาน ${w.name}`} checked={w.active} onChange={(e) => set({ active: e.target.checked })} /> },
      ]}
    />
  );
}

interface TargetRow { month: string; per: string; lot: string }
function TargetsSection() {
  const repo = useRepo();
  const { rows, reload } = useList(useCallback(async () => (await repo.listTargets())
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((t: Target): TargetRow => ({ month: t.month, per: String(t.perTarget), lot: String(t.lotOutTarget) })), [repo]));
  const bad = (s: string) => numOrNull(s) === null;
  const nextMonth = () => {
    const last = rows[rows.length - 1]?.month;
    if (!last) return new Date().toISOString().slice(0, 7);
    const [y, m] = last.split('-').map(Number);
    return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  };
  return (
    <CrudTable<TargetRow>
      title="เป้าหมายรายเดือน" rows={rows} getId={(r) => r.month} addLabel="เพิ่มเดือน"
      filter={(r, q) => r.month.includes(q) || fmtMonth(r.month).includes(q)}
      newRow={() => {
        const last = rows[rows.length - 1];
        return { month: nextMonth(), per: last?.per ?? String(DEFAULT_PER_TARGET), lot: last?.lot ?? String(DEFAULT_LOT_OUT_TARGET) };
      }}
      validate={(r) => (bad(r.per) || bad(r.lot) ? `กรอกเป้าเป็นตัวเลขให้ครบ (${fmtMonth(r.month)})` : null)}
      onSave={async (ups, del) => {
        for (const r of ups) await repo.saveTarget({ month: r.month, perTarget: numOrNull(r.per)!, lotOutTarget: numOrNull(r.lot)! });
        for (const m of del) await repo.deleteTarget(m);
        await reload();
      }}
      note={`เดือนที่ไม่ได้ตั้งเป้าจะใช้ค่าเริ่มต้น % PER ≥ ${DEFAULT_PER_TARGET} และ Lot out ≤ ${DEFAULT_LOT_OUT_TARGET}%`}
      columns={[
        { label: 'เดือน', render: (r) => <span>{fmtMonth(r.month)}</span> },
        { label: 'เป้า % PER (≥)', className: 'num', render: (r, set) => <input aria-label={`เป้า % PER ${r.month}`} className={bad(r.per) ? 'invalid' : ''} value={r.per} onChange={(e) => set({ per: e.target.value })} /> },
        { label: 'เป้า Lot out % (≤)', className: 'num', render: (r, set) => <input aria-label={`เป้า Lot out ${r.month}`} className={bad(r.lot) ? 'invalid' : ''} value={r.lot} onChange={(e) => set({ lot: e.target.value })} /> },
      ]}
    />
  );
}

interface SumRow { month: string; per: string; sent: string; out: string }
const isYear = (m: string) => /^\d{4}$/.test(m);
function SummarySection() {
  const repo = useRepo();
  const { rows, reload } = useList(useCallback(async () => {
    // String range '2000'..'2100-12' covers both month rows (YYYY-MM) and year rows (YYYY).
    return (await repo.getMonthlySummaries('2000', '2100-12'))
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((s: MonthlySummary): SumRow => ({ month: s.month, per: s.per == null ? '' : String(s.per), sent: s.lotSent == null ? '' : String(s.lotSent), out: s.lotOut == null ? '' : String(s.lotOut) }));
  }, [repo]));
  const bad = (s: string) => Number.isNaN(parseNum(s));
  return (
    <CrudTable<SumRow>
      title="ข้อมูลสรุปย้อนหลัง (เดือนที่ไม่มีข้อมูลรายวัน)" rows={rows} getId={(r) => r.month} addLabel="เพิ่มเดือน/ปี"
      newRow={() => ({ month: '', per: '', sent: '', out: '' })}
      validate={(r, all) => (!/^\d{4}(-(0[1-9]|1[0-2]))?$/.test(r.month) ? 'ใส่เดือนเป็น YYYY-MM หรือปีเป็น YYYY'
        : all.filter((x) => x.month === r.month).length > 1 ? `${r.month} ซ้ำ`
          : bad(r.per) || bad(r.sent) || bad(r.out) ? 'กรอกตัวเลข 0 ขึ้นไป' : null)}
      onSave={async (ups, del) => {
        for (const r of ups) await repo.saveSummary({ month: r.month, per: parseNum(r.per), lotSent: parseNum(r.sent), lotOut: parseNum(r.out) });
        for (const m of del) await repo.deleteSummary(m);
        await reload();
      }}
      note="ใช้กับเดือนก่อนเริ่มใช้ระบบ (นำเข้าจาก Excel) เดือนที่มีข้อมูลรายวันแล้ว รายงานจะคำนวณจากข้อมูลรายวันแทน แถวที่เป็นปี (เช่น 2025) คือค่าเฉลี่ยทั้งปี"
      columns={[
        { label: 'เดือน / ปี', render: (r, set) => (
          <input aria-label="เดือนหรือปี" className="mid" placeholder="2026-01" value={r.month} onChange={(e) => set({ month: e.target.value.trim() })} />
        ) },
        { label: 'แสดงเป็น', render: (r) => <span className="muted">{isYear(r.month) ? `ทั้งปี ${r.month}` : /^\d{4}-\d{2}$/.test(r.month) ? fmtMonth(r.month) : ''}</span> },
        { label: '% PER', className: 'num', render: (r, set) => <input aria-label={`% PER ${r.month}`} className={bad(r.per) ? 'invalid' : ''} value={r.per} onChange={(e) => set({ per: e.target.value })} /> },
        { label: 'Lot ส่งตรวจ', className: 'num', render: (r, set) => <input aria-label={`Lot ส่งตรวจ ${r.month}`} className={bad(r.sent) ? 'invalid' : ''} value={r.sent} onChange={(e) => set({ sent: e.target.value })} /> },
        { label: 'Lot out', className: 'num', render: (r, set) => <input aria-label={`Lot out ${r.month}`} className={bad(r.out) ? 'invalid' : ''} value={r.out} onChange={(e) => set({ out: e.target.value })} /> },
      ]}
    />
  );
}

const ROLE: Record<Role, string> = { admin: 'ผู้ดูแล', editor: 'ผู้กรอก', viewer: 'ผู้ดู' };
type UserRow = AppUser & { key: string };
function UsersSection() {
  const repo = useRepo();
  const { rows, reload } = useList(useCallback(async () => (await repo.listUsers() as AppUser[]).map((u): UserRow => ({ ...u, key: u.uid })), [repo]));
  return (
    <CrudTable<UserRow>
      title="ผู้ใช้และสิทธิ์" rows={rows} getId={(u) => u.key} addLabel="เพิ่มผู้ใช้"
      newRow={() => ({ key: newId('u'), uid: '', name: '', email: '', role: 'viewer' })}
      validate={(u) => (!u.uid.trim() || !u.name.trim() ? 'กรอก User UID และชื่อ' : null)}
      onSave={async (ups) => { for (const u of ups) await repo.saveUser({ uid: u.uid.trim(), name: u.name.trim(), email: u.email.trim(), role: u.role }); await reload(); }}
      note="สร้างบัญชีใน Firebase Console › Authentication ก่อน แล้วคัดลอก User UID มาใส่"
      columns={[
        { label: 'User UID', render: (u, set) => <input aria-label="User UID" className="mid" value={u.uid} onChange={(e) => set({ uid: e.target.value })} /> },
        { label: 'ชื่อ', render: (u, set) => <input aria-label="ชื่อ" className="mid" value={u.name} onChange={(e) => set({ name: e.target.value })} /> },
        { label: 'อีเมล', render: (u, set) => <input aria-label="อีเมล" className="mid" value={u.email} onChange={(e) => set({ email: e.target.value })} /> },
        { label: 'สิทธิ์', render: (u, set) => (
          <select aria-label={`สิทธิ์ ${u.name}`} value={u.role} onChange={(e) => set({ role: e.target.value as Role })}>
            {(['admin', 'editor', 'viewer'] as Role[]).map((r) => <option key={r} value={r}>{ROLE[r]}</option>)}
          </select>
        ) },
      ]}
    />
  );
}
