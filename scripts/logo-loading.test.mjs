import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ channel: 'msedge' });
const url = process.env.TOT_LOGO_URL || 'http://127.0.0.1:5173/';
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => requests.push(new URL(request.url()).pathname));
    let releaseLogo, releaseWorld;
    const logoGate = new Promise(resolve => { releaseLogo = resolve; });
    const worldGate = new Promise(resolve => { releaseWorld = resolve; });
    await page.route('**/images/newlogo.webp*', async route => { await logoGate; await route.continue(); });
    await page.route('**/assets/manifest.json*', async route => { await worldGate; await route.continue(); });
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      const logo = page.getByRole('img', { name: 'Trick or Treat — Maple Falls' });
      await logo.waitFor({ state: 'attached' });
      const pending = await logo.evaluate(img => ({ opacity: getComputedStyle(img).opacity, height: img.getBoundingClientRect().height, width: img.getBoundingClientRect().width, priority: img.fetchPriority }));
      assert.equal(pending.opacity, '0', 'No partially downloaded logo should be painted');
      assert.ok(pending.height > 0 && pending.width > 0, 'Reserve logo space before decoding');
      assert.equal(pending.priority, 'high');
      const preload = await page.locator('link[rel="preload"][as="image"]').evaluateAll(links => links.map(link => ({ href: link.href, priority: link.getAttribute('fetchpriority') })));
      // the logo plus the landscape and portrait splash (each gated by its orientation media query)
      assert.equal(preload.length, 3, 'Preload only the loading screen artwork');
      assert.equal(preload[0].href, await logo.getAttribute('src').then(src => new URL(src, url).href));
      assert.ok(preload.every(link => link.priority === 'high'));
      // read in one step: React swaps the static boot screen for its own copy at an arbitrary moment
      assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.boot-loop i')).animationIterationCount), 'infinite', 'Loading shows a looping animation, not a stalled progress bar');
      releaseLogo();
      await page.waitForFunction(() => document.querySelector('img[alt="Trick or Treat — Maple Falls"]')?.style.opacity === '1');
      const complete = await logo.evaluate(img => ({ height: img.getBoundingClientRect().height, width: img.getBoundingClientRect().width, complete: img.complete, naturalWidth: img.naturalWidth }));
      assert.ok(complete.complete && complete.naturalWidth === 1240);
      assert.ok(Math.abs(complete.height - pending.height) < .05, 'Decode must not shift loading screen layout');
      assert.ok(Math.abs(complete.width - pending.width) < .05);
      assert.equal(requests.filter(path => path.endsWith('/images/newlogo.webp')).length, 1, 'Preload, decode and rendering share one request');
      assert.ok(!requests.some(path => /\/images\/(newlogo\.png|logo\.webp|keyart\.webp)$/.test(path)), 'Never fetch the master or obsolete preload assets');
      await fs.mkdir('art/world/checks', { recursive: true });
      await page.screenshot({ path: `art/world/checks/logo-loading-${viewport.width}x${viewport.height}.png` });
      releaseWorld();
      await page.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 120000 });
      await page.waitForFunction(() => document.querySelector('img[alt="Trick or Treat — Maple Falls"]')?.style.opacity === '1');
      assert.deepEqual(errors, []);
      console.log(`${viewport.width}x${viewport.height}: slow logo stays hidden until decoded, no layout shift, correct high-priority preload and one optimized request; menu works.`);
    } finally {
      releaseLogo(); releaseWorld();
      await context.close();
    }
  }
} finally { await browser.close(); }
