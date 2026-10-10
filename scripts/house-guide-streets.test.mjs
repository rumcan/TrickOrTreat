import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ channel: 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 120000 });
  const checks = await page.evaluate(async () => {
    const { Game } = await import('/src/game/engine.ts');
    const { blockedCircle } = await import('/src/game/map.ts');
    const { expansion } = await import('/src/game/expansion.ts'); expansion.preview();
    const require = (value, text) => { if (!value) throw new Error(text); };
    const controls = () => ({ keys: new Set(), pressed: new Set(), wheel: 0, mouseActive: false, endFrame() { this.pressed.clear(); } });
    const make = (seed, campaign = false) => new Game(0, { hero: 0, soul: 0, best: 0, talents: {} }, controls(), campaign, seed);
    for (const campaign of [false, true]) for (let seed = 1; seed <= 25; seed++) {
      const g = make(seed, campaign), h = g.tutorialHouse;
      require(h && h.prop.kind === 'house' && !h.trick && !h.visited, 'Guide must select a real, rewarding house');
      require(g.reachable(h.door.x, h.door.y) && !blockedCircle(g.map, h.door.x, h.door.y, g.p.r), 'Guide entrance must be accessible with current gate locks');
    }
    const g = make(1337), h = g.tutorialHouse;
    g.startTot(h); g.cancelTot(false);
    require(g.tutorialHouse === h && !g.treatGuideComplete, 'Cancelling a door visit must not finish the guide');
    const trap = g.map.houses.find(h => h.trick);
    g.startTot(trap); g.finishTot();
    require(g.tutorialHouse === h && !g.treatGuideNotice, 'A trick must not consume the loot explanation');
    g.startTot(h); g.finishTot();
    require(g.state === 'levelup' && g.treatGuideNotice && g.treatGuideComplete && !g.tutorialHouse, 'First reward pauses play, removes arrow and shows explanation');
    const time = g.time; g.update(.03); require(g.time === time, 'Reward explanation must not expose the player to running combat');
    g.choose(g.choices[0].id); require(!g.treatGuideNotice, 'Choosing loot clears the explanation');
    const next = g.map.houses.find(h => !h.trick && !h.visited); g.startTot(next); g.finishTot();
    require(!g.treatGuideNotice, 'The guide should appear only once per run');
    require(make(1337).tutorialHouse, 'New runs restart the guide');
    const { getTile, getCurb, G } = await import('/src/game/art/tiles.ts');
    const { curbCoordinates } = await import('/src/game/art/street-geometry.ts');
    for (let e = 0; e < 4; e++) {
      const image = getCurb(e); require(image === getCurb(e), 'Street corrections must be cached');
      const c = document.createElement('canvas'); c.width = 128; c.height = 64;
      const ctx = c.getContext('2d'); ctx.drawImage(image, 0, 0);
      const data = ctx.getImageData(0, 0, 128, 64).data; let count = 0, first = 1, last = 0;
      for (let y = 0; y < 64; y++) for (let x = 0; x < 128; x++) if (data[(y * 128 + x) * 4 + 3] > 150) {
        const u = (x + .5) / 128 + (y + .5) / 64 - .5, v = (y + .5) / 64 - (x + .5) / 128 + .5;
        const [t, inset] = curbCoordinates(e, u, v);
        require(inset >= -.02 && inset <= .14, 'Painted curb must stay on the straight world edge');
        count++; first = Math.min(first, t); last = Math.max(last, t);
      }
      require(count > 250 && last - first > .96, 'Curbs must cover the full segment without tapering gaps');
    }
    for (let v = 0; v < 3; v++) require(getTile(G.SIDEWALK, v) === getTile(G.SIDEWALK, v), 'Slab corrections must be cached');
    return { accessibleOpeningHouses: 50, lifecycle: true, exactCurbs: 4, cachedSidewalkVariants: 3 };
  });
  console.log(JSON.stringify(checks));
  await page.getByRole('button', { name: 'Go trick-or-treating' }).click();
  await page.waitForFunction(() => window.__tot?.game);
  const renderChecks = await page.evaluate(() => {
    const { game: g, renderer } = window.__tot;
    g.state = 'play'; g.hitStop = 999; g.enemies = []; g.banner = null;
    const labels = [], ellipses = [], bars = [], ctx = renderer.ctx;
    const fillText = ctx.fillText, ellipse = ctx.ellipse, fillRect = ctx.fillRect;
    ctx.fillText = function(text, ...args) { labels.push(text); return fillText.call(this, text, ...args); };
    ctx.ellipse = function(...args) { ellipses.push(this.strokeStyle); return ellipse.apply(this, args); };
    ctx.fillRect = function(...args) { if (this.fillStyle === '#76ddff') bars.push(args); return fillRect.apply(this, args); };
    const enemy = g.spawnEnemy('zombie', g.p.x + 2, g.p.y); enemy.shield = enemy.maxShield = 100; enemy.hp = enemy.maxHp;
    renderer.render(g, .01);
    ctx.fillText = fillText; ctx.ellipse = ellipse; ctx.fillRect = fillRect;
    return { guide: labels.includes('FIRST TREATS') || labels.includes('RING THE BELL · E'), shieldBubble: ellipses.includes('#76ddff'), shieldBar: bars.length > 0 };
  });
  assert.equal(renderChecks.guide, true); assert.equal(renderChecks.shieldBubble, false); assert.equal(renderChecks.shieldBar, true);
  for (const [width, height] of [[1440,900], [390,844], [844,390]]) {
    await page.setViewportSize({ width, height });
    const layout = await page.evaluate(() => {
      const { game: g, renderer } = window.__tot, ctx = renderer.ctx;
      const original = g.tutorialHouse, fillText = ctx.fillText; let label;
      // Force an upper-right offscreen objective, where the minimap used to hide it.
      g.tutorialHouse = { ...original, door: { x: g.p.x + 20, y: g.p.y - 35 } };
      ctx.fillText = function(text, ...args) {
        if (text === 'FIRST TREATS') { const t = this.getTransform(); label = { x: t.e / renderer.dpr, y: t.f / renderer.dpr - 71 }; }
        return fillText.call(this, text, ...args);
      };
      renderer.render(g, .01); ctx.fillText = fillText; g.tutorialHouse = original;
      const w = g.vw, h = g.vh, mw = Math.min(230, w * .22), top = (w < 640 ? 48 : 56) + 3 + 16;
      return { label, minimap: { left: w - mw - 22, bottom: top + mw / 2 + 6 }, width: w, height: h };
    });
    assert.ok(layout.label);
    assert.ok(layout.label.x - 78 >= 0 && layout.label.x + 78 <= width);
    assert.ok(layout.label.y - 13 > 59 && layout.label.y + 13 < height - 96);
    assert.ok(layout.label.x + 78 < layout.minimap.left || layout.label.y - 13 > layout.minimap.bottom, 'Opening guide must not sit under the minimap');
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(100);
  await page.screenshot({ path: 'art/world/checks/first-house-guide.png' });
  await page.evaluate(() => {
    const g = window.__tot.game, h = g.tutorialHouse;
    g.p.x = h.door.x; g.p.y = h.door.y; g.p.invuln = 20; g.enemies = []; g.hitStop = 0;
  });
  await page.keyboard.press('e');
  await page.waitForFunction(() => !!window.__tot.game.tot || window.__tot.game.treatGuideNotice);
  const note = page.getByRole('note', { name: 'Trick-or-treat guide' }); await note.waitFor();
  assert.match(await note.innerText(), /houses and other buildings/i); assert.match(await note.innerText(), /Legendary/);
  await page.screenshot({ path: 'art/world/checks/first-house-reward-guide.png' });
  await page.keyboard.press('1'); await note.waitFor({ state: 'detached' });
  await page.evaluate(async () => {
    const { getTile, getCurb, getRoadLine, G } = await import('/src/game/art/tiles.ts');
    const { allAssets } = await import('/src/game/assets.ts');
    const atlas = new Map(allAssets().map(e => [e.spec.key, e.img]));
    const canvas = document.createElement('canvas'); canvas.id = 'street-comparison'; canvas.width = 1600; canvas.height = 650;
    canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:auto;z-index:9999;background:#111923'; document.body.append(canvas);
    const ctx = canvas.getContext('2d'), isRoad = (x, y) => x === 3 || x === 4 || y === 3 || y === 4;
    ctx.fillStyle = '#111923'; ctx.fillRect(0, 0, 1600, 650);
    for (const corrected of [false, true]) {
      const ox = corrected ? 1200 : 400;
      ctx.fillStyle = '#edf5ff'; ctx.font = '24px system-ui'; ctx.textAlign = 'center'; ctx.fillText(corrected ? 'Aligned geometry · painted material' : 'Original painted geometry', ox, 40);
      ctx.save(); ctx.translate(ox, 70); ctx.scale(.7, .7);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const road = isRoad(x, y), type = road ? G.ROAD : G.SIDEWALK, v = (x + y) % 3;
        ctx.drawImage(corrected ? getTile(type, v) : atlas.get(`tile_${road ? 'road' : 'sidewalk'}_${v}`), (x - y) * 64 - 64, (x + y) * 32);
        if (!road) for (const [e, dx, dy] of [[0,0,-1],[1,1,0],[2,0,1],[3,-1,0]]) {
          if (isRoad(x + dx, y + dy)) ctx.drawImage(corrected ? getCurb(e) : atlas.get(`ovl_curb_${['ne','se','sw','nw'][e]}`), (x - y) * 64 - 64, (x + y) * 32);
        }
        if (road && y === 3 && x !== 3 && x !== 4) ctx.drawImage(getRoadLine(2), (x-y)*64-64, (x+y)*32);
        if (road && x === 3 && y !== 3 && y !== 4) ctx.drawImage(getRoadLine(1), (x-y)*64-64, (x+y)*32);
      }
      ctx.restore();
    }
  });
  await page.locator('#street-comparison').screenshot({ path: 'art/world/checks/street-alignment-comparison.png' });
  assert.deepEqual(errors, []);
  console.log('Opening house arrow, one-time paused loot explanation, shield bars without bubbles and repeated painted street geometry passed.');
} finally { await browser.close(); }
