import { useCallback, useEffect, useState } from 'react';
import { useRepo } from '../data/RepoContext';
import { useAuth } from '../auth/context';
import { ACCESS_TH, AREAS, accessOf, roleFor } from '../areas';
import { DEFAULT_LOT_OUT_TARGET, DEFAULT_PER_TARGET } from '../calc/cost';
import { DEFAULT_TARGET_LABELS, type AppUser, type AreaAccess, type AreaId, type Line, type MonthlySummary, type Setter, type Target, type TargetLabels, type Worker } from '../types';
import { fmtMonth, THAI_MONTHS } from '../ui/format';
import { CrudTable } from '../ui/CrudTable';
import type { WorkerRef } from '../data/artifactRepo';
import { parseNum } from './EntryDaily';

const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const numOrNull = (s: string) => { const n = parseNum(s); return n === null || Number.isNaN(n) ? null : n; };

type Tab = 'lines' | 'setters' | 'workers' | 'targets' | 'summary' | 'users' | 'import';

export function Settings({ manageUsers = true, initialTab }: { manageUsers?: boolean; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab ?? 'lines');
  const canImport = !!useRepo().importDocs;
  const tabs: [Tab, string][] = [['lines', 'U-Line'], ['setters', 'Setter'], ['workers', 'พนักงาน'], ['targets', 'เป้าหมายรายเดือน'], ['summary', 'ข้อมูลสรุปย้อนหลัง'],
    ...(manageUsers ? [['users', 'ผู้ใช้และสิทธิ์'] as [Tab, string]] : []), ...(canImport ? [['import', 'นำเข้าข้อมูล'] as [Tab, string]] : [])];
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
      {tab === 'import' && <ImportSection />}
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
  const [refs, setRefs] = useState<Record<string, WorkerRef>>({});
  const { rows, reload } = useList(useCallback(async () => {
    const [ws, ls, rf] = await Promise.all([repo.listWorkers(), repo.listLines(), repo.workerRefs()]);
    setLines(ls); setRefs(rf);
    return ws.sort((a, b) => a.name.localeCompare(b.name, 'th'))
      .map((w): WorkerRow => ({ ...w, lineId: ls.find((l) => l.defaultWorkerIds.includes(w.id))?.id ?? '' }));
  }, [repo]));
  return (
    <>
    <MissingWorkers refs={refs} workers={rows} lines={lines} onFixed={reload} />
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
        // Someone who appears in past records is kept (as not in use) so old reports keep the name.
        const kept: string[] = [];
        for (const id of del) {
          const w = rows.find((x) => x.id === id);
          const used = (refs[id]?.count ?? 0) - lines.filter((l) => l.defaultWorkerIds.includes(id)).length > 0;
          if (w && used) { await repo.saveWorker({ id, name: w.name.trim(), active: false }); kept.push(w.name.trim()); }
          else await repo.deleteWorker(id);
        }
        for (const l of lines) {
          const ids = next.get(l.id) ?? [];
          if (ids.join() !== l.defaultWorkerIds.join()) await repo.saveLine({ ...l, defaultWorkerIds: ids });
        }
        await reload();
        if (kept.length) return `บันทึกแล้ว ${kept.join(', ')} มีข้อมูลย้อนหลัง จึงเปลี่ยนเป็น “ไม่ใช้งาน” แทนการลบ ชื่อในรายงานเดิมจะยังถูกต้อง`;
      }}
      note="แก้ชื่อที่นี่แล้วทุกหน้าจะแสดงชื่อใหม่ทันที รวมถึงข้อมูลย้อนหลัง 1 คนประจำได้ 1 U-Line ชื่อจะขึ้นเป็นค่าเริ่มต้นในหน้ากรอกข้อมูลรายวัน วันที่ย้ายไลน์เปลี่ยนได้ตอนกรอก พนักงานที่ลาออกให้เอาติ๊ก “ใช้งาน” ออก"
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
    </>
  );
}

/**
 * Records that still point at a worker who was deleted (they showed as codes like "w20").
 * Lets the admin hand those records to a current worker, or take the name off them.
 */
