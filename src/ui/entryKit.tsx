import { useEffect, type InputHTMLAttributes, type RefObject } from 'react';

/**
 * "1234567.5" → "1,234,567.5" while keeping whatever the person typed after the point.
 * Anything that is not a plain number is left as typed, so the page can mark it invalid.
 */
export function grouped(s: string): string {
  const t = s.replace(/,/g, '');
  const m = /^(\s*)(\d+)(\.\d*)?(\s*)$/.exec(t);
  if (!m) return s;
  return `${m[1]}${m[2].replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${m[3] ?? ''}${m[4]}`;
}

/**
 * A number field that writes thousands separators as you type and keeps the caret where it was.
 * The value it hands to `onChange` carries the commas; `parseNum` ignores them.
 */
export function NumInput({ value, onChange, inputMode = 'decimal', ...rest }: InputHTMLAttributes<HTMLInputElement> & { value: string }) {
  return (
    <input {...rest} inputMode={inputMode} value={grouped(value)} onChange={(e) => {
      const el = e.target;
      const caret = el.selectionStart ?? el.value.length;
      // Count the characters other than commas before the caret, then put the caret after as many in the new text.
      const before = el.value.slice(0, caret).replace(/,/g, '').length;
      const next = grouped(el.value);
      if (next !== el.value) {
        el.value = next;
        let i = 0, seen = 0;
        while (i < next.length && seen < before) { if (next[i] !== ',') seen++; i++; }
        try { el.setSelectionRange(i, i); } catch { /* some input types have no caret */ }
      }
      onChange?.(e);
    }} />
  );
}

const FIELDS = 'input:not([type=hidden]):not([type=file]):not([type=checkbox]):not([type=radio]):not([type=date]):not([type=month]):not(:disabled), select:not(:disabled)';

/** The field Enter should go to: the same column in the next table row, else the next field on the page. */
function nextField(from: HTMLElement, root: HTMLElement): HTMLElement | null {
  const cell = from.closest('td');
  const row = cell?.parentElement as HTMLTableRowElement | null;
  if (cell && row) {
    const col = Array.prototype.indexOf.call(row.children, cell);
    let r = row.nextElementSibling as HTMLTableRowElement | null;
    while (r) {
      const c = r.children[col];
      const f = c?.querySelector<HTMLElement>(FIELDS);
      if (f && c && (c as HTMLTableCellElement).colSpan === (cell as HTMLTableCellElement).colSpan) return f;
      r = r.nextElementSibling as HTMLTableRowElement | null;
    }
  }
  const all = Array.from(root.querySelectorAll<HTMLElement>(FIELDS)).filter((el) => !el.closest('[hidden]'));
  const i = all.indexOf(from);
  return i >= 0 ? all[i + 1] ?? null : null;
}

/**
 * Data entry like Excel: Enter moves to the next field down (in a table, the cell below), Shift+Enter
 * does not move. On the last field it stays put, so nothing is saved by accident.
 */
export function useEnterMovesDown(ref: RefObject<HTMLElement>) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.shiftKey || e.isComposing || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement;
      if (!t.matches(FIELDS) || (t as HTMLInputElement).type === 'search') return;
      const next = nextField(t, root);
      e.preventDefault();
      if (next) { next.focus(); if (next instanceof HTMLInputElement) next.select(); }
    };
    root.addEventListener('keydown', onKey);
    return () => root.removeEventListener('keydown', onKey);
  }, [ref]);
}

export const LEAVE_MSG = 'ข้อมูลในหน้านี้ยังไม่ได้บันทึก ต้องการออกจากหน้านี้หรือไม่?';

/**
 * While there are unsaved changes: closing or reloading the tab asks the browser's own question, and
 * clicking a link or menu that leaves the page asks first.
 */
export function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const a = (e.target as HTMLElement).closest?.('a[href], [data-leaves]');
      if (!a || (a instanceof HTMLAnchorElement && (a.target === '_blank' || a.hasAttribute('download')))) return;
      if (a instanceof HTMLAnchorElement) {
        const url = new URL(a.href, window.location.href);
        if (url.href === window.location.href) return;
      }
      if (!window.confirm(LEAVE_MSG)) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener('beforeunload', onUnload);
    document.addEventListener('click', onClick, true);
    return () => { window.removeEventListener('beforeunload', onUnload); document.removeEventListener('click', onClick, true); };
  }, [dirty]);
}

const dayAfter = (d: string) => { const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + 1); return t.toISOString().slice(0, 10); };

/** Shown after a day is saved: one click to the next day, so a week can be entered in a row. */
export function NextDay({ date, onGo }: { date: string; onGo: (d: string) => void }) {
  const next = dayAfter(date);
  return <button type="button" className="secondary" onClick={() => onGo(next)}>ไปวันถัดไป ({next.slice(8, 10)}/{next.slice(5, 7)}) ›</button>;
}
