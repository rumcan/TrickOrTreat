import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright-core';

// Loot keeps up with the kid: found guns come at about the kid's level, in the familiar loot colours, and once in a
// long while with an orange legendary line. A find is compared with either carried gun before the swap. After a boss
// nothing pops up: 20 quiet seconds to walk to the shop. Blasts stay light when there are many.
const browser = await chromium.launch({ channel: 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 120000 });
  await page.getByRole('button', { name: 'Go trick-or-treating' }).click();
  await page.waitForFunction(() => window.__tot?.game?.state === 'play');
  await fs.mkdir('art/world/checks', { recursive: true });

  const loot = await page.evaluate(async () => {
    const d = await import('/src/game/data.ts');
    const { RARITY } = await import('/src/game/config.ts');
    const { RARITY_KIT } = await import('/src/ui/common.tsx');
    const g = window.__tot.game, out = {};
    g.director = () => {}; g.enemies = []; g.p.invuln = 1e9;
    out.colors = { world: RARITY.slice(1).map(r => r.color), ui: RARITY_KIT.slice(1), lines: ['stat', 'trigger', 'unique', 'deal', 'legend'].map(t => d.INSC_STYLE[t].color) };
    // ---- levels ----
    const levels = (n) => { const seen = new Set(); for (let i = 0; i < n; i++) seen.add(g.lootLevel()); return [...seen].sort((a, b) => a - b); };
    g.p.level = 1; out.fresh = levels(200);
    g.p.level = 10; out.kid10 = levels(300);
    g.p.weapons[0].level = 15; out.gun15 = levels(300); // an upgraded gun pulls the finds up with it
    g.p.weapons[0].level = 1; g.p.level = 10;
    g.openLevelUp('house', 3, 0);
    let doorstep = [];
    for (let i = 0; i < 40; i++) { g.openLevelUp('house', 3, 0); doorstep.push(...g.gunChoices.map(w => w.level)); }
    out.doorstep = { n: doorstep.length, min: Math.min(...doorstep), max: Math.max(...doorstep) };
    g.gunChoices = []; g.choices = []; g.friendChoice = null; g.choiceMode = 'level'; g.state = 'play';
    // ---- legendary lines ----
    const share = (rarity, n) => { let hit = 0; for (let i = 0; i < n; i++) if (d.rollInscriptions(d.WEAPON_BY_ID.pea, rarity).some(t => d.TRAIT_BY_ID[t].tier === 'legend')) hit++; return hit / n; };
    out.legend = { common: share(0, 3000), uncommon: share(1, 3000), rare: share(2, 30000), epic: share(3, 30000), legendary: share(4, 30000), kinds: d.TRAITS.filter(t => t.tier === 'legend').length };
    const plain = d.makeWeapon('pea', 2); plain.traits = [];
    const st = (traits) => d.weaponStats({ ...plain, traits }, d.baseStats());
    const b = st([]);
    out.lines = {
      fullsize: [+(st(['fullsize']).dmg / b.dmg).toFixed(2), +(st(['fullsize']).rate / b.rate).toFixed(2)],
      bottomless: [+(st(['bottomless']).mag / b.mag).toFixed(2), +(st(['bottomless']).reload / b.reload).toFixed(2)],
      trio: st(['trio']).pellets - b.pellets,
      midnight: [+(st(['midnight']).crit - b.crit).toFixed(2), +(st(['midnight']).critMul - b.critMul).toFixed(2)],
    };
    // ---- blasts ----
    g.zones = []; g.particles = []; g.shake = 0;
    for (let i = 0; i < 30; i++) g.explode(g.p.x + 1, g.p.y, 2.6, 1, 'fire', true);
    out.heavy = { painted: g.zones.filter(z => z.sprite).length, booms: g.zones.filter(z => z.kind === 'boom').length, shake: g.shake, sparks: g.particles.length };
    g.zones = []; g.particles = []; g.shake = 0;
    for (let i = 0; i < 30; i++) g.explode(g.p.x + 1, g.p.y, 1.1, 1, 'fire', true); // the chain blasts of a build
    out.chain = { painted: g.zones.filter(z => z.sprite).length, shake: g.shake };
    g.zones = []; g.particles = []; g.shake = 0; g.decals = [];
    return out;
  });
  assert.deepEqual(loot.colors.world, ['#1eff00', '#0070dd', '#a335ee', '#ff8000'], 'Loot colours in the world');
  assert.deepEqual(loot.colors.ui, ['#1eff00', '#0070dd', '#a335ee', '#ff8000'], 'Loot colours in the menus');
  assert.equal(loot.colors.lines[0], '#1eff00', 'Stat lines are uncommon green');
  assert.equal(loot.colors.lines[4], '#ff8000', 'Legendary lines are orange');
  assert.ok(loot.colors.lines[2] === loot.colors.lines[3] && loot.colors.lines[1] !== loot.colors.lines[2], 'Trigger lines are blue, unique and deal lines purple');
  assert.deepEqual(loot.fresh, [1], 'A new kid finds level 1 guns');
  assert.deepEqual(loot.kid10, [9, 10], 'At level 10 the finds are level 9 or 10');
  assert.deepEqual(loot.gun15, [13, 14], 'A level 15 gun pulls the finds up to 13 or 14');
  assert.ok(loot.doorstep.n > 10 && loot.doorstep.min >= 9 && loot.doorstep.max <= 10, `Doorstep guns come at the kid's level (${JSON.stringify(loot.doorstep)})`);
  assert.equal(loot.legend.common + loot.legend.uncommon, 0, 'No legendary lines on common or uncommon guns');
  assert.ok(loot.legend.rare > 0.004 && loot.legend.rare < 0.02, `About 1% of rare guns carry a legendary line (${loot.legend.rare})`);
  assert.ok(loot.legend.epic > 0.02 && loot.legend.epic < 0.045, `About 3% of epic guns (${loot.legend.epic})`);
  assert.ok(loot.legend.legendary > 0.08 && loot.legend.legendary < 0.12, `About 10% of legendary guns (${loot.legend.legendary})`);
  assert.deepEqual(loot.lines, { fullsize: [1.6, 1.25], bottomless: [2.5, 0.6], trio: 2, midnight: [0.25, 1] }, 'What the four legendary lines do');
  assert.ok(loot.legend.kinds === 4);
  assert.ok(loot.heavy.painted === 3 && loot.heavy.booms === 30 && loot.heavy.shake <= 9, `Three painted fireballs at most, and a capped shake (${JSON.stringify(loot.heavy)})`);
  assert.ok(loot.heavy.sparks < 30 * 22 / 2, 'A pile of blasts throws far fewer sparks each');
  assert.deepEqual(loot.chain, { painted: 0, shake: 2.5 }, 'Chain blasts stay light rings and barely shake the screen');

  // ---- comparing a find with either carried gun ----
  const open = () => page.evaluate(async () => {
    const { makeWeapon } = await import('/src/game/data.ts');
    const g = window.__tot.game;
    g.p.level = 14;
    g.p.weapons[0] = makeWeapon('stream', 2, 6, true); g.p.weapons[0].traits = ['reload'];
    g.p.weapons[1] = makeWeapon('soaker', 3, 15, true); g.p.weapons[1].traits = ['dmg', 'rate']; g.p.cur = 1;
    const w = makeWeapon('laser', 4, g.lootLevel(), true); w.traits = ['fresh', 'pierce', 'midnight'];
    g.dropWeapon(g.p.x, g.p.y, w);
    const k = g.pickups[g.pickups.length - 1]; k.z = 0; k.vz = 0; g.inspecting = k; g.state = 'inspect';
  });
  await open();
  const dialog = page.getByRole('dialog', { name: 'Inspect weapon' });
  await dialog.waitFor();
  const tabs = dialog.getByRole('tab').filter({ visible: true });
  assert.equal(await tabs.count(), 2, 'A wide screen has one tab per carried gun');
  assert.equal(await dialog.getByRole('tab', { name: /Slot 2 · in hand/ }).filter({ visible: true }).getAttribute('aria-selected'), 'true', 'It opens on the gun in hand');
  const cards = () => dialog.locator('section:visible .kit-panel').evaluateAll(els => els.map(el => el.querySelector('.font-cond')?.textContent));
  assert.deepEqual(await cards(), ['Ghost-Buster Flashlight', 'Ecto Soaker'], 'The find and the gun in hand side by side');
  await dialog.getByRole('tab', { name: /Slot 1/ }).filter({ visible: true }).click();
  assert.deepEqual(await cards(), ['Ghost-Buster Flashlight', 'Spectre Stream'], 'The other tab brings up the other gun');
  const deltas = await dialog.locator('section:visible .kit-panel').evaluateAll(els => els.map(el => /[▲▼]/.exec(el.textContent)?.[0]));
  assert.ok(deltas[0] && deltas[1] && deltas[0] !== deltas[1], `Each card shows its DPS against the other (${deltas})`);
  assert.ok(await dialog.getByText('Stroke of Midnight').first().isVisible(), 'The legendary line is listed');
  assert.equal(await dialog.getByText('Stroke of Midnight').first().evaluate(el => getComputedStyle(el).color), 'rgb(255, 128, 0)', 'in orange');
  await page.screenshot({ path: 'art/world/checks/inspect-compare-desktop.png' });
  await page.keyboard.press('Tab');
  assert.deepEqual(await cards(), ['Ghost-Buster Flashlight', 'Ecto Soaker'], 'Tab switches the compared gun');
  await page.keyboard.press('1'); // the number keys still put it straight into a slot
  await page.waitForFunction(() => window.__tot.game.state === 'play');
  assert.deepEqual(await page.evaluate(() => { const g = window.__tot.game; return [g.p.weapons[0].def.id, g.p.weapons[1].def.id, g.pickups.some(k => k.weapon?.def.id === 'stream')]; }), ['laser', 'soaker', true], 'Swapped into slot 1; the old gun lies on the ground');

  // a phone shows one card at a time, with a third tab for the find and the choice always in reach
  await page.setViewportSize({ width: 390, height: 780 });
  await page.evaluate(() => { window.__tot.game.pickups = []; });
  await open();
  await dialog.waitFor();
  assert.equal(await tabs.count(), 3, 'A phone has a tab for the find and one per carried gun');
  assert.deepEqual(await cards(), ['Ghost-Buster Flashlight'], 'One card at a time on a phone');
  await dialog.getByRole('tab', { name: /Slot 2/ }).filter({ visible: true }).click();
  assert.deepEqual(await cards(), ['Ecto Soaker']);
  const swap = dialog.getByRole('button', { name: /Swap.*slot 2/ });
  const box = await swap.boundingBox();
  assert.ok(box && box.y + box.height <= 780 && box.x >= 0 && box.x + box.width <= 390, 'The swap buttons stay on screen without scrolling');
  await page.screenshot({ path: 'art/world/checks/inspect-compare-phone.png' });
  await dialog.getByRole('button', { name: 'Leave it' }).click();
  await page.waitForFunction(() => window.__tot.game.state === 'play');
  await page.setViewportSize({ width: 1280, height: 800 });

  // ---- a doorstep gun is compared first, and the kid can go back for another prize ----
  await page.evaluate(async () => {
    const { makeWeapon } = await import('/src/game/data.ts');
    const g = window.__tot.game;
    g.pickups = []; g.p.level = 12;
    g.p.weapons[0] = makeWeapon('stream', 2, 12, true); g.p.weapons[1] = makeWeapon('soaker', 3, 12, true); g.p.cur = 0;
    g.openLevelUp('house', 3, 0);
    g.choiceGiver = 'Mrs. Okafor'; g.friendChoice = null;
    g.choices = g.choices.slice(0, 2); g.gunChoices = [makeWeapon('laser', 3, 11, true)];
  });
  const prize = page.getByRole('button', { name: 'Take Ghost-Buster Flashlight' });
  await prize.waitFor();
  assert.match(await prize.innerText(), /gun · Lv 11/i, 'The card shows the level of the gun');
  assert.match(await prize.innerText(), /Level 11 · \d+ DPS/, 'and again next to its firepower');
  const treats = await page.evaluate(() => window.__tot.game.choices.map(c => c.id).join());
  await prize.click();
  await dialog.waitFor();
  assert.ok(await dialog.getByText('Doorstep prize · compare before you choose').isVisible());
  assert.deepEqual(await page.evaluate(() => { const g = window.__tot.game; return [g.state, g.pickups.length, g.p.weapons.map(w => w.def.id).join()]; }), ['inspect', 0, 'stream,soaker'], 'Looking at the prize takes nothing yet');
  await dialog.getByRole('button', { name: 'Back to the prizes' }).click();
  await prize.waitFor();
  assert.deepEqual(await page.evaluate(() => { const g = window.__tot.game; return [g.state, g.choices.map(c => c.id).join(), g.gunChoices.length]; }), ['levelup', treats, 1], 'Back at the bowl with every prize still there');
  await prize.click();
  await dialog.waitFor();
  await page.keyboard.press('Escape'); // leaving by key or by the close button also goes back, never loses the bowl
  await prize.waitFor();
  assert.equal(await page.evaluate(() => window.__tot.game.state), 'levelup');
  await prize.click();
  await dialog.getByRole('button', { name: /Swap.*slot 2/ }).click();
  await page.waitForFunction(() => window.__tot.game.state === 'play');
  assert.deepEqual(await page.evaluate(() => { const g = window.__tot.game; return [g.p.weapons.map(w => w.def.id).join(), g.choices.length + g.gunChoices.length, g.pickups.filter(k => k.weapon).map(k => k.weapon.def.id).join(), g.prizeGun]; }), ['stream,laser', 0, 'soaker', false], 'Taken into slot 2: the bowl is done and the old gun lies on the ground');
  await page.evaluate(() => { const g = window.__tot.game; g.pickups = []; g.pendingLevels = 0; });

  // ---- after a boss: no shop pops up, 20 quiet seconds on the clock ----
  await page.evaluate(() => {
    const g = window.__tot.game;
    g.pickups = []; g.pendingLevels = 0; g.director = Object.getPrototypeOf(g).director.bind(g);
    const boss = g.spawnEnemy('king', g.p.x + 3, g.p.y); g.boss = boss; g.killEnemy(boss); g.pickups = [];
  });
  await page.getByText(/All quiet · \d+s · find the shop/).waitFor();
  await page.waitForTimeout(1500);
  const quiet = await page.evaluate(() => { const g = window.__tot.game; return { state: g.state, calm: g.calmT, enemies: g.enemies.length, moved: g.time - g.shopsMovedAt < 5 }; });
  assert.ok(quiet.state === 'play' && quiet.calm > 15 && quiet.calm < 20 && quiet.enemies === 0, `Playing on in the quiet (${JSON.stringify(quiet)})`);
  assert.equal(await page.getByRole('heading', { name: /Treats & trades|Upgrade break/ }).count(), 0, 'No shop opened by itself');
  await page.screenshot({ path: 'art/world/checks/boss-quiet.png' });
  await page.evaluate(() => { window.__tot.game.calmT = 0.2; });
  await page.waitForFunction(() => window.__tot.game.calmT === 0 && window.__tot.game.enemies.length > 0, null, { timeout: 20000 });

  assert.deepEqual(errors, [], 'No page errors');
  console.log('loot levels, loot colours, legendary lines, gun comparison, quiet after a boss and light blasts: ok');
} finally { await browser.close(); }
