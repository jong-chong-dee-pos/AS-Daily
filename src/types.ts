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
  /** Note for each worker, same order as workerIds (absent when none was written). */
  notes?: string[];
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

/** 'leave' is the old "ลา" without a type, kept so earlier records still read. */
export type AbsenceReason = 'sick' | 'personal' | 'vacation' | 'other' | 'absent' | 'leave';
export const ABSENCE_LABEL: Record<AbsenceReason, string> = {
  sick: 'ลาป่วย', personal: 'ลากิจ', vacation: 'ลาพักร้อน', other: 'อื่นๆ', absent: 'ขาดงาน', leave: 'ลา (ไม่ระบุประเภท)',
};
/** The types offered when entering a new absence, in this order. */
export const ABSENCE_CHOICES: AbsenceReason[] = ['sick', 'personal', 'vacation', 'other', 'absent'];

/** Reads an old "ลา" record by the type written in its note (ลาป่วย, ลากิจ, ลาพักร้อน). */
export function normalizeAbsence(a: Absence): Absence {
  if (a.reason !== 'leave') return a;
  const n = a.note ?? '';
  const reason: AbsenceReason = /ป่วย/.test(n) ? 'sick' : /กิจ/.test(n) ? 'personal' : /พักร้อน/.test(n) ? 'vacation' : 'leave';
  if (reason === 'leave') return a;
  const note = n.replace(/^\s*ลา(ป่วย|กิจ|พักร้อน)\s*[:,-]?\s*/, '').trim();
  return { ...a, reason, note };
}
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

/**
 * Monthly production and cost figures entered by hand (YYYY-MM). Per-piece values
 * (Process THB/Pcs., Pcs./head, Expense/Pcs.) are computed, never stored.
 */
export interface OpsMonth {
  month: string;
  /** Assembly production volume: PLAN (PN) and ACTUAL (AS), pieces. */
  prodPlan: number | null;
  prodActual: number | null;
  /** Material cost Standard and Actual, as in the "Material cost Variance" report. */
  matStd: number | null;
  matAct: number | null;
  /** Actual process cost for the month, baht. */
  processCost: number | null;
  /** Head count used for Pcs./head. */
  headcount: number | null;
  /** Total expense for the month, baht (Expense/Pcs.). */
  expense: number | null;
  /** Pieces for Pcs./head and Expense/Pcs. when it differs from ACTUAL (AS); blank = ACTUAL. */
  prodForHead?: number | null;
}

/** One product group's On-Time Delivery for a month: plan and on-time qty per week W1–W4. */
export interface OtdRow {
  group: string;
  weeks: { plan: number; otd: number }[];
  /** Total On Plan: total plan and goods received. */
  onPlan?: { plan: number; gr: number };
  /** Total, Stock Item and Non Stock Item rows are summaries, not product groups. */
  kind: 'group' | 'total' | 'stock' | 'nonstock';
}

/**
 * %OTD FG 81 for one month (YYYY-MM). Either the full table uploaded from the
 * "OTD FG81" sheet, or only the monthly %OTD taken from the workbook's history.
 */
export interface OtdMonth {
  month: string;
  /** Monthly %OTD as a fraction (0.97 = 97%). */
  pct: number | null;
  rows?: OtdRow[];
  /** The sheet's "Update" date (YYYY-MM-DD). */
  updated?: string;
  source: 'upload' | 'history';
}
