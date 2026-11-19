import { useEffect, useState } from 'react';
import { useRepo } from '../data/RepoContext';
import { variance } from '../calc/cost';
import { COST_CATEGORIES, type CostCategory } from '../types';
import { fmtBaht, fmtMonth, THAI_MONTHS, todayIso } from '../ui/format';
import { COST_LABEL } from '../ui/labels';
import { parseNum } from './EntryDaily';

type Vals = Record<CostCategory, { standard: string; actual: string }>;
const blank = (): Vals => Object.fromEntries(COST_CATEGORIES.map((c) => [c, { standard: '', actual: '' }])) as Vals;

export function EntryCost({ initialMonth }: { initialMonth?: string }) {
  const repo = useRepo();
  const [month, setMonth] = useState(initialMonth ?? todayIso().slice(0, 7));
  const [vals, setVals] = useState<Vals>(blank());
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
    repo.getCostMonths(`${year}-01`, `${year}-12`).then((cs) => setRecorded(new Set(cs.map((c) => c.month))));
  }, [repo, year, status]);

  useEffect(() => {
    let live = true;
    setBusy(true); setStatus('');
    repo.getCostMonths(month, month).then(([c]) => {
      if (!live) return;
      const v = blank();
      if (c) for (const k of COST_CATEGORIES) {
        v[k] = { standard: c.standard[k] == null ? '' : String(c.standard[k]), actual: c.actual[k] == null ? '' : String(c.actual[k]) };
      }
      setVals(v); setBusy(false); setDirty(false);
    });
    return () => { live = false; };
  }, [month, repo]);

  const invalid = COST_CATEGORIES.some((k) => Number.isNaN(parseNum(vals[k].standard)) || Number.isNaN(parseNum(vals[k].actual)));
  const set = (k: CostCategory, f: 'standard' | 'actual', v: string) => { setVals((s) => ({ ...s, [k]: { ...s[k], [f]: v } })); setDirty(true); setStatus(''); };

  const save = async () => {
    setBusy(true); setStatus('กำลังบันทึก…');
    try {
      const pick = (f: 'standard' | 'actual') =>
        Object.fromEntries(COST_CATEGORIES.map((k) => [k, parseNum(vals[k][f])])) as Record<CostCategory, number | null>;
      await repo.saveCostMonth({ month, standard: pick('standard'), actual: pick('actual') });
      setStatus(`บันทึกต้นทุนเดือน ${fmtMonth(month)} แล้ว`); setDirty(false);
      if (pending) { setMonth(pending); setPending(null); }
    } catch { setStatus('บันทึกไม่สำเร็จ ลองอีกครั้ง'); }
    finally { setBusy(false); }
  };

  return (
    <section>
      <div className="page-head"><h1>กรอกต้นทุนรายเดือน</h1><span className="muted">{fmtMonth(month)}</span></div>
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
      <div className="tablewrap" style={{ maxWidth: 760 }}>
        <table>
          <thead><tr><th>หมวด</th><th className="num">Standard (บาท)</th><th className="num">Actual (บาท)</th><th className="num">Variance</th></tr></thead>
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
    </section>
  );
}
