import { useMemo } from 'react';
import { useReportData, type ReportData } from '../data/useReportData';
import { datesIn, monthsIn, monthOf } from '../calc/period';
import { lotByWeek, lotTotals, type LotTotals } from '../calc/lotout';
import { monthlyLot, sumLot } from '../calc/monthly';
import { targetFor } from '../calc/cost';
import type { Period } from '../types';
import { FilterBar } from '../ui/FilterBar';
import { usePeriod } from '../ui/usePeriod';
import { fmtDate, fmtMonth, fmtNum } from '../ui/format';
import { ExportButtons } from '../ui/ExportButtons';
import { LotDailyChart, LotWeekChart, SentFgChart, lotChartMonth, yearOf } from '../ui/ExcelCharts';
import { useNavigate } from 'react-router-dom';
import { periodName } from './ReportPer';

interface Row { label: string; t: LotTotals; target: number; strong?: boolean }

export function buildLotRows(d: ReportData, p: Period): { rows: Row[]; prevYearTotal: LotTotals | null } {
  if (p.kind === 'year') {
    const months = monthsIn(p);
    const per = monthlyLot(months, d.lot, d.summaries);
    const rows: Row[] = months.map((m, i) => ({ label: fmtMonth(m), t: per[i], target: targetFor(d.targets, m).lotOutTarget }));
    rows.push({ label: `รวมปี ${p.year}`, t: sumLot(per), target: targetFor(d.targets, months[11]).lotOutTarget, strong: true });
    const prevMonths = months.map((m) => `${Number(m.slice(0, 4)) - 1}${m.slice(4)}`);
    let prev: LotTotals | null = sumLot(monthlyLot(prevMonths, d.prevYear.lot, d.prevYear.summaries));
    if (prev.sent === 0 && d.prevYear.yearSummary?.lotSent) {
      const y = d.prevYear.yearSummary;
      const lotSent = y.lotSent ?? 0, out = y.lotOut ?? 0;
      prev = { sent: lotSent, patrol: 0, fg: out, out, pct: lotSent ? (out / lotSent) * 100 : null };
    }
    return { rows, prevYearTotal: prev.sent ? prev : null };
  }
  const days = datesIn(p).filter((d0) => d.lot.some((e) => e.date === d0));
  const rows: Row[] = days.map((day) => ({
    label: fmtDate(day), t: lotTotals(d.lot.filter((e) => e.date === day)), target: targetFor(d.targets, monthOf(day)).lotOutTarget,
  }));
  if (p.kind === 'month') {
    const w = lotByWeek(d.lot, p.month);
    ([1, 2, 3, 4] as const).forEach((k) => rows.push({ label: `W${k}`, t: w[k], target: targetFor(d.targets, p.month).lotOutTarget, strong: true }));
  }
  rows.push({ label: 'รวม', t: lotTotals(d.lot), target: targetFor(d.targets, monthOf(datesIn(p)[0])).lotOutTarget, strong: true });
  return { rows, prevYearTotal: null };
}

export function ReportLot() {
  const [period, setPeriod] = usePeriod();
  const { data, error } = useReportData(period);
  const year = yearOf(period);
  const yearData = useReportData({ kind: 'year', year });
  const yd = yearData.data;
  const navigate = useNavigate();
  const chartMonth = yd ? lotChartMonth(period, yd.lot) : null;
  const built = useMemo(() => (data ? buildLotRows(data, period) : null), [data, period]);
  const head = ['ช่วง', 'Lot ส่งตรวจ', 'Lot out Patrol', 'Lot out FG', 'Lot out รวม', 'Lot out %', 'เป้า ≤%'];
  const exportRows = built ? [[`Lot out ${periodName(period)}`], head,
    ...built.rows.map((r) => [r.label, r.t.sent, r.t.patrol, r.t.fg, r.t.out, r.t.pct === null ? null : Math.round(r.t.pct * 100) / 100, r.target])] : [];
  return (
    <section>
      <div className="page-head"><h1>Lot out</h1><span className="muted">เป้า Lot out ≤ 0.50% (ตั้งค่าได้รายเดือน)</span></div>
      <FilterBar value={period} onChange={setPeriod}>
        {built && <ExportButtons name={`LotOut_${periodName(period)}`} sheets={[{ name: 'Lot out', rows: exportRows }]} target="report-lot" />}
      </FilterBar>
      {error && <p className="error">{error}</p>}
      {!data && !error && <p className="empty">กำลังโหลด…</p>}
      {built && (
        <div id="report-lot">
          {yd && (
            <>
              <div className="charts single"><SentFgChart d={yd} year={year} onPick={(m) => navigate(`/report/lot/fg?m=${m}`)} /></div>
              {chartMonth && (
                <>
                  <h2 className="section-title">รายสัปดาห์และรายวัน <small>{fmtMonth(chartMonth)}</small></h2>
                  <div className="charts">
                    <LotWeekChart lot={yd.lot} month={chartMonth} targets={yd.targets} label={fmtMonth(chartMonth)} />
                    <LotDailyChart lot={yd.lot} month={chartMonth} targets={yd.targets} label={fmtMonth(chartMonth)} />
                  </div>
                </>
              )}
            </>
          )}
          <h2 className="section-title">ตารางสรุป <small>{periodName(period)}</small></h2>
          <div className="tablewrap">
            <table>
              <thead><tr>{head.map((h, i) => <th key={h} className={i ? 'num' : ''}>{h}</th>)}</tr></thead>
              <tbody>
                {built.rows.map((r) => {
                  const over = r.t.pct !== null && r.t.pct > r.target;
                  return (
                    <tr key={r.label} className={r.strong ? 'group' : ''}>
                      <td>{r.label}</td>
                      <td className="num">{r.t.sent}</td><td className="num">{r.t.patrol}</td><td className="num">{r.t.fg}</td>
                      <td className="num">{r.t.out}</td>
                      <td className={`num ${over ? 'below-target' : ''}`}>{fmtNum(r.t.pct, 2)}</td>
                      <td className="num muted">{fmtNum(r.target, 2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {built.rows.length <= 1 && <p className="empty">ไม่มีข้อมูลในช่วงนี้</p>}
          {built.prevYearTotal && (
            <p className="muted">ปีก่อนหน้า: ส่งตรวจ {built.prevYearTotal.sent} ครั้ง · Lot out {built.prevYearTotal.out} ครั้ง · {fmtNum(built.prevYearTotal.pct, 2)}%</p>
          )}
        </div>
      )}
    </section>
  );
}
