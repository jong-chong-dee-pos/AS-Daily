import type { AppUser, Role, Absence, AbsenceDay, CostMonth, Line, LotEntry, MonthlySummary, PerEntry, Setter, Target, TargetLabels, Worker } from '../types';

/** The subset of the Claude artifact `db` capability this app uses. */
export interface ArtifactDocSnap { id: string; exists: boolean; data(): Record<string, unknown> | undefined }
export interface ArtifactDoc { get(): Promise<ArtifactDocSnap>; set(d: Record<string, unknown>): Promise<void>; delete(): Promise<void> }
export interface ArtifactQuery {
  where(field: string, op: string, value: unknown): ArtifactQuery;
  get(): Promise<{ docs: ArtifactDocSnap[] }>;
}
export interface ArtifactDb {
  doc(path: string): ArtifactDoc;
  collection(path: string): ArtifactQuery;
}

type PerMonthDoc = { entries?: Record<string, Omit<PerEntry, 'date' | 'lineId'>> };
type LotMonthDoc = { days?: Record<string, Omit<LotEntry, 'date'>> };
type AbsenceMonthDoc = { days?: Record<string, Absence[]> };
export interface WorkerRef { count: number; first: string; last: string; lineIds?: string[] }

/** YYYY-MM keys from `from` to `to` inclusive (both YYYY-MM-DD). */
export function monthKeys(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.slice(0, 7).split('-').map(Number);
  const end = to.slice(0, 7);
  for (;;) {
    const k = `${y}-${String(m).padStart(2, '0')}`;
    if (k > end) return out;
    out.push(k);
    if (++m > 12) { m = 1; y++; }
  }
}

/**
 * Repo backed by the Claude artifact database (single-account deployment).
 * Daily rows are grouped one document per month (perMonth/YYYY-MM, lotMonth/YYYY-MM)
 * to keep the document count small; everything else mirrors the Firestore layout.
 */
