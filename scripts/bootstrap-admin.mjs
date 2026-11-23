// First admin: while no one has the admin role yet and exactly one sign-in account
// exists (the owner, created in Firebase console > Authentication > Add user),
// that account becomes admin. Does nothing once an admin exists. Safe on every deploy.
// GOOGLE_APPLICATION_CREDENTIALS=sa.json node scripts/bootstrap-admin.mjs <projectId>
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const projectId = process.argv[2];
const app = initializeApp({ projectId });
const db = getFirestore(app);
if (!(await db.collection('users').where('role', '==', 'admin').limit(1).get()).empty) {
  console.log('bootstrap-admin: an admin already exists'); process.exit(0);
}
const { users } = await getAuth(app).listUsers(2);
if (users.length !== 1) { console.log(`bootstrap-admin: expected exactly 1 account, found ${users.length}; skipped`); process.exit(0); }
const u = users[0];
await db.collection('users').doc(u.uid).set({
  name: u.displayName || (u.email ?? 'admin').split('@')[0], email: u.email ?? '', role: 'admin',
  updatedBy: 'bootstrap', updatedAt: FieldValue.serverTimestamp(),
});
console.log('bootstrap-admin: admin role granted to the only account');
