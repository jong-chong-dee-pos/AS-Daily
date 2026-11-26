import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/context';
import { ap, canEdit } from '../areas';
import { Bar, CartesianGrid, Cell, ComposedChart, LabelList, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ReportData } from '../data/useReportData';
import { monthsIn } from '../calc/period';
import { OTD_TARGET, costPieces, headPieces, otdBand, otdPct, otdTotals, otdWeekly, opsDerived } from '../calc/ops';
import type { OtdMonth, OtdRow } from '../types';
import { fmtNum, MONTHS } from './format';
import { useNarrow } from './useNarrow';
import { PAL } from './palette';
import { NoteDot, NoteLegend, NoteTip, notedNames, type NoteKey } from './chartNotes';

export interface OpsPoint { name: string; [k: string]: string | number | null }
interface Series { key: string; name: string; color: string; digits: number }

const AXIS = { fill: '#6f6c8c', fontSize: 12 };
/** "Dec-24" (a previous December) is drawn on two lines so it never collides with its neighbour. */
function XTick({ x, y, payload, noted }: { x?: number; y?: number; payload?: { value: string }; noted?: Set<string> }) {
  if (x === undefined || y === undefined || !payload) return null;
  const v = String(payload.value);
  const m = /^(.+)-(\d{2})$/.exec(v);
  const sp = v.indexOf(' ');
  const [a, b] = m ? [m[1], m[2]] : sp > 0 ? [v.slice(0, sp), v.slice(sp + 1)] : [v, ''];
  const t = (
    <text x={x} y={y + 12} textAnchor="middle" fontSize={12} fill={m ? '#4b4870' : AXIS.fill} fontWeight={m ? 600 : 400}>
      <tspan x={x}>{a}</tspan>{b && <tspan x={x} dy={14}>{b}</tspan>}
    </text>
  );
  return noted?.has(v) ? <g>{t}<NoteDot x={x} y={y} dy={b ? 36 : 22} /></g> : t;
}
const short = (m: string) => MONTHS[Number(m.slice(5, 7)) - 1];
export const OTD_COLORS = { good: PAL.good, warn: PAL.warn, bad: PAL.bad, none: PAL.none } as const;

/** One point per month of the year: entered figures and the per-piece values computed from them. */
export function opsSeries(d: ReportData, year: number): OpsPoint[] {
  return monthsIn({ kind: 'year', year }).map((m) => {
    const o = d.ops?.find((x) => x.month === m);
    const c = o ? opsDerived(o) : null;
    return {
      name: short(m),
      prodPlan: o?.prodPlan ?? null, prodActual: o?.prodActual ?? null,
      matStd: o?.matStd ?? null, matAct: o?.matAct ?? null,
      processCost: o?.processCost ?? null, processPerPcs: c?.processPerPcs ?? null,
      pcsPerHead: c?.pcsPerHead ?? null, expensePerPcs: c?.expensePerPcs ?? null,
      // The production line of each "per pcs" card shows only months that have figures for that card.
      prodCost: o && (o.processCost != null || o.prodForCost != null) ? costPieces(o) : null,
      prodHead: o && (o.headcount != null || o.expense != null || o.prodForHead != null) ? headPieces(o) : null,
      // Notes ride along for the tooltips only.
      noteProd: o?.notes?.prod?.trim() || null, noteMat: o?.notes?.mat?.trim() || null,
      noteProcess: o?.notes?.process?.trim() || null, noteHead: o?.notes?.head?.trim() || null,
    };
  });
}

/**
 * Monthly %OTD: December of the two previous years (when known), then every month of
 * the year, as in the "%OTD Monthly FG 81" chart.
 */
