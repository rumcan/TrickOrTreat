import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright-core';

// Beyond the capstones every arm of the constellation has two more stars: a ranked one and a strong finale.
// Half of them are free, half belong to the full game; each has a painted icon and room on the canvas.
const FREE = ['boombox', 'rewind', 'lava', 'slinky', 'cube', 'floppy'], FULL = ['flash', 'rockstar', 'shades', 'pet', 'pager', 'brick'];
const browser = await chromium.launch({ channel: 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 1580, height: 940 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 120000 });
  const tree = await page.evaluate(async ({ FREE, FULL }) => {
    const d = await import('/src/game/data.ts');
    const by = d.TALENT_BY_ID, all = d.TALENTS, out = { problems: [] };
    for (const id of [...FREE, ...FULL]) {
      const t = by[id];
      if (!t) { out.problems.push(`${id} is missing`); continue; }
      if (!!t.premium !== FULL.includes(id)) out.problems.push(`${id} is in the wrong tier`);
      if (t.req.length !== 1 || !by[t.req[0]]) out.problems.push(`${id} hangs off nothing`);
      else if (!!by[t.req[0]].premium !== !!t.premium) out.problems.push(`${id} mixes the free and the full-game arm`);
      else if (by[t.req[0]].branch !== t.branch) out.problems.push(`${id} is on another branch than its parent`);
      const image = await fetch(`./images/talents/${id}.webp`);
      if (!image.ok || !(image.headers.get('content-type') || '').startsWith('image/')) out.problems.push(`${id} has no icon`);
    }
    // every arm ends in exactly one finale, reached through an old capstone
    out.finales = all.filter(t => t.desc.startsWith('FINALE')).map(t => `${t.id}:${t.branch}:${!!t.premium}:${by[by[t.req[0]].req[0]].capstone === true}`).sort();
    // nothing overlaps: stars keep their distance from each other and from the root
    for (const a of all) {
      if (Math.hypot(a.x - d.TALENT_ROOT.x, a.y - d.TALENT_ROOT.y) < 110) out.problems.push(`${a.id} sits on the root`);
      for (const b of all) if (a.id < b.id && Math.hypot(a.x - b.x, a.y - b.y) < 100) out.problems.push(`${a.id} and ${b.id} overlap`);
    }
    // what the finales do, on top of an otherwise empty tree
    const stats = (talents) => { const s = d.baseStats(); for (const t of all) if (talents[t.id]) t.apply(s, talents[t.id]); return s; };
    const base = stats({});
    out.rewind = { pellets: stats({ rewind: 1 }).pellets - base.pellets, pierce: stats({ rewind: 1 }).pierce - base.pierce };
    out.slinky = { revive: stats({ slinky: 1 }).revive - base.revive, armor: +stats({ slinky: 1 }).armor.toFixed(2) };
    out.floppy = { coins: stats({ floppy: 1 }).startCoins - base.startCoins, rarity: stats({ floppy: 1 }).startRarity - base.startRarity };
    out.rockstar = { critDmg: +(stats({ rockstar: 1 }).critDmg - base.critDmg).toFixed(2), mate: +stats({ rockstar: 1 }).companionDmg.toFixed(2) };
    out.brick = { dash: stats({ brick: 1 }).dashCharges - base.dashCharges, move: +stats({ brick: 1 }).move.toFixed(2) };
    out.pet = { shield: stats({ pet: 1 }).maxShield - base.maxShield };
    out.cost = Math.min(...all.filter(t => t.desc.startsWith('FINALE')).map(t => t.cost(0)));
    // a save that has walked the free Mischief arm to its old capstone and can pay for the rest
    d.storeSave({ soul: 5000, best: 400, hero: 0, talents: { sharp: 5, lucky: 3, hot: 1, prankster: 1 } });
    return out;
  }, { FREE, FULL });
  assert.deepEqual(tree.problems, []);
  assert.deepEqual(tree.finales, ['brick:2:true:true', 'floppy:2:false:true', 'pet:1:true:true', 'rewind:0:false:true', 'rockstar:0:true:true', 'slinky:1:false:true'], 'One finale per arm, two steps past the old capstone');
  assert.deepEqual(tree.rewind, { pellets: 1, pierce: 1 });
  assert.deepEqual(tree.slinky, { revive: 1, armor: 0.15 });
  assert.deepEqual(tree.floppy, { coins: 200, rarity: 1 });
  assert.deepEqual(tree.rockstar, { critDmg: 1, mate: 1.5 });
  assert.deepEqual(tree.brick, { dash: 2, move: 1.15 });
  assert.deepEqual(tree.pet, { shield: 100 });
  assert.ok(tree.cost >= 600, 'A finale costs several runs of Soul Candy');

  // on screen: the whole constellation fits its sky, and the new stars can be bought in order
  await page.reload();
  await page.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 120000 });
  await page.getByRole('button', { name: /^Talents/ }).click();
  await page.locator('.talent-svg').waitFor();
  const fit = await page.evaluate(() => {
    const sky = document.querySelector('.talent-sky').getBoundingClientRect();
    const nodes = [...document.querySelectorAll('.talent-svg g')].map(g => g.getBoundingClientRect()).filter(r => r.width);
    return { inside: nodes.every(r => r.left >= sky.left && r.right <= sky.right && r.top >= sky.top && r.bottom <= sky.bottom), images: [...document.querySelectorAll('.talent-svg image')].length };
  });
  assert.ok(fit.inside, 'Every star, label and rank pip is inside the sky');
  assert.equal(fit.images, 42, 'The root and 41 talents each show an icon');
  const star = (name) => page.locator('.talent-svg g', { has: page.locator(`text:text-is("${name}")`) }).last();
  await star('Be Kind, Rewind').dispatchEvent('click'); // (the stars pulse, so they never count as "stable" for a pointer click) not yet: Boombox Bass comes first
  assert.equal(await page.evaluate(async () => (await import('/src/game/data.ts')).loadSave().talents.rewind ?? 0), 0, 'The finale needs the star before it');
  await star('Boombox Bass').dispatchEvent('click');
  await star('Be Kind, Rewind').dispatchEvent('click');
  const bought = await page.evaluate(async () => { const s = (await import('/src/game/data.ts')).loadSave(); return { boombox: s.talents.boombox, rewind: s.talents.rewind, soul: s.soul }; });
  assert.deepEqual(bought, { boombox: 1, rewind: 1, soul: 5000 - 180 - 700 });
  await fs.mkdir('art/world/checks', { recursive: true });
  await page.screenshot({ path: 'art/world/checks/talent-finales.png' });
  assert.deepEqual(errors, [], 'No page errors');
  console.log('talent finales: 6 free and 6 full-game stars past the capstones, icons, layout and purchase: ok');
} finally { await browser.close(); }
