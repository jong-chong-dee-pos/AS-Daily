import { useState } from 'react';
import { Bar, CartesianGrid, Cell, ComposedChart, LabelList, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useNarrow } from './useNarrow';
import type { ReportData } from '../data/useReportData';
import { daysInMonth, monthsIn } from '../calc/period';
import { mean } from '../calc/per';
import { monthlyLot, monthlyPer, monthlySentFg, sumLot } from '../calc/monthly';
import { lotByWeek, lotPct, lotTotals } from '../calc/lotout';
import { targetFor } from '../calc/cost';
import type { AsmNoteKey, CostCategory, LotEntry, Target } from '../types';
import { buildCostRows } from '../pages/ReportCost';
import { fmtNum, MONTHS } from './format';
import { PAL } from './palette';
import { NoteDot, NoteLegend, NoteTip, notedNames, type NoteKey } from './chartNotes';


export interface Point { name: string; [k: string]: string | number | null }
interface Series { key: string; name: string; color: string; digits: number }

const yy = (y: number) => String(y).slice(2);
const short = (m: string) => MONTHS[Number(m.slice(5, 7)) - 1];
/** A month's note on one Assembly topic, or null; it rides on the point for the tooltip only. */
const monthNote = (d: ReportData, m: string, k: AsmNoteKey) => d.ops?.find((o) => o.month === m)?.notes?.[k]?.trim() || null;

/** % PER by month, then AVG for this year and the two before (sheet "% Per (Month)_"). */
export function perMonthSeries(d: ReportData, year: number): Point[] {
  const months = monthsIn({ kind: 'year', year });
  const per = monthlyPer(months, d.per, d.lines, d.summaries);
  const pts: Point[] = months.map((m, i) => ({ name: short(m), per: per[i], target: targetFor(d.targets, m).perTarget, note: monthNote(d, m, 'per') }));
  const prevMonths = monthsIn({ kind: 'year', year: year - 1 });
  const prevAvg = d.prevYear.yearSummary?.per
    ?? mean(monthlyPer(prevMonths, [], d.lines, d.prevYear.summaries).filter((v): v is number => v !== null));
  pts.push({ name: `AVG-${yy(year)}`, per: mean(per.filter((v): v is number => v !== null)), target: mean(months.map((m) => targetFor(d.targets, m).perTarget)) });
  pts.push({ name: `AVG-${yy(year - 1)}`, per: prevAvg ?? null, target: null });
  pts.push({ name: `AVG-${yy(year - 2)}`, per: d.prev2Year?.per ?? null, target: null });
  return pts;
}

/** Lot out FG % by month, then the year and the previous year (sheet "Lot out (Month)_26"). */
export function lotMonthSeries(d: ReportData, year: number): Point[] {
  const months = monthsIn({ kind: 'year', year });
  const t = monthlyLot(months, d.lot, d.summaries);
  const pts: Point[] = months.map((m, i) => ({ name: short(m), month: m, pct: t[i].pct, target: targetFor(d.targets, m).lotOutTarget, note: monthNote(d, m, 'lot') }));
  pts.push({ name: String(year), pct: sumLot(t).pct, target: targetFor(d.targets, months[0]).lotOutTarget });
  const y = d.prevYear.yearSummary;
  const prev = y && y.lotSent
    ? lotPct(y.lotFg ?? y.lotOut ?? 0, y.lotSent)
    : sumLot(monthlyLot(monthsIn({ kind: 'year', year: year - 1 }), d.prevYear.lot, d.prevYear.summaries)).pct;
  pts.push({ name: String(year - 1), pct: prev, target: null });
  return pts;
}

