import { useEffect, useState } from 'react';
import { Bar, CartesianGrid, Cell, ComposedChart, LabelList, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ReportData } from '../data/useReportData';
import { monthsIn } from '../calc/period';
import { OTD_TARGET, otdBand, otdPct, otdTotals, otdWeekly, opsDerived } from '../calc/ops';
import type { OtdMonth, OtdRow } from '../types';
import { fmtNum, THAI_MONTHS } from './format';

export interface OpsPoint { name: string; [k: string]: string | number | null }
interface Series { key: string; name: string; color: string; digits: number }

const AXIS = { fill: '#6f6c8c', fontSize: 12 };
/** "ธ.ค.-24" (a previous December) is drawn on two lines so it never collides with its neighbour. */
function XTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  if (x === undefined || y === undefined || !payload) return null;
  const m = /^(.+)-(\d{2})$/.exec(String(payload.value));
  const [a, b] = m ? [m[1], m[2]] : [String(payload.value), ''];
  return (
    <text x={x} y={y + 12} textAnchor="middle" fontSize={12} fill={b ? '#4b4870' : AXIS.fill} fontWeight={b ? 600 : 400}>
      <tspan x={x}>{a}</tspan>{b && <tspan x={x} dy={14}>{b}</tspan>}
    </text>
  );
}
const NARROW = '(max-width: 640px)';
function useNarrow() {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(NARROW).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(NARROW);
    if (!mq) return;
    const on = () => setNarrow(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return narrow;
}
const short = (m: string) => THAI_MONTHS[Number(m.slice(5, 7)) - 1];
export const OTD_COLORS = { good: '#3ddc84', warn: '#f5c518', bad: '#f0446f', none: '#d9d7e8' } as const;

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
      prodHead: o ? (o.prodForHead ?? o.prodActual) : null,
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
    .map((m) => ({ name: `ธ.ค.-${m.slice(2, 4)}`, pct: pct(m) }));
  return [...decs, ...monthsIn({ kind: 'year', year }).map((m) => ({ name: short(m), pct: pct(m) }))]
    .map((p) => ({ ...p, pct: p.pct === null ? null : Math.round(p.pct * 1000) / 10 }));
}

const big = (v: number, digits: number) => (Math.abs(v) >= 10000 ? `${fmtNum(v / 1000, 1)}k` : fmtNum(v, digits));

/**
 * Bars by month, optionally with a line on its own right-hand axis (production volume),
 * and an optional target line. `colorOf` colours single bars (e.g. %OTD bands).
 */
