import type { ArtifactDb } from '../../src/data/artifactRepo';

/** In-memory stand-in for the artifact db (paths → bodies), nested collections included. */
export function memDb() {
  const store = new Map<string, Record<string, unknown>>();
  const snap = (path: string) => ({ id: path.split('/').pop()!, exists: store.has(path), data: () => store.get(path) });
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
    doc: (p) => ({ get: async () => snap(p), set: async (d) => { store.set(p, JSON.parse(JSON.stringify(d))); }, delete: async () => { store.delete(p); } }),
    collection: (c) => query(c),
  };
  return { db, store };
}
