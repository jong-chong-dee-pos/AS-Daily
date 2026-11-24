import { describe, expect, it } from 'vitest';
import { makeArtifactRepo, monthKeys, type ArtifactDb } from '../src/data/artifactRepo';

/** In-memory stand-in for the artifact db: paths → bodies, `where` on top-level fields. */
function memDb() {
  const store = new Map<string, Record<string, unknown>>();
  const snap = (path: string) => ({
    id: path.split('/').pop()!, exists: store.has(path), data: () => store.get(path),
  });
  const query = (col: string, filters: [string, string, unknown][] = []) => ({
    where: (f: string, op: string, v: unknown) => query(col, [...filters, [f, op, v]]),
    get: async () => ({
      docs: [...store.keys()].filter((p) => p.startsWith(col + '/') && p.split('/').length === col.split('/').length + 1)
        .sort().map(snap).filter((s) => filters.every(([f, op, v]) => {
          const x = s.data()![f] as string;
          return op === '>=' ? x >= (v as string) : op === '<=' ? x <= (v as string) : x === v;
        })),
    }),
  });
  const db: ArtifactDb = {
    doc: (p) => ({
      get: async () => snap(p),
      set: async (d) => { store.set(p, JSON.parse(JSON.stringify(d))); },
      delete: async () => { store.delete(p); },
    }),
    collection: (c) => query(c),
  };
  return { db, store };
}

