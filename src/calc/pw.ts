import { AGE_BUCKETS, PLAN_GROUPS, type Buckets, type PwBaseline, type PwMonth, type PwNoteKey, type PwPlanDay, type PwTargets } from '../types';

export const PW_DEFAULT_TARGETS: PwTargets = { missingMax: 6, stockDiff: 0.1, per: 120, countItem: 80, manpower: 400 };

export const emptyBuckets = (): Buckets => ({ lt2: null, m2to6: null, m6to12: null, gt12: null, noUsage: null });

/** Sum of the age buckets; null when none is entered. Rounded to 2 decimals like the charts. */
export function bucketTotal(b: Partial<Buckets> | undefined): number | null {
  const xs = AGE_BUCKETS.map((k) => b?.[k]).filter((v): v is number => typeof v === 'number');
  return xs.length ? Math.round(xs.reduce((a, v) => a + v, 0) * 100) / 100 : null;
}

/** Missing Part count for a month: the rows typed in, or the count imported from the old chart. */
export function missingCount(m: Pick<PwMonth, 'missing' | 'missingCount'> | undefined): number | null {
  if (!m) return null;
  const rows = (m.missing ?? []).filter((r) => r.partNo.trim()).length;
  return rows ? rows : (m.missingCount ?? null);
}

/**
 * How the month's missing parts split: issued short of the plan (negative Qty) and over it
 * (positive). Every row still counts once in the chart, whichever way it went.
 */
export function missingSplit(m: Pick<PwMonth, 'missing'> | undefined): { short: number; over: number } {
  const rows = (m?.missing ?? []).filter((r) => r.partNo.trim() && typeof r.qty === 'number');
  return { short: rows.filter((r) => (r.qty as number) < 0).length, over: rows.filter((r) => (r.qty as number) > 0).length };
}

/** A topic's note for a month, or null; notes ride along on the chart points for the tooltip only. */
const note = (m: PwMonth | undefined, k: PwNoteKey) => m?.notes?.[k]?.trim() || null;

/** Average of the months that have a value, rounded to whole percent like "AVG-26". */
export function avgOf(xs: (number | null | undefined)[]): number | null {
  const v = xs.filter((x): x is number => typeof x === 'number');
  return v.length ? v.reduce((a, x) => a + x, 0) / v.length : null;
}

export const planTotal = (d: Pick<PwPlanDay, 'qty'> | undefined) =>
  d ? PLAN_GROUPS.reduce((a, g) => a + (d.qty[g] ?? 0), 0) : 0;

// ---------- chart series ----------

export interface PwChartPoint { name: string; [k: string]: string | number | null }
const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const yearMonths = (year: number) => SHORT.map((name, i) => ({ name, month: `${year}-${String(i + 1).padStart(2, '0')}` }));

/** Baseline columns shown for `year`: the imported ones for their own year, else last December when entered. */
function baseCols(year: number, kind: PwBaseline['kind'], base: { forYear: number | null; columns: PwBaseline[] }) {
  return base.forYear === year ? base.columns.filter((c) => c.kind === kind) : [];
}

const bucketFields = (prefix: string, b: Partial<Buckets> | undefined) =>
  Object.fromEntries(AGE_BUCKETS.map((k) => [`${prefix}_${k}`, b?.[k] ?? null]));

/**
 * Inventory Purchaser Part & Inhouse and the two Turn Over charts. PUR and WIP are the sums of
 * the age buckets, so the three charts always agree.
 */
