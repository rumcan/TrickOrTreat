import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

// After every boss the Candy Lady's stand and the candy machines move to a new, reachable pitch.
const browser = await chromium.launch({ channel: 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 120000 });
  const result = await page.evaluate(async () => {
    const { Game } = await import('/src/game/engine.ts');
    const { blockedCircle } = await import('/src/game/map.ts');
    const input = () => ({ keys: new Set(), pressed: new Set(), rpressed: false, mdown: false, mouseActive: false, wheel: 0, touchMoveX: 0, touchMoveY: 0, endFrame() { this.pressed.clear(); }, clearTouch() {} });
    const require = (value, message) => { if (!value) throw new Error(message); };
    let moves = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const g = new Game(0, { hero: 0, soul: 0, best: 0, talents: {} }, input(), false, seed * 977);
      g.state = 'play'; g.p.invuln = 1e9;
      for (let boss = 0; boss < 3; boss++) {
        const before = g.map.shops.map(s => ({ x: s.x, y: s.y, x0: s.prop.x0, y0: s.prop.y0 }));
        // as in a real night, every district is open by the time a boss falls (gates open by 4:00, the boss comes at 5:00)
        for (const gate of g.map.gates) g.time = Math.max(g.time, gate.openAt + 1);
        g.director(0.001);
        const b = g.spawnEnemy('king', g.p.x + 4, g.p.y); g.killEnemy(b); g.closeShop(); g.state = 'play';
        require(g.time - g.shopsMovedAt < 1, 'Shops did not move after the boss');
        g.map.shops.forEach((s, i) => {
          const d = Math.hypot(s.x - before[i].x, s.y - before[i].y);
          require(d >= 5, `Shop ${i} barely moved (${d.toFixed(1)} tiles, seed ${seed})`);
          require(g.reachable(s.x, s.y) && !blockedCircle(g.map, s.x, s.y, 0.24), 'The customer spot must be walkable and reachable');
          require(!blockedCircle(g.map, before[i].x0 + 0.5, before[i].y0 + 0.5, 0.2), 'The old pitch must be open ground again');
          require(blockedCircle(g.map, s.prop.x0 + s.prop.fw / 2, s.prop.y0 + (s.prop.big ? s.prop.fh / 2 : 0.5), 0.05), 'The stand is solid at its new pitch');
          moves++;
        });
        const [a, b2, c] = g.map.shops;
        require(Math.hypot(a.x - b2.x, a.y - b2.y) >= 4 && Math.hypot(a.x - c.x, a.y - c.y) >= 4 && Math.hypot(b2.x - c.x, b2.y - c.y) >= 4, 'Shops must not pile up');
        // and it still sells: walk up and the prompt is the shop's
        const stand = g.map.shops.find(s => s.prop.kind !== 'vending');
        g.p.x = stand.x; g.p.y = stand.y + 0.2; g.pickups = []; g.updateInteract();
        require(g.interact?.kind === 'shop', `No shop prompt at the new stand (${g.interact?.kind})`);
        const machine = g.map.shops.find(s => s.prop.kind === 'vending');
        g.p.x = machine.x; g.p.y = machine.y; g.updateInteract();
        require(g.interact?.kind === 'vending', 'No candy machine prompt at its new spot');
      }
    }
    return moves;
  });
  assert.equal(result, 12 * 3 * 3);
  assert.deepEqual(errors, []);
  console.log(`${result} shop moves across 12 towns: every stand and candy machine relocates after each boss to a reachable, clear pitch and still trades.`);
} finally { await browser.close(); }
