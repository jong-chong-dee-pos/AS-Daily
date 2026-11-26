/**
 * One chart palette for the whole system (Assembly and Part Warehouse):
 * violet = the actual figure, blue = the plan or standard it is compared with,
 * green = target met, red = target missed, dashed orange = the target line,
 * grey = a previous year or an average. The Turn Over age buckets and the ten product
 * groups of the assembly plan keep their own colours.
 */
export const PAL = {
  actual: '#5b3fe0',
  plan: '#2f8fe8',
  good: '#0a8f7a',
  bad: '#e5383b',
  warn: '#e0a800',
  target: '#ee9200',
  prev: '#9a96b3',
  /** Totals and secondary reference lines. */
  ink: '#2a2750',
  muted: '#6e6a8e',
  none: '#d9d7e8',
} as const;

/** Green when the target is met, red when it is missed, the base colour when there is nothing to judge. */
export const judged = (ok: boolean | null, base: string = PAL.actual) => (ok === null ? base : ok ? PAL.good : PAL.bad);

/** Value labels never go below this size (px), on any chart. */
export const LABEL_PX = 12;
