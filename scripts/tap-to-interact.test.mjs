import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright-core';

// A phone player's first treat: they walk to the door and tap THE DOOR (or the bag, or the gun), not a button at the
// bottom of the screen. A tap on the play area interacts whenever something is in reach; a drag still only moves.
const browser = await chromium.launch({ channel: 'msedge' });
try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5173/');
    await page.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 120000 });
    await page.getByRole('button', { name: 'Select Jess' }).tap(); // the reviewer played the witch
    await page.getByRole('button', { name: 'Go trick-or-treating' }).tap();
    await page.waitForFunction(() => window.__tot?.game?.state === 'play');
    const tag = `${viewport.width}x${viewport.height}`;
    // at the first door, with nothing to fight
    await page.evaluate(() => {
      const g = window.__tot.game, h = g.tutorialHouse;
      g.director = () => {}; g.enemies = []; g.p.invuln = 1e9; g.pickups = [];
      g.p.x = h.door.x; g.p.y = h.door.y + 0.5;
    });
    await page.getByText(/^Tap the screen: Trick or Treat/).waitFor();
    assert.equal(await page.evaluate(() => window.__tot.game.hero), 2, `${tag}: playing Jess`);
    const cdp = await context.newCDPSession(page);
    const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
    const spot = { x: Math.round(viewport.width * 0.5), y: Math.round(viewport.height * 0.42) };
    // a drag only moves the kid: it must not ring the bell
    await touch('touchStart', [{ ...spot, id: 1 }]); await touch('touchMove', [{ x: spot.x + 70, y: spot.y, id: 1 }]);
    await page.waitForTimeout(120); await touch('touchEnd', []);
    assert.equal(await page.evaluate(() => !!window.__tot.game.tot), false, `${tag}: a drag does not ring the bell`);
    await page.evaluate(() => { const g = window.__tot.game, h = g.tutorialHouse; g.p.x = h.door.x; g.p.y = h.door.y + 0.5; });
    await page.getByText(/^Tap the screen: Trick or Treat/).waitFor();
    // a tap on the play area rings it
    await page.touchscreen.tap(spot.x, spot.y);
    await page.waitForFunction(() => !!window.__tot.game.tot || window.__tot.game.state === 'levelup');
    await page.waitForFunction(() => window.__tot.game.state === 'levelup', null, { timeout: 20000 });
    // the first bowl: tapping a card takes it
    const card = page.locator('.hm-pick:not(.hm-locked)').first();
    await card.waitFor();
    await fs.mkdir('art/world/checks', { recursive: true });
    await page.screenshot({ path: `art/world/checks/phone-first-treat-${tag}.png` });
    const box = await card.boundingBox();
    assert.ok(box && box.width > 60 && box.height > 60, `${tag}: the first prize card is big enough to tap`);
    await card.scrollIntoViewIfNeeded();
    const at = await card.boundingBox();
    await page.touchscreen.tap(at.x + at.width / 2, at.y + Math.min(at.height / 2, 80));
    await page.waitForFunction(() => window.__tot.game.state !== 'levelup', null, { timeout: 10000 });
    const got = await page.evaluate(() => { const g = window.__tot.game; return { state: g.state, treats: g.scrollOrder.length, guns: g.p.weapons.filter(Boolean).length, friends: g.friends.length }; });
    assert.ok(got.treats + got.guns + got.friends >= 2 || got.state === 'inspect', `${tag}: the tapped prize was taken (${JSON.stringify(got)})`);
    if (got.state === 'inspect') { await page.getByRole('button', { name: /Swap|Equip/ }).first().tap(); await page.waitForFunction(() => window.__tot.game.state === 'play'); }
    // a treat bag and a gun on the ground: tapping the screen opens the bag, then looks at the gun
    await page.waitForFunction(() => window.__tot.game.state === 'play');
    await page.evaluate(async () => {
      const g = window.__tot.game; g.pickups = []; g.pendingLevels = 0;
      g.pickups.push({ x: g.p.x + 0.5, y: g.p.y + 0.4, z: 0, vz: 0, vx: 0, vy: 0, kind: 'chest', value: 0, mag: false, t: 0, dead: false });
    });
    await page.getByText(/^Tap the screen: /).waitFor();
    await page.touchscreen.tap(spot.x, spot.y);
    await page.waitForFunction(() => !window.__tot.game.pickups.some(k => k.kind === 'chest'), null, { timeout: 5000 });
    // every touch control is on the screen
    await page.evaluate(() => { const g = window.__tot.game; g.pickups = []; g.pendingLevels = 0; if (g.state !== 'play') { g.choices = []; g.gunChoices = []; g.state = 'play'; } });
    await page.locator('.touch-action').first().waitFor();
    const controls = await page.locator('.touch-action, .hm-iconbtn').evaluateAll(els => els.filter(e => e.offsetParent).map(e => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; }));
    assert.ok(controls.length >= 4 && controls.every(([l, t, r, b]) => l >= 0 && t >= 0 && r <= viewport.width && b <= viewport.height), `${tag}: every control is on the screen (${JSON.stringify(controls)})`);
    await page.screenshot({ path: `art/world/checks/phone-play-${tag}.png` });
    assert.deepEqual(errors, [], `${tag}: no page errors`);
    console.log(`${tag}: tap the door for the first treat, tap a card to take it, tap to open a bag; a drag only moves; controls on screen.`);
    await context.close();
  }
} finally { await browser.close(); }
