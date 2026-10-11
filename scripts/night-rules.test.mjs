import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

// Rules of the night that changed together:
//  · a level-up waits for a doorbell in progress (bowl first, then the level-ups)
//  · the shop no longer sells treats; it brings back a friend who is out for the night
//  · the Starcade closes after wave 5: whoever is inside is put out, the sign says CLOSED, the door stays shut
//  · destruction is part of the normal game: a free gun's rockets blow a parked car up
//  · walking in and out earns no Essence; hide and seek is shelved, so a full-game run starts like any other
const browser = await chromium.launch({ channel: 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 120000 });
  const engine = await page.evaluate(async () => {
    const { Game, ARCADE_LAST_WAVE, BLAST_WRECK, campaignOffered } = await import('/src/game/engine.ts');
    const { buildArcadeMap } = await import('/src/game/arcade-map.ts');
    const d = await import('/src/game/data.ts');
    const { expansion, hasFullGame } = await import('/src/game/expansion.ts');
    const input = () => ({ keys: new Set(), pressed: new Set(), mouseActive: false, mdown: false, rpressed: false, wheel: 0, touchFiring: false, endFrame() { this.pressed.clear(); this.rpressed = false; this.wheel = 0; } });
    const make = () => { const g = new Game(0, { hero: 0, soul: 0, best: 0, talents: {} }, input(), false, 1337); g.state = 'play'; g.director = () => {}; g.enemies = []; g.p.invuln = 1e9; g.pickups = []; return g; };
    const out = { lastWave: ARCADE_LAST_WAVE, blast: BLAST_WRECK };

    // ---- nothing for walking in and out ----
    { const g = make(); g.endRun(false); out.quit = { earned: g.soulEarned, soul: g.save.soul }; }

    // ---- a level-up waits for the doorbell ----
    {
      const g = make(), h = g.tutorialHouse; h.trick = false;
      g.startTot(h);
      g.pendingLevels = 2; g.p.level += 2;
      const seen = [];
      for (let i = 0; i < 30 * 8 && seen.length < 4; i++) {
        g.update(1 / 30);
        if (g.state === 'levelup') {
          seen.push(`${g.choiceMode}${g.tot ? ' during the doorbell' : ''}`);
          if (g.choices[0]) g.choose(g.choices[0].id); else g.chooseGun(0);
          if (g.state === 'inspect') g.takeInspected?.(0);
        }
      }
      out.order = seen;
    }

    // ---- the shop brings a lost friend back ----
    {
      const g = make(); g.addFriend(1); g.addFriend(2);
      const [sam, jess] = g.friends;
      sam.hp = 0; sam.downT = 0; sam.x = g.p.x - 9;
      for (let i = 0; i < 30 * (g.friendDownTime + 1); i++) g.updateTeam(1 / 30);
      const lost = { inTeam: g.friends.includes(sam), list: g.lostFriends.map(f => f.hero), offer: g.revivable.map(f => f.hero), cost: g.reviveCost() };
      g.p.coins = 50; g.shopRevive(1);
      const broke = g.friends.includes(sam);
      g.p.coins = 500; g.shopRevive(1);
      const back = { inTeam: g.friends.includes(sam), full: sam.hp === sam.maxHp, near: Math.hypot(sam.x - g.p.x, sam.y - g.p.y) < 3, coins: g.p.coins, lostLeft: g.lostFriends.length, next: g.reviveCost(), gun: !!sam.weapon };
      // a friend lying down right now can be picked up there too
      jess.hp = 0; jess.downT = 0;
      const down = g.revivable.map(f => f.hero);
      g.shopRevive(2);
      out.revive = { lost, broke, back, down, jessUp: jess.hp === jess.maxHp, treatsSold: false };
    }

    // ---- the Starcade closes after wave 5 ----
    {
      const g = make(), door = g.map.houses.find(h => h.prop.kind === 'arcade').door;
      g.p.x = door.x; g.p.y = door.y + 0.6;
      g.updateInteract(); const openLabel = g.interact?.label;
      g.travelArcade('arcade');
      const where = () => g.map.kind === 'arcade' ? 'arcade' : 'town';
      const inside = where();
      g.wave = ARCADE_LAST_WAVE; g.update(1 / 30);
      const stillIn = where();
      const before = g.housesToGo;
      g.wave = ARCADE_LAST_WAVE + 1; g.update(1 / 30);
      const out1 = { map: where(), banner: g.banner?.text, shut: g.arcadeShut, standsStopCounting: before - g.housesToGo };
      g.p.x = door.x; g.p.y = door.y + 0.6; g.updateInteract();
      const label = g.interact?.label ?? null;
      g.travelArcade('arcade');
      out.arcade = { openLabel, inside, stillIn, ...out1, label, reentered: where() };
    }

    // ---- destruction with a free gun, in the real loop: the kid holds the trigger on a parked car ----
    {
      const g = make();
      const { cellAt } = await import('/src/game/map.ts');
      // a car with open ground three tiles to one side of it, and nothing in between
      let target = null, stand = null;
      for (const c of g.map.props.filter(p => p.kind === 'car' && !p.removed)) {
        const cx = c.x0 + c.fw / 2, cy = c.y0 + c.fh / 2;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const edge = (dx ? c.fw : c.fh) / 2 + 0.3;
          let clear = true;
          for (let t = edge; t <= edge + 2.6; t += 0.2) if (cellAt(g.map, cx + dx * t, cy + dy * t) !== 0) { clear = false; break; }
          if (clear) { target = c; stand = { x: cx + dx * (edge + 2.4), y: cy + dy * (edge + 2.4), cx, cy }; break; }
        }
        if (target) break;
      }
      g.p.x = stand.x; g.p.y = stand.y;
      const rocket = d.makeWeapon('rocket', 0); rocket.traits = [];
      g.p.weapons[0] = rocket; g.p.weapons[1] = null; g.p.cur = 0;
      g.mouseWorld = () => ({ x: stand.cx, y: stand.cy });
      g.input.mouseActive = true; g.input.mdown = true;
      const mag = d.weaponStats(rocket, g.stats).mag;
      let frames = 0, shots = 0, ammo = rocket.ammo;
      for (; frames < 30 * 25 && !target.wreck; frames++) {
        g.p.x = stand.x; g.p.y = stand.y;
        g.update(1 / 30);
        if (rocket.ammo < ammo) shots += ammo - rocket.ammo;
        ammo = rocket.ammo;
        if (g.state !== 'play') { g.state = 'play'; g.choices = []; g.gunChoices = []; g.pendingLevels = 0; }
      }
      out.wreck = { free: !rocket.def.premium && !rocket.def.demolish, gun: rocket.def.name, mag, wrecked: !!target.wreck, burning: target.burnT > 0, shots, seconds: +(frames / 30).toFixed(1), coins: g.pickups.some(k => k.kind === 'coin') };
    }

    // ---- hide and seek is shelved: a full-game player's run is the same night, on the bigger map, with door-bell friends ----
    expansion.preview();
    {
      const free = make().map.houses.length, g = make();
      let offers = 0; for (let i = 0; i < 200; i++) { g.openLevelUp('house', 3, 0); if (g.friendChoice !== null) offers++; }
      out.shelved = { offered: campaignOffered(), full: hasFullGame(), campaign: g.campaign, intro: new Game(0, { hero: 0, soul: 0, best: 0, talents: {} }, input(), false, 7).state, biggerTown: g.map.houses.length >= free, doorFriends: offers > 10 };
    }
    return out;
  });
  assert.deepEqual(engine.quit, { earned: 0, soul: 0 }, 'Starting a run and leaving it earns no Essence');
  assert.deepEqual(engine.order.slice(0, 3), ['house', 'level', 'level'], `A level-up waits for the doorbell: the bowl comes first, then the level-ups (${engine.order})`);
  assert.deepEqual(engine.revive.lost, { inTeam: false, list: [1], offer: [1], cost: 120 }, 'A friend nobody reached is out for the night, and the shop offers to bring them back');
  assert.equal(engine.revive.broke, false, 'Not without the coins');
  assert.deepEqual(engine.revive.back, { inTeam: true, full: true, near: true, coins: 380, lostLeft: 0, next: 180, gun: true }, 'The shop brings the friend back beside the kid at full health; the next one costs more');
  assert.deepEqual([engine.revive.down, engine.revive.jessUp], [[2], true], 'A friend who is down right now can be helped at the shop too');
  assert.equal(engine.lastWave, 5);
  assert.deepEqual(engine.arcade, { openLabel: 'Enter the Starcade', inside: 'arcade', stillIn: 'arcade', map: 'town', banner: 'THE STARCADE IS CLOSED', shut: true, standsStopCounting: 3, label: engine.arcade.label, reentered: 'town' },
    'After wave 5 the Starcade puts the kid out, says so, stops counting its stands, and stays shut');
  assert.ok(engine.arcade.label !== 'Enter the Starcade', 'The closed door offers nothing');
  assert.ok(engine.wreck.free && engine.wreck.wrecked && engine.wreck.burning && engine.wreck.coins, `A free gun's rockets blow a parked car up in normal play (${JSON.stringify(engine.wreck)})`);
  assert.ok(engine.wreck.shots >= 2 && engine.wreck.shots <= 8, `It takes a few rockets, not one and not a magazine (${engine.wreck.shots})`);
  assert.deepEqual(engine.shelved, { offered: false, full: true, campaign: false, intro: 'play', biggerTown: true, doorFriends: true }, 'Hide and seek is shelved: the full game is the same night on the bigger map');

  // ---- on screen: the shop has no treat card, the poster no longer sells destruction, and the campaign button is gone ----
  await page.getByRole('button', { name: 'Go trick-or-treating' }).click();
  await page.waitForFunction(() => window.__tot?.game?.state === 'play');
  assert.equal(await page.evaluate(() => window.__tot.game.campaign), false, 'The app starts the ordinary night');
  await page.evaluate(() => { const g = window.__tot.game; g.director = () => {}; g.enemies = []; g.p.invuln = 1e9; g.state = 'shop'; });
  const shop = page.locator('.hm-modal');
  await shop.getByText('Bring a friend back').waitFor();
  assert.equal(await shop.getByText('Mystery treat').count(), 0, 'The shop no longer sells treats');
  assert.match(await shop.innerText(), /Nobody is missing/);
  // closing time, drawn on the door
  const texts = () => page.evaluate(() => {
    const { game: g, renderer } = window.__tot, ctx = renderer.ctx, seen = [], fillText = ctx.fillText;
    ctx.fillText = function (...a) { seen.push(String(a[0])); return fillText.apply(this, a); };
    try { renderer.render(g, 0.01); } finally { ctx.fillText = fillText; }
    return seen;
  });
  await page.evaluate(() => {
    const g = window.__tot.game; g.state = 'play'; g.treatGuideComplete = true; g.tutorialHouse = null; g.arcadeSeen = true;
    const door = g.map.houses.find(h => h.prop.kind === 'arcade').door; g.p.x = door.x; g.p.y = door.y + 2;
  });
  await page.waitForTimeout(1200); // the camera walks over to the door
  const open = await texts();
  await page.evaluate(() => { window.__tot.game.wave = 6; });
  await page.waitForTimeout(300);
  const shut = await texts();
  const sign = { open: open.includes('ENTER HERE'), shut: shut.includes('CLOSED') && !shut.includes('ENTER HERE') };
  assert.deepEqual(sign, { open: true, shut: true }, 'The door says ENTER HERE until closing time, then CLOSED');
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 120000 });
  await page.getByRole('button', { name: 'Support the creator' }).click();
  const poster = page.getByRole('dialog', { name: 'THE FULL GAME' });
  await poster.waitFor();
  const text = await poster.innerText();
  assert.ok(!/wreck|destruction|hide.and.seek|rescue campaign/i.test(text.replace(/Wrecks cars and houses\.?/g, '')), 'The full-game poster no longer sells destruction or hide and seek');
  assert.match(text, /Twenty-four bosses/);
  assert.deepEqual(errors, [], 'No page errors');
  console.log(`night rules: no Essence for an empty run; bowl before level-ups; shop revives friends; Starcade closes after wave ${engine.lastWave}; a free gun wrecks a car in ${engine.wreck.shots} rockets; hide and seek shelved: ok`);
} finally { await browser.close(); }
