import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import sharp from 'sharp';
import { inside, promptFor, packPng, validatePacked } from './lib/world-art.mjs';

const prop = { key: 'mailbox', category: 'prop', w: 64, h: 96, anchor: [32, 80], footprint: [1, 1], prompt: 'Isometric hand-painted pixel-art, crisp dark outline. A red mailbox.' };
const style = { style: 'Richly painted', palette: 'navy and orange', lighting: 'neutral moonlit', projection: '2:1 dimetric', avoid: 'HUD, cast shadows' };
async function sprite(width = 64, height = 96) {
  return sharp({ create: { width, height, channels: 4, background: '#00000000' } }).composite([{ input: Buffer.from('<svg width="20" height="40"><rect width="20" height="40" fill="red"/></svg>'), left: 22, top: 40 }]).png().toBuffer();
}

test('rejects destination traversal without banning names containing two dots', () => {
  const root = path.resolve('art/world');
  assert.throws(() => inside(root, '../escape.png'), /inside/);
  assert.equal(inside(root, 'ok..png'), path.join(root, 'ok..png'));
});
test('brief keeps atlas geometry and subject but uses the reference medium', () => {
  const prompt = promptFor(prop, style, 4);
  assert.match(prompt, /red mailbox/);
  assert.match(prompt, /256x384/);
  assert.match(prompt, /128,320/);
  assert.match(prompt, /Image 1 = STYLE/);
  assert.match(prompt, /Image 2 = procedural LAYOUT/);
  assert.doesNotMatch(prompt, /hand-painted pixel-art|crisp dark outline/);
  assert.doesNotMatch(promptFor({ ...prop, prompt: 'hand-painted pixel art' }, style, 4), /hand-painted pixel art/);
});
test('packs a proportional transparent sprite without losing transparency', async () => {
  const result = await packPng(await sprite(), prop, 2);
  const meta = await sharp(result.packed).metadata();
  assert.deepEqual([meta.width, meta.height, meta.hasAlpha], [128, 192, true]);
  await validatePacked(result.packed, prop, 2);
});
test('rejects opaque, empty and aspect-mismatched images', async () => {
  const opaque = await sharp({ create: { width: 64, height: 96, channels: 3, background: '#ffffff' } }).png().toBuffer();
  const empty = await sharp({ create: { width: 64, height: 96, channels: 4, background: '#00000000' } }).png().toBuffer();
  await assert.rejects(packPng(opaque, prop, 1), /transparency/);
  await assert.rejects(packPng(empty, prop, 1), /visible artwork/);
  await assert.rejects(packPng(await sprite(100, 100), prop, 1), /proportions/);
});
test('source anchor shifts a different canvas correctly and rejects clipping', async () => {
  const result = await packPng(await sprite(100, 100), prop, 1, [32, 80]);
  const { data, info } = await sharp(result.packed).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // Scale .64, so source anchor (32,80) is translated to atlas (32,80).
  assert.ok(data[(70 * info.width + 32) * 4 + 3] > 240);
  await assert.rejects(packPng(await sprite(100, 100), prop, 1, [99, 99]), /clip/);
  await assert.rejects(packPng(await sprite(), prop, 1, [32, NaN]), /Source anchor/);
});
test('tile validation detects interior holes and packed size mistakes', async () => {
  const tile = { key: 'tile_grass_0', category: 'tile', w: 128, h: 64, prompt: 'grass' };
  const good = await sharp(Buffer.from('<svg width="128" height="64"><polygon points="64,0 128,32 64,64 0,32" fill="green"/></svg>')).png().toBuffer();
  const result = await packPng(good, tile, 1);
  await validatePacked(result.packed, tile, 1);
  await assert.rejects(validatePacked(result.packed, tile, 2), /dimensions/);
  const hole = await sharp(good).composite([{ input: Buffer.from('<svg width="16" height="16"><rect width="16" height="16" fill="white"/></svg>'), left: 56, top: 24, blend: 'dest-out' }]).png().toBuffer();
  await assert.rejects(validatePacked(hole, tile, 1), /holes/);
});

