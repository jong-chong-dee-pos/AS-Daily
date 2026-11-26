import { Bar, CartesianGrid, Cell, ComposedChart, LabelList, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmtNum } from './format';
import { useNarrow } from './useNarrow';
import { PAL } from './palette';
import { NoteDot, NoteLegend, NoteTip, notedNames } from './chartNotes';

/** One column of a Part Warehouse chart: a month, an earlier year-end, or an average. */
export interface PwPoint { name: string; [k: string]: string | number | null | undefined }
export interface PwSeries { key: string; name: string; color: string }

const AXIS = { fill: '#6f6c8c', fontSize: 12 };
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * A Part Warehouse chart: stacked parts (`stack`) or side-by-side bars (`bars`), lines such as a
 * total or a target (`lines`), and the value of each column written above it (`labelKey`).
 * `colorOf` colours single bars by their own value, e.g. red above the MAX line.
 */
export function PwChart({ title, sub, data, stack, bars, lines = [], labelKey, digits = 0, unit = '', height = 320, colorOf, refLine, xInterval, judged, notes = [], extra }: {
  title: string; sub?: string; data: PwPoint[]; stack?: PwSeries[]; bars?: PwSeries[]; lines?: (PwSeries & { dashed?: boolean; dots?: boolean })[];
  labelKey?: string; digits?: number; unit?: string; height?: number; colorOf?: (p: PwPoint) => string | undefined;
  refLine?: { y: number; name: string; color: string }; xInterval?: number;
  /** `colorOf` paints met / missed / earlier columns: the legend says so instead of naming the bar. */
  judged?: boolean;
  /** Point fields holding a note for the tooltip; `label` names the topic when a chart shows two. */
  notes?: { key: string; label?: string }[];
  /** More lines for the tooltip, e.g. how the missing parts split. */
  extra?: (p: PwPoint) => string[];
}) {
  const narrow = useNarrow();
  const series = [...(stack ?? []), ...(bars ?? [])];
  const hasData = data.some((p) => series.some((s) => num(p[s.key])));
  const crowded = narrow && data.length > 8;
  const f = (v: number) => `${fmtNum(v, digits)}${unit}`;
  const marks = judged
    ? [{ key: 'ok', name: 'ถึงเป้า', color: PAL.good }, { key: 'miss', name: 'ไม่ถึงเป้า', color: PAL.bad },
      ...(data.some((p) => colorOf?.(p) === PAL.prev) ? [{ key: 'prev', name: 'ปีก่อน / ค่าเฉลี่ย', color: PAL.prev }] : [])]
    : series;
  const noted = notedNames(data, notes);
  const legend = [...marks.map((s) => ({ ...s, ln: false, dashed: false })), ...lines.map((l) => ({ ...l, ln: true, dashed: !!l.dashed })),
    ...(refLine ? [{ key: 'ref', name: refLine.name, color: refLine.color, ln: true, dashed: true }] : [])];
  const top = (p: PwPoint) => (labelKey ? p[labelKey] : null);
  const twoLine = data.some((p) => splitName(String(p.name))[1]);
  // A column a day (the plan) is too narrow for a total written across: write it upright.
  const upright = data.length > 20;
  return (
    <figure className="chart pw-chart">
      <figcaption>
        <span className="chart-title">{title}{sub && <small>{sub}</small>}</span>
        <span className="chart-legend">
          {legend.map((l) => <span key={l.key}><i className={l.ln ? (l.dashed ? 'ln' : 'ln solid') : undefined} style={l.ln ? { borderTopColor: l.color } : { background: l.color }} />{l.name}</span>)}
          <NoteLegend show={noted.size > 0} />
        </span>
      </figcaption>
      {!hasData ? <p className="empty" style={{ height: height - 60 }}>ยังไม่มีข้อมูล</p> : (
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={data} margin={{ top: (bars && bars.length > 1) || (labelKey && upright) ? 56 : 26, right: 12, left: 0, bottom: 0 }} barGap={3} barCategoryGap={bars && bars.length > 1 ? '20%' : '30%'}>
            <CartesianGrid stroke="#eeedf6" strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="name" tick={<Tick noted={noted} />} height={(twoLine ? 40 : 30) + (noted.size ? 8 : 0)} axisLine={{ stroke: '#dcdaea' }} tickLine={false} interval={xInterval ?? (crowded ? Math.ceil(data.length / 6) - 1 : 0)} />
            <YAxis tick={AXIS} axisLine={false} tickLine={false} width={48} domain={[0, 'auto']} tickFormatter={(v: number) => (v === 0 ? '0' : fmtNum(v, digits && v < 1 ? digits : 0))} />
            <Tooltip cursor={{ fill: 'rgba(108,92,231,.06)' }} content={<NoteTip fmt={f} keys={notes} extra={extra as ((p: { name: string }) => string[]) | undefined} />} />
            {refLine && <ReferenceLine y={refLine.y} stroke={refLine.color} strokeWidth={2} strokeDasharray="6 4" />}
            {(stack ?? []).map((s, i) => (
              <Bar key={s.key} dataKey={s.key} name={s.name} stackId="s" fill={s.color} maxBarSize={44} isAnimationActive={false}
                radius={i === stack!.length - 1 ? [5, 5, 0, 0] : undefined}>
                {!crowded && (stack!.length <= 5) && <LabelList dataKey={s.key} content={(p) => <InBar {...(p as InBarProps)} text={f} bg={s.color} />} />}
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
                dot={l.dots === false || l.dashed ? false : { r: 3, fill: l.color }} connectNulls={false} isAnimationActive={false} type="linear" />
            ))}
            {labelKey && !crowded && (
              <Line dataKey={labelKey} stroke="none" dot={false} activeDot={false} legendType="none" isAnimationActive={false} tooltipType="none">
                <LabelList dataKey={labelKey} content={(p) => <Above {...(p as AboveProps)} width={0} text={f} vertical={upright} />} />
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

/** "Oct'2024" or "Dec 2025" (an earlier year) is written on two lines so neighbours never collide. */
const splitName = (v: string): [string, string] => {
  const m = /^([A-Za-z]{3})['\s-]?(\d{4}|\d{2})$/.exec(v);
  return m ? [m[1], m[2]] : [v, ''];
};
function Tick({ x, y, payload, noted }: { x?: number; y?: number; payload?: { value: string }; noted?: Set<string> }) {
  if (x === undefined || y === undefined || !payload) return null;
  const [a, b] = splitName(String(payload.value));
  const dot = noted?.has(String(payload.value));
  return (
    <g>
      <text x={x} y={y + 12} textAnchor="middle" fontSize={12} fill={b ? '#4b4870' : AXIS.fill} fontWeight={b ? 600 : 400}>
        <tspan x={x}>{a}</tspan>{b && <tspan x={x} dy={14}>{b}</tspan>}
      </text>
      {dot && <NoteDot x={x} y={y} dy={b ? 36 : 22} />}
    </g>
  );
}


interface AboveProps { x?: number; y?: number; width?: number; value?: number | null }
/** A column's value above it; upright when two bars share a column, so neighbours never overlap. */
function Above({ x = 0, y = 0, width = 0, value, text, vertical }: AboveProps & { text: (v: number) => string; vertical?: boolean }) {
  if (!num(value)) return null;
  const cx = x + width / 2;
  if (vertical) return <text x={cx} y={y - 5} transform={`rotate(-90 ${cx} ${y - 5})`} dominantBaseline="central" fontSize={12} fontWeight={600} fill="#2a2750">{text(value)}</text>;
  return <text x={x + width / 2} y={y - 8} textAnchor="middle" fontSize={12} fontWeight={700} fill="#2a2750">{text(value)}</text>;
}
interface InBarProps { x?: number | string; y?: number | string; width?: number | string; height?: number | string; value?: number | null | (number | null)[] }
/** A part's value inside its own piece of the stack, only where it fits. */
/** White text on a dark piece, dark text on a light one, so the value always reads. */
const onColor = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.2 ? '#ffffff' : '#1f1d3d';
};
function InBar(p: InBarProps & { text: (v: number) => string; bg: string }) {
  // In a stack recharts hands over [bottom, top] of the piece.
  const value = Array.isArray(p.value) ? (num(p.value[1]) && num(p.value[0]) ? p.value[1] - p.value[0] : null) : p.value;
  const [x, y, width, height] = [p.x, p.y, p.width, p.height].map((v) => Number(v ?? 0));
  const text = p.text;
  if (!num(value) || Math.abs(height) < 15 || width < 20) return null;
  const label = text(Math.round(value * 1000) / 1000);
  // Wider than its bar, the text spills onto the white page: dark with a white halo reads on both.
  const fits = label.length * 7.2 <= width;
  const fill = fits ? onColor(p.bg) : '#1f1d3d';
  return <text x={x + width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600} fill={fill}
    stroke={fill === '#ffffff' ? undefined : 'rgba(255,255,255,.85)'} strokeWidth={3} paintOrder="stroke">{label}</text>;
}
