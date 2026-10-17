/** Register new SMALL sprites only. Existing shop buildings are reused, never replaced.
 * AI changed sheet framing, so these visually reviewed crop regions and foot contacts are explicit;
 * blindly dividing into quadrants would cut off the canoe and fishing rods. Uniform scale only. */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sheets} from './clutter-specs.mjs';
import {ROOT,loadSources,buildScene,renderRect,artDir} from '../lib/town-scene.mjs';
const ART=path.join(artDir('builder-pois')),OUT=path.join(ROOT,'output/town-builder'),LIB=path.join(OUT,'library'),REVIEW=path.join(OUT,'upgrade-review');
const regions={
 fishing:[[20,100,720,555,354,455],[790,220,420,400,986,517],[175,585,300,630,346,1128],[760,745,470,490,965,1127]],
 video:[[140,140,380,585,326,609],[720,10,470,785,939,628],[75,760,555,475,335,1100],[675,755,555,475,919,1095]],
 litter:[[45,240,600,390],[625,235,610,400],[20,710,605,510],[635,720,600,490]]
};
const lib=JSON.parse(await fs.readFile(path.join(LIB,'library.json'),'utf8')),report=[],newItems=[];
await fs.mkdir(path.join(ART,'sprites'),{recursive:true});await fs.mkdir(REVIEW,{recursive:true});
async function bounds(data,w,h){let x0=w,y0=h,x1=-1,y1=-1,zero=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const a=data[(y*w+x)*4+3];if(!a)zero++;if(a>24){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}}assert.ok(x1>=x0);return {opaque:{x0,y0,x1,y1},left:Math.max(0,x0-3),top:Math.max(0,y0-3),width:Math.min(w-1,x1+3)-Math.max(0,x0-3)+1,height:Math.min(h-1,y1+3)-Math.max(0,y0-3)+1,transparentFraction:zero/(w*h)};}
function isolateConnectedSprite(buf,w,h){
 const labels=new Int32Array(w*h).fill(-1),queue=new Int32Array(w*h),sizes=[];let label=0;
 for(let p=0;p<w*h;p++){if(labels[p]>=0||buf[p*4+3]===0)continue;let read=0,write=1;queue[0]=p;labels[p]=label;
  while(read<write){const at=queue[read++],x=at%w,y=Math.floor(at/w);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;const q=ny*w+nx;if(labels[q]<0&&buf[q*4+3]>0){labels[q]=label;queue[write++]=q;}}}sizes.push(write);label++;}
 const biggest=sizes.indexOf(Math.max(...sizes));for(let p=0;p<w*h;p++)if(labels[p]!==biggest)buf[p*4+3]=0;
}
for(const [name,specs]of Object.entries(sheets)){
 const file=path.join(ART,'native',name+'-clutter.png'),m=await sharp(file).metadata();assert.equal(m.width,m.height);assert.ok(m.hasAlpha);const ratio=m.width/1280;
 for(let i=0;i<4;i++){
  const a=specs[i],r=regions[name][i],left=Math.floor(r[0]*ratio),top=Math.floor(r[1]*ratio),width=Math.ceil(r[2]*ratio),height=Math.ceil(r[3]*ratio),cx=r[4]*ratio,cy=r[5]*ratio;
  const buf=await sharp(file).extract({left,top,width,height}).ensureAlpha().raw().toBuffer();
  if(a.id==='canoe-rack')isolateConnectedSprite(buf,width,height); // excludes rod tips in an adjacent slot, not canoe detail
  const b=await bounds(buf,width,height);
  assert.ok(b.transparentFraction>.12,'background must be transparent, not a painted rectangle');
  assert.ok(b.opaque.x0>0&&b.opaque.y0>0&&b.opaque.x1<width-1&&b.opaque.y1<height-1,'sprite touches reviewed crop boundary: '+a.id+' '+JSON.stringify({b,width,height}));
  const crop=await sharp(buf,{raw:{width,height,channels:4}}).extract({left:b.left,top:b.top,width:b.width,height:b.height}).png().toBuffer();
  const target=path.join(ART,'sprites',a.id+'.png');await fs.writeFile(target,crop);
  const gameW=(a.w+a.d)*32,scale=gameW/b.width,gameH=b.height*scale,ax=a.flat?gameW/2:(cx-left-b.left)*scale,ay=a.flat?gameH/2:(cy-top-b.top)*scale;
  assert.ok(ax>=0&&ax<=gameW&&ay>=0&&ay<=gameH,'foot contact must lie within crop');
  await sharp(crop).resize(Math.round(gameW*2),Math.round(gameH*2),{kernel:'lanczos3'}).webp({quality:94,alphaQuality:100}).toFile(path.join(LIB,'sprites','poi_'+a.id+'.webp'));
  await sharp(crop).resize(112,112,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).webp({quality:90,alphaQuality:100}).toFile(path.join(LIB,'thumbs','poi_'+a.id+'.webp'));
  const it={id:'poi:'+a.id,name:a.name,category:a.flat?'Decals & ground':'POI dressing',file:'sprites/poi_'+a.id+'.webp',thumb:'thumbs/poi_'+a.id+'.webp',w:gameW,h:+gameH.toFixed(2),ax:+ax.toFixed(2),ay:+ay.toFixed(2),fw:a.w/2,fh:a.d/2,flat:!!a.flat,source:path.relative(ROOT,target).replace(/\\/g,'/'),tags:['1980s','clutter','2:1','Halloween',name],physicalMetres:{width:a.w,depth:a.d,height:a.h}};
  lib.items=lib.items.filter(x=>x.id!==it.id);lib.items.push(it);
  newItems.push(it);
  report.push({id:it.id,native:{width:b.width,height:b.height},sheet:name,sourceRegion:regions[name][i],alpha:b.transparentFraction,sha256:createHash('sha256').update(crop).digest('hex'),gameWidth:gameW,scaleUniform:true});
 }
}
const stamp=new Date().toISOString().replace(/[:.]/g,'-');await fs.copyFile(path.join(LIB,'library.json'),path.join(LIB,'library-before-clutter-'+stamp+'.json'));
lib.categories=[...new Set(lib.items.map(i=>i.category))];await fs.writeFile(path.join(LIB,'library.json'),JSON.stringify(lib,null,1));
await fs.writeFile(path.join(ART,'library-items.json'),JSON.stringify({items:newItems},null,2));
const items=new Map(lib.items.map(i=>[i.id,i]));
const M=(id,dx,dy,s=1)=>({pick:[id],dx,dy,scale:[s,s],flip:false,chance:1,jitter:0});
const shared=[M('world:bench',-6,5,.7),M('world:trashcan',6,3,.7),M('ref:halloween-mums',3.5,3.8,.65),M('ref:halloween-pumpkin-cluster',-3.8,6.4,.65)];
const presets=[
 {id:'poi-fishing-frontage',name:'Pike & Pine — dressed frontage',group:'Reference POIs',desc:'Existing fish shop + canoe, bait, rods and chalkboard. Place at a paved frontage; door approach stays clear.',members:[M('town:fish_tackle',0,0),...shared,M('poi:canoe-rack',-6.2,3.1),M('poi:bait-cooler',-3.7,4.7),M('poi:rod-bucket',-2.4,4.2),M('poi:fishing-board',3.5,5.6),M('poi:newspaper-cup-litter',-4,5.6),M('poi:candy-soda-litter',5.4,5),M('town:planter_terracotta',-2,3.5,.5)]},
 {id:'poi-video-frontage',name:'Video Vault — after-hours corner',group:'Reference POIs',desc:'Existing Video Vault + poster display, tapes, return box, roller skates and scattered flyers. Place beside existing paving.',members:[M('world:video_rental',0,0),...shared,M('poi:tape-return',5.6,4.6),M('poi:movie-display',-3.8,5.2),M('poi:vhs-carton',5.6,3.4),M('poi:skates-crate',-6,3.6),M('town:bike_rack',-7,1.5,.6),M('poi:flyer-tape-litter',4.2,5.7),M('poi:pizza-litter',-5.2,6),M('poi:candy-soda-litter',6.5,5.5)]},
 {id:'poi-street-litter',name:'After-Halloween pavement litter',group:'Reference POIs',desc:'Four small walkable litter patches; no building, no blocked passage.',members:[M('poi:candy-soda-litter',-.9,0),M('poi:newspaper-cup-litter',.3,.5),M('poi:pizza-litter',1.3,-.4),M('poi:flyer-tape-litter',-.3,-.7)]}
];
const presetDir=path.join(OUT,'presets');await fs.mkdir(path.join(presetDir,'thumbs'),{recursive:true});
const S=await loadSources(),sc=buildScene({nx:4,ny:4,roads:['0,2','1,2','2,2','3,2'],reflections:[{x:39,y:46.7,strength:.7}],paving:[{x0:20,y0:39,x1:44,y1:46.7}]},S);
async function preview(p){
 const X=30,Y=39,[mx,my]=sc.toScreen(X,Y),W=1400,H=1060,x0=Math.round(mx-W/2),y0=Math.round(my-H*.6);
 const ground=renderRect(sc,x0,y0,W,H),parts=[],guides=[];
 for(const m of p.members){const it=items.get(m.pick[0]);assert.ok(it,'unknown preset item '+m.pick[0]);const scale=m.scale[0],[sx,sy]=sc.toScreen(X+m.dx,Y+m.dy);parts.push({it,scale,sx,sy});}
 parts.sort((a,b)=>(a.it.flat?0:1)-(b.it.flat?0:1)||a.sy-b.sy);
 for(const {it,scale,sx,sy}of parts){const left=Math.round(sx-x0-it.ax*scale),top=Math.round(sy-y0-it.ay*scale),w=Math.round(it.w*scale),h=Math.round(it.h*scale);assert.ok(left>=0&&top>=0&&left+w<W&&top+h<H,'preview framing '+it.id);
  // All dimensions use a uniform scale, never independent X/Y stretching.
  guides.push({input:await sharp(path.join(LIB,it.file)).resize(w,h).png().toBuffer(),left,top});}
 const png=await sharp(ground,{raw:{width:W,height:H,channels:4}}).composite(guides).png().toBuffer();
 await fs.writeFile(path.join(REVIEW,p.id+'.png'),png);
 await sharp(png).resize(224,224,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).webp({quality:90}).toFile(path.join(presetDir,'thumbs',p.id+'.webp'));
 p.thumb='presets/thumbs/'+p.id+'.webp';p.count=p.members.length;p.turn=false;p.mirror=false;p.spanM=Math.max(...p.members.map(m=>Math.hypot(m.dx,m.dy)));
}
for(const p of presets)await preview(p);
let old={presets:[]};try{old=JSON.parse(await fs.readFile(path.join(presetDir,'poi.json'),'utf8'));await fs.copyFile(path.join(presetDir,'poi.json'),path.join(presetDir,'poi-before-'+stamp+'.json'));}catch(e){if(e.code!=='ENOENT')throw e;}
old.presets=old.presets.filter(p=>!presets.some(n=>n.id===p.id));old.presets.push(...presets);await fs.writeFile(path.join(presetDir,'poi.json'),JSON.stringify(old,null,1));
await fs.writeFile(path.join(ART,'sprite-validation.json'),JSON.stringify({sprites:report,reusedBuildings:['town:fish_tackle','world:video_rental'],duplicatesRegistered:false,notes:['Guide framing was not obeyed: reviewed crops and contacts replace blind quadrant cuts.','No invented camera-height guarantees. Check rendered props against existing shops.','Physical sizes registered in metres; uniform scaling, no X/Y squashing.','No live game integration or collision export.']},null,2));
console.log(JSON.stringify({added:report.length,presets:presets.length,review:REVIEW}));
