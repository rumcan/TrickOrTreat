import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ channel: 'msedge' });
try {
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 120000 });
  const results = await page.evaluate(async () => {
    const { Game, Input } = await import('/src/game/engine.ts');
    const { makeWeapon, weaponStats } = await import('/src/game/data.ts');
    const { expansion } = await import('/src/game/expansion.ts');
    const { CW, CR } = await import('/src/game/config.ts');
    expansion.preview();
    const require = (value, message) => { if (!value) throw new Error(message); };
    const input = () => ({ keys: new Set(), pressed: new Set(), mouseActive: false, mdown: false, rpressed: false, wheel: 0, endFrame() { this.pressed.clear(); this.rpressed = false; this.wheel = 0; } });
    const game = (hero = 0, campaign = false) => {
      const g = new Game(hero, { hero, soul: 0, best: 0, talents: {} }, input(), campaign, 1337);
      g.state = 'play'; g.pickups = []; return g;
    };
    const check = (name, test) => { try { test(); return { name, passed: true }; } catch (error) { return { name, passed: false, error: error.message }; } };
    const bullet = (x, y, vx = 0) => ({ x, y, vx, vy: 0, dmg: 100, r: .12, life: 1, pierce: 0, bounce: 0, kind: 'pea', color: '#fff', crit: 0, fire: 0, shock: 0, ecto: 0, explode: 0, hit: [], vamp: false, dead: false, spin: 0 });
    return [
      check('focus loss clears held controls', () => {
        const canvas = document.createElement('canvas'), controls = new Input(canvas);
        try {
          controls.kd(new KeyboardEvent('keydown', { key: 'w' })); controls.md(new MouseEvent('mousedown', { button: 0 })); controls.rpressed = true; controls.wheel = 1;
          window.dispatchEvent(new Event('blur'));
          require(!controls.keys.size && !controls.pressed.size && !controls.mdown && !controls.rpressed && !controls.wheel, 'Movement/fire remain held after leaving the window');
        } finally { controls.destroy(); }
      }),
      check('costume swaps cannot refill health', () => {
        const g = game(); g.p.hp = g.stats.maxHp * .25;
        for (let i = 0; i < 5; i++) { g.wearCostume('dino', false); g.wearCostume('ghost', false); }
        require(Math.abs(g.p.hp / g.stats.maxHp - .25) < 1e-6, 'Swapping max-HP costumes heals the player for free');
      }),
      check('weapon resonance swaps cannot refill health', () => {
        const g = game(3); g.p.hp = g.stats.maxHp * .5;
        const a = makeWeapon('pea', 2), b = makeWeapon('nerf', 0); a.traits = ['scaredy', 'tummy']; b.traits = [];
        g.p.weapons = [a, b];
        for (let i = 0; i < 5; i++) { g.p.cur = 0; g.recalcStats(); g.p.cur = 1; g.recalcStats(); }
        require(Math.abs(g.p.hp / g.stats.maxHp - .5) < 1e-6, 'Changing HP resonance refills health');
      }),
      check('house costume drops are rare', () => {
        const g = game(), h = g.map.houses[0]; h.trick = false; g.tot = { house: h };
        const random = Math.random; Math.random = () => .1;
        try { g.finishTot(); } finally { Math.random = random; }
        require(!g.pickups.some(p => p.kind === 'costume'), 'Old house drop rate bypasses rare costumes');
      }),
      check('bag upgrades sync companion weapons', () => {
        const g = game(0, true); g.p.weapons[0].level = 8; g.syncTeamWeapons();
        const random = Math.random; Math.random = () => 55 / 88;
        try { g.openBag(g.p.x, g.p.y); } finally { Math.random = random; }
        require(g.p.weapons[0].level === 9 && g.friends.every(f => f.weapon.level === 9), 'Incidental upgrade leaves companions behind');
      }),
      check('pickup upgrades sync companion weapons', () => {
        const g = game(0, true), w = makeWeapon('soaker', 2, 8);
        g.dropWeapon(g.p.x, g.p.y, w); g.inspecting = g.pickups.at(-1); g.state = 'inspect'; g.takeInspected(0);
        require(g.friends.every(f => f.weapon.level === 8), 'Picking up an upgraded weapon leaves companions behind');
      }),
      check('companion beams respect elemental immunity', () => {
        const g = game(0, true), f = g.friends[0]; f.status = 'rescued'; g.activeFriend = f.hero; f.x = g.p.x; f.y = g.p.y; f.hurtCd = 99;
        f.weapon = makeWeapon('laser', 0); f.weapon.traits = [];
        g.map.coll.fill(0); const e = g.spawnEnemy('zombie', g.p.x + 2, g.p.y, false, 'stormproof'); e.spawnT = 0; e.hp = e.maxHp = 1000;
        g.rebuildGrid(); g.updateTeam(.01); require(e.hp === 1000, 'Companion lightning beam bypasses lightning immunity');
      }),
      check('guardian health and shields remain consistent', () => {
        const g = game(0, true); g.wave = 12; g.time = 700;
        const f = g.friends[0]; f.x = g.p.x + 1; f.y = g.p.y; g.updateTeam(0);
        require(f.guardian && Math.abs(f.guardian.maxShield / f.guardian.maxHp - .6) < 1e-6, 'Guardian HP reset leaves disproportionate shield');
        require(f.guardian.maxHp >= 220 * g.hpScale(), 'Late guardian health fails to scale with waves');
      }),
      check('fatal hits cannot open house reward screen', () => {
        const g = game(); g.p.hp = 1; g.p.shield = 0; g.tot = { house: g.map.houses[0], t: 5, dur: 1, stage: 0, lines: [] };
        g.ebullets = [{ x: g.p.x, y: g.p.y, vx: 0, vy: 0, dmg: 999, r: .1, life: 1, color: '#fff', kind: 'orb', dead: false }];
        g.update(.01); require(g.state === 'dead' && g.housesVisited === 0, 'Dead state gets overwritten by a door reward');
      }),
      check('boss-killing nova preserves safe shop', () => {
        const g = game(); g.wearCostume('pumpkin', false); g.p.hp = 1; g.p.shield = 0;
        g.boss = g.spawnEnemy('king', g.p.x + 1, g.p.y); g.boss.hp = 1; g.boss.shield = 0; g.rebuildGrid();
        g.takeDamage(999, g.boss.x, g.boss.y);
        require(g.state === 'play' && g.bossBreak && g.p.hp > 0, 'A stale hit kills the player after the boss is cleared');
      }),
      check('boss clear removes queued chain reactions', () => {
        const g = game(); g.procQueue = [{ x: g.p.x, y: g.p.y, r: 1, dmg: 100, gen: 1 }];
        g.boss = g.spawnEnemy('king', g.p.x + 2, g.p.y); g.killEnemy(g.boss);
        require(!g.procQueue.length, 'Queued explosions survive a safe encounter break');
      }),
      check('already-destroyed enemy bullets cannot hit', () => {
        const g = game(); g.ebullets = [{ x: g.p.x, y: g.p.y, vx: 0, vy: 0, dmg: 30, r: .1, life: 1, color: '#fff', kind: 'orb', dead: true }];
        const shield = g.p.shield; g.updateEBullets(.01); require(g.p.shield === shield, 'Destroyed projectile still damages player');
      }),
      check('fast projectiles cannot skip creatures', () => {
        const g = game(); g.map.coll.fill(0); g.p.x = 10.25; g.p.y = 10.25; g.computeFlow(true);
        const e = g.spawnEnemy('zombie', 11.75, 10.25, false, null); e.spawnT = 0; e.hp = e.maxHp = 1000;
        g.bullets = [bullet(10.25, 10.25, 90)]; g.rebuildGrid(); g.updateBullets(1 / 30);
        require(e.hp === 900, 'Fast shot crosses an enemy without collision');
      }),
      check('fast projectiles cannot skip solid walls', () => {
        const g = game(); g.map.coll.fill(0); const b = bullet(10.25, 10.25, 90);
        g.map.coll[Math.floor(b.y * CR) * CW + Math.floor(11.25 * CR)] = 2;
        g.bullets = [b]; g.updateBullets(1 / 30); require(b.dead && b.x < 11.5, 'Fast shot tunnels through wall cell');
      }),
      check('fast shots hit creatures before a later wall', () => {
        const g = game(); g.map.coll.fill(0); const b = bullet(10.25, 10.25, 90); g.computeFlow(true);
        const e = g.spawnEnemy('zombie', 11, 10.25, false, null); e.spawnT = 0; e.hp = e.maxHp = 1000;
        g.map.coll[Math.floor(b.y * CR) * CW + Math.floor(12.25 * CR)] = 2;
        g.bullets = [b]; g.rebuildGrid(); g.updateBullets(1 / 30); require(e.hp === 900, 'Later wall discards an earlier creature hit');
      }),
      check('reward selection applies only once', () => {
        const g = game(); g.pendingLevels = 1; g.openLevelUp('level'); const id = g.choices[0].id;
        g.choose(id); g.choose(id);
        require(g.scrolls[id] === 1 && g.pendingLevels === 0, 'Double selection grants an extra free treat and negative pending levels');
      }),
      check('many ground pickups cannot bypass the radius nerf', () => {
        const g = game(); g.map.coll.fill(0);
        g.pickups = Array.from({ length: 501 }, () => ({ x: g.p.x + 10, y: g.p.y, z: 0, vz: 0, vx: 0, vy: 0, kind: 'xp1', value: 1, mag: false, t: 1, dead: false }));
        g.updatePickups(.01);
        require(g.pickups.every(p => !p.mag), 'Pickup overflow forces distant XP to fly to the player');
        require(g.pickups.reduce((n, p) => n + p.value, 0) === 501 && g.pickups.length < 501, 'Local pile compression must preserve all earned XP');
      }),
    ];
  });
  for (const result of results) console.log(`${result.passed ? 'PASS' : 'FAIL'} ${result.name}${result.error ? `: ${result.error}` : ''}`);
  assert.deepEqual(errors, []);
  assert.equal(results.filter(r => !r.passed).length, 0, 'Bug reproductions must all be fixed');
} finally { await browser.close(); }
