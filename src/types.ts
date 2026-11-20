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

/** A setter and the order they appear in; lines point to a setter by name (Line.setter). */
export interface Setter {
  id: string;
  name: string;
  order: number;
}

/** Display names for the two monthly targets; admins can rename them. */
export interface TargetLabels { per: string; lot: string }
export const DEFAULT_TARGET_LABELS: TargetLabels = { per: 'เป้า % PER', lot: 'เป้า Lot out' };

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
  /** Optional detail of each lot out: part number, type, note and photos. */
  items?: LotItem[];
}

export type LotKind = 'patrol' | 'fg';
export interface LotItem {
  id: string;
  partNo: string;
  /** Product name, shown with the Part No. */
  product?: string;
  /** U-Line that made the job. */
  lineId?: string;
  kind: LotKind;
  note: string;
  /** Image URLs (uploaded photos). */
  images: string[];
}

export type AbsenceReason = 'leave' | 'absent' | 'other';
export const ABSENCE_LABEL: Record<AbsenceReason, string> = { leave: 'ลา', absent: 'ขาด', other: 'อื่นๆ' };
/** One worker who did not come to work on a day. */
export interface Absence {
  workerId: string;
  reason: AbsenceReason;
  note: string;
}
export interface AbsenceDay { date: string; list: Absence[] }

export type CostCategory = 'electric' | 'laborOT' | 'laborSub' | 'consumed';
export const COST_CATEGORIES: CostCategory[] = ['electric', 'laborOT', 'laborSub', 'consumed'];

/** `month` is YYYY-MM. */
export interface CostMonth {
  month: string;
  standard: Record<CostCategory, number | null>;
  actual: Record<CostCategory, number | null>;
  /** Free-text remark per category, shown next to Variance in reports. */
  note?: Partial<Record<CostCategory, string>>;
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
  /** Lot out FG count, entered by hand for months imported without a Patrol/FG split. */
  lotFg?: number | null;
}

export type Period =
  | { kind: 'year'; year: number }
  | { kind: 'month'; month: string }
  | { kind: 'range'; from: string; to: string };
