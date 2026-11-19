// Inline the built JS and CSS into one HTML file for publishing as a Claude artifact.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] ?? 'dist-artifact';
let html = readFileSync(join(dir, 'artifact.html'), 'utf8');
html = html.replace(/<script type="module" crossorigin src="\.\/([^"]+)"><\/script>/g, (_, f) =>
  `<script type="module">${readFileSync(join(dir, f), 'utf8').replace(/<\/script/gi, '<\\/script').replace(/\uFFFD/g, '\\uFFFD')}</script>`);
html = html.replace(/<link rel="stylesheet" crossorigin href="\.\/([^"]+)">/g, (_, f) =>
  `<style>${readFileSync(join(dir, f), 'utf8')}</style>`);
if (/src="\.\/assets|href="\.\/assets/.test(html)) throw new Error('unresolved asset reference left in HTML');
writeFileSync(join(dir, 'index.html'), html);
console.log(`${join(dir, 'index.html')}: ${(html.length / 1024).toFixed(0)} KiB`);
