import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ channel: 'msedge' });
try {
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 120000 });
  const result = await page.evaluate(async () => {
    const { Game } = await import('/src/game/engine.ts');
    const { SCROLL_BY_ID, TALENTS } = await import('/src/game/data.ts');
    const input = { keys: new Set(), pressed: new Set(), mouseActive: false, mdown: false, wheel: 0, endFrame() {} };
    const g = new Game(0, { hero: 0, soul: 0, best: 0, talents: {} }, input, false, 1337);
    const require = (condition, message) => { if (!condition) throw new Error(message); };
    const pickup = (distance, kind = 'xp1', age = 1) => {
      const k = { x: g.p.x + distance, y: g.p.y, z: 0, vz: 0, vx: 0, vy: 0, kind, value: 1, mag: false, t: age, dead: false };
      g.pickups = [k]; g.updatePickups(.01); return k;
    };
    for (const kind of ['xp1', 'xp2', 'xp3', 'coin', 'heal']) {
      require(pickup(.99, kind).mag, `${kind} attracts within one unit`);
      require(!pickup(1.01, kind).mag && !pickup(1.69, kind).mag, `${kind} outside reduced radius stays on ground`);
    }
    require(!pickup(.8, 'xp1', .1).mag, 'Fresh drop grace period stays intact');
    require(pickup(.2).dead, 'Walking onto loot still collects it');
    for (const kind of ['weapon', 'costume', 'chest']) require(!pickup(.8, kind).mag, `${kind} still requires interaction`);
    SCROLL_BY_ID.magnet.apply(g.stats);
    require(pickup(1.39).mag && !pickup(1.41).mag, 'Tractor Beam retains its 40% upgrade');
    TALENTS.find(t => t.id === 'pockets').apply(g.stats, 3);
    const radius = g.stats.magnet;
    require(pickup(radius - .01).mag && !pickup(radius + .01).mag, 'Talent and treat bonuses still stack on the nerfed base');
    return { baseRadius: 1, upgradedRadius: radius, radiusReductionPercent: Math.round((1 - 1 / 1.7) * 100) };
  });
  assert.deepEqual(errors, []); console.log(JSON.stringify(result));
  console.log('Reduced pickup boundaries, XP/coins/healing, fresh-drop delay, manual items and stacked upgrades passed.');
} finally { await browser.close(); }
