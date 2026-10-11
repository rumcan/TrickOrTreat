import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright-core';

// The starting tutorial. Professor Fizz talks the kid through three stops on a walkie-talkie: the first house, the
// candy machine (a free spin that is never a dud) and the shop (a free gun upgrade). The night waits meanwhile.
// It can be skipped for this run or switched off for good. The suites run without it; ?tutorial turns it on.
const url = 'http://127.0.0.1:5173/?tutorial';
const browser = await chromium.launch({ channel: 'msedge' });
const start = async (page) => {
  await page.goto(url);
  await page.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 120000 });
  await page.getByRole('button', { name: 'Go trick-or-treating' }).click();
  await page.waitForFunction(() => window.__tot?.game?.state === 'play');
};
const game = (page, fn, arg) => page.evaluate(fn, arg);
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await start(page);
  const walkie = page.getByTestId('walkie');
  await walkie.waitFor();
  await fs.mkdir('art/world/checks', { recursive: true });

  // ---- 1. the walkie talks, the night waits, the dots lead to the first house ----
  await page.waitForFunction(() => document.querySelector('[data-testid="walkie"]').dataset.line === 'hello');
  assert.match(await walkie.innerText(), /Professor Fizz/);
  assert.match(await walkie.innerText(), /do you read me/);
  assert.ok(await walkie.locator('.walkie-radio').evaluate(img => img.complete && img.naturalWidth > 40 && getComputedStyle(img).animationName === 'walkie-shake'), 'The walkie-talkie picture shakes while he talks');
  const song = () => page.evaluate(async () => (await import('/src/game/sound/radio.ts')).radio.snapshot().text);
  assert.match(await song(), /Hide & Shriek · Champion's Road/, 'The lesson has its own song on the radio');
  await page.screenshot({ path: 'art/world/checks/tutorial-hello.png' });
  await page.waitForTimeout(2500);
  const waiting = await game(page, () => { const g = window.__tot.game; return { step: g.tutorial.step, holding: g.tutorial.holding, time: g.time, monsters: g.enemies.length, guide: g.guide?.kind, route: g.guideRoute().length, said: g.tutorial.said.join() }; });
  assert.deepEqual(waiting, { step: 'treat', holding: true, time: 0, monsters: 0, guide: 'house', route: waiting.route, said: 'hello,treat' }, 'The clock and the monsters wait; the guide leads to the first house');
  assert.ok(waiting.route > 6, 'There is a dotted route to the house');

  // ---- 2. trick or treat ----
  await game(page, () => { const g = window.__tot.game, h = g.tutorialHouse; g.p.x = h.door.x; g.p.y = h.door.y + 0.5; });
  await page.waitForFunction(() => window.__tot.game.interact?.kind === 'house');
  await page.keyboard.press('e');
  await page.waitForFunction(() => window.__tot.game.state === 'levelup', null, { timeout: 20000 });
  await page.waitForFunction(() => window.__tot.game.tutorial.said.includes('bowl'));
  assert.equal(await walkie.locator('.walkie-actions').isVisible(), false, 'Over a menu the walkie shows no buttons of its own');
  await page.locator('.hm-pick:not(.hm-locked)').first().click();
  await page.waitForFunction(() => window.__tot.game.state !== 'levelup');
  if (await game(page, () => window.__tot.game.state) === 'inspect') await page.getByRole('button', { name: /Swap|Equip/ }).first().click();
  await page.waitForFunction(() => window.__tot.game.state === 'play' && window.__tot.game.tutorial.step === 'machine');

  // ---- 3. the candy machine: the dots lead there, the first spin is free and wins something real ----
  const machine = await game(page, () => { const g = window.__tot.game; g.pickups = []; g.pendingLevels = 0; const to = g.guide; g.p.x = to.x; g.p.y = to.y; g.computeFlow(true); return { kind: to.kind, price: g.vendingPrice(), coins: g.p.coins, said: g.tutorial.said.includes('machine') }; });
  assert.deepEqual([machine.kind, machine.price, machine.said], ['machine', 0, true], 'Next stop: the candy machine, first spin free');
  await page.waitForFunction(() => window.__tot.game.interact?.kind === 'vending');
  await page.screenshot({ path: 'art/world/checks/tutorial-machine.png' });
  await page.keyboard.press('e');
  await page.waitForFunction(() => window.__tot.game.state === 'vending');
  const spinButton = page.getByRole('button', { name: /Spin the machine/ });
  assert.match(await spinButton.innerText(), /FREE/i, 'The spin button says it is free');
  await spinButton.click();
  await page.waitForFunction(() => window.__tot.game.vendingSpin?.status === 'won', null, { timeout: 15000 });
  const spun = await game(page, () => { const g = window.__tot.game; return { kind: g.vendingSpin.winner.kind, coins: g.p.coins, plays: g.vendingPlays, next: g.vendingPrice(), said: g.tutorial.said.includes('spin') }; });
  assert.ok(spun.kind !== 'dud', 'The free spin is never a dud');
  assert.deepEqual([spun.coins, spun.plays, spun.next, spun.said], [machine.coins, 0, 60, true], 'It cost nothing, and the next spin is at the usual first price');
  await page.getByRole('button', { name: spun.kind === 'treat' ? 'Collect treat' : /Equip slot 1/ }).click();
  await page.getByRole('button', { name: 'Back to the streets' }).click();
  await page.waitForFunction(() => window.__tot.game.state === 'play' && window.__tot.game.tutorial.step === 'shop');

  // ---- 4. the shop: one free gun upgrade ----
  const shop = await game(page, () => { const g = window.__tot.game; g.pickups = []; const to = g.guide; g.p.x = to.x; g.p.y = to.y; g.computeFlow(true); return { kind: to.kind, coins: g.p.coins, level: g.weapon.level, price: g.upgradePrice(g.weapon) }; });
  assert.deepEqual([shop.kind, shop.price], ['shop', 0]);
  await page.waitForFunction(() => window.__tot.game.interact?.kind === 'shop');
  await page.keyboard.press('e');
  await page.waitForFunction(() => window.__tot.game.state === 'shop');
  const upgrade = page.getByRole('button', { name: /Level \d+ · FREE/ }).first();
  await upgrade.waitFor();
  await page.screenshot({ path: 'art/world/checks/tutorial-shop.png' });
  await upgrade.click();
  const upgraded = await game(page, () => { const g = window.__tot.game; return { coins: g.p.coins, level: g.weapon.level, next: g.upgradePrice(g.weapon), said: g.tutorial.said.includes('upgrade') }; });
  assert.deepEqual([upgraded.coins, upgraded.level, upgraded.said], [shop.coins, shop.level + 1, true], 'The upgrade cost nothing');
  assert.ok(upgraded.next > 0, 'The next upgrade has a price again');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__tot.game.state === 'play' && window.__tot.game.tutorial?.step === 'done');

  // ---- 5. over and out: the night starts, the tutorial is remembered, the walkie goes away ----
  const done = await game(page, async () => { const g = window.__tot.game, t = await import('/src/game/tutorial.ts'); return { holding: g.tutorial.holding, seen: t.tutorialSeen(), bye: g.tutorial.said.at(-1) }; });
  assert.deepEqual(done, { holding: false, seen: true, bye: 'bye' });
  await page.waitForFunction(() => window.__tot.game.time > 1.5, null, { timeout: 10000 });
  await page.waitForFunction(() => document.querySelector('[data-testid="walkie"]')?.dataset.line === 'bye', null, { timeout: 60000 });
  await page.waitForFunction(() => !document.querySelector('[data-testid="walkie"]') && window.__tot.game.tutorial === null, null, { timeout: 60000 });
  assert.match(await song(), /Midnight Mischief · Neon Forge/, `On "Here they come" the night's first song comes in`);
  await page.close();

  // ---- skip for this run ----
  {
    const p2 = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await start(p2);
    await p2.getByRole('button', { name: 'Skip tutorial' }).click();
    await p2.waitForFunction(() => window.__tot.game.tutorial === null && !document.querySelector('[data-testid="walkie"]'));
    await p2.waitForFunction(() => window.__tot.game.time > 1);
    assert.match(await p2.evaluate(async () => (await import('/src/game/sound/radio.ts')).radio.snapshot().text), /Midnight Mischief · Neon Forge/, `Skipping the lesson starts the night's song at once`);
    const after = await game(p2, async () => { const g = window.__tot.game, t = await import('/src/game/tutorial.ts'); return { seen: t.tutorialSeen(), price: g.vendingPrice(), firstDoorGuide: g.guide?.kind }; });
    assert.deepEqual(after, { seen: false, price: 60, firstDoorGuide: 'house' }, 'Skipping ends it for this run only: nothing is free, and the usual first-door dots stay');
    await p2.close();
  }
  // ---- never show again; and a phone ----
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const p3 = await context.newPage();
    await p3.goto(url);
    await p3.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 120000 });
    await p3.getByRole('button', { name: 'Go trick-or-treating' }).tap();
    await p3.waitForFunction(() => window.__tot?.game?.state === 'play');
    const phone = p3.getByTestId('walkie');
    await phone.waitFor();
    const box = await phone.boundingBox();
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= 390 && box.y + box.height <= 844 * 0.5, `On a phone the walkie sits in the top half, on screen (${JSON.stringify(box)})`);
    await p3.screenshot({ path: 'art/world/checks/tutorial-phone.png' });
    await p3.getByRole('button', { name: 'Never show again' }).tap();
    await p3.waitForFunction(() => window.__tot.game.tutorial === null);
    assert.equal(await p3.evaluate(async () => (await import('/src/game/tutorial.ts')).tutorialSeen()), true, 'Never show again is remembered');
    await context.close();
  }
  // ---- the machine's duds ----
  {
    const p4 = await browser.newPage();
    await p4.goto('http://127.0.0.1:5173/');
    await p4.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 120000 });
    const duds = await p4.evaluate(async () => {
      const { vendingCatalogue, createVendingSpin, VENDING_DUDS } = await import('/src/game/vending.ts');
      const { CLUTTER_KINDS } = await import('/src/game/arcade-clutter.ts');
      const { tutorialWanted } = await import('/src/game/tutorial.ts');
      const pool = vendingCatalogue({}), total = pool.reduce((sum, p) => sum + p.weight, 0), dud = pool.filter(p => p.kind === 'dud');
      let won = 0; const n = 20000;
      for (let i = 0; i < n; i++) if (createVendingSpin(pool, i, 60).winner.kind === 'dud') won++;
      return { kinds: dud.length, share: +(dud.reduce((sum, p) => sum + p.weight, 0) / total).toFixed(4), rolled: won / n, art: VENDING_DUDS.every(d => CLUTTER_KINDS.includes(d.art)), wantedInTests: tutorialWanted() };
    });
    assert.deepEqual([duds.kinds, duds.share, duds.art], [4, 0.2, true], 'Four duds with Starcade art take exactly a fifth of the spins');
    assert.ok(Math.abs(duds.rolled - 0.2) < 0.02, `About one spin in five is a dud (${duds.rolled})`);
    assert.equal(duds.wantedInTests, false, 'Without ?tutorial the test suites play without the tutorial');
    await p4.close();
  }
  assert.deepEqual(errors, [], 'No page errors');
  console.log('tutorial: walkie lines, waiting night, house → free spin (never a dud) → free upgrade, skip, never again, phone layout, 20% duds: ok');
} finally { await browser.close(); }
