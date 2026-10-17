import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ channel: 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/');
  await page.bringToFront();
  await page.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 120000 });
  const logo = await page.locator('img[src*="newlogo"]').boundingBox();
  const picker = await page.getByRole('region', { name: 'Character selection' }).boundingBox();
  // the menu is the left column of the sheet, so the kids are picked beside it, never over it
  const rail = await page.getByRole('navigation', { name: 'Main menu' }).boundingBox();
  const nav = await page.getByRole('button', { name: 'Character details' }).boundingBox();
  const wrap = await page.locator('.title-wrap').boundingBox();
  const pickerMid = picker.y + picker.height / 2;
  assert.ok(picker.y > logo.y + logo.height, 'Picker below logo');
  assert.ok(rail.x + rail.width <= picker.x + 1, 'Menu column sits left of the character panel');
  assert.ok(nav.x + nav.width <= rail.x + rail.width + 1, 'Menu rows stay inside the column');
  assert.ok(nav.y >= rail.y && nav.y + nav.height <= rail.y + rail.height + 1, 'Menu rows stay inside the column');
  // the remaining space starts under the whole header (logo, Essence counter and the 15K badge), not under the logo
  const header = await page.getByRole('banner', { name: 'Game header' }).boundingBox();
  assert.ok(Math.abs(pickerMid - ((header.y + header.height + wrap.y + wrap.height) / 2)) < 90, 'Picker centered in remaining menu space');
  // the CTA sits with the carousel it belongs to
  const cta = await page.getByRole('button', { name: 'Go trick-or-treating' }).boundingBox();
  assert.ok(cta.x >= rail.x + rail.width, 'The big CTA belongs to the carousel, not the rail');
  await page.getByRole('button', { name: /^Talents/ }).click();
  const talents = await page.evaluate(async () => (await import('/src/game/data.ts')).TALENTS.map(t => ({ name: t.name, premium: t.premium, req: t.req })));
  const premium = talents.find(t => t.premium);
  await page.locator('svg').getByText(premium.name, { exact: true }).click();
  await page.getByText(/Full-game talent: unlock the full game/).waitFor();
  const linked = talents.find(t => !t.premium && t.req.length);
  await page.locator('svg').getByText(linked.name, { exact: true }).click();
  await page.getByText(/Unlock by buying rank 1 in any one of/).waitFor();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Go trick-or-treating' }).click();
  await page.waitForFunction(() => window.__tot?.game.state === 'play');
  await page.evaluate(() => {
    const g = window.__tot.game;
    g.scrolls = { sugar: 3, king: 2 }; g.scrollOrder = ['sugar', 'king'];
    g.recalcStats(); g.state = 'inventory';
  });
  const inventory = page.getByRole('dialog', { name: 'Run inventory' });
  await inventory.waitFor();
  assert.equal(await inventory.getByRole('tab', { name: 'Collected effects' }).getAttribute('aria-selected'), 'true');
  assert.equal(await inventory.locator('article').count(), 2);
  assert.equal(await inventory.locator('details').count(), 0);
  const color = await inventory.locator('header p').evaluate(p => getComputedStyle(p).color);
  assert.equal(color, 'rgb(255, 255, 255)', 'Readable white inventory text');
  await page.screenshot({ path: 'art/world/checks/inventory-effects-updated.png' });
  await inventory.getByRole('tab', { name: 'Synergies & tiers' }).click();
  assert.ok(await inventory.locator('details').count() > 0);
  assert.equal(await inventory.locator('details[open]').count(), 0, 'Tier text collapsed by default');
  await inventory.locator('summary').first().click();
  assert.equal(await inventory.locator('details[open]').count(), 1);
  await inventory.getByRole('tab', { name: 'Damage breakdown' }).click();
  await inventory.getByText('Expected DPS', { exact: true }).waitFor();
  await inventory.getByRole('button', { name: 'Close inventory' }).click();
  await page.evaluate(async () => {
    const g = window.__tot.game;
    const { HERO_COSTUME } = await import('/src/game/data.ts');
    const id = HERO_COSTUME[g.hero]; // only a kid's own costume can lie on the ground
    g.enemies = []; g.pickups = []; g.dropCostume(g.p.x + .4, g.p.y, id);
    g.state = 'play'; g.updateInteract();
  });
  await page.waitForFunction(() => window.__tot.game.snapshot().nearbyCostume);
  await page.waitForTimeout(200);
  const label = await page.evaluate(() => window.__tot.game.snapshot().interact);
  assert.equal(await page.getByText(label, { exact: true }).count(), 1, 'Exactly one costume E prompt');
  assert.deepEqual(errors, []);
  console.log('Centered picker, all portrait UI, talent unlock guidance, effects-first tabs, expandable synergies, white text and single costume prompt passed.');
} finally { await browser.close(); }
