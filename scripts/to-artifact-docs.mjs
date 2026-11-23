// Convert parse_xlsx.py JSON into artifact-db documents: [{ path, data }].
// Usage: node scripts/to-artifact-docs.mjs import.json > docs.json
import { readFileSync } from 'node:fs';

export function toArtifactDocs(d) {
  const docs = [];
  const add = (path, data) => docs.push({ path, data });
  const strip = ({ id: _id, ...rest }) => rest;
  d.lines.forEach((l) => add(`lines/${l.id}`, strip(l)));
  d.workers.forEach((w) => add(`workers/${w.id}`, strip(w)));
  const per = {}, lot = {};
  for (const e of d.per) (per[e.date.slice(0, 7)] ??= {})[`${e.date}_${e.lineId}`] = { workerIds: e.workerIds, per: e.per };
  for (const e of d.lot) (lot[e.date.slice(0, 7)] ??= {})[e.date] = { sent: e.sent, patrol: e.patrol, fg: e.fg };
  Object.entries(per).forEach(([m, entries]) => add(`perMonth/${m}`, { entries }));
  Object.entries(lot).forEach(([m, days]) => add(`lotMonth/${m}`, { days }));
  d.cost.forEach((c) => add(`costMonthly/${c.month}`, c));
  d.targets.forEach((t) => add(`targets/${t.month}`, t));
  d.summaries.forEach((s) => add(`monthlySummary/${s.month}`, s));
  return docs;
}

if (process.argv[2]) console.log(JSON.stringify(toArtifactDocs(JSON.parse(readFileSync(process.argv[2], 'utf8')))));
