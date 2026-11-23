// Runs against the Firestore emulator: npm run test:rules
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, type Firestore } from 'firebase/firestore';
import { makeRepo } from '../../src/data/repo';

let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-as-daily',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled((ctx) =>
    setDoc(doc(ctx.firestore() as unknown as Firestore, 'users', 'ed'), { name: 'ed', email: 'e@x', role: 'editor' }));
});
const repo = () => makeRepo(env.authenticatedContext('ed').firestore() as unknown as Firestore, () => 'ed');

describe('repo', () => {
  it('stores a month per document and stamps the writer', async () => {
    await repo().savePerDay('2026-11-03', [{ date: '2026-11-03', lineId: 'sl1', workerIds: [], per: 120 }]);
    let snap: unknown;
    await env.withSecurityRulesDisabled(async (ctx) => {
      const { getDoc } = await import('firebase/firestore');
      snap = (await getDoc(doc(ctx.firestore() as unknown as Firestore, 'perMonth', '2026-11'))).data();
    });
    expect(snap).toMatchObject({ updatedBy: 'ed', entries: { '2026-11-03_sl1': { per: 120 } } });
  });
  it('imports exported documents', async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore() as unknown as Firestore, 'users', 'ad'), { name: 'ad', email: 'a@x', role: 'admin' }));
    const r = makeRepo(env.authenticatedContext('ad').firestore() as unknown as Firestore, () => 'ad');
    await r.importDocs!([{ path: 'lotMonth/2026-10', data: { days: { '2026-10-02': { sent: 9, patrol: 0, fg: 1, items: [] } }, updatedAt: 'old' } },
      { path: 'lines/sl1', data: { name: 'SL1', order: 1, active: true } }]);
    expect(await r.getLotEntries('2026-10-01', '2026-10-31')).toEqual([{ date: '2026-10-02', sent: 9, patrol: 0, fg: 1, items: [] }]);
    expect((await r.listLines()).map((l) => l.name)).toEqual(['SL1']);
  });
  it('saving the same day twice overwrites, no duplicates', async () => {
    const r = repo();
    await r.savePerDay('2026-11-03', [{ date: '2026-11-03', lineId: 'sl1', workerIds: ['w1'], per: 100 }]);
    await r.savePerDay('2026-11-03', [{ date: '2026-11-03', lineId: 'sl1', workerIds: ['w2'], per: 130 }]);
    const got = await r.getPerEntries('2026-11-01', '2026-11-30');
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({ per: 130, workerIds: ['w2'] });
  });
  it('clearing a value deletes the entry', async () => {
    const r = repo();
    await r.savePerDay('2026-11-03', [{ date: '2026-11-03', lineId: 'sl1', workerIds: [], per: 100 }]);
    await r.savePerDay('2026-11-03', [{ date: '2026-11-03', lineId: 'sl1', workerIds: [], per: null }]);
    expect(await r.getPerEntries('2026-11-01', '2026-11-30')).toHaveLength(0);
  });
  it('date range is inclusive and excludes the next month', async () => {
    const r = repo();
    for (const d of ['2026-10-31', '2026-11-01', '2026-11-30', '2026-12-01']) {
      await r.saveLotDay({ date: d, sent: 1, patrol: 0, fg: 0 });
    }
    const got = await r.getLotEntries('2026-11-01', '2026-11-30');
    expect(got.map((e) => e.date).sort()).toEqual(['2026-11-01', '2026-11-30']);
  });
});
