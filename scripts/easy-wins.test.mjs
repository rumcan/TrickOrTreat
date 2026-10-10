import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel:'msedge' });
try {
  const page = await browser.newPage({ viewport:{width:1440,height:900} });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button', { name:'Go trick-or-treating' }).waitFor({timeout:120000});
  assert.doesNotMatch(await page.getByRole('group', {name:'Radio',exact:true}).getAttribute('title'), /heavy metal gp/i);
  await page.getByRole('button', {name:'Discover the full game'}).click();
  const costumes = page.locator('.unlock-costume-art canvas');
  assert.ok(await costumes.count() >= 2);
  const before = await costumes.evaluateAll(list => list.map(c => c.toDataURL()));
  await page.waitForTimeout(500);
  assert.deepEqual(await costumes.evaluateAll(list => list.map(c => c.toDataURL())), before, 'Premium costume previews do not animate');
  await page.getByRole('button', {name:'Close full game showcase'}).click();
  await page.getByRole('button', {name:'Go trick-or-treating'}).click();
  await page.waitForFunction(() => window.__tot?.game.state === 'play');
  const start = await page.evaluate(() => { const g = window.__tot.game; g.director = () => {}; return {guns:g.p.weapons.map(w => w?.def.id ?? null), ground:g.pickups.filter(p => p.kind === 'weapon').length}; });
  assert.deepEqual(start, {guns:['pea',null],ground:0});
  await page.evaluate(() => window.__tot.game.endRun(false));
  await page.getByRole('button', {name:/Spend.*talent/i}).click();
  const replay = page.getByRole('button', {name:'Play again with these talents'});
  await replay.waitFor();
  for (const viewport of [{width:1440,height:900},{width:390,height:844},{width:844,height:390}]) {
    await page.setViewportSize(viewport);
    const b = await replay.boundingBox(); assert.ok(b.height >= 52, 'Replay remains a full-height button, not a flex-shrunk line');
  }
  await replay.click(); await page.waitForFunction(() => window.__tot.game.state === 'play' && window.__tot.game.p.level === 1);
  const context = await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  const mobile = await context.newPage();
  await mobile.addInitScript(() => { window.__fullscreenAttempts = 0; HTMLElement.prototype.requestFullscreen = () => { window.__fullscreenAttempts++; return Promise.reject(new Error('emulated denial')); }; });
  await mobile.goto('http://127.0.0.1:5173/');
  await mobile.getByRole('button', {name:'Go trick-or-treating'}).waitFor({timeout:120000});
  assert.ok(await mobile.getByRole('button', {name:'Fullscreen',exact:true}).isVisible());
  await mobile.getByRole('button', {name:'Go trick-or-treating'}).tap();
  await mobile.getByTestId('touch-move').waitFor();
  assert.equal(await mobile.evaluate(() => window.__fullscreenAttempts), 1);
  assert.ok(await mobile.getByRole('button', {name:'Fullscreen',exact:true}).isVisible());
  await mobile.getByRole('button', {name:'Fullscreen',exact:true}).tap();
  assert.equal(await mobile.evaluate(() => window.__fullscreenAttempts), 2);
  assert.ok(await mobile.evaluate(() => window.__tot.game.zoom < .62), 'Smaller mobile world zoom shows more gameplay');
  await mobile.screenshot({path:'art/world/checks/easy-wins-mobile.png'});
  assert.deepEqual(errors, []);
  await context.close();
  console.log('Pea-only start, radio text, static costumes, replay height and mobile fullscreen gesture/denial fallback passed.');
} finally { await browser.close(); }
