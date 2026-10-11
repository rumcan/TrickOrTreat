import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

// Waves and bosses go together: while a boss lives the waves, hordes and elites wait, and the boss fights with its own
// kind of minions (an escort on arrival, then squads up to a cap). When it falls the wave clock picks up where it was.
const browser = await chromium.launch({ channel: 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 120000 });
  const out = await page.evaluate(async () => {
    const { Game, BOSS_MINIONS, BUY_WINDOW } = await import('/src/game/engine.ts');
    const { expansion } = await import('/src/game/expansion.ts');
    expansion.preview();
    const input = () => ({ keys: new Set(), pressed: new Set(), mouseActive: false, mdown: false, rpressed: false, wheel: 0, touchFiring: false, endFrame() { this.pressed.clear(); this.rpressed = false; this.wheel = 0; } });
    const g = new Game(0, { hero: 0, soul: 0, best: 0, talents: {} }, input(), true, 1337);
    g.state = 'play'; g.p.invuln = 1e9;
    const step = (seconds) => { for (let i = 0; i < seconds * 10; i++) { g.time += 0.1; g.director(0.1); g.enemies = g.enemies.filter(e => !e.dead); } };
    const rounds = [];
    for (const type of ['hex', 'alpha', 'warden', 'king']) {
      g.enemies = []; g.calmT = 0; g.bossBreak = false;
      step(Math.max(0.2, g.nextBossAt - g.time + 0.2));
      const boss = g.boss;
      if (!boss || boss.type !== type) { rounds.push({ type, error: `no ${type}: ${boss?.type}` }); break; }
      const others = g.enemies.filter(e => e !== boss && !e.minion).length; // whatever the wave had left on the street
      const escort = g.enemies.filter(e => e.minion);
      const wave = g.wave, snap = g.snapshot(), elitesBefore = g.enemies.filter(e => e.type === 'werewolf').length;
      step(75); // well over a wave, a horde mark and an elite timer
      const crowd = g.enemies.filter(e => e.minion);
      rounds.push({
        type, escort: escort.length, escortKinds: [...new Set(escort.map(e => e.type))].sort().join(),
        wanted: [...BOSS_MINIONS[type]].sort().join(), allowed: crowd.every(e => BOSS_MINIONS[type].includes(e.type)),
        crowd: crowd.length, newcomers: g.enemies.filter(e => e !== boss && !e.minion).length - others,
        waveHeld: g.wave === wave, hud: snap.bossFight, elites: g.enemies.filter(e => e.type === 'werewolf').length - elitesBefore,
      });
      g.killEnemy(boss);
      const afterKill = { calm: g.calmT, minionsLeft: g.enemies.filter(e => e.minion).length };
      rounds[rounds.length - 1].afterKill = afterKill;
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
    run(65); const before = free.wave; // (the free game's own boss only comes at 5:00)
    free.boss = free.spawnEnemy('king', free.p.x + 4, free.p.y); run(130); const during = free.wave, hudDuring = free.snapshot().bossFight;
    free.boss.dead = true; free.boss = null; run(61); const after = free.wave;
    return { rounds, quiet: BUY_WINDOW, waves: { before, during, after, hudDuring, wave } };
  });
  assert.equal(out.rounds.length, 4);
  for (const r of out.rounds) {
    assert.ok(!r.error, r.error);
    assert.ok(r.escort >= 5, `${r.type} arrives with an escort (${r.escort})`);
    assert.equal(r.escortKinds.split(',').every(k => r.wanted.split(',').includes(k)), true, `${r.type}'s escort is its own kind (${r.escortKinds} of ${r.wanted})`);
    assert.ok(r.allowed && r.crowd >= r.escort && r.crowd <= 18, `${r.type} keeps a capped crowd of its own minions (${r.crowd})`);
    assert.equal(r.newcomers, 0, `No ordinary wave monsters arrive during the ${r.type} fight`);
    assert.ok(r.waveHeld && r.hud && r.elites === 0, `The wave waits for ${r.type}: no new wave, no elite`);
    assert.deepEqual(r.afterKill, { calm: out.quiet, minionsLeft: 0 }, `${r.type}'s crowd leaves with it and the quiet begins`);
    assert.ok(r.quietPaused, 'The wave clock stands still during the quiet');
  }
  assert.equal(new Set(out.rounds.map(r => r.wanted)).size, 4, 'Four bosses, four different crowds');
  assert.deepEqual([out.waves.before, out.waves.during, out.waves.after, out.waves.hudDuring], [2, 2, 3, true], 'A wave passes, none during a 130s boss fight, the next one a minute after it');
  assert.deepEqual(errors, [], 'No page errors');
  console.log(`boss minions: ${out.rounds.map(r => `${r.type} ${r.wanted} (${r.escort}→${r.crowd})`).join(' · ')}; waves wait for the boss: ok`);
} finally { await browser.close(); }
