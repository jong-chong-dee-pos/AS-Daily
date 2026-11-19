import { useReportData, type ReportData } from '../data/useReportData';
import { monthsIn } from '../calc/period';
import { variance } from '../calc/cost';
import { COST_CATEGORIES, type CostCategory, type Period } from '../types';
import { FilterBar } from '../ui/FilterBar';
import { usePeriod } from '../ui/usePeriod';
import { fmtBaht, fmtMonth } from '../ui/format';
import { COST_LABEL } from '../ui/labels';
import { ExportButtons } from '../ui/ExportButtons';
import { CostChart, yearOf } from '../ui/ExcelCharts';
import { periodName } from './ReportPer';

export interface CostRow { month: string; cat: CostCategory; standard: number | null; actual: number | null; variance: number | null; note: string }

export function buildCostRows(d: ReportData, p: Period): CostRow[] {
  return COST_CATEGORIES.flatMap((cat) => monthsIn(p).map((m) => {
    const c = d.cost.find((x) => x.month === m);
    const s = c?.standard[cat] ?? null, a = c?.actual[cat] ?? null;
    return { month: m, cat, standard: s, actual: a, variance: variance(s, a), note: c?.note?.[cat] ?? '' };
  }));
}

/** Totals over months where both values exist. */
export function costTotal(rows: CostRow[], cat: CostCategory) {
  const r = rows.filter((x) => x.cat === cat && x.variance !== null);
  const sum = (k: 'standard' | 'actual' | 'variance') => (r.length ? r.reduce((a, x) => a + (x[k] as number), 0) : null);
  return { standard: sum('standard'), actual: sum('actual'), variance: sum('variance') };
}

export function ReportCost() {
  const [period, setPeriod] = usePeriod();
  const { data, error } = useReportData(period);
  const rows = data ? buildCostRows(data, period) : [];
  const year = yearOf(period);
  const yd = useReportData({ kind: 'year', year }).data;
  const months = monthsIn(period);
  const head = ['หมวด', 'เดือน', 'Standard', 'Actual', 'Variance', 'หมายเหตุ'];
  const exportRows = [[`ต้นทุน ${periodName(period)}`], head,
    ...rows.map((r) => [COST_LABEL[r.cat], r.month, r.standard, r.actual, r.variance, r.note])];
  return (
    <section>
      <div className="page-head"><h1>ต้นทุน</h1><span className="muted">Variance = Standard − Actual · ติดลบ = ใช้เกินมาตรฐาน</span></div>
      <FilterBar value={period} onChange={setPeriod}>
        {data && <ExportButtons name={`Cost_${periodName(period)}`} sheets={[{ name: 'ต้นทุน', rows: exportRows }]} target="report-cost" />}
      </FilterBar>
      {error && <p className="error">{error}</p>}
      {!data && !error && <p className="empty">กำลังโหลด…</p>}
      {data && (
        <div id="report-cost">
          {COST_CATEGORIES.map((cat) => {
            const tot = costTotal(rows, cat);
            return (
              <div key={cat}>
                <h2>{COST_LABEL[cat]}</h2>
                {yd && <div className="charts single"><CostChart d={yd} year={year} cat={cat} label={`Process (${COST_LABEL[cat]})`} /></div>}
                <div className="tablewrap">
                  <table>
                    <thead><tr><th>เดือน</th><th className="num">Standard (บาท)</th><th className="num">Actual (บาท)</th><th className="num">Variance</th><th>หมายเหตุ</th></tr></thead>
                    <tbody>
                      {rows.filter((r) => r.cat === cat).map((r) => (
                        <tr key={r.month}>
                          <td>{fmtMonth(r.month)}</td>
                          <td className="num">{fmtBaht(r.standard)}</td><td className="num">{fmtBaht(r.actual)}</td>
                          <td className={`num ${r.variance !== null && r.variance < 0 ? 'neg' : ''}`}>{fmtBaht(r.variance)}</td>
                          <td className="note-cell">{r.note}</td>
                        </tr>
                      ))}
                    </tbody>
                    {months.length > 1 && (
                      <tfoot><tr><td>รวม</td><td className="num">{fmtBaht(tot.standard)}</td><td className="num">{fmtBaht(tot.actual)}</td>
                        <td className={`num ${tot.variance !== null && tot.variance < 0 ? 'neg' : ''}`}>{fmtBaht(tot.variance)}</td><td /></tr></tfoot>
                    )}
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
