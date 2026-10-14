import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

// Every house and venue must be ringable: the player (radius 0.24) can physically walk from the start to within bell
// reach of its door once the districts are open. Checked on 60 generated towns per mode with a fine walk lattice.
const browser = await chromium.launch({ channel: 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 120000 });
  const result = await page.evaluate(async () => {
    const { buildMap } = await import('/src/game/map.ts');
    const CR = 4, W = 94, CW = W * CR, R = 0.24, STEP = 0.125, L = Math.round(W / STEP), REACH = 1.0;
    const bad = [], stats = { maps: 0, doors: 0, props: { free: 0, campaign: 0 } };
    for (const expanded of [false, true]) for (let seed = 1; seed <= 60; seed++) {
      const map = buildMap(seed * 7919 + 13, expanded);
      const coll = map.coll.slice(); // every district open: gates and hedge blockades gone
      for (const gate of map.gates) for (const [cx, cy] of gate.cells) coll[cy * CW + cx] = 0;
      for (const b of map.barriers) { let k = 0; for (let cy = b.y * CR; cy < (b.y + 1) * CR; cy++) for (let cx = b.x * CR; cx < (b.x + 1) * CR; cx++) coll[cy * CW + cx] = b.under[k++]; }
      const fits = (x, y) => {
        const x0 = Math.floor((x - R) * CR), x1 = Math.floor((x + R) * CR), y0 = Math.floor((y - R) * CR), y1 = Math.floor((y + R) * CR);
        if (x0 < 0 || y0 < 0 || x1 >= CW || y1 >= CW) return false;
        for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) if (coll[cy * CW + cx] >= 1) return false;
        return true;
      };
      const seen = new Uint8Array(L * L), queue = new Int32Array(L * L); let head = 0, tail = 0;
      const start = Math.round(map.start.y / STEP) * L + Math.round(map.start.x / STEP);
      seen[start] = 1; queue[tail++] = start;
      while (head < tail) {
        const c = queue[head++], cx = c % L, cy = (c / L) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= L || ny >= L || seen[ny * L + nx] || !fits(nx * STEP, ny * STEP)) continue;
          seen[ny * L + nx] = 1; queue[tail++] = ny * L + nx;
        }
      }
      stats.maps++; stats.props[expanded ? 'campaign' : 'free'] += map.props.length;
      for (const house of map.houses) {
        stats.doors++;
        const n = Math.ceil(REACH / STEP), dx0 = Math.round(house.door.x / STEP), dy0 = Math.round(house.door.y / STEP);
        let ok = false;
        for (let j = -n; j <= n && !ok; j++) for (let i = -n; i <= n && !ok; i++) {
          const px = dx0 + i, py = dy0 + j;
          ok = px >= 0 && py >= 0 && px < L && py < L && !!seen[py * L + px] && Math.hypot(px * STEP - house.door.x, py * STEP - house.door.y) <= REACH;
        }
        if (!ok) bad.push(`${expanded ? 'campaign' : 'free'} seed ${seed * 7919 + 13}: ${house.owner} (${house.prop.kind} at ${house.prop.x0},${house.prop.y0})`);
      }
    }
    return { stats, bad };
  });
  assert.deepEqual(result.bad, [], 'Every front door is reachable');
  assert.ok(result.stats.props.free / 60 > 1500 && result.stats.props.campaign / 60 > 1500, 'Clearing a path must not strip the yards');
  assert.deepEqual(errors, []);
  console.log(`${result.stats.doors} doors on ${result.stats.maps} towns can all be walked to and rung (free and rescue maps, districts open). Average props per town: free ${Math.round(result.stats.props.free / 60)}, rescue ${Math.round(result.stats.props.campaign / 60)}.`);
} finally { await browser.close(); }