export function otdMonthSeries(d: ReportData, year: number): OpsPoint[] {
  const pct = (m: string) => d.otd?.find((x) => x.month === m)?.pct ?? null;
  const decs = [year - 2, year - 1].map((y) => `${y}-12`).filter((m) => pct(m) !== null)
    .map((m) => ({ name: `Dec-${m.slice(2, 4)}`, pct: pct(m) }));
  const note = (m: string) => d.ops?.find((o) => o.month === m)?.notes?.otd?.trim() || null;
  return [...decs, ...monthsIn({ kind: 'year', year }).map((m) => ({ name: short(m), pct: pct(m), note: note(m) }))]
    .map((p) => ({ ...p, pct: p.pct === null ? null : Math.round(p.pct * 1000) / 10 }));
}

interface ValueProps { x?: number; y?: number; width?: number; value?: number | null }
/** A bar's value above it; written upright when two bars share a month, so neighbours never overlap. */
function BarValue({ x = 0, y = 0, width = 0, value, text, vertical }: ValueProps & { text: (v: number) => string; vertical: boolean }) {
  if (value === null || value === undefined) return null;
  const cx = x + width / 2;
  return vertical
    ? <text x={cx} y={y - 5} transform={`rotate(-90 ${cx} ${y - 5})`} dominantBaseline="central" fontSize={12} fontWeight={600} fill="#2a2750">{text(value)}</text>
    : <text x={cx} y={y - 6} textAnchor="middle" fontSize={12} fontWeight={600} fill="#2a2750">{text(value)}</text>;
}
const big = (v: number, digits: number) => (Math.abs(v) >= 10000 ? `${fmtNum(v / 1000, 1)}k` : fmtNum(v, digits));

/**
 * Bars by month, optionally with a line on its own right-hand axis (production volume),
 * and an optional target line. `colorOf` colours single bars (e.g. %OTD bands).
 */
