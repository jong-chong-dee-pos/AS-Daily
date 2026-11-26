import { useEffect, useState } from 'react';
import { useRepo } from '../../data/RepoContext';
import { AGE_BUCKETS, type AgeBucket, type Buckets, type PwMonth } from '../../types';
import { bucketTotal, emptyBuckets } from '../../calc/pw';
import { AGE_COLOR, AGE_LABEL } from '../../ui/pwLabels';
import { fmtMonth, fmtNum, MONTHS, todayIso } from '../../ui/format';
import { parseNum } from '../EntryDaily';

type Single = 'stockDiff' | 'countPlan' | 'countActual' | 'perIssue' | 'perCount';
const SINGLES: { key: Single; label: string; group: string; unit?: string }[] = [
  { key: 'stockDiff', label: 'Stock Diff (Amt) Pur & Wip', group: 'Stock Diff (Amt)' },
  { key: 'countPlan', label: 'Plan', group: 'Plan Count', unit: 'รายการ' },
  { key: 'countActual', label: 'Actual', group: 'Plan Count', unit: 'รายการ' },
  { key: 'perIssue', label: '% Performance ทีมจ่าย', group: '% Performance', unit: '%' },
  { key: 'perCount', label: '% Performance ทีมนับสต๊อก', group: '% Performance', unit: '%' },
];
interface Form {
  pur: Record<AgeBucket, string>; inh: Record<AgeBucket, string>;
  missing: { partNo: string; qty: string }[]; missingCount: number | null;
  single: Record<Single, string>;
}
const str = (v: number | null | undefined) => (v == null ? '' : String(v));
const blankBuckets = () => Object.fromEntries(AGE_BUCKETS.map((k) => [k, ''])) as Record<AgeBucket, string>;
const toForm = (m: PwMonth | undefined): Form => ({
  pur: m ? Object.fromEntries(AGE_BUCKETS.map((k) => [k, str(m.pur?.[k])])) as Record<AgeBucket, string> : blankBuckets(),
  inh: m ? Object.fromEntries(AGE_BUCKETS.map((k) => [k, str(m.inh?.[k])])) as Record<AgeBucket, string> : blankBuckets(),
  missing: (m?.missing ?? []).map((r) => ({ partNo: r.partNo, qty: str(r.qty) })),
  missingCount: m?.missingCount ?? null,
  single: Object.fromEntries(SINGLES.map((f) => [f.key, str(m?.[f.key])])) as Record<Single, string>,
});
const bad = (s: string) => Number.isNaN(parseNum(s));
const val = (s: string) => { const n = parseNum(s); return n === null || Number.isNaN(n) ? null : n; };

