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
  // the companion keeps up: the player runs flat out for 8 seconds, with a dash, and the helper never falls behind
  const follow = await page.evaluate(async () => {
    const { screenDirToWorld } = await import('/src/game/config.ts');
    const g = window.__tot.game, f = g.friends[0], dt = 1 / 30, home = { x: g.p.x, y: g.p.y, fx: f.x, fy: f.y };
    g.enemies = [];
    let worst = 0, travelled = 0, heading = 0;
    for (let i = 0; i < 240; i++) {
      // run at full player speed, turning whenever the way is blocked; a dash burst in the middle
      const speed = (i >= 100 && i < 106 ? 13 : 3.4 * g.stats.move);
      for (let tries = 0; tries < 8; tries++) {
        const w = screenDirToWorld(Math.cos(heading), Math.sin(heading)), x = g.p.x, y = g.p.y;
        g.moveCircle(g.p, w.x * speed * dt, w.y * speed * dt, g.p.r);
        const moved = Math.hypot(g.p.x - x, g.p.y - y);
        if (moved > speed * dt * 0.6) { travelled += moved; break; }
        g.p.x = x; g.p.y = y; heading += Math.PI / 4;
      }
      g.time += dt; g.computeFlow(false, dt); g.updateTeam(dt);
      if (i > 30) worst = Math.max(worst, Math.hypot(f.x - g.p.x, f.y - g.p.y));
    }
    const end = Math.hypot(f.x - g.p.x, f.y - g.p.y);
    g.p.x = home.x; g.p.y = home.y; f.x = home.fx; f.y = home.fy; g.computeFlow(true); // back to open ground for the next checks
    return { worst, travelled, end };
  });
  assert.ok(follow.travelled > 20, `The run must cover real ground (${follow.travelled.toFixed(1)} tiles)`);
  assert.ok(follow.worst < 5 && follow.end < 2.5, `The helper keeps pace with a running player (worst gap ${follow.worst.toFixed(1)}, final ${follow.end.toFixed(1)} tiles)`);
  // the companion fights
  await page.evaluate(() => { const g = window.__tot.game, f = g.friends[0]; f.weapon.ammo = 40; g.spawnEnemy('zombie', f.x + 2, f.y).spawnT = 0; });
  await page.waitForFunction(() => window.__tot.game.friends[0].weapon.ammo < 40);
  // and picks the player up
  await page.evaluate(() => { const g = window.__tot.game; g.enemies = []; g.p.invuln = 0; g.p.shield = 0; g.p.hp = 1; g.p.revives = 0; g.takeDamage(50, g.p.x + 1, g.p.y); });
  await page.waitForFunction(() => window.__tot.game.state === 'downed');
  await page.evaluate(() => { const g = window.__tot.game, f = g.friends[0]; f.x = g.p.x + 0.4; f.y = g.p.y; });
  await page.waitForFunction(() => window.__tot.game.state === 'play' && window.__tot.game.p.hp > 0, null, { timeout: 15000 });
  // A friend goes down: a doorstep can still offer the other kid, and taking that card puts a second helper in the fight.
  const second = await page.evaluate(() => {
    const g = window.__tot.game, random = Math.random, seen = new Set(), first = g.friends[0];
    g.p.invuln = 1e9; g.enemies = [];
    first.hp = 0;
    for (let i = 0; i < 40; i++) { Math.random = () => 0; try { g.openLevelUp('house', 3, 0); } finally { Math.random = random; } if (g.friendChoice !== null) seen.add(g.friendChoice); }
    g.chooseFriend();
    const joined = g.friends[1];
    joined.weapon.ammo = 40; g.spawnEnemy('zombie', joined.x + 1.5, joined.y).spawnT = 0;
    return { repeats: seen.has(first.hero), offered: [...seen].length, team: g.friends.length, state: g.state };
  });
  assert.deepEqual(second, { repeats: false, offered: 1, team: 2, state: 'play' });
  await page.waitForFunction(() => window.__tot.game.friends[1].weapon.ammo < 40, null, { timeout: 15000 }); // the new friend fights while the first is down
  // the fallen friend: a sign above them, a beacon on the map, and 30 seconds on the clock
  const sign = await page.evaluate(async () => {
    const { FRIEND_DOWN_TIME } = await import('/src/game/engine.ts');
    const { game: g, renderer } = window.__tot, ctx = renderer.ctx, fill = ctx.fillText.bind(ctx), arc = ctx.arc.bind(ctx);
    g.enemies = [];
    const first = g.friends[0];
    first.x = g.p.x + 4; first.y = g.p.y; // out of reach, in view
    g.updateTeam(1); // one second on the clock
    const texts = []; let arcs = 0;
    ctx.fillText = (text, ...rest) => { texts.push(String(text)); fill(text, ...rest); };
    ctx.arc = (...args) => { arcs++; arc(...args); };
    try { renderer.render(g, 0.001); } finally { ctx.fillText = fill; ctx.arc = arc; }
    return { limit: FRIEND_DOWN_TIME, down: first.downT, sign: texts.find(t => /REVIVE/.test(t)), prompt: g.rescuePrompt, arcs };
  });
  assert.equal(sign.limit, 30);
  assert.ok(sign.down >= 1 && /^(E|TAP INTERACT) · REVIVE · \d+s$/.test(sign.sign || ''), `A fallen friend shows a revive sign with the time left (${sign.sign})`);
  assert.ok(sign.arcs > 0, 'The minimap draws a beacon for the fallen friend');
  // walk over and press E: they get back up
  const revived = await page.evaluate(() => {
    const g = window.__tot.game, first = g.friends[0];
    first.x = g.p.x + 0.8; first.y = g.p.y; g.input.keys.add('e');
    g.p.hurtT = 0; // the hit from the knock-down check above is long over in real play; a fresh hit would only pause the revive
    let prompt = '';
    for (let i = 0; i < 120 && first.hp <= 0; i++) { g.updateTeam(1 / 30); prompt = g.rescuePrompt || prompt; }
    g.input.keys.delete('e');
    return { hp: first.hp, prompt, downT: first.downT };
  });
  assert.ok(revived.hp > 0 && /Helping/.test(revived.prompt) && revived.downT === 0, 'Holding E beside a fallen friend revives them');
  // nobody comes: after 30 seconds they are out for the night, and may be met at a door again
  const lost = await page.evaluate(() => {
    const g = window.__tot.game, first = g.friends[0], hero = first.hero, random = Math.random;
    first.hp = 0; first.x = g.p.x + 6; first.y = g.p.y;
    for (let i = 0; i < 29 * 30; i++) g.updateTeam(1 / 30);
    const before = g.friends.includes(first);
    for (let i = 0; i < 2 * 30; i++) g.updateTeam(1 / 30);
    let again = false;
    for (let i = 0; i < 40 && !again; i++) { Math.random = () => 0; try { g.openLevelUp('house', 3, 0); } finally { Math.random = random; } again = g.friendChoice === hero; }
    g.choose(g.choices[0].id);
    return { before, after: g.friends.includes(first), team: g.friends.length, again, state: g.state };
  });
  assert.deepEqual(lost, { before: true, after: false, team: 1, again: true, state: 'play' });
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: /Friends & shared guns/ }).click();
  assert.equal(await page.getByRole('button', { name: 'Choose helper' }).count(), 0, 'Nobody has to be chosen: the whole team fights');
  await page.getByText(/Every friend on your team fights beside you/).waitFor();
  await page.screenshot({ path: 'art/world/checks/free-friend-team.png' });
  assert.deepEqual(errors, []);
  console.log(`Free-game friend card: offered at ${(odds.rate * 100).toFixed(1)}% of doorsteps as one of three cards, joins, keeps pace, fights and revives; a second friend fights alongside; a fallen friend shows a sign and map beacon, can be revived for 30 seconds and is then out for the night.`);
} finally { await browser.close(); }
