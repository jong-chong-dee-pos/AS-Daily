import { useEffect, useState } from 'react';
import { Bar, CartesianGrid, Cell, ComposedChart, LabelList, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmtNum } from './format';

/** One column of a Part Warehouse chart: a month, an earlier year-end, or an average. */
export interface PwPoint { name: string; [k: string]: string | number | null | undefined }
export interface PwSeries { key: string; name: string; color: string }

const AXIS = { fill: '#6f6c8c', fontSize: 12 };
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
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * A Part Warehouse chart: stacked parts (`stack`) or side-by-side bars (`bars`), lines such as a
 * total or a target (`lines`), and the value of each column written above it (`labelKey`).
 * `colorOf` colours single bars by their own value, e.g. red above the MAX line.
 */
export function PwChart({ title, sub, data, stack, bars, lines = [], labelKey, digits = 0, unit = '', height = 320, colorOf, refLine, xInterval }: {
  title: string; sub?: string; data: PwPoint[]; stack?: PwSeries[]; bars?: PwSeries[]; lines?: (PwSeries & { dashed?: boolean; dots?: boolean })[];
  labelKey?: string; digits?: number; unit?: string; height?: number; colorOf?: (p: PwPoint) => string | undefined;
  refLine?: { y: number; name: string; color: string }; xInterval?: number;
}) {
  const narrow = useNarrow();
  const series = [...(stack ?? []), ...(bars ?? [])];
  const hasData = data.some((p) => series.some((s) => num(p[s.key])));
  const crowded = narrow && data.length > 8;
  const f = (v: number) => `${fmtNum(v, digits)}${unit}`;
  const legend = [...series.map((s) => ({ ...s, ln: false })), ...lines.map((l) => ({ ...l, ln: true })),
    ...(refLine ? [{ key: 'ref', name: refLine.name, color: refLine.color, ln: true }] : [])];
  const top = (p: PwPoint) => (labelKey ? p[labelKey] : null);
  return (
    <figure className="chart pw-chart">
      <figcaption>
        <span className="chart-title">{title}{sub && <small>{sub}</small>}</span>
        <span className="chart-legend">
          {legend.map((l) => <span key={l.key}><i className={l.ln ? 'ln' : undefined} style={l.ln ? { borderTopColor: l.color } : { background: l.color }} />{l.name}</span>)}
        </span>
      </figcaption>
      {!hasData ? <p className="empty" style={{ height: height - 60 }}>ยังไม่มีข้อมูล</p> : (
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={data} margin={{ top: bars && bars.length > 1 ? 48 : 26, right: 12, left: 0, bottom: 0 }} barGap={3} barCategoryGap={bars && bars.length > 1 ? '20%' : '30%'}>
            <CartesianGrid stroke="#eeedf6" strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="name" tick={AXIS} axisLine={{ stroke: '#dcdaea' }} tickLine={false} interval={xInterval ?? (crowded ? Math.ceil(data.length / 6) - 1 : 0)} />
            <YAxis tick={AXIS} axisLine={false} tickLine={false} width={48} domain={[0, 'auto']} tickFormatter={(v: number) => (v === 0 ? '0' : fmtNum(v, digits && v < 1 ? digits : 0))} />
            <Tooltip cursor={{ fill: 'rgba(108,92,231,.06)' }} formatter={(v: number, n: string) => [f(v), n]} />
            {refLine && <ReferenceLine y={refLine.y} stroke={refLine.color} strokeWidth={2} />}
            {(stack ?? []).map((s, i) => (
              <Bar key={s.key} dataKey={s.key} name={s.name} stackId="s" fill={s.color} maxBarSize={44} isAnimationActive={false}
                radius={i === stack!.length - 1 ? [5, 5, 0, 0] : undefined}>
                {!crowded && (stack!.length <= 5) && <LabelList dataKey={s.key} content={(p) => <InBar {...(p as InBarProps)} text={f} />} />}
              </Bar>
            ))}
            {(bars ?? []).map((b) => (
              <Bar key={b.key} dataKey={b.key} name={b.name} fill={b.color} radius={[5, 5, 0, 0]} maxBarSize={bars!.length > 1 ? 26 : 40} isAnimationActive={false}>
                {colorOf && data.map((p, i) => <Cell key={i} fill={colorOf(p) ?? b.color} />)}
                {!crowded && !labelKey && <LabelList dataKey={b.key} content={(p) => <Above {...(p as AboveProps)} text={f} vertical={bars!.length > 1} />} />}
              </Bar>
            ))}
            {lines.map((l) => (
              <Line key={l.key} dataKey={l.key} name={l.name} stroke={l.color} strokeWidth={2.5} strokeDasharray={l.dashed ? '6 4' : undefined}
                dot={l.dots === false ? false : { r: 3, fill: l.color }} connectNulls={false} isAnimationActive={false} type="linear" />
            ))}
            {labelKey && !crowded && (
              <Line dataKey={labelKey} stroke="none" dot={false} activeDot={false} legendType="none" isAnimationActive={false} tooltipType="none">
                <LabelList dataKey={labelKey} content={(p) => <Above {...(p as AboveProps)} width={0} text={f} />} />
              </Line>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      )}
      {hasData && labelKey && crowded && (
        <p className="hint pw-totals">{data.filter((p) => num(top(p))).map((p) => `${p.name} ${f(top(p) as number)}`).join(' · ')}</p>
      )}
    </figure>
  );
}

interface AboveProps { x?: number; y?: number; width?: number; value?: number | null }
/** A column's value above it; upright when two bars share a column, so neighbours never overlap. */
function Above({ x = 0, y = 0, width = 0, value, text, vertical }: AboveProps & { text: (v: number) => string; vertical?: boolean }) {
  if (!num(value)) return null;
  const cx = x + width / 2;
  if (vertical) return <text x={cx} y={y - 5} transform={`rotate(-90 ${cx} ${y - 5})`} dominantBaseline="central" fontSize={11} fontWeight={600} fill="#2a2750">{text(value)}</text>;
  return <text x={x + width / 2} y={y - 8} textAnchor="middle" fontSize={12} fontWeight={700} fill="#2a2750">{text(value)}</text>;
}
interface InBarProps { x?: number | string; y?: number | string; width?: number | string; height?: number | string; value?: number | null | (number | null)[] }
/** A part's value inside its own piece of the stack, only where it fits. */
function InBar(p: InBarProps & { text: (v: number) => string }) {
  // In a stack recharts hands over [bottom, top] of the piece.
  const value = Array.isArray(p.value) ? (num(p.value[1]) && num(p.value[0]) ? p.value[1] - p.value[0] : null) : p.value;
  const [x, y, width, height] = [p.x, p.y, p.width, p.height].map((v) => Number(v ?? 0));
  const text = p.text;
  if (!num(value) || Math.abs(height) < 13 || width < 18) return null;
  return <text x={x + width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="central" fontSize={10.5} fontWeight={600} fill="#1f1d3d">{text(Math.round(value * 1000) / 1000)}</text>;
}
