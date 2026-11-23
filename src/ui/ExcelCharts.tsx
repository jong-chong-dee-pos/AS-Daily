import { Bar, CartesianGrid, Cell, ComposedChart, LabelList, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ReportData } from '../data/useReportData';
import { daysInMonth, monthsIn } from '../calc/period';
import { mean } from '../calc/per';
import { monthlyLot, monthlyPer, monthlySentFg, sumLot } from '../calc/monthly';
import { lotByWeek, lotTotals } from '../calc/lotout';
import { targetFor } from '../calc/cost';
import type { CostCategory, LotEntry, Target } from '../types';
import { buildCostRows } from '../pages/ReportCost';
import { fmtNum, THAI_MONTHS } from './format';


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

/** Vivid series palette: each data series keeps its own colour across every page. */
export const C = {
  per: '#6c5ce7', perSoft: '#c9c2fb',
  lot: '#00b3a4', lotSoft: '#a6e8e1',
  lotDay: '#2d8cff', lotWeek: '#ff8a3d',
  std: '#4aa8ff', act: '#8b5cf6', varUp: '#18b26b', varDown: '#ff4d7d',
  target: '#ff9f1a', targetLow: '#ff4d7d',
};
/** Kept for older imports. */
export const XL = { green: C.varUp, cyan: C.lot, red: C.varDown, orange: C.target, blue: C.lotDay, target: C.target };

const AXIS = { fill: '#6f6c8c', fontSize: 12 };

/** "AVG-26" is drawn on two lines so narrow columns never collide. */
function XTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  if (x === undefined || y === undefined || !payload) return null;
  const v = String(payload.value);
  // Year columns (2026) read as two short lines: ปี / 26.
  const [a, b] = /^\d{4}$/.test(v) ? ['ปี', v.slice(2)] : v.split('-');
  return (
    <text x={x} y={y + 12} textAnchor="middle" fontSize={12} fill={b ? '#4b4870' : AXIS.fill} fontWeight={b ? 600 : 400}>
      <tspan x={x}>{a}</tspan>{b && <tspan x={x} dy={14}>{b}</tspan>}
    </text>
  );
}

interface LabelProps { x?: number; y?: number; width?: number; height?: number; value?: number | null }
/** Value above a positive bar, below a negative one; vertical when bars are packed side by side. */
function BarValue({ x = 0, y = 0, width = 0, height = 0, value, fmt, vertical, color }: LabelProps & { fmt: (v: number) => string; vertical: boolean; color: string }) {
  if (value === null || value === undefined) return null;
  const top = Math.min(y, y + height), bottom = Math.max(y, y + height), cx = x + width / 2;
  const neg = value < 0;
  const text = fmt(value);
  const weight = value === 0 ? 400 : 600;
  const fill = value === 0 ? '#aeacc4' : color;
  if (vertical) {
    const ty = neg ? bottom + 4 : top - 4;
    return <text x={cx} y={ty} transform={`rotate(-90 ${cx} ${ty})`} textAnchor={neg ? 'end' : 'start'} dominantBaseline="central" fontSize={10} fontWeight={weight} fill={fill}>{text}</text>;
  }
  return <text x={cx} y={neg ? bottom + 14 : top - 6} textAnchor="middle" fontSize={12} fontWeight={weight} fill={fill}>{text}</text>;
}

const range = (vals: (number | null | string)[], digits: number) => {
  const xs = [...new Set(vals.filter((v): v is number => typeof v === 'number'))];
  if (!xs.length) return '';
  const lo = Math.min(...xs), hi = Math.max(...xs);
  return lo === hi ? fmtNum(lo, digits) : `${fmtNum(lo, digits)}–${fmtNum(hi, digits)}`;
};

