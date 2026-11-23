import { Photo } from '../ui/Photo';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRepo } from '../data/RepoContext';
import { ABSENCE_LABEL, type Absence, type AbsenceReason, type Line, type LotItem, type LotKind, type Worker } from '../types';
import { workerLabel } from '../ui/labels';
import { daysInMonth } from '../calc/period';
import { fmtDate, fmtMonth, todayIso } from '../ui/format';

interface Row { workerIds: string[]; per: string }

/** "" → null (blank day), valid number ≥ 0 → number, anything else → NaN. */
export function parseNum(s: string): number | null {
  const t = s.trim().replace(/,/g, '');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}
const bad = (s: string) => Number.isNaN(parseNum(s));
const newKey = () => `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const WEEKDAY = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const shiftDay = (d: string, n: number) => {
  const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};

export function EntryDaily({ initialDate }: { initialDate?: string }) {
  const repo = useRepo();
  const [date, setDate] = useState(initialDate ?? todayIso());
  const [pending, setPending] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [lot, setLot] = useState({ sent: '', patrol: '', fg: '' });
  const [items, setItems] = useState<LotItem[]>([]);
  const [absences, setAbsences] = useState<(Absence & { key: string })[]>([]);
  const [recorded, setRecorded] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(true);
  const [uploading, setUploading] = useState('');
  const month = date.slice(0, 7);

  const loadMonth = useCallback(async (m: string) => {
    const from = `${m}-01`, to = `${m}-${String(daysInMonth(m)).padStart(2, '0')}`;
    const [p, l] = await Promise.all([repo.getPerEntries(from, to), repo.getLotEntries(from, to)]);
    setRecorded(new Set([...p.map((e) => e.date), ...l.map((e) => e.date)]));
  }, [repo]);

  const load = useCallback(async (d: string) => {
    setBusy(true); setStatus('');
    const [ls, ws, per, lots, abs] = await Promise.all([
      repo.listLines(), repo.listWorkers(), repo.getPerEntries(d, d), repo.getLotEntries(d, d), repo.getAbsences(d, d),
    ]);
    const active = ls.filter((l) => l.active || per.some((p) => p.lineId === l.id));
    setLines(active);
    setWorkers(ws);
    setRows(Object.fromEntries(active.map((l) => {
      const e = per.find((p) => p.lineId === l.id);
      return [l.id, e ? { workerIds: e.workerIds, per: String(e.per) } : { workerIds: l.defaultWorkerIds, per: '' }];
    })));
    const le = lots[0];
    setLot(le ? { sent: String(le.sent), patrol: String(le.patrol), fg: String(le.fg) } : { sent: '', patrol: '', fg: '' });
    setItems(le?.items ?? []);
    setAbsences((abs[0]?.list ?? []).map((a) => ({ ...a, key: newKey() })));
    setDirty(false); setBusy(false);
  }, [repo]);

  useEffect(() => { load(date); }, [date, load]);
  useEffect(() => { loadMonth(month); }, [month, loadMonth]);
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const go = (d: string) => { if (!d || d === date) return; if (dirty) setPending(d); else setDate(d); };
  const touch = () => { setDirty(true); setStatus(''); };
  const setRow = (id: string, patch: Partial<Row>) => { setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } })); touch(); };
  const setLotField = (k: keyof typeof lot, v: string) => { setLot((l) => ({ ...l, [k]: v })); touch(); };
  const setItem = (id: string, patch: Partial<LotItem>) => { setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x))); touch(); };
  const setAbs = (key: string, patch: Partial<Absence>) => { setAbsences((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x))); touch(); };

  const perInvalid = Object.values(rows).some((r) => bad(r.per));
  const lotInvalid = bad(lot.sent) || bad(lot.patrol) || bad(lot.fg);
  const sent = parseNum(lot.sent), patrol = parseNum(lot.patrol), fg = parseNum(lot.fg);
  const lotOverflow = !lotInvalid && (patrol ?? 0) + (fg ?? 0) > (sent ?? 0) && (patrol ?? 0) + (fg ?? 0) > 0;
  const lotOutCount = (patrol ?? 0) + (fg ?? 0);
  const lotBlank = sent === null && patrol === null && fg === null && items.length === 0;
  const absInvalid = absences.some((a) => !a.workerId);
  const canSave = !busy && !perInvalid && !lotInvalid && !lotOverflow && !absInvalid && !uploading;

  const setters = useMemo(() => {
    const order: string[] = [];
    for (const l of lines) if (!order.includes(l.setter)) order.push(l.setter);
    return order;
  }, [lines]);
  const activeWorkers = workers.filter((w) => w.active).sort((a, b) => a.name.localeCompare(b.name, 'th'));
  const filled = Object.values(rows).filter((r) => parseNum(r.per) !== null && !Number.isNaN(parseNum(r.per))).length;

  const save = async () => {
    setBusy(true); setStatus('กำลังบันทึก…');
    try {
      await repo.savePerDay(date, lines.map((l) => ({
        date, lineId: l.id, workerIds: rows[l.id].workerIds.filter(Boolean), per: parseNum(rows[l.id].per),
      })));
      const cleanItems = items.map((i) => ({ ...i, partNo: i.partNo.trim(), product: (i.product ?? '').trim(), note: i.note.trim() }));
      if (lotBlank) await repo.deleteLotDay(date);
      else await repo.saveLotDay({ date, sent: sent ?? 0, patrol: patrol ?? 0, fg: fg ?? 0, items: cleanItems });
      await repo.saveAbsenceDay(date, absences.map(({ workerId, reason, note }) => ({ workerId, reason, note: note.trim() })));
      setDirty(false);
      setStatus(`บันทึกข้อมูลวันที่ ${fmtDate(date)} แล้ว`);
      loadMonth(month);
      if (pending) { setDate(pending); setPending(null); }
    } catch {
      setStatus('บันทึกไม่สำเร็จ ตรวจการเชื่อมต่อแล้วลองอีกครั้ง');
    } finally { setBusy(false); }
  };

  const upload = async (id: string, files: FileList | null) => {
    if (!files?.length || !repo.uploadImage) return;
    setUploading(id);
    try {
      const urls: string[] = [];
      for (const f of Array.from(files)) urls.push(await repo.uploadImage(f));
      setItems((xs) => xs.map((x) => (x.id === id ? { ...x, images: [...x.images, ...urls] } : x)));
      touch();
    } catch {
      setStatus('อัปโหลดรูปไม่สำเร็จ ลองไฟล์ที่เล็กกว่า 20 MB');
    } finally { setUploading(''); }
  };

  /** Active workers, plus the one already recorded even if no longer in use or deleted. */
  const workerOptions = (current?: string) => {
    const extra = current && !activeWorkers.some((w) => w.id === current)
      ? [{ id: current, name: `${workerLabel(workers, current)} (ไม่ใช้งาน)` }] : [];
    return [...extra, ...activeWorkers].map((w) => <option key={w.id} value={w.id}>{w.name}</option>);
  };

  const workerSelect = (lineId: string, idx: number) => {
    const ids = rows[lineId]?.workerIds ?? [];
    return (
      <select id={`w-${lineId}-${idx}`} aria-label={`พนักงาน ${idx + 1}`} value={ids[idx] ?? ''}
        onChange={(e) => {
          const next = [...ids]; next[idx] = e.target.value;
          setRow(lineId, { workerIds: next.filter((x, i) => x || i === 0).slice(0, 2) });
        }}>
        <option value="">{idx === 0 ? '— เลือก —' : '—'}</option>
        {workerOptions(ids[idx])}
      </select>
    );
  };

  const days = Array.from({ length: daysInMonth(month) }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();

  return (
    <section>
      <div className="page-head">
        <h1>กรอกข้อมูลรายวัน</h1>
        <span className="muted">{WEEKDAY[dow]}. {fmtDate(date)} · กรอกแล้ว {filled}/{lines.length} ไลน์</span>
      </div>

      <div className="toolbar">
        <button type="button" className="secondary sm" aria-label="วันก่อนหน้า" onClick={() => go(shiftDay(date, -1))}>‹</button>
        <label>วันที่ <input id="entry-date" type="date" value={date} onChange={(e) => go(e.target.value)} /></label>
        <button type="button" className="secondary sm" aria-label="วันถัดไป" onClick={() => go(shiftDay(date, 1))}>›</button>
        <button type="button" className="secondary sm" onClick={() => go(todayIso())}>วันนี้</button>
        <div className="daystrip" aria-label={`วันใน ${fmtMonth(month)}`}>
          {days.map((d) => (
            <button key={d} type="button" title={fmtDate(d)} aria-current={d === date ? 'date' : undefined}
              className={`${recorded.has(d) ? 'has' : ''} ${new Date(`${d}T00:00:00Z`).getUTCDay() === 0 ? 'sun' : ''}`}
              onClick={() => go(d)}>{Number(d.slice(8))}</button>
          ))}
        </div>
        <span className="legend-dots"><span><i style={{ background: 'var(--good-soft)', border: '1px solid #9fdcbc' }} />มีข้อมูลแล้ว (กดเพื่อแก้ไข)</span></span>
      </div>

      {pending && (
        <div className="toolbar" role="alert" style={{ background: 'var(--warn-soft)' }}>
          <span>วันที่ {fmtDate(date)} ยังไม่ได้บันทึก</span>
          <button type="button" className="sm" disabled={!canSave} onClick={save}>บันทึกแล้วไปวันที่ {fmtDate(pending)}</button>
          <button type="button" className="secondary sm" onClick={() => { setDirty(false); setDate(pending); setPending(null); }}>ไม่บันทึก</button>
          <button type="button" className="secondary sm" onClick={() => setPending(null)}>อยู่หน้านี้ต่อ</button>
        </div>
      )}

      <div className="grid-2">
        <div className="panel">
          <div className="panel-head"><h2>% PER</h2><span className="hint">เว้นว่าง = ไลน์ไม่ได้ผลิตวันนั้น</span></div>
          <div className="tablewrap tall" style={{ boxShadow: 'none' }}>
            <table>
              <thead><tr><th>ไลน์</th><th>พนักงาน 1</th><th>พนักงาน 2</th><th className="num">% PER</th></tr></thead>
              <tbody>
                {setters.map((s) => [
                  <tr key={`g-${s}`} className="group"><td colSpan={4}>Setter: {s || 'ยังไม่ได้กำหนด'}</td></tr>,
                  ...lines.filter((l) => l.setter === s).map((l) => (
                    <tr key={l.id}>
                      <td><b>{l.code}</b></td>
                      <td>{workerSelect(l.id, 0)}</td>
                      <td>{workerSelect(l.id, 1)}</td>
                      <td className="num">
                        <input id={`per-${l.id}`} aria-label={`% PER ${l.code}`} inputMode="decimal"
                          className={bad(rows[l.id]?.per ?? '') ? 'invalid' : ''}
                          value={rows[l.id]?.per ?? ''} onChange={(e) => setRow(l.id, { per: e.target.value })} />
                      </td>
                    </tr>
                  )),
                ])}
              </tbody>
            </table>
          </div>
          {perInvalid && <p className="error" role="alert">กรอกตัวเลข 0 ขึ้นไป</p>}
        </div>

        <div className="stack">
          <div className="panel">
            <div className="panel-head"><h2>Lot out</h2></div>
            <table>
              <thead><tr><th className="num">Lot ส่งตรวจ (ครั้ง)</th><th className="num">Lot out Patrol</th><th className="num">Lot out FG</th></tr></thead>
              <tbody><tr>
                {(['sent', 'patrol', 'fg'] as const).map((k) => (
                  <td key={k} className="num">
                    <input id={`lot-${k}`} aria-label={{ sent: 'Lot ส่งตรวจ', patrol: 'Lot out Patrol', fg: 'Lot out FG' }[k]}
                      inputMode="numeric" className={bad(lot[k]) ? 'invalid' : ''} value={lot[k]}
                      onChange={(e) => setLotField(k, e.target.value)} />
                  </td>
                ))}
              </tr></tbody>
            </table>
            {lotInvalid && <p className="error" role="alert">กรอกตัวเลข 0 ขึ้นไป</p>}
            {lotOverflow && <p className="error" role="alert">Lot out มากกว่า Lot ส่งตรวจ</p>}

            <div className="panel-head" style={{ marginTop: 12 }}>
              <h3>รายละเอียด Lot out</h3><span className="hint">U-Line, Product, ปัญหา และรูปประกอบ</span><span className="spacer" />
              <button type="button" className="secondary sm" onClick={() => {
                setItems((xs) => [...xs, { id: newKey(), partNo: '', product: '', lineId: '', kind: (patrol ?? 0) > (fg ?? 0) ? 'patrol' : 'fg', note: '', images: [] }]); touch();
              }}>+ เพิ่ม Part No.</button>
            </div>
            <div className="tablewrap" style={{ boxShadow: 'none' }}>
              <table>
                <thead><tr><th>U-Line</th><th>Part No.</th><th>ชื่อ Product</th><th>ประเภท</th><th /></tr></thead>
                <tbody>
                  {items.map((it) => [
                    <tr key={it.id} className="item-top">
                      <td><select aria-label="U-Line ที่ Lot out" value={it.lineId ?? ''} onChange={(e) => setItem(it.id, { lineId: e.target.value })} style={{ maxWidth: 88 }}>
                        <option value="">—</option>
                        {lines.map((l) => <option key={l.id} value={l.id}>{l.code}</option>)}
                      </select></td>
                      <td><input aria-label="Part No." style={{ width: 86, textAlign: 'left' }} value={it.partNo} onChange={(e) => setItem(it.id, { partNo: e.target.value })} /></td>
                      <td><input aria-label="ชื่อ Product" style={{ width: 104, textAlign: 'left' }} value={it.product ?? ''} onChange={(e) => setItem(it.id, { product: e.target.value })} /></td>
                      <td><select aria-label="ประเภท Lot out" value={it.kind} onChange={(e) => setItem(it.id, { kind: e.target.value as LotKind })}>
                        <option value="patrol">Patrol</option><option value="fg">FG</option></select></td>
                      <td className="actions-cell"><button type="button" className="danger sm" onClick={() => { setItems((xs) => xs.filter((x) => x.id !== it.id)); touch(); }}>ลบ</button></td>
                    </tr>,
                    <tr key={`${it.id}-d`} className="item-bottom">
                      <td colSpan={3}><input aria-label="รายละเอียดปัญหา" className="wide" placeholder="รายละเอียดปัญหา" value={it.note} onChange={(e) => setItem(it.id, { note: e.target.value })} /></td>
                      <td colSpan={2}>
                        <div className="thumbs">
                          {it.images.map((u) => (
                            <span key={u} className="thumb">
                              <Photo src={u} alt={`รูป ${it.partNo}`} />
                              <button type="button" aria-label="ลบรูป" onClick={() => setItem(it.id, { images: it.images.filter((x) => x !== u) })}>×</button>
                            </span>
                          ))}
                          {repo.uploadImage
                            ? <label className="upload">{uploading === it.id ? 'กำลังอัปโหลด…' : '+ รูป'}
                                <input type="file" accept="image/*" multiple aria-label={`แนบรูป ${it.partNo}`} onChange={(e) => { upload(it.id, e.target.files); e.target.value = ''; }} /></label>
                            : <span className="hint">แนบรูปไม่ได้</span>}
                        </div>
                      </td>
                    </tr>,
                  ])}
                  {items.length === 0 && <tr><td colSpan={5} className="hint">{lotOutCount > 0
                    ? `วันนี้มี Lot out ${lotOutCount} Lot ยังไม่ได้บันทึกรายละเอียด กด “+ เพิ่ม Part No.”`
                    : 'วันนี้ไม่มี Lot out'}</td></tr>}
                  {items.length > 0 && items.length < lotOutCount && <tr><td colSpan={5} className="hint">บันทึกรายละเอียดแล้ว {items.length} จาก {lotOutCount} Lot</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>พนักงานที่ไม่มาทำงาน</h2><span className="hint">ลา ขาด หรืออื่นๆ</span><span className="spacer" />
              <button type="button" className="secondary sm" onClick={() => { setAbsences((xs) => [...xs, { key: newKey(), workerId: '', reason: 'leave', note: '' }]); touch(); }}>+ เพิ่มคนที่ไม่มา</button>
            </div>
            <div className="tablewrap" style={{ boxShadow: 'none' }}>
              <table>
                <thead><tr><th>พนักงาน</th><th>สาเหตุ</th><th>หมายเหตุ</th><th /></tr></thead>
                <tbody>
                  {absences.map((a) => (
                    <tr key={a.key}>
                      <td><select aria-label="พนักงานที่ไม่มา" className={a.workerId ? '' : 'invalid'} value={a.workerId} onChange={(e) => setAbs(a.key, { workerId: e.target.value })}>
                        <option value="">— เลือก —</option>
                        {workerOptions(a.workerId)}
                      </select></td>
                      <td><select aria-label="สาเหตุ" value={a.reason} onChange={(e) => setAbs(a.key, { reason: e.target.value as AbsenceReason })}>
                        {(Object.keys(ABSENCE_LABEL) as AbsenceReason[]).map((r) => <option key={r} value={r}>{ABSENCE_LABEL[r]}</option>)}
                      </select></td>
                      <td><input aria-label="หมายเหตุการไม่มา" className="wide" placeholder={a.reason === 'leave' ? 'เช่น ลากิจ ลาป่วย ลาพักร้อน' : ''} value={a.note} onChange={(e) => setAbs(a.key, { note: e.target.value })} /></td>
                      <td className="actions-cell"><button type="button" className="danger sm" onClick={() => { setAbsences((xs) => xs.filter((x) => x.key !== a.key)); touch(); }}>ลบ</button></td>
                    </tr>
                  ))}
                  {absences.length === 0 && <tr><td colSpan={4} className="hint">ทุกคนมาทำงาน</td></tr>}
                </tbody>
              </table>
            </div>
            {absInvalid && <p className="error" role="alert">เลือกชื่อพนักงานที่ไม่มาให้ครบ</p>}
          </div>
        </div>
      </div>

      <div className="actions savebar">
        <button type="button" onClick={save} disabled={!canSave}>บันทึก</button>
        <span className="status" role="status">{status || (dirty ? 'ยังไม่ได้บันทึก' : '')}</span>
      </div>
    </section>
  );
}
