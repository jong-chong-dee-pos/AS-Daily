// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
vi.mock('../../src/firebase', () => ({ auth: {}, db: {} }));
import { makeArtifactRepo } from '../../src/data/artifactRepo';
import type { Repo } from '../../src/data/repo';
import { RepoContext } from '../../src/data/RepoContext';
import { AuthContext } from '../../src/auth/context';
import { AppRoutes } from '../../src/AppRoutes';
import { PwEntryMonthly } from '../../src/pages/pw/PwEntryMonthly';
import { PwEntryDaily } from '../../src/pages/pw/PwEntryDaily';
import { TargetsForm } from '../../src/pages/pw/PwSettings';
import { bucketTotal, countSeries, inventorySeries, missingCount, missingSplit, perSeries, planSeries, yearlySeries, PW_DEFAULT_TARGETS } from '../../src/calc/pw';
import type { AppUser, PwBaseline, PwMonth } from '../../src/types';
import { memDb } from './memDb';

// Invented figures: the repository is public.
const B = (a: number, b: number, c: number, d: number, e: number) => ({ lt2: a, m2to6: b, m6to12: c, gt12: d, noUsage: e });
const NB = { lt2: null, m2to6: null, m6to12: null, gt12: null, noUsage: null };
const month = (m: string, extra: Partial<PwMonth> = {}): PwMonth => ({
  month: m, pur: NB, inh: NB, missing: [], stockDiff: null, countPlan: null, countActual: null, perIssue: null, perCount: null, ...extra,
});
const base = { forYear: 2026, columns: [
  { id: 'i1', label: 'Dec\'2025', kind: 'inventory', pur: B(1, 2, 3, 4, 5), inh: B(1, 1, 1, 1, 1) },
  { id: 'y1', label: '2025', kind: 'yearly', missingCount: 9, missingMax: 8, stockDiff: 0.05, stockDiffTarget: 0.2 },
  { id: 'a1', label: 'AVG-25', kind: 'avg', perIssue: 100, perIssueTarget: 105, perCount: 110, perCountTarget: 115, countItemTarget: 60 },
] as PwBaseline[] };

