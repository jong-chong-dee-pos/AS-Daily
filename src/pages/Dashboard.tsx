import { Bar, BarChart, CartesianGrid, ComposedChart, Line as RLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useReportData, type ReportData } from '../data/useReportData';
import { monthsIn } from '../calc/period';
import { mean, overallAverage } from '../calc/per';
import { lotTotals } from '../calc/lotout';
import { monthlyLot, monthlyPer, sumLot } from '../calc/monthly';
import { targetFor } from '../calc/cost';
import { COST_CATEGORIES, type Period } from '../types';
import { FilterBar } from '../ui/FilterBar';
import { usePeriod } from '../ui/usePeriod';
import { fmtBaht, fmtDate, fmtMonth, fmtNum, THAI_MONTHS } from '../ui/format';
import { COST_LABEL } from '../ui/labels';
import { ExportButtons } from '../ui/ExportButtons';
import { buildCostRows, costTotal } from './ReportCost';
import { periodName } from './ReportPer';

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

export function Dashboard() {
  const [period, setPeriod] = usePeriod();
  const year = period.kind === 'year' ? period.year : Number((period.kind === 'month' ? period.month : period.from).slice(0, 4));
  const { data, error } = useReportData(period);
  const yearData = useReportData({ kind: 'year', year });
  const s = data ? summarize(data, period) : null;
  const yd = yearData.data;
  const months = monthsIn({ kind: 'year', year });
  const chart = yd ? (() => {
    const per = monthlyPer(months, yd.per, yd.lines, yd.summaries);
    const lot = monthlyLot(months, yd.lot, yd.summaries);
    return months.map((m, i) => ({
      name: THAI_MONTHS[i], per: per[i] === null ? null : Math.round(per[i]! * 10) / 10,
      perTarget: targetFor(yd.targets, m).perTarget,
      lot: lot[i].pct === null ? null : Math.round(lot[i].pct! * 100) / 100,
      lotTarget: targetFor(yd.targets, m).lotOutTarget,
    }));
  })() : [];
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
            <div className="card">
              <div className="label">% PER เฉลี่ย</div>
              <div className="value" data-testid="kpi-per">{fmtNum(s.per)}</div>
              <div className="target">เป้า ≥{fmtNum(s.perTarget, 0)} {perOk !== null && <span className={`pill ${perOk ? 'ok' : 'no'}`}>{perOk ? 'ถึงเป้า' : 'ไม่ถึงเป้า'}</span>}</div>
            </div>
            <div className="card">
              <div className="label">Lot out</div>
              <div className="value" data-testid="kpi-lot">{fmtNum(s.lot.pct, 2)}%</div>
              <div className="target">เป้า ≤{fmtNum(s.lotTarget, 2)}% · {s.lot.out}/{s.lot.sent} Lot {lotOk !== null && <span className={`pill ${lotOk ? 'ok' : 'no'}`}>{lotOk ? 'ถึงเป้า' : 'ไม่ถึงเป้า'}</span>}</div>
            </div>
            <div className="card">
              <div className="label">Variance ต้นทุน (บาท)</div>
              <table><tbody>
                {s.cost.map((c) => (
                  <tr key={c.cat}><td>{COST_LABEL[c.cat]}</td>
                    <td className={`num ${c.variance !== null && c.variance < 0 ? 'neg' : ''}`} data-testid={`kpi-var-${c.cat}`}>{fmtBaht(c.variance)}</td></tr>
                ))}
              </tbody></table>
            </div>
          </div>
          <div className="charts">
            <div className="chart">
              <h2>% PER รายเดือน {year}</h2>
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={chart} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                  <YAxis domain={[80, 'auto']} tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                  <Tooltip formatter={(v: number, k: string) => [fmtNum(v), k === 'per' ? '% PER' : 'เป้า']} />
                  <Bar dataKey="per" fill="var(--accent)" radius={[3, 3, 0, 0]} />
                  <RLine dataKey="perTarget" stroke="var(--bad)" strokeDasharray="5 4" dot={false} type="stepAfter" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="chart">
              <h2>Lot out % รายเดือน {year}</h2>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chart} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                  <Tooltip formatter={(v: number, k: string) => [`${fmtNum(v, 2)}%`, k === 'lot' ? 'Lot out' : 'เป้า']} />
                  <Bar dataKey="lot" fill="var(--accent)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <p className="muted">เป้า ≤ {fmtNum(chart[0]?.lotTarget ?? 0.5, 2)}%</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
