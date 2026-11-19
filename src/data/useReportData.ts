import { useEffect, useState } from 'react';
import { useRepo } from './RepoContext';
import { bounds } from '../calc/period';
import type { CostMonth, Line, LotEntry, MonthlySummary, PerEntry, Period, Target, Worker } from '../types';

export interface ReportData {
  lines: Line[]; workers: Worker[]; per: PerEntry[]; lot: LotEntry[]; cost: CostMonth[];
  targets: Target[]; summaries: MonthlySummary[];
  /** Same data for the previous calendar year (for comparisons on year views). */
  prevYear: { lot: LotEntry[]; summaries: MonthlySummary[]; yearSummary: MonthlySummary | null };
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
    setData(null); setError('');
    Promise.all([
      repo.listLines(), repo.listWorkers(), repo.getPerEntries(from, to), repo.getLotEntries(from, to),
      repo.getCostMonths(from.slice(0, 7), to.slice(0, 7)), repo.listTargets(),
      repo.getMonthlySummaries(from.slice(0, 7), to.slice(0, 7)),
      repo.getLotEntries(`${py}-01-01`, `${py}-12-31`), repo.getMonthlySummaries(`${py}-01`, `${py}-12`),
      repo.getMonthlySummaries(py, py),
    ]).then(([lines, workers, per, lot, cost, targets, summaries, pLot, pSum, pYear]) => {
      if (live) setData({ lines, workers, per, lot, cost, targets, summaries,
        prevYear: { lot: pLot, summaries: pSum, yearSummary: pYear[0] ?? null } });
    }).catch(() => live && setError('โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้า'));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, repo]);
  return { data, error };
}
