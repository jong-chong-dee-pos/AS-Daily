import { useSearchParams } from 'react-router-dom';
import type { Period } from '../types';
import { todayIso } from './format';

/** Reads/writes the report period in the URL (?y=2026 | ?m=2026-11 | ?from=&to=). Default: current month. */
export function periodFromParams(sp: URLSearchParams): Period {
  const from = sp.get('from'), to = sp.get('to'), m = sp.get('m'), y = sp.get('y');
  if (from && to) return { kind: 'range', from, to };
  if (m) return { kind: 'month', month: m };
  if (y) return { kind: 'year', year: Number(y) };
  return { kind: 'month', month: todayIso().slice(0, 7) };
}

export function paramsFromPeriod(p: Period): Record<string, string> {
  if (p.kind === 'range') return { from: p.from, to: p.to };
  if (p.kind === 'month') return { m: p.month };
  return { y: String(p.year) };
}

export function usePeriod(): [Period, (p: Period) => void] {
  const [sp, setSp] = useSearchParams();
  return [periodFromParams(sp), (p) => setSp(paramsFromPeriod(p))];
}
