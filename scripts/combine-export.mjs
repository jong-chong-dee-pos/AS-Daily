// Turns a folder of <collection>/<id>.json files (saved from the artifact database)
// into one [{path, data}] file for import-artifact.mjs or Settings > นำเข้าข้อมูล.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [dir, out] = process.argv.slice(2);
const docs = readdirSync(dir).flatMap((c) => readdirSync(join(dir, c)).filter((f) => f.endsWith('.json'))
  .map((f) => ({ path: `${c}/${f.slice(0, -5)}`, data: JSON.parse(readFileSync(join(dir, c, f), 'utf8')) })));
writeFileSync(out, JSON.stringify(docs));
console.log(`${docs.length} documents -> ${out}`);