describe('Part Warehouse calculations', () => {
  it('PUR and WIP are the sums of the age buckets', () => {
    expect(bucketTotal(B(1.11, 2.22, 3.33, 4.44, 5.55))).toBe(16.65);
    expect(bucketTotal(NB)).toBeNull();
    const s = inventorySeries(2026, [month('2026-01', { pur: B(10, 0, 0, 0, 2.5), inh: { ...NB, lt2: 4 } })], base);
    expect(s[0]).toMatchObject({ name: 'Dec\'2025', pur: 15, wip: 5, total: 20 });
    expect(s[1]).toMatchObject({ name: 'Jan', pur: 12.5, wip: 4, total: 16.5, p_noUsage: 2.5 });
    expect(s[12]).toMatchObject({ name: 'Dec', pur: null, wip: null, total: null }); // no bar, no zero
  });
  it('other years show last December instead of the imported columns', () => {
    const s = inventorySeries(2027, [month('2026-12', { pur: B(1, 1, 1, 1, 1) })], base);
    expect(s[0]).toMatchObject({ name: 'Dec 2026', pur: 5 });
    expect(s).toHaveLength(13);
  });
  it('Missing Part counts the listed rows, else the imported count', () => {
    expect(missingCount(month('x', { missing: [{ partNo: 'A1', qty: 2 }, { partNo: ' ', qty: null }, { partNo: 'B2', qty: 1 }], missingCount: 7 }))).toBe(2);
    expect(missingCount(month('x', { missingCount: 7 }))).toBe(7);
    expect(missingCount(undefined)).toBeNull();
  });
  it('a short (negative) and an over (positive) Qty each count as one missing part', () => {
    const m = month('2026-05', { missing: [{ partNo: 'A1', qty: -3 }, { partNo: 'B2', qty: 2 }, { partNo: 'C3', qty: -1 }] });
    expect(missingCount(m)).toBe(3);
    expect(missingSplit(m)).toEqual({ short: 2, over: 1 });
    const s = yearlySeries(2026, [m], base, PW_DEFAULT_TARGETS);
    expect(s[5]).toMatchObject({ name: 'May', missing: 3, missingShort: 2, missingOver: 1 });
  });
  it('notes ride on the chart points for the tooltip, one per topic', () => {
    const m = month('2026-02', { notes: { pur: 'ของเข้าล็อตใหญ่', missing: 'รอซัพพลายเออร์', perCount: ' ', count: 'นับซ้ำ', perIssue: 'คนลา 2 คน', stockDiff: 'ปรับยอด', inh: 'WIP สูง' } });
    expect(inventorySeries(2026, [m], base)[2]).toMatchObject({ name: 'Feb', notePur: 'ของเข้าล็อตใหญ่', noteInh: 'WIP สูง' });
    expect(yearlySeries(2026, [m], base, PW_DEFAULT_TARGETS)[2]).toMatchObject({ noteMissing: 'รอซัพพลายเออร์', noteStockDiff: 'ปรับยอด' });
    expect(countSeries(2026, [m])[1]).toMatchObject({ notePlanCount: 'นับซ้ำ' });
    expect(perSeries(2026, [m], base, PW_DEFAULT_TARGETS)[1]).toMatchObject({ noteIssue: 'คนลา 2 คน', notePerCount: null }); // blank is no note
    expect(planSeries('2026-11', [{ date: '2026-11-02', qty: { auto: 5 }, note: 'ไลน์หยุด' }])[1]).toMatchObject({ note: 'ไลน์หยุด' });
  });
  it('earlier years carry their own targets, months the current ones', () => {
    const t = { ...PW_DEFAULT_TARGETS, missingMax: 5 };
    const s = yearlySeries(2026, [month('2026-03', { missingCount: 6, stockDiff: 0.01 })], base, t);
    expect(s[0]).toMatchObject({ name: '2025', missing: 9, missingMax: 8, stockDiffTarget: 0.2 });
    expect(s[3]).toMatchObject({ name: 'Mar', missing: 6, missingMax: 5, stockDiff: 0.01 });
  });
  it('% Performance adds this year\'s average and the imported averages', () => {
    const s = perSeries(2026, [month('2026-01', { perIssue: 110, perCount: 90 }), month('2026-02', { perIssue: 121, perCount: 101 })], base, PW_DEFAULT_TARGETS);
    expect(s[12]).toMatchObject({ name: 'AVG-26', issue: 115.5, count: 95.5, issueTarget: 120 });
    expect(s[13]).toMatchObject({ name: 'AVG-25', issue: 100, issueTarget: 105, countTarget: 115, countItem: 60 });
  });
  it('the daily plan has one column per day with the total', () => {
    const s = planSeries('2026-02', [{ date: '2026-02-03', qty: { singleLever: 100, manual: 5 } }]);
    expect(s).toHaveLength(28);
    expect(s[2]).toMatchObject({ name: '3', singleLever: 100, manual: 5, total: 105, laser: null });
    expect(s[0].total).toBeNull();
  });
});

describe('Part Warehouse data stays under areas/partWarehouse', () => {
  it('saves and reads months, plan days and targets', async () => {
    const { db, store } = memDb();
    const repo = makeArtifactRepo(db);
    await repo.savePwMonth(month('2026-05', { perIssue: 120 }));
    await repo.savePwPlanDay({ date: '2026-05-04', qty: { auto: 30 } });
    await repo.savePwPlanDay({ date: '2026-05-05', qty: { auto: 10 } });
    await repo.savePwPlanDay({ date: '2026-05-05', qty: {} }); // emptied day is removed
    expect([...store.keys()].every((k) => k.startsWith('areas/partWarehouse/'))).toBe(true);
    expect((await repo.getPwMonths('2026-01', '2026-12')).map((m) => m.perIssue)).toEqual([120]);
    expect(await repo.getPwPlan('2026-05')).toEqual([{ date: '2026-05-04', qty: { auto: 30 } }]);
    expect(await repo.getPwTargets()).toEqual(PW_DEFAULT_TARGETS);
    await repo.savePwTargets({ ...PW_DEFAULT_TARGETS, manpower: 350 });
    expect((await repo.getPwTargets()).manpower).toBe(350);
  });
});

