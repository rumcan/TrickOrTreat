import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright-core';

// The ten "screen weapon" guns each work their own way, the heavy ones wreck cars and houses, common treats are small
// stackable boosts, the extreme treats trade something away, and any treat can be discarded from the side rail.
const NEW_FREE = ['stream', 'disc', 'sabre', 'glaive', 'swarm', 'flamer'], NEW_FULL = ['singularity', 'annihilator', 'incinerator', 'lance', 'cryo'];
const browser = await chromium.launch({ channel: 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 120000 });
  await page.getByRole('button', { name: 'Go trick-or-treating' }).click();
  await page.waitForFunction(() => window.__tot?.game?.state === 'play');
  await fs.mkdir('art/world/checks', { recursive: true });

  // ---- the catalogue ----
  const catalogue = await page.evaluate(async () => {
    const { WEAPONS, SCROLLS, WEAPON_BY_ID } = await import('/src/game/data.ts');
    const { weaponIcon } = await import('/src/game/art/fx.ts');
    const { allAssets } = await import('/src/game/assets.ts');
    for (const w of WEAPONS) weaponIcon(w.id);
    const fromFile = new Set(allAssets().filter(a => a.file).map(a => a.spec.key));
    const g = window.__tot.game;
    g.director = () => {}; g.enemies = []; g.p.invuln = 1e9;
    // the start point differs from run to run: do the shooting on the nearest wide-open ground (3.5 tiles clear all round)
    const { CW, CR, MAP_W, MAP_H } = await import('/src/game/config.ts');
    const open = (tx, ty) => { for (let cy = (ty - 3.5) * CR; cy < (ty + 3.5) * CR; cy++) for (let cx = (tx - 3.5) * CR; cx < (tx + 3.5) * CR; cx++) if (g.map.coll[cy * CW + cx] !== 0) return false; return true; };
    let spot = null;
    for (let ty = 5; ty < MAP_H - 5; ty++) for (let tx = 5; tx < MAP_W - 5; tx++) {
      const d = Math.hypot(tx - g.p.x, ty - g.p.y);
      if ((!spot || d < spot.d) && open(tx, ty)) spot = { x: tx, y: ty, d };
    }
    if (!spot) throw new Error('No open ground on the map');
    g.p.x = spot.x; g.p.y = spot.y;
    window.__home = { x: g.p.x, y: g.p.y };
    return {
      free: WEAPONS.filter(w => !w.premium).map(w => w.id), full: WEAPONS.filter(w => w.premium).map(w => w.id),
      painted: WEAPONS.filter(w => fromFile.has(`icon_${w.id}`)).map(w => w.id),
      demolish: WEAPONS.filter(w => w.demolish).map(w => `${w.id}:${!!w.premium}`),
      commons: SCROLLS.filter(s => s.rarity === 0).map(s => ({ id: s.id, max: s.max, premium: !!s.premium })),
      extreme: ['forcefield', 'berserk', 'oneshot', 'kaiju', 'goldfever'].map(id => { const s = SCROLLS.find(q => q.id === id); return s ? `${id}:${!!s.premium}:${s.max}` : `${id}:missing`; }),
      oldCommon: SCROLLS.filter(s => ['sugar', 'jawbreaker', 'popRocks'].includes(s.id)).map(s => s.rarity),
      lance: WEAPON_BY_ID.lance.trail,
      fuel: SCROLLS.find(s => s.id === 'pepper').name, fuelArt: allAssets().find(a => a.spec.key === 'treatart_pepper')?.file ?? '',
    };
  });
  for (const id of NEW_FREE) assert.ok(catalogue.free.includes(id), `${id} is a free gun`);
  for (const id of NEW_FULL) assert.ok(catalogue.full.includes(id), `${id} is a full-game gun`);
  for (const id of [...NEW_FREE, ...NEW_FULL]) assert.ok(catalogue.painted.includes(id), `${id} has a painted in-hand sprite`);
  assert.deepEqual(catalogue.demolish.sort(), ['annihilator:true', 'incinerator:true'], 'Only full-game guns wreck the street');
  // the flamethrower picture belongs to the gun; the burn treat is a can of fuel
  assert.equal(catalogue.fuel, 'Bug-Hunt Flame Fuel');
  assert.equal(catalogue.fuelArt, 'treats/pepper.webp', 'The burn treat no longer shows a gun');
  assert.ok(catalogue.commons.length >= 10, 'There is a tier of common treats');
  for (const c of catalogue.commons) assert.ok(c.max >= 3 && !c.premium, `Common treat ${c.id} is free and stacks`);
  assert.deepEqual(catalogue.extreme, ['forcefield:true:1', 'berserk:true:1', 'oneshot:true:1', 'kaiju:true:1', 'goldfever:true:1'], 'Five one-off extreme treats in the full game');

  // ---- every gun, fired at a pack of monsters on open ground ----
  const fireAt = (id) => page.evaluate(async (id) => {
    const { makeWeapon } = await import('/src/game/data.ts');
    const { CW, CR } = await import('/src/game/config.ts');
    const g = window.__tot.game, p = g.p;
    g.enemies = []; g.bullets = []; g.zones = []; g.beams = []; g.pickups = [];
    p.x = window.__home.x; p.y = window.__home.y;
    // an open stretch: the direction from the kid with the longest clear run
    let best = { a: 0, run: 0 };
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2; let run = 0;
      while (run < 6 && g.map.coll[Math.floor((p.y + Math.sin(a) * (run + 0.25)) * CR) * CW + Math.floor((p.x + Math.cos(a) * (run + 0.25)) * CR)] === 0) run += 0.25;
      if (run > best.run) best = { a, run };
    }
    const w = makeWeapon(id, 2, 1, true);
    w.traits = []; // plain gun: only its own mechanic
    p.weapons[0] = w; p.cur = 0;
    const d = Math.min(1.9, best.run - 0.6), pack = [];
    for (let i = 0; i < 5; i++) {
      const e = g.spawnEnemy('zombie', p.x + Math.cos(best.a) * d + Math.cos(i * 1.26) * 0.45, p.y + Math.sin(best.a) * d + Math.sin(i * 1.26) * 0.45, false, null); // no random affix: plain monsters
      e.spawnT = 0; e.maxHp = e.hp = 4000; e.def = { ...e.def, speed: 0, dmg: 0, mass: id === 'singularity' ? e.def.mass : 1e6 }; // rooted, so knock-back cannot push the pack out of a short gun's reach (the singularity has to be able to drag them)
      pack.push(e);
    }
    const seen = { bullets: new Set(), zones: new Set(), beams: 0, back: false, frozen: false, ramp: 0, hurt: 0, pull: 0, booms: 0, maxBullets: 0, flashArc: 0 };
    const start = pack.map(e => ({ x: e.x, y: e.y }));
    const until = performance.now() + 3200;
    await new Promise(done => {
      const watch = () => {
        for (const b of g.bullets) { seen.bullets.add(b.kind); if (b.back) seen.back = true; }
        seen.maxBullets = Math.max(seen.maxBullets, g.bullets.length);
        for (const z of g.zones) { seen.zones.add(z.kind); if (z.kind === 'flash' && z.arc) seen.flashArc = z.arc; if (z.kind === 'boom') seen.booms++; }
        seen.beams = Math.max(seen.beams, g.beams.length);
        seen.ramp = Math.max(seen.ramp, w.fx?.ramp ?? 0);
        if (pack.some(e => (e.frozenT ?? 0) > 0)) seen.frozen = true;
        const vortex = g.zones.find(z => z.kind === 'vortex');
        if (vortex) seen.pull = Math.max(seen.pull, ...pack.map((e, i) => Math.hypot(start[i].x - vortex.x, start[i].y - vortex.y) - Math.hypot(e.x - vortex.x, e.y - vortex.y)));
        if (performance.now() < until) requestAnimationFrame(watch); else done();
      };
      watch();
    });
    seen.hurt = pack.filter(e => e.hp < e.maxHp).length;
    return { ...seen, bullets: [...seen.bullets], zones: [...seen.zones], run: best.run };
  }, id);
  const shot = {};
  for (const id of [...NEW_FREE, ...NEW_FULL]) {
    const pending = fireAt(id);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `art/world/checks/new-gun-${id}.png` });
    shot[id] = await pending;
    assert.ok(shot[id].hurt > 0, `${id} hurts monsters (${JSON.stringify(shot[id])})`);
  }
  assert.ok(shot.stream.beams > 0 && shot.stream.ramp >= 10, `Spectre Stream is a beam that ramps while held (ramp ${shot.stream.ramp})`);
  assert.ok(shot.disc.bullets.includes('disc') && shot.disc.zones.includes('trail'), 'Grid Disc leaves a burning line');
  assert.ok(shot.sabre.zones.includes('flash') && shot.sabre.flashArc > 0.8 && shot.sabre.hurt >= 3, `Thunder Sabre cuts everything in a wide arc (${shot.sabre.hurt} hit)`);
  assert.ok(shot.glaive.bullets.includes('glaive') && shot.glaive.back, 'Star Glaive turns round and comes back');
  assert.ok(shot.swarm.bullets.includes('missile') && shot.swarm.maxBullets >= 4 && shot.swarm.zones.includes('boom'), 'Micro-Missile Pod fires a volley of exploding seekers');
  assert.ok(shot.singularity.bullets.includes('void') && shot.singularity.zones.includes('vortex') && shot.singularity.pull > 0.15 && shot.singularity.zones.includes('boom'), `Event Horizon drags monsters in, then explodes (pull ${shot.singularity.pull.toFixed(2)})`);
  assert.ok(shot.annihilator.bullets.includes('shell') && shot.annihilator.zones.includes('boom'), 'Annihilator fires exploding shells');
  assert.ok(shot.incinerator.bullets.includes('flame') && shot.incinerator.zones.includes('fire'), `Dragon's Breath leaves burning ground (${JSON.stringify(shot.incinerator)})`);
  assert.ok(shot.flamer.bullets.includes('flame') && shot.flamer.zones.includes('fire'), `The free Bug-Hunt Flamethrower is a real gun that sets the ground alight (${JSON.stringify(shot.flamer)})`);
  assert.ok(shot.lance.beams > 0 && shot.lance.zones.includes('trail') && shot.lance.hurt >= 3, 'Phase Lance pierces the pack and its wake keeps cutting');
  assert.ok(shot.cryo.beams > 0 && shot.cryo.frozen, 'Cryo Ray freezes a monster solid');

  // ---- in a friend's hands the special guns keep their trick ----
  const mate = await page.evaluate(async () => {
    const { makeWeapon } = await import('/src/game/data.ts');
    const g = window.__tot.game, p = g.p, out = {};
    g.enemies = [];
    p.x = window.__home.x; p.y = window.__home.y;
    const e = g.spawnEnemy('zombie', p.x + 1.2, p.y + 0.4, false, null); e.spawnT = 0; e.maxHp = e.hp = 4000; e.def = { ...e.def, speed: 0, dmg: 0 };
    for (const id of ['sabre', 'glaive', 'lance', 'singularity']) {
      g.bullets = []; g.zones = [];
      const friend = { x: p.x, y: p.y, weapon: makeWeapon(id, 2, 1, true), candy: 0, faceX: 1, faceY: 0 };
      g.friendShoot(friend, 0.016);
      out[id] = { zones: g.zones.map(z => z.kind), bullets: g.bullets.map(b => `${b.kind}:${b.by === friend}:${b.life > 0}`) };
    }
    g.enemies = []; g.bullets = []; g.zones = [];
    return out;
  });
  assert.ok(mate.sabre.zones.includes('flash') && !mate.sabre.bullets.length, `A friend swings the sabre (${JSON.stringify(mate.sabre)})`);
  assert.deepEqual(mate.glaive.bullets, ['glaive:true:true'], "A friend's glaive flies back to the friend");
  assert.ok(mate.lance.zones.includes('trail'), "A friend's lance leaves its wake");
  assert.deepEqual(mate.singularity.bullets, ['void:true:true'], "A friend's Event Horizon fires a real singularity");

  // ---- demolition ----
  const wreck = await page.evaluate(async () => {
    const g = window.__tot.game;
    g.enemies = []; g.bullets = []; g.zones = [];
    const boom = (pr, demolish) => g.explode(pr.x0 + pr.fw / 2, pr.y0 + pr.fh + 0.2, 2.6, 30, 'fire', true, false, { element: 'fire', demolish });
    const cars = g.map.props.filter(p => p.kind === 'car' && !p.removed), houses = g.map.houses.filter(h => h.prop.kind === 'house' && !h.visited && !h.trick);
    const car = cars[0], spared = cars.find(c => Math.hypot(c.x0 - car.x0, c.y0 - car.y0) > 8), house = houses[0];
    boom(spared, false); // an ordinary blast (a bottle rocket) leaves the street alone
    const ordinary = !!spared.wreck || spared.hp !== undefined;
    boom(car, true);
    const coins = g.pickups.filter(q => q.kind === 'coin').length;
    let shells = 0;
    while (!house.prop.wreck && shells < 8) { boom(house.prop, true); shells++; }
    g.p.x = house.door.x; g.p.y = house.door.y + 1.2;
    g.relightHouses();
    const loot = g.pickups.filter(q => Math.hypot(q.x - house.door.x, q.y - house.door.y) < 5).length;
    g.pickups = []; // the kid is standing in it: no level-up in the middle of the test
    return {
      ordinary, car: !!car.wreck, carBurning: car.burnT > 0, carBoom: car.boomT !== undefined, coins,
      shells, house: !!house.prop.wreck, gone: house.gone === true, shut: house.visited === true, dark: !house.light || house.light.i === 0,
      loot,
    };
  });
  assert.equal(wreck.ordinary, false, 'Guns without demolition leave cars alone');
  assert.ok(wreck.car && wreck.carBurning && wreck.carBoom, 'A demolition blast blows a car up and leaves it burning');
  assert.ok(wreck.coins > 0, 'A wrecked car drops coins');
  assert.ok(wreck.house && wreck.shells >= 2, `A house takes several shells to bring down (took ${wreck.shells})`);
  assert.ok(wreck.gone && wreck.shut && wreck.dark, 'A burnt-down house stays shut and dark when the porch lights come back');
  assert.ok(wreck.loot >= 10, 'A burnt-down house spills its loot');
  await page.waitForTimeout(350);
  await page.screenshot({ path: 'art/world/checks/demolition-boom.png' });
  await page.waitForTimeout(1600);
  await page.screenshot({ path: 'art/world/checks/demolition-wreck.png' });

  // ---- extreme treats ----
  const extreme = await page.evaluate(async () => {
    const { weaponStats, makeWeapon, SCROLL_BY_ID } = await import('/src/game/data.ts');
    const g = window.__tot.game, out = {};
    window.__longshot = SCROLL_BY_ID.longshot;
    g.pickups = []; g.zones = []; g.p.x = window.__home.x; g.p.y = window.__home.y; // away from the fire, back on the open street
    const base = { hp: g.stats.maxHp, shield: g.stats.maxShield };
    const withTreat = (id, read) => { g.scrolls = { [id]: 1 }; g.scrollOrder = [id]; g.recalcStats(); out[id] = read(); };
    withTreat('forcefield', () => ({ hp: g.stats.maxHp, shield: g.stats.maxShield - base.shield }));
    withTreat('berserk', () => ({ shield: g.stats.maxShield, dmg: g.stats.dmg }));
    withTreat('oneshot', () => { const w = makeWeapon('nerf', 0); w.traits = []; return { mag: weaponStats(w, g.stats).mag }; });
    withTreat('goldfever', () => { const at = (coins) => { g.p.coins = coins; return g.globalMore(); }; const none = at(0); return { coins500: +(at(500) / none).toFixed(2), cap: +(at(99999) / none).toFixed(2) }; });
    g.p.coins = 0;
    // Long-Distance Dedication: the same hit on a monster 12 m away, one at 4 m and one 2 m away, against the hit without the treat
    const struck = (metres) => { const e = g.spawnEnemy('zombie', g.p.x + metres, g.p.y, false, null); e.spawnT = 0; e.maxHp = e.hp = 1e6; g.applyHit(e, 100, false, 0, 0, 0, 0, 0, false, true); const lost = 1e6 - e.hp; e.dead = true; g.enemies = g.enemies.filter(q => q !== e); return lost; };
    g.scrolls = {}; g.scrollOrder = []; g.recalcStats();
    const plain = { far: struck(12), near: struck(2) };
    withTreat('longshot', () => ({ far: +(struck(12) / plain.far).toFixed(2), edge: +(struck(4) / plain.far).toFixed(2), near: +(struck(2) / plain.near).toFixed(2), free: !window.__longshot.premium, once: window.__longshot.max, desc: window.__longshot.desc }));
    // monster labels can be switched off, and the bars over monsters are half the size they were
    {
      const { settings } = await import('/src/game/settings.ts');
      const { renderer } = window.__tot, ctx = renderer.ctx;
      g.scrolls = {}; g.scrollOrder = []; g.recalcStats();
      const e = g.spawnEnemy('zombie', g.p.x + 2, g.p.y, false, null); e.spawnT = 0; e.affix = 'fireproof'; e.hp = e.maxHp * 0.5;
      const look = (names) => {
        settings.names = names;
        const texts = [], bars = [], fillText = ctx.fillText, fillRect = ctx.fillRect;
        ctx.fillText = function (...a) { texts.push(String(a[0])); return fillText.apply(this, a); };
        ctx.fillRect = function (...a) { if (this.fillStyle === '#e84a4a') bars.push([Math.round(a[2] * 10) / 10, a[3]]); return fillRect.apply(this, a); };
        try { renderer.render(g, 0.01); } finally { ctx.fillText = fillText; ctx.fillRect = fillRect; }
        return { named: texts.includes('Fireproof'), bars };
      };
      out.labels = { on: look(true), off: look(false) };
      settings.names = true; e.dead = true; g.enemies = g.enemies.filter(q => q !== e);
    }
    withTreat('mixtape', () => ({ dmg: g.stats.dmg }));
    g.scrolls = { mixtape: 2, token: 1 }; g.scrollOrder = ['mixtape', 'mixtape', 'token']; g.recalcStats();
    return { ...out, base };
  });
  assert.deepEqual(extreme.forcefield, { hp: 1, shield: 500 }, 'Deflector Shield Belt: 1 HP, +500 shield');
  assert.equal(extreme.berserk.shield, 0, "Barbarian's Blood Oath: no shield at all");
  assert.equal(extreme.oneshot.mag, 1, 'One in the Chamber: a one-round magazine');
  assert.deepEqual(extreme.goldfever, { coins500: 1.5, cap: 2.5 }, 'Temple Idol: +1% damage per 10 coins carried, up to +150%');
  assert.deepEqual(extreme.longshot, { far: 3, edge: 3, near: 0.5, free: true, once: 1, desc: '300% damage to monsters 4 m or more away from you, but -50% damage to monsters closer than 4 m' }, 'Long-Distance Dedication: triple damage from 4 m, half damage closer');
  assert.ok(extreme.labels.on.named && !extreme.labels.off.named, `Monster names can be switched off (${JSON.stringify(extreme.labels)})`);
  assert.deepEqual([extreme.labels.on.bars, extreme.labels.off.bars], [[[7.5, 2]], [[7.5, 2]]], 'A monster at half health shows a 15 by 2 bar, half full, with or without names');

  // ---- discarding from the side rail ----
  const before = await page.evaluate(() => { const g = window.__tot.game; return { state: g.state, treats: g.scrollOrder.join() }; });
  assert.deepEqual(before, { state: 'play', treats: 'mixtape,mixtape,token' }, 'Playing, with treats in the bag, before discarding');
  const rail = page.getByRole('button', { name: /^Mixtape.*Click to discard\.$/ });
  await rail.waitFor();
  await rail.click();
  await page.getByRole('dialog', { name: /^Discard / }).waitFor();
  assert.equal(await page.evaluate(() => window.__tot.game.state), 'discard', 'The game pauses on the question');
  await page.screenshot({ path: 'art/world/checks/discard-treat.png' });
  await page.getByRole('button', { name: 'No, keep it' }).click();
  assert.deepEqual(await page.evaluate(() => [window.__tot.game.state, window.__tot.game.scrolls.mixtape]), ['play', 2], 'No keeps the treat');
  await rail.click();
  await page.getByRole('button', { name: 'Yes, discard' }).click();
  assert.deepEqual(await page.evaluate(() => { const g = window.__tot.game; return [g.state, g.scrolls.mixtape, g.scrollOrder.join()]; }), ['play', 1, 'mixtape,token'], 'Yes throws one copy away');
  await page.getByRole('button', { name: /^Mixtape.*Click to discard\.$/ }).click();
  await page.getByRole('dialog', { name: /^Discard / }).waitFor(); // the Y key is the dialog's own shortcut
  await page.keyboard.press('y');
  await page.waitForFunction(() => window.__tot.game.state === 'play');
  assert.equal(await page.evaluate(() => window.__tot.game.scrolls.mixtape), undefined, 'The last copy leaves the rail');
  assert.equal(await page.getByRole('button', { name: /^Mixtape.*Click to discard\.$/ }).count(), 0);

  assert.deepEqual(errors, [], 'No page errors');
  console.log('new guns, demolition, treat tiers and discard: ok');
} finally { await browser.close(); }
