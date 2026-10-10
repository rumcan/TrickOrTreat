import test from 'node:test';
import assert from 'node:assert/strict';
import { tilePoint, curbPoint, curbCoordinates } from '../src/game/art/street-geometry.ts';

test('curb endpoints and inner edges meet exactly across repeated tiles in all four directions', () => {
  const deltas = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  for (let edge = 0; edge < 4; edge++) for (const inset of [0, .045, .12]) {
    const end = tilePoint(...curbPoint(edge, 1, inset), 128, 64);
    const next = tilePoint(...curbPoint(edge, 0, inset), 128, 64);
    const [u, v] = deltas[edge];
    assert.ok(Math.abs(end[0] - next[0] - (u - v) * 64) < 1e-10);
    assert.ok(Math.abs(end[1] - next[1] - (u + v) * 32) < 1e-10);
  }
});

test('curb sampling uses the same world geometry as the strip edges', () => {
  for (let edge = 0; edge < 4; edge++) for (const along of [0, .25, .5, 1]) for (const inset of [0, .045, .12]) {
    const [t, depth] = curbCoordinates(edge, ...curbPoint(edge, along, inset));
    assert.ok(Math.abs(t - along) < 1e-12 && Math.abs(depth - inset) < 1e-12);
  }
});

test('sidewalk half-slab joints follow the exact 2:1 map projection', () => {
  assert.deepEqual(tilePoint(.5, .5, 128, 64), [64, 32]);
  for (const fixed of [0, .5, 1]) {
    const a = tilePoint(0, fixed, 128, 64), b = tilePoint(1, fixed, 128, 64);
    const c = tilePoint(fixed, 0, 128, 64), d = tilePoint(fixed, 1, 128, 64);
    assert.deepEqual([b[0] - a[0], b[1] - a[1]], [64, 32]);
    assert.deepEqual([d[0] - c[0], d[1] - c[1]], [-64, 32]);
  }
});
