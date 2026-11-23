import type { CostCategory, Worker } from '../types';

export const COST_LABEL: Record<CostCategory, string> = {
  electric: 'Electric', laborOT: 'Labor-OT', laborSub: 'Labor-Sub', consumed: 'Consumed',
};

/** Shown where a record points at a worker who was deleted from Settings. */
export const MISSING_WORKER = 'ไม่พบชื่อ';

/** The worker's current name from Settings; never the internal code. */
export const workerLabel = (workers: Worker[], id: string) => workers.find((w) => w.id === id)?.name ?? MISSING_WORKER;
