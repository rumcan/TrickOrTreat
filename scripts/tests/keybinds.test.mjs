import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import {
  BINDS, reassign, clearSlot, defaultBindings, sanitize, keyLabel,
  makeLookup, normalizeKey, restoreOne, isDefault,
} from '../../src/game/keybinds.ts';

const tokensFrom = (bindings) => makeLookup(bindings);

test('every action ships with at least one key, and no key is shared', () => {
  const defaults = defaultBindings();
  const seen = new Map();
  for (const def of BINDS) {
    assert.ok(def.defaults.length >= 1, `${def.id} has a default key`);
    assert.ok(def.defaults.includes(def.token), `${def.id} keeps its canonical token in its own defaults`);
    for (const key of defaults[def.id]) {
      assert.equal(seen.has(key), false, `${key} is only bound to one action (${def.id} and ${seen.get(key)})`);
      seen.set(key, def.id);
    }
  }
  // the four directions each have a letter and an arrow, so both hands work
  for (const id of ['moveUp', 'moveDown', 'moveLeft', 'moveRight']) {
    assert.equal(defaultBindings()[id].length, 2, `${id} has an arrow alternative`);
  }
});

test('the engine only ever asks for tokens the bindings can produce', async () => {
  const source = await fs.readFile(new URL('../../src/game/engine.ts', import.meta.url), 'utf8');
  const asked = new Set([...source.matchAll(/(?:pressed|keys)\.has\('([^']*)'\)/g)].map((m) => m[1]));
  const produced = new Set(BINDS.map((b) => b.token));
  for (const token of asked) assert.ok(produced.has(token), `some key produces "${token}"`);
  // and every action the settings screen lists is actually read by the game
  const used = new Set(BINDS.filter((b) => asked.has(b.token)).map((b) => b.id));
  assert.equal(used.size, BINDS.length, 'every rebindable action reaches the engine');
});

test('a press is translated to the action token, and rebound keys move with it', () => {
  const defaults = defaultBindings();
  assert.deepEqual(tokensFrom(defaults).get('arrowup'), ['w']);
  assert.deepEqual(tokensFrom(defaults).get('shift'), [' ']);
  assert.deepEqual(tokensFrom(defaults).get('tab'), ['m']);
  assert.equal(tokensFrom(defaults).get('z'), undefined, 'a key nobody bound produces nothing');

  const result = reassign(defaults, 'moveUp', 0, 'U');
  assert.equal(result.ok, true);
  const lookup = tokensFrom(result.bindings);
  assert.deepEqual(lookup.get('u'), ['w'], 'the new key walks up');
  assert.equal(lookup.get('w'), undefined, 'the old letter no longer walks up');
});

test('a key belongs to one action: taking it away releases it, and an action can never be emptied', () => {
  const defaults = defaultBindings();
  // Reload only has one key, so R cannot be taken from it before it is given another one
  const refusedSteal = reassign(defaults, 'interact', 0, 'r');
  assert.equal(refusedSteal.ok, false);
  assert.match(refusedSteal.reason, /Reload needs a key/);

  const moved = reassign(defaults, 'reload', 0, 'x');
  assert.equal(moved.ok, true);
  assert.deepEqual(moved.bindings.reload, ['x'], 'Reload moved to X');
  const taken = reassign(moved.bindings, 'interact', 0, 'r');
  assert.equal(taken.ok, true, 'now R is free');
  assert.deepEqual(taken.bindings.interact, ['r']);
  assert.deepEqual(taken.bindings.reload, ['x'], 'Reload keeps its new key');

  const same = reassign(defaults, 'interact', 0, 'e');
  assert.equal(same.ok, true, 'binding the key an action already has is a no-op');
  assert.deepEqual(same.bindings.interact, ['e']);

  // Escape and Tab stay where they are
  const stolen = reassign(defaults, 'interact', 0, 'Escape');
  assert.equal(stolen.ok, false);
  assert.match(stolen.reason, /always closes a menu/i);
  const stolenTab = reassign(defaults, 'interact', 0, 'tab');
  assert.equal(stolenTab.ok, false);
  assert.match(stolenTab.reason, /moves focus/i);

  // the last key of an action can never be dropped
  const cleared = clearSlot({ ...defaults, reload: ['r'] }, 'reload', 0);
  assert.equal(cleared.ok, false);
  assert.match(cleared.reason, /needs at least one key/);
  const dropped = clearSlot(defaults, 'moveUp', 1);
  assert.equal(dropped.ok, true);
  assert.deepEqual(dropped.bindings.moveUp, ['w'], 'an alternative key can go');
});

test('input is lowercased, labels are readable, and saved keys are sanitised', () => {
  assert.equal(normalizeKey('ArrowUp'), 'arrowup');
  assert.equal(keyLabel(' '), 'Space');
  assert.equal(keyLabel(' ', true), 'Spc');
  assert.equal(keyLabel('arrowup'), '↑');
  assert.equal(keyLabel('escape'), 'Esc');
  assert.equal(keyLabel('u'), 'U');

  const dirty = sanitize({ moveUp: ['W', 'w', 'escape', 'z'], interact: [], pause: ['Q'], nonsense: ['x'] });
  assert.deepEqual(dirty.moveUp, ['w', 'z'], 'duplicates and reserved keys are dropped');
  assert.deepEqual(dirty.interact, BINDS.find((b) => b.id === 'interact').defaults, 'an empty action falls back to its default');
  // a hand-edited file that gives Pause a key another action ships with: the shipped default wins and Pause
  // falls back to its own second default, so neither action is left unplayable
  assert.deepEqual(dirty.pause, ['escape']);
  assert.deepEqual(dirty.cycleGun, ['q']);
  // a file that only mentions one action: its key is kept, and every other action gets its own default
  assert.deepEqual(sanitize({ interact: ['x'] }).interact, ['x']);
  assert.deepEqual(sanitize({ interact: ['x'] }).reload, ['r']);
  assert.equal(sanitize(null).moveUp.length, 2, 'unreadable saves fall back to the defaults');
  assert.equal(sanitize({ interact: ['r'] }).reload.length, 1, 'a save that steals a key is repaired');
});

test('restoring one action gives its shipped keys back without leaving another action blind', () => {
  const after = reassign(reassign(defaultBindings(), 'reload', 0, 'x').bindings, 'interact', 0, 'r').bindings;
  assert.deepEqual(after.reload, ['x']);
  const restored = restoreOne(after, 'reload');
  assert.deepEqual(restored.reload, ['r'], 'Reload is back on R');
  assert.deepEqual(restored.interact, ['e'], 'and whichever action held R is given its own default back');
  assert.equal(isDefault(restored, 'reload'), true);
  assert.equal(isDefault(restored, 'interact'), true);
});
