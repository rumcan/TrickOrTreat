/** Export the town painted in the town builder into the game: public/assets/town-built/.
 *    node scripts/town-builder/export-game.mjs        (the town builder server must be running on 5190, for fences)
 *  - ground/<tx>_<ty>.webp: the baked ground at full game resolution (1024 px tiles), with every flat decal and every
 *    upright sprite's shape shadow painted in, plus overview.webp (quarter size) for streaming;
 *  - sprites/<id>.webp: each upright sprite once, at the resolution its largest placement needs (fences projected);
 *  - town.json: game frame, items (size, anchor, collision base, role), placements, ground classes, start, hideouts.
 *  Game tiles are 2 m: tile = (world metre - X0) / 2. Game pixels equal builder map pixels shifted by (gx0, gy0). */
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {ROOT,loadSources,buildScene} from '../lib/town-scene.mjs';
import {RUNS,evalRun,K} from '../lib/road-v4-kit.mjs';
import {mapDirectory} from './map-storage.mjs';
import {repairLegacyFenceRuns} from './app/fence-projection.js';
import {nightSettings,spriteLights,spotCorners,ownLights} from './app/night-light.js';
const DATA=path.join(ROOT,'output/town-builder'),LIB=path.join(DATA,'library'),OUT=path.join(ROOT,'public/assets/town-built');
const t0=Date.now(),log=(...a)=>console.log(((Date.now()-t0)/1000).toFixed(0).padStart(4)+'s',...a);
const lib=JSON.parse(await fs.readFile(path.join(LIB,'library.json'),'utf8')),items=new Map(lib.items.map(i=>[i.id,i]));
const OVR=JSON.parse(await fs.readFile(new URL('./collision-overrides.json',import.meta.url),'utf8'));
const layout=JSON.parse(await fs.readFile(path.join(DATA,'layout.json'),'utf8'));layout.sprites=repairLegacyFenceRuns(layout.sprites,items).items;
const plan=JSON.parse(await fs.readFile(path.join(DATA,'plans/maple-falls.json'),'utf8'));
const mapDir=await mapDirectory(DATA,DATA),man=JSON.parse(await fs.readFile(path.join(mapDir,'manifest.json'),'utf8'));
const S=man.pxPerAxisM,{ox,oy}=man.origin,T=man.tileSize,L0=man.levels[0];
await fs.rm(OUT,{recursive:true,force:true});for(const d of ['ground','sprites','sprites-hd'])await fs.mkdir(path.join(OUT,d),{recursive:true});

// ---------------------------------------------------------------- frame: the whole baked picture, in game tiles
const toWorld=(px,py)=>{const a=(px-ox)/S,b=(py-oy)/(S/2);return [(a+b)/2,(b-a)/2];};
const corners=[[0,0],[man.width,0],[0,man.height],[man.width,man.height]].map(([x,y])=>toWorld(x,y));
const X0=Math.floor(Math.min(...corners.map(c=>c[0]))/2)*2,Y0=Math.floor(Math.min(...corners.map(c=>c[1]))/2)*2;
const mapW=Math.ceil((Math.max(...corners.map(c=>c[0]))-X0)/2)+1,mapH=Math.ceil((Math.max(...corners.map(c=>c[1]))-Y0)/2)+1,MAP=Math.max(mapW,mapH);
// game pixel = builder pixel + (gx0, gy0)
const gx0=-ox-(X0-Y0)*S,gy0=-oy-(X0+Y0)*S/2;
const tile=(X,Y)=>[(X-X0)/2,(Y-Y0)/2];
log('frame',{X0,Y0,mapW,mapH,MAP,gx0,gy0});