export function MissingWorkers({ refs, workers, lines = [], onFixed }: { refs: Record<string, WorkerRef>; workers: Worker[]; lines?: Line[]; onFixed: () => Promise<void> | void }) {
  const repo = useRepo();
  const missing = Object.entries(refs).filter(([id, r]) => r.count > 0 && !workers.some((w) => w.id === id));
  const [pick, setPick] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  if (!missing.length) return msg ? <span className="status" role="status">{msg}</span> : null;
  const sorted = [...workers].sort((a, b) => a.name.localeCompare(b.name, 'th'));
  const fix = async (id: string) => {
    const to = pick[id] ?? '';
    setBusy(id); setMsg('');
    try {
      await repo.replaceWorker(id, to === '-' ? null : to);
      setMsg(to === '-' ? 'เอาชื่อที่ไม่มีแล้วออกจากข้อมูลเรียบร้อย' : `ย้ายข้อมูลไปที่ ${workers.find((w) => w.id === to)?.name ?? ''} เรียบร้อย`);
      await onFixed();
    } catch { setMsg('แก้ไม่สำเร็จ ลองอีกครั้ง'); } finally { setBusy(''); }
  };
  return (
    <div className="notice" role="note" style={{ width: '100%' }}>
      <b>มีข้อมูลที่อ้างถึงพนักงานที่ถูกลบไปแล้ว {missing.length} รหัส (ในรายงานจะขึ้นเป็น “ไม่พบชื่อ”)</b>
      <span>เลือกว่าข้อมูลเหล่านี้เป็นของใคร แล้วกด “แก้ข้อมูล” ระบบจะเปลี่ยนทุกวันที่เกี่ยวข้องให้เป็นชื่อนั้น</span>
      <table style={{ marginTop: 8 }}>
        <thead><tr><th>รหัสเดิม</th><th className="num">จำนวนรายการ</th><th>ช่วงวันที่</th><th>ไลน์</th><th>เป็นของ</th><th /></tr></thead>
        <tbody>
          {missing.map(([id, r]) => (
            <tr key={id}>
              <td><code>{id}</code></td>
              <td className="num">{r.count}</td>
              <td>{r.first ? `${r.first} ถึง ${r.last}` : 'ค่าเริ่มต้นของไลน์'}</td>
              <td>{(r.lineIds ?? []).map((id) => lines.find((l) => l.id === id)?.code ?? id).join(', ') || '—'}</td>
              <td>
                <select aria-label={`เป็นของ ${id}`} value={pick[id] ?? ''} onChange={(e) => setPick((p) => ({ ...p, [id]: e.target.value }))}>
                  <option value="">— เลือกพนักงาน —</option>
                  {sorted.map((w) => <option key={w.id} value={w.id}>{w.name}{w.active ? '' : ' (ไม่ใช้งาน)'}</option>)}
                  <option value="-">ไม่ระบุ (เอาชื่อออก)</option>
                </select>
              </td>
              <td><button type="button" className="sm" disabled={!pick[id] || !!busy} onClick={() => fix(id)}>{busy === id ? 'กำลังแก้…' : 'แก้ข้อมูล'}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {msg && <span role="status">{msg}</span>}
    </div>
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

interface SumRow { key: string; orig: string; month: string; per: string; sent: string; out: string; fg: string }
const isYear = (m: string) => /^\d{4}$/.test(m);
const thisYear = new Date().getFullYear();
const YEARS = Array.from({ length: thisYear - 2015 + 2 }, (_, i) => 2015 + i).reverse();
export function SummarySection() {
  const repo = useRepo();
  const { rows, reload } = useList(useCallback(async () => {
    // String range '2000'..'2100-12' covers both month rows (YYYY-MM) and year rows (YYYY).
    return (await repo.getMonthlySummaries('2000', '2100-12'))
      .sort((a, b) => b.month.localeCompare(a.month))
      .map((s: MonthlySummary): SumRow => ({ key: s.month, orig: s.month, month: s.month, per: s.per == null ? '' : String(s.per), sent: s.lotSent == null ? '' : String(s.lotSent), out: s.lotOut == null ? '' : String(s.lotOut), fg: s.lotFg == null ? '' : String(s.lotFg) }));
  }, [repo]));
  const bad = (s: string) => Number.isNaN(parseNum(s));
  return (
    <CrudTable<SumRow>
      title="ข้อมูลสรุปย้อนหลัง (เดือนที่ไม่มีข้อมูลรายวัน)" rows={rows} getId={(r) => r.key} addLabel="เพิ่มเดือน/ปี"
      filter={(r, q) => r.month.includes(q) || (!isYear(r.month) && fmtMonth(r.month).includes(q))}
      newRow={() => ({ key: newId('sum'), orig: '', month: `${thisYear}-01`, per: '', sent: '', out: '', fg: '' })}
      validate={(r, all) => (all.filter((x) => x.month === r.month).length > 1 ? `${isYear(r.month) ? `ทั้งปี ${r.month}` : fmtMonth(r.month)} มีอยู่แล้ว`
        : bad(r.per) || bad(r.sent) || bad(r.out) || bad(r.fg) ? 'กรอกตัวเลข 0 ขึ้นไป'
          : (parseNum(r.fg) ?? 0) > (parseNum(r.out) ?? Infinity) ? 'Lot out FG มากกว่า Lot out รวม' : null)}
      onSave={async (ups, del) => {
        for (const r of ups) {
          await repo.saveSummary({ month: r.month, per: parseNum(r.per), lotSent: parseNum(r.sent), lotOut: parseNum(r.out), lotFg: parseNum(r.fg) });
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
        { label: 'Lot out รวม', className: 'num', render: (r, set) => <input aria-label={`Lot out ${r.month}`} className={bad(r.out) ? 'invalid' : ''} value={r.out} onChange={(e) => set({ out: e.target.value })} /> },
        { label: 'Lot out FG', className: 'num', render: (r, set) => <input aria-label={`Lot out FG ${r.month}`} placeholder={r.out || '—'} className={bad(r.fg) ? 'invalid' : ''} value={r.fg} onChange={(e) => set({ fg: e.target.value })} /> },
      ]}
    />
  );
}

type UserRow = Omit<AppUser, 'areas'> & { key: string; password: string; admin: boolean; areas: Record<AreaId, AreaAccess> };
const ACCESS_OPTIONS: AreaAccess[] = ['none', 'view', 'edit'];
/** The access each area shows in the table: what the user has today, including the defaults. */
const rowAreas = (u: Pick<AppUser, 'role' | 'areas'>) =>
  Object.fromEntries(AREAS.map((a) => [a.id, u.role === 'admin' ? (u.areas?.[a.id] ?? accessOf({ role: 'editor' }, a.id)) : accessOf(u, a.id)])) as Record<AreaId, AreaAccess>;
export function UsersSection() {
  const repo = useRepo();
  const { user: me } = useAuth();
  const { rows, reload } = useList(useCallback(async () => (await repo.listUsers()).map((u): UserRow => (
    { ...u, key: u.uid, password: '', admin: u.role === 'admin', areas: rowAreas(u) })), [repo]));
  const isNew = (u: UserRow) => !u.uid;
  return (
    <CrudTable<UserRow>
      title="ผู้ใช้และสิทธิ์" rows={rows} getId={(u) => u.key} addLabel="เพิ่มผู้ใช้"
      newRow={() => ({ key: newId('u'), uid: '', name: '', email: '', role: 'viewer', password: '', admin: false, areas: { assembly: 'view', partWarehouse: 'none' } })}
      validate={(u, all) => {
        if (!u.name.trim() || !/^\S+@\S+\.\S+$/.test(u.email.trim())) return 'กรอกชื่อและอีเมลให้ถูกต้อง';
        if (isNew(u) && u.password.length < 6) return 'รหัสผ่านอย่างน้อย 6 ตัวอักษร';
        if (all.some((x) => x !== u && x.email.trim().toLowerCase() === u.email.trim().toLowerCase())) return `อีเมล ${u.email} ซ้ำ`;
        if (u.uid === me?.uid && !u.admin) return 'เอาสิทธิ์ผู้ดูแลระบบของตัวเองออกไม่ได้';
        return null;
      }}
      onSave={async (ups, deletedIds) => {
        for (const u of ups) {
          const v = { name: u.name.trim(), email: u.email.trim(), role: roleFor(u.admin, u.areas), areas: { ...u.areas } };
          if (isNew(u)) {
            if (!repo.createUser) throw new Error('สร้างบัญชีได้เฉพาะเว็บ Firebase');
            try { await repo.createUser(v, u.password); } catch (e) {
              const code = (e as { code?: string }).code ?? '';
              throw new Error(code.includes('email-already-in-use') ? `อีเมล ${v.email} มีบัญชีอยู่แล้ว` : code.includes('invalid-email') ? `อีเมล ${v.email} ไม่ถูกต้อง` : `สร้างบัญชี ${v.email} ไม่สำเร็จ`);
            }
          } else await repo.saveUser({ ...v, uid: u.uid });
        }
        for (const id of deletedIds) if (id !== me?.uid) await repo.deleteUser?.(id);
        await reload();
      }}
      note="กำหนดสิทธิ์แยกแต่ละพื้นที่งาน: ไม่มีสิทธิ์ = มองไม่เห็นพื้นที่งานนั้น · ดูอย่างเดียว = ดูรายงานและ Export · ดูและกรอกข้อมูล = กรอกข้อมูลรายวันและรายเดือนได้ด้วย · ผู้ดูแลระบบ = ทำได้ทุกอย่างทุกพื้นที่งาน รวมถึงตั้งค่าและจัดการผู้ใช้ · ส่งอีเมลและรหัสผ่านเริ่มต้นให้แต่ละคนเอง · ลบ = เอาสิทธิ์เข้าดูออก"
      columns={[
        { label: 'ชื่อ', render: (u, set) => <input aria-label="ชื่อผู้ใช้" className="mid" value={u.name} onChange={(e) => set({ name: e.target.value })} /> },
        { label: 'อีเมล (ใช้ล็อกอิน)', render: (u, set) => isNew(u)
          ? <input aria-label="อีเมล" type="email" style={{ width: 220, textAlign: 'left' }} value={u.email} onChange={(e) => set({ email: e.target.value })} />
          : <span>{u.email}</span> },
        { label: 'รหัสผ่านเริ่มต้น', render: (u, set) => isNew(u)
          ? <input aria-label="รหัสผ่านเริ่มต้น" className="mid" value={u.password} placeholder="อย่างน้อย 6 ตัว" onChange={(e) => set({ password: e.target.value })} />
          : <span className="hint">ตั้งไว้แล้ว</span> },
        { label: 'ผู้ดูแลระบบ', render: (u, set) => (
          <label className="admin-check"><input type="checkbox" aria-label={`ผู้ดูแลระบบ ${u.name}`} checked={u.admin} onChange={(e) => set({ admin: e.target.checked })} /></label>
        ) },
        ...AREAS.map((a) => ({ label: a.label, render: (u: UserRow, set: (p: Partial<UserRow>) => void) => u.admin
          ? <span className="hint">ทุกสิทธิ์</span>
          : (
            <select aria-label={`สิทธิ์ ${a.label} ${u.name}`} value={u.areas[a.id]} onChange={(e) => set({ areas: { ...u.areas, [a.id]: e.target.value as AreaAccess } })}>
              {ACCESS_OPTIONS.map((x) => <option key={x} value={x}>{ACCESS_TH[x]}</option>)}
            </select>
          ) })),
      ]}
    />
  );
}

type ExportDoc = { path: string; data: Record<string, unknown> };
/** Loads the JSON exported from the old Claude page into this database. */
export function ImportSection() {
  const repo = useRepo();
  const [docs, setDocs] = useState<ExportDoc[] | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const read = async (f: File | undefined) => {
    setDocs(null); setStatus('');
    if (!f) return;
    try {
      const text = await new Promise<string>((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = bad; r.readAsText(f); });
      const raw = JSON.parse(text);
      const list = (Array.isArray(raw) ? raw : []).filter((d): d is ExportDoc =>
        d && typeof d.path === 'string' && /^[A-Za-z]+\/[^/]+$/.test(d.path) && d.data && typeof d.data === 'object' && !d.path.startsWith('users/'));
      if (!list.length) { setStatus('ไฟล์นี้ไม่มีข้อมูลที่นำเข้าได้'); return; }
      setDocs(list);
    } catch { setStatus('อ่านไฟล์ไม่ได้ ต้องเป็นไฟล์ .json ที่ได้รับ'); }
  };
  const run = async () => {
    if (!docs || !repo.importDocs) return;
    setBusy(true);
    try {
      await repo.importDocs(docs, (n) => setStatus(`กำลังนำเข้า ${n}/${docs.length}`));
      setStatus(`นำเข้าเสร็จ ${docs.length} รายการ`);
    } catch { setStatus('นำเข้าไม่สำเร็จ ลองอีกครั้ง (ต้องเป็นผู้ดูแล)'); }
    finally { setBusy(false); }
  };
  const count = (p: string) => docs?.filter((d) => d.path.startsWith(p + '/')).length ?? 0;
  return (
    <div className="panel">
      <div className="panel-head"><h2>นำเข้าข้อมูลจากหน้าเดิม</h2><span className="hint">ข้อมูลเดิมเดือนเดียวกันจะถูกเขียนทับ</span></div>
      <label className="upload" style={{ position: 'relative' }}>เลือกไฟล์ .json
        <input type="file" accept="application/json,.json" aria-label="ไฟล์ข้อมูล" onChange={(e) => read(e.target.files?.[0])} /></label>
      {docs && (
        <p style={{ marginTop: 12 }}>พบ {docs.length} รายการ: {([['lines', 'U-Line'], ['workers', 'พนักงาน'], ['perMonth', '% PER (เดือน)'],
          ['lotMonth', 'Lot out (เดือน)'], ['costMonthly', 'ต้นทุน (เดือน)'], ['opsMonthly', 'ยอดผลิตและต้นทุนการผลิต (เดือน)'], ['otdMonthly', '%OTD (เดือน)'],
          ['targets', 'เป้า'], ['monthlySummary', 'สรุปย้อนหลัง']] as const).filter(([c]) => count(c) > 0).map(([c, l]) => `${l} ${count(c)}`).join(', ')}</p>
      )}
      <div className="actions">
        <button type="button" disabled={!docs || busy} onClick={run}>นำเข้า</button>
        <span className="status" role="status">{status}</span>
      </div>
    </div>
  );
}