export function ExcelChart({ title, sub, data, bars, line, height = 300, unit = '', soft }: {
  title: string; sub?: string; data: Point[]; bars: Series[]; line?: Series;
  height?: number; unit?: string;
  /** Lighter bar colour for summary columns such as AVG-25 or the year totals. */
  soft?: { color: string; from: number };
}) {
  const compact = bars.length > 1;
  const fmtBar = (digits: number) => (v: number) => (compact && Math.abs(v) >= 1000 ? `${fmtNum(v / 1000, 1)}k` : fmtNum(v, digits));
  const dense = data.length > 16;
  const legend = [
    ...bars.map((b) => ({ name: b.name, color: b.key === 'variance' ? `linear-gradient(90deg, ${C.varUp} 50%, ${C.varDown} 50%)` : b.color, line: false })),
    ...(line ? [{ name: `${line.name} ${range(data.map((p) => p[line.key]), line.digits)}${unit}`, color: line.color, line: true }] : []),
  ];
  return (
    <figure className="chart">
      <figcaption>
        <span className="chart-title">{title}{sub && <small>{sub}</small>}</span>
        <span className="chart-legend">
          {legend.map((l) => <span key={l.name}><i className={l.line ? 'ln' : ''} style={l.line ? { borderTopColor: l.color } : { background: l.color }} />{l.name}</span>)}
        </span>
      </figcaption>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: compact ? 54 : 26, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap={compact ? "12%" : "22%"}>
          <CartesianGrid stroke="#eeedf6" strokeDasharray="4 4" vertical={false} />
          <XAxis dataKey="name" tick={<XTick />} height={40} axisLine={{ stroke: '#dcdaea' }} tickLine={false} interval={dense ? 1 : 0} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} width={compact ? 52 : 40}
            domain={compact ? [(lo: number) => (lo < 0 ? lo * 2.2 : 0), 'auto'] : [0, 'auto']}
            tickFormatter={(v: number) => (compact ? `${fmtNum(v / 1000, 0)}k` : fmtNum(v, bars[0].digits > 0 && Math.abs(v) < 10 ? 1 : 0))} />
          <Tooltip cursor={{ fill: 'rgba(108,92,231,.06)' }}
            formatter={(v: number, n: string) => [`${fmtNum(v, [...bars, ...(line ? [line] : [])].find((s) => s.name === n)?.digits ?? 0)}${unit}`, n]} />
          {compact && <ReferenceLine y={0} stroke="#cfcde0" />}
          {bars.map((b) => (
            <Bar key={b.key} dataKey={b.key} name={b.name} fill={b.color} radius={[6, 6, 6, 6]} maxBarSize={dense ? 20 : compact ? 22 : 38} isAnimationActive={false}>
              {data.map((p, i) => {
                const v = p[b.key];
                const fill = b.key === 'variance' && typeof v === 'number' ? (v < 0 ? C.varDown : C.varUp) : soft && i >= soft.from ? soft.color : b.color;
                return <Cell key={i} fill={fill} />;
              })}
              <LabelList dataKey={b.key} content={(props) => (dense && !(props as LabelProps).value ? null :
                <BarValue {...(props as LabelProps)} fmt={fmtBar(b.digits)} vertical={compact}
                  color={b.key === 'variance' ? (Number((props as LabelProps).value) < 0 ? C.varDown : '#0f8a52') : '#2a2750'} />
              )} />
            </Bar>
          ))}
          {line && (
            <Line dataKey={line.key} name={line.name} stroke={line.color} strokeWidth={2} strokeDasharray="6 4" type="stepAfter"
              dot={false} activeDot={{ r: 4 }} connectNulls={false} isAnimationActive={false} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </figure>
  );
}

const avg = (pts: Point[], k: string, digits: number, unit: string) => {
  const v = mean(pts.map((p) => p[k]).filter((x): x is number => typeof x === 'number'));
  return v === null ? undefined : `เฉลี่ย ${fmtNum(v, digits)}${unit}`;
};

export const PerMonthChart = ({ d, year, height }: { d: ReportData; year: number; height?: number }) => (
  <ExcelChart title={`% PER รายเดือน ${year}`} data={perMonthSeries(d, year)} unit="%" height={height} soft={{ color: C.perSoft, from: 12 }}
    bars={[{ key: 'per', name: '% PER', color: C.per, digits: 0 }]}
    line={{ key: 'target', name: d.labels?.per ?? 'เป้า', color: C.target, digits: 0 }} />
);

export const LotMonthChart = ({ d, year, height }: { d: ReportData; year: number; height?: number }) => (
  <ExcelChart title={`Lot out % รายเดือน ${year}`} data={lotMonthSeries(d, year)} unit="%" height={height} soft={{ color: C.lotSoft, from: 12 }}
    bars={[{ key: 'pct', name: 'Lot out %', color: C.lot, digits: 2 }]}
    line={{ key: 'target', name: `${d.labels?.lot ?? 'เป้า'} ≤`, color: C.targetLow, digits: 2 }} />
);

export const LotDailyChart = ({ lot, month, targets, label }: { lot: LotEntry[]; month: string; targets: Target[]; label: string }) => {
  const data = lotDailySeries(lot, month, targets);
  return (
    <ExcelChart title={`Lot out % รายวัน ${label}`} sub={avg(data, 'pct', 2, '%')} data={data} unit="%"
      bars={[{ key: 'pct', name: 'Lot out %', color: C.lotDay, digits: 2 }]}
      line={{ key: 'target', name: 'เป้า ≤', color: C.targetLow, digits: 2 }} />
  );
};

export const LotWeekChart = ({ lot, month, targets, label }: { lot: LotEntry[]; month: string; targets: Target[]; label: string }) => (
  <ExcelChart title={`Lot out % รายสัปดาห์ ${label}`} data={lotWeekSeries(lot, month, targets)} unit="%"
    bars={[{ key: 'pct', name: 'Lot out %', color: C.lotWeek, digits: 2 }]}
    line={{ key: 'target', name: 'เป้า ≤', color: C.targetLow, digits: 2 }} />
);

export const CostChart = ({ d, year, cat, label, height = 340 }: { d: ReportData; year: number; cat: CostCategory; label: string; height?: number }) => (
  <ExcelChart title={`${label} ${year}`} sub="ตัวเลขบนแท่งเป็นพันบาท (k)" data={costSeries(d, year, cat)} height={height}
    bars={[
      { key: 'standard', name: 'Standard', color: C.std, digits: 0 },
      { key: 'actual', name: 'Actual', color: C.act, digits: 0 },
      { key: 'variance', name: 'Variance', color: C.varUp, digits: 0 },
    ]} />
);

/** Percentage label on a white pill so it stays readable where it crosses bars. */
function PctPill({ x, y, value, color }: { x?: number; y?: number; value?: number | null; color: string }) {
  if (x === undefined || y === undefined || value === null || value === undefined) return null;
  const text = `${fmtNum(value, 2)}%`;
  const w = text.length * 6.2 + 10;
  return (
    <g>
      <rect x={x - w / 2} y={y - 23} width={w} height={16} rx={8} fill="#fff" stroke={color} strokeWidth={1.2} />
      <text x={x} y={y - 11.5} textAnchor="middle" fontSize={10.5} fontWeight={700} fill={color}>{text}</text>
    </g>
  );
}

/**
 * One chart per year: lots sent (left axis), Lot out FG count (bars, value on each bar),
 * Lot out FG % and its target (right axis). Clicking a month opens its FG details.
 */
export function SentFgChart({ d, year, onPick, height = 380 }: { d: ReportData; year: number; onPick: (month: string) => void; height?: number }) {
  const months = monthsIn({ kind: 'year', year });
  const rows = monthlySentFg(months, d.lot, d.summaries);
  const data = rows.map((r) => ({
    name: short(r.month), month: r.month, sent: r.sent, fg: r.fg,
    pct: r.fg !== null && r.sent ? (r.fg / r.sent) * 100 : null,
    target: targetFor(d.targets, r.month).lotOutTarget,
  }));
  const fgMax = Math.max(1, ...rows.map((r) => r.fg ?? 0));
  const pctMax = Math.max(...data.map((p) => Math.max(p.pct ?? 0, p.target)));
  const pick = (i: number | undefined) => { if (i !== undefined && data[i]) onPick(data[i].month); };
  const label = d.labels?.lot ?? 'เป้า';
  return (
    <figure className="chart clickable">
      <figcaption>
        <span className="chart-title">Lot ส่งตรวจ เทียบ Lot out FG และ Lot out FG % รายเดือน {year}<small>กดที่เดือนเพื่อดูรายละเอียดงานที่ถูก Lot out FG</small></span>
        <span className="chart-legend">
          <span><i style={{ background: C.std }} />Lot ส่งตรวจ (แกนซ้าย)</span>
          <span><i style={{ background: C.varDown }} />Lot out FG (ตัวเลขในแท่ง)</span>
          <span><i style={{ background: C.act }} />Lot out FG % (แกนขวา)</span>
          <span><i className="ln" style={{ borderTopColor: C.target }} />{label} ≤ {range(data.map((p) => p.target), 2)}%</span>
        </span>
      </figcaption>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 28, right: 4, left: 0, bottom: 0 }} barGap={3} barCategoryGap="22%"
          onClick={(e: { activeTooltipIndex?: number } | null) => pick(e?.activeTooltipIndex)}>
          <CartesianGrid stroke="#eeedf6" strokeDasharray="4 4" vertical={false} />
          <XAxis dataKey="name" tick={<XTick />} height={40} axisLine={{ stroke: '#dcdaea' }} tickLine={false} interval={0} />
          <YAxis yAxisId="l" tick={AXIS} axisLine={false} tickLine={false} width={44} />
          <YAxis yAxisId="r" orientation="right" tick={{ ...AXIS, fill: C.act }} axisLine={false} tickLine={false} width={44}
            domain={[0, Math.ceil(pctMax * 1.5 * 10) / 10]} tickFormatter={(v: number) => `${fmtNum(v, 1)}%`} />
          {/* FG counts are tiny next to hundreds of lots: own hidden scale, kept low so the % line stays clear. */}
          <YAxis yAxisId="f" hide domain={[0, fgMax * 5.5]} />
          <Tooltip cursor={{ fill: 'rgba(108,92,231,.08)' }}
            formatter={(v: number, n: string) => [n.includes('%') || n.startsWith(label) ? `${fmtNum(v, 2)}%` : fmtNum(v, 0), n]} />
          <Bar yAxisId="l" dataKey="sent" name="Lot ส่งตรวจ" fill={C.std} fillOpacity={0.85} radius={[6, 6, 6, 6]} maxBarSize={30} isAnimationActive={false} onClick={(_: unknown, i: number) => pick(i)}>
            <LabelList dataKey="sent" content={(p) => <BarValue {...(p as LabelProps)} fmt={(v) => fmtNum(v, 0)} vertical={false} color="#2a2750" />} />
          </Bar>
          <Bar yAxisId="f" dataKey="fg" name="Lot out FG" fill={C.varDown} radius={[6, 6, 6, 6]} maxBarSize={30} isAnimationActive={false} onClick={(_: unknown, i: number) => pick(i)}>
            <LabelList dataKey="fg" content={(p) => {
              // Count sits inside the bar in white, so the % line crossing above never covers it.
              const { x = 0, y = 0, width = 0, height = 0, value } = p as LabelProps;
              if (value === null || value === undefined) return null;
              if (value === 0) return <text x={x + width / 2} y={y - 4} textAnchor="middle" fontSize={10} fill="#aeacc4">0</text>;
              return <text x={x + width / 2} y={y + Math.min(14, height - 3)} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff">{fmtNum(value, 0)}</text>;
            }} />
          </Bar>
          <Line yAxisId="r" dataKey="target" name={`${label} ≤`} stroke={C.target} strokeWidth={2} strokeDasharray="6 4" type="stepAfter" dot={false} isAnimationActive={false} />
          <Line yAxisId="r" dataKey="pct" name="Lot out FG %" stroke={C.act} strokeWidth={2.4} connectNulls={false} isAnimationActive={false}
            dot={{ r: 4, fill: '#fff', stroke: C.act, strokeWidth: 2 }}>
            <LabelList dataKey="pct" content={(p) => <PctPill {...(p as { x?: number; y?: number; value?: number | null })} color={C.act} />} />
          </Line>
        </ComposedChart>
      </ResponsiveContainer>
    </figure>
  );
}

export const yearOf = (p: import('../types').Period) =>
  p.kind === 'year' ? p.year : Number((p.kind === 'month' ? p.month : p.to).slice(0, 4));

/** The month the daily/weekly Lot charts show: the chosen month, else the latest month with daily data. */
export function lotChartMonth(p: import('../types').Period, lot: LotEntry[]): string | null {
  if (p.kind === 'month') return p.month;
  const last = lot.map((e) => e.date).sort().pop();
  return last ? last.slice(0, 7) : null;
}