describe('artifact repo', () => {
  it('lists months across a year boundary', () => {
    expect(monthKeys('2026-11-20', '2027-01-03')).toEqual(['2026-11', '2026-12', '2027-01']);
  });

  it('round-trips per days in one month document and deletes blanks', async () => {
    const { db, store } = memDb();
    const r = makeArtifactRepo(db);
    await r.savePerDay('2026-11-02', [
      { date: '2026-11-02', lineId: 'sp-tt', workerIds: ['w1'], per: 120 },
      { date: '2026-11-02', lineId: 'sl2', workerIds: [], per: 99 },
    ]);
    await r.savePerDay('2026-12-01', [{ date: '2026-12-01', lineId: 'sl2', workerIds: [], per: 101 }]);
    await r.savePerDay('2026-11-02', [{ date: '2026-11-02', lineId: 'sl2', workerIds: [], per: null }]);
    expect([...store.keys()].sort()).toEqual(['perMonth/2026-11', 'perMonth/2026-12']);
    expect(await r.getPerEntries('2026-11-01', '2026-12-31')).toEqual([
      { date: '2026-11-02', lineId: 'sp-tt', workerIds: ['w1'], per: 120 },
      { date: '2026-12-01', lineId: 'sl2', workerIds: [], per: 101 },
    ]);
    expect(await r.getPerEntries('2026-11-03', '2026-11-30')).toEqual([]);
  });

  it('saves, filters and deletes lot days', async () => {
    const { db } = memDb();
    const r = makeArtifactRepo(db);
    await r.saveLotDay({ date: '2026-11-07', sent: 35, patrol: 0, fg: 1 });
    await r.saveLotDay({ date: '2026-11-09', sent: 19, patrol: 0, fg: 0 });
    await r.deleteLotDay('2026-11-09');
    expect(await r.getLotEntries('2026-11-01', '2026-11-30')).toEqual([{ date: '2026-11-07', sent: 35, patrol: 0, fg: 1, items: [] }]);
  });

  it('round-trips lot part numbers and absences', async () => {
    const { db } = memDb();
    const r = makeArtifactRepo(db);
    const item = { id: 'i1', partNo: 'P-100', kind: 'patrol' as const, note: 'scratch', images: ['u1'] };
    await r.saveLotDay({ date: '2026-11-07', sent: 3, patrol: 1, fg: 0, items: [item] });
    expect((await r.getLotEntries('2026-11-07', '2026-11-07'))[0].items).toEqual([item]);
    await r.saveAbsenceDay('2026-11-07', [{ workerId: 'w1', reason: 'leave', note: 'ลาป่วย' }]);
    expect(await r.getAbsences('2026-11-01', '2026-11-30')).toEqual([{ date: '2026-11-07', list: [{ workerId: 'w1', reason: 'leave', note: 'ลาป่วย' }] }]);
  });

  it('keeps ids on lines and filters summaries by month', async () => {
    const { db } = memDb();
    const r = makeArtifactRepo(db);
    await r.saveLine({ id: 'b', code: 'B', order: 2, setter: 'S', defaultWorkerIds: [], includeInTotal: true, active: true });
    await r.saveLine({ id: 'a', code: 'A', order: 1, setter: 'S', defaultWorkerIds: [], includeInTotal: true, active: true });
    expect((await r.listLines()).map((l) => l.id)).toEqual(['a', 'b']);
    await db.doc('monthlySummary/2025').set({ month: '2025', per: 124, lotSent: 8938, lotOut: 42 });
    await db.doc('monthlySummary/2026-01').set({ month: '2026-01', per: 128, lotSent: 566, lotOut: 1 });
    expect((await r.getMonthlySummaries('2026-01', '2026-12')).map((s) => s.month)).toEqual(['2026-01']);
    expect((await r.getMonthlySummaries('2025', '2025')).map((s) => s.per)).toEqual([124]);
  });

  it('finds records of a deleted worker and hands them to another', async () => {
    const { db, store } = memDb();
    const r = makeArtifactRepo(db);
    await r.saveLine({ id: 'sl1', code: 'SL1', order: 1, setter: 'A', defaultWorkerIds: ['w20'], includeInTotal: true, active: true });
    await r.savePerDay('2026-11-02', [{ date: '2026-11-02', lineId: 'sl1', workerIds: ['w20', 'w19'], per: 120 }]);
    await r.savePerDay('2026-12-01', [{ date: '2026-12-01', lineId: 'sl1', workerIds: ['w19', 'w20'], per: 110 }]);
    await r.saveAbsenceDay('2026-11-03', [{ workerId: 'w20', reason: 'leave', note: '' }]);
    expect((await r.workerRefs()).w20).toEqual({ count: 4, first: '2026-11-02', last: '2026-12-01', lineIds: ['sl1'] });

    expect(await r.replaceWorker('w20', 'w19')).toBe(4); // 2 per months, 1 absence month, 1 line
    const per = await r.getPerEntries('2026-11-01', '2026-12-31');
    expect(per.map((e) => e.workerIds)).toEqual([['w19'], ['w19']]); // no duplicate
    expect((await r.getAbsences('2026-11-01', '2026-11-30'))[0].list[0].workerId).toBe('w19');
    expect((await r.listLines())[0].defaultWorkerIds).toEqual(['w19']);
    expect((await r.workerRefs()).w20).toBeUndefined();

    await r.replaceWorker('w19', null);
    expect((await r.getPerEntries('2026-11-01', '2026-12-31')).map((e) => e.workerIds)).toEqual([[], []]);
    expect(await r.getAbsences('2026-11-01', '2026-11-30')).toEqual([]);
    expect(store.size).toBeGreaterThan(0);
  });

  it('keeps per-worker notes, and keeps them with their worker when ids change', async () => {
    const { db } = memDb();
    const r = makeArtifactRepo(db);
    await r.savePerDay('2026-11-02', [
      { date: '2026-11-02', lineId: 'sl1', workerIds: ['w20', 'w19'], per: 120, notes: [' ป่วยบ่าย ', ''] },
      { date: '2026-11-02', lineId: 'sl2', workerIds: ['w1'], per: 100, notes: [''] },
    ]);
    let per = await r.getPerEntries('2026-11-02', '2026-11-02');
    expect(per.find((e) => e.lineId === 'sl1')!.notes).toEqual(['ป่วยบ่าย', '']);
    expect(per.find((e) => e.lineId === 'sl2')!.notes).toBeUndefined();
    await r.replaceWorker('w20', null);
    per = await r.getPerEntries('2026-11-02', '2026-11-02');
    expect(per.find((e) => e.lineId === 'sl1')).toMatchObject({ workerIds: ['w19'] });
    expect(per.find((e) => e.lineId === 'sl1')!.notes).toBeUndefined();
  });

  it('an uploaded %OTD month replaces only that month; history fills only empty months', async () => {
    const { db } = memDb();
    const r = makeArtifactRepo(db);
    await r.saveOtdUpload({ month: '2026-10', pct: 0.95, rows: [], source: 'upload' }, []);
    const added = await r.saveOtdUpload({ month: '2026-11', pct: 0.58, rows: [], source: 'upload' },
      [{ month: '2026-09', pct: 0.91 }, { month: '2026-10', pct: 0.5 }]);
    expect(added).toEqual(['2026-09']);
    const all = await r.getOtdMonths('2026-01', '2026-12');
    expect(all.map((m) => [m.month, m.pct, m.source])).toEqual([['2026-09', 0.91, 'history'], ['2026-10', 0.95, 'upload'], ['2026-11', 0.58, 'upload']]);
    await r.saveOtdUpload({ month: '2026-11', pct: 0.6, rows: [], source: 'upload' }, []);
    expect((await r.getOtdMonths('2026-11', '2026-11'))[0].pct).toBe(0.6);
    expect((await r.getOtdMonths('2026-10', '2026-10'))[0].pct).toBe(0.95);
  });
  it('stores monthly production figures one document per month', async () => {
    const { db, store } = memDb();
    const r = makeArtifactRepo(db);
    const o = { month: '2026-11', prodPlan: 70123, prodActual: 42144, matStd: 48.15, matAct: 48.19, processCost: null, headcount: null, expense: null, prodForHead: null };
    await r.saveOpsMonth(o);
    expect(store.has('opsMonthly/2026-11')).toBe(true);
    expect(await r.getOpsMonths('2026-01', '2026-12')).toEqual([expect.objectContaining(o)]);
  });
});
