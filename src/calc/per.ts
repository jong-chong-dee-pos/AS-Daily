import type { Line, PerEntry } from '../types';

/** Mean of the values, or null when there are none (blank days are simply absent). */
export function mean(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

const nonNull = (v: (number | null)[]) => v.filter((x): x is number => x !== null);

export function lineAverage(entries: PerEntry[], lineId: string): number | null {
  return mean(entries.filter((e) => e.lineId === lineId).map((e) => e.per));
}

/** Average of the line averages in a Setter's group; lines without data are skipped. */
export function setterAverage(entries: PerEntry[], lines: Line[], setter: string): number | null {
  return mean(nonNull(lines.filter((l) => l.setter === setter).map((l) => lineAverage(entries, l.id))));
}

/** Average of the line averages of lines marked includeInTotal. */
export function overallAverage(entries: PerEntry[], lines: Line[]): number | null {
  return mean(nonNull(lines.filter((l) => l.includeInTotal).map((l) => lineAverage(entries, l.id))));
}

/** Average over the days this worker was recorded on any line. */
export function personAverage(entries: PerEntry[], workerId: string): number | null {
  return mean(entries.filter((e) => e.workerIds.includes(workerId)).map((e) => e.per));
}
