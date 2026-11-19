import { Bar, CartesianGrid, ComposedChart, LabelList, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ReportData } from '../data/useReportData';
import { daysInMonth, monthsIn } from '../calc/period';
import { mean } from '../calc/per';
import { monthlyLot, monthlyPer, sumLot } from '../calc/monthly';
import { lotByWeek, lotTotals } from '../calc/lotout';
import { targetFor } from '../calc/cost';
import type { CostCategory, LotEntry, Target } from '../types';
import { buildCostRows } from '../pages/ReportCost';
import { fmtNum, THAI_MONTHS } from './format';

/** Series colours follow the original Daily.xlsx charts. */
export const XL = { green: '#1fbf75', cyan: '#12a8d8', red: '#e5484d', orange: '#f07c1c', blue: '#4472c4', target: '#ed7d31' };

export interface Point { name: string; [k: string]: string | number | null }
interface Series { key: string; name: string; color: string; digits: number }

const yy = (y: number) => String(y).slice(2);
const short = (m: string) => THAI_MONTHS[Number(m.slice(5, 7)) - 1];

/** % PER by month, then AVG for this year and the two before (sheet "% Per (Month)_"). */
export function perMonthSeries(d: ReportData, year: number): Point[] {
  const months = monthsIn({ kind: 'year', year });
  const per = monthlyPer(months, d.per, d.lines, d.summaries);
  const pts: Point[] = months.map((m, i) => ({ name: short(m), per: per[i], target: targetFor(d.targets, m).perTarget }));
  const prevMonths = monthsIn({ kind: 'year', year: year - 1 });
  const prevAvg = d.prevYear.yearSummary?.per
    ?? mean(monthlyPer(prevMonths, [], d.lines, d.prevYear.summaries).filter((v): v is number => v !== null));
  pts.push({ name: `AVG-${yy(year)}`, per: mean(per.filter((v): v is number => v !== null)), target: mean(months.map((m) => targetFor(d.targets, m).perTarget)) });
  pts.push({ name: `AVG-${yy(year - 1)}`, per: prevAvg ?? null, target: null });
  pts.push({ name: `AVG-${yy(year - 2)}`, per: d.prev2Year?.per ?? null, target: null });
  return pts;
}

/** Lot out % by month, then the year and the previous year (sheet "Lot out (Month)_26"). */
export function lotMonthSeries(d: ReportData, year: number): Point[] {
  const months = monthsIn({ kind: 'year', year });
  const t = monthlyLot(months, d.lot, d.summaries);
  const pts: Point[] = months.map((m, i) => ({ name: short(m), pct: t[i].pct, target: targetFor(d.targets, m).lotOutTarget }));
  pts.push({ name: String(year), pct: sumLot(t).pct, target: targetFor(d.targets, months[0]).lotOutTarget });
  const y = d.prevYear.yearSummary;
  const prev = y && y.lotSent
    ? ((y.lotOut ?? 0) / y.lotSent) * 100
    : sumLot(monthlyLot(monthsIn({ kind: 'year', year: year - 1 }), d.prevYear.lot, d.prevYear.summaries)).pct;
  pts.push({ name: String(year - 1), pct: prev, target: null });
  return pts;
}

