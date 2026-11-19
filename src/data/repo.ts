import {
  collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, where, writeBatch,
  type Firestore,
} from 'firebase/firestore';
import type {
  AppUser, CostMonth, Line, LotEntry, MonthlySummary, PerEntry, Role, Target, Worker,
} from '../types';

/** Data access for one signed-in user. `uid` is stamped on every write as updatedBy. */
export function makeRepo(db: Firestore, uid: () => string) {
  const stamp = () => ({ updatedBy: uid(), updatedAt: serverTimestamp() });
  const all = async <T>(name: string): Promise<T[]> =>
    (await getDocs(collection(db, name))).docs.map((d) => ({ id: d.id, ...d.data() }) as T);
  const between = async <T>(name: string, field: string, from: string, to: string): Promise<T[]> =>
    (await getDocs(query(collection(db, name), where(field, '>=', from), where(field, '<=', to))))
      .docs.map((d) => d.data() as T);
  const strip = <T extends object>(o: T) => {
    const { id: _id, ...rest } = o as T & { id?: string };
    return rest;
  };

  return {
    listLines: async () => (await all<Line>('lines')).sort((a, b) => a.order - b.order),
    listWorkers: () => all<Worker>('workers'),
    listTargets: () => all<Target>('targets'),
    listUsers: async () => (await all<AppUser & { id: string }>('users')).map(({ id, ...u }) => ({ ...u, uid: id })),

    getPerEntries: (from: string, to: string) => between<PerEntry>('perDaily', 'date', from, to),
    /** Replaces the given day's rows; a row with per === null deletes that line's entry. */
    async savePerDay(date: string, rows: (Omit<PerEntry, 'per'> & { per: number | null })[]) {
      const batch = writeBatch(db);
      for (const r of rows) {
        const ref = doc(db, 'perDaily', `${date}_${r.lineId}`);
        if (r.per === null) batch.delete(ref);
        else batch.set(ref, { date, lineId: r.lineId, workerIds: r.workerIds, per: r.per, ...stamp() });
      }
      await batch.commit();
    },

    getLotEntries: (from: string, to: string) => between<LotEntry>('lotDaily', 'date', from, to),
    saveLotDay: (e: LotEntry) => setDoc(doc(db, 'lotDaily', e.date), { ...e, ...stamp() }),
    deleteLotDay: (date: string) => deleteDoc(doc(db, 'lotDaily', date)),

    getCostMonths: (fromMonth: string, toMonth: string) => between<CostMonth>('costMonthly', 'month', fromMonth, toMonth),
    saveCostMonth: (c: CostMonth) => setDoc(doc(db, 'costMonthly', c.month), { ...c, ...stamp() }),

    getMonthlySummaries: (fromMonth: string, toMonth: string) =>
      between<MonthlySummary>('monthlySummary', 'month', fromMonth, toMonth),

    saveLine: (l: Line) => setDoc(doc(db, 'lines', l.id), { ...strip(l), ...stamp() }),
    saveWorker: (w: Worker) => setDoc(doc(db, 'workers', w.id), { ...strip(w), ...stamp() }),
    saveTarget: (t: Target) => setDoc(doc(db, 'targets', t.month), { ...t, ...stamp() }),
    saveUser: (u: AppUser) => setDoc(doc(db, 'users', u.uid), { name: u.name, email: u.email, role: u.role, ...stamp() }),
    saveUserRole: (target: string, role: Role, name: string, email: string) =>
      setDoc(doc(db, 'users', target), { name, email, role, ...stamp() }),
  };
}

export type Repo = ReturnType<typeof makeRepo>;
