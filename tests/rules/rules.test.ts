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
    // Per-area access set by an admin.
    await setDoc(doc(db, 'users', 'no'), { name: 'no', email: 'no@x', role: 'viewer', areas: { assembly: 'none', partWarehouse: 'none' } });
    await setDoc(doc(db, 'users', 'pw'), { name: 'pw', email: 'pw@x', role: 'editor', areas: { assembly: 'view', partWarehouse: 'edit' } });
    await setDoc(doc(db, 'users', 'ae'), { name: 'ae', email: 'ae@x', role: 'editor', areas: { assembly: 'edit', partWarehouse: 'view' } });
    await setDoc(doc(db, 'areas', 'partWarehouse', 'stock', '2026-11'), { month: '2026-11' });
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
  it('monthly production figures and %OTD: editors write stamped, viewers only read', async () => {
    for (const col of ['opsMonthly', 'otdMonthly']) {
      await assertSucceeds(setDoc(doc(as('ed'), col, '2026-11'), { month: '2026-11', updatedBy: 'ed' }));
      await assertFails(setDoc(doc(as('ed'), col, '2026-10'), { month: '2026-10', updatedBy: 'ad' }));
      await assertFails(setDoc(doc(as('vw'), col, '2026-09'), { month: '2026-09', updatedBy: 'vw' }));
      await assertSucceeds(getDoc(doc(as('vw'), col, '2026-11')));
    }
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

  it('user without Assembly access reads no Assembly data or settings', async () => {
    for (const c of ['costMonthly', 'perMonth', 'lines', 'settings', 'opsMonthly']) await assertFails(getDoc(doc(as('no'), c, '2026-11')));
    await assertSucceeds(getDoc(doc(as('no'), 'users', 'no')));
  });
  it('Assembly access comes from the per-area setting, not the role', async () => {
    // role editor but Assembly view-only: reads, cannot write
    await assertSucceeds(getDoc(doc(as('pw'), 'costMonthly', '2026-11')));
    await assertFails(setDoc(doc(as('pw'), 'perMonth', '2026-11'), per('pw')));
    await assertSucceeds(setDoc(doc(as('ae'), 'perMonth', '2026-11'), per('ae')));
  });
  it('Part Warehouse data is separate and needs its own access', async () => {
    const pwDoc = (uid: string) => doc(as(uid), 'areas', 'partWarehouse', 'stock', '2026-11');
    await assertFails(getDoc(pwDoc('vw'))); // no entry: closed by default
    await assertFails(getDoc(pwDoc('ed')));
    await assertSucceeds(getDoc(pwDoc('ae')));
    await assertFails(setDoc(pwDoc('ae'), { month: '2026-11', updatedBy: 'ae' }));
    await assertSucceeds(setDoc(pwDoc('pw'), { month: '2026-11', updatedBy: 'pw' }));
    await assertFails(setDoc(pwDoc('pw'), { month: '2026-11', updatedBy: 'ad' }));
    await assertSucceeds(setDoc(pwDoc('ad'), { month: '2026-11', updatedBy: 'ad' }));
  });
  it('Assembly data cannot be reached through the areas path', async () => {
    await assertFails(setDoc(doc(as('ad'), 'areas', 'assembly', 'perMonth', '2026-11'), per('ad')));
  });
  it('users read only their own account; admins read all', async () => {
    await assertSucceeds(getDoc(doc(as('vw'), 'users', 'vw')));
    await assertFails(getDoc(doc(as('vw'), 'users', 'ad')));
    await assertSucceeds(getDoc(doc(as('ad'), 'users', 'vw')));
  });
  it('user cannot give themselves area access', async () => {
    await assertFails(setDoc(doc(as('vw'), 'users', 'vw'), { name: 'vw', email: 'vw@x', role: 'viewer', areas: { assembly: 'edit' } }));
    await assertFails(setDoc(doc(as('pw'), 'users', 'pw'), { name: 'pw', email: 'pw@x', role: 'editor', areas: { assembly: 'edit', partWarehouse: 'edit' } }));
  });

  it('Part Warehouse targets and earlier-year columns: its users read, only admins change', async () => {
    const t = (uid: string) => doc(as(uid), 'areas', 'partWarehouse', 'settings', 'targets');
    await assertSucceeds(setDoc(t('ad'), { missingMax: 6, updatedBy: 'ad' }));
    await assertFails(setDoc(t('pw'), { missingMax: 9, updatedBy: 'pw' })); // data-entry user of the area
    await assertSucceeds(getDoc(t('pw')));
    await assertFails(getDoc(t('vw')));
  });
  it('Part Warehouse monthly figures and plan: its data-entry users write stamped', async () => {
    for (const col of ['monthly', 'plan']) {
      await assertSucceeds(setDoc(doc(as('pw'), 'areas', 'partWarehouse', col, '2026-11'), { month: '2026-11', updatedBy: 'pw' }));
      await assertFails(setDoc(doc(as('ae'), 'areas', 'partWarehouse', col, '2026-11'), { month: '2026-11', updatedBy: 'ae' }));
    }
  });
});
