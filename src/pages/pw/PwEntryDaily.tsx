import { useEffect, useRef, useState } from 'react';
import { useRepo } from '../../data/RepoContext';
import { PLAN_GROUPS, type PlanGroup, type PwPlanDay } from '../../types';
import { planTotal } from '../../calc/pw';
import { PLAN_COLOR, PLAN_LABEL } from '../../ui/pwLabels';
import { fmtDate, fmtMonth, fmtNum, todayIso } from '../../ui/format';
import { parseNum } from '../EntryDaily';
import { NextDay, NumInput, useEnterMovesDown, useUnsavedGuard } from '../../ui/entryKit';

type Vals = Record<PlanGroup, string>;
const blank = (): Vals => Object.fromEntries(PLAN_GROUPS.map((g) => [g, ''])) as Vals;
const shiftDay = (d: string, n: number) => { const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const daysOf = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return Array.from({ length: new Date(y, m, 0).getDate() }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
};

/** Part Warehouse: the day's assembly plan, pieces per product group. */
export function PwEntryDaily({ initialDate }: { initialDate?: string }) {
  const repo = useRepo();
  const [date, setDate] = useState(initialDate ?? todayIso());
  const month = date.slice(0, 7);
  const [plan, setPlan] = useState<PwPlanDay[]>([]);
  const [vals, setVals] = useState<Vals>(blank());
  const [note, setNote] = useState('');
  const [manpower, setManpower] = useState<number | null>(null);
  const [busy, setBusy] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [savedDay, setSavedDay] = useState<string | null>(null);
  const page = useRef<HTMLElement>(null);
  useEnterMovesDown(page);
  useUnsavedGuard(dirty);

  useEffect(() => { repo.getPwTargets().then((t) => setManpower(t.manpower)).catch(() => {}); }, [repo]);
  useEffect(() => {
    let live = true;
    setBusy(true);
    repo.getPwPlan(month).then((p) => {
      if (!live) return;
      setPlan(p);
      const d = p.find((x) => x.date === date);
      setVals(Object.fromEntries(PLAN_GROUPS.map((g) => [g, d?.qty[g] == null ? '' : String(d.qty[g])])) as Vals);
      setNote(d?.note ?? '');
      setDirty(false); setBusy(false);
    }).catch(() => { if (live) { setStatus('โหลดข้อมูลไม่ได้ ลองอีกครั้ง'); setBusy(false); } });
    return () => { live = false; };
  }, [repo, month, date]);

  const go = (d: string) => { if (!d || d === date) return; if (dirty) setPending(d); else { setStatus(''); setDate(d); } };
  const invalid = PLAN_GROUPS.some((g) => Number.isNaN(parseNum(vals[g])));
  const qty = Object.fromEntries(PLAN_GROUPS.map((g) => [g, parseNum(vals[g])]).filter(([, v]) => typeof v === 'number' && !Number.isNaN(v))) as PwPlanDay['qty'];
  const total = planTotal({ qty });
  const recorded = new Set(plan.map((p) => p.date));

  const save = async () => {
    setBusy(true); setStatus('กำลังบันทึก…');
    try {
      const n = note.trim();
      await repo.savePwPlanDay({ date, qty, ...(n ? { note: n } : {}) });
      setPlan((p) => [...p.filter((x) => x.date !== date), ...(Object.keys(qty).length || n ? [{ date, qty, ...(n ? { note: n } : {}) }] : [])].sort((a, b) => a.date.localeCompare(b.date)));
      setStatus(`บันทึกแผนวันที่ ${fmtDate(date)} แล้ว`); setDirty(false);
      if (!pending) setSavedDay(date);
      if (pending) { setDate(pending); setPending(null); }
    } catch { setStatus('บันทึกไม่สำเร็จ ลองอีกครั้ง'); }
    finally { setBusy(false); }
  };

  return (
    <section ref={page}>
      <div className="page-head"><h1>กรอกแผนประกอบรายวัน</h1><span className="muted">{fmtDate(date)}</span></div>
      <div className="toolbar">
        <button type="button" className="secondary sm" aria-label="วันก่อนหน้า" onClick={() => go(shiftDay(date, -1))}>‹</button>
        <label>วันที่ <input type="date" aria-label="วันที่" value={date} onChange={(e) => go(e.target.value)} /></label>
        <button type="button" className="secondary sm" aria-label="วันถัดไป" onClick={() => go(shiftDay(date, 1))}>›</button>
        <button type="button" className="secondary sm" onClick={() => go(todayIso())}>วันนี้</button>
        <div className="daystrip" aria-label={`วันใน ${fmtMonth(month)}`}>
          {daysOf(month).map((d) => (
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
          <button type="button" className="sm" disabled={busy || invalid} onClick={save}>บันทึกแล้วไป {fmtDate(pending)}</button>
          <button type="button" className="secondary sm" onClick={() => { setDirty(false); setStatus(''); setDate(pending); setPending(null); }}>ไม่บันทึก</button>
          <button type="button" className="secondary sm" onClick={() => setPending(null)}>อยู่หน้านี้ต่อ</button>
        </div>
      )}
      <div className="panel" style={{ maxWidth: 900 }}>
        <div className="panel-head"><h2>แผนประกอบ (ชิ้น)</h2><span className="hint">เว้นว่างกลุ่มที่ไม่มีแผน</span></div>
        <div className="ops-grid pw-plan-grid">
          {PLAN_GROUPS.map((g) => (
            <label key={g} className="ops-field">
              <span><i className="swatch" style={{ background: PLAN_COLOR[g] }} aria-hidden="true" />{PLAN_LABEL[g]}</span>
              <NumInput aria-label={PLAN_LABEL[g]} inputMode="numeric" className={Number.isNaN(parseNum(vals[g])) ? 'invalid' : ''}
                value={vals[g]} onChange={(e) => { setVals((v) => ({ ...v, [g]: e.target.value })); setDirty(true); setStatus(''); setSavedDay(null); }} />
            </label>
          ))}
        </div>
        <div className="ops-calc">
          <div><span>รวมทั้งวัน</span><b data-testid="plan-total">{fmtNum(total, 0)}</b><small>ชิ้น</small></div>
          {manpower !== null && (
            <div><span>เทียบกำลังพล {fmtNum(manpower, 0)}</span>
              <b className={total > manpower ? 'neg' : ''}>{total > manpower ? `เกิน ${fmtNum(total - manpower, 0)}` : `เหลือ ${fmtNum(manpower - total, 0)}`}</b><small>ชิ้น</small></div>
          )}
        </div>
        <label className="pw-note"><span>หมายเหตุ</span>
          <input type="text" aria-label="หมายเหตุแผนประกอบ" maxLength={300} placeholder="ไม่แสดงบนกราฟ แสดงเมื่อเอาเมาส์ชี้วันนั้น" value={note}
            onChange={(e) => { setNote(e.target.value); setDirty(true); setStatus(''); setSavedDay(null); }} />
        </label>
      </div>
      {invalid && <p className="error" role="alert">กรอกตัวเลข 0 ขึ้นไป</p>}
      <div className="actions savebar">
        <button type="button" onClick={save} disabled={busy || invalid}>บันทึก</button>
        <span className="status" role="status">{status || (dirty ? 'ยังไม่ได้บันทึก' : '')}</span>
        {savedDay === date && !dirty && <NextDay date={date} onGo={(d) => { setSavedDay(null); setStatus(''); setDate(d); }} />}
      </div>
      {plan.length > 0 && (
        <>
          <h2 className="section-title">แผนที่บันทึกแล้วใน {fmtMonth(month)}</h2>
          <div className="tablewrap" style={{ maxWidth: 1200 }}>
            <table className="pw-plan-table">
              <thead><tr><th>วันที่</th>{PLAN_GROUPS.map((g) => <th key={g} className="num">{PLAN_LABEL[g]}</th>)}<th className="num">รวม</th></tr></thead>
              <tbody>
                {plan.map((p) => (
                  <tr key={p.date} className={p.date === date ? 'current' : ''}>
                    <td><button type="button" className="link" onClick={() => go(p.date)}>{fmtDate(p.date)}</button>
                      {p.note && <small className="pw-note-cell" title={p.note}>{p.note}</small>}</td>
                    {PLAN_GROUPS.map((g) => <td key={g} className="num">{p.qty[g] == null ? '' : fmtNum(p.qty[g], 0)}</td>)}
                    <td className="num"><b>{fmtNum(planTotal(p), 0)}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
