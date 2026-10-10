import test from 'node:test';
import assert from 'node:assert/strict';
import { stickVector } from '../src/game/touch-input.ts';
import { buttonPress } from '../src/ui/button-press.ts';

test('stick center and dead zone do not move or fire', () => {
  for (const [x, y] of [[0, 0], [1, 1], [5, 0], [0, -5]]) assert.deepEqual(stickVector(x, y, 40), { x: 0, y: 0 });
});
test('analog strength increases smoothly to full speed', () => {
  const slow = stickVector(10, 0, 40), medium = stickVector(25, 0, 40), full = stickVector(40, 0, 40);
  assert.ok(slow.x > 0 && slow.x < medium.x && medium.x < full.x);
  assert.deepEqual(full, { x: 1, y: 0 });
});
test('large and diagonal drags preserve direction but never exceed unit strength', () => {
  for (const [x, y] of [[100, 0], [-100, 0], [0, -100], [100, 100], [-100, 100]]) {
    const vector = stickVector(x, y, 40);
    assert.ok(Math.abs(Math.hypot(vector.x, vector.y) - 1) < 1e-12);
    assert.ok(vector.x === 0 || Math.sign(vector.x) === Math.sign(x));
    assert.ok(vector.y === 0 || Math.sign(vector.y) === Math.sign(y));
  }
});
test('invalid geometry yields a neutral vector rather than stuck or NaN movement', () => {
  for (const [x, y, radius] of [[NaN, 0, 40], [0, Infinity, 40], [10, 10, 0], [10, 10, -1]]) assert.deepEqual(stickVector(x, y, radius), { x: 0, y: 0 });
});
test('secondary fingers activate actions immediately; synthetic clicks do not duplicate them', () => {
  let calls = 0, prevented = 0;
  const props = buttonPress(() => calls++);
  const target = { disabled: false };
  props.onPointerDown({ button: 0, isPrimary: false, currentTarget: target, preventDefault: () => prevented++ });
  props.onClick({ detail: 1, currentTarget: target });
  assert.equal(calls, 1); assert.equal(prevented, 1);
  props.onClick({ detail: 0, currentTarget: target });
  assert.equal(calls, 2, 'Keyboard and assistive clicks still activate');
  target.disabled = true;
  props.onPointerDown({ button: 0, currentTarget: target, preventDefault() {} });
  props.onClick({ detail: 0, currentTarget: target });
  assert.equal(calls, 2, 'Disabled actions cannot bypass cooldowns');
});