const admin: AppUser = { uid: 'a', name: 'แอดมิน', email: 'a@x', role: 'admin' };
const wrap = (repo: Repo, ui: React.ReactNode, user: AppUser = admin) => render(
  <AuthContext.Provider value={{ user, noRole: false, loading: false }}>
    <RepoContext.Provider value={repo}><MemoryRouter>{ui}</MemoryRouter></RepoContext.Provider>
  </AuthContext.Provider>,
);

describe('Part Warehouse monthly entry', () => {
  it('sums the buckets as they are typed and saves a list of missing parts', async () => {
    const { db } = memDb();
    const repo = makeArtifactRepo(db) as Repo;
    wrap(repo, <PwEntryMonthly initialMonth="2026-04" />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'บันทึก' })).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Turn Over : Purchase Part < 2 Month'), { target: { value: '10.5' } });
    fireEvent.change(screen.getByLabelText('Turn Over : Purchase Part No Usage'), { target: { value: '2.25' } });
    fireEvent.change(screen.getByLabelText('Turn Over : Inhouse 2-6 Month'), { target: { value: '3' } });
    expect(screen.getByTestId('sum-pur')).toHaveTextContent('12.75');
    expect(screen.getByTestId('sum-total')).toHaveTextContent('15.75');
    fireEvent.click(screen.getByRole('button', { name: '+ เพิ่ม Part No.' }));
    fireEvent.change(screen.getByLabelText('Part No. แถว 1'), { target: { value: 'P-100' } });
    expect(screen.getByRole('alert')).toHaveTextContent('ทุกแถวของ Missing Part ต้องมี Part No. และ Qty');
    fireEvent.change(screen.getByLabelText('Qty แถว 1'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: '+ เพิ่ม Part No.' }));
    fireEvent.change(screen.getByLabelText('Part No. แถว 2'), { target: { value: 'p-100' } });
    fireEvent.change(screen.getByLabelText('Qty แถว 2'), { target: { value: '1' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Part No. P-100 ซ้ำ');
    fireEvent.change(screen.getByLabelText('Part No. แถว 2'), { target: { value: 'P-200' } });
    expect(screen.getByTestId('missing-count')).toHaveTextContent('นับได้ 2 รายการ');
    fireEvent.change(screen.getByLabelText('% Performance ทีมจ่าย'), { target: { value: '121' } });
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก' }));
    await screen.findByText('บันทึกข้อมูลเดือน Apr 2026 แล้ว');
    const [m] = await repo.getPwMonths('2026-04', '2026-04');
    expect(m).toMatchObject({ month: '2026-04', pur: { lt2: 10.5, noUsage: 2.25, m2to6: null }, inh: { m2to6: 3 }, perIssue: 121, perCount: null,
      missing: [{ partNo: 'P-100', qty: 4 }, { partNo: 'P-200', qty: 1 }] });
    expect(m.missingCount).toBeUndefined();
    expect(m.notes).toEqual({});
  });
  it('Qty takes short (negative) and over (positive) amounts, never 0, and each topic keeps a note', async () => {
    const { db } = memDb();
    const repo = makeArtifactRepo(db) as Repo;
    wrap(repo, <PwEntryMonthly initialMonth="2026-06" />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'บันทึก' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: '+ เพิ่ม Part No.' }));
    fireEvent.change(screen.getByLabelText('Part No. แถว 1'), { target: { value: 'P-1' } });
    fireEvent.change(screen.getByLabelText('Qty แถว 1'), { target: { value: '0' } });
    expect(screen.getByRole('alert')).toHaveTextContent('ใส่จำนวนที่ขาด (ติดลบ) หรือเกิน (บวก)');
    fireEvent.change(screen.getByLabelText('Qty แถว 1'), { target: { value: '-1200' } });
    expect(screen.getByLabelText('Qty แถว 1')).toHaveValue('-1,200');
    fireEvent.click(screen.getByRole('button', { name: '+ เพิ่ม Part No.' }));
    fireEvent.change(screen.getByLabelText('Part No. แถว 2'), { target: { value: 'P-2' } });
    fireEvent.change(screen.getByLabelText('Qty แถว 2'), { target: { value: '3' } });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByTestId('missing-count')).toHaveTextContent('นับได้ 2 รายการ (ขาด 1 · เกิน 1)');
    for (const t of ['Turn Over Purchase Part', 'Turn Over Inhouse', 'Missing Part', 'Stock Diff', 'Plan Count', '% Performance ทีมจ่าย', '% Performance ทีมนับสต๊อก'])
      expect(screen.getByLabelText(`หมายเหตุ ${t}`)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('หมายเหตุ Missing Part'), { target: { value: ' รอของจากซัพพลายเออร์ ' } });
    fireEvent.change(screen.getByLabelText('หมายเหตุ % Performance ทีมนับสต๊อก'), { target: { value: 'คนลา' } });
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก' }));
    await screen.findByText('บันทึกข้อมูลเดือน Jun 2026 แล้ว');
    const [m] = await repo.getPwMonths('2026-06', '2026-06');
    expect(m.missing).toEqual([{ partNo: 'P-1', qty: -1200 }, { partNo: 'P-2', qty: 3 }]);
    expect(m.notes).toEqual({ missing: 'รอของจากซัพพลายเออร์', perCount: 'คนลา' });
  });
  it('keeps the count imported from the old chart while no list is typed', async () => {
    const { db } = memDb();
    const repo = makeArtifactRepo(db) as Repo;
    await repo.savePwMonth(month('2026-03', { missingCount: 8 }));
    wrap(repo, <PwEntryMonthly initialMonth="2026-03" />);
    await screen.findByText(/มีจำนวนจากรายงานเดิม 8 รายการ/);
    fireEvent.change(screen.getByLabelText('Stock Diff (Amt) Pur & Wip'), { target: { value: '0.013' } });
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก' }));
    await screen.findByText('บันทึกข้อมูลเดือน Mar 2026 แล้ว');
    expect((await repo.getPwMonths('2026-03', '2026-03'))[0]).toMatchObject({ missingCount: 8, stockDiff: 0.013 });
  });
});

