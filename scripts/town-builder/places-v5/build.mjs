/** Build places-v5 presets into the town builder's preset library.
 *    node scripts/town-builder/places-v5/build.mjs [id ...] [--no-render]
 *  For each presets/<id>.mjs (files starting with _ are skipped): validate (errors stop the build), render a review
 *  picture on a test block (output/town-builder/presets-v5-study/review/<id>.png) and a 224 px thumbnail, then write the
 *  preset into output/town-builder/presets/places.json, replacing the entry with the same id and keeping every other
 *  entry (the owner's own place-two-homes included). The previous places.json is backed up to presets/history/. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {DATA} from './kit.mjs';
import {loadPreset,renderPreset} from './stage.mjs';
const HERE=path.dirname(fileURLToPath(import.meta.url)),PDIR=path.join(DATA,'presets'),REVIEW=path.join(DATA,'presets-v5-study/review');
const args=process.argv.slice(2),only=args.filter(a=>!a.startsWith('--')),render=!args.includes('--no-render');
const files=(await fs.readdir(path.join(HERE,'presets'))).filter(f=>f.endsWith('.mjs')&&!f.startsWith('_')&&(!only.length||only.includes(f.replace(/\.mjs$/,''))));
const built=[];
for(const f of files){
 const r=await loadPreset(path.join(HERE,'presets',f)),p=r.preset;
 if(r.errors.length){console.log(`${p.id}: ${r.errors.length} errors, skipped\n  `+r.errors.join('\n  '));continue;}
 if(render){await fs.mkdir(REVIEW,{recursive:true});await fs.mkdir(path.join(PDIR,'thumbs'),{recursive:true});
  const out=path.join(REVIEW,p.id+'.png');await renderPreset(p,out,{k:.4});
  await sharp(out).trim({threshold:4}).resize(224,224,{fit:'cover'}).webp({quality:88}).toFile(path.join(PDIR,'thumbs',p.id+'.webp'));}
 p.thumb=`presets/thumbs/${p.id}.webp`;p.version=5;
 built.push(p);console.log(`${p.id}: ${p.members.length} members, ${p.ground.length} ground, ${r.warnings.length} warnings`);
}
const file=path.join(PDIR,'places.json'),cur=JSON.parse(await fs.readFile(file,'utf8'));
await fs.mkdir(path.join(PDIR,'history'),{recursive:true});
await fs.copyFile(file,path.join(PDIR,'history',`places-before-v5-${new Date().toISOString().replace(/[:.]/g,'-')}.json`));
const byId=new Map(cur.presets.map(p=>[p.id,p]));for(const p of built)byId.set(p.id,p);
cur.presets=[...byId.values()];cur.version=5;
await fs.writeFile(file,JSON.stringify(cur));
console.log(`places.json: ${cur.presets.length} presets (${built.length} rebuilt)`);
