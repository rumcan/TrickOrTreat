/** Freeze existing recipes and make each thumbnail show precisely the saved arrangement. No map edits. */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import {ROOT} from '../lib/town-scene.mjs';
import {fixedPreset} from './app/fixed-preset.js';
const out=path.join(ROOT,'output/town-builder'),dir=path.join(out,'presets'),stamp=Date.now(),backup=path.join(dir,'history','fixed-layout-'+stamp);
const lib=JSON.parse(await fs.readFile(path.join(out,'library/library.json'),'utf8')),items=new Map(lib.items.map(i=>[i.id,i]));
await fs.mkdir(backup,{recursive:true});await fs.mkdir(path.join(dir,'thumbs'),{recursive:true});
let count=0;
for(const name of ['presets.json','poi.json','user.json']){
 let original;try{original=await fs.readFile(path.join(dir,name),'utf8');}catch(e){if(e.code==='ENOENT')continue;throw e;}
 const data=JSON.parse(original);await fs.writeFile(path.join(backup,name),original);
 for(let n=0;n<data.presets.length;n++){
  const p=fixedPreset(data.presets[n]);assert.ok(/^[a-z0-9_-]+$/i.test(p.id),'Safe preset ID required');
  const parts=p.members.map(m=>{const it=items.get(m.pick[0]);assert.ok(it,'Missing sprite '+m.pick[0]);const sc=m.scale[0],sx=(m.dx-m.dy)*32,sy=(m.dx+m.dy)*16;
   return {it,m,w:it.w*sc,h:it.h*sc,left:sx-(m.flip?it.w-it.ax:it.ax)*sc,top:sy-it.ay*sc,depth:sy};
  }).sort((a,b)=>(a.it.flat?0:1)-(b.it.flat?0:1)||a.depth-b.depth);
  const x0=Math.floor(Math.min(...parts.map(q=>q.left)))-4,y0=Math.floor(Math.min(...parts.map(q=>q.top)))-4;
  const W=Math.ceil(Math.max(...parts.map(q=>q.left+q.w))-x0)+4,H=Math.ceil(Math.max(...parts.map(q=>q.top+q.h))-y0)+4;
  const layers=[];for(const q of parts){let im=sharp(path.join(out,'library',q.it.file)).resize(Math.max(1,Math.round(q.w)),Math.max(1,Math.round(q.h)));if(q.m.flip)im=im.flop();layers.push({input:await im.png().toBuffer(),left:Math.round(q.left-x0),top:Math.round(q.top-y0)});}
  const filename=p.id+'.webp',target=path.join(dir,'thumbs',filename);
  try{await fs.copyFile(target,path.join(backup,filename));}catch(e){if(e.code!=='ENOENT')throw e;}
  const big=await sharp({create:{width:W,height:H,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(layers).png().toBuffer();
  await sharp(big).resize(224,224,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).webp({quality:92}).toFile(target);
  p.thumb='presets/thumbs/'+filename;p.spanM=Math.max(...p.members.map(m=>Math.hypot(m.dx,m.dy)));data.presets[n]=p;count++;
 }
 const pending=path.join(dir,name+'.fixed-pending');await fs.writeFile(pending,JSON.stringify(data,null,1));await fs.rename(pending,path.join(dir,name));
}
console.log(JSON.stringify({fixedPresets:count,backup,mapChanged:false}));
