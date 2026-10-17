/** Framing guides, not game artwork: exact 2:1 ground axes, upright verticals, no perspective. */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {sheets} from './clutter-specs.mjs';
import {ROOT,artDir} from '../lib/town-scene.mjs';
const DIR=path.join(artDir('builder-pois/guides')),SIZE=1536,CELL=SIZE/2,PPM=128,ZPM=PPM*Math.sqrt(1.5);
await fs.mkdir(DIR,{recursive:true});
const pts=p=>p.map(v=>v.join(',')).join(' ');
for(const [name,items]of Object.entries(sheets)){
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}"><rect width="100%" height="100%" fill="#202931"/>`;
 for(let i=0;i<items.length;i++){
  const a=items[i],cx=(i%2+.5)*CELL,cy=(Math.floor(i/2)+.74)*CELL;
  const p=(x,y,z=0)=>[cx+(x-y)*PPM,cy+(x+y)*PPM/2-z*ZPM];
  const g=[p(-a.w/2,-a.d/2),p(a.w/2,-a.d/2),p(a.w/2,a.d/2),p(-a.w/2,a.d/2)],top=[p(-a.w/2,-a.d/2,a.h),p(a.w/2,-a.d/2,a.h),p(a.w/2,a.d/2,a.h),p(-a.w/2,a.d/2,a.h)];
  svg+=`<polygon points="${pts(g)}" fill="#4c645d" stroke="#8ae0bc" stroke-width="3"/>`;
  if(!a.flat)svg+=`<polygon points="${pts([g[1],g[2],top[2],top[1]])}" fill="#586b79" stroke="#a3bfd0" stroke-width="3"/><polygon points="${pts([g[2],g[3],top[3],top[2]])}" fill="#687f90" stroke="#a3bfd0" stroke-width="3"/><polygon points="${pts(top)}" fill="#899eaa" stroke="#a3bfd0" stroke-width="3"/>`;
  svg+=`<circle cx="${cx}" cy="${cy}" r="5" fill="#ffb65d"/><text x="${i%2*CELL+30}" y="${Math.floor(i/2)*CELL+45}" fill="#eee" font-family="sans-serif" font-size="25">${i+1}: ${a.name}</text>`;
 }
 svg+='</svg>';await sharp(Buffer.from(svg)).png().toFile(path.join(DIR,name+'.png'));
}
const lib=JSON.parse(await fs.readFile(path.join(ROOT,'output/town-builder/library/library.json'),'utf8'));
await fs.writeFile(path.join(DIR,'asset-audit.json'),JSON.stringify({existingSprites:lib.items.length,reuseBuildings:['town:fish_tackle','world:video_rental'],reuseProps:['world:bench','world:trashcan','town:bike_rack','town:delivery_crates','town:planter_terracotta','ref:halloween-mums','ref:halloween-pumpkin-cluster'],newSheets:sheets,projection:{axisPxPerM:32,groundSlope:.5,heading:45,pitch:30,roll:0},rejectedDuplicates:['native/fish-building.png','native/video-building.png'],reason:'Already owned; camera drift. Do not register duplicate buildings.'},null,2));
console.log(DIR);
