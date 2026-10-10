import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { chromium } from 'playwright-core';

const url = process.env.TOT_PUBLIC_URL || 'https://run.world/catalog/game/AFjPSjQH9kbcCl57sgO3';
const shared = new URL(url).searchParams.has('k');
const releaseLabel = shared ? 'Shared review' : 'Public';
const manifest = JSON.parse(await fs.readFile('dist/assets/manifest.json', 'utf8'));
const localHtml = await fs.readFile('dist/index.html', 'utf8');
const localModule = [...localHtml.matchAll(/<script\b[^>]*type="module"[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).sort((a, b) => b.length - a.length)[0];
const digest = source => crypto.createHash('sha256').update(source.trim()).digest('hex');
assert.ok(localModule, 'Built game module exists');
const browser = await chromium.launch({ channel: 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const loaded = new Set(), assetErrors = [], pageErrors = [], requestErrors = [];
  page.on('response', response => { if (response.ok()) loaded.add(new URL(response.url()).pathname); });
  page.on('pageerror', error => pageErrors.push({ message: error.message, stack: error.stack || '' }));
  page.on('console', message => { if (message.text().includes('[assets] override failed')) assetErrors.push(message.text()); });
  page.on('requestfailed', request => requestErrors.push({ path: new URL(request.url()).pathname, error: request.failure()?.errorText }));
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  assert.equal(await page.getByText('Game Not Found', { exact: true }).count(), 0, `${releaseLabel} release is not available at this URL`);
  let game;
  for (let attempt = 0; attempt < 120 && !game; attempt++) {
    for (const frame of page.frames()) {
      if (await frame.getByRole('button', { name: 'Go trick-or-treating' }).count()) { game = frame; break; }
    }
    if (!game) {
      if (attempt > 0 && attempt % 15 === 0) console.log(`${releaseLabel} release loading: ${[...loaded].filter(path => path.includes('/assets/')).length} asset responses received.`);
      await page.waitForTimeout(2000);
    }
  }
  if (!game) {
    console.error(JSON.stringify({ pageErrors, requestErrors, frames: await Promise.all(page.frames().map(async frame => ({ path: new URL(frame.url()).pathname, text: (await frame.locator('body').innerText({ timeout: 1000 }).catch(() => '')).slice(0, 1000) }))) }));
  }
  assert.ok(game, shared ? 'Review game loads through its share link without signing in' : 'Public game loads without a private key or signed-in browser');
  await game.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 120000 });
  const remoteModule = await game.evaluate(() => [...document.scripts].filter(s => s.type === 'module').map(s => s.textContent || '').sort((a, b) => b.length - a.length)[0]);
  assert.equal(digest(remoteModule), digest(localModule), 'Hosted game is byte-identical to the audited build module');
  for (const entry of Object.values(manifest.overrides)) {
    const file = typeof entry === 'string' ? entry : entry.file;
    assert.ok([...loaded].some(path => path.endsWith(`/assets/${file}`)), `Hosted loader missed ${file}`);
  }
  assert.equal(await game.getByRole('button', { name: 'Collection', exact: true }).count(), 0);
  assert.equal(await game.getByRole('button', { name: /Preview expansion locally/ }).count(), 0);
  assert.equal(await game.evaluate(() => typeof window.__tot), 'undefined');
  await game.getByRole('button', { name: 'Discover the full game' }).click();
  const showcase = game.getByRole('dialog', { name: 'HIDE & SHRIEK' }); await showcase.waitFor();
  await showcase.getByRole('button', { name: 'Close full game showcase' }).click();
  await game.getByRole('button', { name: 'Go trick-or-treating' }).click();
  await game.getByText('Ring doorbells', { exact: true }).waitFor();
  await page.keyboard.press('i');
  await game.getByRole('dialog', { name: 'Run inventory' }).waitFor();
  await page.screenshot({ path: 'art/world/checks/public-release.png' });
  assert.deepEqual(assetErrors, []);
  const origin = new URL(game.url()).origin;
  assert.deepEqual(pageErrors.filter(e => e.stack.includes(origin)), [], 'No errors from the game frame');
  console.log(`${releaseLabel} RUN release verified: exact audited bundle, ${Object.keys(manifest.overrides).length} assets, free gameplay, purchase catalogue and inventory; developer tools absent.`);
} finally { await browser.close(); }