/** Lot out % for each day of one month (sheet "Lot out (Daily)"). */
export function lotDailySeries(lot: LotEntry[], month: string, targets: Target[]): Point[] {
  const target = targetFor(targets, month).lotOutTarget;
  return Array.from({ length: daysInMonth(month) }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, '0')}`;
    return { name: String(i + 1), pct: lotTotals(lot.filter((e) => e.date === date)).pct, target };
  });
}

export function lotWeekSeries(lot: LotEntry[], month: string, targets: Target[]): Point[] {
  const w = lotByWeek(lot, month);
  const target = targetFor(targets, month).lotOutTarget;
  return ([1, 2, 3, 4] as const).map((k) => ({ name: `W${k}`, pct: w[k].pct, target }));
}

/** Standard, Actual and Variance by month for one category (sheets Electric, Labor-OT, ...). */
export function costSeries(d: ReportData, year: number, cat: CostCategory): Point[] {
  return buildCostRows(d, { kind: 'year', year }).filter((r) => r.cat === cat)
    .map((r) => ({ name: short(r.month), standard: r.standard, actual: r.actual, variance: r.variance }));
}

const AXIS = { fill: 'var(--ink-2)', fontSize: 12 };

interface TargetLabelProps { x?: number; y?: number; index?: number; value?: number | null }
/** Target values are labelled only where they change, on a light chip so they stay readable over bars. */
function TargetLabel({ x, y, index, value, data, k, digits, color }: TargetLabelProps & { data: Point[]; k: string; digits: number; color: string }) {
  if (x === undefined || y === undefined || index === undefined || value === null || value === undefined) return null;
  const prev = index > 0 ? data[index - 1][k] : null;
  if (prev === value) return null;
  const text = fmtNum(value, digits);
  const w = text.length * 6.4 + 10;
  return (
    <g>
      <rect x={x - w / 2} y={y - 22} width={w} height={16} rx={8} fill="#fff" stroke={color} strokeWidth={1} />
      <text x={x} y={y - 10.5} textAnchor="middle" fontSize={10.5} fontWeight={600} fill={color}>{text}</text>
    </g>
  );
}

export function ExcelChart({ title, data, bars, line, refLine, height = 300, unit = '' }: {
  title: string; data: Point[]; bars: Series[]; line?: Series; refLine?: { value: number; color: string; label: string };
  height?: number; unit?: string;
}) {
  const fmt = (digits: number) => (v: unknown) => (typeof v === 'number' ? fmtNum(v, digits) : '');
  // Several money series side by side: thousands keep labels from colliding (42,930 → 42.9k).
  const compact = bars.length > 1;
  const fmtBar = (digits: number) => (v: unknown) => (typeof v !== 'number' ? '' : compact && Math.abs(v) >= 1000 ? `${fmtNum(v / 1000, 1)}k` : fmt(digits)(v));
  const dense = data.length > 16;
  return (
    <figure className="chart">
      <figcaption>{title}</figcaption>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 22, right: 12, left: 4, bottom: 0 }} barGap={2}>
          <CartesianGrid stroke="var(--hair)" vertical={false} />
          <XAxis dataKey="name" tick={AXIS} axisLine={{ stroke: 'var(--hair-strong)' }} tickLine={false} interval={0} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} width={dense ? 36 : 56}
            tickFormatter={(v: number) => fmtNum(v, bars[0].digits > 0 && Math.abs(v) < 10 ? 1 : 0)} />
          <Tooltip formatter={(v: number, n: string) => [`${fmtNum(v, [...bars, ...(line ? [line] : [])].find((s) => s.name === n)?.digits ?? 0)}${unit}`, n]} />
          <Legend wrapperStyle={{ fontSize: 12 }} iconType="square" />
          {refLine && <ReferenceLine y={refLine.value} stroke={refLine.color} strokeWidth={2} ifOverflow="extendDomain"
            label={{ value: refLine.label, position: 'insideTopRight', fill: refLine.color, fontSize: 11 }} />}
          {bars.map((b) => (
            <Bar key={b.key} dataKey={b.key} name={b.name} fill={b.color} radius={[3, 3, 0, 0]} maxBarSize={dense ? 18 : 40} isAnimationActive={false}>
              <LabelList dataKey={b.key} position="top" formatter={fmtBar(b.digits)}
                style={{ fontSize: dense || compact ? 10 : 11, fill: 'var(--ink)', fontWeight: 500 }} />
            </Bar>
          ))}
          {line && (
            <Line dataKey={line.key} name={line.name} stroke={line.color} strokeWidth={2.2} dot={{ r: 2.5 }} connectNulls={false} isAnimationActive={false}>
              <LabelList dataKey={line.key} content={(props) => <TargetLabel {...(props as TargetLabelProps)} data={data} k={line.key} digits={line.digits} color={line.color} />} />
            </Line>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </figure>
  );
}

export const PerMonthChart = ({ d, year, height }: { d: ReportData; year: number; height?: number }) => (
  <ExcelChart title={`% PER รายเดือน ${year}`} data={perMonthSeries(d, year)} unit="%" height={height}
    bars={[{ key: 'per', name: '% PER', color: XL.green, digits: 0 }]}
    line={{ key: 'target', name: 'เป้า', color: XL.target, digits: 0 }} />
);

export const LotMonthChart = ({ d, year, height }: { d: ReportData; year: number; height?: number }) => (
  <ExcelChart title={`Lot out % รายเดือน ${year}`} data={lotMonthSeries(d, year)} unit="%" height={height}
    bars={[{ key: 'pct', name: 'Lot out (%)', color: XL.green, digits: 2 }]}
    line={{ key: 'target', name: 'เป้า ≤ %', color: XL.red, digits: 2 }} />
);

export const LotDailyChart = ({ lot, month, targets, label }: { lot: LotEntry[]; month: string; targets: Target[]; label: string }) => (
  <ExcelChart title={`Lot out % รายวัน ${label}`} data={lotDailySeries(lot, month, targets)} unit="%"
    bars={[{ key: 'pct', name: 'Lot out (%)', color: XL.red, digits: 2 }]}
    line={{ key: 'target', name: 'เป้า ≤ %', color: XL.blue, digits: 2 }} />
);

export const LotWeekChart = ({ lot, month, targets, label }: { lot: LotEntry[]; month: string; targets: Target[]; label: string }) => (
  <ExcelChart title={`Lot out % รายสัปดาห์ ${label}`} data={lotWeekSeries(lot, month, targets)} unit="%" height={260}
    bars={[{ key: 'pct', name: 'Lot out (%)', color: XL.cyan, digits: 2 }]}
    line={{ key: 'target', name: 'เป้า ≤ %', color: XL.red, digits: 2 }} />
);

export const CostChart = ({ d, year, cat, label }: { d: ReportData; year: number; cat: CostCategory; label: string }) => (
  <ExcelChart title={`Variance ${label} ${year} (ตัวเลขบนแท่งเป็นพันบาท: k)`} data={costSeries(d, year, cat)}
    height={340}
    bars={[
      { key: 'standard', name: 'Standard', color: XL.cyan, digits: 0 },
      { key: 'actual', name: 'Actual', color: XL.green, digits: 0 },
      { key: 'variance', name: 'Variance', color: XL.orange, digits: 0 },
    ]} />
);

export const yearOf = (p: import('../types').Period) =>
  p.kind === 'year' ? p.year : Number((p.kind === 'month' ? p.month : p.to).slice(0, 4));

/** The month the daily/weekly Lot charts show: the chosen month, else the latest month with daily data. */
export function lotChartMonth(p: import('../types').Period, lot: LotEntry[]): string | null {
  if (p.kind === 'month') return p.month;
  const last = lot.map((e) => e.date).sort().pop();
  return last ? last.slice(0, 7) : null;
}
