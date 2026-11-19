import { vi } from 'vitest';
import type { Repo } from '../../src/data/repo';
import type { CostMonth, Line, LotEntry, MonthlySummary, PerEntry, Target, Worker } from '../../src/types';

export interface FakeData {
  lines?: Line[]; workers?: Worker[]; per?: PerEntry[]; lot?: LotEntry[];
  cost?: CostMonth[]; targets?: Target[]; summaries?: MonthlySummary[];
}

export const L = (id: string, setter: string, extra: Partial<Line> = {}): Line => ({
  id, code: id.toUpperCase(), order: 0, setter, defaultWorkerIds: [], includeInTotal: true, active: true, ...extra,
});

/** In-memory repo with vi.fn spies; range queries filter by date/month. */
export function fakeRepo(d: FakeData = {}) {
  const inRange = <T,>(xs: T[] | undefined, key: keyof T, from: string, to: string) =>
    (xs ?? []).filter((x) => String(x[key]) >= from && String(x[key]) <= to);
  const r = {
    listLines: vi.fn(async () => d.lines ?? []),
    listWorkers: vi.fn(async () => d.workers ?? []),
    listTargets: vi.fn(async () => d.targets ?? []),
    listUsers: vi.fn(async () => []),
    getPerEntries: vi.fn(async (f: string, t: string) => inRange(d.per, 'date', f, t)),
    savePerDay: vi.fn(async () => {}),
    getLotEntries: vi.fn(async (f: string, t: string) => inRange(d.lot, 'date', f, t)),
    saveLotDay: vi.fn(async () => {}),
    deleteLotDay: vi.fn(async () => {}),
    getCostMonths: vi.fn(async (f: string, t: string) => inRange(d.cost, 'month', f, t)),
    saveCostMonth: vi.fn(async () => {}),
    getMonthlySummaries: vi.fn(async (f: string, t: string) => inRange(d.summaries, 'month', f, t)),
    saveLine: vi.fn(async () => {}),
    saveWorker: vi.fn(async () => {}),
    saveTarget: vi.fn(async () => {}),
    saveUser: vi.fn(async () => {}),
    saveUserRole: vi.fn(async () => {}),
  };
  return r as unknown as Repo & typeof r;
}
