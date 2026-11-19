import { useCallback, useEffect, useState } from 'react';
import { useRepo } from '../data/RepoContext';
import { DEFAULT_LOT_OUT_TARGET, DEFAULT_PER_TARGET } from '../calc/cost';
import { DEFAULT_TARGET_LABELS, type AppUser, type Line, type MonthlySummary, type Role, type Setter, type Target, type TargetLabels, type Worker } from '../types';
import { fmtMonth, THAI_MONTHS } from '../ui/format';
import { CrudTable } from '../ui/CrudTable';
import { parseNum } from './EntryDaily';

const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const numOrNull = (s: string) => { const n = parseNum(s); return n === null || Number.isNaN(n) ? null : n; };

type Tab = 'lines' | 'setters' | 'workers' | 'targets' | 'summary' | 'users';

export function Settings({ manageUsers = true }: { manageUsers?: boolean }) {
  const [tab, setTab] = useState<Tab>('lines');
  const tabs: [Tab, string][] = [['lines', 'U-Line'], ['setters', 'Setter'], ['workers', 'พนักงาน'], ['targets', 'เป้าหมายรายเดือน'], ['summary', 'ข้อมูลสรุปย้อนหลัง'],
    ...(manageUsers ? [['users', 'ผู้ใช้และสิทธิ์'] as [Tab, string]] : [])];
  return (
    <section>
      <div className="page-head"><h1>ตั้งค่า</h1><span className="muted">เลือก เพิ่ม แก้ไข ลบ แล้วกดบันทึก</span></div>
      <div className="tabs seg" role="tablist" aria-label="หมวดการตั้งค่า">
        {tabs.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'lines' && <LinesSection />}
      {tab === 'setters' && <SettersSection />}
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

/** Setter list: saved setters plus any name still used on a line (data from before the Setter tab existed). */
async function loadSetters(repo: ReturnType<typeof useRepo>, lines?: Line[]): Promise<Setter[]> {
  const [saved, ls] = await Promise.all([repo.listSetters(), lines ? Promise.resolve(lines) : repo.listLines()]);
  const out = [...saved];
  for (const l of ls) {
    if (l.setter && !out.some((s) => s.name === l.setter)) out.push({ id: `setter-${out.length + 1}-${l.setter}`, name: l.setter, order: out.length + 1 });
  }
  return out;
}

export function LinesSection() {
  const repo = useRepo();
  const { rows, reload } = useList(useCallback(() => repo.listLines(), [repo]));
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [setters, setSetters] = useState<Setter[]>([]);
  useEffect(() => { repo.listWorkers().then(setWorkers); }, [repo]);
  useEffect(() => { loadSetters(repo, rows).then(setSetters); }, [repo, rows]);
  const name = (id: string) => workers.find((w) => w.id === id)?.name ?? '';
  return (
    <CrudTable<Line>
      title="U-Line" rows={rows} getId={(l) => l.id} addLabel="เพิ่ม U-Line"
      filter={(l, q) => `${l.code} ${l.setter}`.toLowerCase().includes(q)}
      newRow={() => ({ id: newId('line'), code: '', order: (rows[rows.length - 1]?.order ?? 0) + 1, setter: rows[rows.length - 1]?.setter ?? setters[0]?.name ?? '', defaultWorkerIds: [], includeInTotal: false, active: true })}
      validate={(l, all) => (!l.code.trim() || !l.setter.trim() ? 'กรอกชื่อ U-Line และเลือก Setter ให้ครบ'
        : all.filter((x) => x.code.trim().toLowerCase() === l.code.trim().toLowerCase()).length > 1 ? `ชื่อ U-Line ${l.code} ซ้ำ` : null)}
      onSave={async (ups, del) => {
        for (const l of ups) await repo.saveLine({ ...l, code: l.code.trim() });
        for (const id of del) await repo.deleteLine(id);
        await reload();
      }}
      note="ไลน์ที่เลิกใช้แนะนำให้เอาติ๊ก “ใช้งาน” ออกแทนการลบ ข้อมูลเก่ายังแสดงในรายงาน ส่วนพนักงานประจำเลือกได้ที่แท็บพนักงาน"
      columns={[
        { label: 'ลำดับ', className: 'num', render: (l, set) => <input aria-label={`ลำดับ ${l.code}`} style={{ width: 48 }} value={l.order} onChange={(e) => set({ order: Number(e.target.value) || 0 })} /> },
        { label: 'ชื่อ U-Line', render: (l, set) => <input aria-label={`ชื่อ U-Line ${l.code}`} className="mid" value={l.code} onChange={(e) => set({ code: e.target.value })} /> },
        { label: 'Setter', render: (l, set) => (
          <select aria-label={`Setter ${l.code}`} value={l.setter} onChange={(e) => set({ setter: e.target.value })}>
            <option value="">— เลือก —</option>
            {setters.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
        ) },
        { label: 'พนักงานประจำ', render: (l) => <span className="muted">{l.defaultWorkerIds.map(name).filter(Boolean).join(', ') || '—'}</span> },
        { label: 'นับเข้าค่ารวม', render: (l, set) => <input type="checkbox" aria-label={`นับเข้าค่ารวม ${l.code}`} checked={l.includeInTotal} onChange={(e) => set({ includeInTotal: e.target.checked })} /> },
        { label: 'ใช้งาน', render: (l, set) => <input type="checkbox" aria-label={`ใช้งาน ${l.code}`} checked={l.active} onChange={(e) => set({ active: e.target.checked })} /> },
      ]}
    />
  );
}

interface SetterRow { id: string; name: string; orig: string; order: number; lineIds: string[] }
export function SettersSection() {
  const repo = useRepo();
  const [lines, setLines] = useState<Line[]>([]);
  const { rows, reload } = useList(useCallback(async () => {
    const ls = await repo.listLines();
    setLines(ls);
    return (await loadSetters(repo, ls)).map((s): SetterRow => ({ id: s.id, name: s.name, orig: s.name, order: s.order, lineIds: ls.filter((l) => l.setter === s.name).map((l) => l.id) }));
  }, [repo]));
  const ownerOf = (lineId: string, self: SetterRow) => rows.find((r) => r.id !== self.id && r.lineIds.includes(lineId))?.name;
  return (
    <CrudTable<SetterRow>
      title="Setter" rows={rows} getId={(r) => r.id} addLabel="เพิ่ม Setter"
      filter={(r, q) => r.name.toLowerCase().includes(q)}
      newRow={() => ({ id: newId('setter'), name: '', orig: '', order: (rows[rows.length - 1]?.order ?? 0) + 1, lineIds: [] })}
      validate={(r, all) => (!r.name.trim() ? 'กรอกชื่อ Setter'
        : all.filter((x) => x.name.trim() === r.name.trim()).length > 1 ? `ชื่อ Setter ${r.name} ซ้ำ` : null)}
      onSave={async (ups, del) => {
        const next = new Map(lines.map((l) => [l.id, l.setter]));
        for (const id of del) {
          const r = rows.find((x) => x.id === id);
          if (r) for (const [lid, s] of next) if (s === r.orig) next.set(lid, '');
          await repo.deleteSetter(id);
        }
        for (const r of ups) {
          const nm = r.name.trim();
          await repo.saveSetter({ id: r.id, name: nm, order: r.order });
          for (const [lid, s] of next) {
            if (r.lineIds.includes(lid)) next.set(lid, nm);
            else if (r.orig && s === r.orig) next.set(lid, '');
          }
        }
        for (const l of lines) if (next.get(l.id) !== l.setter) await repo.saveLine({ ...l, setter: next.get(l.id) ?? '' });
        await reload();
      }}
      note="1 U-Line มี Setter ได้คนเดียว ติ๊กไลน์ที่ Setter คนอื่นดูแลอยู่ ไลน์จะย้ายมาที่ Setter คนนี้เมื่อกดบันทึก"
      columns={[
        { label: 'ลำดับ', className: 'num', render: (r, set) => <input aria-label={`ลำดับ Setter ${r.name}`} style={{ width: 48 }} value={r.order} onChange={(e) => set({ order: Number(e.target.value) || 0 })} /> },
        { label: 'ชื่อ Setter', render: (r, set) => <input aria-label="ชื่อ Setter" className="mid" style={{ width: 170 }} value={r.name} onChange={(e) => set({ name: e.target.value })} /> },
        { label: 'U-Line ที่รับผิดชอบ', render: (r, set) => (
          <div className="chips">
            {lines.map((l) => {
              const on = r.lineIds.includes(l.id), other = ownerOf(l.id, r);
              return (
                <label key={l.id} className={`chip ${on ? 'on' : ''} ${!on && other ? 'taken' : ''}`} title={!on && other ? `ตอนนี้อยู่กับ ${other}` : undefined}>
                  <input type="checkbox" aria-label={`${r.name} ดูแล ${l.code}`} checked={on}
                    onChange={() => set({ lineIds: on ? r.lineIds.filter((x) => x !== l.id) : [...r.lineIds, l.id] })} />
                  {l.code}
                </label>
              );
            })}
          </div>
        ) },
        { label: 'จำนวน', className: 'num', render: (r) => <span>{r.lineIds.length}</span> },
      ]}
    />
  );
}

type WorkerRow = Worker & { lineId: string };
export function WorkersSection() {
  const repo = useRepo();
  const [lines, setLines] = useState<Line[]>([]);
  const { rows, reload } = useList(useCallback(async () => {
    const [ws, ls] = await Promise.all([repo.listWorkers(), repo.listLines()]);
    setLines(ls);
    return ws.sort((a, b) => a.name.localeCompare(b.name, 'th'))
      .map((w): WorkerRow => ({ ...w, lineId: ls.find((l) => l.defaultWorkerIds.includes(w.id))?.id ?? '' }));
  }, [repo]));
  return (
    <CrudTable<WorkerRow>
      title="พนักงาน" rows={rows} getId={(w) => w.id} addLabel="เพิ่มพนักงาน"
      filter={(w, q) => `${w.name} ${lines.find((l) => l.id === w.lineId)?.code ?? ''}`.toLowerCase().includes(q)}
      newRow={() => ({ id: newId('w'), name: '', active: true, lineId: '' })}
      validate={(w, all) => (!w.name.trim() ? 'กรอกชื่อพนักงาน' : all.filter((x) => x.name.trim() === w.name.trim()).length > 1 ? `ชื่อ ${w.name} ซ้ำ` : null)}
      onSave={async (ups, del) => {
        const next = new Map(lines.map((l) => [l.id, [...l.defaultWorkerIds]]));
        const touched = new Set([...ups.map((w) => w.id), ...del]);
        for (const [lid, ids] of next) next.set(lid, ids.filter((id) => !touched.has(id)));
        for (const w of ups) {
          await repo.saveWorker({ id: w.id, name: w.name.trim(), active: w.active });
          if (w.lineId) next.get(w.lineId)?.push(w.id);
        }
        for (const id of del) await repo.deleteWorker(id);
        for (const l of lines) {
          const ids = next.get(l.id) ?? [];
          if (ids.join() !== l.defaultWorkerIds.join()) await repo.saveLine({ ...l, defaultWorkerIds: ids });
        }
        await reload();
      }}
      note="1 คนประจำได้ 1 U-Line ชื่อจะขึ้นเป็นค่าเริ่มต้นในหน้ากรอกข้อมูลรายวัน วันที่ย้ายไลน์เปลี่ยนได้ตอนกรอก พนักงานที่ลาออกให้เอาติ๊ก “ใช้งาน” ออก"
      columns={[
        { label: 'ชื่อ - สกุล', render: (w, set) => <input aria-label="ชื่อพนักงาน" className="wide" style={{ minWidth: 220 }} value={w.name} onChange={(e) => set({ name: e.target.value })} /> },
        { label: 'U-Line ประจำ', render: (w, set) => (
          <select aria-label={`U-Line ประจำ ${w.name}`} value={w.lineId} onChange={(e) => set({ lineId: e.target.value })}>
            <option value="">— ไม่ประจำไลน์ —</option>
            {lines.map((l) => <option key={l.id} value={l.id}>{l.code}{l.setter ? ` (${l.setter})` : ''}</option>)}
          </select>
        ) },
        { label: 'ใช้งาน', render: (w, set) => <input type="checkbox" aria-label={`ใช้งาน ${w.name}`} checked={w.active} onChange={(e) => set({ active: e.target.checked })} /> },
      ]}
    />
  );
}

/** Renames the two target columns; the names show in Settings, the Dashboard and chart legends. */
function TargetNames({ value, onSaved }: { value: TargetLabels; onSaved: (l: TargetLabels) => void }) {
  const repo = useRepo();
  const [v, setV] = useState(value);
  const [status, setStatus] = useState('');
  useEffect(() => setV(value), [value]);
  const changed = v.per !== value.per || v.lot !== value.lot;
  const ok = v.per.trim() && v.lot.trim();
  return (
    <div className="panel" style={{ marginBottom: 12 }}>
      <div className="panel-head"><h2>ชื่อเป้าหมาย</h2><span className="hint">ชื่อนี้ใช้เป็นหัวคอลัมน์ และแสดงใน Dashboard กับกราฟ</span></div>
      <div className="toolbar" style={{ boxShadow: 'none', border: 0, padding: 0, margin: 0 }}>
        <label>เป้าที่ 1 (% PER, ยิ่งสูงยิ่งดี) <input aria-label="ชื่อเป้า % PER" value={v.per} onChange={(e) => { setV({ ...v, per: e.target.value }); setStatus(''); }} style={{ width: 180 }} /></label>
        <label>เป้าที่ 2 (Lot out, ยิ่งต่ำยิ่งดี) <input aria-label="ชื่อเป้า Lot out" value={v.lot} onChange={(e) => { setV({ ...v, lot: e.target.value }); setStatus(''); }} style={{ width: 180 }} /></label>
        <button type="button" className="sm" disabled={!changed || !ok} onClick={async () => {
          const l = { per: v.per.trim(), lot: v.lot.trim() };
          try { await repo.saveTargetLabels(l); onSaved(l); setStatus('บันทึกชื่อแล้ว'); } catch { setStatus('บันทึกไม่สำเร็จ ลองอีกครั้ง'); }
        }}>บันทึกชื่อ</button>
        <button type="button" className="secondary sm" onClick={() => setV(DEFAULT_TARGET_LABELS)}>ใช้ชื่อเดิม</button>
        <span className="status" role="status">{!ok ? 'กรอกชื่อให้ครบทั้ง 2 ช่อง' : status}</span>
      </div>
    </div>
  );
}

interface TargetRow { month: string; per: string; lot: string }
function TargetsSection() {
  const repo = useRepo();
  const [labels, setLabels] = useState<TargetLabels>(DEFAULT_TARGET_LABELS);
  useEffect(() => { repo.getTargetLabels().then((l) => l && setLabels({ ...DEFAULT_TARGET_LABELS, ...l })); }, [repo]);
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
    <>
      <TargetNames value={labels} onSaved={setLabels} />
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
        note={`เดือนที่ไม่ได้ตั้งเป้าจะใช้ค่าเริ่มต้น ${labels.per} ≥ ${DEFAULT_PER_TARGET} และ ${labels.lot} ≤ ${DEFAULT_LOT_OUT_TARGET}%`}
        columns={[
          { label: 'เดือน', render: (r) => <span>{fmtMonth(r.month)}</span> },
          { label: `${labels.per} (≥)`, className: 'num', render: (r, set) => <input aria-label={`เป้า % PER ${r.month}`} className={bad(r.per) ? 'invalid' : ''} value={r.per} onChange={(e) => set({ per: e.target.value })} /> },
          { label: `${labels.lot} % (≤)`, className: 'num', render: (r, set) => <input aria-label={`เป้า Lot out ${r.month}`} className={bad(r.lot) ? 'invalid' : ''} value={r.lot} onChange={(e) => set({ lot: e.target.value })} /> },
        ]}
      />
    </>
  );
}

interface SumRow { key: string; orig: string; month: string; per: string; sent: string; out: string }
const isYear = (m: string) => /^\d{4}$/.test(m);
const thisYear = new Date().getFullYear();
const YEARS = Array.from({ length: thisYear - 2015 + 2 }, (_, i) => 2015 + i).reverse();
export function SummarySection() {
  const repo = useRepo();
  const { rows, reload } = useList(useCallback(async () => {
    // String range '2000'..'2100-12' covers both month rows (YYYY-MM) and year rows (YYYY).
    return (await repo.getMonthlySummaries('2000', '2100-12'))
      .sort((a, b) => b.month.localeCompare(a.month))
      .map((s: MonthlySummary): SumRow => ({ key: s.month, orig: s.month, month: s.month, per: s.per == null ? '' : String(s.per), sent: s.lotSent == null ? '' : String(s.lotSent), out: s.lotOut == null ? '' : String(s.lotOut) }));
  }, [repo]));
  const bad = (s: string) => Number.isNaN(parseNum(s));
  return (
    <CrudTable<SumRow>
      title="ข้อมูลสรุปย้อนหลัง (เดือนที่ไม่มีข้อมูลรายวัน)" rows={rows} getId={(r) => r.key} addLabel="เพิ่มเดือน/ปี"
      filter={(r, q) => r.month.includes(q) || (!isYear(r.month) && fmtMonth(r.month).includes(q))}
      newRow={() => ({ key: newId('sum'), orig: '', month: `${thisYear}-01`, per: '', sent: '', out: '' })}
      validate={(r, all) => (all.filter((x) => x.month === r.month).length > 1 ? `${isYear(r.month) ? `ทั้งปี ${r.month}` : fmtMonth(r.month)} มีอยู่แล้ว`
        : bad(r.per) || bad(r.sent) || bad(r.out) ? 'กรอกตัวเลข 0 ขึ้นไป' : null)}
      onSave={async (ups, del) => {
        for (const r of ups) {
          await repo.saveSummary({ month: r.month, per: parseNum(r.per), lotSent: parseNum(r.sent), lotOut: parseNum(r.out) });
          if (r.orig && r.orig !== r.month) await repo.deleteSummary(r.orig);
        }
        for (const k of del) { const r = rows.find((x) => x.key === k); if (r?.orig) await repo.deleteSummary(r.orig); }
        await reload();
      }}
      note="ใช้กับเดือนก่อนเริ่มใช้ระบบ (นำเข้าจาก Excel) เดือนที่มีข้อมูลรายวันแล้ว รายงานจะคำนวณจากข้อมูลรายวันแทน เลือก “ทั้งปี” สำหรับค่าเฉลี่ยทั้งปี"
      columns={[
        { label: 'ปี', render: (r, set) => (
          <select aria-label={`ปี ${r.month}`} value={r.month.slice(0, 4)} onChange={(e) => set({ month: e.target.value + r.month.slice(4) })}>
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        ) },
        { label: 'เดือน', render: (r, set) => (
          <select aria-label={`เดือน ${r.month}`} value={isYear(r.month) ? '' : r.month.slice(5, 7)} onChange={(e) => set({ month: r.month.slice(0, 4) + (e.target.value ? `-${e.target.value}` : '') })}>
            <option value="">ทั้งปี</option>
            {THAI_MONTHS.map((t, i) => <option key={t} value={String(i + 1).padStart(2, '0')}>{t}</option>)}
          </select>
        ) },
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
