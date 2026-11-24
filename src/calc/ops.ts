import type { OpsMonth, OtdMonth, OtdRow } from '../types';

const div = (a: number | null | undefined, b: number | null | undefined) =>
  a == null || b == null || b === 0 ? null : a / b;

/** Pieces used for Process THB/Pcs.: the separate figure when given, else ACTUAL (AS). */
export const costPieces = (o: OpsMonth) => o.prodForCost ?? o.prodActual;

/** Pieces used for Pcs./head and Expense/Pcs.: the separate figure when given, else ACTUAL (AS). */
export const headPieces = (o: OpsMonth) => o.prodForHead ?? o.prodActual;

/** Values computed from what was entered for one month. */
export function opsDerived(o: OpsMonth) {
  return {
    processPerPcs: div(o.processCost, costPieces(o)),
    pcsPerHead: div(headPieces(o), o.headcount),
    expensePerPcs: div(o.expense, headPieces(o)),
    matVariance: o.matStd == null || o.matAct == null ? null : o.matStd - o.matAct,
    prodDiff: o.prodPlan == null || o.prodActual == null ? null : o.prodActual - o.prodPlan,
  };
}

export const OTD_TARGET = 0.8;

/** Colour band used by the %OTD report: green ≥ 80%, yellow 60–79%, red below 60%. */
export function otdBand(pct: number | null): 'good' | 'warn' | 'bad' | 'none' {
  if (pct === null) return 'none';
  const p = Math.round(pct * 100);
  return p >= 80 ? 'good' : p >= 60 ? 'warn' : 'bad';
}

export const otdPct = (plan: number, otd: number) => (plan > 0 ? otd / plan : null);

/** W1–W4 totals and the month total of one row. */
export function otdTotals(r: OtdRow) {
  const plan = r.weeks.reduce((a, w) => a + w.plan, 0);
  const otd = r.weeks.reduce((a, w) => a + w.otd, 0);
  return { plan, otd, pct: otdPct(plan, otd) };
}

/** %OTD of each week for the whole plant (the "Total" row). */
export function otdWeekly(m: OtdMonth | undefined): (number | null)[] {
  const t = m?.rows?.find((r) => r.kind === 'total');
  return t ? t.weeks.map((w) => otdPct(w.plan, w.otd)) : [null, null, null, null];
}