// ---------------------------------------------------------------- roles
const VENUE=/^(town:(bakery|barber|fish_tackle|grocery|hardware|laundromat|pharmacy|postoffice|firestation)|ref:building-(corner-shop|corner-store|grocery|church|school|barn|barn-v2)|world:(diner|video_rental|video|church|school|primary_school|snack_bar|barn))$/;
const HOUSE=/^(world:house_\d|gen:house-|expansion:rundown-house$)/;
const FENCE=/^(world:hedge|world:fence_|world:gate|gen:fence-|gen:wall-|expansion:(picket|chainlink|gate-chainlink|fence-privacy)-)/;
function role(it){const id=it.id,c=it.category;
 if(id==='world:arcade')return {kind:'arcade',door:true,solid:2,big:true};
 if(HOUSE.test(id))return {kind:'house',door:true,solid:2,big:true};
 if(VENUE.test(id))return {kind:'venue',door:true,solid:2,big:true};
 if(id==='world:candy_stand')return {kind:'shop',solid:2,big:true};
 if(id==='world:vending')return {kind:'vending',solid:2,big:false};
 if(/^world:junglegym_/.test(id))return {kind:'junglegym',solid:2,big:true};
 if(id==='world:gazebo')return {kind:'gazebo',solid:2,big:true};
 if(id==='world:streetlamp')return {kind:'lamp',solid:2,big:false};
 if(FENCE.test(id))return {kind:it.fence?.axis==='y'?'fencey':'fencex',solid:1,big:false};
 if(c==='Vehicles')return {kind:'car',solid:2,big:true};
 if(c==='Trees & plants')return /tree/.test(id)?{kind:'tree',solid:2,big:false}:{kind:'bush',solid:1,big:false};
 if(/^(Houses|Shops & services|Landmarks & venues|House backs|House rear & side views|Derelict town)$/.test(c))return {kind:'building',solid:2,big:true};
 if(/pumpkin/.test(id))return {kind:'pumpkin',solid:1,big:false};
 return {kind:'decor',solid:1,big:false};
}

// ---------------------------------------------------------------- placements
const ups=[],flats=[];
for(const s of layout.sprites){const it=items.get(s.id);if(!it||it.hidden||s.id.startsWith('kid:'))continue;(it.flat?flats:ups).push({s,it});}
log('sprites',{upright:ups.length,flat:flats.length});
const px=(X,Y)=>[ox+(X-Y)*S,oy+(X+Y)*S/2];

// ---------------------------------------------------------------- ground tiles: baked ground + flats + shadows
const cache=new Map();
async function fenceBuf(it){const r=await fetch('http://127.0.0.1:5190/fence-render/'+encodeURIComponent(it.id)+'.png?r=2');if(!r.ok)throw Error('fence render failed for '+it.id+' (is the town builder running on 5190?)');return Buffer.from(await r.arrayBuffer());}
async function img(file,w,h,flip,src){const k=file+'|'+Math.round(w)+'|'+Math.round(h)+'|'+flip;if(cache.has(k))return cache.get(k);
 let im=sharp(src||file).resize(Math.max(1,Math.round(w)),Math.max(1,Math.round(h)),{fit:'fill'});if(flip)im=im.flop();const b=await im.png().toBuffer();if(cache.size>600)cache.clear();cache.set(k,b);return b;}
const draws=[];
for(const {s,it} of flats){const [mx,my]=px(s.x,s.y),k=s.scale||1;
 draws.push({file:path.join(LIB,it.file),left:s.flip?mx-(it.w-it.ax)*k:mx-it.ax*k,top:my-it.ay*k,w:it.w*k,h:it.h*k,flip:!!s.flip,order:[0,s.z||0,my+(s.o||0)*S/2]});}
const MOVABLE=new Set(['shop','vending']);// they relocate in play: the game draws their shadow itself
for(const {s,it} of ups){const sh=it.shadow;if(!sh||MOVABLE.has(role(it).kind))continue;const [mx,my0]=px(s.x,s.y),k=s.scale||1,my=my0+(sh.dy||0)*k;
 draws.push({file:path.join(LIB,sh.file),left:s.flip?mx-(sh.w-sh.ax)*k:mx-sh.ax*k,top:my-sh.ay*k,w:sh.w*k,h:sh.h*k,flip:!!s.flip,order:[1,0,0]});}
draws.sort((a,b)=>a.order[0]-b.order[0]||a.order[1]-b.order[1]||a.order[2]-b.order[2]);
const overview=[];let tilesDone=0;
for(let ty=0;ty<L0.rows;ty++)for(let tx=0;tx<L0.cols;tx++){
 const f=path.join(mapDir,'full',`${tx}_${ty}.png`),f2=path.join(mapDir,'tiles/0',`${tx}_${ty}.webp`);if(!existsSync(f)&&!existsSync(f2))continue;
 const base=existsSync(f)?f:f2,m=await sharp(base).metadata(),x0=tx*T,y0=ty*T,comp=[];
 for(const d of draws){const l=Math.round(d.left-x0),t=Math.round(d.top-y0),w=Math.round(d.w),h=Math.round(d.h);if(l>=m.width||t>=m.height||l+w<=0||t+h<=0)continue;
  let b=await img(d.file,d.w,d.h,d.flip);const cl=Math.max(0,-l),ct=Math.max(0,-t),cw=Math.min(w-cl,m.width-Math.max(l,0)),ch=Math.min(h-ct,m.height-Math.max(t,0));if(cw<=0||ch<=0)continue;
  if(cl||ct||cw!==w||ch!==h)b=await sharp(b).extract({left:cl,top:ct,width:cw,height:ch}).png().toBuffer();comp.push({input:b,left:Math.max(l,0),top:Math.max(t,0)});}
 const out=await sharp(base).composite(comp).removeAlpha().png().toBuffer();
 await sharp(out).webp({quality:84,effort:5}).toFile(path.join(OUT,'ground',`${tx}_${ty}.webp`));
 overview.push({input:await sharp(out).resize(Math.ceil(m.width/4),Math.ceil(m.height/4)).png().toBuffer(),left:tx*T/4,top:ty*T/4});
 if(++tilesDone%20===0)log('ground tiles',tilesDone);
}
await sharp({create:{width:Math.ceil(man.width/4),height:Math.ceil(man.height/4),channels:3,background:'#1d2619'}}).composite(overview).webp({quality:80}).toFile(path.join(OUT,'ground','overview.webp'));
log('ground done',tilesDone);

