/**
 * Notes on charts, shared by Assembly and Part Warehouse. A note is never drawn on the chart:
 * a small orange dot under the column's name says one is there, and the tooltip shows it after
 * the usual numbers.
 */
export const NOTE_COLOR = '#f08a24';

/** A point field that holds a note; `label` names the topic when one chart shows two notes. */
export interface NoteKey { key: string; label?: string }
type Pt = { name: string; [k: string]: unknown };

export const notesOf = (p: Pt, keys: NoteKey[]) =>
  keys.map((n) => ({ label: n.label, text: p[n.key] }))
    .filter((n): n is { label: string | undefined; text: string } => typeof n.text === 'string' && !!n.text.trim());

/** Names of the columns that carry a note (they get the dot). */
export const notedNames = (data: Pt[], keys: NoteKey[]) => new Set(keys.length ? data.filter((p) => notesOf(p, keys).length).map((p) => String(p.name)) : []);

export function NoteLegend({ show }: { show: boolean }) {
  return show ? <span className="note-legend"><i style={{ background: NOTE_COLOR }} />มีหมายเหตุ (ชี้เพื่ออ่าน)</span> : null;
}

/** The dot under an x-axis label; `dy` is how far below the tick's top it sits. */
export function NoteDot({ x, y, dy }: { x: number; y: number; dy: number }) {
  return <circle cx={x} cy={y + dy} r={3.5} fill={NOTE_COLOR} data-testid="note-dot"><title>มีหมายเหตุ</title></circle>;
}

interface TipItem { name?: string; value?: number | string; color?: string; type?: string; payload?: Pt }
/** Tooltip content: the column's name, its numbers, any extra lines, then its notes. */
export function NoteTip({ active, payload, label, fmt, keys, extra, title }: {
  active?: boolean; payload?: TipItem[]; label?: string;
  fmt: (v: number, name: string) => string; keys: NoteKey[];
  extra?: (p: Pt) => string[]; title?: (label: string, p: Pt) => string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as Pt;
  // A hidden line that only writes totals is marked tooltipType none: it is not a series.
  const rows = payload.filter((i) => typeof i.value === 'number' && Number.isFinite(i.value) && i.type !== 'none');
  const more = extra?.(p) ?? [];
  const ns = notesOf(p, keys);
  if (!rows.length && !ns.length) return null;
  return (
    <div className="pw-tip">
      <b>{title ? title(String(label), p) : label}</b>
      {rows.map((i, k) => <div key={k} style={{ color: i.color }}>{i.name}: {fmt(i.value as number, String(i.name))}</div>)}
      {more.map((t, k) => <div key={`x${k}`} className="muted">{t}</div>)}
      {ns.map((n, k) => <div key={`n${k}`} className="pw-tip-note"><b>หมายเหตุ{n.label ? ` ${n.label}` : ''}:</b> {n.text}</div>)}
    </div>
  );
}
