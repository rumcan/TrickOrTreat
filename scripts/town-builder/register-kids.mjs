/** Add the playable kids to the town builder library as scale references, at exactly their in-game size.
 *  node scripts/town-builder/register-kids.mjs
 *  The game draws a kid frame at 64x96 px with the feet at (32,90) (heroSheet in src/game/art/characters.ts, blitFrame at
 *  scale 1). The sheets in public/assets/characters are stored at 2x (some at 1x), so the idle frames are cut out and
 *  brought to the library's 2x: front = row 0, back = row 2, frame 0. Category "Kids (for scale)"; re-running replaces the same ids. */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {ROOT} from '../lib/town-scene.mjs';
import {ensureShadows} from './shadows.mjs';
const LIB=path.join(ROOT,'output/town-builder/library'),CH=path.join(ROOT,'public/assets/characters'),CAT='Kids (for scale)';
const FW=64,FH=96,AX=32,AY=90,K=2,KIDS=[['tommy','Tommy'],['jess','Jess'],['sam','Sam']],ROWS=[[0,'front','facing you'],[2,'back','walking away']];
const lib=JSON.parse(await fs.readFile(path.join(LIB,'library.json'),'utf8'));let n=0;
for(const [kid,name] of KIDS){const src=path.join(CH,`hero_${kid}.png`),meta=await sharp(src).metadata();const k=meta.width/(FW*6);
 for(const [row,key,label] of ROWS){const id=`kid:${kid}-${key}`,safe=`kid_${kid}_${key}`;
  const frame=await sharp(src).extract({left:0,top:Math.round(row*FH*k),width:Math.round(FW*k),height:Math.round(FH*k)}).resize(FW*K,FH*K,{kernel:k<K?'nearest':'lanczos3'}).png().toBuffer();
  await sharp(frame).webp({quality:95,alphaQuality:100}).toFile(path.join(LIB,'sprites',safe+'.webp'));
  await sharp(frame).resize(112,112,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).webp({quality:90}).toFile(path.join(LIB,'thumbs',safe+'.webp'));
  const item={id,name:`${name} (${label}, game size)`,category:CAT,file:'sprites/'+safe+'.webp',thumb:'thumbs/'+safe+'.webp',w:FW,h:FH,ax:AX,ay:AY,fw:.25,fh:.25,flat:false,
   source:path.relative(ROOT,src).replace(/\\/g,'/'),tags:['scale reference','player kid','in-game size']};
  const i=lib.items.findIndex(x=>x.id===id);if(i>=0)lib.items[i]=item;else lib.items.push(item);n++;}}
if(!lib.categories.includes(CAT))lib.categories.push(CAT);
await fs.writeFile(path.join(LIB,'library.json.kids-pending'),JSON.stringify(lib,null,1));await fs.rename(path.join(LIB,'library.json.kids-pending'),path.join(LIB,'library.json'));
await ensureShadows();console.log(n,'kid sprites registered in',CAT);
