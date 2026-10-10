import test from 'node:test';
import assert from 'node:assert/strict';
import { specialChance, rollAffix, damageDefense, enemyHealthScale } from '../src/game/enemy-affixes.ts';
import { BAG_LOOT } from '../src/game/progression.ts';
test('specials appear only after wave 10, then grow without replacing the ordinary crowd', () => {
  for (let wave = 1; wave <= 10; wave++) assert.equal(rollAffix(wave, () => 0), null);
  assert.equal(specialChance(11), .12); assert.equal(specialChance(25), .4); assert.equal(specialChance(100), .4);
  let seed = 42;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  let plain = 0; const types = new Set();
  for (let i = 0; i < 10000; i++) { const a = rollAffix(30, random); if (!a) plain++; else types.add(a); }
  assert.ok(plain >= 5800); assert.equal(types.size, 6);
  assert.notEqual(rollAffix(11, () => .01), 'piercing');
  assert.equal(rollAffix(15, (() => { let i = 0; return () => i++ === 0 ? 0 : .99; })()), 'piercing');
});
test('each defense has a real counter and rejects only its relevant hit', () => {
  for (const [affix, element] of [['stormproof', 'shock'], ['fireproof', 'fire'], ['ectoproof', 'ecto']]) {
    assert.equal(damageDefense(affix, { element }).multiplier, 0);
    assert.equal(damageDefense(affix, {}).multiplier, 1);
  }
  assert.equal(damageDefense('ricochet', { ricochet: true }).multiplier, 0);
  assert.equal(damageDefense('ricochet', { ricochet: false }).multiplier, 1);
  assert.equal(damageDefense('armored', { pierce: 0 }).multiplier, .2);
  assert.equal(damageDefense('armored', { pierce: 1 }).multiplier, 1);
  assert.equal(damageDefense('piercing', { pierce: 1 }).multiplier, 0);
  assert.equal(damageDefense('piercing', { pierce: 2 }).multiplier, 1);
  assert.equal(damageDefense('piercing', { pierce: 99 }).multiplier, 1);
});
test('late ordinary enemies are much easier and scale more gently than specialists', () => {
  assert.equal(enemyHealthScale(10), 1.65 ** 9);
  assert.ok(enemyHealthScale(11, true) < enemyHealthScale(10) * .2);
  assert.ok(enemyHealthScale(20) / enemyHealthScale(20, true) > 10);
  assert.ok(Math.abs(enemyHealthScale(21) / enemyHealthScale(20) - 1.2) < 1e-10);
  assert.ok(Math.abs(enemyHealthScale(21, true) / enemyHealthScale(20, true) - 1.08) < 1e-10);
});
test('costumes are rare in bags without increasing incidental treat frequency', () => {
  const weights = Object.fromEntries(BAG_LOOT), total = Object.values(weights).reduce((a,b) => a+b,0);
  assert.ok(weights.costume / total < .012); assert.equal(total,88); assert.equal(weights.treat,10);
});
