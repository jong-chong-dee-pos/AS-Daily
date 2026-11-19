import { useEffect, useState } from 'react';
import { useRepo } from '../data/RepoContext';
import { variance } from '../calc/cost';
import { COST_CATEGORIES, type CostCategory } from '../types';
import { fmtBaht, fmtMonth, todayIso } from '../ui/format';
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

  useEffect(() => {
    let live = true;
    setBusy(true); setStatus('');
    repo.getCostMonths(month, month).then(([c]) => {
      if (!live) return;
      const v = blank();
      if (c) for (const k of COST_CATEGORIES) {
        v[k] = { standard: c.standard[k] == null ? '' : String(c.standard[k]), actual: c.actual[k] == null ? '' : String(c.actual[k]) };
      }
      setVals(v); setBusy(false);
    });
    return () => { live = false; };
  }, [month, repo]);

  const invalid = COST_CATEGORIES.some((k) => Number.isNaN(parseNum(vals[k].standard)) || Number.isNaN(parseNum(vals[k].actual)));
  const set = (k: CostCategory, f: 'standard' | 'actual', v: string) => setVals((s) => ({ ...s, [k]: { ...s[k], [f]: v } }));

  const save = async () => {
    setBusy(true); setStatus('กำลังบันทึก…');
    try {
      const pick = (f: 'standard' | 'actual') =>
        Object.fromEntries(COST_CATEGORIES.map((k) => [k, parseNum(vals[k][f])])) as Record<CostCategory, number | null>;
      await repo.saveCostMonth({ month, standard: pick('standard'), actual: pick('actual') });
      setStatus(`บันทึกต้นทุนเดือน ${fmtMonth(month)} แล้ว`);
    } catch { setStatus('บันทึกไม่สำเร็จ ลองอีกครั้ง'); }
    finally { setBusy(false); }
  };

  return (
    <section>
      <div className="page-head">
        <h1>กรอกต้นทุนรายเดือน</h1>
        <label className="muted">เดือน <input id="cost-month" type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} /></label>
      </div>
      <div className="tablewrap">
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
                        inputMode="decimal" style={{ width: 140 }}
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
        <span className="status" role="status">{status}</span>
      </div>
    </section>
  );
}
