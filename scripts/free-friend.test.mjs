import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright-core';

// Free game: a doorstep bowl can hold a friend card. Taking it adds a companion who follows, fights and revives.
const browser = await chromium.launch({ channel: 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 120000 });
  await page.getByRole('button', { name: 'Go trick-or-treating' }).click();
  await page.waitForFunction(() => window.__tot?.game);
  const odds = await page.evaluate(async () => {
    const { FRIEND_CARD_CHANCE } = await import('/src/game/engine.ts');
    const g = window.__tot.game;
    g.director = () => {}; g.enemies = []; g.p.invuln = 1e9;
    if (g.campaign || g.friends.length) throw new Error('The free game starts alone');
    const porch = g.map.houses.find(h => !h.trick);
    g.tot = { house: porch }; g.finishTot();
    if (g.choices.length + g.gunChoices.length + (g.friendChoice === null ? 0 : 1) !== 3) throw new Error('An actual uncostumed house must offer three reward choices');
    // the offer shows up at roughly its stated rate, always as one of the cards, never the player's own kid or a premium kid
    let offers = 0;
    for (let i = 0; i < 600; i++) {
      g.openLevelUp('house', 3, 0);
      if (g.friendChoice !== null) {
        offers++;
        if (g.friendChoice === g.hero || g.friendChoice > 2) throw new Error(`Wrong kid offered: ${g.friendChoice}`);
        if (g.choices.length + g.gunChoices.length !== 2 || !g.choices.length) throw new Error('A friend card must replace exactly one of the three cards');
      } else if (g.choices.length + g.gunChoices.length !== 3) throw new Error('Three cards expected without a friend');
    }
    g.openLevelUp('level');
    if (g.friendChoice !== null) throw new Error('Level-ups never offer a friend');
    return { rate: offers / 600, chance: FRIEND_CARD_CHANCE };
  });
  assert.ok(Math.abs(odds.rate - odds.chance) < 0.07, `Friend cards appear at about ${odds.chance * 100}% of doorsteps (saw ${(odds.rate * 100).toFixed(1)}%)`);
  // force an offer and take it through the real card
  await page.evaluate(() => {
    const g = window.__tot.game, random = Math.random;
    Math.random = () => 0; try { g.openLevelUp('house', 3, 0); } finally { Math.random = random; }
    g.choiceGiver = 'Mrs. Okafor';
  });
  const card = page.getByRole('button', { name: /^Let (Tommy|Sam|Jess) join you$/ });
  await card.waitFor();
  await fs.mkdir('art/world/checks', { recursive: true });
  await page.screenshot({ path: 'art/world/checks/free-friend-card.png' });
  await card.click();
  await page.waitForFunction(() => window.__tot.game.state === 'play');
  const joined = await page.evaluate(() => {
    const g = window.__tot.game, f = g.friends[0];
    return { count: g.friends.length, active: g.activeFriend === f.hero, status: f.status, near: Math.hypot(f.x - g.p.x, f.y - g.p.y) < 3, gun: f.weapon.def.id, offer: g.friendChoice };
  });
  assert.deepEqual(joined, { count: 1, active: true, status: 'rescued', near: true, gun: 'nerf', offer: null });
  // the companion fights
  await page.evaluate(() => { const g = window.__tot.game, f = g.friends[0]; f.weapon.ammo = 40; g.spawnEnemy('zombie', f.x + 2, f.y).spawnT = 0; });
  await page.waitForFunction(() => window.__tot.game.friends[0].weapon.ammo < 40);
  // and picks the player up
  await page.evaluate(() => { const g = window.__tot.game; g.enemies = []; g.p.invuln = 0; g.p.shield = 0; g.p.hp = 1; g.p.revives = 0; g.takeDamage(50, g.p.x + 1, g.p.y); });
  await page.waitForFunction(() => window.__tot.game.state === 'downed');
  await page.evaluate(() => { const g = window.__tot.game, f = g.friends[0]; f.x = g.p.x + 0.4; f.y = g.p.y; });
  await page.waitForFunction(() => window.__tot.game.state === 'play' && window.__tot.game.p.hp > 0, null, { timeout: 15000 });
  // the second free kid can still be offered, the first cannot be offered twice
  const second = await page.evaluate(() => {
    const g = window.__tot.game, random = Math.random, seen = new Set();
    g.p.invuln = 1e9;
    for (let i = 0; i < 40; i++) { Math.random = () => 0; try { g.openLevelUp('house', 3, 0); } finally { Math.random = random; } if (g.friendChoice !== null) seen.add(g.friendChoice); }
    const first = g.friends[0].hero;
    g.chooseFriend();
    return { repeats: seen.has(first), offered: [...seen].length, team: g.friends.length, activeUnchanged: g.activeFriend === first };
  });
  assert.deepEqual(second, { repeats: false, offered: 1, team: 2, activeUnchanged: true });
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: /Friends & shared guns/ }).click();
  assert.equal(await page.getByRole('button', { name: 'Choose helper' }).count(), 2, 'Both friends can be chosen as the helper');
  await page.screenshot({ path: 'art/world/checks/free-friend-team.png' });
  assert.deepEqual(errors, []);
  console.log(`Free-game friend card: offered at ${(odds.rate * 100).toFixed(1)}% of doorsteps as one of three cards, joins, fights, revives; a second friend joins the team without replacing the helper.`);
} finally { await browser.close(); }