describe('Part Warehouse daily plan entry', () => {
  it('totals the day against the manpower line and saves it', async () => {
    const { db } = memDb();
    const repo = makeArtifactRepo(db) as Repo;
    await repo.savePwTargets({ ...PW_DEFAULT_TARGETS, manpower: 300 });
    wrap(repo, <PwEntryDaily initialDate="2026-11-03" />);
    await screen.findByText('เทียบกำลังพล 300');
    fireEvent.change(screen.getByLabelText('Single Lever'), { target: { value: '250' } });
    fireEvent.change(screen.getByLabelText('Manual'), { target: { value: '70' } });
    expect(screen.getByTestId('plan-total')).toHaveTextContent('320');
    expect(screen.getByText('เกิน 20')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก' }));
    await screen.findByText('บันทึกแผนวันที่ 03/11/2026 แล้ว');
    expect(await repo.getPwPlan('2026-11')).toEqual([{ date: '2026-11-03', qty: { singleLever: 250, manual: 70 } }]);
    expect(screen.getByRole('button', { name: '3' })).toHaveClass('has');
  });
  it('keeps one note for the day, and a cleared note is removed', async () => {
    const { db } = memDb();
    const repo = makeArtifactRepo(db) as Repo;
    await repo.savePwPlanDay({ date: '2026-11-04', qty: { auto: 10 }, note: 'ไลน์ A หยุดซ่อม' });
    await repo.savePwPlanDay({ date: '2026-11-05', qty: {}, note: 'วันหยุดพิเศษ' }); // a note alone is kept
    expect(await repo.getPwPlan('2026-11')).toEqual([
      { date: '2026-11-04', qty: { auto: 10 }, note: 'ไลน์ A หยุดซ่อม' }, { date: '2026-11-05', qty: {}, note: 'วันหยุดพิเศษ' }]);
    wrap(repo, <PwEntryDaily initialDate="2026-11-04" />);
    await waitFor(() => expect(screen.getByLabelText('หมายเหตุแผนประกอบ')).toHaveValue('ไลน์ A หยุดซ่อม'));
    fireEvent.change(screen.getByLabelText('หมายเหตุแผนประกอบ'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก' }));
    await screen.findByText('บันทึกแผนวันที่ 04/11/2026 แล้ว');
    expect((await repo.getPwPlan('2026-11'))[0]).toEqual({ date: '2026-11-04', qty: { auto: 10 } });
  });
});

describe('Part Warehouse settings and pages', () => {
  it('the admin changes a target', async () => {
    const { db } = memDb();
    const repo = makeArtifactRepo(db) as Repo;
    wrap(repo, <TargetsForm />);
    fireEvent.change(await screen.findByLabelText('Missing Part: MAX'), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก' }));
    await screen.findByText(/บันทึกเป้าหมายแล้ว/);
    expect((await repo.getPwTargets()).missingMax).toBe(7);
  });
  const at = (path: string, user: AppUser, repo = makeArtifactRepo(memDb().db) as Repo) => render(
    <AuthContext.Provider value={{ user, noRole: false, loading: false }}>
      <RepoContext.Provider value={repo}><MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter></RepoContext.Provider>
    </AuthContext.Provider>,
  );
  it('the chooser opens Part Warehouse for users who have access', () => {
    at('/', { ...admin, role: 'viewer', areas: { assembly: 'view', partWarehouse: 'view' } });
    expect(screen.getByRole('link', { name: /Part Warehouse/ })).toHaveAttribute('href', '/part-warehouse');
  });
  it('a Part Warehouse data-entry user gets its entry menu but not Assembly entry', async () => {
    at('/part-warehouse', { ...admin, role: 'editor', areas: { assembly: 'view', partWarehouse: 'edit' } });
    expect(screen.getByRole('link', { name: 'แผนประกอบรายวัน' })).toHaveAttribute('href', '/part-warehouse/entry/daily');
    expect(screen.getByRole('link', { name: 'ข้อมูลรายเดือน' })).toHaveAttribute('href', '/part-warehouse/entry/monthly');
    expect(screen.queryByRole('link', { name: 'ตั้งค่า' })).toBeNull();
    await screen.findByRole('heading', { name: 'Dashboard Part Warehouse' });
  });
  it('users without Part Warehouse access are stopped', () => {
    at('/part-warehouse/entry/monthly', { ...admin, role: 'viewer' });
    expect(screen.getByText('คุณยังไม่มีสิทธิ์เข้าพื้นที่งานนี้ ติดต่อผู้ดูแลระบบ')).toBeInTheDocument();
  });
  it('view-only users cannot open the entry pages', () => {
    at('/part-warehouse/entry/daily', { ...admin, role: 'viewer', areas: { partWarehouse: 'view' } });
    expect(screen.getByText('หน้านี้สำหรับผู้กรอกข้อมูลเท่านั้น')).toBeInTheDocument();
  });
  it('the dashboard shows the nine charts', async () => {
    const repo = makeArtifactRepo(memDb().db) as Repo;
    await repo.savePwMonth(month('2026-01', { pur: B(1, 1, 1, 1, 1), countPlan: 10, perIssue: 120, perCount: 119, stockDiff: 0.02, missingCount: 3, notes: { perIssue: 'คนลา' } }));
    at('/part-warehouse?y=2026', admin, repo);
    for (const t of ['Inventory Purchaser Part & Inhouse', 'Turn Over : Purchase Part', 'Turn Over : Inhouse', 'Missing Part No. & Qty', 'Stock Diff (Amt)',
      'Plan Count ปี 2026', '% Performance 2026 ทีมจ่าย', '% Performance 2026 ทีมนับสต๊อก']) expect(await screen.findByText(t)).toBeInTheDocument();
    expect(screen.getByText(/แผนประกอบรายวัน/, { selector: '.chart-title' })).toBeInTheDocument();
    // Only the chart whose month has a note says there is one to hover.
    expect(screen.getAllByText('มีหมายเหตุ (ชี้เพื่ออ่าน)')).toHaveLength(1);
  });
});