export function MonthChart({ title, sub, data, bars, line, height = 300, unit = '', target, colorOf, legend, notes = [] }: {
  title: string; sub?: string; data: OpsPoint[]; bars: Series[]; line?: Series; height?: number; unit?: string;
  target?: { y: number; label: string }; colorOf?: (v: number | null) => string; legend?: { name: string; color: string }[];
  /** Point fields that hold a note: a dot under the month, the text in the tooltip. */
  notes?: NoteKey[];
}) {
  const noted = notedNames(data, notes);
  const hasData = data.some((p) => bars.some((b) => typeof p[b.key] === 'number'));
  // On a phone 12+ months don't fit side by side: label every other month and leave
  // the values to the tooltip (tap a bar).
  const crowded = useNarrow() && data.length > 6;
  const items = legend ?? [
    ...bars.map((b) => ({ name: b.name, color: b.color })),
    ...(line ? [{ name: `${line.name} (แกนขวา)`, color: line.color }] : []),
  ];
  return (
    // Paired bars take the full row so each bar's upright value has room.
    <figure className={bars.length > 1 ? 'chart span2' : 'chart'}>
      <figcaption>
        <span className="chart-title">{title}{sub && <small>{sub}</small>}</span>
        <span className="chart-legend">
          {items.map((l) => <span key={l.name}><i style={{ background: l.color }} />{l.name}</span>)}
          {target && <span><i className="ln" style={{ borderTopColor: PAL.target }} />{target.label}</span>}
          <NoteLegend show={noted.size > 0} />
        </span>
      </figcaption>
      {!hasData ? <p className="empty" style={{ height: height - 60 }}>ยังไม่มีข้อมูลของปีนี้</p> : (
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={data} margin={{ top: bars.length > 1 && !crowded ? 66 : 28, right: line ? 4 : 12, left: 0, bottom: 0 }} barGap={3} barCategoryGap={bars.length > 1 ? '18%' : '28%'}>
            <CartesianGrid stroke="#eeedf6" strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="name" tick={<XTick noted={noted} />} height={(data.some((p) => /-\d{2}$| /.test(String(p.name))) ? 40 : 30) + (noted.size ? 8 : 0)} axisLine={{ stroke: '#dcdaea' }} tickLine={false} interval={crowded ? 'preserveStartEnd' : 0} minTickGap={6} />
            <YAxis yAxisId="l" tick={AXIS} axisLine={false} tickLine={false} width={48} domain={[0, 'auto']}
              tickFormatter={(v: number) => big(v, bars[0].digits > 0 && v < 10 ? 1 : 0)} />
            {line && <YAxis yAxisId="r" orientation="right" tick={{ ...AXIS, fill: line.color }} axisLine={false} tickLine={false} width={48}
              domain={[0, 'auto']} tickFormatter={(v: number) => big(v, 0)} />}
            <Tooltip cursor={{ fill: 'rgba(108,92,231,.06)' }}
              content={<NoteTip keys={notes} fmt={(v, n) => `${fmtNum(v, [...bars, ...(line ? [line] : [])].find((s) => s.name === n)?.digits ?? 0)}${unit}`} />} />
            {target && <ReferenceLine yAxisId="l" y={target.y} stroke={PAL.target} strokeWidth={2} strokeDasharray="6 4" />}
            {bars.map((b) => (
              <Bar key={b.key} yAxisId="l" dataKey={b.key} name={b.name} fill={b.color} radius={[6, 6, 0, 0]} maxBarSize={bars.length > 1 ? 26 : 40} isAnimationActive={false}>
                {colorOf && data.map((p, i) => <Cell key={i} fill={colorOf(typeof p[b.key] === 'number' ? (p[b.key] as number) : null)} />)}
                {!crowded && <LabelList dataKey={b.key} content={(p) => <BarValue {...(p as ValueProps)} text={(v) => `${big(v, b.digits)}${unit}`} vertical={bars.length > 1} />} />}
              </Bar>
            ))}
            {line && (
              <Line yAxisId="r" dataKey={line.key} name={line.name} stroke={line.color} strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </figure>
  );
}

const band = (pct: number | null) => OTD_COLORS[otdBand(pct === null ? null : pct / 100)];

interface Strip { kind: 'line' | 'bar'; key: string; name: string; color: string; digits: number; height: number }

/**
 * One card laid out like the old "Process Cost per pcs" sheet: a production line on top,
 * then the bar charts that are computed from it, all sharing the same months.
 */
export function StackCard({ title, sub, data, strips, notes = [] }: { title: string; sub?: string; data: OpsPoint[]; strips: Strip[]; notes?: NoteKey[] }) {
  const crowded = useNarrow() && data.length > 6;
  const noted = notedNames(data, notes);
  const hasData = data.some((p) => strips.some((st) => typeof p[st.key] === 'number'));
  return (
    <figure className="chart wide stack">
      <figcaption>
        <span className="chart-title">{title}{sub && <small>{sub}</small>}</span>
        {noted.size > 0 && <span className="chart-legend"><NoteLegend show /></span>}
      </figcaption>
      {!hasData ? <p className="empty">ยังไม่มีข้อมูลของปีนี้</p> : strips.map((st, si) => {
        const vals = data.map((p) => p[st.key]).filter((v): v is number => typeof v === 'number');
        const text = (v: number) => (st.kind === 'line' ? fmtNum(v, st.digits) : big(v, st.digits));
        return (
          <div key={st.key} className="stack-part">
            <div className="stack-band">{st.name}</div>
            <ResponsiveContainer width="100%" height={st.height}>
              <ComposedChart data={data} syncId={title} margin={{ top: 24, right: 16, left: 0, bottom: 0 }} barCategoryGap="34%">
                <CartesianGrid stroke="#eeedf6" strokeDasharray="4 4" vertical={false} />
                {/* The note dot sits under the first strip's months only. */}
                <XAxis dataKey="name" tick={<XTick noted={si === 0 ? noted : undefined} />} height={si === 0 && noted.size ? 34 : 26} axisLine={{ stroke: '#dcdaea' }} tickLine={false} interval={crowded ? 'preserveStartEnd' : 0} minTickGap={6} />
                {st.kind === 'line'
                  ? <YAxis tick={false} axisLine={false} tickLine={false} width={56}
                      domain={vals.length ? [Math.min(...vals) * 0.85, Math.max(...vals) * 1.05] : [0, 'auto']} />
                  : <YAxis tick={AXIS} axisLine={false} tickLine={false} width={56} domain={[0, 'auto']}
                      tickFormatter={(v: number) => big(v, st.digits > 0 && v < 10 ? 1 : 0)} />}
                <Tooltip cursor={{ fill: 'rgba(108,92,231,.06)' }} content={<NoteTip keys={notes} fmt={(v) => fmtNum(v, st.digits)} />} />
                {/* An empty bar series puts the line's points in the middle of each month, over the bars below. */}
                {st.kind === 'line' && <Bar dataKey="_" legendType="none" isAnimationActive={false} />}
                {st.kind === 'line'
                  ? <Line dataKey={st.key} name={st.name} stroke={st.color} strokeWidth={2.5} dot={{ r: 3.5, fill: st.color }} connectNulls={false} isAnimationActive={false}>
                      {!crowded && <LabelList dataKey={st.key} content={(p) => <BarValue {...(p as ValueProps)} text={text} vertical={false} />} />}
                    </Line>
                  : <Bar dataKey={st.key} name={st.name} fill={st.color} radius={[6, 6, 0, 0]} maxBarSize={44} isAnimationActive={false}>
                      {!crowded && <LabelList dataKey={st.key} content={(p) => <BarValue {...(p as ValueProps)} text={text} vertical={false} />} />}
                    </Bar>}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        );
      })}
    </figure>
  );
}

/** Production volume, material cost, and the two "per pcs" cards of the old monthly report. */
export function OpsCharts({ d, year }: { d: ReportData; year: number }) {
  const s = opsSeries(d, year);
  return (
    <div className="charts">
      <MonthChart title={`Assembly Production Volume ${year}`} sub="ชิ้น" data={s} height={320}
        bars={[{ key: 'prodPlan', name: 'PLAN (PN)', color: PAL.plan, digits: 0 }, { key: 'prodActual', name: 'ACTUAL (AS)', color: PAL.actual, digits: 0 }]} notes={[{ key: 'noteProd' }]} />
      <MonthChart title={`Material cost Variance ${year}`} sub="Standard เทียบ Actual" data={s} height={320}
        bars={[{ key: 'matStd', name: 'Standard', color: PAL.plan, digits: 2 }, { key: 'matAct', name: 'Actual', color: PAL.actual, digits: 2 }]} notes={[{ key: 'noteMat' }]} />
      <StackCard title={`Process Cost per pcs ${year}`} sub="Process THB/Pcs. = Actual Process Cost ÷ Production" data={s} notes={[{ key: 'noteProcess' }]} strips={[
        { kind: 'line', key: 'prodCost', name: 'Production', color: PAL.actual, digits: 0, height: 120 },
        { kind: 'bar', key: 'processPerPcs', name: 'Process THB/Pcs.', color: PAL.actual, digits: 2, height: 200 },
        { kind: 'bar', key: 'processCost', name: 'Actual Process Cost (THB)', color: PAL.actual, digits: 0, height: 260 },
      ]} />
      <StackCard title={`Pcs./head และ Expense/Pcs. ${year}`} sub="Pcs./head = Production ÷ จำนวนคน · Expense/Pcs. = Expense ÷ Production" data={s} notes={[{ key: 'noteHead' }]} strips={[
        { kind: 'line', key: 'prodHead', name: 'Production', color: PAL.actual, digits: 0, height: 120 },
        { kind: 'bar', key: 'pcsPerHead', name: 'Pcs./head', color: PAL.actual, digits: 0, height: 230 },
        { kind: 'bar', key: 'expensePerPcs', name: 'Expense/Pcs.', color: PAL.actual, digits: 1, height: 230 },
      ]} />
    </div>
  );
}

const WEEK_NAMES = ['W1 (1-7)', 'W2 (8-14)', 'W3 (15-21)', 'W4 (22-31)'];
const pctText = (v: number | null) => (v === null ? '–' : `${fmtNum(v * 100, 0)}%`);
const qty = (v: number) => (v ? fmtNum(v, 0) : '–');

function OtdCell({ pct }: { pct: number | null }) {
  return <td className={`otd-cell ${otdBand(pct)}`}>{pctText(pct)}</td>;
}

/** %OTD of the whole month for each product group (one bar per group). */
export function otdGroupSeries(month: OtdMonth | undefined): OpsPoint[] {
  return (month?.rows ?? []).filter((r) => r.kind === 'group').map((r) => {
    const p = otdTotals(r).pct;
    return { name: r.group, pct: p === null ? null : Math.round(p * 1000) / 10 };
  });
}

/** The %OTD FG 81 block: monthly, weekly and by-group charts, and the by-group table. */
export function OtdSection({ d, year, month }: { d: ReportData; year: number; month: OtdMonth | undefined }) {
  const { user } = useAuth();
  const monthly = otdMonthSeries(d, year);
  const weekly = otdWeekly(month).map((v, i) => ({ name: WEEK_NAMES[i], pct: v === null ? null : Math.round(v * 1000) / 10 }));
  const rows = month?.rows ?? [];
  const legend = [{ name: '≥ 80%', color: OTD_COLORS.good }, { name: '60–79%', color: OTD_COLORS.warn }, { name: '0–59%', color: OTD_COLORS.bad }];
  const monthName = month ? `${short(month.month)} ${month.month.slice(0, 4)}${month.updated ? ` · Update ${month.updated}` : ''}` : 'ยังไม่มีไฟล์ของเดือนนี้';
  const pctBar = [{ key: 'pct', name: '%OTD', color: OTD_COLORS.good, digits: 0 }];
  const target = { y: OTD_TARGET * 100, label: 'เป้า 80%' };
  const hasYear = monthly.some((p) => typeof p.pct === 'number');
  // Without this month's file the weekly, by-group and table boxes would all be empty: one box says so instead.
  const missing = (
    <figure className="chart otd-missing">
      <p className="empty">
        <b>ยังไม่มีไฟล์ %OTD ของเดือนนี้</b>
        <span>ตารางรายสัปดาห์และตามกลุ่มสินค้าจะแสดงเมื่ออัปโหลดไฟล์ OTD FG81</span>
        {canEdit(user, 'assembly') && <Link className="button-link" to={ap('/entry/cost')}>ไปอัปโหลดไฟล์ %OTD</Link>}
      </p>
    </figure>
  );
  if (!rows.length) {
    return hasYear
      ? <div className="charts"><MonthChart title={`%OTD Monthly FG 81 ${year}`} sub="เป้า 80%" data={monthly} unit="%" height={320} colorOf={band} legend={legend} target={target} bars={pctBar} notes={[{ key: 'note' }]} />{missing}</div>
      : <div className="charts single">{missing}</div>;
  }
  return (
    <div className="charts">
      <MonthChart title={`%OTD Monthly FG 81 ${year}`} sub="เป้า 80%" data={monthly} unit="%" height={320} colorOf={band} legend={legend} target={target} bars={pctBar} notes={[{ key: 'note' }]} />
      <MonthChart title="%OTD FG 81 By Week" sub={monthName} data={weekly} unit="%" height={320} colorOf={band} legend={legend} target={target} bars={pctBar} />
      <GroupChart sub={`ทั้งเดือน · ${monthName}`} data={otdGroupSeries(month)} legend={legend} />
      <OtdTable rows={rows} />
    </div>
  );
}

/** Whole-month %OTD of each product group as horizontal bars, so long group names stay readable. */
function GroupChart({ sub, data, legend }: { sub: string; data: OpsPoint[]; legend: { name: string; color: string }[] }) {
  const hasData = data.some((p) => typeof p.pct === 'number');
  return (
    <figure className="chart">
      <figcaption>
        <span className="chart-title">%OTD FG 81 By Group<small>{sub}</small></span>
        <span className="chart-legend">
          {legend.map((l) => <span key={l.name}><i style={{ background: l.color }} />{l.name}</span>)}
          <span><i className="ln" style={{ borderTopColor: PAL.target }} />เป้า 80%</span>
        </span>
      </figcaption>
      {!hasData ? <p className="empty">ยังไม่มีไฟล์ %OTD ของเดือนนี้</p> : (
        <ResponsiveContainer width="100%" height={Math.max(220, data.length * 34 + 40)}>
          <ComposedChart data={data} layout="vertical" margin={{ top: 4, right: 44, left: 0, bottom: 0 }} barCategoryGap="24%">
            <CartesianGrid stroke="#eeedf6" strokeDasharray="4 4" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}%`} />
            <YAxis type="category" dataKey="name" width={118} tick={AXIS} axisLine={{ stroke: '#dcdaea' }} tickLine={false} interval={0} />
            <Tooltip cursor={{ fill: 'rgba(108,92,231,.06)' }} formatter={(v: number) => [`${fmtNum(v, 0)}%`, '%OTD']} />
            <ReferenceLine x={OTD_TARGET * 100} stroke={PAL.target} strokeWidth={2} strokeDasharray="6 4" />
            <Bar dataKey="pct" name="%OTD" radius={[0, 6, 6, 0]} maxBarSize={22} isAnimationActive={false}>
              {data.map((p, i) => <Cell key={i} fill={band(typeof p.pct === 'number' ? p.pct : null)} />)}
              <LabelList dataKey="pct" position="right" style={{ fontSize: 12, fontWeight: 600, fill: '#2a2750' }}
                formatter={(v: number | null) => (v == null ? '–' : `${fmtNum(v, 0)}%`)} />
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </figure>
  );
}

const TABLE_VIEWS = ['W1', 'W2', 'W3', 'W4', 'ทั้งเดือน'] as const;

/** %OTD by product group, one week (or the whole month) at a time so the table stays narrow. */
export function OtdTable({ rows }: { rows: OtdRow[] }) {
  const [view, setView] = useState<number>(4);
  const month = view === 4;
  return (
    <figure className="chart otd-card">
      <figcaption>
        <span className="chart-title">%OTD FG 81 ตามกลุ่มสินค้า<small>{month ? 'รวมทั้งเดือน (Total OTD และ Total On Plan)' : WEEK_NAMES[view]}</small></span>
        <span className="seg" role="tablist" aria-label="ช่วงของตาราง %OTD">
          {TABLE_VIEWS.map((l, i) => <button key={l} type="button" role="tab" aria-selected={view === i} onClick={() => setView(i)}>{l}</button>)}
        </span>
      </figcaption>
      <div className="otd-scroll">
        <table className="otd-table">
          <thead>
            <tr>
              <th>Group</th><th className="num">Plan</th><th className="num">OTD</th><th className="num">%OTD</th>
              {month && <><th className="num">GR</th><th className="num">%On Plan</th></>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const w = month ? otdTotals(r) : { plan: r.weeks[view].plan, otd: r.weeks[view].otd, pct: otdPct(r.weeks[view].plan, r.weeks[view].otd) };
              return (
                <tr key={r.group} className={r.kind === 'group' ? '' : 'sum'}>
                  <td className="grp">{r.group}</td>
                  <td className="num">{qty(w.plan)}</td><td className="num">{qty(w.otd)}</td><OtdCell pct={w.pct} />
                  {month && <><td className="num">{r.onPlan ? qty(r.onPlan.gr) : '–'}</td><OtdCell pct={r.onPlan ? otdPct(r.onPlan.plan, r.onPlan.gr) : null} /></>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
