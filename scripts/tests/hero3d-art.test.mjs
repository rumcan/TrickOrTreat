import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';

const expected = ['tommy','sam','jess','maya','leo','tommy_pumpkin','sam_astronaut','jess_vampire','maya_knight','leo_moth'].sort();
const hands = JSON.parse(await fs.readFile('src/game/art/hero3d.json','utf8'));
for (const id of ['maya_knight','leo_moth']) {
  const glb = await fs.readFile(`art/3d/${id}/walk.glb`);
  const json = JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString().trim());
  assert.ok(json.animations?.length, `${id}: transferred walk animation is present`);
  assert.ok(json.materials.every(m => m.pbrMetallicRoughness?.metallicFactor === 0 && m.pbrMetallicRoughness.roughnessFactor >= .8), `${id}: cloth/cardboard must use matte materials under the shared kid lighting`);
}
assert.deepEqual(Object.keys(hands).sort(), expected, 'All five kids and their one own costume must be rendered');
const clipped = [];
for (const id of expected) {
  assert.equal(hands[id].length, 8);
  for (const row of hands[id]) {
    assert.equal(row.length,7);
    for (const grip of row) {
      assert.equal(grip.length,2); assert.ok(grip.every(Number.isFinite));
      assert.ok(Math.abs(grip[0]) < 56 && grip[1] > -90 && grip[1] < -10, `${id}: grip must be inside the frame above the feet`);
    }
  }
  const {data,info} = await sharp(`public/assets/hero3d/hero3d_${id}.webp`).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(info.width,3136); assert.equal(info.height,1792); assert.equal(info.channels,4);
  const alpha = (x,y) => data[(y*info.width+x)*4+3];
  for (let row=0;row<8;row++) for (let col=0;col<7;col++) {
    const x=col*224,y=row*224;
    for (let p=0;p<224;p++) {
      if (Math.max(alpha(x+p,y),alpha(x+p,y+223),alpha(x,y+p),alpha(x+223,y+p)) >= 128) { clipped.push(`${id}:${row}/${col}`); break; }
    }
  }
}
assert.deepEqual(clipped, [], 'Silhouettes must not be clipped at frame edges');
console.log('All ten held-gun atlases: dimensions, transparent frame edges and 560 finite hand anchors passed.');
