import { useEffect, useState } from 'react';
import { useRepo } from '../data/RepoContext';
import { variance } from '../calc/cost';
import { COST_CATEGORIES, type CostCategory, type OpsMonth } from '../types';
import { fmtBaht, fmtMonth, fmtNum, THAI_MONTHS, todayIso } from '../ui/format';
import { COST_LABEL } from '../ui/labels';
import { opsDerived } from '../calc/ops';
import { parseNum } from './EntryDaily';
import { OtdUpload } from './OtdUpload';

type OpsKey = Exclude<keyof OpsMonth, 'month'>;
/** The monthly production and cost figures, in the order they are typed. */
export const OPS_FIELDS: { key: OpsKey; label: string; unit: string; hint?: string }[] = [
  { key: 'prodPlan', label: 'ยอดผลิต PLAN (PN)', unit: 'ชิ้น' },
  { key: 'prodActual', label: 'ยอดผลิต ACTUAL (AS)', unit: 'ชิ้น' },
  { key: 'matStd', label: 'Material cost Standard', unit: '' },
  { key: 'matAct', label: 'Material cost Actual', unit: '' },
  { key: 'processCost', label: 'Actual Process Cost', unit: 'บาท' },
  { key: 'expense', label: 'Expense รวม', unit: 'บาท' },
  { key: 'headcount', label: 'จำนวนคน', unit: 'คน' },
  { key: 'prodForHead', label: 'ยอดผลิตสำหรับ Pcs./head และ Expense/Pcs.', unit: 'ชิ้น', hint: 'เว้นว่าง = ใช้ยอด ACTUAL (AS)' },
];
type OpsVals = Record<OpsKey, string>;
const blankOps = (): OpsVals => Object.fromEntries(OPS_FIELDS.map((f) => [f.key, ''])) as OpsVals;

type Vals = Record<CostCategory, { standard: string; actual: string; note: string }>;
const blank = (): Vals => Object.fromEntries(COST_CATEGORIES.map((c) => [c, { standard: '', actual: '', note: '' }])) as Vals;