test('repacks a monster generation grid into the horizontal runtime strip', async () => {
  const sheet = { key: 'enemy_test', category: 'sheet', w: 96, h: 24, frameW: 16, frameH: 24, rows: ['walk'], rowFrames: [6], anchor: [8, 22], prompt: 'monster' };
  const layers = [];
  for (let f = 0; f < 6; f++) layers.push({ input: Buffer.from(`<svg width="16" height="24"><rect x="3" y="3" width="10" height="18" fill="rgb(${f * 40},0,0)"/></svg>`), left: (f % 3) * 16, top: Math.floor(f / 3) * 24 });
  const source = await sharp({ create: { width: 48, height: 48, channels: 4, background: '#00000000' } }).composite(layers).png().toBuffer();
  const result = await packPng(source, sheet, 1, undefined, [3, 2]);
  await validatePacked(result.packed, sheet, 1);
  const { data, info } = await sharp(result.packed).raw().toBuffer({ resolveWithObject: true });
  for (let f = 0; f < 6; f++) assert.equal(data[(12 * info.width + f * 16 + 8) * 4], f * 40);
});

test('trims transparent terrain padding without relaxing hole detection', async () => {
  const tile = { key: 'tile_test', category: 'tile', w: 128, h: 64, prompt: 'soil' };
  const source = await sharp(Buffer.from('<svg width="160" height="80"><polygon points="80,8 144,40 80,72 16,40" fill="brown"/></svg>')).png().toBuffer();
  const packed = await packPng(source, tile, 1, undefined, undefined, false, true);
  await validatePacked(packed.packed, tile, 1);
  assert.ok(packed.tileTrim);
});

test('aligns a compact animation grid using uniform sizing and shared baseline', async () => {
  const sheet = { key: 'enemy_test', category: 'sheet', w: 96, h: 24, frameW: 16, frameH: 24, rows: ['walk'], rowFrames: [6], anchor: [8, 22], prompt: 'monster' };
  const layers = Array.from({ length: 6 }, (_, f) => ({ input: Buffer.from('<svg width="32" height="32"><rect x="10" y="5" width="12" height="24" fill="red"/></svg>'), left: f % 3 * 32, top: Math.floor(f / 3) * 32 }));
  const source = await sharp({ create: { width: 96, height: 64, channels: 4, background: '#00000000' } }).composite(layers).png().toBuffer();
  await assert.rejects(packPng(source, sheet, 1, undefined, [3, 2]), /proportions/);
  const packed = await packPng(source, sheet, 1, undefined, [3, 2], true);
  await validatePacked(packed.packed, sheet, 1);
  assert.match(packed.gridAlignment, /shared feet baseline/);
});

test('clears only unused hero animation cells and supports explicit icon pivots', async () => {
  const sheet = { key: 'hero_test', category: 'sheet', w: 96, h: 48, frameW: 16, frameH: 24, rows: ['idle', 'walk'], rowFrames: [4, 6], anchor: [8, 22], prompt: 'kid' };
  const layers = Array.from({ length: 12 }, (_, f) => ({ input: Buffer.from('<svg width="16" height="24"><rect x="3" y="3" width="10" height="18" fill="red"/></svg>'), left: f % 6 * 16, top: Math.floor(f / 6) * 24 }));
  const source = await sharp({ create: { width: 96, height: 48, channels: 4, background: '#00000000' } }).composite(layers).png().toBuffer();
  await assert.rejects(validatePacked(source, sheet, 1), /expected empty/);
  const packed = await packPng(source, sheet, 1, undefined, undefined, false, false, true);
  await validatePacked(packed.packed, sheet, 1);
  const icon = { ...prop, category: 'icon' };
  const aligned = await packPng(await sprite(100, 100), icon, 1, [32, 80]);
  await validatePacked(aligned.packed, icon, 1);
});
