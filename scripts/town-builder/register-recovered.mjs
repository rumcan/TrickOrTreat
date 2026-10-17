/** Register Codex-generated sprites that were made but never added (found in ~/.codex/generated_images).
 *  Flat ground litter, sized like the existing poi litter: game width = (width + depth) metres x 32 px.
 *  Sources are copied into output/town-art/codex-recovered/ (TOWN_ART). Backs up library.json; never touches the owner's map. */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {ROOT,TOWN_ART,artDir} from '../lib/town-scene.mjs';
const GEN='C:/Users/Francois Smit/.codex/generated_images/01a11f9b-89e0-76d0-a6a1-1460fb6ddf7a',ART=path.join(artDir('codex-recovered')),LIB=path.join(ROOT,'output/town-builder/library');
const ITEMS=[
 {id:'recovered:star-soda-spill',name:'Star soda cup and spill',file:'exec-ebdc1805-35d3-4ffb-bd1f-a46b2e0e398f.png',w:.55,d:.35},
 {id:'recovered:pizza-box-open',name:'Open pizza box with napkin',file:'exec-57ea2f85-2247-40e2-85d5-3d024a563a0b.png',w:.5,d:.5},
 {id:'recovered:tokens-ticket',name:'Arcade tokens and ticket',file:'exec-faaef629-0651-4f7d-9a62-4fe2274a258f.png',w:.4,d:.25},
];
await fs.mkdir(ART,{recursive:true});await fs.mkdir(path.join(LIB,'backups'),{recursive:true});
const target=path.join(LIB,'library.json'),lib=JSON.parse(await fs.readFile(target,'utf8'));
await fs.copyFile(target,path.join(LIB,'backups','library-before-recovered-'+Date.now()+'.json'));
for(const a of ITEMS){
 const src=path.join(ART,a.id.split(':')[1]+'.png');await fs.copyFile(path.join(GEN,a.file),src);
 const trimmed=await sharp(src).ensureAlpha().trim({threshold:8}).png().toBuffer(),m=await sharp(trimmed).metadata();
 const gw=(a.w+a.d)*32,gh=m.height*gw/m.width,safe=a.id.replace(':','_');
 await sharp(trimmed).resize(Math.round(gw*2),Math.round(gh*2),{kernel:'lanczos3'}).webp({quality:94,alphaQuality:100}).toFile(path.join(LIB,'sprites',safe+'.webp'));
 await sharp(trimmed).resize(112,112,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).webp({quality:88,alphaQuality:100}).toFile(path.join(LIB,'thumbs',safe+'.webp'));
 const item={id:a.id,name:a.name,category:'Decals & ground',file:'sprites/'+safe+'.webp',thumb:'thumbs/'+safe+'.webp',w:+gw.toFixed(2),h:+gh.toFixed(2),ax:+(gw/2).toFixed(2),ay:+(gh/2).toFixed(2),fw:a.w/2,fh:a.d/2,flat:true,
  source:path.relative(ROOT,src).replace(/\\/g,'/'),tags:['1980s','litter','2:1','Halloween','recovered from Codex'],physicalMetres:{width:a.w,depth:a.d,height:.05}};
 lib.items=lib.items.filter(i=>i.id!==item.id);lib.items.push(item);console.log('registered',a.id,Math.round(gw)+'x'+Math.round(gh));
}
lib.categories=[...new Set(lib.items.map(i=>i.category))];
const pending=target+'.pending';await fs.writeFile(pending,JSON.stringify(lib,null,1));await fs.rename(pending,target);
console.log('library',lib.items.length,'items; map unchanged');
