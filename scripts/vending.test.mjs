import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ channel: 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 120000 });
  await page.getByRole('button', { name: 'Go trick-or-treating' }).click();
  await page.waitForFunction(() => window.__tot?.game.state === 'play');
  const poolChecks = await page.evaluate(async () => {
    const { vendingCatalogue, createVendingSpin } = await import('/src/game/vending.ts');
    const free = vendingCatalogue({ glass: 1, sugar: 99 }), paid = vendingCatalogue({});
    const total = free.reduce((sum, p) => sum + p.weight, 0);
    if (Math.abs(total - 100) > .001) throw new Error('Free prize weights must sum to 100');
    if (!free.some(p => p.premium && p.weight > 0)) throw new Error('Premium prizes must be winnable for free players');
    if (free.some(p => p.kind === 'weapon' && p.premium && !p.weapon.def.premium)) throw new Error('Premium gun was replaced by a pea shooter');
    if (paid.filter(p => p.premium).some(p => p.weight <= 0)) throw new Error('Owned premium prizes are not in the pool');
    if (free.find(p => p.key === 'treat:glass').weight !== 0 || free.find(p => p.key === 'treat:sugar').weight <= 0) throw new Error('One-off/stackable ownership rules lost');
    for (let rarity = 0; rarity <= 4; rarity++) {
      const total = free.filter(p => p.rarity === rarity).reduce((sum, p) => sum + p.weight, 0);
      if (Math.abs(total - [50, 30, 15, 4, 1][rarity]) > .001) throw new Error('Rarity odds do not match published numbers');
    }
    for (let i = 0; i < 500; i++) {
      const spin = createVendingSpin(free, i, 60);
      if (spin.reel[spin.stop] !== spin.winner) throw new Error('Reel misses actual winner');
      if (!spin.reel[spin.stop - 1].premium || !spin.reel[spin.stop + 1].premium) throw new Error('No settled premium previews');
    }
    const g = window.__tot.game; g.director = () => {}; g.enemies = []; g.p.invuln = 999;
    g.pickups = []; g.banner = null; g.toasts = []; g.tutorialHouse = null; g.time = 30;
    const shop = g.map.shops.find(s => s.prop.kind === 'vending');
    g.p.x = shop.x; g.p.y = shop.y; g.p.coins = 300;
    return { total, vendingCount: g.map.shops.filter(s => s.prop.kind === 'vending').length };
  });
  assert.equal(poolChecks.vendingCount, 2);
  await page.keyboard.press('e');
  const machine = page.getByRole('dialog', { name: 'Midnight Candy Machine' });
  await machine.waitFor();
  assert.equal(await page.evaluate(() => window.__tot.game.state), 'vending');
  const guard = await page.evaluate(() => {
    const g = window.__tot.game; g.p.coins = 0; const denied = g.spinVending() === null; g.p.coins = 300;
    const price = g.vendingPrice(), spin = g.spinVending(); const after = g.p.coins;
    const duplicate = g.spinVending(); g.settleVending(spin.id + 1); const wrong = spin.status;
    g.closeVending();
    return { denied, price, after, duplicate, wrong, state: g.state };
  });
  assert.ok(guard.denied); assert.equal(guard.after, 240); assert.equal(guard.price, 60);
  assert.equal(guard.duplicate, null); assert.equal(guard.wrong, 'spinning'); assert.equal(guard.state, 'vending');
  // The initial engine guard was intentionally called without a UI refresh; now restart the modal.
  await page.evaluate(() => { const g = window.__tot.game; g.vendingSpin = null; g.vendingPlays = 0; g.p.coins = 600; g.state = 'play'; });
  await machine.waitFor({ state: 'detached' });
  await page.keyboard.press('e'); await machine.waitFor();
  const time = await page.evaluate(() => window.__tot.game.time);
  await machine.getByRole('button', { name: /^Spin the machine/ }).click();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  assert.ok(await machine.evaluate(modal => modal.contains(document.activeElement)), 'Keyboard focus cannot reach the HUD behind a paid spin');
  await page.keyboard.press('p');
  assert.equal(await page.evaluate(() => window.__tot.game.state), 'vending', 'Pause key cannot abandon a paid spin');
  await page.waitForFunction(() => window.__tot.game.vendingSpin?.status === 'won');
  assert.equal(await page.evaluate(() => window.__tot.game.time), time, 'Combat and timers stay paused throughout the spin');
  const centered = await page.locator('.vending-tile.is-winner').evaluate(tile => {
    const b = tile.getBoundingClientRect(), f = tile.closest('.vending-reel-frame').getBoundingClientRect();
    return Math.abs((b.left + b.right) / 2 - (f.left + f.right) / 2);
  });
  assert.ok(centered < 2, 'The visible winner stops under the marker');
  assert.ok(await machine.getByRole('region', { name: 'Winning prize' }).isVisible());
  const premium = page.locator('.vending-tile.is-winner').locator('xpath=following-sibling::button[1]');
  await premium.hover();
  const peek = machine.getByRole('region', { name: 'Prize details' });
  await peek.waitFor();
  assert.ok(await peek.getByText('Premium gun · everyone can win this run prize', { exact: true }).isVisible());
  assert.ok(await peek.getByText('DPS', { exact: true }).isVisible());
  await page.mouse.move(0, 0); await peek.waitFor({ state: 'detached' });
  await page.screenshot({ path: 'art/world/checks/vending-desktop.png' });
  const kind = await page.evaluate(() => window.__tot.game.vendingSpin.winner.kind);
  if (kind === 'treat') await machine.getByRole('button', { name: 'Collect treat', exact: true }).click();
  else await machine.getByRole('button', { name: /^Equip slot 2/ }).click();
  assert.equal(await page.evaluate(() => window.__tot.game.vendingSpin.status), 'claimed');
  assert.equal(await page.evaluate(() => window.__tot.game.claimVending(0)), false, 'Claim cannot grant twice');
  await machine.getByRole('button', { name: 'Back to the streets' }).click();
  await machine.waitFor({ state: 'detached' });
  // Deterministic gun reward checks replacement, unclaimed-close safety and exact inscriptions.
  const gunCheck = await page.evaluate(async () => {
    const g = window.__tot.game, sh = g.map.shops.find(s => s.prop.kind === 'vending'); g.openVending(sh.prop);
    const old = g.p.weapons[0], spin = g.spinVending();
    const gun = g.vendingPool().find(p => p.kind === 'weapon' && !p.premium && p.rarity === 4);
    spin.winner = gun; spin.reel[spin.stop] = gun; g.settleVending(spin.id);
    const stays = g.state === 'vending';
    const invalid = g.claimVending(99); const claimed = g.claimVending(0), duplicate = g.claimVending(0);
    const exact = g.p.weapons[0] === gun.weapon, dropped = g.pickups.some(p => p.weapon === old);
    g.closeVending();
    return { stays, invalid, claimed, duplicate, exact, dropped, state: g.state };
  });
  assert.deepEqual(gunCheck, { stays: true, invalid: false, claimed: true, duplicate: false, exact: true, dropped: true, state: 'play' });
  const premiumCheck = await page.evaluate(async () => {
    const { hasFullGame } = await import('/src/game/expansion.ts');
    const { makeWeapon } = await import('/src/game/data.ts');
    const g = window.__tot.game; g.p.coins = 9999;
    const results = [];
    for (const kind of ['weapon', 'treat']) {
      g.openVending(g.map.shops.find(s => s.prop.kind === 'vending').prop);
      const spin = g.spinVending(), prize = g.vendingPool().find(p => p.premium && p.kind === kind && p.weight > 0);
      spin.winner = prize; spin.reel[spin.stop] = prize; g.settleVending(spin.id);
      results.push(g.claimVending(1));
      results.push(kind === 'weapon' ? g.p.weapons[1].def.id === prize.weapon.def.id : g.scrolls[prize.scroll.id] > 0);
      g.closeVending();
    }
    g.openVending(g.map.shops.find(s => s.prop.kind === 'vending').prop);
    const spin = g.spinVending(), original = g.p.weapons[0], drops = g.pickups.length;
    spin.winner = g.vendingPool().find(p => p.kind === 'weapon'); g.settleVending(spin.id);
    const rejected = g.rejectVending(), duplicate = g.rejectVending(), claimed = g.claimVending(0);
    g.closeVending();
    return { results, owned:hasFullGame(), gate:makeWeapon('gloom', 2).def.id, rejected, duplicate, claimed, same:g.p.weapons[0] === original, drops:g.pickups.length === drops, state:g.state };
  });
  assert.deepEqual(premiumCheck, { results:[true,true,true,true], owned:false, gate:'pea', rejected:true, duplicate:false, claimed:false, same:true, drops:true, state:'play' });
  await page.waitForFunction(() => window.__tot.game.state === 'play');
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => { const g = window.__tot.game; g.p.coins = 999; g.pickups = []; g.openVending(g.map.shops.find(s => s.prop.kind === 'vending').prop); });
    await machine.waitFor();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await machine.getByRole('button', { name: /^Spin the machine/ }).click();
    await page.waitForFunction(() => window.__tot.game.vendingSpin?.status === 'won');
    const b = await machine.boundingBox(); assert.ok(b.x >= 0 && b.x + b.width <= viewport.width);
    const premium = page.locator('.vending-tile.is-winner').locator('xpath=preceding-sibling::button[1]');
    if (viewport.width <= 640) {
      await premium.click();
      assert.equal(await peek.count(), 0, 'No transient prize overlay on narrow/mobile screens');
      assert.ok(await machine.getByRole('region', { name: 'Winning prize' }).isVisible());
    }
    await page.screenshot({ path: `art/world/checks/vending-${viewport.width}x${viewport.height}.png` });
    const kind = await page.evaluate(() => window.__tot.game.vendingSpin.winner.kind);
    if (kind === 'treat') await machine.getByRole('button', { name: 'Collect treat', exact: true }).click();
    else await machine.getByRole('button', { name: /^Equip slot 2/ }).click();
    await machine.getByRole('button', { name: 'Back to the streets' }).click();
    await machine.waitFor({ state: 'detached' });
  }
  assert.deepEqual(errors, []);
  console.log('Premium prizes for free players without permanent unlock, increasing costs, reject/leave, transient desktop hover, no phone overlays, exact winner, paused spins and claim guards passed.');
} finally { await browser.close(); }
