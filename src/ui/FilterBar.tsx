import { useEffect, useState } from 'react';
import type { Period } from '../types';
import { THAI_MONTHS } from './format';

interface Props {
  value: Period;
  onChange: (p: Period) => void;
  /** Report-specific buttons (export) shown at the right. */
  children?: React.ReactNode;
}

const YEARS = Array.from({ length: 6 }, (_, i) => 2024 + i);

export function FilterBar({ value, onChange, children }: Props) {
  const [kind, setKind] = useState<Period['kind']>(value.kind);
  const [from, setFrom] = useState(value.kind === 'range' ? value.from : '');
  const [to, setTo] = useState(value.kind === 'range' ? value.to : '');
  useEffect(() => setKind(value.kind), [value.kind]);

  const year = value.kind === 'year' ? value.year
    : value.kind === 'month' ? Number(value.month.slice(0, 4)) : Number(value.from.slice(0, 4));
  const month = value.kind === 'month' ? Number(value.month.slice(5, 7)) : 1;
  const rangeError = from && to && from > to ? 'วันที่เริ่มต้องไม่เกินวันที่สิ้นสุด' : '';

  const pick = (k: Period['kind']) => {
    setKind(k);
    if (k === 'year') onChange({ kind: 'year', year });
    if (k === 'month') onChange({ kind: 'month', month: `${year}-${String(month).padStart(2, '0')}` });
  };
  const applyRange = (f: string, t: string) => {
    setFrom(f); setTo(t);
    if (f && t && f <= t) onChange({ kind: 'range', from: f, to: t });
  };

  return (
    <div className="filterbar">
      <div className="seg" role="tablist" aria-label="ช่วงเวลา">
        {([['year', 'รายปี'], ['month', 'รายเดือน'], ['range', 'ช่วงวันที่']] as const).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => pick(k)}>{label}</button>
        ))}
      </div>
      {kind !== 'range' && (
        <label>ปี
          <select id="f-year" value={year} onChange={(e) => {
            const y = Number(e.target.value);
            onChange(kind === 'year' ? { kind: 'year', year: y } : { kind: 'month', month: `${y}-${String(month).padStart(2, '0')}` });
          }}>
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
      )}
      {kind === 'month' && (
        <label>เดือน
          <select id="f-month" value={month} onChange={(e) =>
            onChange({ kind: 'month', month: `${year}-${String(e.target.value).padStart(2, '0')}` })}>
            {THAI_MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </label>
      )}
      {kind === 'range' && (
        <>
          <label>จาก <input id="f-from" type="date" value={from} onChange={(e) => applyRange(e.target.value, to)} /></label>
          <label>ถึง <input id="f-to" type="date" value={to} onChange={(e) => applyRange(from, e.target.value)} /></label>
          {rangeError && <span className="error" role="alert">{rangeError}</span>}
        </>
      )}
      <div className="filterbar-actions">{children}</div>
    </div>
  );
}
