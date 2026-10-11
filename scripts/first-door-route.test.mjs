import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

// The first door the game sends a new player to is the nearest one by WALKING, and the guide is a route on the ground
// that goes round buildings, so nobody is sent into a wall. Guns left on the ground are gone after two minutes, coins
// and candy after one; treat bags and first aid stay.
const browser = await chromium.launch({ channel: 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 120000 });
  const out = await page.evaluate(async () => {
    const { Game, GUN_GROUND_TIME, LOOT_GROUND_TIME } = await import('/src/game/engine.ts');
    const { makeWeapon } = await import('/src/game/data.ts');
    const { CW, CR } = await import('/src/game/config.ts');
    const input = () => ({ keys: new Set(), pressed: new Set(), mouseActive: false, mdown: false, rpressed: false, wheel: 0, touchFiring: false, endFrame() { this.pressed.clear(); this.rpressed = false; this.wheel = 0; } });
    const problems = [], detours = [];
    for (let seed = 1; seed <= 14; seed++) {
      const g = new Game(seed % 3, { hero: seed % 3, soul: 0, best: 0, talents: {} }, input(), false, seed * 7919);
      const h = g.tutorialHouse;
      if (!h) { problems.push(`seed ${seed}: no first house`); continue; }
      const cell = (x, y) => Math.floor(y * CR) * CW + Math.floor(x * CR);
      const walk = (q) => g.flow[cell(q.door.x, q.door.y)];
      const others = g.map.houses.filter(q => q.prop.kind === 'house' && !q.trick && !q.visited && g.reachable(q.door.x, q.door.y));
      if (others.some(q => walk(q) < walk(h))) problems.push(`seed ${seed}: a door is a shorter walk than the first house`);
      const route = g.treatRoute();
      if (route.length < 2) { problems.push(`seed ${seed}: no route`); continue; }
      if (Math.hypot(route[0].x - g.p.x, route[0].y - g.p.y) > 0.36) problems.push(`seed ${seed}: the route does not start at the kid`);
      if (Math.hypot(route[route.length - 1].x - h.door.x, route[route.length - 1].y - h.door.y) > 0.36) problems.push(`seed ${seed}: the route does not end at the door`);
      for (let i = 0; i < route.length; i++) {
        if (g.map.coll[cell(route[i].x, route[i].y)] !== 0) { problems.push(`seed ${seed}: the route crosses something solid`); break; }
        if (i && Math.abs(route[i].x - route[i - 1].x) + Math.abs(route[i].y - route[i - 1].y) > 0.26) { problems.push(`seed ${seed}: the route jumps`); break; }
      }
      // no car is parked across a doorstep, anywhere in town
      const cars = g.map.props.filter(q => q.kind === 'car' && !q.removed);
      if (!cars.length) problems.push(`seed ${seed}: the town has no cars left`);
      for (const q of g.map.houses) for (const c of cars) {
        const d = Math.hypot(q.door.x - Math.max(c.x0, Math.min(c.x0 + c.fw, q.door.x)), q.door.y - Math.max(c.y0, Math.min(c.y0 + c.fh, q.door.y)));
        if (d < 2.2) { problems.push(`seed ${seed}: a car is parked ${d.toFixed(1)} tiles from ${q.owner}'s door`); break; }
      }
      detours.push(+(route.length / CR / Math.hypot(h.door.x - g.p.x, h.door.y - g.p.y)).toFixed(2));
      if (g.treatRoute() !== route) problems.push(`seed ${seed}: the route is rebuilt every frame`);
    }
    // the guide ends with the first bowl
    const g = new Game(0, { hero: 0, soul: 0, best: 0, talents: {} }, input(), false, 1337);
    g.state = 'play'; g.director = () => {}; g.enemies = []; g.p.invuln = 1e9;
    const first = g.tutorialHouse;
    g.tot = { house: first }; g.finishTot();
    const afterBowl = g.treatRoute().length;
    // guns on the ground
    g.state = 'play'; g.pickups = []; g.choices = []; g.gunChoices = []; g.pendingLevels = 0;
    const drop = (age) => { g.dropWeapon(g.p.x + 3, g.p.y, makeWeapon('pea', 1)); const k = g.pickups[g.pickups.length - 1]; k.t = age; return k; };
    const young = drop(30), old = drop(GUN_GROUND_TIME - 0.2), coin = (g.dropPickup(g.p.x + 4, g.p.y, 'coin', 1), g.pickups[g.pickups.length - 1]);
    const put = (kind, age) => { g.dropPickup(g.p.x + 4, g.p.y, kind, 1); const k = g.pickups[g.pickups.length - 1]; k.t = age; return k; };
    const candy = put('xp2', LOOT_GROUND_TIME - 0.2), fresh = put('coin', 30), bag = put('chest', 500), aid = put('heal', 500);
    coin.t = LOOT_GROUND_TIME - 0.2;
    for (let i = 0; i < 30; i++) g.updatePickups(1 / 30);
    const has = k => g.pickups.includes(k);
    return { problems, detours, afterBowl, time: GUN_GROUND_TIME, lootTime: LOOT_GROUND_TIME, young: has(young), old: has(old), coin: has(coin), candy: has(candy), fresh: has(fresh), bag: has(bag), aid: has(aid) };
  });
  assert.deepEqual(out.problems, []);
  assert.ok(out.detours.every(d => d < 2.2), `The first door is never a long way round (${out.detours})`);
  assert.equal(out.afterBowl, 0, 'The route is gone once the first bowl has been opened');
  assert.equal(out.time, 120);
  assert.deepEqual([out.young, out.old], [true, false], 'A gun is gone after two minutes on the ground');
  assert.equal(out.lootTime, 60);
  assert.deepEqual([out.coin, out.candy, out.fresh, out.bag, out.aid], [false, false, true, true, true], 'Coins and candy are gone after a minute on the ground; treat bags and first aid stay');

  // on screen: dots on the ground, and the hint says to follow them when the door is out of view
  await page.getByRole('button', { name: 'Go trick-or-treating' }).click();
  await page.waitForFunction(() => window.__tot?.game?.state === 'play');
  const drawn = await page.evaluate(() => {
    const { game: g, renderer } = window.__tot, ctx = renderer.ctx;
    g.director = () => {}; g.enemies = [];
    const dots = [], ellipse = ctx.ellipse;
    ctx.ellipse = function (...a) { if (this.fillStyle === '#45da79' || this.fillStyle === '#b9ffcd') dots.push(a[0]); return ellipse.apply(this, a); };
    renderer.render(g, 0.01); ctx.ellipse = ellipse;
    return { dots: dots.length, route: g.treatRoute().length };
  });
  // one dot per half tile of route; the part of a long route that is off screen is not drawn
  assert.ok(drawn.route > 8 && drawn.dots >= 4 && drawn.dots <= Math.ceil(drawn.route / 2), `The route is drawn as dots on the ground (${JSON.stringify(drawn)})`);
  assert.deepEqual(errors, [], 'No page errors');
  console.log(`first door: nearest by walking on 14 maps (detour at most x${Math.max(...out.detours)}), a dotted route round buildings; ground guns gone after ${out.time}s: ok`);
} finally { await browser.close(); }
