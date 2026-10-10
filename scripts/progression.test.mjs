import test from 'node:test';
import assert from 'node:assert/strict';
import { xpFor, BAG_LOOT, rewardRangeFor } from '../src/game/progression.ts';

const oldXp = level => Math.floor(6 + level * 5 + level * level * .7);
test('opening XP cost stays unchanged and every later level costs more than before', () => {
  assert.equal(xpFor(1), oldXp(1));
  for (let level = 2; level <= 150; level++) {
    assert.ok(Number.isSafeInteger(xpFor(level)));
    assert.ok(xpFor(level) > oldXp(level));
    assert.ok(xpFor(level) > xpFor(level - 1));
  }
});
test('late XP requirements compound rather than retaining the old quadratic cadence', () => {
  assert.ok(xpFor(10) / oldXp(10) > 2.3 && xpFor(10) / oldXp(10) < 2.4);
  assert.ok(xpFor(20) / oldXp(20) > 6 && xpFor(20) / oldXp(20) < 6.2);
  for (let level = 20; level < 100; level++) assert.ok(xpFor(level + 1) / xpFor(level) > 1.1);
});
test('incidental treat frequency is roughly halved without removing other bag rewards', () => {
  const weights = Object.fromEntries(BAG_LOOT);
  assert.deepEqual(Object.keys(weights), ['gun', 'treat', 'upgrade', 'hoard', 'aid', 'costume']);
  const chance = weights.treat / Object.values(weights).reduce((total, weight) => total + weight, 0);
  assert.ok(chance >= .1 && chance <= .12);
  assert.ok(chance / .22 < .53);
});
test('building reward tiers distinguish homes, businesses and major landmarks', () => {
  assert.deepEqual(rewardRangeFor('house'), { min: 0, max: 2, label: 'Common / Uncommon / Rare' });
  for (const kind of ['arcade', 'diner', 'video', 'videorental', 'snackbar']) assert.deepEqual(rewardRangeFor(kind), { min: 2, max: 3, label: 'Rare / Epic' });
  for (const kind of ['school', 'church', 'barn', 'crypt']) assert.deepEqual(rewardRangeFor(kind), { min: 2, max: 4, label: 'Rare / Epic / Legendary' });
});
