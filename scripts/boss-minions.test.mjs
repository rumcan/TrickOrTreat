import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

// Waves and bosses go together: while a boss lives the waves, hordes and elites wait, and the boss fights with its own
// kind of minions (an escort on arrival, then squads up to a cap). When it falls the wave clock picks up where it was,
// and it drops a magnet that gathers every coin and candy on the map into a pile where it fell.
const browser = await chromium.launch({ channel: 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.TOT_ARCADE_URL||'http://127.0.0.1:5190/');
  await page.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 120000 });
  const out = await page.evaluate(async () => {
    const { Game, BOSS_MINIONS, BUY_WINDOW } = await import('/src/game/engine.ts');
    const {WAVE_BOSSES}=await import('/src/game/boss-roster.ts');
    const { expansion } = await import('/src/game/expansion.ts');
    expansion.preview();
    const input = () => ({ keys: new Set(), pressed: new Set(), mouseActive: false, mdown: false, rpressed: false, wheel: 0, touchFiring: false, endFrame() { this.pressed.clear(); this.rpressed = false; this.wheel = 0; } });
    const g = new Game(0, { hero: 0, soul: 0, best: 0, talents: {} }, input(), true, 1337);
    g.state = 'play'; g.p.invuln = 1e9;
    const step = (seconds) => { for (let i = 0; i < seconds * 10; i++) { g.time += 0.1; g.director(0.1); g.enemies = g.enemies.filter(e => !e.dead); } };
    const rounds = [];
    for (const type of WAVE_BOSSES) {
      g.enemies = []; g.calmT = 0; g.bossBreak = false;
      step(Math.max(0.2, g.nextBossAt - g.time - 3));
      for (let i = 0; i < 12; i++) g.spawnEnemy('skeleton', g.p.x + 4 + i * 0.3, g.p.y + 3, false, null); // what the wave left on the street
      step(3.2);
      const boss = g.boss;
      if (!boss || boss.type !== type) { rounds.push({ type, error: `no ${type}: ${boss?.type}` }); break; }
      const others = g.enemies.filter(e => e !== boss && !e.minion).length; // whatever the wave had left on the street
      const escort = g.enemies.filter(e => e.minion);
      const wave = g.wave, snap = g.snapshot(), elitesBefore = g.enemies.filter(e => e.type === 'werewolf').length;
      step(75); // well over a wave, a horde mark and an elite timer
      const crowd = g.enemies.filter(e => e.minion);
      rounds.push({
        type, leftovers: others, escort: escort.length, escortKinds: [...new Set(escort.map(e => e.type))].sort().join(),
        wanted: [...BOSS_MINIONS[type]].sort().join(), allowed: crowd.every(e => BOSS_MINIONS[type].includes(e.type)),
        crowd: crowd.length, newcomers: g.enemies.filter(e => e !== boss && !e.minion).length - others,
        waveHeld: g.wave === wave, hud: snap.bossFight, elites: g.enemies.filter(e => e.type === 'werewolf').length - elitesBefore,
      });
      // loot lying all over town, some of it about to be swept up, plus things the magnet leaves alone
      g.pickups = [];
      const far = [[30, 0, 'coin'], [-25, 18, 'xp1'], [0, -40, 'xp3'], [12, 12, 'heal']].map(([dx, dy, kind]) => { g.dropPickup(boss.x + dx, boss.y + dy, kind, 2); const k = g.pickups[g.pickups.length - 1]; k.t = 58; return k; });
      g.dropPickup(boss.x + 20, boss.y, 'chest', 0); const bag = g.pickups[g.pickups.length - 1], bagAt = bag.x;
      const fell = { x: boss.x, y: boss.y };
      g.killEnemy(boss);
      const magnet = { there: !!g.lootMagnet && g.lootMagnet.x === fell.x && g.lootMagnet.y === fell.y, flying: far.every(k => !!k.pull) && !bag.pull };
      g.p.x = fell.x + 12; g.p.y = fell.y; // the kid is not standing on the pile
      for (let i = 0; i < 4 * 30; i++) g.updatePickups(1 / 30);
      magnet.piled = far.every(k => g.pickups.includes(k) && !k.pull && Math.hypot(k.x - fell.x, k.y - fell.y) < 0.9);
      magnet.fresh = far.every(k => k.t < 10); magnet.bagStays = Math.abs(bag.x - bagAt) < 3 && g.pickups.includes(bag);
      for (let i = 0; i < 4 * 30; i++) g.updatePickups(1 / 30);
      magnet.gone = g.lootMagnet === null;
      g.p.x = fell.x; g.p.y = fell.y; const coins = g.p.coins;
      for (let i = 0; i < 3 * 30; i++) g.updatePickups(1 / 30);
      magnet.collected = far.every(k => !g.pickups.includes(k)) && g.p.coins > coins;
      g.pickups = [];
      const afterKill = { calm: g.calmT, minionsLeft: g.enemies.filter(e => e.minion).length };
      rounds[rounds.length - 1].afterKill = afterKill; rounds[rounds.length - 1].magnet = magnet;
      // the quiet does not eat wave time either
      const pause = g.wavePause; g.bossBreak = false; step(5);
      rounds[rounds.length - 1].quietPaused = g.wavePause - pause > 4.5 && g.wave === wave;
      g.calmT = 0;
    }
    // afterwards the waves carry on: a minute of street time brings the next wave
    const wave = g.wave; g.enemies = []; g.boss = null;
    const free = new Game(0, { hero: 0, soul: 0, best: 0, talents: {} }, input(), false, 7);
    free.state = 'play'; free.p.invuln = 1e9;
    const run = (seconds) => { for (let i = 0; i < seconds * 10; i++) { free.time += 0.1; free.director(0.1); } };
    run(65); const before = free.wave;
    free.boss = free.spawnEnemy('king', free.p.x + 4, free.p.y); run(130); const during = free.wave, hudDuring = free.snapshot().bossFight;
    free.killEnemy(free.boss); free.bossBreak=false; free.calmT=0; run(61); const after = free.wave;
    return { rounds, quiet: BUY_WINDOW, waves: { before, during, after, hudDuring, wave } };
  });
  assert.equal(out.rounds.length, 24);
  for (const r of out.rounds) {
    assert.ok(!r.error, r.error);
    assert.ok(r.escort >= 8, `${r.type} arrives with an escort (${r.escort})`);
    assert.equal(r.leftovers, 0, `The wave's own monsters leave the street when ${r.type} arrives`);
    assert.equal(r.escortKinds.split(',').every(k => r.wanted.split(',').includes(k)), true, `${r.type}'s escort is its own kind (${r.escortKinds} of ${r.wanted})`);
    assert.ok(r.allowed && r.crowd >= r.escort && r.crowd <= 24, `${r.type} keeps a capped crowd of its own minions (${r.crowd})`);
    assert.equal(r.newcomers, 0, `No ordinary wave monsters arrive during the ${r.type} fight`);
    assert.ok(r.waveHeld && r.hud && r.elites === 0, `The wave waits for ${r.type}: no new wave, no elite`);
    assert.deepEqual(r.afterKill, { calm: out.quiet, minionsLeft: 0 }, `${r.type}'s crowd leaves with it and the quiet begins`);
    assert.ok(r.quietPaused, 'The wave clock stands still during the quiet');
    assert.deepEqual(r.magnet, { there: true, flying: true, piled: true, fresh: true, bagStays: true, gone: true, collected: true }, `${r.type} drops a magnet: far-off coins and candy pile up where it fell, with a fresh minute, and the kid picks them up there`);
  }
  assert.equal(new Set(out.rounds.map(r => r.wanted)).size, 24, 'Every boss has its own crowd');
  assert.deepEqual([out.waves.before, out.waves.during, out.waves.after, out.waves.hudDuring], [1, 1, 2, true], 'Only defeating a boss advances the wave; long fights do not skip encounters');
  assert.deepEqual(errors, [], 'No page errors');
  console.log(`boss minions: ${out.rounds.map(r => `${r.type} ${r.wanted} (${r.escort}→${r.crowd})`).join(' · ')}; waves wait for the boss: ok`);
} finally { await browser.close(); }