// ---------------------------------------------------------------- upright sprites at the resolution they are used at
const used=new Map();for(const {s,it} of ups){const u=used.get(it.id)||{it,max:0};u.max=Math.max(u.max,s.scale||1);used.set(it.id,u);}
const outItems={},ids=[...used.keys()].sort();
for(const id of ids){const {it,max}=used.get(id),safe=id.replace(/[^a-z0-9_-]/gi,'_'),r=role(it);
 const src=it.fence?await fenceBuf(it):path.join(LIB,it.file),meta=await sharp(src).metadata();
 const res=Math.min(meta.width/it.w,Math.max(1,max));// game px per sprite px at scale 1: exactly what its largest placement draws
 await sharp(src).resize(Math.max(1,Math.round(it.w*res)),Math.max(1,Math.round(it.h*res)),{fit:'fill'}).webp({quality:86,alphaQuality:100,effort:5}).toFile(path.join(OUT,'sprites',safe+'.webp'));
 // High graphics: twice the drawn resolution (as far as the painted source goes) for sharp art on big, dense screens
 const hd=Math.min(meta.width/it.w,Math.max(1,max)*2);
 await sharp(src).resize(Math.max(1,Math.round(it.w*hd)),Math.max(1,Math.round(it.h*hd)),{fit:'fill'}).webp({quality:90,alphaQuality:100,effort:5}).toFile(path.join(OUT,'sprites-hd',safe+'.webp'));
 // collision: hand-measured boxes (collision-overrides.json) where the automatic base is wrong, else the base
 const boxes=(OVR[id]?.boxes||[it.base||{hx:it.fw,hy:it.fh,dx:0,dy:0}]).map(b=>({hx:+b.hx.toFixed(3),hy:+b.hy.toFixed(3),dx:+(b.dx||0).toFixed(3),dy:+(b.dy||0).toFixed(3)}));
 outItems[id]={name:it.name,cat:it.category,file:'sprites/'+safe+'.webp',w:it.w,h:it.h,ax:it.ax,ay:it.ay,boxes,...(it.glows?{glows:it.glows}:{}),...(OVR[id]?.door?{doorAt:OVR[id].door}:{}),...r,
  ...(r.kind==='shop'||r.kind==='vending'?{shadow:true}:{})};
}
log('sprites',ids.length);

// ---------------------------------------------------------------- ground classes per game tile (road, sidewalk, lots ...)
const sc=buildScene(plan,await loadSources(1));
const G={GRASS:0,ROAD:1,SIDEWALK:2,DIRT:3,GRAVEL:4,DARKGRASS:5,DRIVEWAY:6,FLAGSTONE:7,FIELD:8},o={};
const inPicture=(X,Y)=>{const [a,b]=px(X,Y);return a>=0&&a<man.width&&b>=0&&b<man.height;};
const lotAt=(X,Y)=>{for(const l of sc.lots){if(l.grid){const hit=(l.stamps||[]).some(t=>!t.neg&&(t.s==='q'?Math.max(Math.abs(X-t.x),Math.abs(Y-t.y)):Math.hypot(X-t.x,Y-t.y))<t.r);if(hit)return l;}
  else if(Math.abs(X-l.cx)<=l.hx&&Math.abs(Y-l.cy)<=l.hy)return l;}return null;};
