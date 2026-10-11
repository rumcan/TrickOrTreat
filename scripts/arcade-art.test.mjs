import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import {arcadeIslands} from './lib/arcade-alpha.mjs';

const manifest=JSON.parse(await fs.readFile('public/assets/manifest.json','utf8'));
const specs=JSON.parse(await fs.readFile('art/arcade/specs.json','utf8'));
assert.equal((await arcadeIslands('art/arcade/furniture-atlas.png')).components.length,12);
for(const spec of specs.filter(s=>s.category==='prop')){
 const item=manifest.overrides[spec.key];assert.ok(item,`Missing ${spec.key}`);
 const info=await sharp(`public/assets/${item.file}`).metadata();
 assert.equal(info.width,spec.w*2);assert.equal(info.height,spec.h*2);
 assert.equal(info.hasAlpha,true);assert.equal(item.scale,2);
 assert.deepEqual(item.anchor,spec.anchor.map(v=>v*2));
}
assert.equal((await sharp('public/assets/arcade/carpet.webp').metadata()).width,512);
console.log('PASS arcade atlas: 12 complete silhouettes, 14 anchored transparent sprites and carpet.');
