import { useMemo, useState } from 'react';
import { useReportData, type ReportData } from '../data/useReportData';
import { datesIn, monthsIn, monthOf } from '../calc/period';
import { lineAverage, mean, overallAverage, personAverage, setterAverage } from '../calc/per';
import { monthlyPer } from '../calc/monthly';
import { targetFor } from '../calc/cost';
import type { Period } from '../types';
import { FilterBar } from '../ui/FilterBar';
import { usePeriod } from '../ui/usePeriod';
import { fmtDate, fmtMonth, fmtNum, THAI_MONTHS } from '../ui/format';
import { ExportButtons } from '../ui/ExportButtons';
import { workerLabel } from '../ui/labels';
import { PerMonthChart, PerRankChart, yearOf, type RankRow } from '../ui/ExcelCharts';

type Tab = 'line' | 'setter' | 'person';

export function ReportPer() {
  const [period, setPeriod] = usePeriod();
  const { data, error } = useReportData(period);
  const [tab, setTab] = useState<Tab>('line');
  const yearData = useReportData({ kind: 'year', year: yearOf(period) });
  const table = useMemo(() => (data ? buildTable(data, period, tab) : null), [data, period, tab]);
  const ranking = useMemo(() => (data ? perRanking(data, period, tab) : []), [data, period, tab]);
  const imported = data ? importedNote(data, period) : null;
  return (
    <section>
      <div className="page-head"><h1>% PER</h1><span className="muted">ประสิทธิภาพการประกอบ</span></div>
      <FilterBar value={period} onChange={setPeriod}>
        {table && <ExportButtons name={`PER_${periodName(period)}`} sheets={[{ name: '% PER', rows: table.exportRows }]} target="report-per" />}
      </FilterBar>
      {error && <p className="error">{error}</p>}
      {!data && !error && <p className="empty">กำลังโหลด…</p>}
      {table && data && (
        <div id="report-per">
          {yearData.data && <div className="charts single"><PerMonthChart d={yearData.data} year={yearOf(period)} /></div>}
          <div className="tabs seg tabs-view" role="tablist" aria-label="มุมมอง">
            {TABS.map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>
          {imported && (
            <div className="notice" role="note">
              <b>{imported.text}</b>
              <span>{imported.detail}</span>
            </div>
          )}
          {ranking.length > 0 && (
            <div className="charts single">
              <PerRankChart title={`% PER เฉลี่ย${TABS.find(([k]) => k === tab)![1]}`} sub={periodTitle(period)} rows={ranking} target={periodPerTarget(data, period)} />
            </div>
          )}
          {!(period.kind === 'month' && imported) && <>
          <h2 className="section-title">ตาราง % PER <small>{periodName(period)}</small></h2>
          <div className="tablewrap tall">
            <table className="pertable">
              <thead>
                <tr>
                  {table.head.slice(tab === 'line' ? 1 : 0, table.colStart).map((h, i, a) => <th key={`l${i}`} rowSpan={2} className={`${i === 0 ? 'sticky-col' : ''} ${i === a.length - 1 && table.colStart > table.firstNum ? 'num' : ''}`}>{h}</th>)}
                  <th colSpan={table.head.length - table.colStart - 1} style={{ textAlign: 'center' }}>{table.colGroup}</th>
                  <th rowSpan={2} className="num">เฉลี่ย</th>
                </tr>
                <tr>
                  {table.head.slice(table.colStart, -1).map((h, j) => {
                    const i = j + table.colStart;
                    return <th key={i} className={`num ${table.weekend[i] ? 'wk' : ''}`} style={{ top: 40 }}>{h}{table.headSub[i] && <small>{table.headSub[i]}</small>}</th>;
                  })}
                </tr>
              </thead>
              <tbody>
                {table.body.map((r, i) => {
                  const from = tab === 'line' ? 1 : 0;
                  if (r.group && tab === 'line') {
                    return (
                      <tr key={i} className="group">
                        <td className="sticky-col" colSpan={table.colStart - 1}>Setter: {r.cells[0].text || 'ยังไม่ได้กำหนด'} <span className="hint">(เฉลี่ย Setter)</span></td>
                        {r.cells.slice(table.colStart).map((c, j) => <td key={j} className="num">{c.text}</td>)}
                      </tr>
                    );
                  }
                  return (
                    <tr key={i}>
                      {r.cells.slice(from).map((c, k) => {
                        const j = k + from;
                        const isNum = j >= table.firstNum;
                        const heat = j >= table.colStart && c.raw !== undefined && c.raw !== null ? (c.below ? 'heat-bad' : 'heat-ok') : '';
                        return <td key={j} className={`${isNum ? 'num' : ''} ${k === 0 ? 'sticky-col' : ''} ${table.weekend[j] ? 'wk' : ''} ${heat}`}>{k === 0 && tab === 'line' ? <b>{c.text}</b> : c.text}</td>;
                      })}
                    </tr>
                  );
                })}
              </tbody>
              {table.foot && <tfoot><tr>{table.foot.slice(tab === 'line' ? 1 : 0).map((c, k) => {
                const j = k + (tab === 'line' ? 1 : 0);
                return <td key={j} className={`${j >= table.firstNum ? 'num' : ''} ${k === 0 ? 'sticky-col' : ''} ${c.below ? 'below-target' : ''}`}>{c.text}</td>;
              })}</tr></tfoot>}
            </table>
          </div>
          <p className="legend-dots" style={{ marginTop: 6 }}>
            <span><i style={{ background: 'var(--good-soft)' }} />ถึงเป้า</span>
            <span><i style={{ background: 'var(--bad-soft)' }} />ต่ำกว่าเป้าของเดือนนั้น</span>
            <span><i style={{ background: '#eef0f5' }} />วันอาทิตย์</span>
            <span>ค่ารวมเฉลี่ยจากไลน์ที่ตั้งให้นับเข้าค่ารวม</span>
          </p>
          {table.body.length === 0 && <p className="empty">ไม่มีข้อมูลในช่วงนี้</p>}
          </>}
        </div>
      )}
    </section>
  );
}

const TABS = [['line', 'รายไลน์'], ['setter', 'ราย Setter'], ['person', 'รายคน']] as const;

const periodTitle = (p: Period) =>
  p.kind === 'month' ? fmtMonth(p.month) : p.kind === 'year' ? `ปี ${p.year}` : `${fmtDate(p.from)} – ${fmtDate(p.to)}`;

/** Months of the period that have daily % PER entries (all months when none do). */
const monthsWithData = (d: ReportData, p: Period) => {
  const all = monthsIn(p);
  const have = all.filter((m) => d.per.some((e) => e.date.startsWith(m)));
  return have.length ? have : all;
};

/** The target a period average is compared with: the mean target of the months that have data. */
export function periodPerTarget(d: ReportData, p: Period): number {
  return mean(monthsWithData(d, p).map((m) => targetFor(d.targets, m).perTarget)) ?? 125;
}

/** Period average per line, Setter or person, for the comparison chart. */
export function perRanking(d: ReportData, _p: Period, tab: Tab): RankRow[] {
  const lines = d.lines.filter((l) => l.active || d.per.some((e) => e.lineId === l.id));
  const rows: { name: string; per: number | null; days?: number }[] =
    tab === 'line' ? lines.map((l) => ({ name: l.code, per: lineAverage(d.per, l.id) }))
      : tab === 'setter' ? [...new Set(lines.map((l) => l.setter))].map((s) => ({ name: s || 'ยังไม่ได้กำหนด', per: setterAverage(d.per, lines, s) }))
        : [...new Set(d.per.flatMap((e) => e.workerIds))].map((id) => ({
          name: workerLabel(d.workers, id),
          per: personAverage(d.per, id),
          days: d.per.filter((e) => e.workerIds.includes(id)).length,
        }));
  return rows.filter((r): r is RankRow => r.per !== null);
}

/**
 * Months imported from Excel carry only the monthly overall % PER, not lines or people.
 * Says so, with the imported value, instead of leaving an unexplained empty table.
 */
export function importedNote(d: ReportData, p: Period): { text: string; detail: string } | null {
  const summarized = monthsIn(p).filter((m) => !d.per.some((e) => e.date.startsWith(m)) && d.summaries.some((s) => s.month === m && s.per !== null && s.per !== undefined));
  if (!summarized.length) return null;
  if (p.kind === 'month') {
    const v = d.summaries.find((s) => s.month === p.month)?.per ?? null;
    return { text: `${fmtMonth(p.month)} นำเข้าจาก Excel: % PER เฉลี่ยทั้งเดือน ${fmtNum(v)}%`,
      detail: 'ไฟล์ Excel มีเฉพาะค่ารวมรายเดือน จึงไม่มีตัวเลขแยกรายไลน์ ราย Setter หรือรายคนของเดือนนี้' };
  }
  const names = summarized.map((m) => THAI_MONTHS[Number(m.slice(5)) - 1]).join(', ');
  return { text: `เดือนที่นำเข้าจาก Excel (${names}) มีเฉพาะค่ารวมรายเดือน`,
    detail: p.kind === 'range'
      ? 'ช่วงวันที่นับเฉพาะวันที่กรอกข้อมูลรายวันในระบบ ค่ารวมของเดือนที่นำเข้าดูได้ในกราฟรายเดือนด้านบน'
      : 'ค่ารวมของเดือนเหล่านี้แสดงในแถว "รวมทุกไลน์" และกราฟรายเดือน ส่วนรายไลน์ ราย Setter และรายคนเริ่มมีตั้งแต่เดือนที่กรอกข้อมูลรายวัน' };
}

export const periodName = (p: Period) =>
  p.kind === 'year' ? String(p.year) : p.kind === 'month' ? p.month : `${p.from}_${p.to}`;

interface Cell { text: string; below?: boolean; raw?: string | number | null }
interface Built { head: string[]; headSub: string[]; weekend: boolean[]; colGroup: string; colStart: number; firstNum: number; body: { cells: Cell[]; group?: boolean }[]; foot?: Cell[]; exportRows: (string | number | null)[][] }

export function buildTable(d: ReportData, p: Period, tab: Tab): Built {
  const byYear = p.kind === 'year';
  const cols = byYear ? monthsIn(p) : datesIn(p);
  const colHead = byYear ? cols.map((m) => THAI_MONTHS[Number(m.slice(5)) - 1]) : cols.map((c) => (p.kind === 'month' ? String(Number(c.slice(8))) : fmtDate(c).slice(0, 5)));
  const WD = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
  const dow = (c: string) => new Date(`${c}T00:00:00Z`).getUTCDay();
  const colSub = byYear ? cols.map(() => '') : cols.map((c) => WD[dow(c)]);
  const colWk = byYear ? cols.map(() => false) : cols.map((c) => dow(c) === 0);
  const inCol = (c: string) => d.per.filter((e) => (byYear ? e.date.startsWith(c) : e.date === c));
  const tgt = (c: string) => targetFor(d.targets, byYear ? c : monthOf(c)).perTarget;
  const cell = (v: number | null, c?: string): Cell => ({ text: fmtNum(v), raw: v, below: v !== null && c !== undefined && v < tgt(c) });
  const pTarget = periodPerTarget(d, p);
  const periodTarget = (v: number | null): boolean => v !== null && v < pTarget;
  const workerName = (id: string) => workerLabel(d.workers, id);
  const lines = d.lines.filter((l) => l.active || d.per.some((e) => e.lineId === l.id));

  let head: string[]; let body: Built['body']; let foot: Cell[] | undefined; let firstNum: number;

  if (tab === 'line') {
    head = ['Setter', 'ไลน์', 'พนักงาน', ...colHead, 'เฉลี่ย'];
    firstNum = 3;
    const setters = [...new Set(lines.map((l) => l.setter))];
    body = setters.flatMap((s) => {
      const sv = setterAverage(d.per, lines, s);
      return [
        { group: true, cells: [{ text: s }, { text: '' }, { text: 'เฉลี่ย Setter' }, ...cols.map(() => ({ text: '' })), { ...cell(sv), below: periodTarget(sv) }] },
        ...lines.filter((l) => l.setter === s).map((l) => {
          const last = [...d.per].filter((e) => e.lineId === l.id).sort((a, b) => b.date.localeCompare(a.date))[0];
          const names = (last?.workerIds ?? l.defaultWorkerIds).map(workerName).join(', ');
          const avg = lineAverage(d.per, l.id);
          return { cells: [{ text: '' }, { text: l.code }, { text: names }, ...cols.map((c) => cell(lineAverage(inCol(c), l.id), c)), { ...cell(avg), below: periodTarget(avg) }] };
        }),
      ];
    });
    const overallCols = byYear ? monthlyPer(cols, d.per, lines, d.summaries) : cols.map((c) => overallAverage(inCol(c), lines));
    const overall = byYear ? mean(overallCols.filter((v): v is number => v !== null)) : overallAverage(d.per, lines);
    foot = [{ text: '' }, { text: 'รวมทุกไลน์' }, { text: `เป้า ${monthsIn(p).map((m) => targetFor(d.targets, m).perTarget).filter((v, i, a) => a.indexOf(v) === i).join('/')}%` },
      ...overallCols.map((v, i) => cell(v, cols[i])), { ...cell(overall), below: periodTarget(overall) }];
  } else if (tab === 'setter') {
    head = ['Setter', ...colHead, 'เฉลี่ย'];
    firstNum = 1;
    body = [...new Set(lines.map((l) => l.setter))].map((s) => {
      const v = setterAverage(d.per, lines, s);
      return { cells: [{ text: s }, ...cols.map((c) => cell(setterAverage(inCol(c), lines, s), c)), { ...cell(v), below: periodTarget(v) }] };
    });
  } else {
    head = ['พนักงาน', 'จำนวนวัน', ...colHead, 'เฉลี่ย'];
    firstNum = 1;
    const ids = [...new Set(d.per.flatMap((e) => e.workerIds))];
    body = ids.map((id) => ({ id, name: workerName(id), avg: personAverage(d.per, id) }))
      .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1))
      .map(({ id, name, avg }) => ({ cells: [
        { text: name }, { text: String(d.per.filter((e) => e.workerIds.includes(id)).length), raw: d.per.filter((e) => e.workerIds.includes(id)).length },
        ...cols.map((c) => cell(personAverage(inCol(c), id), c)), { ...cell(avg), below: periodTarget(avg) },
      ] }));
  }

  const lead = head.length - cols.length - 1;
  const tail = head.length - lead - cols.length;
  const headSub = [...Array(lead).fill(''), ...colSub, ...Array(tail).fill('')];
  const weekend = [...Array(lead).fill(false), ...colWk, ...Array(tail).fill(false)];
  const colGroup = byYear ? `เดือน (ปี ${p.kind === 'year' ? p.year : ''})` : p.kind === 'month' ? `วันที่ใน ${fmtMonth(p.month)}` : 'วันที่';
  const toRow = (cells: Cell[]) => cells.map((c) => (c.raw !== undefined ? (c.raw === null ? null : Math.round(Number(c.raw) * 100) / 100) : c.text));
  const title = p.kind === 'month' ? fmtMonth(p.month) : p.kind === 'year' ? `ปี ${p.year}` : `${fmtDate(p.from)} – ${fmtDate(p.to)}`;
  return { head, headSub, weekend, colGroup, colStart: lead, firstNum, body, foot,
    exportRows: [[`% PER ${title}`], head, ...body.map((r) => toRow(r.cells)), ...(foot ? [toRow(foot)] : [])] };
}
