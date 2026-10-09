// Writes PNGs of the procedural ("vector") art for the buildings, kids and monsters into the repo.
//
//   npm run dev                                     # in another terminal
//   npm i -D playwright && npx playwright install chromium   # once
//   node scripts/export-art.mjs [--url http://localhost:5173/] [--scale 4] [--all-sheets] [--buildings 2] [--force]
//
// public/assets/<group>/<key>.png  game-ready 1× files, registered in public/assets/manifest.json.
//                                  Existing files are KEPT (they may be your replacement art) unless --force.
// art/reference/<group>/…          hi-res renders + specs.json (sizes, anchors, AI prompts) to feed an image
//                                  generator: one pose per kid/costume/monster, full sheets for the base kids and
//                                  monsters (--all-sheets adds the costume sheets, --buildings N adds N× buildings).
//                                  Always refreshed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : d;
};
const url = arg('--url', 'http://localhost:5173/');
const scale = Number(arg('--scale', '4'));
const force = process.argv.includes('--force');
const allSheets = process.argv.includes('--all-sheets');
const buildings = Number(arg('--buildings', '0'));

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('This script needs Playwright:  npm i -D playwright && npx playwright install chromium');
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(url + (url.includes('?') ? '&' : '?') + 'export');
await page.waitForFunction(() => window.__totExport, null, { timeout: 120000 });
const files = await page.evaluate(([s, a, b]) => window.__totExport(s, a ? 'all' : 'base', b), [scale, allSheets, buildings]);
await browser.close();

const manifestPath = path.join(root, 'public/assets/manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.overrides ??= {};
let wrote = 0, kept = 0;
for (const f of files) {
  const dest = path.join(root, f.path);
  if (f.path.startsWith('public/assets/')) {
    const rel = f.path.slice('public/assets/'.length);
    manifest.overrides[path.basename(rel, '.png')] ??= rel;
    if (fs.existsSync(dest) && !force) {
      kept++;
      continue;
    }
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, Buffer.from(f.data, 'base64'));
  wrote++;
}
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`wrote ${wrote} files, kept ${kept} existing game PNGs${kept ? ' (--force overwrites them)' : ''}`);
