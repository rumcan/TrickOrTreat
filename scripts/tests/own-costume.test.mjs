import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

// Each kid has one costume of their own. It is the only one that can drop for them, and it stops dropping once worn.
const browser = await chromium.launch({ channel: 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 120000 });
  const result = await page.evaluate(async () => {
    const { Game } = await import('/src/game/engine.ts');
    const { expansion } = await import('/src/game/expansion.ts');
    const { HERO_COSTUME, HERO_INFO, COSTUME_BY_ID } = await import('/src/game/data.ts');
    const { heroSheet } = await import('/src/game/art/characters.ts');
    expansion.preview(); // the premium kids are playable
    const input = () => ({ keys: new Set(), pressed: new Set(), rpressed: false, mdown: false, mouseActive: false, wheel: 0, touchMoveX: 0, touchMoveY: 0, endFrame() { this.pressed.clear(); }, clearTouch() {} });
    const require = (value, message) => { if (!value) throw new Error(message); };
    require(HERO_COSTUME.length === HERO_INFO.length && new Set(HERO_COSTUME).size === HERO_INFO.length && HERO_COSTUME.every(id => COSTUME_BY_ID[id]), 'Five kids, five different real costumes');
    require(HERO_COSTUME.slice(0, 3).every(id => !COSTUME_BY_ID[id].premium), 'Free kids own free costumes');
    const seen = [];
    for (let hero = 0; hero < HERO_INFO.length; hero++) {
      const g = new Game(hero, { hero, soul: 0, best: 0, talents: {} }, input(), false, 99 + hero);
      g.state = 'play'; g.p.invuln = 1e9;
      const own = HERO_COSTUME[hero], random = Math.random;
      const other = HERO_COSTUME[(hero + 1) % HERO_INFO.length];
      g.dropCostume(g.p.x, g.p.y, other);
      require(!g.pickups.some(p => p.kind === 'costume'), 'A foreign costume cannot enter the drop pool');
      g.wearCostume(other, false);
      require(g.p.costume === null && g.costumesFound === 0, 'A foreign costume cannot be equipped or counted');
      require(heroSheet(hero, other).img === heroSheet(hero).img, 'Previews cannot build cross-kid costume sheets');
      // every drop source, forced: elite kills, doorsteps and treat bags
      const drops = new Set();
      Math.random = () => 0;
      try {
        for (let i = 0; i < 6; i++) { g.pickups = []; g.killEnemy(g.spawnEnemy('zombie', g.p.x + 3, g.p.y, true)); g.pickups.filter(p => p.kind === 'costume').forEach(p => drops.add(p.costume)); }
        g.pickups = []; g.tot = { house: g.map.houses.find(h => !h.trick) }; g.finishTot(); g.state = 'play';
        g.pickups.filter(p => p.kind === 'costume').forEach(p => drops.add(p.costume));
      } finally { Math.random = random; }
      require(drops.size === 1 && drops.has(own), `${HERO_INFO[hero].name} must only ever find ${own}, found ${[...drops]}`);
      // one on the ground is enough: no second copy
      g.pickups = []; g.dropCostume(g.p.x, g.p.y, g.randomCostume());
      require(g.randomCostume() === null && g.pickups.filter(p => p.kind === 'costume').length === 1, 'A second copy dropped while one was on the ground');
      // worn: nothing more drops, and a "costume" bag pays out candy instead
      g.pickups = []; g.wearCostume(own, false);
      require(g.randomCostume() === null, 'Costume still drops while worn');
      Math.random = () => 0.999; // the last entry of the bag table is the costume
      try { g.openBag(g.p.x, g.p.y); } finally { Math.random = random; }
      require(!g.pickups.some(p => p.kind === 'costume') && g.pickups.filter(p => p.kind === 'coin').length > 6, 'A costume bag must become a candy hoard once the costume is on');
      seen.push(`${HERO_INFO[hero].name}: ${COSTUME_BY_ID[own].name}`);
    }
    return seen;
  });
  assert.equal(result.length, 5);
  assert.deepEqual(errors, []);
  console.log(`Own costumes only: ${result.join(' · ')}. One copy at a time, none once worn.`);
} finally { await browser.close(); }
