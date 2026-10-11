import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge' });
try {
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 120000 });
  await page.getByRole('button', { name: /Preview expansion locally/ }).click();
  await page.getByRole('button', { name: /Play rescue campaign/ }).click();
  await page.getByRole('button', { name: /skip intro/ }).click();
  await page.waitForFunction(() => window.__tot?.game.state === 'play');
  const result = await page.evaluate(async () => {
    const g = window.__tot.game, types = ['hex', 'alpha', 'warden', 'king'];
    const lastHp = {}, lastThreat = {}, bosses = [];
    g.p.invuln = 999;
    for (const type of types) {
      g.time = g.nextBossAt; g.director(.001);
      if (g.boss?.type !== type) throw new Error('Initial boss order changed');
      lastHp[type] = g.boss.maxHp; lastThreat[type] = g.threat();
      g.killEnemy(g.boss); g.bossBreak = false; g.calmT = 0; // straight on to the next one: the quiet is checked below
    }
    if (!g.friends.some(f => f.status !== 'rescued')) throw new Error('Test must retain missing friends');
    g.pickups = []; g.pendingLevels = 0;
    for (let i = 0; i < 120 && !g.endless; i++) g.update(.05);
    if (!g.endless || !Number.isFinite(g.nextBossAt)) throw new Error('Missing friends blocked the restart');
    if (!(g.snapshot().bossIn > 0)) throw new Error('Missing next-boss countdown');
    for (let i = 0; i < 12; i++) {
      while (g.time < g.nextBossAt) {
        const dt = Math.min(30, g.nextBossAt - g.time);
        g.time += dt; g.updateEndless(dt);
      }
      const boss = g.boss, type = types[i % types.length];
      if (!boss || boss.type !== type) throw new Error(`Boss cycle stopped at encounter ${i}`);
      if (!(boss.maxHp > lastHp[type] && g.threat() > lastThreat[type])) throw new Error(`${type} did not get stronger`);
      lastHp[type] = boss.maxHp; lastThreat[type] = g.threat();
      bosses.push({ type, hp: Math.round(boss.maxHp), damageScale: Number(g.threat().toFixed(2)) });
      g.killEnemy(boss);
      // no shop pops up: the kid keeps playing, in 20 quiet seconds with nothing on the street
      if (g.state !== 'play' || g.calmT !== 20 || g.enemies.length || g.ebullets.length) throw new Error('Boss kill lost its quiet buy window');
      if (g.nextBossAt !== g.time + 90 + 20) throw new Error('Wrong recurring boss interval');
      const wave = g.wave, next = g.nextBossAt;
      for (let k = 0; k < 150; k++) g.update(.05); // about five of the twenty seconds (a frame is 1/30 s at most)
      if (g.state !== 'play' || g.enemies.length || g.boss || g.wave !== wave || g.nextBossAt !== next) throw new Error('Monsters came back during the quiet');
      if (!(g.calmT > 14.5 && g.calmT < 16) || !(g.snapshot().calm > 0)) throw new Error(`The quiet is not counting down (${g.calmT})`);
      g.state = 'shop'; const left = g.calmT; g.update(5);
      if (g.calmT !== left) throw new Error('The quiet ran out while shopping');
      g.closeShop(); g.calmT = 0; g.pickups = []; g.pendingLevels = 0;
    }
    const { Game } = await import('/src/game/engine.ts');
    const free = new Game(0, { hero: 0, soul: 0, best: 0, talents: {} }, g.input, false, 1337);
    free.p.invuln = 999; free.time = 300; free.director(.001);
    if (free.boss?.type !== 'king') throw new Error('Free survival opening boss changed');
    free.killEnemy(free.boss); free.pickups = []; free.pendingLevels = 0;
    if (free.state !== 'play' || free.calmT !== 20) throw new Error('Free survival opens a shop after its boss');
    for (let i = 0; i < 120 && !free.endless; i++) free.update(.05);
    if (!free.endless) throw new Error('Free survival did not enter the recurring cycle');
    free.calmT = 0; free.time = free.nextBossAt; free.updateEndless(.001);
    if (free.boss?.type !== 'hex' || free.boss.maxHp <= free.boss.def.hp) throw new Error('Free survival did not get a stronger returning boss');
    return { missingFriends: g.friends.filter(f => f.status !== 'rescued').length, bosses, freeCycle: true };
  });
  assert.equal(result.bosses.length, 12);
  assert.equal(result.missingFriends, 4);
  assert.equal(result.freeCycle, true);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify(result));
  console.log('Three recurring boss rounds grew stronger, missing friends did not block them, and every kill gave 20 quiet seconds with no shop popping up.');
} finally { await browser.close(); }
