// Dumps every Asset Atlas entry (spec + prompt + 1× procedural render) to art/regen/specs.json for scripts/regen-art.py.
//   npm run dev   (another terminal)        node scripts/regen-art-dump.mjs [--url http://localhost:5173/]
// --world limits to terrain/overlays/props. --scale 4 makes layout guides at 4x.
// --out art/world/atlas.json sets a workspace-relative destination.
// Uses the installed Microsoft Edge (playwright-core, no browser download).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const url = arg('--url', 'http://127.0.0.1:5173/');
const scale = Number(arg('--scale', '1'));
if (!Number.isInteger(scale) || scale < 1 || scale > 4) throw new Error('--scale must be an integer from 1 to 4');
const out = path.resolve(root, arg('--out', 'art/regen/specs.json'));
const relative = path.relative(root, out);
if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('--out must be inside this project');

const browser = await chromium.launch({ channel: 'msedge' });
let specs;
try {
  const page = await browser.newPage();
  await page.goto(url + (url.includes('?') ? '&' : '?') + 'export');
  await page.waitForFunction(() => window.__totRegen, null, { timeout: 120000 });
  specs = await page.evaluate(([s, world]) => window.__totRegen(s, world), [scale, process.argv.includes('--world')]);
} finally {
  await browser.close();
}

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(specs, null, 1) + '\n');
const by = {};
for (const s of specs) by[s.category] = (by[s.category] ?? 0) + 1;
console.log(`${specs.length} assets -> ${path.relative(root, out)}`, by);
