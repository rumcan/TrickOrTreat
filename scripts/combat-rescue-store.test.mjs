import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 120000 });
  await page.getByRole('button', { name: 'Discover the full game' }).click();
  const dialog = page.getByRole('dialog', { name: 'HIDE & SHRIEK' });
  const catalog = await page.evaluate(async () => {
    const d = await import('/src/game/data.ts');
    return [...d.WEAPONS, ...d.SCROLLS, ...d.COSTUMES, ...d.TALENTS].filter(a => a.premium).map(a => a.name).concat(d.HERO_INFO.slice(3).map(h => h.name));
  });
  for (const name of catalog) assert.equal(await dialog.getByText(name, { exact: true }).count(), 1, `Premium catalogue lists ${name}`);
  await dialog.locator('img').evaluateAll(async images => { await Promise.all(images.map(i => i.decode())); });
  for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(size);
    const layout = await dialog.evaluate(d => { const r = d.getBoundingClientRect(); const s = d.querySelector('.unlock-scroll'); return { left: r.left, right: r.right, bottom: r.bottom, width: innerWidth, height: innerHeight, overflow: s.scrollWidth > s.clientWidth + 2 }; });
    assert.ok(layout.left >= 0 && layout.right <= layout.width && layout.bottom <= layout.height && !layout.overflow, 'Responsive showcase fits viewport');
    await page.screenshot({ path: `art/world/checks/unlock-${size.width}.png` });
  }
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
  assert.equal(await page.getByRole('button', { name: 'Discover the full game' }).evaluate(e => e === document.activeElement), true);
  const result = await page.evaluate(async () => {
    const { Game } = await import('/src/game/engine.ts');
    const { expansion } = await import('/src/game/expansion.ts');
    const { cellAt } = await import('/src/game/map.ts');
    const { CW } = await import('/src/game/config.ts');
    const { weaponStats, HERO_INFO } = await import('/src/game/data.ts');
    expansion.preview();
    const input = () => ({ keys: new Set(), pressed: new Set(), rpressed: false, mdown: false, mouseActive: false, wheel: 0, endFrame() { this.pressed.clear(); this.rpressed = false; this.wheel = 0; } });
    const save = () => ({ hero: 0, soul: 0, best: 0, talents: {} });
    const require = (value, message) => { if (!value) throw new Error(message); };
    const g = new Game(0, save(), input(), false, 1337); g.p.invuln = 999;
    const regular = g.spawnEnemy('zombie', g.p.x + 6, g.p.y), hp = regular.maxHp;
    regular.hp *= .5;
    for (let wave = 2; wave <= 6; wave++) {
      const oldHp = regular.maxHp, threat = g.threat(); g.time = (wave - 1) * 60; g.director(.001);
      require(Math.abs(regular.maxHp / oldHp - 1.6) < .0001 && g.threat() > threat, 'Every wave strengthens living monsters');
      require(Math.abs(regular.hp / regular.maxHp - .5) < .0001, 'Wave does not heal damaged monster');
    }
    const lieutenant = g.spawnEnemy('skeleton', g.p.x + 8, g.p.y, true);
    const original = lieutenant.hp, shield = lieutenant.shield;
    g.damageEnemy(lieutenant, shield / 2, '#fff', false, true);
    require(lieutenant.hp === original && lieutenant.shield === shield / 2, 'Shield absorbs first');
    g.updateEnemies(3); require(lieutenant.shield === shield / 2, 'Recharge waits after damage');
    g.updateEnemies(1.1); require(lieutenant.shield > shield / 2, 'Lieutenant recharges');
    const before = lieutenant.shield; g.state = 'inventory'; g.update(.05); require(lieutenant.shield === before, 'Shields pause with inventory');
    g.damageEnemy(lieutenant, lieutenant.shield + 17, '#fff', false, true); require(Math.abs(lieutenant.hp - (original - 17)) < .0001, 'Overflow damages health');
    const bosses = ['hex', 'alpha', 'warden', 'king'].map(type => {
      const e = g.spawnEnemy(type, g.p.x + 10, g.p.y); require(e.maxShield > 0, 'Every boss has shields');
      const hp = e.hp; g.damageEnemy(e, e.shield, '#fff', false, true); require(e.hp === hp && !e.shield, 'Boss shield break');
      g.updateEnemies(5); require(!e.shield, 'Boss delay is six seconds'); g.updateEnemies(1.1); require(e.shield > 0, 'Boss recharges'); return type;
    });
    let sites = 0;
    for (const seed of [1, 7, 42, 1337, 9001, 65535, 31337, 8675309, 99, 20261010]) for (let hero = 0; hero < 5; hero++) {
      const map = new Game(hero, save(), input(), true, seed);
      for (const gate of map.map.gates) for (const [x, y] of gate.cells) map.map.coll[y * CW + x] = 0;
      map.computeFlow(true);
      for (const f of map.friends) {
        require(cellAt(map.map, f.x, f.y) === 0 && map.reachable(f.x, f.y), 'Rescue site is open and reachable');
        require(!map.map.props.some(p => !p.removed && f.x > p.x0 - .8 && f.x < p.x0 + p.fw + .8 && f.y > p.y0 - .8 && f.y < p.y0 + p.fh + .8), 'Friend not hidden inside scenery'); sites++;
      }
    }
    const powers = [];
    for (const hero of [3, 4]) {
      const controls = input(), kid = new Game(hero, save(), controls, true, 1337); kid.state = 'play';
      kid.p.hp = 1; kid.p.shield = 0; kid.p.dashCharges = 0; kid.p.weapons[0].ammo = 0;
      const friend = kid.friends[0]; friend.status = 'rescued'; friend.hp = 0; kid.activeFriend = friend.hero;
      const enemy = kid.spawnEnemy('werewolf', kid.p.x + 2, kid.p.y); enemy.hp = enemy.maxHp = 10000;
      const before = kid.globalMore(); controls.pressed.add('f'); kid.updateSkill(.01);
      require(kid.globalMore() >= before * (hero === 4 ? 3 : 2) && kid.p.invuln > 0 && (enemy.hp < 10000 || enemy.shield < enemy.maxShield), 'Premium skill is materially powerful');
      if (hero === 3) require(kid.p.hp === kid.stats.maxHp && kid.p.shield === kid.stats.maxShield && !enemy.shield && friend.hp === friend.maxHp && kid.p.weapons[0].ammo === weaponStats(kid.p.weapons[0], kid.stats).mag, 'Maya heals, revives, refills and EMPs');
      else require(kid.p.dashCharges === kid.stats.dashCharges && enemy.stunT >= 3 && enemy.ectoT >= 8, 'Leo refills dashes and disables enemies');
      kid.premiumPowerT = 0; require(kid.globalMore() === before, 'Temporary damage buff expires'); powers.push(hero);
    }
    const nav = new Game(0, save(), input(), true, 1337); nav.state = 'play';
    nav.pickups = [{ x: 90, y: 90, z: 0, vz: 0, vx: 0, vy: 0, kind: 'chest', value: 1, mag: false, t: 0, dead: false }];
    const labels = [], rectangles = [], originalText = CanvasRenderingContext2D.prototype.fillText;
    const originalRect = CanvasRenderingContext2D.prototype.fillRect;
    const shielded = nav.spawnEnemy('skeleton', nav.p.x + 2, nav.p.y, true, null);
    shielded.spawnT = 0; shielded.shield = shielded.maxShield / 2; shielded.burnT = 1;
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;width:1440px;height:900px;pointer-events:none;opacity:0'; document.body.append(canvas);
    CanvasRenderingContext2D.prototype.fillText = function(text, ...args) { labels.push(String(text)); return originalText.call(this, text, ...args); };
    CanvasRenderingContext2D.prototype.fillRect = function(x, y, w, h) { rectangles.push({ color: this.fillStyle, x, y, w, h }); return originalRect.call(this, x, y, w, h); };
    try {
      const { Renderer } = await import('/src/game/render.ts');
      const renderer = new Renderer(canvas, 0);
      renderer.render(nav, 1 / 60);
      const healthBar = rectangles.find(r => r.color === '#ff3b3b' && r.w === 60 && r.h === 6);
      const shieldBar = rectangles.find(r => r.color === '#76ddff' && r.w === 30 && r.h === 4);
      require(healthBar && shieldBar && shieldBar.x === healthBar.x && shieldBar.y + shieldBar.h < healthBar.y, 'Light-blue shield line is above enemy health');
      require(rectangles.some(r => r.x === healthBar.x && r.w === 5 && r.h === 4 && r.y > healthBar.y + healthBar.h), 'Status markers do not obscure the shield');
      require(labels.some(t => t.includes('gate') || t.startsWith('Rescue ')), 'Screen points toward next kid');
      require(!labels.includes(String.fromCodePoint(0x1f383)), 'No bag indicator arrows');
      nav.bigMap = true; labels.length = 0; renderer.render(nav, 1 / 60);
      for (const f of nav.friends) require(labels.some(t => t.includes(HERO_INFO[f.hero].name)), 'Every missing kid marked on full map');
    } finally { CanvasRenderingContext2D.prototype.fillText = originalText; CanvasRenderingContext2D.prototype.fillRect = originalRect; canvas.remove(); }
    return { waveHealthMultiplier: regular.maxHp / hp, bosses, rescueSites: sites, powers, navigation: true };
  });
  assert.deepEqual(errors, []); console.log(JSON.stringify(result));
  await page.getByRole('button', { name: 'Go trick-or-treating' }).click();
  await page.waitForFunction(() => window.__tot?.game);
  await page.evaluate(() => {
    const g = window.__tot.game; g.state = 'play'; g.hitStop = 999; g.banner = null; g.enemies = [];
    g.boss = g.spawnEnemy('king', g.p.x + 3, g.p.y);
    g.boss.hp = g.boss.maxHp = 200; g.boss.shield = g.boss.maxShield = 100;
    g.damageEnemy(g.boss, 50, '#fff', false, true);
  });
  const shield = page.getByTestId('boss-shield'), health = page.getByTestId('boss-health');
  await page.waitForFunction(() => document.querySelector('[data-testid="boss-shield"] > div')?.style.width === '50%');
  const shieldBox = await shield.boundingBox(), healthBox = await health.boundingBox();
  assert.ok(shieldBox.y + shieldBox.height < healthBox.y, 'Boss shield is above health');
  assert.equal(await shield.locator('div').evaluate(e => getComputedStyle(e).backgroundColor), 'rgb(118, 221, 255)');
  assert.equal(await health.locator('i').evaluate(e => e.style.width), '100%', 'Shield-only hit preserves health');
  await page.evaluate(() => { const g = window.__tot.game; g.damageEnemy(g.boss, 70, '#fff', false, true); });
  await page.waitForFunction(() => document.querySelector('[data-testid="boss-shield"] > div')?.style.width === '0%' && document.querySelector('[data-testid="boss-health"] > i')?.style.width === '90%');
  assert.deepEqual(errors, []);
  console.log('Light-blue enemy/boss shields sit above HP, stay clear of status indicators, and deplete before health takes overflow damage.');
  console.log('Wave scaling, shield absorption/recharge/pause, 200 unobstructed rescue sites, powerful premium skills and complete responsive catalogue passed.');
} finally { await browser.close(); }
