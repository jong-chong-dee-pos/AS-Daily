import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useRepo } from '../../data/RepoContext';
import { AGE_BUCKETS, PLAN_GROUPS, type PwBaseline, type PwMonth, type PwPlanDay, type PwTargets } from '../../types';
import { countSeries, inventorySeries, perSeries, planSeries, yearlySeries } from '../../calc/pw';
import { PwChart, type PwPoint } from '../../ui/PwCharts';
import { AGE_COLOR, AGE_LABEL, PLAN_COLOR, PLAN_LABEL, PW_COLOR } from '../../ui/pwLabels';
import { fmtMonth, THAI_MONTHS, todayIso } from '../../ui/format';

interface Data { months: PwMonth[]; plan: PwPlanDay[]; targets: PwTargets; base: { forYear: number | null; columns: PwBaseline[] } }

/** Part Warehouse dashboard: the nine charts of the old report, top to bottom. */
export function PwDashboard() {
  const repo = useRepo();
  const [sp, setSp] = useSearchParams();
  const today = todayIso();
  const year = Number(sp.get('y')) || Number(today.slice(0, 4));
  const planMonth = /^\d{4}-\d{2}$/.test(sp.get('pm') ?? '') ? sp.get('pm')! : `${year}-${year === Number(today.slice(0, 4)) ? today.slice(5, 7) : '12'}`;
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    setError('');
    Promise.all([repo.getPwMonths(`${year - 1}-12`, `${year}-12`), repo.getPwPlan(planMonth), repo.getPwTargets(), repo.getPwBaselines()])
      .then(([months, plan, targets, base]) => { if (live) setData({ months, plan, targets, base }); })
      .catch(() => { if (live) setError('โหลดข้อมูลไม่ได้ ลองเปิดหน้านี้ใหม่'); });
    return () => { live = false; };
  }, [repo, year, planMonth]);
  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); n.set(k, v); if (k === 'y') n.delete('pm'); setSp(n, { replace: true }); };
  const years = Array.from({ length: Math.max(3, Number(today.slice(0, 4)) - 2023) }, (_, i) => Number(today.slice(0, 4)) - i);

  const head = (
    <>
      <div className="page-head"><h1>Dashboard Part Warehouse</h1><span className="muted">ปี {year}</span></div>
      <div className="toolbar">
        <label>ปี <select aria-label="ปี" value={year} onChange={(e) => set('y', e.target.value)}>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select></label>
      </div>
    </>
  );
  if (error) return <section>{head}<p className="empty" role="alert">{error}</p></section>;
  if (!data) return <section>{head}<p className="empty">กำลังโหลด…</p></section>;
  const { months, plan, targets: t, base } = data;
  const inv = inventorySeries(year, months, base) as PwPoint[];
  const yearly = yearlySeries(year, months, base, t) as PwPoint[];
  const per = perSeries(year, months, base, t) as PwPoint[];
  const ages = (prefix: string) => AGE_BUCKETS.map((k) => ({ key: `${prefix}_${k}`, name: AGE_LABEL[k], color: AGE_COLOR[k] }));
  const above = (key: string, limit: string) => (p: PwPoint) => (typeof p[key] === 'number' && typeof p[limit] === 'number' && (p[key] as number) > (p[limit] as number) ? PW_COLOR.bad : undefined);
  const below = (key: string, limit: string) => (p: PwPoint) => (typeof p[key] === 'number' && typeof p[limit] === 'number' ? ((p[key] as number) < (p[limit] as number) ? PW_COLOR.bad : PW_COLOR.good) : undefined);

  return (
    <section className="pw-dash">
      {head}
      <PwChart title="Inventory Purchaser Part & Inhouse" sub="PUR = รวม Turn Over Purchase Part · WIP = รวม Turn Over Inhouse" data={inv} digits={2}
        stack={[{ key: 'wip', name: 'WIP', color: PW_COLOR.wip }, { key: 'pur', name: 'PUR', color: PW_COLOR.pur }]}
        lines={[{ key: 'total', name: 'Total', color: PW_COLOR.total }]} labelKey="total" />
      <PwChart title="Turn Over : Purchase Part" data={inv} digits={2} stack={ages('p')} labelKey="pur"
        lines={[{ key: 'pur', name: 'Total', color: '#5a9e3a' }]} height={360} />
      <PwChart title="Turn Over : Inhouse" data={inv} digits={2} stack={ages('i')} labelKey="wip"
        lines={[{ key: 'wip', name: 'Total', color: '#5a9e3a' }]} height={360} />
      <div className="pw-plan-head">
        <label>แผนประกอบเดือน <select aria-label="เดือนของแผนประกอบ" value={planMonth} onChange={(e) => set('pm', e.target.value)}>
          {THAI_MONTHS.map((m, i) => { const v = `${year}-${String(i + 1).padStart(2, '0')}`; return <option key={v} value={v}>{m} {year}</option>; })}
        </select></label>
      </div>
      <PwChart title={`แผนประกอบรายวัน ${fmtMonth(planMonth)}`} sub="ชิ้น" data={planSeries(planMonth, plan) as PwPoint[]} height={380}
        stack={PLAN_GROUPS.map((g) => ({ key: g, name: PLAN_LABEL[g], color: PLAN_COLOR[g] }))} labelKey="total"
        refLine={{ y: t.manpower, name: `กำลังพล ${t.manpower}`, color: PW_COLOR.bad }} />
      <div className="charts">
        <PwChart title="Missing Part No. & Qty" sub="จำนวนรายการต่อเดือน (แดง = เกิน MAX)" data={yearly} bars={[{ key: 'missing', name: 'Actual', color: PW_COLOR.bar }]}
          lines={[{ key: 'missingMax', name: 'MAX', color: PW_COLOR.target, dots: false }]} colorOf={above('missing', 'missingMax')} />
        <PwChart title="Stock Diff (Amt)" sub="Pur & Wip (แดง = เกินเป้า)" data={yearly} digits={3} bars={[{ key: 'stockDiff', name: 'Pur & Wip', color: PW_COLOR.bar }]}
          lines={[{ key: 'stockDiffTarget', name: 'Target', color: PW_COLOR.target, dots: false }]} colorOf={above('stockDiff', 'stockDiffTarget')} />
      </div>
      <PwChart title={`Plan Count ปี ${year}`} data={countSeries(year, months) as PwPoint[]}
        bars={[{ key: 'plan', name: 'Plan', color: PW_COLOR.bar }, { key: 'actual', name: 'Actual', color: PW_COLOR.actual }]} />
      <div className="pw-stack">
        <PwChart title={`% Performance ${year} ทีมจ่าย`} sub="แดง = ต่ำกว่าเป้า" data={per} bars={[{ key: 'issue', name: '% PER', color: PW_COLOR.good }]}
          lines={[{ key: 'issueTarget', name: `Target ≥${t.per}%`, color: PW_COLOR.target }]} colorOf={below('issue', 'issueTarget')} />
        <PwChart title={`% Performance ${year} ทีมนับสต๊อก`} sub="แดง = ต่ำกว่าเป้า" data={per} bars={[{ key: 'count', name: '% PER', color: PW_COLOR.good }]}
          lines={[{ key: 'countTarget', name: `Target ≥${t.per}%`, color: PW_COLOR.target }, { key: 'countItem', name: 'Target Item', color: PW_COLOR.item }]}
          colorOf={below('count', 'countTarget')} />
      </div>
    </section>
  );
}
