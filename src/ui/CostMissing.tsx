import { Link } from 'react-router-dom';
import { useAuth } from '../auth/context';
import { ap, canEdit } from '../areas';
import type { ReportData } from '../data/useReportData';
import { monthsIn } from '../calc/period';
import type { Period } from '../types';
import { fmtMonth } from './format';

/** Months of the period (up to this month) that have no cost entered at all. */
export function missingCostMonths(d: ReportData, p: Period, today: string): string[] {
  const now = today.slice(0, 7);
  return monthsIn(p).filter((m) => m <= now && !d.cost.some((c) => c.month === m));
}

/** Says which months still need costs, with a link to the entry page for those who can enter them. */
export function CostMissing({ months, all }: { months: string[]; all: boolean }) {
  const { user } = useAuth();
  if (!months.length) return null;
  const names = months.length > 3 ? `${months.length} เดือน (${fmtMonth(months[0])} – ${fmtMonth(months[months.length - 1])})` : months.map(fmtMonth).join(', ');
  const last = months[months.length - 1];
  return (
    <div className="notice" role="note">
      <b>{all ? `ยังไม่ได้กรอกต้นทุนของ ${names}` : `ยังไม่ได้กรอกต้นทุน: ${names}`}</b>
      <span>
        Variance จะแสดงเมื่อกรอกทั้ง Standard และ Actual แล้ว
        {canEdit(user, 'assembly') && <> · <Link to={ap(`/entry/cost?m=${last}`)}>ไปกรอกต้นทุน {fmtMonth(last)}</Link></>}
      </span>
    </div>
  );
}