export function inventorySeries(year: number, months: PwMonth[], base: { forYear: number | null; columns: PwBaseline[] }): PwChartPoint[] {
  const point = (name: string, pur: Partial<Buckets> | undefined, inh: Partial<Buckets> | undefined, m?: PwMonth): PwChartPoint => {
    const p = bucketTotal(pur), w = bucketTotal(inh);
    return { name, pur: p, wip: w, total: p === null && w === null ? null : Math.round(((p ?? 0) + (w ?? 0)) * 100) / 100, ...bucketFields('p', pur), ...bucketFields('i', inh),
      notePur: note(m, 'pur'), noteInh: note(m, 'inh') };
  };
  const cols = baseCols(year, 'inventory', base).map((c) => point(c.label, c.pur, c.inh));
  if (!cols.length) {
    const dec = months.find((m) => m.month === `${year - 1}-12`);
    if (dec && (bucketTotal(dec.pur) !== null || bucketTotal(dec.inh) !== null)) cols.push(point(`Dec ${year - 1}`, dec.pur, dec.inh, dec));
  }
  return [...cols, ...yearMonths(year).map(({ name, month }) => { const m = months.find((x) => x.month === month); return point(name, m?.pur, m?.inh, m); })];
}

/** Missing Part No. & Qty and Stock Diff (Amt): earlier years, then the months, each with its target. */
export function yearlySeries(year: number, months: PwMonth[], base: { forYear: number | null; columns: PwBaseline[] }, t: PwTargets): PwChartPoint[] {
  return [
    ...baseCols(year, 'yearly', base).map((c) => ({ name: c.label, missing: c.missingCount ?? null, missingMax: c.missingMax ?? t.missingMax, stockDiff: c.stockDiff ?? null, stockDiffTarget: c.stockDiffTarget ?? t.stockDiff })),
    ...yearMonths(year).map(({ name, month }) => {
      const m = months.find((x) => x.month === month);
      const { short, over } = missingSplit(m);
      return { name, missing: missingCount(m), missingShort: short, missingOver: over, missingMax: t.missingMax, stockDiff: m?.stockDiff ?? null, stockDiffTarget: t.stockDiff,
        noteMissing: note(m, 'missing'), noteStockDiff: note(m, 'stockDiff') };
    }),
  ];
}

export function countSeries(year: number, months: PwMonth[]): PwChartPoint[] {
  return yearMonths(year).map(({ name, month }) => {
    const m = months.find((x) => x.month === month);
    return { name, plan: m?.countPlan ?? null, actual: m?.countActual ?? null, notePlanCount: note(m, 'count') };
  });
}

/**
 * % Performance of both teams: the months, the year's average ("AVG-26", computed), then the
 * imported averages of earlier years ("AVG-25"), each with the target that applied.
 */
export function perSeries(year: number, months: PwMonth[], base: { forYear: number | null; columns: PwBaseline[] }, t: PwTargets): PwChartPoint[] {
  const rows = yearMonths(year).map(({ name, month }) => {
    const m = months.find((x) => x.month === month);
    return { name, issue: m?.perIssue ?? null, count: m?.perCount ?? null, issueTarget: t.per, countTarget: t.per, countItem: t.countItem,
      noteIssue: note(m, 'perIssue'), notePerCount: note(m, 'perCount') };
  });
  const r0 = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);
  return [
    ...rows,
    { name: `AVG-${String(year).slice(2)}`, issue: r0(avgOf(rows.map((r) => r.issue))), count: r0(avgOf(rows.map((r) => r.count))), issueTarget: t.per, countTarget: t.per, countItem: t.countItem },
    ...baseCols(year, 'avg', base).map((c) => ({ name: c.label, issue: c.perIssue ?? null, count: c.perCount ?? null,
      issueTarget: c.perIssueTarget ?? t.per, countTarget: c.perCountTarget ?? t.per, countItem: c.countItemTarget ?? t.countItem })),
  ];
}

/** The daily assembly plan of a month: one column per day, a part per product group. */
export function planSeries(month: string, days: PwPlanDay[]): PwChartPoint[] {
  const [y, mo] = month.split('-').map(Number);
  const n = new Date(y, mo, 0).getDate();
  return Array.from({ length: n }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, '0')}`;
    const d = days.find((x) => x.date === date);
    const total = d ? planTotal(d) : 0;
    return { name: String(i + 1), ...Object.fromEntries(PLAN_GROUPS.map((g) => [g, d?.qty[g] ?? null])), total: total || null, note: d?.note?.trim() || null };
  });
}
