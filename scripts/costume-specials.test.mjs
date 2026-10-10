import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 120000 });
  const results = await page.evaluate(async () => {
    const { Game } = await import('/src/game/engine.ts');
    const { COSTUMES, baseStats, makeWeapon, weaponStats } = await import('/src/game/data.ts');
    const { expansion } = await import('/src/game/expansion.ts'); expansion.preview();
    const input = () => ({ keys: new Set(), pressed: new Set(), mouseActive: false, rpressed: false, mdown: false, wheel: 0, endFrame() { this.pressed.clear(); } });
    const save = { hero: 0, soul: 0, best: 0, talents: { master: 1 } };
    const require = (condition, message) => { if (!condition) throw new Error(message); };
    for (let hero = 0; hero < 5; hero++) for (const campaign of [false, true]) {
      const g = new Game(hero, structuredClone(save), input(), campaign, 1337);
      require(g.p.costume === null && !g.pickups.some(p => p.kind === 'costume'), 'No costume equipped or guaranteed at spawn, even with old capstone');
    }
    require(COSTUMES.length === 10 && COSTUMES.every(c => c.rarity === 3), 'All ten costumes are Epic');
    for (const c of COSTUMES) { const s = baseStats(); c.apply(s); require(JSON.stringify(s) !== JSON.stringify(baseStats()), `${c.id} has real powers`); }
    const g = new Game(0, structuredClone(save), input(), false, 1337); g.state = 'play'; g.p.invuln = 999; g.wave = 15;
    const spawn = affix => { g.enemies = []; g.bullets = []; const e = g.spawnEnemy('zombie', g.p.x + 1, g.p.y, false, affix); e.hp = e.maxHp = 1000; e.spawnT = 0; e.shield = e.maxShield = 0; g.rebuildGrid(); return e; };
    const hit = (e, profile) => g.applyHit(e, 100, false, 0, 0, 0, 0, 0, false, true, profile);
    for (const [affix, elem] of [['stormproof', 'shock'], ['fireproof', 'fire'], ['ectoproof', 'ecto']]) {
      const e = spawn(affix); hit(e, { element: elem }); require(e.hp === 1000, `${affix} blocks matching direct damage`);
      g.explode(e.x, e.y, 2, 100, elem); require(e.hp === 1000, `${affix} blocks matching explosion`);
      hit(e, {}); require(e.hp === 900, 'Kinetic counter still works');
    }
    const fire = spawn('fireproof'); g.applyHit(fire, 10, false, 1, 0, 0, 0, 0); require(fire.burnT === 0, 'Fire immunity prevents burn');
    fire.burnT = 2; fire.burnDps = 100; const before = fire.hp; g.updateEnemies(.5); require(fire.hp === before, 'Old burn cannot bypass immunity');
    const ecto = spawn('ectoproof'); g.applyHit(ecto, 10, false, 0, 0, 1, 0, 0); require(ecto.ectoT === 0, 'Ecto immunity prevents corrosion');
    // Death-spreading synergies must respect immunity too, not just direct hits.
    const spreadSource = spawn(null); spreadSource.burnT = 3; spreadSource.burnDps = 100; spreadSource.ectoT = 4;
    const fireWard = g.spawnEnemy('zombie', spreadSource.x + .2, spreadSource.y, false, 'fireproof');
    const ectoWard = g.spawnEnemy('zombie', spreadSource.x - .2, spreadSource.y, false, 'ectoproof');
    const previousBuild = g.build; g.build = { ks: tag => tag === 'fire' || tag === 'ecto' }; g.rebuildGrid(); g.killEnemy(spreadSource); g.build = previousBuild;
    require(fireWard.burnT === 0 && fireWard.ectoT > 0 && ectoWard.ectoT === 0 && ectoWard.burnT > 0, 'Wildfire/Plague spread only non-immune effects');
    const shell = spawn('piercing'); hit(shell, { pierce: 1 }); require(shell.hp === 1000, 'Light pierce cannot break sealed shell'); hit(shell, { pierce: 2 }); require(shell.hp === 900, 'Strong piercing works');
    g.damageEnemy(shell, 5000, '#fff'); require(!shell.dead && shell.hp === 900, 'Skills and neutral procs cannot bypass shell');
    g.damageEnemy(shell, 1000, '#fff', false, true, { pierce: 2 }); require(shell.dead, 'Only strong piercing delivers lethal hit');
    const armor = spawn('armored'); hit(armor, {}); require(armor.hp === 980, 'Armor reduces damage by 80% once, not twice'); hit(armor, { pierce: 1 }); require(armor.hp === 880, 'Piercing bypasses armor');
    const ward = spawn('ricochet'); hit(ward, { ricochet: true }); require(ward.hp === 1000, 'Bounced shot blocked'); hit(ward, {}); require(ward.hp === 900, 'Direct shot works');
    const projectile = (e, src, extra = {}) => ({ x: e.x, y: e.y, vx: .001, vy: 0, dmg: 100, r: .12, life: 1, pierce: weaponStats(src, g.stats).pierce, bounce: 0, kind: src.def.kind, color: src.def.color, crit: 0, fire: 0, shock: 0, ecto: 0, explode: src.def.explode, hit: [], vamp: false, dead: false, spin: 0, src, ...extra });
    const immune = spawn('stormproof'); g.bullets = [projectile(immune, makeWeapon('balloon', 0))]; g.updateBullets(.01); require(immune.hp === 1000, 'Real lightning projectile/explosion carries its element');
    const armoredShell = spawn('piercing'); g.bullets = [projectile(armoredShell, makeWeapon('soaker', 0), { pierce: 0, initialPierce: 2 })]; g.updateBullets(.01); require(armoredShell.hp === 900, 'Consumed pierce retains original penetration strength');
    const ricochet = spawn('ricochet'); g.bullets = [projectile(ricochet, makeWeapon('pea', 0), { ricocheted: true })]; g.updateBullets(.01); require(ricochet.hp === 1000, 'Actual bounced projectile is blocked');
    const beam = spawn('piercing'); g.hitSrc = makeWeapon('laser', 0); g.hitscan(g.p.x, g.p.y, 1, 0, weaponStats(g.hitSrc, g.stats), '#fff'); g.hitSrc = null; require(beam.hp < 1000, 'Real beam pierces shell');
    const early = new Game(0, structuredClone(save), input(), false, 1337); early.wave = 10;
    const crowd = early.spawnEnemy('zombie', early.p.x + 3, early.p.y, false, null); crowd.hp *= .5; early.advanceWave();
    require(crowd.fodder && Math.abs(crowd.hp / crowd.maxHp - .5) < .0001, 'Existing crowd becomes fodder without healing');
    const special = early.spawnEnemy('zombie', early.p.x + 3, early.p.y, false, 'stormproof'); require(special.maxHp > crowd.maxHp * 5, 'Specials stand above easy crowd');
    g.texts = []; g.enemies = [];
    for (let i = 0; i < 100; i++) { const e = g.spawnEnemy('zombie', g.p.x + 2, g.p.y, false, 'stormproof'); hit(e, { element: 'shock' }); hit(e, { element: 'shock' }); }
    const reasons = g.texts.filter(t => t.kind === 'reason'); require(reasons.length === 8 && reasons.every(t => t.size === 10 && t.life <= .75 && t.z > 2), 'Defense explanations stay small, above enemies, throttled and bounded');
    // Actual Epic costume powers, not just improved descriptions.
    g.enemies = []; g.bullets = []; g.wearCostume('witch', false); const target = g.spawnEnemy('zombie', g.p.x + 2, g.p.y, false, null); target.hp = target.maxHp = 10000; target.spawnT = 0; g.rebuildGrid(); g.p.hexT = 0; g.updateCompanions(.01);
    require(g.bullets.filter(b => b.kind === 'hex').length === 3 && g.bullets.every(b => b.pierce >= 2), 'Witch fires three penetrating hexes');
    g.bullets = []; g.wearCostume('skeleton', false); g.applyHit(target, 10, true, 0, 0, 0, 0, 0); require(g.bullets.length === 4 && g.bullets.every(b => b.pierce === 2), 'Skeleton fires four strong bone shards');
    g.wearCostume('vampire', false); g.p.hp = 10; g.p.shield = 0; g.killEnemy(target); require(g.p.hp === 14 && g.p.shield === 3, 'Vampire restores health and shield');
    return { costumes: COSTUMES.length, startCases: 10, defenses: 6, boundedHints: reasons.length };
  });
  assert.deepEqual(errors, []); console.log(JSON.stringify(results));
  await page.getByRole('button', { name: 'Go trick-or-treating' }).click();
  await page.waitForFunction(() => window.__tot?.game.state === 'play');
  await page.evaluate(() => {
    const g = window.__tot.game; g.wave = 16; g.time = 620; g.hitStop = 999; g.banner = null; g.enemies = []; g.pickups = []; g.texts = [];
    const types = ['stormproof', 'fireproof', 'ectoproof', 'ricochet', 'armored', 'piercing'];
    types.forEach((affix, i) => {
      const a = i / 6 * Math.PI * 2, pos = g.freeSpot(g.p.x + Math.cos(a) * 4, g.p.y + Math.sin(a) * 4);
      const e = g.spawnEnemy('zombie', pos.x, pos.y, false, affix); e.spawnT = 0; e.hp = e.maxHp = 1000;
      const profile = { element: i === 0 ? 'shock' : i === 1 ? 'fire' : i === 2 ? 'ecto' : null, ricochet: i === 3 };
      g.damageEnemy(e, 100, '#fff', false, true, profile);
    });
    for (let i = 0; i < 12; i++) { const pos = g.freeSpot(g.p.x + (i % 4 - 2) * 1.8, g.p.y + 5 + Math.floor(i / 4)); g.spawnEnemy('zombie', pos.x, pos.y, false, null); }
    window.__tot.renderer.render(g, 1 / 60);
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'art/world/checks/special-enemy-feedback.png' });
  console.log('Bare starts, Epic powers, actual bullet/beam/explosion defenses, strong-pierce kills, mixed hordes and subtle bounded hit reasons passed.');
} finally { await browser.close(); }
