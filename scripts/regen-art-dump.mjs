// Dumps every Asset Atlas entry (spec + prompt + 1× procedural render) to art/regen/specs.json for scripts/regen-art.py.
//   npm run dev   (another terminal)        node scripts/regen-art-dump.mjs [--url http://localhost:5173/]
// Uses the installed Microsoft Edge (playwright-core, no browser download).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const i = process.argv.indexOf('--url');
const url = i > 0 ? process.argv[i + 1] : 'http://localhost:5173/';

const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage();
await page.goto(url + (url.includes('?') ? '&' : '?') + 'export');
await page.waitForFunction(() => window.__totRegen, null, { timeout: 120000 });
const specs = await page.evaluate(() => window.__totRegen());
await browser.close();

const out = path.join(root, 'art/regen/specs.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(specs, null, 1) + '\n');
const by = {};
for (const s of specs) by[s.category] = (by[s.category] ?? 0) + 1;
console.log(`${specs.length} assets -> ${path.relative(root, out)}`, by);