/** Part Warehouse: everything entered once a month. */
export function PwEntryMonthly({ initialMonth }: { initialMonth?: string }) {
  const repo = useRepo();
  const [month, setMonth] = useState(initialMonth ?? todayIso().slice(0, 7));
  const year = Number(month.slice(0, 4));
  const [form, setForm] = useState<Form>(toForm(undefined));
  const [saved, setSaved] = useState(false);
  const [recorded, setRecorded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState('');
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    repo.getPwMonths(`${year}-01`, `${year}-12`).then((ms) => setRecorded(new Set(ms.map((m) => m.month)))).catch(() => {});
  }, [repo, year, saved]);
  useEffect(() => {
    let live = true;
    setBusy(true);
    repo.getPwMonths(month, month).then(([m]) => {
      if (!live) return;
      setForm(toForm(m)); setSaved(!!m); setDirty(false); setBusy(false);
    }).catch(() => { if (live) { setStatus('โหลดข้อมูลไม่ได้ ลองอีกครั้ง'); setBusy(false); } });
    return () => { live = false; };
  }, [repo, month]);

  const edit = (f: (s: Form) => Form) => { setForm(f); setDirty(true); setStatus(''); };
  const shiftMonth = (n: number) => { const [y, m] = month.split('-').map(Number); const t = y * 12 + (m - 1) + n; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`; };
  const go = (m: string) => { if (!m || m === month) return; if (dirty) setPending(m); else { setStatus(''); setMonth(m); } };

  const rows = form.missing.filter((r) => r.partNo.trim() || r.qty.trim());
  const missingRowsBad = rows.some((r) => !r.partNo.trim() || !r.qty.trim() || bad(r.qty));
  const nos = rows.map((r) => r.partNo.trim().toUpperCase()).filter(Boolean);
  const dupNo = nos.find((p, i) => nos.indexOf(p) !== i);
  const invalid = AGE_BUCKETS.some((k) => bad(form.pur[k]) || bad(form.inh[k])) || SINGLES.some((f) => bad(form.single[f.key])) || missingRowsBad || !!dupNo;
  const buckets = (b: Record<AgeBucket, string>): Buckets => ({ ...emptyBuckets(), ...Object.fromEntries(AGE_BUCKETS.map((k) => [k, val(b[k])])) });
  const record = (): PwMonth => ({
    month, pur: buckets(form.pur), inh: buckets(form.inh),
    missing: rows.map((r) => ({ partNo: r.partNo.trim(), qty: val(r.qty) })),
    // The count imported from the old chart is kept until a list is typed for that month.
    ...(rows.length === 0 && form.missingCount != null ? { missingCount: form.missingCount } : {}),
    ...(Object.fromEntries(SINGLES.map((f) => [f.key, val(form.single[f.key])])) as Record<Single, number | null>),
  });
  const pur = bucketTotal(buckets(form.pur)), wip = bucketTotal(buckets(form.inh));

  const save = async () => {
    setBusy(true); setStatus('กำลังบันทึก…');
    try {
      await repo.savePwMonth(record());
      setSaved(true); setDirty(false); setStatus(`บันทึกข้อมูลเดือน ${fmtMonth(month)} แล้ว`);
      setRecorded((s) => new Set([...s, month]));
      if (pending) { setMonth(pending); setPending(null); }
    } catch { setStatus('บันทึกไม่สำเร็จ ลองอีกครั้ง'); }
    finally { setBusy(false); }
  };

  const bucketSet = (side: 'pur' | 'inh', title: string, totalName: string, total: number | null) => (
    <fieldset className="ops-group">
      <legend>{title}</legend>
      <div className="ops-grid">
        {AGE_BUCKETS.map((k) => (
          <label key={k} className="ops-field">
            <span><i className="swatch" style={{ background: AGE_COLOR[k] }} aria-hidden="true" />{AGE_LABEL[k]}</span>
            <input aria-label={`${title} ${AGE_LABEL[k]}`} inputMode="decimal" className={bad(form[side][k]) ? 'invalid' : ''}
              value={form[side][k]} onChange={(e) => { const v = e.target.value; edit((s) => ({ ...s, [side]: { ...s[side], [k]: v } })); }} />
          </label>
        ))}
        <div className="ops-field pw-sum"><span>{totalName} (รวม)</span><b data-testid={`sum-${side}`}>{fmtNum(total, 2)}</b></div>
      </div>
    </fieldset>
  );

  return (
    <section>
      <div className="page-head"><h1>กรอกข้อมูลรายเดือน</h1><span className="muted">Part Warehouse · {fmtMonth(month)}</span></div>
      <div className="toolbar">
        <button type="button" className="secondary sm" aria-label="เดือนก่อนหน้า" onClick={() => go(shiftMonth(-1))}>‹</button>
        <label>เดือน <input type="month" aria-label="เดือน" value={month} onChange={(e) => go(e.target.value)} /></label>
        <button type="button" className="secondary sm" aria-label="เดือนถัดไป" onClick={() => go(shiftMonth(1))}>›</button>
        <div className="daystrip" aria-label={`เดือนในปี ${year}`}>
          {MONTHS.map((t, i) => {
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
          <button type="button" className="secondary sm" onClick={() => { setDirty(false); setStatus(''); setMonth(pending); setPending(null); }}>ไม่บันทึก</button>
          <button type="button" className="secondary sm" onClick={() => setPending(null)}>อยู่หน้านี้ต่อ</button>
        </div>
      )}

      <div className="panel" style={{ maxWidth: 1100 }}>
        <div className="panel-head"><h2>Turn Over และ Inventory</h2><span className="hint">กรอกมูลค่าตามอายุ ระบบรวมเป็น PUR และ WIP ของกราฟ Inventory ให้</span></div>
        {bucketSet('pur', 'Turn Over : Purchase Part', 'PUR', pur)}
        {bucketSet('inh', 'Turn Over : Inhouse', 'WIP', wip)}
        <div className="ops-calc"><div><span>Inventory Total</span><b data-testid="sum-total">{fmtNum(pur === null && wip === null ? null : (pur ?? 0) + (wip ?? 0), 2)}</b><small>PUR + WIP</small></div></div>
      </div>

      <div className="panel" style={{ maxWidth: 1100 }}>
        <div className="panel-head"><h2>Missing Part No. &amp; Qty</h2><span className="hint">ระบบนับจำนวนรายการไปแสดงในกราฟ</span></div>
        {rows.length === 0 && form.missingCount != null && (
          <p className="hint">เดือนนี้มีจำนวนจากรายงานเดิม {form.missingCount} รายการ (ไม่มีรายการ Part No.) ถ้าใส่รายการด้านล่าง ระบบจะนับจากรายการแทน</p>
        )}
        <table className="pw-missing">
          <thead><tr><th>#</th><th>Part No.</th><th className="num">Qty</th><th /></tr></thead>
          <tbody>
            {form.missing.map((r, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td><input aria-label={`Part No. แถว ${i + 1}`} value={r.partNo} className={(r.qty.trim() && !r.partNo.trim()) || (dupNo && r.partNo.trim().toUpperCase() === dupNo) ? 'invalid' : ''}
                  onChange={(e) => { const v = e.target.value; edit((s) => ({ ...s, missing: s.missing.map((x, j) => (j === i ? { ...x, partNo: v } : x)) })); }} /></td>
                <td className="num"><input aria-label={`Qty แถว ${i + 1}`} inputMode="numeric" style={{ width: 100 }} value={r.qty} className={bad(r.qty) ? 'invalid' : ''}
                  onChange={(e) => { const v = e.target.value; edit((s) => ({ ...s, missing: s.missing.map((x, j) => (j === i ? { ...x, qty: v } : x)) })); }} /></td>
                <td><button type="button" className="secondary sm" aria-label={`ลบแถว ${i + 1}`} onClick={() => edit((s) => ({ ...s, missing: s.missing.filter((_, j) => j !== i) }))}>ลบ</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="actions" style={{ marginTop: 8 }}>
          <button type="button" className="secondary sm" onClick={() => edit((s) => ({ ...s, missing: [...s.missing, { partNo: '', qty: '' }] }))}>+ เพิ่ม Part No.</button>
          <span className="hint" data-testid="missing-count">นับได้ {rows.length || (form.missingCount ?? 0)} รายการ</span>
        </div>
      </div>

      <div className="panel" style={{ maxWidth: 1100 }}>
        <div className="panel-head"><h2>Stock Diff, Plan Count และ % Performance</h2><span className="hint">% Performance กรอกเป็นเปอร์เซ็นต์ เช่น 121</span></div>
        {[...new Set(SINGLES.map((f) => f.group))].map((g) => (
          <fieldset key={g} className="ops-group">
            <legend>{g}</legend>
            <div className="ops-grid">
              {SINGLES.filter((f) => f.group === g).map((f) => (
                <label key={f.key} className="ops-field">
                  <span>{f.label}{f.unit && <small> ({f.unit})</small>}</span>
                  <input aria-label={f.label} inputMode="decimal" className={bad(form.single[f.key]) ? 'invalid' : ''}
                    value={form.single[f.key]} onChange={(e) => { const v = e.target.value; edit((s) => ({ ...s, single: { ...s.single, [f.key]: v } })); }} />
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      {invalid && <p className="error" role="alert">{missingRowsBad ? 'ทุกแถวของ Missing Part ต้องมี Part No. และ Qty เป็นตัวเลข' : dupNo ? `Part No. ${dupNo} ซ้ำ` : 'กรอกตัวเลข 0 ขึ้นไป'}</p>}
      <div className="actions">
        <button type="button" onClick={save} disabled={busy || invalid}>บันทึก</button>
        <span className="status" role="status">{status || (dirty ? 'ยังไม่ได้บันทึก' : '')}</span>
      </div>
    </section>
  );
}
