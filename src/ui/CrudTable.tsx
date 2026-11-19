import { useEffect, useMemo, useState, type ReactNode } from 'react';

export interface Column<T> {
  label: string;
  className?: string;
  /** Renders the cell; call `set` with a patch to edit the row. */
  render: (row: T, set: (patch: Partial<T>) => void) => ReactNode;
}

interface Props<T> {
  title: string;
  /** Rows as stored; reloaded whenever this array changes identity. */
  rows: T[];
  getId: (row: T) => string;
  columns: Column<T>[];
  newRow: () => T;
  /** Error text for an invalid row, or null. */
  validate?: (row: T, all: T[]) => string | null;
  onSave: (upserts: T[], deletedIds: string[]) => Promise<void>;
  addLabel?: string;
  filter?: (row: T, q: string) => boolean;
  toolbar?: ReactNode;
  note?: ReactNode;
  maxHeight?: number;
}

/**
 * Editable table used by every settings list: tick rows to select, add, edit
 * in place, mark for deletion, then save or cancel all changes together.
 */
export function CrudTable<T>({ title, rows, getId, columns, newRow, validate, onSave, addLabel = 'เพิ่ม', filter, toolbar, note, maxHeight = 520 }: Props<T>) {
  const [items, setItems] = useState<T[]>(rows);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [deleted, setDeleted] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => { setItems(rows); setDirty(new Set()); setAdded(new Set()); setDeleted(new Set()); setSelected(new Set()); };
  useEffect(reset, [rows]);

  const shown = useMemo(() => (filter && q.trim() ? items.filter((r) => filter(r, q.trim().toLowerCase())) : items), [items, filter, q]);
  const errors = items.filter((r) => !deleted.has(getId(r)) && (dirty.has(getId(r)) || added.has(getId(r))))
    .map((r) => validate?.(r, items)).filter(Boolean) as string[];
  const changes = dirty.size + added.size + deleted.size;
  const allSel = shown.length > 0 && shown.every((r) => selected.has(getId(r)));

  const set = (id: string) => (patch: Partial<T>) => {
    setItems((xs) => xs.map((x) => (getId(x) === id ? { ...x, ...patch } : x)));
    setDirty((d) => new Set(d).add(id));
    setStatus('');
  };
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const markDelete = (ids: string[]) => {
    const fresh = ids.filter((id) => added.has(id));
    if (fresh.length) {
      setItems((xs) => xs.filter((x) => !fresh.includes(getId(x))));
      setAdded((a) => { const n = new Set(a); fresh.forEach((id) => n.delete(id)); return n; });
    }
    setDeleted((d) => { const n = new Set(d); ids.filter((id) => !fresh.includes(id)).forEach((id) => (n.has(id) ? n.delete(id) : n.add(id))); return n; });
    setSelected(new Set());
  };
  const add = () => {
    const r = newRow();
    setItems((xs) => [...xs, r]);
    setAdded((a) => new Set(a).add(getId(r)));
    setQ('');
  };
  const save = async () => {
    setBusy(true); setStatus('กำลังบันทึก…');
    try {
      const ups = items.filter((r) => !deleted.has(getId(r)) && (dirty.has(getId(r)) || added.has(getId(r))));
      await onSave(ups, [...deleted]);
      setStatus(`บันทึกแล้ว (${ups.length} แก้ไข/เพิ่ม, ${deleted.size} ลบ)`);
    } catch {
      setStatus('บันทึกไม่สำเร็จ ลองอีกครั้ง');
    } finally { setBusy(false); }
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>{title}</h2>
        <span className="hint">{items.length} รายการ</span>
        <span className="spacer" />
        {toolbar}
        {filter && <input aria-label={`ค้นหา${title}`} placeholder="ค้นหา" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 150 }} />}
        <button type="button" className="secondary sm" onClick={add}>+ {addLabel}</button>
        <button type="button" className="danger sm" disabled={!selected.size} onClick={() => markDelete([...selected])}>ลบที่เลือก ({selected.size})</button>
      </div>
      <div className="tablewrap" style={{ maxHeight, boxShadow: 'none' }}>
        <table>
          <thead><tr>
            <th className="check"><input type="checkbox" aria-label="เลือกทั้งหมด" checked={allSel}
              onChange={() => setSelected(allSel ? new Set() : new Set(shown.map(getId)))} /></th>
            {columns.map((c) => <th key={c.label} className={c.className}>{c.label}</th>)}
            <th className="num">จัดการ</th>
          </tr></thead>
          <tbody>
            {shown.map((r) => {
              const id = getId(r);
              const cls = deleted.has(id) ? 'row-deleted' : added.has(id) ? 'row-new' : dirty.has(id) ? 'row-dirty' : '';
              return (
                <tr key={id} className={cls}>
                  <td className="check"><input type="checkbox" aria-label="เลือกแถว" checked={selected.has(id)} onChange={() => toggle(id)} /></td>
                  {columns.map((c) => <td key={c.label} className={c.className}>{c.render(r, set(id))}</td>)}
                  <td className="actions-cell">
                    <button type="button" className={deleted.has(id) ? 'secondary sm' : 'danger sm'} onClick={() => markDelete([id])}>
                      {deleted.has(id) ? 'ยกเลิกลบ' : 'ลบ'}
                    </button>
                  </td>
                </tr>
              );
            })}
            {shown.length === 0 && <tr><td colSpan={columns.length + 2} className="empty">ยังไม่มีรายการ กด “+ {addLabel}”</td></tr>}
          </tbody>
        </table>
      </div>
      {errors.length > 0 && <p className="error" role="alert">{errors[0]}</p>}
      {note && <p className="hint" style={{ marginTop: 6 }}>{note}</p>}
      <div className="actions">
        <button type="button" disabled={!changes || errors.length > 0 || busy} onClick={save}>บันทึก{changes ? ` (${changes})` : ''}</button>
        <button type="button" className="secondary" disabled={!changes || busy} onClick={() => { reset(); setStatus('ยกเลิกการแก้ไขแล้ว'); }}>ยกเลิก</button>
        <span className="status" role="status">{status || (changes ? 'มีการแก้ไขที่ยังไม่ได้บันทึก' : '')}</span>
      </div>
    </div>
  );
}
