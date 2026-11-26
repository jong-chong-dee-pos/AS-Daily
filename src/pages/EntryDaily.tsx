import { Photo } from '../ui/Photo';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRepo } from '../data/RepoContext';
import { ABSENCE_CHOICES, ABSENCE_LABEL, normalizeAbsence, type Absence, type AbsenceReason, type Line, type LotItem, type LotKind, type Worker } from '../types';
import { workerLabel } from '../ui/labels';
import { daysInMonth } from '../calc/period';
import { fmtDate, fmtMonth, todayIso } from '../ui/format';
import { NextDay, NumInput, useEnterMovesDown, useUnsavedGuard } from '../ui/entryKit';

/** One line on one day: up to two workers, the line's % PER, and a note per worker. */
interface Row { workerIds: string[]; per: string; notes: string[] }

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
const REASON_HINT: Partial<Record<AbsenceReason, string>> = {
  sick: 'สาเหตุ เช่น ไข้หวัด ปวดท้อง', personal: 'สาเหตุ เช่น ติดต่อราชการ ธุระครอบครัว', vacation: 'สาเหตุ (ถ้ามี)',
  other: 'ระบุสาเหตุ (จำเป็น)', absent: 'สาเหตุ (ถ้าทราบ)', leave: 'สาเหตุการลา',
};
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
  const [lotNote, setLotNote] = useState('');
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
      return [l.id, e ? { workerIds: e.workerIds, per: String(e.per), notes: e.notes ?? [] } : { workerIds: l.defaultWorkerIds, per: '', notes: [] }];
    })));
    const le = lots[0];
    setLot(le ? { sent: String(le.sent), patrol: String(le.patrol), fg: String(le.fg) } : { sent: '', patrol: '', fg: '' });
    setLotNote(le?.note ?? '');
    setItems(le?.items ?? []);
    setAbsences((abs[0]?.list ?? []).map((a) => ({ ...normalizeAbsence(a), key: newKey() })));
    setDirty(false); setBusy(false);
  }, [repo]);

  useEffect(() => { load(date); }, [date, load]);
  useEffect(() => { loadMonth(month); }, [month, loadMonth]);
  const page = useRef<HTMLElement>(null);
  useEnterMovesDown(page);
  useUnsavedGuard(dirty);
  // Set after a save, cleared by the next change: offers the next day right where Save was pressed.
  const [savedDay, setSavedDay] = useState<string | null>(null);

  const go = (d: string) => { if (!d || d === date) return; if (dirty) setPending(d); else setDate(d); };
  const touch = () => { setDirty(true); setStatus(''); setSavedDay(null); };
  const setRow = (id: string, patch: Partial<Row>) => { setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } })); touch(); };
  const setLotField = (k: keyof typeof lot, v: string) => { setLot((l) => ({ ...l, [k]: v })); touch(); };
  const setItem = (id: string, patch: Partial<LotItem>) => { setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x))); touch(); };
  const setAbs = (key: string, patch: Partial<Absence>) => { setAbsences((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x))); touch(); };

  const perInvalid = Object.values(rows).some((r) => bad(r.per));
  /** A note is kept only with a % PER (a blank % PER means the line did not run). */
  const noteWithoutPer = lines.filter((l) => {
    const r = rows[l.id];
    return r && parseNum(r.per) === null && r.notes.some((n, i) => n.trim() && r.workerIds[i]);
  }).map((l) => l.code);
  const lotInvalid = bad(lot.sent) || bad(lot.patrol) || bad(lot.fg);
  const sent = parseNum(lot.sent), patrol = parseNum(lot.patrol), fg = parseNum(lot.fg);
  const lotOverflow = !lotInvalid && (patrol ?? 0) + (fg ?? 0) > (sent ?? 0) && (patrol ?? 0) + (fg ?? 0) > 0;
  const lotOutCount = (patrol ?? 0) + (fg ?? 0);
  const lotBlank = sent === null && patrol === null && fg === null && items.length === 0 && !lotNote.trim();
  const absInvalid = absences.some((a) => !a.workerId);
  const absOtherBlank = absences.some((a) => a.reason === 'other' && !a.note.trim());
  const canSave = !busy && !perInvalid && !noteWithoutPer.length && !lotInvalid && !lotOverflow && !absInvalid && !absOtherBlank && !uploading;

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
      await repo.savePerDay(date, lines.map((l) => {
        const r = rows[l.id];
        // Keep each note with its worker; an empty worker slot drops its note too.
        const pairs = r.workerIds.map((id, i) => [id, (r.notes[i] ?? '').trim()] as const).filter(([id]) => id);
        return {
          date, lineId: l.id, workerIds: pairs.map(([id]) => id), per: parseNum(r.per),
          ...(pairs.some(([, n]) => n) ? { notes: pairs.map(([, n]) => n) } : {}),
        };
      }));
      const cleanItems = items.map((i) => ({ ...i, partNo: i.partNo.trim(), product: (i.product ?? '').trim(), note: i.note.trim() }));
      if (lotBlank) await repo.deleteLotDay(date);
      else await repo.saveLotDay({ date, sent: sent ?? 0, patrol: patrol ?? 0, fg: fg ?? 0, items: cleanItems, ...(lotNote.trim() ? { note: lotNote.trim() } : {}) });
      await repo.saveAbsenceDay(date, absences.map(({ workerId, reason, note }) => ({ workerId, reason, note: note.trim() })));
      setDirty(false);
      setStatus(`บันทึกข้อมูลวันที่ ${fmtDate(date)} แล้ว`);
      if (!pending) setSavedDay(date);
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

  const noteInput = (l: Line, idx: number) => {
    const r = rows[l.id];
    const who = r?.workerIds[idx];
    return (
      <input aria-label={`หมายเหตุ ${l.code} พนักงาน ${idx + 1}`} className="wide note-input" disabled={!who}
        placeholder={who ? `หมายเหตุ ${workerLabel(workers, who)}` : ''}
        value={who ? r.notes[idx] ?? '' : ''}
        onChange={(e) => { const notes = [...(r.notes ?? [])]; notes[idx] = e.target.value; setRow(l.id, { notes }); }} />
    );
  };

  const workerSelect = (lineId: string, idx: number) => {
    const ids = rows[lineId]?.workerIds ?? [];
    return (
      <select id={`w-${lineId}-${idx}`} aria-label={`พนักงาน ${idx + 1}`} value={ids[idx] ?? ''}
        onChange={(e) => {
          const next = [...ids]; next[idx] = e.target.value;
          const notes = [...(rows[lineId]?.notes ?? [])];
          // Slot 1 always exists. A note belongs to its person: changing or clearing the person clears it.
          const keep = [0, 1].filter((i) => next[i] || i === 0);
          setRow(lineId, { workerIds: keep.map((i) => next[i] ?? '').slice(0, 2), notes: keep.map((i) => (next[i] && next[i] === ids[i] ? notes[i] ?? '' : '')) });
        }}>
        <option value="">{idx === 0 ? '— เลือก —' : '—'}</option>
        {workerOptions(ids[idx])}
      </select>
    );
  };

  const days = Array.from({ length: daysInMonth(month) }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();

  return (
    <section ref={page}>
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

      <div className="entry-stack">
        <div className="panel">
          <div className="panel-head"><h2>% PER</h2><span className="hint">เว้นว่าง = ไลน์ไม่ได้ผลิตวันนั้น · หมายเหตุแยกตามพนักงานแต่ละคน</span></div>
          <div className="tablewrap flat" style={{ boxShadow: 'none' }}>
            <table className="entry-per">
              <thead><tr><th>ไลน์</th><th>พนักงาน 1</th><th>พนักงาน 2</th><th className="num">% PER</th><th>หมายเหตุ พนักงาน 1</th><th>หมายเหตุ พนักงาน 2</th></tr></thead>
              <tbody>
                {setters.map((s) => [
                  <tr key={`g-${s}`} className="group"><td colSpan={6}>Setter: {s || 'ยังไม่ได้กำหนด'}</td></tr>,
                  ...lines.filter((l) => l.setter === s).map((l) => (
                    <tr key={l.id}>
                      <td><b>{l.code}</b></td>
                      <td>{workerSelect(l.id, 0)}</td>
                      <td>{workerSelect(l.id, 1)}</td>
                      <td className="num">
                        <NumInput id={`per-${l.id}`} aria-label={`% PER ${l.code}`} inputMode="decimal"
                          className={bad(rows[l.id]?.per ?? '') ? 'invalid' : ''}
                          value={rows[l.id]?.per ?? ''} onChange={(e) => setRow(l.id, { per: e.target.value })} />
                      </td>
                      <td>{noteInput(l, 0)}</td>
                      <td>{noteInput(l, 1)}</td>
                    </tr>
                  )),
                ])}
              </tbody>
            </table>
          </div>
          {perInvalid && <p className="error" role="alert">กรอกตัวเลข 0 ขึ้นไป</p>}
          {!perInvalid && noteWithoutPer.length > 0 && <p className="error" role="alert">ไลน์ {noteWithoutPer.join(', ')} มีหมายเหตุแต่ยังไม่ได้กรอก % PER</p>}
        </div>

        <div className="entry-stack-rest">
          <div className="panel">
            <div className="panel-head"><h2>Lot out</h2></div>
            <div className="tablewrap flat" style={{ boxShadow: 'none' }}>
            <table className="lot-counts">
              <thead><tr><th className="num">Lot ส่งตรวจ (ครั้ง)</th><th className="num">Lot out Patrol</th><th className="num">Lot out FG</th></tr></thead>
              <tbody><tr>
                {(['sent', 'patrol', 'fg'] as const).map((k) => (
                  <td key={k} className="num">
                    <NumInput id={`lot-${k}`} aria-label={{ sent: 'Lot ส่งตรวจ', patrol: 'Lot out Patrol', fg: 'Lot out FG' }[k]}
                      inputMode="numeric" className={bad(lot[k]) ? 'invalid' : ''} value={lot[k]}
                      onChange={(e) => setLotField(k, e.target.value)} />
                  </td>
                ))}
              </tr></tbody>
            </table>
            </div>
            {lotInvalid && <p className="error" role="alert">กรอกตัวเลข 0 ขึ้นไป</p>}
            {lotOverflow && <p className="error" role="alert">Lot out มากกว่า Lot ส่งตรวจ</p>}
            <label className="pw-note"><span>หมายเหตุ</span>
              <input type="text" aria-label="หมายเหตุ Lot out" maxLength={300} placeholder="ไม่แสดงบนกราฟ แสดงเมื่อเอาเมาส์ชี้วันนั้นในกราฟ Lot out FG %"
                value={lotNote} onChange={(e) => { setLotNote(e.target.value); touch(); }} />
            </label>

            <div className="panel-head" style={{ marginTop: 12 }}>
              <h3>รายละเอียด Lot out</h3><span className="hint">U-Line, Product, Part No., ปัญหา และรูปประกอบ</span><span className="spacer" />
              <button type="button" className="secondary sm" onClick={() => {
                setItems((xs) => [...xs, { id: newKey(), partNo: '', product: '', lineId: '', kind: (patrol ?? 0) > (fg ?? 0) ? 'patrol' : 'fg', note: '', images: [] }]); touch();
              }}>+ เพิ่ม Part No.</button>
            </div>
            <div className="tablewrap" style={{ boxShadow: 'none' }}>
              <table>
                <thead><tr><th>U-Line</th><th>ชื่อ Product</th><th>Part No.</th><th>ประเภท</th><th /></tr></thead>
                <tbody>
                  {items.map((it) => [
                    <tr key={it.id} className="item-top">
                      <td><select aria-label="U-Line ที่ Lot out" value={it.lineId ?? ''} onChange={(e) => setItem(it.id, { lineId: e.target.value })} style={{ maxWidth: 88 }}>
                        <option value="">—</option>
                        {lines.map((l) => <option key={l.id} value={l.id}>{l.code}</option>)}
                      </select></td>
                      <td><input aria-label="ชื่อ Product" style={{ width: 104, textAlign: 'left' }} value={it.product ?? ''} onChange={(e) => setItem(it.id, { product: e.target.value })} /></td>
                      <td><input aria-label="Part No." style={{ width: 86, textAlign: 'left' }} value={it.partNo} onChange={(e) => setItem(it.id, { partNo: e.target.value })} /></td>
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
              <h2>พนักงานที่ไม่มาทำงาน</h2><span className="hint">ประเภทการลา และสาเหตุ</span><span className="spacer" />
              <button type="button" className="secondary sm" onClick={() => { setAbsences((xs) => [...xs, { key: newKey(), workerId: '', reason: 'sick', note: '' }]); touch(); }}>+ เพิ่มคนที่ไม่มา</button>
            </div>
            <div className="tablewrap" style={{ boxShadow: 'none' }}>
              <table className="absences">
                <thead><tr><th>พนักงาน</th><th>ประเภทการลา</th><th /></tr></thead>
                <tbody>
                  {absences.map((a) => [
                    <tr key={a.key} className="item-top">
                      <td><select aria-label="พนักงานที่ไม่มา" className={a.workerId ? '' : 'invalid'} value={a.workerId} onChange={(e) => setAbs(a.key, { workerId: e.target.value })}>
                        <option value="">— เลือก —</option>
                        {workerOptions(a.workerId)}
                      </select></td>
                      <td><select aria-label="ประเภทการลา" value={a.reason} onChange={(e) => setAbs(a.key, { reason: e.target.value as AbsenceReason })}>
                        {[...(ABSENCE_CHOICES.includes(a.reason) ? [] : [a.reason]), ...ABSENCE_CHOICES].map((r) => <option key={r} value={r}>{ABSENCE_LABEL[r]}</option>)}
                      </select></td>
                      <td className="actions-cell"><button type="button" className="danger sm" onClick={() => { setAbsences((xs) => xs.filter((x) => x.key !== a.key)); touch(); }}>ลบ</button></td>
                    </tr>,
                    <tr key={`${a.key}-r`} className="item-bottom">
                      <td colSpan={3}><input aria-label="สาเหตุการลา" className={`wide ${a.reason === 'other' && !a.note.trim() ? 'invalid' : ''}`}
                        placeholder={REASON_HINT[a.reason] ?? 'สาเหตุการลา'} value={a.note} onChange={(e) => setAbs(a.key, { note: e.target.value })} /></td>
                    </tr>,
                  ])}
                  {absences.length === 0 && <tr><td colSpan={3} className="hint">ทุกคนมาทำงาน</td></tr>}
                </tbody>
              </table>
            </div>
            {absInvalid && <p className="error" role="alert">เลือกชื่อพนักงานที่ไม่มาให้ครบ</p>}
            {!absInvalid && absOtherBlank && <p className="error" role="alert">ประเภท “อื่นๆ” ต้องระบุสาเหตุ</p>}
          </div>
        </div>
      </div>

      <div className="actions savebar">
        <button type="button" onClick={save} disabled={!canSave}>บันทึก</button>
        <span className="status" role="status">{status || (dirty ? 'ยังไม่ได้บันทึก' : '')}</span>
        {savedDay === date && !dirty && <NextDay date={date} onGo={(d) => { setSavedDay(null); setDate(d); }} />}
      </div>
    </section>
  );
}
