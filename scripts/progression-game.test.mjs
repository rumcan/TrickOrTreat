import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ channel: 'msedge' });
try {
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 120000 });
  await page.getByRole('button', { name: /Preview expansion locally/ }).click();
  await page.getByRole('button', { name: 'Go trick-or-treating' }).click();
  await page.waitForFunction(() => !!window.__tot?.game);
  await page.getByRole('button', { name: /skip intro/ }).click();
  const result = await page.evaluate(async () => {
    const g = window.__tot.game;
    const { xpFor, rewardRangeFor, BAG_LOOT } = await import('/src/game/progression.ts');
    g.state = 'pause'; g.pickups = []; g.stats.xpGain = 1;
    g.p.level = 1; g.p.xp = 0; g.p.xpNext = xpFor(1); g.pendingLevels = 0;
    g.pickups.push({ x: g.p.x, y: g.p.y, z: 0, vz: 0, vx: 0, vy: 0, kind: 'xp3', value: 1000, mag: false, t: 1, dead: false });
    g.updatePickups(.001);
    let expectedLevel = 1, remainingXp = 1000;
    while (remainingXp >= xpFor(expectedLevel)) { remainingXp -= xpFor(expectedLevel); expectedLevel++; }
    if (g.p.level !== expectedLevel || g.p.xp !== remainingXp || g.p.xpNext !== xpFor(expectedLevel) || g.pendingLevels !== expectedLevel - 1) throw new Error('Pickup XP is not using the new curve');
    const tiers = {};
    for (const kind of ['house', 'diner', 'school', 'church', 'barn']) {
      const range = rewardRangeFor(kind), rarities = new Set();
      for (let roll = 0; roll < 200; roll++) {
        g.openLevelUp('house', 3, 3, range);
        // Rerolls must retain the building's bounds, even with extreme luck.
        g.rerolls = 1; g.reroll();
        const locked = g.lockedChoice?.scroll || g.lockedChoice?.weapon;
        for (const reward of [...g.choices, ...g.gunChoices, ...(locked ? [locked] : [])]) {
          if (reward.rarity < range.min || reward.rarity > range.max) throw new Error(`Invalid ${kind} rarity: ${reward.rarity}`);
          rarities.add(reward.rarity);
        }
      }
      tiers[kind] = [...rarities].sort();
    }
    const { buildMap, blockedCircle } = await import('/src/game/map.ts');
    for (const expanded of [false, true]) for (const seed of [1337, 12345, 54321]) {
      const map = buildMap(seed, expanded);
      const kinds = ['school', 'crypt', 'arcade', 'diner', 'video', ...(expanded ? ['church', 'barn', 'videorental', 'snackbar'] : [])];
      if (!expanded && (map.turrets.length || map.props.some(p => ['church', 'barn', 'videorental', 'snackbar', 'junglegym'].includes(p.kind)))) throw new Error('Premium landmarks/turrets leaked into the free map');
      for (const kind of kinds) {
        const buildings = map.props.filter(p => p.kind === kind);
        if (!buildings.length) throw new Error(`Missing ${kind}`);
        for (const building of buildings) {
          const venue = map.houses.find(h => h.prop === building);
          if (!venue || blockedCircle(map, venue.door.x, venue.door.y, .3)) throw new Error(`Missing/blocked ${kind} reward entrance`);
        }
      }
    }
    // Exercise E at real map entrances, then complete the visit, including its bonus gun.
    for (const kind of ['house', 'diner', 'school', 'church', 'barn']) {
      const venue = g.map.houses.find(h => h.prop.kind === kind), range = rewardRangeFor(kind);
      if (!venue) throw new Error(`No live ${kind} venue`);
      venue.trick = false; venue.visited = false;
      g.pickups = []; g.state = 'play'; g.p.x = venue.door.x; g.p.y = venue.door.y;
      g.input.pressed.add('e'); g.updateInteract(); g.input.pressed.clear();
      if (g.tot?.house !== venue) throw new Error(`E did not start trick-or-treating at ${kind}`);
      const originalRandom = Math.random;
      try { Math.random = () => 0; g.finishTot(); } finally { Math.random = originalRandom; }
      if (g.choiceRewardRange.label !== range.label || !venue.visited) throw new Error(`Visit used the wrong ${kind} tier`);
      const bonusGuns = g.pickups.filter(p => p.kind === 'weapon').map(p => p.weapon);
      if (!bonusGuns.length) throw new Error(`Missing ${kind} bonus gun`);
      for (const reward of [...g.choices, ...g.gunChoices, ...bonusGuns]) if (reward.rarity < range.min || reward.rarity > range.max) throw new Error(`Visit/bonus gun escaped ${kind} range`);
    }
    const before = g.scrollOrder.length, random = Math.random;
    try {
      // Derive the treat interval so costume-rarity rebalancing cannot stale this test.
      const total = BAG_LOOT.reduce((sum, [, weight]) => sum + weight, 0);
      const prior = BAG_LOOT.slice(0, BAG_LOOT.findIndex(([kind]) => kind === 'treat')).reduce((sum, [, weight]) => sum + weight, 0);
      const treatWeight = BAG_LOOT.find(([kind]) => kind === 'treat')[1];
      Math.random = () => (prior + treatWeight / 2) / total;
      g.openBag(g.p.x, g.p.y);
    } finally { Math.random = random; }
    if (g.scrollOrder.length !== before + 1) throw new Error('Bag treat reward did not apply');
    const { SCROLL_BY_ID } = await import('/src/game/data.ts');
    const bagTreat = SCROLL_BY_ID[g.scrollOrder.at(-1)];
    if (bagTreat.rarity < 2) throw new Error('Incidental bag treat was not rare or better');
    return { levelAfter1000Xp: expectedLevel, nextLevelXp: g.p.xpNext, tiers, bagTreat: bagTreat.name };
  });
  assert.deepEqual(result.tiers, { house: [0, 1, 2], diner: [2, 3], school: [2, 3, 4], church: [2, 3, 4], barn: [2, 3, 4] });
  assert.deepEqual(errors, []);
  console.log(JSON.stringify(result));
  console.log('XP progression, building-specific reward tiers, bounded rerolls/premium previews, entrances across six maps, and E visits/bonus guns passed.');
} finally { await browser.close(); }
