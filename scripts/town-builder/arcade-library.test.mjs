import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {ROOT} from '../lib/town-scene.mjs';
import {arcadeSources} from './arcade-library.mjs';

const dir=path.join(ROOT,'output/town-builder/library'),lib=JSON.parse(await fs.readFile(path.join(dir,'library.json'),'utf8'));
const sources=await arcadeSources(),items=lib.items.filter(i=>i.id.startsWith('arcade:'));
assert.equal(items.length,sources.length);assert.equal(items.length,35);
assert.equal(new Set(lib.items.map(i=>i.id)).size,lib.items.length);
assert.ok(!items.some(i=>/chair|carpet/.test(i.id)));
for(const s of sources){
 const i=items.find(i=>i.id===s.id);assert.ok(i);
 for(const field of ['w','h','ax','ay','fw','fh','flat','category'])assert.deepEqual(i[field],s[field],s.id+': '+field);
 const sprite=await fs.readFile(path.join(dir,i.file));assert.ok(sprite.equals(await fs.readFile(s.input)),'Packed original must be preserved byte-for-byte');
 const meta=await sharp(sprite).metadata();assert.equal(meta.width,i.w*2);assert.equal(meta.height,i.h*2);assert.ok(meta.hasAlpha);
 const thumb=await sharp(path.join(dir,i.thumb)).metadata();assert.equal(thumb.width,112);assert.equal(thumb.height,112);
}
for(const category of ['Arcade furniture','Arcade decor','Arcade floor decals'])assert.ok(lib.categories.includes(category));
const backups=(await fs.readdir(path.join(dir,'backups'))).filter(f=>f.startsWith('library-before-arcade-')).sort();
const before=JSON.parse(await fs.readFile(path.join(dir,'backups',backups.at(-1)),'utf8'));
for(const i of before.items.filter(i=>!i.id.startsWith('arcade:')))assert.deepEqual(lib.items.find(j=>j.id===i.id),i,'Unrelated library entry changed: '+i.id);
console.log(JSON.stringify({passed:true,sprites:items.length,preservedExisting:before.items.filter(i=>!i.id.startsWith('arcade:')).length,checks:['exact packed bytes','game dimensions and ground anchors','footprints','alpha','thumbnails','flat overlays','categories','no rejected v1/chair/carpet','unique IDs','unrelated library preserved']}));
