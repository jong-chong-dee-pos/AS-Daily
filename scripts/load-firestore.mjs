// Write the JSON from parse_xlsx.py into Firestore.
// Emulator: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/load-firestore.mjs import.json --project demo-as-daily
// Production: GOOGLE_APPLICATION_CREDENTIALS=service-account.json node scripts/load-firestore.mjs import.json --project <id>
import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const [file, flag, projectId] = process.argv.slice(2);
if (!file || flag !== '--project' || !projectId) {
  console.error('usage: node scripts/load-firestore.mjs import.json --project <id>');
  process.exit(1);
}
const data = JSON.parse(readFileSync(file, 'utf8'));
const db = getFirestore(initializeApp({ projectId }));
const stamp = { updatedBy: 'import', updatedAt: FieldValue.serverTimestamp() };

const plan = [
  ['lines', data.lines, (x) => x.id, ({ id: _id, ...x }) => x],
  ['workers', data.workers, (x) => x.id, ({ id: _id, ...x }) => x],
  ['perDaily', data.per, (x) => `${x.date}_${x.lineId}`],
  ['lotDaily', data.lot, (x) => x.date],
  ['costMonthly', data.cost, (x) => x.month],
  ['targets', data.targets, (x) => x.month],
  ['monthlySummary', data.summaries, (x) => x.month],
];

for (const [name, items, id, body = (x) => x] of plan) {
  for (let i = 0; i < items.length; i += 400) {
    const batch = db.batch();
    for (const x of items.slice(i, i + 400)) batch.set(db.collection(name).doc(id(x)), { ...body(x), ...stamp });
    await batch.commit();
  }
  console.log(`${name}: ${items.length}`);
}