export function MonthChart({ title, sub, data, bars, line, height = 300, unit = '', target, colorOf, legend }: {
  title: string; sub?: string; data: OpsPoint[]; bars: Series[]; line?: Series; height?: number; unit?: string;
  target?: { y: number; label: string }; colorOf?: (v: number | null) => string; legend?: { name: string; color: string }[];
}) {
  const hasData = data.some((p) => bars.some((b) => typeof p[b.key] === 'number'));
  // On a phone 12+ months don't fit side by side: label every other month and leave
  // the values to the tooltip (tap a bar).
  const crowded = useNarrow() && data.length > 6;
  const items = legend ?? [
    ...bars.map((b) => ({ name: b.name, color: b.color })),
    ...(line ? [{ name: `${line.name} (แกนขวา)`, color: line.color }] : []),
  ];
  return (
    <figure className="chart">
      <figcaption>
        <span className="chart-title">{title}{sub && <small>{sub}</small>}</span>
        <span className="chart-legend">
          {items.map((l) => <span key={l.name}><i style={{ background: l.color }} />{l.name}</span>)}
          {target && <span><i className="ln" style={{ borderTopColor: '#ff9f1a' }} />{target.label}</span>}
        </span>
      </figcaption>
      {!hasData ? <p className="empty" style={{ height: height - 60 }}>ยังไม่มีข้อมูลของปีนี้</p> : (
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={data} margin={{ top: 28, right: line ? 4 : 12, left: 0, bottom: 0 }} barGap={3} barCategoryGap={bars.length > 1 ? '18%' : '28%'}>
            <CartesianGrid stroke="#eeedf6" strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="name" tick={<XTick />} height={data.some((p) => /-\d{2}$/.test(String(p.name))) ? 40 : 30} axisLine={{ stroke: '#dcdaea' }} tickLine={false} interval={crowded ? 1 : 0} />
            <YAxis yAxisId="l" tick={AXIS} axisLine={false} tickLine={false} width={48} domain={[0, 'auto']}
              tickFormatter={(v: number) => big(v, bars[0].digits > 0 && v < 10 ? 1 : 0)} />
            {line && <YAxis yAxisId="r" orientation="right" tick={{ ...AXIS, fill: line.color }} axisLine={false} tickLine={false} width={48}
              domain={[0, 'auto']} tickFormatter={(v: number) => big(v, 0)} />}
            <Tooltip cursor={{ fill: 'rgba(108,92,231,.06)' }}
              formatter={(v: number, n: string) => [`${fmtNum(v, [...bars, ...(line ? [line] : [])].find((s) => s.name === n)?.digits ?? 0)}${unit}`, n]} />
            {target && <ReferenceLine yAxisId="l" y={target.y} stroke="#ff9f1a" strokeWidth={2} strokeDasharray="6 4" />}
            {bars.map((b) => (
              <Bar key={b.key} yAxisId="l" dataKey={b.key} name={b.name} fill={b.color} radius={[6, 6, 0, 0]} maxBarSize={bars.length > 1 ? 26 : 40} isAnimationActive={false}>
                {colorOf && data.map((p, i) => <Cell key={i} fill={colorOf(typeof p[b.key] === 'number' ? (p[b.key] as number) : null)} />)}
                {!crowded && <LabelList dataKey={b.key} position="top" style={{ fontSize: bars.length > 1 ? 10 : 12, fontWeight: 600, fill: '#2a2750' }}
                  formatter={(v: number | null) => (v === null || v === undefined ? '' : `${big(v, b.digits)}${unit}`)} />}
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

/** The six production and cost charts (Assembly Production Volume … Expense/Pcs.). */
export function OpsCharts({ d, year }: { d: ReportData; year: number }) {
  const s = opsSeries(d, year);
  const prod = { key: 'prodActual', name: 'ยอดผลิต ACTUAL', color: '#1f6fd1', digits: 0 };
  const prodHead = { ...prod, key: 'prodHead', name: 'ยอดผลิต' };
  return (
    <div className="charts">
      <MonthChart title={`Assembly Production Volume ${year}`} sub="ชิ้น" data={s} height={320}
        bars={[{ key: 'prodPlan', name: 'PLAN (PN)', color: '#2ccf8f', digits: 0 }, { key: 'prodActual', name: 'ACTUAL (AS)', color: '#e58cf0', digits: 0 }]} />
      <MonthChart title={`Material cost Variance ${year}`} sub="Standard เทียบ Actual" data={s} height={320}
        bars={[{ key: 'matStd', name: 'Standard', color: '#9cc3ee', digits: 2 }, { key: 'matAct', name: 'Actual', color: '#2f6fbd', digits: 2 }]} />
      <MonthChart title="Process THB/Pcs." sub="Actual Process Cost ÷ ยอดผลิต ACTUAL" data={s} height={320} line={prod}
        bars={[{ key: 'processPerPcs', name: 'Process THB/Pcs.', color: '#ffc94d', digits: 2 }]} />
      <MonthChart title="Actual Process Cost (THB)" sub="บาท" data={s} height={320}
        bars={[{ key: 'processCost', name: 'Process', color: '#ffc94d', digits: 0 }]} />
      <MonthChart title="Pcs./head" sub="ยอดผลิต ÷ จำนวนคน" data={s} height={320} line={prodHead}
        bars={[{ key: 'pcsPerHead', name: 'Pcs./head', color: '#4472c4', digits: 0 }]} />
      <MonthChart title="Expense/Pcs." sub="Expense ÷ ยอดผลิต" data={s} height={320}
        bars={[{ key: 'expensePerPcs', name: 'Expense/Pcs.', color: '#4472c4', digits: 1 }]} />
    </div>
  );
}

const WEEK_NAMES = ['W1 (1-7)', 'W2 (8-14)', 'W3 (15-21)', 'W4 (22-31)'];
const pctText = (v: number | null) => (v === null ? '–' : `${fmtNum(v * 100, 0)}%`);
const qty = (v: number) => (v ? fmtNum(v, 0) : '–');

function OtdCell({ pct }: { pct: number | null }) {
  return <td className={`otd-cell ${otdBand(pct)}`}>{pctText(pct)}</td>;
}

/** The %OTD FG 81 block: monthly chart, weekly chart and the W1–W4 table by product group. */
export function OtdSection({ d, year, month }: { d: ReportData; year: number; month: OtdMonth | undefined }) {
  const monthly = otdMonthSeries(d, year);
  const weekly = otdWeekly(month).map((v, i) => ({ name: WEEK_NAMES[i], pct: v === null ? null : Math.round(v * 1000) / 10 }));
  const rows = month?.rows ?? [];
  const legend = [{ name: '≥ 80%', color: OTD_COLORS.good }, { name: '60–79%', color: OTD_COLORS.warn }, { name: '0–59%', color: OTD_COLORS.bad }];
  return (
    <>
      <div className="charts">
        <MonthChart title={`%OTD Monthly FG 81 ${year}`} sub="เป้า 80%" data={monthly} unit="%" height={320} colorOf={band} legend={legend}
          target={{ y: OTD_TARGET * 100, label: 'เป้า 80%' }} bars={[{ key: 'pct', name: '%OTD', color: OTD_COLORS.good, digits: 0 }]} />
        <MonthChart title="%OTD FG 81 By Week" sub={month ? `${short(month.month)} ${month.month.slice(0, 4)}${month.updated ? ` · Update ${month.updated}` : ''}` : 'ยังไม่มีไฟล์ของเดือนนี้'}
          data={month?.rows ? weekly : []} unit="%" height={320} colorOf={band} legend={legend}
          target={{ y: OTD_TARGET * 100, label: 'เป้า 80%' }} bars={[{ key: 'pct', name: '%OTD', color: OTD_COLORS.good, digits: 0 }]} />
      </div>
      {rows.length > 0 && <OtdTable rows={rows} />}
    </>
  );
}

export function OtdTable({ rows }: { rows: OtdRow[] }) {
  return (
    <div className="tablewrap" style={{ marginTop: 16 }}>
      <table className="otd-table">
        <thead>
          <tr>
            <th rowSpan={2}>Group</th>
            {['W1', 'W2', 'W3', 'W4', 'Total OTD'].map((w) => <th key={w} colSpan={3} className="wk">{w}</th>)}
            <th colSpan={3} className="wk">Total On Plan</th>
          </tr>
          <tr>
            {[0, 1, 2, 3, 4].flatMap((i) => [<th key={`p${i}`} className="num">Plan</th>, <th key={`o${i}`} className="num">OTD</th>, <th key={`x${i}`} className="num">%OTD</th>])}
            <th className="num">Total Plan</th><th className="num">GR</th><th className="num">%On Plan</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const t = otdTotals(r);
            return (
              <tr key={r.group} className={r.kind === 'group' ? '' : 'sum'}>
                <td>{r.group}</td>
                {r.weeks.map((w, i) => [
                  <td key={`p${i}`} className="num wk-start">{qty(w.plan)}</td>, <td key={`o${i}`} className="num">{qty(w.otd)}</td>,
                  <OtdCell key={`x${i}`} pct={otdPct(w.plan, w.otd)} />,
                ])}
                <td className="num wk-start">{qty(t.plan)}</td><td className="num">{qty(t.otd)}</td><OtdCell pct={t.pct} />
                <td className="num wk-start">{r.onPlan ? qty(r.onPlan.plan) : '–'}</td><td className="num">{r.onPlan ? qty(r.onPlan.gr) : '–'}</td>
                <OtdCell pct={r.onPlan ? otdPct(r.onPlan.plan, r.onPlan.gr) : null} />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
