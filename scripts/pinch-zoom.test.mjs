import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

// Phones: two fingers spreading apart zoom in, pinching together zoom out; one finger still steers and a held second
// finger still aims.
const URL = process.env.URL || 'http://127.0.0.1:5186/';
const browser = await chromium.launch({ channel: 'msedge' });
try {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(URL);
  await page.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 180000 });
  await page.getByRole('button', { name: 'Go trick-or-treating' }).tap();
  await page.waitForFunction(() => window.__tot?.game?.state === 'play' || window.__tot?.game?.state === 'intro', null, { timeout: 60000 });
  await page.waitForTimeout(6000); // the run settles in (intro banner) as it would for a player
  await page.evaluate(() => { const g = window.__tot.game; g.director = () => {}; g.enemies = []; g.p.invuln = 1e9; });
  const cdp = await context.newCDPSession(page);
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y], id) => ({ x, y, id, radiusX: 4, radiusY: 4, force: 1 })) });
  const pinch = async (from, to) => {
    await touch('touchStart', [[420 - from, 200]]); await page.waitForTimeout(30);
    await touch('touchStart', [[420 - from, 200], [420 + from, 200]]);
    for (let i = 1; i <= 10; i++) { const d = from + (to - from) * i / 10; await touch('touchMove', [[420 - d, 200], [420 + d, 200]]); await page.waitForTimeout(16); }
    await touch('touchEnd', []); await page.waitForTimeout(100);
  };
  await touch('touchStart', [[300, 300]]); await touch('touchEnd', []); await page.waitForTimeout(300); // the run's first touch
  const z0 = await page.evaluate(() => window.__tot.game.userZoom);
  await pinch(60, 160);
  const zIn = await page.evaluate(() => window.__tot.game.userZoom);
  await pinch(160, 60);
  const zOut = await page.evaluate(() => window.__tot.game.userZoom);
  // a still second finger aims (no zoom)
  await touch('touchStart', [[200, 250]]); await page.waitForTimeout(30);
  await touch('touchStart', [[200, 250], [600, 120]]); await page.waitForTimeout(500);
  const aiming = await page.evaluate(() => ({ mdown: window.__tot.game.input.mdown, z: window.__tot.game.userZoom }));
  await touch('touchEnd', []);
  console.log({ z0, zIn, zOut, aiming });
  assert.ok(zIn > z0 * 1.4, 'spreading two fingers zooms in');
  assert.ok(zOut < zIn * 0.75, 'pinching zooms back out');
  assert.equal(aiming.mdown, true, 'a still second finger still aims and fires');
  assert.equal(aiming.z, zOut, 'aiming does not zoom');
  assert.deepEqual(errors, []);
  console.log('PASS pinch zoom');
} finally { await browser.close(); }
