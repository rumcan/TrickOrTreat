import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge' });
try {
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const sizes = [[1440, 900], [1024, 768], [768, 600], [960, 540], [390, 844], [844, 390]];
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await page.goto('http://127.0.0.1:5173/');
    await page.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 120000 });
    await page.getByRole('button', { name: 'Go trick-or-treating' }).click();
    await page.waitForFunction(() => window.__tot?.game?.state === 'play');
    await page.evaluate(async () => {
      const g = window.__tot.game, { makeWeapon } = await import('/src/game/data.ts');
      g.banner = null; g.p.invuln = 999; g.pickups = [];
      g.dropWeapon(g.p.x, g.p.y, makeWeapon('soaker', 4));
    });
    const panel = page.getByRole('region', { name: 'Nearby weapon comparison' });
    await panel.waitFor();
    const bounds = await panel.boundingBox();
    assert.ok(bounds.x >= width / 2 + 24, `Weapon panel covers the center at ${width}x${height}: ${JSON.stringify(bounds)}`);
    assert.ok(bounds.x + bounds.width <= width, 'Weapon panel outside right edge');
    assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= height, 'Weapon panel outside vertical edges');
    assert.ok(Math.abs(bounds.y + bounds.height / 2 - height / 2) < 2, 'Panel not vertically centered');
    if (width >= 768) {
      await panel.getByText('On the ground', { exact: true }).waitFor();
      await panel.getByText('Equipped', { exact: true }).waitFor();
      const scroll = panel.locator('.overflow-y-auto');
      assert.equal(await scroll.evaluate(el => getComputedStyle(el).pointerEvents), 'auto');
      assert.ok(await scroll.evaluate(el => el.clientHeight > 0), 'Comparison cards have no visible space');
      if (width < 1280) {
        const ground = await panel.getByText('On the ground', { exact: true }).boundingBox();
        const equipped = await panel.getByText('Equipped', { exact: true }).boundingBox();
        assert.ok(ground.y < equipped.y, 'Narrow layout must show the ground weapon first');
      }
      await page.screenshot({ path: `art/world/checks/weapon-pickup-${width}x${height}.png` });
      await scroll.evaluate(el => { el.scrollTop = el.scrollHeight; });
    }
    else await page.screenshot({ path: `art/world/checks/weapon-pickup-${width}x${height}.png` });
    // E inspects first (the world pauses), then a number key picks the slot: 2 is the empty one, nothing drops
    await page.keyboard.press('e');
    await page.getByRole('dialog', { name: 'Inspect weapon' }).waitFor();
    assert.equal(await page.evaluate(() => window.__tot.game.state), 'inspect');
    await page.keyboard.press('2');
    await page.waitForFunction(() => window.__tot.game.weapon.def.id === 'soaker');
    await panel.waitFor({ state: 'hidden' });
    console.log(`${width}x${height}: right-side panel, clear center, responsive bounds and E inspect → slot pickup passed.`);
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