/** Lot out FG % for each day of one month (sheet "Lot out (Daily)"). */
export function lotDailySeries(lot: LotEntry[], month: string, targets: Target[]): Point[] {
  const target = targetFor(targets, month).lotOutTarget;
  return Array.from({ length: daysInMonth(month) }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, '0')}`;
    const day = lot.filter((e) => e.date === date);
    return { name: String(i + 1), pct: lotTotals(day).pct, target, note: day.map((e) => e.note?.trim()).filter(Boolean).join(' · ') || null };
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
    .map((r) => ({ name: short(r.month), standard: r.standard, actual: r.actual, variance: r.variance, note: r.note.trim() || null }));
}

/** Series colours, all taken from the one system palette (see palette.ts). */
export const C = {
  per: PAL.actual, perSoft: PAL.prev,
  lot: PAL.actual, lotSoft: PAL.prev,
  lotDay: PAL.actual, lotWeek: PAL.actual,
  std: PAL.plan, act: PAL.actual, varUp: PAL.good, varDown: PAL.bad,
  target: PAL.target, targetLow: PAL.target,
};
/** Kept for older imports. */
export const XL = { green: C.varUp, cyan: C.lot, red: C.varDown, orange: C.target, blue: C.lotDay, target: C.target };

const AXIS = { fill: '#6f6c8c', fontSize: 12 };

/** "AVG-26" is drawn on two lines so narrow columns never collide. */
/** `every` 2 names every other column (the days of a month) but still draws each column's note dot. */
function XTick({ x, y, payload, index = 0, noted, every = 1 }: { x?: number; y?: number; payload?: { value: string }; index?: number; noted?: Set<string>; every?: number }) {
  if (x === undefined || y === undefined || !payload) return null;
  const v = String(payload.value);
  const dot = noted?.has(v);
  if (index % every) return dot ? <NoteDot x={x} y={y} dy={22} /> : null;
  // Year columns (2026) read as two short lines: ปี / 26.
  const [a, b] = /^\d{4}$/.test(v) ? ['ปี', v.slice(2)] : v.split('-');
  return (
    <g>
      <text x={x} y={y + 12} textAnchor="middle" fontSize={12} fill={b ? '#4b4870' : AXIS.fill} fontWeight={b ? 600 : 400}>
        <tspan x={x}>{a}</tspan>{b && <tspan x={x} dy={14}>{b}</tspan>}
      </text>
      {dot && <NoteDot x={x} y={y} dy={b ? 36 : 22} />}
    </g>
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
  const fill = value === 0 ? '#6e6a8e' : color;
  if (vertical) {
    const ty = neg ? bottom + 4 : top - 4;
    return <text x={cx} y={ty} transform={`rotate(-90 ${cx} ${ty})`} textAnchor={neg ? 'end' : 'start'} dominantBaseline="central" fontSize={12} fontWeight={weight} fill={fill}>{text}</text>;
  }
  return <text x={cx} y={neg ? bottom + 14 : top - 6} textAnchor="middle" fontSize={12} fontWeight={weight} fill={fill}>{text}</text>;
}

const range = (vals: (number | null | string)[], digits: number) => {
  const xs = [...new Set(vals.filter((v): v is number => typeof v === 'number'))];
  if (!xs.length) return '';
  const lo = Math.min(...xs), hi = Math.max(...xs);
  return lo === hi ? fmtNum(lo, digits) : `${fmtNum(lo, digits)}–${fmtNum(hi, digits)}`;
};

export function ExcelChart({ title, sub, data, bars, line, height = 300, unit = '', soft, judge, onPick, notes = [] }: {
  title: string; sub?: string; data: Point[]; bars: Series[]; line?: Series;
  height?: number; unit?: string;
  /** Makes a column clickable; return false for columns that open nothing (a pointer shows only on the others). */
  onPick?: { can: (p: Point) => boolean; go: (p: Point) => void };
  /** Colours a single bar green when its column met the target, red when it missed. */
  judge?: (p: Point) => boolean | null;
  /** Lighter bar colour for summary columns such as AVG-25 or the year totals. */
  soft?: { color: string; from: number };
  /** Point fields holding a note: shown in the tooltip only, with a dot under the column's name. */
  notes?: NoteKey[];
}) {
  const noted = notedNames(data, notes);
  const compact = bars.length > 1;
  const [hover, setHover] = useState<number | null>(null);
  const canPick = (i: number | null | undefined) => onPick && i != null && data[i] ? onPick.can(data[i]) : false;
  const fmtBar = (digits: number) => (v: number) => (compact && Math.abs(v) >= 1000 ? `${fmtNum(v / 1000, 1)}k` : fmtNum(v, digits));
  const dense = data.length > 16;
  // On a phone the month names skip when they would touch, and paired bars leave their values to the tooltip.
  const narrow = useNarrow();
  const legend = [
    ...bars.flatMap((b) => (judge ? [{ name: `${b.name} ถึงเป้า`, color: C.varUp, line: false }, { name: 'ไม่ถึงเป้า', color: C.varDown, line: false }]
      : [{ name: b.name, color: b.key === 'variance' ? `linear-gradient(90deg, ${C.varUp} 50%, ${C.varDown} 50%)` : b.color, line: false }])),
    ...(soft ? [{ name: 'ปีก่อน / ค่าเฉลี่ย', color: soft.color, line: false }] : []),
    ...(line ? [{ name: `${line.name} ${range(data.map((p) => p[line.key]), line.digits)}${unit}`, color: line.color, line: true }] : []),
  ];
  return (
    <figure className="chart" style={canPick(hover) ? { cursor: 'pointer' } : undefined}>
      <figcaption>
        <span className="chart-title">{title}{sub && <small>{sub}</small>}</span>
        <span className="chart-legend">
          {legend.map((l) => <span key={l.name}><i className={l.line ? 'ln' : ''} style={l.line ? { borderTopColor: l.color } : { background: l.color }} />{l.name}</span>)}
          <NoteLegend show={noted.size > 0} />
        </span>
      </figcaption>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: compact ? 62 : 26, right: 8, left: 0, bottom: 0 }} barGap={1} barCategoryGap={compact ? '6%' : '22%'}
          {...(onPick ? {
            // The whole column answers, not only the bar: a small bar is hard to hit.
            onMouseMove: (e: { activeTooltipIndex?: number } | null) => setHover(e?.activeTooltipIndex ?? null),
            onMouseLeave: () => setHover(null),
            onClick: (e: { activeTooltipIndex?: number } | null) => { const i = e?.activeTooltipIndex; if (canPick(i)) onPick.go(data[i as number]); },
          } : {})}>
          <CartesianGrid stroke="#eeedf6" strokeDasharray="4 4" vertical={false} />
          <XAxis dataKey="name" tick={<XTick noted={noted} every={!narrow && dense ? 2 : 1} />} height={noted.size ? 48 : 40} axisLine={{ stroke: '#dcdaea' }} tickLine={false} interval={narrow ? 'preserveStartEnd' : 0} minTickGap={narrow ? 6 : 5} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} width={compact ? 52 : 40}
            domain={compact ? [(lo: number) => (lo < 0 ? lo * 2.2 : 0), 'auto'] : [0, 'auto']}
            tickFormatter={(v: number) => (compact ? `${fmtNum(v / 1000, 0)}k` : fmtNum(v, bars[0].digits > 0 && Math.abs(v) < 10 ? 1 : 0))} />
          <Tooltip cursor={{ fill: canPick(hover) ? 'rgba(108,92,231,.14)' : 'rgba(108,92,231,.06)' }}
            content={<NoteTip keys={notes} fmt={(v, n) => `${fmtNum(v, [...bars, ...(line ? [line] : [])].find((s) => s.name === n)?.digits ?? 0)}${unit}`}
              title={(l, p) => (onPick && onPick.can(p as Point) ? `${l} · กดเพื่อดูรายละเอียด` : l)} />} />
          {compact && <ReferenceLine y={0} stroke="#cfcde0" />}
          {bars.map((b) => (
            <Bar key={b.key} dataKey={b.key} name={b.name} fill={b.color} radius={[6, 6, 6, 6]} maxBarSize={dense ? 20 : compact ? 30 : 38} isAnimationActive={false}>
              {data.map((p, i) => {
                const v = p[b.key];
                const ok = judge ? judge(p) : null;
                const fill = b.key === 'variance' && typeof v === 'number' ? (v < 0 ? C.varDown : C.varUp)
                  : soft && i >= soft.from ? soft.color : ok === null ? b.color : ok ? C.varUp : C.varDown;
                return <Cell key={i} fill={fill} fillOpacity={onPick && hover === i && canPick(i) ? 0.8 : 1} />;
              })}
              {!(narrow && (compact || data.length > 8)) && <LabelList dataKey={b.key} content={(props) => (dense && !(props as LabelProps).value ? null :
                <BarValue {...(props as LabelProps)} fmt={fmtBar(b.digits)} vertical={compact}
                  color={b.key === 'variance' ? (Number((props as LabelProps).value) < 0 ? '#c92a52' : '#0b7d4a') : '#2a2750'} />
              )} />}
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
  <ExcelChart title={`% PER รายเดือน ${year}`} data={perMonthSeries(d, year)} unit="%" height={height} soft={{ color: C.perSoft, from: 12 }} notes={[{ key: 'note' }]}
    judge={(p) => (typeof p.per === 'number' && typeof p.target === 'number' ? p.per >= p.target : null)}
    bars={[{ key: 'per', name: '% PER', color: C.per, digits: 0 }]}
    line={{ key: 'target', name: d.labels?.per ?? 'เป้า', color: C.target, digits: 0 }} />
);

const lotOk = (p: Point) => (typeof p.pct === 'number' && typeof p.target === 'number' ? p.pct <= p.target : null);

/**
 * `onPick` opens a month's Lot out FG detail. Months with Lot sent recorded open (a 0% month shows
 * an empty list); months not entered yet and the year columns do nothing.
 */
export const LotMonthChart = ({ d, year, height, onPick }: { d: ReportData; year: number; height?: number; onPick?: (month: string) => void }) => (
  <ExcelChart title={`Lot out FG % รายเดือน ${year}`} sub={onPick ? 'กดที่แท่งเพื่อดูรายละเอียด Lot out FG ของเดือนนั้น' : undefined}
    onPick={onPick && { can: (p) => typeof p.month === 'string' && typeof p.pct === 'number', go: (p) => onPick(String(p.month)) }}
    data={lotMonthSeries(d, year)} unit="%" height={height} soft={{ color: C.lotSoft, from: 12 }} notes={[{ key: 'note' }]}
    judge={lotOk}
    bars={[{ key: 'pct', name: 'Lot out FG %', color: C.lot, digits: 2 }]}
    line={{ key: 'target', name: `${d.labels?.lot ?? 'เป้า'} ≤`, color: C.targetLow, digits: 2 }} />
);

export const LotDailyChart = ({ lot, month, targets, label }: { lot: LotEntry[]; month: string; targets: Target[]; label: string }) => {
  const data = lotDailySeries(lot, month, targets);
  return (
    <ExcelChart title={`Lot out FG % รายวัน ${label}`} sub={avg(data, 'pct', 2, '%')} data={data} unit="%" judge={lotOk} notes={[{ key: 'note' }]}
      bars={[{ key: 'pct', name: 'Lot out FG %', color: C.lotDay, digits: 2 }]}
      line={{ key: 'target', name: 'เป้า ≤', color: C.targetLow, digits: 2 }} />
  );
};

export const LotWeekChart = ({ lot, month, targets, label }: { lot: LotEntry[]; month: string; targets: Target[]; label: string }) => (
  <ExcelChart title={`Lot out FG % รายสัปดาห์ ${label}`} data={lotWeekSeries(lot, month, targets)} unit="%" judge={lotOk}
    bars={[{ key: 'pct', name: 'Lot out FG %', color: C.lotWeek, digits: 2 }]}
    line={{ key: 'target', name: 'เป้า ≤', color: C.targetLow, digits: 2 }} />
);

export const CostChart = ({ d, year, cat, label, height = 340 }: { d: ReportData; year: number; cat: CostCategory; label: string; height?: number }) => (
  <ExcelChart title={`${label} ${year}`} sub="ตัวเลขบนแท่งเป็นพันบาท (k)" data={costSeries(d, year, cat)} height={height} notes={[{ key: 'note' }]}
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
  const w = text.length * 7 + 12;
  return (
    <g>
      <rect x={x - w / 2} y={y - 24} width={w} height={18} rx={9} fill="#fff" stroke={color} strokeWidth={1.2} />
      <text x={x} y={y - 11} textAnchor="middle" fontSize={12} fontWeight={700} fill={color}>{text}</text>
    </g>
  );
}

/**
 * One chart per year: lots sent (left axis), Lot out FG count (bars, value on each bar),
 * Lot out FG % and its target (right axis). Clicking a month opens its FG details.
 */
export function SentFgChart({ d, year, onPick, height = 380 }: { d: ReportData; year: number; onPick: (month: string) => void; height?: number }) {
  const narrow = useNarrow();
  const months = monthsIn({ kind: 'year', year });
  const rows = monthlySentFg(months, d.lot, d.summaries);
  const data = rows.map((r) => ({
    name: short(r.month), month: r.month, sent: r.sent, fg: r.fg,
    pct: r.fg !== null && r.sent ? (r.fg / r.sent) * 100 : null,
    target: targetFor(d.targets, r.month).lotOutTarget,
    note: monthNote(d, r.month, 'lot'),
  }));
  const noteKeys = [{ key: 'note' }];
  const noted = notedNames(data, noteKeys);
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
          <NoteLegend show={noted.size > 0} />
        </span>
      </figcaption>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 28, right: 4, left: 0, bottom: 0 }} barGap={3} barCategoryGap="22%"
          onClick={(e: { activeTooltipIndex?: number } | null) => pick(e?.activeTooltipIndex)}>
          <CartesianGrid stroke="#eeedf6" strokeDasharray="4 4" vertical={false} />
          <XAxis dataKey="name" tick={<XTick noted={noted} />} height={noted.size ? 48 : 40} axisLine={{ stroke: '#dcdaea' }} tickLine={false} interval={narrow ? 'preserveStartEnd' : 0} minTickGap={6} />
          <YAxis yAxisId="l" tick={AXIS} axisLine={false} tickLine={false} width={44} />
          <YAxis yAxisId="r" orientation="right" tick={{ ...AXIS, fill: C.act }} axisLine={false} tickLine={false} width={44}
            domain={[0, Math.ceil(pctMax * 1.5 * 10) / 10]} tickFormatter={(v: number) => `${fmtNum(v, 1)}%`} />
          {/* FG counts are tiny next to hundreds of lots: own hidden scale, kept low so the % line stays clear. */}
          <YAxis yAxisId="f" hide domain={[0, fgMax * 5.5]} />
          <Tooltip cursor={{ fill: 'rgba(108,92,231,.08)' }}
            content={<NoteTip keys={noteKeys} fmt={(v, n) => (n.includes('%') || n.startsWith(label) ? `${fmtNum(v, 2)}%` : fmtNum(v, 0))} />} />
          <Bar yAxisId="l" dataKey="sent" name="Lot ส่งตรวจ" fill={C.std} fillOpacity={0.85} radius={[6, 6, 6, 6]} maxBarSize={30} isAnimationActive={false} onClick={(_: unknown, i: number) => pick(i)}>
            {!narrow && <LabelList dataKey="sent" content={(p) => <BarValue {...(p as LabelProps)} fmt={(v) => fmtNum(v, 0)} vertical={false} color="#2a2750" />} />}
          </Bar>
          <Bar yAxisId="f" dataKey="fg" name="Lot out FG" fill={C.varDown} radius={[6, 6, 6, 6]} maxBarSize={30} isAnimationActive={false} onClick={(_: unknown, i: number) => pick(i)}>
            <LabelList dataKey="fg" content={(p) => {
              // Count sits inside the bar in dark ink (white fails contrast on pink), so the % line crossing above never covers it.
              const { x = 0, y = 0, width = 0, height = 0, value } = p as LabelProps;
              if (value === null || value === undefined) return null;
              // No count is drawn for 0: the 0.00% pill of that month already says it.
              if (value === 0) return null;
              return <text x={x + width / 2} y={y + Math.min(15, height - 3)} textAnchor="middle" fontSize={12} fontWeight={700} fill="#1f1d3d">{fmtNum(value, 0)}</text>;
            }} />
          </Bar>
          <Line yAxisId="r" dataKey="target" name={`${label} ≤`} stroke={C.target} strokeWidth={2} strokeDasharray="6 4" type="stepAfter" dot={false} isAnimationActive={false} />
          <Line yAxisId="r" dataKey="pct" name="Lot out FG %" stroke={C.act} strokeWidth={2.4} connectNulls={false} isAnimationActive={false}
            dot={{ r: 4, fill: '#fff', stroke: C.act, strokeWidth: 2 }}>
            {!narrow && <LabelList dataKey="pct" content={(p) => <PctPill {...(p as { x?: number; y?: number; value?: number | null })} color={C.act} />} />}
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

export interface RankRow { name: string; per: number; days?: number }

/**
 * Horizontal bars, one per line / Setter / person, best first, coloured by whether
 * the period average met the target; the target is a dashed vertical line.
 */
export function PerRankChart({ title, sub, rows, target }: { title: string; sub?: string; rows: RankRow[]; target: number }) {
  const data = [...rows].sort((a, b) => b.per - a.per);
  const lo = Math.min(target, ...data.map((r) => r.per));
  const hi = Math.max(target, ...data.map((r) => r.per));
  const nameWidth = Math.min(200, Math.max(70, ...data.map((r) => r.name.length * 8 + 16)));
  return (
    <figure className="chart">
      <figcaption>
        <span className="chart-title">{title}{sub && <small>{sub}</small>}</span>
        <span className="chart-legend">
          <span><i style={{ background: C.varUp }} />ถึงเป้า</span>
          <span><i style={{ background: C.varDown }} />ต่ำกว่าเป้า</span>
          <span><i className="ln" style={{ borderTopColor: C.target }} />เป้า {fmtNum(target, 0)}%</span>
        </span>
      </figcaption>
      <ResponsiveContainer width="100%" height={Math.max(140, data.length * 34 + 40)}>
        <ComposedChart layout="vertical" data={data} margin={{ top: 8, right: 56, left: 0, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid stroke="#eeedf6" strokeDasharray="4 4" horizontal={false} />
          <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false}
            domain={[Math.max(0, Math.floor((lo - 15) / 10) * 10), Math.ceil((hi + 5) / 10) * 10]} tickFormatter={(v: number) => `${v}`} />
          <YAxis type="category" dataKey="name" tick={{ ...AXIS, fill: '#2a2750' }} axisLine={false} tickLine={false} width={nameWidth} interval={0} />
          <Tooltip cursor={{ fill: 'rgba(108,92,231,.06)' }}
            formatter={(v: number) => [`${fmtNum(v, 1)}%`, '% PER เฉลี่ย']} />
          <ReferenceLine x={target} stroke={C.target} strokeWidth={2} strokeDasharray="6 4" />
          <Bar dataKey="per" name="% PER เฉลี่ย" radius={[0, 6, 6, 0]} maxBarSize={22} isAnimationActive={false}>
            {data.map((r, i) => <Cell key={i} fill={r.per < target ? C.varDown : C.varUp} />)}
            <LabelList dataKey="per" position="right" formatter={(v: number) => fmtNum(v, 1)} style={{ fontSize: 12, fontWeight: 600, fill: '#2a2750' }} />
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </figure>
  );
}
