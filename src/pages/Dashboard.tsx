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
import { CostChart, LotMonthChart, PerMonthChart, lotMonthSeries, perMonthSeries } from '../ui/ExcelCharts';
import { Icon } from '../ui/Layout';
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

/** Mini bars of the last six months that have a value, newest highlighted. */
function Spark({ values }: { values: (number | null | string)[] }) {
  const xs = values.filter((v): v is number => typeof v === 'number').slice(-6);
  if (xs.length < 2) return null;
  const max = Math.max(...xs), min = Math.min(...xs) * 0.9;
  return <div className="spark" aria-hidden="true">{xs.map((v, i) => <span key={i} style={{ height: `${20 + ((v - min) / (max - min || 1)) * 80}%` }} />)}</div>;
}

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
              <div className="card-head"><span className="card-icon"><Icon name="per" /></span><span className="label">% PER เฉลี่ย</span></div>
              <div className="value" data-testid="kpi-per">{fmtNum(s.per)}%</div>
              {yd && <Spark values={perMonthSeries(yd, year).slice(0, 12).map((p) => p.per)} />}
              <div className="target">{data?.labels?.per ?? 'เป้า'} ≥ {fmtNum(s.perTarget, 0)}% {perOk !== null && <span className={`pill ${perOk ? 'ok' : 'no'}`}>{perOk ? 'ถึงเป้า' : 'ไม่ถึงเป้า'}</span>}</div>
              <Meter value={s.per} target={s.perTarget} max={Math.max(s.perTarget * 1.4, s.per ?? 0)} ok={perOk} />
            </div>
            <div className="card c-lot">
              <div className="card-head"><span className="card-icon"><Icon name="lot" /></span><span className="label">Lot out</span></div>
              <div className="value" data-testid="kpi-lot">{fmtNum(s.lot.pct, 2)}%</div>
              {yd && <Spark values={lotMonthSeries(yd, year).slice(0, 12).map((p) => p.pct)} />}
              <div className="target">{data?.labels?.lot ?? 'เป้า'} ≤ {fmtNum(s.lotTarget, 2)}% {lotOk !== null && <span className={`pill ${lotOk ? 'ok' : 'no'}`}>{lotOk ? 'ถึงเป้า' : 'ไม่ถึงเป้า'}</span>} <span>{s.lot.out} จาก {fmtNum(s.lot.sent, 0)} Lot</span></div>
              <Meter value={s.lot.pct} target={s.lotTarget} max={Math.max(s.lotTarget * 3, s.lot.pct ?? 0)} ok={lotOk} />
            </div>
          </div>
          <div className="cards cost">
            {s.cost.map((c) => (
              <div className="card c-cost" key={c.cat}>
                <div className="card-head"><span className="card-icon"><Icon name="coin" /></span><span className="label">Variance {COST_LABEL[c.cat]}</span></div>
                <div className={`value sm ${c.variance !== null && c.variance < 0 ? 'neg' : 'met'}`} data-testid={`kpi-var-${c.cat}`}>{c.variance !== null && c.variance > 0 ? '+' : ''}{fmtBaht(c.variance)}</div>
                <div className="target"><span>Standard <b>{fmtBaht(c.standard)}</b></span><span>Actual <b>{fmtBaht(c.actual)}</b></span></div>
              </div>
            ))}
          </div>
          {yd && (
            <>
              <h2 className="section-title">% PER และ Lot out รายเดือน <small>ปี {year}</small></h2>
              <div className="charts">
                <PerMonthChart d={yd} year={year} height={320} />
                <LotMonthChart d={yd} year={year} height={320} />
              </div>
              <h2 className="section-title">ต้นทุนรายเดือน <small>Standard, Actual, Variance ปี {year}</small></h2>
              <div className="charts">
                {COST_CATEGORIES.map((cat) => <CostChart key={cat} d={yd} year={year} cat={cat} label={COST_LABEL[cat]} height={360} />)}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