const classify=(X,Y)=>{if(!inPicture(X,Y))return -1;
 const cx=Math.floor(X/20),cy=Math.floor(Y/20),cell=sc.ci(cx,cy),m=cell<0?0:sc.masks[cell];
 if(m){let bs=-1e9;for(const r of RUNS[m]){evalRun(r,X-cx*20,Y-cy*20,X,Y,o);bs=Math.max(bs,o.s);}if(bs<0)return G.ROAD;if(bs<K.walk)return G.SIDEWALK;}
 for(const p of sc.paving)if(Math.abs(X-p.cx)<=p.hx&&Math.abs(Y-p.cy)<=p.hy)return G.SIDEWALK;
 const l=lotAt(X,Y);if(l)return {asphalt:G.DRIVEWAY,slab:G.FLAGSTONE,dirt:G.DIRT,field:G.FIELD}[l.surface]??G.DRIVEWAY;
 return G.GRASS;};
const ground=new Uint8Array(MAP*MAP),outside=new Uint8Array(MAP*MAP);
for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){const votes={};let out=0;
 for(const [u,v] of [[.25,.25],[.75,.25],[.25,.75],[.75,.75]]){const c=classify(X0+(x+u)*2,Y0+(y+v)*2);if(c<0)out++;else votes[c]=(votes[c]||0)+1;}
 if(out>=2){outside[y*MAP+x]=1;ground[y*MAP+x]=G.DARKGRASS;continue;}
 ground[y*MAP+x]=+Object.entries(votes).sort((a,b)=>b[1]-a[1])[0][0];}
log('ground classes');

// ---------------------------------------------------------------- placements in game tiles
const index=new Map(ids.map((id,i)=>[id,i]));
// the 8th field: 1 = all its painted glows are off (no light), or the numbers of the glows switched off in Edit its lights
const props=ups.map(({s,it})=>{const [x,y]=tile(s.x,s.y);return [index.get(it.id),+x.toFixed(3),+y.toFixed(3),s.flip?1:0,+(s.scale||1).toFixed(4),s.z||0,s.o||0,s.light===0||s.glow===false?1:s.glowsOff?.length?s.glowsOff:0];});
// night: the builder's settings and every sprite's light, in game tiles (radius in tiles = metres / 2)
const night=nightSettings(plan),lights=[];
const spotEntry=o=>{const q=o.shape==='rect'?(o.pts?.length===4?o.pts:o.w>0&&o.h>0?spotCorners(o):null):null;if(!q&&!(o.r>0))return;const [x,y]=tile(o.x,o.y);
 const off=q?q.map(([X,Y])=>[+((X-o.x)/2).toFixed(2),+((Y-o.y)/2).toFixed(2)]):0,reach=q?Math.max(...off.map(([u,v])=>Math.hypot(u,v))):o.r/2;
 lights.push([+x.toFixed(2),+y.toFixed(2),+reach.toFixed(2),+(+o.i||.9).toFixed(2),o.type==='fire'||o.type==='neon'?o.type:'spot',o.color||'',off,o.soft!=null?+(+o.soft).toFixed(2):-1]);};// -1: the night's softness
// an object edited with Edit its lights carries its own lights instead of its type's defaults
for(const s of layout.sprites){const it=items.get(s.id);if(!it||it.hidden)continue;const own=ownLights(s);if(own){for(const o of own)spotEntry(o);continue;}for(const l of spriteLights(s,it,night)){const [x,y]=tile(l.x,l.y);lights.push([+x.toFixed(2),+y.toFixed(2),+(l.r/2).toFixed(2),+l.i.toFixed(2),l.type]);}}
// bare light spots placed with the builder's Light spots tool (Y); fire flickers and neon is pink in the game
// [x,y,r,i,type,colour,corners,edge]: colour is '' for the kind's own; edge = softness 0..1 (-1 = the night's); corners = a four-sided spot's 4 corners as offsets from
// x,y in tiles (any shape the builder's handles made; r reaches the farthest corner)
for(const o of plan.lightSpots||[])spotEntry(o);
const town={version:1,night:{...night,torch:night.torch/2},lights,exportedAt:new Date().toISOString(),source:{layout:layout.savedAt,map:path.basename(mapDir)},
 frame:{X0,Y0,map:MAP,mapW,mapH,metresPerTile:2,gx0,gy0,tile:T,cols:L0.cols,rows:L0.rows,width:man.width,height:man.height,overviewScale:4},
 ids,items:outItems,props,ground:Buffer.from(ground).toString('base64'),outside:Buffer.from(outside).toString('base64')};
await fs.writeFile(path.join(OUT,'town.json'),JSON.stringify(town));
let bytes=0;for(const d of ['ground','sprites','sprites-hd'])for(const f of await fs.readdir(path.join(OUT,d)))bytes+=(await fs.stat(path.join(OUT,d,f))).size;
log('done',{props:props.length,items:ids.length,MB:(bytes/1048576).toFixed(1),json:((await fs.stat(path.join(OUT,'town.json'))).size/1024).toFixed(0)+'KB'});
