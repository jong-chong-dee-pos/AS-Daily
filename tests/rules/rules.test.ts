// Runs against the Firestore emulator: npm run test:rules
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

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
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, role] of [['ad', 'admin'], ['ed', 'editor'], ['vw', 'viewer']]) {
      await setDoc(doc(db, 'users', uid), { name: uid, email: `${uid}@x`, role });
    }
    await setDoc(doc(db, 'costMonthly', '2026-11'), { month: '2026-11' });
  });
});

const as = (uid: string) => env.authenticatedContext(uid).firestore();
const per = (by: string) => ({ entries: { '2026-11-03_sl1': { workerIds: [], per: 120 } }, updatedBy: by });

describe('firestore rules', () => {
  it('unauthenticated read is denied', async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'perMonth', 'x')));
  });
  it('signed-in user without a role is denied', async () => {
    await assertFails(getDoc(doc(as('stranger'), 'costMonthly', '2026-11')));
  });
  it('viewer reads costs but cannot write data', async () => {
    await assertSucceeds(getDoc(doc(as('vw'), 'costMonthly', '2026-11')));
    await assertFails(setDoc(doc(as('vw'), 'perMonth', '2026-11'), per('vw')));
  });
  it('editor writes data stamped with own uid only', async () => {
    await assertSucceeds(setDoc(doc(as('ed'), 'perMonth', '2026-11'), per('ed')));
    await assertFails(setDoc(doc(as('ed'), 'perMonth', '2026-11'), per('ad')));
  });
  it('editor cannot change settings or accounts; admin can', async () => {
    for (const c of ['lines', 'targets', 'users', 'workers']) {
      await assertFails(setDoc(doc(as('ed'), c, 'x'), { a: 1 }));
      await assertSucceeds(setDoc(doc(as('ad'), c, 'x'), { a: 1 }));
    }
  });
  it('viewer cannot write images; editor can, within size', async () => {
    await assertFails(setDoc(doc(as('vw'), 'images', 'i1'), { data: 'x', updatedBy: 'vw' }));
    await assertSucceeds(setDoc(doc(as('ed'), 'images', 'i1'), { data: 'x', updatedBy: 'ed' }));
    await assertFails(setDoc(doc(as('ed'), 'images', 'i2'), { data: 'x'.repeat(950000), updatedBy: 'ed' }));
  });
  it('user cannot raise own role', async () => {
    await assertFails(setDoc(doc(as('vw'), 'users', 'vw'), { name: 'vw', email: 'vw@x', role: 'admin' }));
  });
});
