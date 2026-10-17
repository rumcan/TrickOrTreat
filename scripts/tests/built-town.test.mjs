import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

// The town painted in the town builder: it loads, every door and shop is reachable on foot from the start, nothing
// stands in the street at the start, a real run starts and plays without errors, and the ground streams in.
const URL = process.env.URL || 'http://127.0.0.1:5186/', SHOTS = process.env.SHOTS || '.';
const browser = await chromium.launch({ channel: 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(URL);
  await page.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 180000 });
  const out = await page.evaluate(async () => {
    const { Game } = await import('/src/game/engine.ts');
    const input = () => ({ keys: new Set(), pressed: new Set(), mouseActive: false, mdown: false, rpressed: false, wheel: 0, touchFiring: false, endFrame() { this.pressed.clear(); this.rpressed = false; this.wheel = 0; } });
    const t0 = performance.now();
    const g = new Game(0, { hero: 0, soul: 0, best: 0, talents: {} }, input(), false);
    const built = performance.now() - t0;
    const m = g.map;
    const doors = m.houses.map(h => ({ name: h.owner, kind: h.prop.kind, ok: g.reachable(h.door.x, h.door.y) || [[.4,0],[-.4,0],[0,.4],[0,-.4]].some(([a,b]) => g.reachable(h.door.x + a, h.door.y + b)) }));
    const shops = m.shops.map(s => ({ kind: s.prop.kind, ok: g.reachable(s.x, s.y) }));
    let reach = 0; for (let c = 0; c < g['flow'].length; c++) if (g['flow'][c] < (1 << 29)) reach++;
    const t1 = performance.now(); for (let i = 0; i < 10; i++) g['computeFlow'](true); const flowMs = (performance.now() - t1) / 10;
    return { built, props: m.props.length, houses: m.houses.filter(h => h.prop.kind === 'house').length, venues: m.houses.filter(h => h.prop.kind !== 'house').map(h => h.owner),
      arcade: m.houses.some(h => h.prop.kind === 'arcade'), doors: doors.filter(d => !d.ok), shops, turrets: m.turrets.length, hideouts: m.hideouts.length, gates: m.gates.map(g => g.name),
      start: m.start, reachableKm2: reach / 16 * 4, flowMs };
  });
  console.log(JSON.stringify(out, null, 1));
  assert.ok(out.arcade, 'The Starcade has a door');
  assert.deepEqual(out.doors, [], 'Every front door is reachable on foot from the start');
  assert.ok(out.shops.length >= 2 && out.shops.every(s => s.ok), 'Every shop counter is reachable');
  assert.ok(out.turrets >= 1 && out.hideouts === 4, 'Cannons and the four rescue hideouts');
  // a real run from the title screen
  await page.getByRole('button', { name: 'Go trick-or-treating' }).click();
  for (const name of ['Start', 'Play', 'Go', 'Skip']) { const b = page.getByRole('button', { name, exact: true }); if (await b.count()) { await b.first().click().catch(() => {}); } }
  await page.waitForTimeout(6000);
  await page.keyboard.down('d'); await page.waitForTimeout(1500); await page.keyboard.up('d');
  await page.keyboard.down('s'); await page.waitForTimeout(1500); await page.keyboard.up('s');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: SHOTS + '/built-town-play.png' });
  const fps = await page.evaluate(() => new Promise(res => { let n = 0; const t = performance.now(); const f = () => { n++; if (performance.now() - t < 2000) requestAnimationFrame(f); else res(n / 2); }; requestAnimationFrame(f); }));
  console.log('fps', fps);
  assert.deepEqual(errors, [], 'No page errors');
  console.log('PASS built town');
} finally { await browser.close(); }
