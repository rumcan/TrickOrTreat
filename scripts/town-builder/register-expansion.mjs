/** Incrementally register visually accepted assets. Never change the owner's layout or resize axes independently. */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import {ROOT,artDir} from '../lib/town-scene.mjs';
import {expansion} from './expansion-specs.mjs';
import {ensureShadows} from './shadows.mjs';
const ART=path.join(artDir('expansion-1988')),LIB=path.join(ROOT,'output/town-builder/library');
const ids=process.argv.slice(2);assert.ok(ids.length,'Specify accepted IDs explicitly; do not blindly import unreviewed art');
const target=path.join(LIB,'library.json'),lib=JSON.parse(await fs.readFile(target,'utf8'));
const report=JSON.parse(await fs.readFile(path.join(ART,'manifest.json'),'utf8'));
let extras={items:[]};try{extras=JSON.parse(await fs.readFile(path.join(ART,'library-items.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
await fs.mkdir(path.join(ART,'sprites'),{recursive:true});await fs.mkdir(path.join(LIB,'backups'),{recursive:true});
await fs.copyFile(target,path.join(LIB,'backups','library-before-expansion-'+Date.now()+'.json'));
for(const id of ids){
 const a=expansion.find(a=>a.id===id);assert.ok(a,'Known ID required: '+id);const source=path.join(ART,'native',id+'.png'),m=await sharp(source).metadata();assert.ok(m.hasAlpha,'Real alpha required');
 const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});let x0=info.width,y0=info.height,x1=-1,y1=-1,clear=0;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){const alpha=data[(y*info.width+x)*4+3];if(alpha===0)clear++;if(alpha>24){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}}
 assert.ok(x1>x0&&y1>y0&&clear/(info.width*info.height)>.1,'Nonempty isolated transparent object required');
 assert.ok(x0>1&&y0>1&&x1<info.width-2&&y1<info.height-2,'Clipped asset rejected: '+id);
 const left=Math.max(0,x0-3),top=Math.max(0,y0-3),width=Math.min(info.width,x1+4)-left,height=Math.min(info.height,y1+4)-top;
 const sprite=path.join(ART,'sprites',id+'.png');await sharp(source).extract({left,top,width,height}).png().toFile(sprite);
 const round=new Set(['manhole','kiddie-pool','aboveground-pool','trampoline','firepit','cable-spool']).has(id);
 // A circle projects to sqrt(2)*diameter*32, not the enclosing square's diagonal.
 const gw=(round?Math.max(a.w,a.d)*Math.SQRT2:a.w+a.d)*32,scale=gw/width,gh=height*scale;
 const specialBase=(!a.flat&&round?{shape:'ellipse',hx:a.w*.48,hy:a.d*.48}:null)||{
  treehouse:{shape:'ellipse',hx:.65,hy:.65},
  'basketball-hoop':{shape:'rect',hx:.22,hy:.22},
  'birdhouse-post':{shape:'rect',hx:.2,hy:.2},
  'washing-line':{shape:'ellipse',hx:.2,hy:.2},
  'satellite-dish':{shape:'rect',hx:.48,hy:.4}
 }[id];
 let ax=gw/2,ay=a.flat?gh/2:gh-(a.w+a.d)*8;
 if(specialBase){
  // These silhouettes include a canopy/backboard/dish above a much narrower foot.
  // Find the physical foot's centre, not the upper object's visual centre.
  let bottom=-1,footLeft=info.width,footRight=-1;
  for(let y=info.height-1;y>=0&&bottom<0;y--)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>110){bottom=y;break;}
  for(let y=bottom;y>=Math.max(0,bottom-10);y--)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>110){footLeft=Math.min(footLeft,x);footRight=Math.max(footRight,x);}
  ax=((footLeft+footRight)/2-left)*scale;
  const front=specialBase.shape==='ellipse'?Math.hypot(specialBase.hx,specialBase.hy)*16:(specialBase.hx+specialBase.hy)*16;
  ay=(bottom-top)*scale-front;
 }
 assert.ok(ay>0&&ay<gh,'Valid ground contact required: '+id);
 const safe='expansion_'+id,filename='sprites/'+safe+'.webp',thumb='thumbs/'+safe+'.webp';
 await sharp(sprite).resize(Math.round(gw*2),Math.round(gh*2),{kernel:'lanczos3'}).webp({quality:94,alphaQuality:100}).toFile(path.join(LIB,filename));
 await sharp(sprite).resize(112,112,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).webp({quality:88,alphaQuality:100}).toFile(path.join(LIB,thumb));
 const item={id:'expansion:'+id,name:a.name,category:a.category,file:filename,thumb,w:gw,h:gh,ax,ay,fw:a.w/2,fh:a.d/2,flat:a.flat,source:path.relative(ROOT,sprite).replace(/\\/g,'/'),tags:['1988','Halloween','2:1',a.category],physicalMetres:{width:a.w,depth:a.d,height:a.h,...(specialBase?{base:specialBase}:{})}};
 lib.items=lib.items.filter(i=>i.id!==item.id);lib.items.push(item);extras.items=extras.items.filter(i=>i.id!==item.id);extras.items.push(item);
 const record=report.assets.find(r=>r.id===id);Object.assign(record,{status:'registered',native:{width:m.width,height:m.height},crop:{left,top,width,height},transparentFraction:clear/(info.width*info.height),uniformScale:scale,registeredAt:new Date().toISOString(),notes:'Reviewed art; inferred ground centre from lower footprint corner. Check on map before final collision import.'});
}
lib.categories=[...new Set(lib.items.map(i=>i.category))];const pending=target+'.expansion-pending';await fs.writeFile(pending,JSON.stringify(lib,null,1));await fs.rename(pending,target);
await fs.writeFile(path.join(ART,'manifest.json'),JSON.stringify(report,null,2));await fs.writeFile(path.join(ART,'library-items.json'),JSON.stringify(extras,null,2));
if(ids.some(id=>expansion.find(a=>a.id===id)?.category==='Correct-angle fences'))await import('./calibrate-fences.mjs');
await ensureShadows();console.log(JSON.stringify({registered:ids,totalRegistered:extras.items.length,librarySize:lib.items.length,mapChanged:false}));
