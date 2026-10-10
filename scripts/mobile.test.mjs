import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ channel: 'msedge' });
try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }, { width: 768, height: 1024 }]) {
    const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5173/');
    await page.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 120000 });
    const title = await page.evaluate(() => ({
      scrolls: [...document.querySelectorAll('.title-wrap')].some(e => e.scrollHeight > e.clientHeight + 1),
      bottoms: [...document.querySelectorAll('.title-nav button, .title-play')].map(b => b.getBoundingClientRect().bottom),
      overlaps: (() => {
        const boxes = [...document.querySelectorAll('.title-wrap button, header button')].filter(b => b.offsetParent).map(b => b.getBoundingClientRect());
        return boxes.some((a, i) => boxes.some((b, j) => j > i && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1));
      })(),
    }));
    assert.equal(title.scrolls, false, `${viewport.width}x${viewport.height}: the title needs no scrolling`);
    assert.ok(title.bottoms.every(bottom => bottom <= viewport.height + 1), `${viewport.width}x${viewport.height}: Play and every menu button are on screen`);
    assert.equal(title.overlaps, false, `${viewport.width}x${viewport.height}: no title button covers another`);
    const here = page.url();
    await page.getByRole('button', { name: 'How to play' }).tap();
    const close = page.getByRole('button', { name: 'Close popup' });
    await close.waitFor();
    const closeBox = await close.boundingBox();
    assert.ok(closeBox.y >= 0 && closeBox.y + closeBox.height <= viewport.height && closeBox.width >= 44, 'A popup always shows its close button');
    await page.evaluate(() => history.back()); // the phone's Back gesture
    await close.waitFor({ state: 'detached' });
    assert.equal(page.url(), here, 'Back closes the popup and stays in the game');
    await page.getByRole('button', { name: 'Settings' }).tap();
    await close.tap();
    await close.waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Go trick-or-treating' }).tap();
    await page.getByTestId('touch-move').waitFor();
    await page.evaluate(() => {
      const g = window.__tot.game;
      g.director = () => {}; g.enemies = []; g.p.invuln = 999;
      g.time = 15; g.bossIn = null; g.banner = null; g.toasts = [];
      g.weapon.reloadT = 0; g.weapon.cd = 0; g.weapon.ammo = 20;
    });
    assert.equal(await page.locator('.touch-stick').count(), 0, 'No on-screen joysticks');
    assert.equal(await page.getByTestId('touch-aim').count(), 0, 'No aim stick: the kid fires on their own');
    const boxes = await page.locator('.touch-action, .hm-mobile-access, .hm-topbar [aria-label="Pause"], .hm-tabs button:not(.hm-tab-ability)').evaluateAll(elements => elements.map(element => {
      const b = element.getBoundingClientRect();
      return { label: element.getAttribute('aria-label') || element.textContent, left: b.left, top: b.top, right: b.right, bottom: b.bottom, width: b.width, height: b.height };
    }));
    for (const box of boxes) {
      assert.ok(box.left >= -1 && box.top >= -1 && box.right <= viewport.width + 1 && box.bottom <= viewport.height + 1, `${viewport.width}: ${box.label} fits screen`);
      assert.ok(box.width >= 44 && box.height >= 44, `${viewport.width}: ${box.label} is a usable touch target`);
    }
    // the tiny music key, top-left of the play area
    const music = page.getByRole('button', { name: 'Mute music', exact: true });
    const musicBox = await music.boundingBox();
    assert.ok(musicBox.x < 80 && musicBox.y < 160 && musicBox.width <= 36, 'Tiny music key sits top-left');
    await music.tap();
    await page.getByRole('button', { name: 'Unmute music', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.__tot.game.state), 'play', 'Muting music does not pause the run');
    await page.getByRole('button', { name: 'Unmute music', exact: true }).tap();
    const minimap = await page.evaluate(() => {
      const { game, renderer } = window.__tot;
      const ctx = document.querySelector('canvas').getContext('2d');
      const original = ctx.drawImage;
      let top = 0;
      ctx.drawImage = function (image, ...args) {
        if (image === renderer.minimap) top = args[1];
        return original.call(this, image, ...args);
      };
      try { renderer.render(game, 0.001); }
      finally { ctx.drawImage = original; }
      return { top, headerBottom: document.querySelector('.hm-topbar').getBoundingClientRect().bottom };
    });
    assert.ok(minimap.top - 7 >= minimap.headerBottom, 'Canvas minimap clears the actual mobile header');
    // drag anywhere on the play area to move; nothing else is needed to shoot
    const move = { x: viewport.width / 2, y: viewport.height * 0.5, radiusX: 8, radiusY: 8, force: 1, id: 1 };
    const center = b => ({ x: b.x + b.width / 2, y: b.y + b.height / 2, radiusX: 8, radiusY: 8, force: 1 });
    const cdp = await context.newCDPSession(page);
    const dispatch = (type, touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
    const before = await page.evaluate(() => ({ x: window.__tot.game.p.x, y: window.__tot.game.p.y }));
    await dispatch('touchStart', [move]);
    assert.equal(await page.evaluate(() => window.__tot.game.input.touchMoveX), 0, 'Touching down alone does not move');
    const heldMove = { ...move, x: move.x + 70 };
    await dispatch('touchMove', [heldMove]);
    await page.waitForFunction(() => window.__tot.game.input.touchMoveX > 0.5);
    await page.waitForTimeout(180);
    const after = await page.evaluate(() => ({ x: window.__tot.game.p.x, y: window.__tot.game.p.y }));
    assert.ok(Math.hypot(after.x - before.x, after.y - before.y) > 0.05, 'Dragging on the play area moves the player');
    assert.ok(after.x > before.x && after.y < before.y, 'Screen-right maps to the correct isometric direction');
    await page.evaluate(() => { const g = window.__tot.game; g.spawnEnemy('zombie', g.p.x + 1.5, g.p.y).spawnT = 0; });
    await page.waitForFunction(() => window.__tot.game.weapon.ammo < 20 && !window.__tot.game.input.touchFiring);
    assert.ok(await page.evaluate(() => window.__tot.game.input.touchMoveX > 0), 'Auto-fire needs no aiming finger and does not stop movement');
    await page.evaluate(() => { window.__tot.game.enemies = []; });
    const dashBox = await page.getByRole('button', { name: 'Dash', exact: true }).boundingBox();
    const dash = { ...center(dashBox), id: 3 };
    await dispatch('touchStart', [heldMove, dash]);
    await page.waitForFunction(() => window.__tot.game.p.dashCharges < window.__tot.game.stats.dashCharges);
    await dispatch('touchEnd', [dash]);
    assert.ok(await page.evaluate(() => window.__tot.game.input.touchMoveX > 0), 'A second-finger dash does not cancel movement');
    await dispatch('touchEnd', []);
    await page.waitForFunction(() => window.__tot.game.input.touchMoveX === 0);
    assert.equal(await page.evaluate(() => window.__tot.game.input.touchMoveX), 0);
    await page.getByRole('button', { name: 'Use hero skill', exact: true }).tap();
    await page.waitForFunction(() => window.__tot.game.p.skillCd > 0);
    await page.evaluate(() => { window.__tot.game.weapon.ammo = 3; window.__tot.game.weapon.reloadT = 0; });
    await page.getByRole('button', { name: 'Reload weapon', exact: true }).tap();
    await page.waitForFunction(() => window.__tot.game.weapon.reloadT > 0);
    await page.evaluate(async () => {
      const { makeWeapon } = await import('/src/game/data.ts');
      window.__tot.game.p.weapons[1] = makeWeapon('nerf', 0);
    });
    await page.getByRole('button', { name: 'Equip weapon slot 2', exact: true }).tap();
    await page.waitForFunction(() => window.__tot.game.p.cur === 1);
    await page.getByRole('button', { name: 'Map', exact: true }).tap();
    await page.waitForFunction(() => window.__tot.game.bigMap);
    await page.getByRole('button', { name: 'Map', exact: true }).tap();
    await page.waitForFunction(() => !window.__tot.game.bigMap);
    await page.getByRole('button', { name: 'Map', exact: true }).tap();
    await page.getByRole('button', { name: 'Close map' }).tap();
    await page.waitForFunction(() => !window.__tot.game.bigMap);
    await page.getByRole('button', { name: 'Map', exact: true }).tap();
    await page.waitForFunction(() => window.__tot.game.bigMap);
    await page.touchscreen.tap(viewport.width / 2, viewport.height * 0.5);
    await page.waitForFunction(() => !window.__tot.game.bigMap);
    assert.equal(await page.evaluate(() => window.__tot.game.input.touchMoveX), 0, 'The tap that closes the map does not start a move');
    // Back: map, then pause, then resume; it never leaves mid-run
    await page.getByRole('button', { name: 'Map', exact: true }).tap();
    await page.waitForFunction(() => window.__tot.game.bigMap);
    await page.evaluate(() => history.back());
    await page.waitForFunction(() => !window.__tot.game.bigMap && window.__tot.game.state === 'play');
    await page.evaluate(() => history.back());
    await page.waitForFunction(() => window.__tot.game.state === 'pause');
    await page.evaluate(() => history.back());
    await page.waitForFunction(() => window.__tot.game.state === 'play');
    assert.equal(page.url(), here, 'Back never leaves the site during a run');
    await page.getByRole('button', { name: 'Your run build', exact: true }).tap();
    await page.getByRole('dialog', { name: 'Run inventory' }).waitFor();
    assert.equal(await page.getByTestId('touch-move').count(), 0, 'Touch input is hidden during paused menus');
    await page.getByRole('button', { name: 'Close inventory', exact: true }).tap();
    await page.getByTestId('touch-move').waitFor();
    await dispatch('touchStart', [move]); await dispatch('touchMove', [heldMove]);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    assert.equal(await page.evaluate(() => window.__tot.game.input.touchMoveX), 0, 'Focus loss releases touch movement');
    await dispatch('touchCancel', []);
    await page.getByRole('button', { name: 'Pause', exact: true }).tap();
    await page.waitForFunction(() => window.__tot.game.state === 'pause');
    assert.equal(await page.getByTestId('touch-move').count(), 0);
    await page.getByRole('button', { name: /Resume/i }).tap();
    await page.getByTestId('touch-move').waitFor();
    await page.evaluate(() => {
      const g = window.__tot.game, h = g.tutorialHouse;
      g.p.x = h.door.x; g.p.y = h.door.y; g.p.dashT = 0;
    });
    await page.getByRole('button', { name: 'Interact', exact: true }).waitFor();
    await page.waitForFunction(() => !!window.__tot.game.interact);
    await page.getByRole('button', { name: 'Interact', exact: true }).tap();
    await page.waitForFunction(() => !!window.__tot.game.tot);
    await page.getByRole('button', { name: 'Flee doorstep', exact: true }).tap();
    await page.waitForFunction(() => !window.__tot.game.tot);
    await page.screenshot({ path: `art/world/checks/mobile-${viewport.width}x${viewport.height}.png` });
    assert.deepEqual(errors, []);
    console.log(`${viewport.width}x${viewport.height}: one-screen title, Back and close on popups, drag-to-move with auto-fire, music key, dash/skill/reload/slots, map close, inventory/pause and door interaction passed.`);
    await context.close();
  }
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await desktop.goto('http://127.0.0.1:5173/');
  await desktop.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 120000 });
  await desktop.getByRole('button', { name: 'Go trick-or-treating' }).click();
  await desktop.getByRole('button', { name: 'Pause', exact: true }).waitFor();
  assert.equal(await desktop.getByTestId('touch-move').count(), 0, 'Mouse-only desktop keeps the existing HUD');
  await desktop.keyboard.down('d');
  assert.equal(await desktop.evaluate(() => window.__tot.game.input.keys.has('d')), true);
  await desktop.keyboard.up('d');
  console.log('Desktop keyboard and mouse-only layout remain available.');
} finally { await browser.close(); }
