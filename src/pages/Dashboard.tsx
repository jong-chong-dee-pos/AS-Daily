import { useReportData, type ReportData } from '../data/useReportData';
import { monthsIn } from '../calc/period';
import { mean, overallAverage } from '../calc/per';
import { lotTotals } from '../calc/lotout';
import { monthlyLot, monthlyPer, sumLot } from '../calc/monthly';
import { targetFor } from '../calc/cost';
import { COST_CATEGORIES, type Period } from '../types';
import { FilterBar } from '../ui/FilterBar';
import { usePeriod } from '../ui/usePeriod';
import { fmtBaht, fmtDate, fmtMonth, fmtNum } from '../ui/format';
import { COST_LABEL } from '../ui/labels';
import { ExportButtons } from '../ui/ExportButtons';
import { LotMonthChart, PerMonthChart } from '../ui/ExcelCharts';
import { buildCostRows, costTotal } from './ReportCost';
import { periodName } from './ReportPer';

/** Progress track with a target tick; `max` sets the scale. */
function Meter({ value, target, max, ok }: { value: number | null; target: number; max: number; ok: boolean | null }) {
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  return (
    <div className={`meter ${ok === false ? 'bad' : ''}`} role="presentation">
      {value !== null && <span style={{ width: pct(value) }} />}
      <i style={{ left: pct(target) }} title="เป้า" />
    </div>
  );
}

export function summarize(d: ReportData, p: Period) {
  const months = monthsIn(p);
  const per = p.kind === 'year'
    ? mean(monthlyPer(months, d.per, d.lines, d.summaries).filter((v): v is number => v !== null))
    : overallAverage(d.per, d.lines);
  const lot = p.kind === 'year' ? sumLot(monthlyLot(months, d.lot, d.summaries)) : lotTotals(d.lot);
  const perTarget = mean(months.map((m) => targetFor(d.targets, m).perTarget)) ?? 125;
  const lotTarget = mean(months.map((m) => targetFor(d.targets, m).lotOutTarget)) ?? 0.5;
  const costRows = buildCostRows(d, p);
  const cost = COST_CATEGORIES.map((c) => ({ cat: c, ...costTotal(costRows, c) }));
  return { per, lot, perTarget, lotTarget, cost };
}

/** Chart height that keeps the whole dashboard on one screen. */
const dashH = typeof window !== 'undefined' ? Math.max(220, Math.min(340, window.innerHeight - 400)) : 260;

export function Dashboard() {
  const [period, setPeriod] = usePeriod();
  const year = period.kind === 'year' ? period.year : Number((period.kind === 'month' ? period.month : period.from).slice(0, 4));
  const { data, error } = useReportData(period);
  const yearData = useReportData({ kind: 'year', year });
  const s = data ? summarize(data, period) : null;
  const yd = yearData.data;
  const title = period.kind === 'month' ? fmtMonth(period.month) : period.kind === 'year' ? `ปี ${period.year}` : `${fmtDate(period.from)} – ${fmtDate(period.to)}`;
  const perOk = s && s.per !== null ? s.per >= s.perTarget : null;
  const lotOk = s && s.lot.pct !== null ? s.lot.pct <= s.lotTarget : null;
  const exportRows = s ? [[`สรุป ${title}`], ['ตัวชี้วัด', 'ค่า', 'เป้า'],
    ['% PER', s.per, s.perTarget], ['Lot out %', s.lot.pct, s.lotTarget],
    ...s.cost.map((c) => [`Variance ${COST_LABEL[c.cat]}`, c.variance, null])] : [];

  return (
    <section>
      <div className="page-head"><h1>Dashboard</h1><span className="muted">{title}</span></div>
      <FilterBar value={period} onChange={setPeriod}>
        {s && <ExportButtons name={`Dashboard_${periodName(period)}`} sheets={[{ name: 'สรุป', rows: exportRows }]} target="dashboard" />}
      </FilterBar>
      {error && <p className="error">{error}</p>}
      {!s && !error && <p className="empty">กำลังโหลด…</p>}
      {s && (
        <div id="dashboard">
          <div className="cards">
            <div className="card c-per">
              <div className="label">% PER เฉลี่ย</div>
              <div className="value" data-testid="kpi-per">{fmtNum(s.per)}</div>
              <Meter value={s.per} target={s.perTarget} max={Math.max(s.perTarget * 1.4, s.per ?? 0)} ok={perOk} />
              <div className="target">เป้า ≥{fmtNum(s.perTarget, 0)}% {perOk !== null && <span className={`pill ${perOk ? 'ok' : 'no'}`}>{perOk ? 'ถึงเป้า' : 'ไม่ถึงเป้า'}</span>}</div>
            </div>
            <div className="card c-lot">
              <div className="label">Lot out</div>
              <div className="value" data-testid="kpi-lot">{fmtNum(s.lot.pct, 2)}%</div>
              <Meter value={s.lot.pct} target={s.lotTarget} max={Math.max(s.lotTarget * 3, s.lot.pct ?? 0)} ok={lotOk} />
              <div className="target">เป้า ≤{fmtNum(s.lotTarget, 2)}% {lotOk !== null && <span className={`pill ${lotOk ? 'ok' : 'no'}`}>{lotOk ? 'ถึงเป้า' : 'ไม่ถึงเป้า'}</span>} {s.lot.out}/{fmtNum(s.lot.sent, 0)} Lot</div>
            </div>
            {s.cost.map((c) => (
              <div className="card c-cost" key={c.cat}>
                <div className="label">Variance {COST_LABEL[c.cat]}</div>
                <div className={`value sm ${c.variance !== null && c.variance < 0 ? 'neg' : 'met'}`} data-testid={`kpi-var-${c.cat}`}>{fmtBaht(c.variance)}</div>
                <div className="target">Std {fmtBaht(c.standard)}</div>
                <div className="target">Act {fmtBaht(c.actual)}</div>
              </div>
            ))}
          </div>
          {yd && (
            <div className="charts">
              <PerMonthChart d={yd} year={year} height={dashH} />
              <LotMonthChart d={yd} year={year} height={dashH} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
