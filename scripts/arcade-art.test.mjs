import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';

const manifest=JSON.parse(await fs.readFile('public/assets/manifest.json','utf8'));
const specs=JSON.parse(await fs.readFile('art/arcade/v2/specs.json','utf8'));
const report=JSON.parse(await fs.readFile('art/arcade/v2/alignment-report.json','utf8'));
const prompts=JSON.parse(await fs.readFile('art/arcade/v2/prompts.json','utf8'));
assert.equal(specs.length,37); assert.equal(report.length,specs.length);
assert.equal(prompts.assets.length,specs.length);
assert.ok(!Object.keys(manifest.overrides).some(key=>key.startsWith('arcade_')&&!key.startsWith('arcade_v2_')&&!key.startsWith('arcade_staff_')));
for(const spec of specs){
 const item=manifest.overrides[spec.key];assert.ok(item,`Missing ${spec.key}`);
 const info=await sharp(`public/assets/${item.file}`).metadata();
 assert.equal(info.width,spec.pixelWidth);assert.equal(info.height,spec.pixelHeight);
 assert.equal(info.hasAlpha,true);assert.equal(item.scale,2);
 if(spec.anchor)assert.deepEqual(item.anchor,spec.anchor.map(v=>v*2));
 const alignment=report.find(row=>row.key===spec.key);assert.ok(alignment);
 assert.ok(alignment.overflow<=.035,`${spec.key}: frame drift`);
 assert.ok(alignment.iou>.35,`${spec.key}: silhouette mismatch`);
 const guide=await sharp(`art/arcade/v2/guides/${spec.key}.png`).metadata();
 assert.equal(guide.width,1024);assert.equal(guide.height,1024);
 const prompt=prompts.assets.find(row=>row.key===spec.key);assert.ok(prompt?.prompt?.length>100);
}
console.log(`PASS ${specs.length} individually vector-guided sprites: alpha, anchors, full-frame alignment and retained prompts.`);
