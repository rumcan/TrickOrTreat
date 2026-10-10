import assert from 'node:assert/strict';
import test from 'node:test';
import { weightedPick, vendingCost, VENDING_RARITY_ODDS } from '../src/game/vending-odds.ts';
test('earned-coin cost begins at 60 and rises modestly each play', () => {
  assert.equal(vendingCost(0), 60); assert.equal(vendingCost(1), 75); assert.equal(vendingCost(2), 94);
  assert.equal(vendingCost(-1), 60);
});
test('rarity odds total 100 and keep powerful drops rare', () => {
  assert.equal(VENDING_RARITY_ODDS.reduce((a, b) => a + b), 100);
  assert.deepEqual([...VENDING_RARITY_ODDS], [50, 30, 15, 4, 1]);
});
test('locked zero-weight previews never win, even at RNG endpoints', () => {
  const pool = [{ id: 'preview', weight: 0 }, { id: 'free', weight: 1 }, { id: 'invalid', weight: -5 }];
  for (const random of [0, .5, .999999, 1]) assert.equal(weightedPick(pool, () => random).id, 'free');
  assert.equal(weightedPick([{ weight: 0 }]), null);
});
test('weighted selection follows its published rarity probabilities', () => {
  const pool = VENDING_RARITY_ODDS.map((weight, rarity) => ({ weight, rarity }));
  const counts = [0, 0, 0, 0, 0];
  for (let i = 0; i < 10000; i++) counts[weightedPick(pool, () => (i + .5) / 10000).rarity]++;
  assert.deepEqual(counts, [5000, 3000, 1500, 400, 100]);
});