export function makeArtifactRepo(db: ArtifactDb, uploadImage?: (f: Blob) => Promise<string>) {
  const stamp = () => ({ updatedAt: new Date().toISOString() });
  const all = async <T>(name: string): Promise<T[]> =>
    (await db.collection(name).get()).docs.map((d) => ({ ...d.data(), id: d.id }) as T);
  const between = async <T>(name: string, from: string, to: string): Promise<T[]> =>
    (await db.collection(name).where('month', '>=', from).where('month', '<=', to).get()).docs.map((d) => d.data() as T);
  const read = async <T>(path: string): Promise<T> => ((await db.doc(path).get()).data() ?? {}) as T;
  const strip = <T extends { id: string }>({ id: _id, ...rest }: T) => rest;

  const repo = {
    listLines: async () => (await all<Line>('lines')).sort((a, b) => a.order - b.order),
    listWorkers: () => all<Worker>('workers'),
    listTargets: () => all<Target>('targets'),
    listSetters: async () => (await all<Setter>('setters')).sort((a, b) => a.order - b.order),
    saveSetter: (s: Setter) => db.doc(`setters/${s.id}`).set({ ...strip(s), ...stamp() }),
    deleteSetter: (id: string) => db.doc(`setters/${id}`).delete(),
    getTargetLabels: async () => { const d = (await db.doc('settings/targetLabels').get()).data(); return d ? ({ per: String(d.per ?? ''), lot: String(d.lot ?? '') }) as TargetLabels : null; },
    saveTargetLabels: (l: TargetLabels) => db.doc('settings/targetLabels').set({ ...l, ...stamp() }),
    listUsers: async (): Promise<AppUser[]> => [],

    async getPerEntries(from: string, to: string): Promise<PerEntry[]> {
      const docs = await Promise.all(monthKeys(from, to).map((m) => read<PerMonthDoc>(`perMonth/${m}`)));
      return docs.flatMap((d) => Object.entries(d.entries ?? {}).map(([k, v]) => {
        const [date, lineId] = [k.slice(0, 10), k.slice(11)];
        return { date, lineId, workerIds: v.workerIds, per: v.per };
      })).filter((e) => e.date >= from && e.date <= to).sort((a, b) => a.date.localeCompare(b.date));
    },
    async savePerDay(date: string, rows: (Omit<PerEntry, 'per'> & { per: number | null })[]) {
      const path = `perMonth/${date.slice(0, 7)}`;
      const entries = { ...(await read<PerMonthDoc>(path)).entries };
      for (const r of rows) {
        const k = `${date}_${r.lineId}`;
        if (r.per === null) delete entries[k];
        else entries[k] = { workerIds: r.workerIds, per: r.per };
      }
      await db.doc(path).set({ entries, ...stamp() });
    },

    async getLotEntries(from: string, to: string): Promise<LotEntry[]> {
      const docs = await Promise.all(monthKeys(from, to).map((m) => read<LotMonthDoc>(`lotMonth/${m}`)));
      return docs.flatMap((d) => Object.entries(d.days ?? {}).map(([date, v]) => ({ date, sent: v.sent, patrol: v.patrol, fg: v.fg, items: v.items ?? [] })))
        .filter((e) => e.date >= from && e.date <= to).sort((a, b) => a.date.localeCompare(b.date));
    },
    async saveLotDay(e: LotEntry) {
      const path = `lotMonth/${e.date.slice(0, 7)}`;
      const days = { ...(await read<LotMonthDoc>(path)).days, [e.date]: { sent: e.sent, patrol: e.patrol, fg: e.fg, items: e.items ?? [] } };
      await db.doc(path).set({ days, ...stamp() });
    },
    async deleteLotDay(date: string) {
      const path = `lotMonth/${date.slice(0, 7)}`;
      const days = { ...(await read<LotMonthDoc>(path)).days };
      delete days[date];
      await db.doc(path).set({ days, ...stamp() });
    },

    async getAbsences(from: string, to: string): Promise<AbsenceDay[]> {
      const docs = await Promise.all(monthKeys(from, to).map((m) => read<AbsenceMonthDoc>(`absenceMonth/${m}`)));
      return docs.flatMap((d) => Object.entries(d.days ?? {}).map(([date, list]) => ({ date, list })))
        .filter((e) => e.date >= from && e.date <= to).sort((a, b) => a.date.localeCompare(b.date));
    },
    async saveAbsenceDay(date: string, list: Absence[]) {
      const path = `absenceMonth/${date.slice(0, 7)}`;
      const days = { ...(await read<AbsenceMonthDoc>(path)).days };
      if (list.length) days[date] = list; else delete days[date];
      await db.doc(path).set({ days, ...stamp() });
    },
    /**
     * Every worker id that records point at (daily % PER rows, absences, line defaults),
     * with how many records and the first/last date. Used to find names that no longer exist.
     */
    async workerRefs(): Promise<Record<string, WorkerRef>> {
      const out: Record<string, WorkerRef> = {};
      const add = (id: string, date?: string, lineId?: string) => {
        if (!id) return;
        const r = (out[id] ??= { count: 0, first: '', last: '', lineIds: [] });
        r.count++;
        if (lineId && !r.lineIds!.includes(lineId)) r.lineIds!.push(lineId);
        if (date) { if (!r.first || date < r.first) r.first = date; if (date > r.last) r.last = date; }
      };
      const [per, abs, lines] = await Promise.all([db.collection('perMonth').get(), db.collection('absenceMonth').get(), repo.listLines()]);
      for (const d of per.docs) for (const [k, v] of Object.entries((d.data() as PerMonthDoc | undefined)?.entries ?? {})) for (const id of v.workerIds ?? []) add(id, k.slice(0, 10), k.slice(11));
      for (const d of abs.docs) for (const [date, list] of Object.entries((d.data() as AbsenceMonthDoc | undefined)?.days ?? {})) for (const a of list) add(a.workerId, date);
      for (const l of lines) for (const id of l.defaultWorkerIds) add(id, undefined, l.id);
      return out;
    },
    /**
     * Points every record of worker `from` at worker `to`, or removes `from` from them
     * when `to` is null. Returns how many documents were rewritten.
     */
    async replaceWorker(from: string, to: string | null): Promise<number> {
      const swap = (ids: string[]) => [...new Set(ids.flatMap((id) => (id === from ? (to ? [to] : []) : [id])))];
      let n = 0;
      for (const d of (await db.collection('perMonth').get()).docs) {
        const entries = { ...(d.data() as PerMonthDoc | undefined)?.entries };
        let changed = false;
        for (const [k, v] of Object.entries(entries)) {
          if (!(v.workerIds ?? []).includes(from)) continue;
          entries[k] = { ...v, workerIds: swap(v.workerIds) }; changed = true;
        }
        if (changed) { await db.doc(`perMonth/${d.id}`).set({ entries, ...stamp() }); n++; }
      }
      for (const d of (await db.collection('absenceMonth').get()).docs) {
        const days = { ...(d.data() as AbsenceMonthDoc | undefined)?.days };
        let changed = false;
        for (const [date, list] of Object.entries(days)) {
          if (!list.some((a) => a.workerId === from)) continue;
          const next = to ? list.map((a) => (a.workerId === from ? { ...a, workerId: to } : a)) : list.filter((a) => a.workerId !== from);
          if (next.length) days[date] = next; else delete days[date];
          changed = true;
        }
        if (changed) { await db.doc(`absenceMonth/${d.id}`).set({ days, ...stamp() }); n++; }
      }
      for (const l of await repo.listLines()) {
        if (!l.defaultWorkerIds.includes(from)) continue;
        await repo.saveLine({ ...l, defaultWorkerIds: swap(l.defaultWorkerIds) }); n++;
      }
      return n;
    },
    saveSummary: (s: MonthlySummary) => db.doc(`monthlySummary/${s.month}`).set({ ...s, ...stamp() }),
    deleteSummary: (month: string) => db.doc(`monthlySummary/${month}`).delete(),
    deleteLine: (id: string) => db.doc(`lines/${id}`).delete(),
    deleteWorker: (id: string) => db.doc(`workers/${id}`).delete(),
    deleteTarget: (month: string) => db.doc(`targets/${month}`).delete(),
    uploadImage,

    getCostMonths: (from: string, to: string) => between<CostMonth>('costMonthly', from, to),
    saveCostMonth: (c: CostMonth) => db.doc(`costMonthly/${c.month}`).set({ ...c, ...stamp() }),
    getMonthlySummaries: (from: string, to: string) => between<MonthlySummary>('monthlySummary', from, to),

    saveLine: (l: Line) => db.doc(`lines/${l.id}`).set({ ...strip(l), ...stamp() }),
    saveWorker: (w: Worker) => db.doc(`workers/${w.id}`).set({ ...strip(w), ...stamp() }),
    saveTarget: (t: Target) => db.doc(`targets/${t.month}`).set({ ...t, ...stamp() }),
    saveUser: async (_u: AppUser) => {},
    saveUserRole: async (_t: string, _r: Role, _n: string, _e: string) => {},
  };
  return repo;
}

export type BaseRepo = ReturnType<typeof makeArtifactRepo>;
