import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

// Houses do not come back with time or with a boss: the porch lights come back on only once the kid has
// trick-or-treated at every single house in town and at the three stands inside the Starcade.
const browser = await chromium.launch({ channel: 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 120000 });
  const out = await page.evaluate(async () => {
    const { Game, ARCADE_VENUES } = await import('/src/game/engine.ts');
    const { buildArcadeMap } = await import('/src/game/arcade-map.ts');
    const input = () => ({ keys: new Set(), pressed: new Set(), mouseActive: false, mdown: false, rpressed: false, wheel: 0, touchFiring: false, endFrame() { this.pressed.clear(); this.rpressed = false; this.wheel = 0; } });
    const g = new Game(0, { hero: 0, soul: 0, best: 0, talents: {} }, input(), false, 1337);
    g.state = 'play'; g.director = () => {}; g.enemies = []; g.p.invuln = 1e9;
    const town = g.map.houses.filter(h => h.prop.kind !== 'arcade');
    const res = { venues: ARCADE_VENUES, start: g.housesToGo - town.length };
    const visit = (h) => { h.trick = false; g.p.x = h.door.x; g.p.y = h.door.y + 0.5; g.tot = { house: h }; g.finishTot(); g.state = 'play'; g.choices = []; g.gunChoices = []; g.friendChoice = null; g.pendingLevels = 0; g.pickups = []; };
    const done = () => town.filter(h => h.visited).length;
    const [a, b, ...rest] = town;
    for (const h of rest) h.visited = true;
    visit(a);
    res.oneLeft = { done: done() === town.length - 1, toGo: g.housesToGo - ARCADE_VENUES };
    // a boss falls: nothing comes back
    const boss = g.spawnEnemy('king', g.p.x + 4, g.p.y); g.boss = boss; g.killEnemy(boss);
    g.bossBreak = false; g.calmT = 0; g.state = 'play'; g.pickups = [];
    res.afterBoss = done() === town.length - 1;
    // the last house in town: the Starcade's stands are still to do
    visit(b);
    res.townDone = { done: done() === town.length, toGo: g.housesToGo };
    // inside the Starcade: two of the three stands, then the last one
    const arcade = buildArcadeMap();
    g.arcadeScene = { map: arcade, enemies: [], pickups: [], decals: [], turrets: [] };
    res.stands = arcade.houses.length;
    arcade.houses[0].visited = true; arcade.houses[1].visited = true;
    g.relightWhenAllVisited();
    res.oneStand = { toGo: g.housesToGo, done: done() === town.length };
    arcade.houses[2].visited = true;
    g.relightWhenAllVisited();
    res.relit = { town: done(), stands: arcade.houses.filter(h => h.visited).length, toGo: g.housesToGo - town.length, lights: town.every(h => !h.light || h.light.i === h.lightI) };
    return res;
  });
  assert.deepEqual([out.venues, out.start, out.stands], [3, 3, 3], 'Every house in town and the three Starcade stands are on the list');
  assert.deepEqual(out.oneLeft, { done: true, toGo: 1 }, 'With one house to go, nothing has come back');
  assert.equal(out.afterBoss, true, 'A boss falling does not turn the porch lights back on');
  assert.deepEqual(out.townDone, { done: true, toGo: 3 }, 'With the whole town done, the Starcade stands are still to visit');
  assert.deepEqual(out.oneStand, { toGo: 1, done: true }, 'One stand to go: still nothing back');
  assert.deepEqual(out.relit, { town: 0, stands: 0, toGo: 3, lights: true }, 'After the very last one, every house and stand has fresh treats');
  assert.deepEqual(errors, [], 'No page errors');
  console.log('every house: porch lights come back only after all of town and the three Starcade stands have been visited, never for a boss: ok');
} finally { await browser.close(); }
