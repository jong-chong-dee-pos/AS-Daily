import type { Target } from '../types';

/** Standard − Actual; negative means spending was over standard. */
export function variance(standard: number | null, actual: number | null): number | null {
  return standard === null || actual === null ? null : standard - actual;
}

export const DEFAULT_PER_TARGET = 125;
export const DEFAULT_LOT_OUT_TARGET = 0.5;

export function targetFor(targets: Target[], month: string): Target {
  return targets.find((t) => t.month === month)
    ?? { month, perTarget: DEFAULT_PER_TARGET, lotOutTarget: DEFAULT_LOT_OUT_TARGET };
}
