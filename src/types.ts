export type Role = 'admin' | 'editor' | 'viewer';

export interface AppUser {
  uid: string;
  name: string;
  email: string;
  role: Role;
}

export interface Line {
  id: string;
  code: string;
  order: number;
  setter: string;
  defaultWorkerIds: string[];
  includeInTotal: boolean;
  active: boolean;
}

export interface Worker {
  id: string;
  name: string;
  active: boolean;
}

/** One line on one day. `date` is YYYY-MM-DD. */
export interface PerEntry {
  date: string;
  lineId: string;
  workerIds: string[];
  per: number;
}

export interface LotEntry {
  date: string;
  sent: number;
  patrol: number;
  fg: number;
}

export type CostCategory = 'electric' | 'laborOT' | 'laborSub' | 'consumed';
export const COST_CATEGORIES: CostCategory[] = ['electric', 'laborOT', 'laborSub', 'consumed'];

/** `month` is YYYY-MM. */
export interface CostMonth {
  month: string;
  standard: Record<CostCategory, number | null>;
  actual: Record<CostCategory, number | null>;
}

export interface Target {
  month: string;
  perTarget: number;
  lotOutTarget: number;
}

/** Imported history for months before the system existed. */
export interface MonthlySummary {
  month: string;
  per: number | null;
  lotSent: number | null;
  lotOut: number | null;
}

export type Period =
  | { kind: 'year'; year: number }
  | { kind: 'month'; month: string }
  | { kind: 'range'; from: string; to: string };
