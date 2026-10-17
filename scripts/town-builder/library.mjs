/** Build the town sprite library: every placeable sprite we have, at game scale, with its ground anchor.
 *  node scripts/town-builder/library.mjs  ->  output/town-builder/library/{library.json,sprites/*.webp,thumbs/*.webp}
 *  Sizes follow the game's own rules: world atlas (w,h,anchor at 1x), town assets (townGeometry), static set
 *  (specs w,h,ax,ay), reference art (referenceProp: width = (fw+fh)*64+20, anchor = footprint centre). */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {ROOT,artSource,artDir} from '../lib/town-scene.mjs';
import {packArcadeSprites} from './arcade-library.mjs';
const OUT=path.join(ROOT,'output/town-builder/library'),HW=64,HH=32,HI=2; // sprites stored at 2x game scale for crisp zoom
await fs.mkdir(path.join(OUT,'sprites'),{recursive:true});await fs.mkdir(path.join(OUT,'thumbs'),{recursive:true});
const items=[];
let previousLibrary={items:[]};try{previousLibrary=JSON.parse(await fs.readFile(path.join(OUT,'library.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
async function bounds(file){const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});let x0=info.width,y0=info.height,x1=-1,y1=-1;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>24){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
 return {w:info.width,h:info.height,left:x0,top:y0,width:x1-x0+1,height:y1-y0+1};}
/** Emit one library item. scale = game px per source px; anchor (ax,ay) in source px. Crops to the opaque bounds. */
async function emit({id,name,category,file,scale,ax,ay,fw=1,fh=1,flat=false,source,tags=[],physicalMetres}){
 const b=await bounds(file),pad=2,l=Math.max(0,b.left-pad),t=Math.max(0,b.top-pad),r=Math.min(b.w,b.left+b.width+pad),btm=Math.min(b.h,b.top+b.height+pad);
 const cw=r-l,ch=btm-t,gw=cw*scale,gh=ch*scale;if(gw<4||gh<4)return;
 const safe=id.replace(/[^a-z0-9_-]+/gi,'_');
 await sharp(file).extract({left:l,top:t,width:cw,height:ch}).resize(Math.max(2,Math.round(gw*HI)),Math.max(2,Math.round(gh*HI)),{kernel:'lanczos3'}).webp({quality:92,alphaQuality:100}).toFile(path.join(OUT,'sprites',safe+'.webp'));
 await sharp(file).extract({left:l,top:t,width:cw,height:ch}).resize(112,112,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).webp({quality:85}).toFile(path.join(OUT,'thumbs',safe+'.webp'));
 items.push({id,name,category,file:'sprites/'+safe+'.webp',thumb:'thumbs/'+safe+'.webp',w:+gw.toFixed(1),h:+gh.toFixed(1),ax:+((ax-l)*scale).toFixed(1),ay:+((ay-t)*scale).toFixed(1),fw,fh,flat,source:path.relative(ROOT,file).replace(/\\/g,'/'),tags,...(physicalMetres?{physicalMetres}:{})});}
const pretty=s=>s.replace(/^(building|landmark|halloween|tree)-/,'').replace(/[-_]/g,' ').replace(/\b\w/g,c=>c.toUpperCase());

// 1. world atlas props (generated, staged at 4x; atlas holds 1x size, anchor, footprint)
const atlas=Object.values(JSON.parse(await fs.readFile(path.join(ROOT,'art/world/atlas.json'),'utf8')));
const staged=await fs.readdir(path.join(ROOT,'art/world/staged'));
const worldCat=k=>/^house_/.test(k)?'Houses':/^tree_|^bush_|hedge/.test(k)?'Trees & plants':/^car_|schoolbus/.test(k)?'Vehicles':/^grave_|crypt|pumpkin_|scarecrow|candy_stand/.test(k)?'Halloween':/fence|gate/.test(k)?'Fences & walls':
 /school|arcade|diner|video|church|barn|snack_bar|watertower|gazebo|drivein_screen|drivein_marquee|bleachers/.test(k)?'Landmarks & venues':/swings|junglegym|merrygoround|goalposts|scoreboard|speaker_post/.test(k)?'Park & sports':'Street furniture';
for(const e of atlas){if(e.category!=='prop')continue;const f=staged.find(s=>s.startsWith(e.key+'-')&&s.endsWith('.png'));if(!f)continue;const file=path.join(ROOT,'art/world/staged',f),m=await sharp(file).metadata(),sc=e.w/m.width;
 const [ax,ay]=e.anchor||[e.w/2,e.h-HH];await emit({id:'world:'+e.key,name:pretty(e.key),category:worldCat(e.key),file,scale:sc,ax:ax/sc,ay:ay/sc,fw:e.footprint?.[0]||1,fh:e.footprint?.[1]||1,source:'world atlas',tags:[e.desc||'']});}
// 2. lived-in town assets (art/town/generated), framed exactly like their guides (townGeometry)
const specs=JSON.parse(await fs.readFile(path.join(artDir('specs.json')),'utf8'));
for(const a of specs){const file=path.join(artDir('generated'),a.id+'.png');try{await fs.access(file);}catch{continue;}const m=await sharp(file).metadata();
 let w,h,ax,ay;if(a.kind==='decal'){w=128;h=64;ax=64;ay=32;}else{w=Math.ceil((a.fw+a.fh)*HW+64);h=Math.ceil((a.fw+a.fh)*HH+a.height+48);ax=w/2;ay=h-(a.fw+a.fh)*HH/2-16;}
 const sc=w/m.width,cat=a.kind==='building'?'Shops & services':a.kind==='decal'?'Decals & ground':a.kind==='foliage'?'Trees & plants':'Street furniture';
 await emit({id:'town:'+a.id,name:a.name||pretty(a.id),category:cat,file,scale:sc,ax:ax/sc,ay:ay/sc,fw:a.fw,fh:a.fh,flat:a.kind==='decal',source:'lived-in town',tags:[a.look||'']});}
// 3. static set: cars, garages, shop rears (specs carry 1x w,h,ax,ay)
const sspecs=JSON.parse(await fs.readFile(path.join(artDir('static/specs.json')),'utf8'));
for(const s of (Array.isArray(sspecs)?sspecs:Object.values(sspecs))){const a=s.a||s;for(const v of ['','-v2']){const file=path.join(artDir('static/generated'),a.id+v+'.png');try{await fs.access(file);}catch{continue;}
 const m=await sharp(file).metadata(),sc=s.w/m.width,cat=a.kind==='car'?'Vehicles':/rear/.test(a.id)?'Shops & services':/garage/.test(a.id)?'Houses':'Street furniture';
 await emit({id:'static:'+a.id+v,name:pretty(a.id+v),category:cat,file,scale:sc,ax:s.ax/sc,ay:s.ay/sc,fw:a.fw,fh:a.fh,source:'static town',tags:[a.look||'']});}}
// 4. reference-town art: standalone buildings, landmarks, Halloween props, trees (referenceProp sizing)
const REF={ // footprint (tiles) or visible width, as used by the game's static town
 'building-barn':[4,3],'building-barn-v2':[4,3],'building-church':[4,5],'building-corner-shop':[4,3],'building-corner-store':[3,3],'building-diner':[4,3],'building-drive-in-screen':[1,8,650],
 'building-farm-shed':[2,2],'building-farmhouse':[4,3],'building-garage':[2,2],'building-gas-canopy':[3,3],'building-gas-shop':[3,2],'building-grocery':[5,3],'building-house-cottage':[3,3],
 'building-house-dormer':[3,3],'building-house-garage':[4,3],'building-house-large':[4,4],'building-mausoleum':[2,2],'building-school':[6,4],'building-shop-blue':[3,3],'building-snack-bar':[2,2],
 'landmark-fountain':[1.6,1.6],'landmark-fountain-v2':[1.6,1.6],'landmark-gazebo':[2,2],'landmark-gazebo-v2':[2,2],'landmark-silo':[1.5,1.5,150],'landmark-water-tower':[2,2],'landmark-windmill':[1,1],
 'tree-maple-crimson':[1,1,185],'tree-birch-gold':[1,1,145],'tree-spruce-blue':[1,1,140],
 'halloween-hay-bales':[1,1,110],'halloween-lantern':[1,1,70],'halloween-mums':[1,1,80],'halloween-pumpkin-cluster':[1,1,95],'halloween-sheet-ghost':[1,1,90],'halloween-witch-sign':[1,1,85]};
for(const [rid,[fw,fh,vis]] of Object.entries(REF)){const file=path.join(artDir('quadrants/generated'),rid+'.png');try{await fs.access(file);}catch{continue;}
 const b=await bounds(file),sc=(vis??((fw+fh)*HW+20))/b.width,ax=b.left+b.width/2,ay=b.top+b.height-(fw+fh)*HH/2/sc;
 const cat=rid.startsWith('tree')?'Trees & plants':rid.startsWith('halloween')?'Halloween':rid.startsWith('landmark')?'Landmarks & venues':/house|garage|farmhouse/.test(rid)?'Houses':/shop|store|grocery|diner|gas/.test(rid)?'Shops & services':'Landmarks & venues';
 await emit({id:'ref:'+rid,name:pretty(rid),category:cat,file,scale:sc,ax,ay,fw,fh,source:'reference town',tags:[]});}
// 5. ground decals from the terrain materials (flat, drawn under everything)
for(const f of ['decal-01-lush-grass','decal-02-dry-golden-grass','decal-03-moss-groundcover','decal-04-low-weeds','decal-05-thin-grass','decal-06-orange-leaf-scatter','decal-07-red-leaf-cluster','decal-08-yellow-leaf-scatter','scatter-grass-tufts','scatter-tiny-leaves']){
 const file=path.join(ROOT,'output/terrain-materials',f+'.png'),b=await bounds(file),sc=230/b.width;await emit({id:'decal:'+f,name:pretty(f.replace(/^decal-\d+-|^scatter-/,'')),category:'Decals & ground',file,scale:sc,ax:b.left+b.width/2,ay:b.top+b.height/2,flat:true,source:'terrain materials',tags:[]});}
// Retain reviewed add-on dressing when the base library is rebuilt.
try{const extras=JSON.parse(await fs.readFile(path.join(artDir('builder-pois/library-items.json')),'utf8'));
 for(const i of extras.items){const file=artSource(i.source),m=await sharp(file).metadata(),scale=i.w/m.width;await emit({id:i.id,name:i.name,category:i.category,file,scale,ax:i.ax/scale,ay:i.ay/scale,fw:i.fw,fh:i.fh,flat:i.flat,tags:i.tags});}}
catch(e){if(e.code!=='ENOENT')throw e;}
// Corrected arcade v2 only; reuse the packed game frames and anchors without reinterpreting perspective.
items.push(...await packArcadeSprites({libDir:OUT}));
try{const extras=JSON.parse(await fs.readFile(path.join(artDir('expansion-1988/library-items.json')),'utf8'));
 for(const i of extras.items){const file=artSource(i.source),m=await sharp(file).metadata(),scale=i.w/m.width;await emit({id:i.id,name:i.name,category:i.category,file,scale,ax:i.ax/scale,ay:i.ay/scale,fw:i.fw,fh:i.fh,flat:i.flat,tags:i.tags,physicalMetres:i.physicalMetres});}}
catch(e){if(e.code!=='ENOENT')throw e;}
// Keep the other agent's registered RUN-generated collection, including its ground decals.
// Those native assets are packed by register-generated/terrain scripts, not this base pass.
for(const old of previousLibrary.items.filter(i=>i.id.startsWith('gen:')))if(!items.some(i=>i.id===old.id))items.push(old);
const cats=[...new Set(items.map(i=>i.category))];
// Art drawn at the wrong angle (near face-on, not the game's 2:1): kept on disk, hidden from the palette.
const WRONG_ANGLE=new Set(["ref:building-farmhouse","ref:building-garage","ref:building-house-cottage","ref:building-house-dormer","ref:building-house-garage","ref:building-house-large","ref:building-diner","ref:building-snack-bar","ref:building-gas-shop","ref:building-shop-blue","ref:landmark-gazebo","ref:landmark-gazebo-v2"]);for(const it of items)if(WRONG_ANGLE.has(it.id)){it.hidden=true;it.hiddenReason='wrong isometric angle';}
await fs.writeFile(path.join(OUT,'library.json'),JSON.stringify({version:1,gameScale:'1 unit = 1 game pixel at zoom 1 (32 px per axis metre); sprites stored at 2x',spriteScale:HI,categories:cats,items},null,1));
console.log(JSON.stringify({items:items.length,byCategory:Object.fromEntries(cats.map(c=>[c,items.filter(i=>i.category===c).length]))}));
await import('./calibrate-fences.mjs');