export function EntryCost({ initialMonth }: { initialMonth?: string }) {
  const repo = useRepo();
  const [month, setMonth] = useState(initialMonth ?? todayIso().slice(0, 7));
  const [vals, setVals] = useState<Vals>(blank());
  const [ops, setOps] = useState<OpsVals>(blankOps());
  const [opsSaved, setOpsSaved] = useState(false);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(true);
  const [recorded, setRecorded] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);
  const year = Number(month.slice(0, 4));
  const shiftMonth = (n: number) => {
    const [y, m] = month.split('-').map(Number); const t = y * 12 + (m - 1) + n;
    return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
  };
  const [pending, setPending] = useState<string | null>(null);
  const go = (m: string) => { if (!m || m === month) return; if (dirty) setPending(m); else setMonth(m); };
  useEffect(() => {
    Promise.all([repo.getCostMonths(`${year}-01`, `${year}-12`), repo.getOpsMonths(`${year}-01`, `${year}-12`)])
      .then(([cs, os]) => setRecorded(new Set([...cs.map((c) => c.month), ...os.map((o) => o.month)])));
  }, [repo, year, status]);

  useEffect(() => {
    let live = true;
    setBusy(true); setStatus('');
    Promise.all([repo.getCostMonths(month, month), repo.getOpsMonths(month, month)]).then(([[c], [o]]) => {
      if (!live) return;
      setOps(Object.fromEntries(OPS_FIELDS.map((f) => [f.key, o?.[f.key] == null ? '' : String(o[f.key])])) as OpsVals);
      setOpsSaved(!!o);
      const v = blank();
      if (c) for (const k of COST_CATEGORIES) {
        v[k] = { standard: c.standard[k] == null ? '' : String(c.standard[k]), actual: c.actual[k] == null ? '' : String(c.actual[k]), note: c.note?.[k] ?? '' };
      }
      setVals(v); setBusy(false); setDirty(false);
    });
    return () => { live = false; };
  }, [month, repo]);

  const opsNum = (k: OpsKey) => parseNum(ops[k]);
  const opsInvalid = OPS_FIELDS.some((f) => Number.isNaN(opsNum(f.key)));
  const invalid = opsInvalid || COST_CATEGORIES.some((k) => Number.isNaN(parseNum(vals[k].standard)) || Number.isNaN(parseNum(vals[k].actual)));
  const opsRecord = (): OpsMonth => {
    const n = (k: OpsKey) => { const v = opsNum(k); return Number.isNaN(v) ? null : v; };
    return { month, prodPlan: n('prodPlan'), prodActual: n('prodActual'), matStd: n('matStd'), matAct: n('matAct'),
      processCost: n('processCost'), headcount: n('headcount'), expense: n('expense'), prodForHead: n('prodForHead') };
  };
  const derived = opsDerived(opsRecord());
  const setOp = (k: OpsKey, v: string) => { setOps((s) => ({ ...s, [k]: v })); setDirty(true); setStatus(''); };
  const set = (k: CostCategory, f: 'standard' | 'actual' | 'note', v: string) => { setVals((s) => ({ ...s, [k]: { ...s[k], [f]: v } })); setDirty(true); setStatus(''); };

  const save = async () => {
    setBusy(true); setStatus('กำลังบันทึก…');
    try {
      const pick = (f: 'standard' | 'actual') =>
        Object.fromEntries(COST_CATEGORIES.map((k) => [k, parseNum(vals[k][f])])) as Record<CostCategory, number | null>;
      const notes = Object.fromEntries(COST_CATEGORIES.map((k) => [k, vals[k].note.trim()]).filter(([, n]) => n));
      const o = opsRecord();
      // A month with no production figures gets no document, unless one is being cleared.
      if (opsSaved || OPS_FIELDS.some((f) => o[f.key] != null)) { await repo.saveOpsMonth(o); setOpsSaved(true); }
      await repo.saveCostMonth({ month, standard: pick('standard'), actual: pick('actual'), ...(Object.keys(notes).length ? { note: notes } : {}) });
      setStatus(`บันทึกข้อมูลเดือน ${fmtMonth(month)} แล้ว`); setDirty(false);
      if (pending) { setMonth(pending); setPending(null); }
    } catch { setStatus('บันทึกไม่สำเร็จ ลองอีกครั้ง'); }
    finally { setBusy(false); }
  };

  return (
    <section>
      <div className="page-head"><h1>กรอกข้อมูลรายเดือน</h1><span className="muted">{fmtMonth(month)}</span></div>
      <div className="toolbar">
        <button type="button" className="secondary sm" aria-label="เดือนก่อนหน้า" onClick={() => go(shiftMonth(-1))}>‹</button>
        <label>เดือน <input id="cost-month" type="month" value={month} onChange={(e) => go(e.target.value)} /></label>
        <button type="button" className="secondary sm" aria-label="เดือนถัดไป" onClick={() => go(shiftMonth(1))}>›</button>
        <div className="daystrip" aria-label={`เดือนในปี ${year}`}>
          {THAI_MONTHS.map((t, i) => {
            const m = `${year}-${String(i + 1).padStart(2, '0')}`;
            return <button key={m} type="button" style={{ minWidth: 44 }} className={recorded.has(m) ? 'has' : ''} aria-current={m === month ? 'date' : undefined} onClick={() => go(m)}>{t}</button>;
          })}
        </div>
        <span className="legend-dots"><span><i style={{ background: 'var(--good-soft)', border: '1px solid #9fdcbc' }} />มีข้อมูลแล้ว (กดเพื่อแก้ไข)</span></span>
      </div>
      {pending && (
        <div className="toolbar" role="alert" style={{ background: 'var(--warn-soft)' }}>
          <span>เดือน {fmtMonth(month)} ยังไม่ได้บันทึก</span>
          <button type="button" className="sm" disabled={busy || invalid} onClick={save}>บันทึกแล้วไป {fmtMonth(pending)}</button>
          <button type="button" className="secondary sm" onClick={() => { setDirty(false); setMonth(pending); setPending(null); }}>ไม่บันทึก</button>
          <button type="button" className="secondary sm" onClick={() => setPending(null)}>อยู่หน้านี้ต่อ</button>
        </div>
      )}
      <div className="panel" style={{ maxWidth: 1100 }}>
        <div className="panel-head"><h2>ยอดผลิตและต้นทุนการผลิต</h2><span className="hint">กรอกเฉพาะตัวตั้ง ค่าต่อชิ้นระบบคำนวณให้</span></div>
        <div className="ops-grid">
          {OPS_FIELDS.map((f) => (
            <label key={f.key} className="ops-field">
              <span>{f.label}{f.unit && <small> ({f.unit})</small>}</span>
              <input aria-label={f.label} inputMode="decimal" className={Number.isNaN(opsNum(f.key)) ? 'invalid' : ''}
                placeholder={f.hint ?? ''} value={ops[f.key]} onChange={(e) => setOp(f.key, e.target.value)} />
            </label>
          ))}
        </div>
        <div className="ops-calc" aria-label="ค่าที่ระบบคำนวณ">
          <div><span>Process THB/Pcs.</span><b data-testid="calc-process">{fmtNum(derived.processPerPcs, 2)}</b><small>Process Cost ÷ ACTUAL</small></div>
          <div><span>Pcs./head</span><b data-testid="calc-head">{fmtNum(derived.pcsPerHead, 0)}</b><small>ยอดผลิต ÷ จำนวนคน</small></div>
          <div><span>Expense/Pcs.</span><b data-testid="calc-expense">{fmtNum(derived.expensePerPcs, 2)}</b><small>Expense ÷ ยอดผลิต</small></div>
          <div><span>Material Variance</span><b data-testid="calc-mat" className={derived.matVariance !== null && derived.matVariance < 0 ? 'neg' : ''}>{fmtNum(derived.matVariance, 2)}</b><small>Standard − Actual</small></div>
          <div><span>ACTUAL เทียบ PLAN</span><b data-testid="calc-prod" className={derived.prodDiff !== null && derived.prodDiff < 0 ? 'neg' : ''}>{derived.prodDiff === null ? '–' : `${derived.prodDiff > 0 ? '+' : ''}${fmtNum(derived.prodDiff, 0)}`}</b><small>ชิ้น</small></div>
        </div>
      </div>
      <h2 className="section-title">ต้นทุน Electric, Labor และ Consumed</h2>
      <div className="tablewrap" style={{ maxWidth: 1100 }}>
        <table>
          <thead><tr><th>หมวด</th><th className="num">Standard (บาท)</th><th className="num">Actual (บาท)</th><th className="num">Variance</th><th>หมายเหตุ</th></tr></thead>
          <tbody>
            {COST_CATEGORIES.map((k) => {
              const s = parseNum(vals[k].standard), a = parseNum(vals[k].actual);
              const v = Number.isNaN(s) || Number.isNaN(a) ? null : variance(s, a);
              return (
                <tr key={k}>
                  <td>{COST_LABEL[k]}</td>
                  {(['standard', 'actual'] as const).map((f) => (
                    <td key={f} className="num">
                      <input id={`${k}-${f}`} aria-label={`${COST_LABEL[k]} ${f === 'standard' ? 'Standard' : 'Actual'}`}
                        inputMode="decimal" style={{ width: 130 }}
                        className={Number.isNaN(parseNum(vals[k][f])) ? 'invalid' : ''}
                        value={vals[k][f]} onChange={(e) => set(k, f, e.target.value)} />
                    </td>
                  ))}
                  <td className={`num ${v !== null && v < 0 ? 'neg' : ''}`} data-testid={`var-${k}`}>{fmtBaht(v)}</td>
                  <td><input aria-label={`หมายเหตุ ${COST_LABEL[k]}`} className="wide" style={{ minWidth: 240 }} placeholder="เช่น สาเหตุที่ใช้เกินมาตรฐาน"
                    value={vals[k].note} onChange={(e) => set(k, 'note', e.target.value)} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {invalid && <p className="error" role="alert">กรอกตัวเลข 0 ขึ้นไป</p>}
      <div className="actions">
        <button type="button" onClick={save} disabled={busy || invalid}>บันทึก</button>
        <span className="status" role="status">{status || (dirty ? 'ยังไม่ได้บันทึก' : '')}</span>
      </div>
      <OtdUpload />
    </section>
  );
}
