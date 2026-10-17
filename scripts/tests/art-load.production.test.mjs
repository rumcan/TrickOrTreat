import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

// A released build must never quietly start in its built-in drawings. Dropped art requests are retried, and if the art
// still does not arrive the loading screen says so and offers to try again. Runs against the production preview.
const url = process.env.TOT_PRODUCTION_URL || 'http://127.0.0.1:5174/';
const browser = await chromium.launch({ channel: 'msedge' });
try {
  // 1. the art list and a handful of files fail on the first request: the retries bring everything in
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const warnings = []; page.on('console', m => { if (m.text().includes('[assets] override failed')) warnings.push(m.text()); });
    const seen = new Map(); let dropped = 0;
    await page.route('**/assets/**', async route => {
      const path = new URL(route.request().url()).pathname, n = (seen.get(path) ?? 0) + 1;
      seen.set(path, n);
      const flaky = path.endsWith('/manifest.json') || /\/(heroes|enemies|houses|props)\//.test(path) || seen.size % 9 === 0;
      if (n === 1 && flaky && !path.endsWith('.js') && !path.endsWith('.css')) { dropped++; return route.abort('connectionreset'); }
      return route.continue();
    });
    await page.goto(url);
    await page.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 120000 });
    assert.ok(dropped >= 5, `Several art requests were dropped on the first try (${dropped})`);
    assert.equal(await page.locator('.boot-problem').count(), 0, 'No problem screen: the retries were enough');
    assert.deepEqual(warnings, [], 'Every painted asset arrived after a retry');
    await page.close();
  }
  // 2. the art list never arrives: the loading screen says so instead of starting in the built-in drawings
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    let block = true, tries = 0;
    await page.route('**/assets/manifest.json*', route => { tries++; return block ? route.abort('connectionreset') : route.continue(); });
    await page.goto(url);
    const problem = page.locator('.boot-problem');
    await problem.waitFor({ timeout: 120000 });
    assert.ok(tries >= 4, `The art list was asked for several times before giving up (${tries})`);
    assert.match(await problem.innerText(), /artwork did not finish loading/i);
    assert.equal(await page.getByRole('button', { name: 'Go trick-or-treating' }).count(), 0, 'The title does not open on its own');
    // trying again with the connection back loads the real game
    block = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await page.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 120000 });
    assert.equal(await page.locator('.boot-problem').count(), 0);
    await page.close();
  }
  // 3. the player may still choose to play without the art
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.route('**/assets/manifest.json*', route => route.abort('connectionreset'));
    await page.goto(url);
    await page.getByRole('button', { name: 'Play anyway' }).click({ timeout: 120000 });
    await page.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 30000 });
    await page.close();
  }
  console.log('art load: dropped requests are retried; a failed load shows Try again / Play anyway instead of starting in the built-in drawings: ok');
} finally { await browser.close(); }
