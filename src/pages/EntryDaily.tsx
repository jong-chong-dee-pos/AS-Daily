import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRepo } from '../data/RepoContext';
import type { Line, Worker } from '../types';
import { fmtDate, todayIso } from '../ui/format';

interface Row { workerIds: string[]; per: string }

/** "" → null (blank day), valid number ≥ 0 → number, anything else → NaN. */
export function parseNum(s: string): number | null {
  const t = s.trim().replace(/,/g, '');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}
const bad = (s: string) => Number.isNaN(parseNum(s));

export function EntryDaily({ initialDate }: { initialDate?: string }) {
  const repo = useRepo();
  const [date, setDate] = useState(initialDate ?? todayIso());
  const [lines, setLines] = useState<Line[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [lot, setLot] = useState({ sent: '', patrol: '', fg: '' });
  const [status, setStatus] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async (d: string) => {
    setBusy(true); setStatus('');
    const [ls, ws, per, lots] = await Promise.all([
      repo.listLines(), repo.listWorkers(), repo.getPerEntries(d, d), repo.getLotEntries(d, d),
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
    setDirty(false); setBusy(false);
  }, [repo]);

  useEffect(() => { load(date); }, [date, load]);
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const setRow = (id: string, patch: Partial<Row>) => {
    setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } })); setDirty(true);
  };
  const setLotField = (k: keyof typeof lot, v: string) => { setLot((l) => ({ ...l, [k]: v })); setDirty(true); };

  const perInvalid = Object.values(rows).some((r) => bad(r.per));
  const lotInvalid = bad(lot.sent) || bad(lot.patrol) || bad(lot.fg);
  const sent = parseNum(lot.sent), patrol = parseNum(lot.patrol), fg = parseNum(lot.fg);
  const lotOverflow = !lotInvalid && (patrol ?? 0) + (fg ?? 0) > (sent ?? 0) && (patrol ?? 0) + (fg ?? 0) > 0;
  const lotBlank = sent === null && patrol === null && fg === null;
  const canSave = !busy && !perInvalid && !lotInvalid && !lotOverflow;

  const setters = useMemo(() => {
    const order: string[] = [];
    for (const l of lines) if (!order.includes(l.setter)) order.push(l.setter);
    return order;
  }, [lines]);
  const activeWorkers = workers.filter((w) => w.active);

  const save = async () => {
    setBusy(true); setStatus('กำลังบันทึก…');
    try {
      await repo.savePerDay(date, lines.map((l) => ({
        date, lineId: l.id, workerIds: rows[l.id].workerIds.filter(Boolean), per: parseNum(rows[l.id].per),
      })));
      if (lotBlank) await repo.deleteLotDay(date);
      else await repo.saveLotDay({ date, sent: sent ?? 0, patrol: patrol ?? 0, fg: fg ?? 0 });
      setDirty(false);
      setStatus(`บันทึกข้อมูลวันที่ ${fmtDate(date)} แล้ว`);
    } catch {
      setStatus('บันทึกไม่สำเร็จ ตรวจการเชื่อมต่อแล้วลองอีกครั้ง');
    } finally { setBusy(false); }
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
        {activeWorkers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>
    );
  };

  return (
    <section>
      <div className="page-head">
        <h1>กรอกข้อมูลรายวัน</h1>
        <label className="muted">วันที่ <input id="entry-date" type="date" value={date} onChange={(e) => {
          if (dirty && !window.confirm?.('ยังไม่ได้บันทึก ต้องการเปลี่ยนวันที่หรือไม่')) return;
          setDate(e.target.value);
        }} /></label>
      </div>

      <h2>% PER</h2>
      <div className="tablewrap">
        <table>
          <thead><tr><th>ไลน์</th><th>พนักงาน</th><th className="num">% PER</th></tr></thead>
          <tbody>
            {setters.map((s) => [
              <tr key={`g-${s}`} className="group"><td colSpan={3}>Setter: {s}</td></tr>,
              ...lines.filter((l) => l.setter === s).map((l) => (
                <tr key={l.id}>
                  <td>{l.code}</td>
                  <td>{workerSelect(l.id, 0)} {workerSelect(l.id, 1)}</td>
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

      <h2>Lot out</h2>
      <div className="tablewrap">
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
      </div>
      {lotInvalid && <p className="error" role="alert">กรอกตัวเลข 0 ขึ้นไป</p>}
      {lotOverflow && <p className="error" role="alert">Lot out มากกว่า Lot ส่งตรวจ</p>}

      <div className="actions">
        <button type="button" onClick={save} disabled={!canSave}>บันทึก</button>
        <span className="status" role="status">{status || (dirty ? 'ยังไม่ได้บันทึก' : '')}</span>
      </div>
    </section>
  );
}
