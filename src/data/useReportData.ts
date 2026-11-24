import { useEffect, useState } from 'react';
import { useRepo } from './RepoContext';
import { bounds } from '../calc/period';
import { DEFAULT_TARGET_LABELS, type TargetLabels } from '../types';
import type { CostMonth, Line, LotEntry, MonthlySummary, OpsMonth, OtdMonth, PerEntry, Period, Target, Worker } from '../types';

export interface ReportData {
  lines: Line[]; workers: Worker[]; per: PerEntry[]; lot: LotEntry[]; cost: CostMonth[];
  targets: Target[]; summaries: MonthlySummary[];
  /** Admin-chosen names for the two targets. */
  labels?: TargetLabels;
  /** Same data for the previous calendar year (for comparisons on year views). */
  prevYear: { lot: LotEntry[]; summaries: MonthlySummary[]; yearSummary: MonthlySummary | null };
  /** Yearly summary two years back (Excel shows AVG for the last three years). */
  prev2Year?: MonthlySummary | null;
  /** Monthly production and cost figures in the period. */
  ops?: OpsMonth[];
  /** %OTD months in the period, plus December of the two years before (the report shows them). */
  otd?: OtdMonth[];
}

export function useReportData(p: Period): { data: ReportData | null; error: string } {
  const repo = useRepo();
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState('');
  const key = JSON.stringify(p);
  useEffect(() => {
    let live = true;
    const { from, to } = bounds(p);
    const py = String(Number(from.slice(0, 4)) - 1);
    const py2 = String(Number(from.slice(0, 4)) - 2);
    setData(null); setError('');
    Promise.all([
      repo.listLines(), repo.listWorkers(), repo.getPerEntries(from, to), repo.getLotEntries(from, to),
      repo.getCostMonths(from.slice(0, 7), to.slice(0, 7)), repo.listTargets(),
      repo.getMonthlySummaries(from.slice(0, 7), to.slice(0, 7)),
      repo.getLotEntries(`${py}-01-01`, `${py}-12-31`), repo.getMonthlySummaries(`${py}-01`, `${py}-12`),
      repo.getMonthlySummaries(py, py), repo.getMonthlySummaries(py2, py2),
      repo.getTargetLabels().catch(() => null),
      repo.getOpsMonths(from.slice(0, 7), to.slice(0, 7)).catch(() => []),
      repo.getOtdMonths(`${py2}-12`, to.slice(0, 7)).catch(() => []),
    ]).then(([lines, workers, per, lot, cost, targets, summaries, pLot, pSum, pYear, p2Year, labels, ops, otd]) => {
      if (live) setData({ lines, workers, per, lot, cost, targets, summaries, labels: { ...DEFAULT_TARGET_LABELS, ...(labels ?? {}) },
        prevYear: { lot: pLot, summaries: pSum, yearSummary: pYear[0] ?? null }, prev2Year: p2Year[0] ?? null, ops, otd });
    }).catch(() => live && setError('โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้า'));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, repo]);
  return { data, error };
}
