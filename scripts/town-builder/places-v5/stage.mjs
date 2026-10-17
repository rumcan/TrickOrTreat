/** Render a places-v5 preset inside a test road block: the real ground renderer (roads, sidewalks, the preset's own
 *  lots/paving, lamp glow) + generic town street lamps + every member with its shape shadow, decals first, fences warped.
 *    node scripts/town-builder/places-v5/stage.mjs presets/<id>.mjs [out.png] [--k 0.4] [--labels] [--crop u0,v0,u1,v1]
 *  --k is the output scale against the game-scale map (0.4 = whole-block review, 0.8-1 = close-up).
 *  --labels writes #index + sprite name at every member's footprint centre (index = order in preset.members).
 *  --crop renders only part of the block (block-local metres), e.g. one lot at --k 0.9 for a close look.
 *  Whole-block renders at k <= 0.5 render the ground at half zoom (4x faster, same look once downscaled).
 *  Fences use the running town builder server (http://127.0.0.1:5190/fence-render) for their exact projection.
 *  Ground renders are cached by plan in output/town-builder/presets-v5-study/stage-cache. */
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import sharp from 'sharp';
import {loadSources,buildScene,renderRect} from '../../lib/town-scene.mjs';
import {ITEMS,DATA} from './kit.mjs';
const LIB=path.join(DATA,'library'),CACHE=path.join(DATA,'presets-v5-study/stage-cache'),TS=512;

if(!isMainThread&&workerData?.stage){ // ground tile worker
 const sc=buildScene(workerData.plan,await loadSources(workerData.zoom));parentPort.postMessage({ready:true});
 parentPort.on('message',m=>{if(m.stop)process.exit(0);const buf=renderRect(sc,m.x,m.y,m.w,m.h);parentPort.postMessage({tile:m,buf},[buf.buffer]);});
}

/** world plan for a test block of interior fit.w x fit.h with roads on all four sides (block NW corner at O,O) */
export function stagePlan(fit,ground=[]){
 const kx=Math.round((fit.w+10.6)/20),ky=Math.round((fit.h+10.6)/20),nx=kx+5,ny=ky+5,roads=new Set();
 for(let j=0;j<ny;j++){roads.add(`2,${j}`);roads.add(`${2+kx},${j}`);}for(let i=0;i<nx;i++){roads.add(`${i},2`);roads.add(`${i},${2+ky}`);}
 const O=55.3,C=[O+fit.w/2,O+fit.h/2],lots=[],paving=[],reflections=[];
 // generic town lamps (as the town has them everywhere): this block's S and E sidewalks, the far sides of the N and W roads
 const along=n=>{const a=[];for(let t=3.5;t<n-2;t+=19.7)a.push(t);return a;};
 for(const u of along(fit.w)){reflections.push({x:O+u+1.5,y:O+fit.h+5.3},{x:O+u+2,y:O-5.8});}
 for(const v of along(fit.h)){reflections.push({x:O-5.6,y:O+v+1.5});}
 for(const v of [fit.h*.37,fit.h*.8])reflections.push({x:O+fit.w+5.3,y:O+v-.5});
 for(const r of reflections)Object.assign(r,{free:false,strength:1,scale:1});
 for(const g of ground){const c=JSON.parse(JSON.stringify(g));delete c.use;delete c.look;delete c.section;const kind=c.kind;delete c.kind;
  if(kind==='refl'){reflections.push({x:c.x+C[0],y:c.y+C[1],free:!!c.free,strength:c.strength??1,scale:c.scale??1});continue;}
  c.x0+=C[0];c.x1+=C[0];c.y0+=C[1];c.y1+=C[1];for(const b of c.bays||[]){const o=b.side==='N'||b.side==='S'?C[0]:C[1];b.from+=o;b.to+=o;}for(const op of c.openings||[]){const o=op.side==='N'||op.side==='S'?C[0]:C[1];op.a0+=o;op.a1+=o;}
  (kind==='pave'?paving:lots).push(c);}
 return {plan:{name:'stage',nx,ny,roads:[...roads],lots,paving,reflections,lines:{double:[],none:[]}},C,O};
}

const sourcesByZoom=new Map();
async function sceneFor(plan,zoom){if(!sourcesByZoom.has(zoom))sourcesByZoom.set(zoom,await loadSources(zoom));return buildScene(plan,sourcesByZoom.get(zoom));}
async function groundImage(plan,rect,zoom){
 const key=crypto.createHash('sha1').update(JSON.stringify([plan,rect,zoom,3])).digest('hex').slice(0,16),file=path.join(CACHE,key+'.png');
 if(existsSync(file))return file;
 const [L,T,W,H]=rect,todo=[];for(let y=0;y<H;y+=TS)for(let x=0;x<W;x+=TS)todo.push({x:L+x,y:T+y,w:Math.min(TS,W-x),h:Math.min(TS,H-y),left:x,top:y});
 const nW=Math.max(1,Math.min(+(process.env.STAGE_WORKERS||4),todo.length,os.cpus().length-2)),parts=[];
 await new Promise((resolve,reject)=>{let active=0;
  for(let i=0;i<nW;i++){const wk=new Worker(fileURLToPath(import.meta.url),{workerData:{stage:true,plan,zoom}});active++;
   const next=()=>{const t=todo.shift();wk.postMessage(t?t:{stop:true});};
   wk.on('message',async m=>{if(m.tile)parts.push({input:await sharp(Buffer.from(m.buf),{raw:{width:m.tile.w,height:m.tile.h,channels:4}}).png().toBuffer(),left:m.tile.left,top:m.tile.top});next();});
   wk.on('error',reject);wk.on('exit',()=>{if(--active===0)resolve();});}});
 await fs.mkdir(CACHE,{recursive:true});
 await sharp({create:{width:W,height:H,channels:4,background:'#1d2619'}}).composite(parts).png().toFile(file);
 return file;
}

const fenceCache=new Map();
async function fenceBuf(id){if(fenceCache.has(id))return fenceCache.get(id);let b=null;
 try{const r=await fetch('http://127.0.0.1:5190/fence-render/'+encodeURIComponent(id)+'.png?r=2');if(r.ok)b=Buffer.from(await r.arrayBuffer());}catch{}
 fenceCache.set(id,b);return b;}
const cache=new Map();
async function img(file,w,h,flip,fenceId){const k=file+'|'+Math.round(w)+'|'+Math.round(h)+'|'+flip;if(cache.has(k))return cache.get(k);
 const src=(fenceId&&await fenceBuf(fenceId))||file;let im=sharp(src).resize(Math.max(1,Math.round(w)),Math.max(1,Math.round(h)),{fit:'fill'});if(flip)im=im.flop();
 const b=await im.png().toBuffer();cache.set(k,b);return b;}

/** compose sprites over the ground: {id,x,y,flip,scale,z,o,label} in world metres; z = map zoom of the ground */
export async function compose(groundFile,sc,rect,sprites,{labels=false,zoom=1,labelPx=15,grid=null,visibility=false}={}){
 const [L,T,W,H]=rect,S=32*zoom,comp=[{input:groundFile,left:0,top:0}];
 const placed=sprites.map(s=>{const it=ITEMS.get(s.id);const [mx,my]=sc.toScreen(s.x,s.y),k=(s.scale||1)*zoom;
  return {s,it,k,mx,my,left:s.flip?mx-(it.w-it.ax)*k:mx-it.ax*k,top:my-it.ay*k,w:it.w*k,h:it.h*k,flat:it.flat?0:1,z:s.z||0,depth:my+(s.o||0)*S/2};})
  .sort((a,b)=>a.flat-b.flat||a.z-b.z||a.depth-b.depth);
 const add=async(b,l,t,w,h)=>{l=Math.round(l-L);t=Math.round(t-T);w=Math.round(w);h=Math.round(h);if(l>=W||t>=H||l+w<=0||t+h<=0)return;
  const cl=Math.max(0,-l),ct=Math.max(0,-t),cw=Math.min(w-cl,W-Math.max(l,0)),ch=Math.min(h-ct,H-Math.max(t,0));if(cw<=0||ch<=0)return;
  if(cl||ct||cw!==w||ch!==h)b=await sharp(b).extract({left:cl,top:ct,width:cw,height:ch}).png().toBuffer();comp.push({input:b,left:Math.max(l,0),top:Math.max(t,0)});};
 for(const p of placed)if(!p.flat)await add(await img(path.join(LIB,p.it.file),p.w,p.h,!!p.s.flip),p.left,p.top,p.w,p.h);
 for(const p of placed){const sh=p.it.shadow;if(!p.flat||!sh)continue;const k=p.k,my=p.my+(sh.dy||0)*k;
  await add(await img(path.join(LIB,sh.file),sh.w*k,sh.h*k,!!p.s.flip),p.s.flip?p.mx-(sh.w-sh.ax)*k:p.mx-sh.ax*k,my-sh.ay*k,sh.w*k,sh.h*k);}
 for(const p of placed)if(p.flat)await add(await img(path.join(LIB,p.it.file),p.w,p.h,!!p.s.flip,p.it.fence?p.it.id:null),p.left,p.top,p.w,p.h);
 let vis=null;
 if(visibility){const [W2,H2]=[Math.ceil(W/2),Math.ceil(H/2)],own=new Int32Array(W2*H2).fill(-1),tot=new Map();
  const paint=async(p,idx)=>{const w=Math.max(1,Math.round(p.w/2)),h=Math.max(1,Math.round(p.h/2)),l=Math.round((p.left-L)/2),t=Math.round((p.top-T)/2);
   let im=sharp(path.join(LIB,p.it.file)).resize(w,h,{fit:'fill'});if(p.s.flip)im=im.flop();const a=await im.ensureAlpha().extractChannel(3).raw().toBuffer();let n=0;
   for(let y=0;y<h;y++){const Y=t+y;if(Y<0||Y>=H2)continue;for(let x=0;x<w;x++){const X=l+x;if(X<0||X>=W2||a[y*w+x]<128)continue;own[Y*W2+X]=idx;n++;}}tot.set(idx,n);};
  for(let i=0;i<placed.length;i++)if(!placed[i].flat)await paint(placed[i],i);
  for(let i=0;i<placed.length;i++)if(placed[i].flat&&!placed[i].it.fence)await paint(placed[i],i);
  const seen=new Map();for(const o of own)if(o>=0)seen.set(o,(seen.get(o)||0)+1);
  vis=placed.map((p,i)=>({member:p.s.member,id:p.s.id,i,visible:tot.get(i)?(seen.get(i)||0)/tot.get(i):1})).filter(v=>v.member!=null);
  // suggestions: try nearby positions; a pixel counts as visible if nothing upright drawn after it (deeper) owns it
  const masks=new Map();const maskOf=async p=>{const w=Math.max(1,Math.round(p.w/2)),h=Math.max(1,Math.round(p.h/2)),k=p.it.id+w+'x'+h+p.s.flip;if(!masks.has(k)){let im=sharp(path.join(LIB,p.it.file)).resize(w,h,{fit:'fill'});if(p.s.flip)im=im.flop();masks.set(k,{w,h,a:await im.ensureAlpha().extractChannel(3).raw().toBuffer()});}return masks.get(k);};
  for(const v of vis){if(v.visible>=.45||/fence|hedge|gutter|chainlink|picket/.test(v.id))continue;const p=placed[v.i],m=await maskOf(p);let best=null;
   for(let r=1;r<=7&&!best;r++)for(let dx=-r;dx<=r;dx++)for(let dy=-r;dy<=r;dy++){if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;
    const [mx,my]=sc.toScreen(p.s.x+dx,p.s.y+dy),depth=my,l=Math.round((mx-(p.mx-p.left)-L)/2),t=Math.round((my-(p.my-p.top)-T)/2);let n=0,ok=0;
    for(let y=0;y<m.h;y++){const Y=t+y;if(Y<0||Y>=H2)continue;for(let x=0;x<m.w;x++){const X=l+x;if(X<0||X>=W2||m.a[y*m.w+x]<128)continue;n++;const o=own[Y*W2+X];
     if(o<0||o===v.i||placed[o].flat===0||(p.flat===0?false:placed[o].depth<depth))ok++;}}
    if(n&&ok/n>=.75&&(!best||Math.hypot(dx,dy)<Math.hypot(best[0],best[1])))best=[dx,dy,ok/n];}
   if(best)v.suggest=best;}}
 if(grid){const [O,fw,fh,gs=2]=grid,lab=gs<2?2:10;let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><g stroke-width="${labelPx/10}" font-family="Arial" font-size="${labelPx*.8}">`;
  const P=(u,v)=>{const [x,y]=sc.toScreen(O+u,O+v);return [x-L,y-T];};
  for(let u=0;u<=fw+.01;u+=gs){const [a,b]=P(u,0),[c,d]=P(u,fh);svg+=`<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" stroke="${u%lab?'#ffffff30':'#ffd16690'}"/>`;}
  for(let v=0;v<=fh+.01;v+=gs){const [a,b]=P(0,v),[c,d]=P(fw,v);svg+=`<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" stroke="${v%lab?'#ffffff30':'#ffd16690'}"/>`;}
  for(let u=0;u<=fw;u+=lab)for(let v=0;v<=fh;v+=lab){const [x,y]=P(u,v);svg+=`<text x="${x+3}" y="${y-3}" fill="#ffd166" stroke="#000" stroke-width="${labelPx/6}" paint-order="stroke">${u},${v}</text>`;}
  comp.push({input:Buffer.from(svg+'</g></svg>'),left:0,top:0});}
 if(labels){const esc=t=>String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;'),fz=Math.round(labelPx);let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><g font-family="Arial" font-size="${fz}">`;
  for(const p of placed){if(p.s.label==null)continue;const x=p.mx-L,y=p.my-T;svg+=`<circle cx="${x}" cy="${y}" r="${fz/3.5}" fill="${p.flat?'#0ff':'#ff0'}"/><text x="${x+fz/3}" y="${y-fz/4}" fill="#fff" stroke="#000" stroke-width="${fz/5}" paint-order="stroke">${esc(p.s.label)}</text>`;}
  comp.push({input:Buffer.from(svg+'</g></svg>'),left:0,top:0});}
 const buf=await sharp({create:{width:W,height:H,channels:4,background:'#1d2619'}}).composite(comp).png().toBuffer();
 return visibility?{buf,vis}:buf;
}

/** load a preset from a v5 module (default export: build function returning Preset(...).done()) or a preset JSON */
export async function loadPreset(file){
 if(file.endsWith('.json')){const j=JSON.parse(await fs.readFile(file,'utf8'));return {preset:j.preset||j,errors:[],warnings:[]};}
 const mod=await import(pathToFileURL(path.resolve(file)).href+'?t='+Date.now());return mod.default();
}

export async function renderPreset(preset,out,{k=.4,labels=false,crop=null,stageDressing=true,zoom=null,grid=false,visibility=false}={}){
 const fit=preset.fit||{w:69.4,h:69.4},{plan,C,O}=stagePlan(fit,preset.ground||[]);
 zoom??=(k<=.5?.5:1);
 const sc=await sceneFor(plan,zoom);
 // window: the requested part of the block (default all of it plus its roads), with headroom for tall sprites
 const [u0,v0,u1,v1]=crop||[-12,-12,fit.w+12,fit.h+12],pts=[[u0,v0],[u1,v0],[u0,v1],[u1,v1]].map(([u,v])=>sc.toScreen(O+u,O+v));
 const L=Math.floor(Math.min(...pts.map(p=>p[0]))),R=Math.ceil(Math.max(...pts.map(p=>p[0]))),T=Math.floor(Math.min(...pts.map(p=>p[1]))-(crop?380:460)*zoom),B=Math.ceil(Math.max(...pts.map(p=>p[1]))+24*zoom);
 const rect=[L,T,R-L,B-T],ground=await groundImage(plan,rect,zoom);
 const sprites=[];
 if(stageDressing){for(const lp of sc.lamps)sprites.push({id:'world:streetlamp',x:lp.px,y:lp.py,flip:false,scale:.98});
  for(const [u,v,f] of [[fit.w+1.2,fit.h+2.3,false],[-8.6,2.1,false],[3,-7.6,true],[fit.w+2.2,3,false]])sprites.push({id:'town:traffic_light',x:O+u,y:O+v,flip:f,scale:.95});}
 preset.members.forEach((m,i)=>sprites.push({id:m.pick[0],x:C[0]+m.dx,y:C[1]+m.dy,flip:!!m.flip,scale:m.scale[0],z:m.z,o:m.o,member:i,label:labels?`#${i} ${m.pick[0].split(':').pop().slice(0,16)}`:null}));
 const f=k/zoom,res=await compose(ground,sc,rect,sprites,{labels,zoom,labelPx:13/f,grid:grid?[O,fit.w,fit.h,+grid||2]:null,visibility}),buf=visibility?res.buf:res;
 await fs.mkdir(path.dirname(path.resolve(out)),{recursive:true});
 await sharp(buf).resize(Math.round(rect[2]*f)).png().toFile(out);
 return {out,width:Math.round(rect[2]*f),members:preset.members.length,...(visibility?{vis:res.vis}:{})};
}

if(isMainThread&&process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const args=process.argv.slice(2),opt=n=>{const i=args.indexOf('--'+n);return i>=0?args[i+1]:null;};
 const file=args[0],out=args[1]&&!args[1].startsWith('--')?args[1]:path.join(DATA,'presets-v5-study/stage',path.basename(file).replace(/\.(mjs|json)$/,'')+'.png');
 const r=await loadPreset(file);
 for(const e of r.errors||[])console.log('ERROR',e);for(const w of r.warnings||[])console.log('warn ',w);
 const res=await renderPreset(r.preset,out,{k:+(opt('k')||.4),labels:args.includes('--labels'),grid:args.includes('--grid')?(+opt('grid')||2):false,visibility:args.includes('--vis'),crop:opt('crop')?.split(',').map(Number)||null,zoom:opt('zoom')?+opt('zoom'):null});
 if(res.vis){const bad=res.vis.filter(v=>v.visible<.45&&!/fence|hedge|gutter|chainlink|picket/.test(v.id)).sort((a,b)=>a.visible-b.visible);
  for(const v of bad){const m=r.preset.members[v.member],u=m.dx+(r.preset.fit?.w||69.4)/2,w=m.dy+(r.preset.fit?.h||69.4)/2;console.log(`hidden ${Math.round(100*(1-v.visible))}%: #${v.member} ${v.id} @(${u.toFixed(1)},${w.toFixed(1)}) [${m.section}]`+(v.suggest?`  -> try (${(u+v.suggest[0]).toFixed(1)},${(w+v.suggest[1]).toFixed(1)}) ${Math.round(100*v.suggest[2])}% visible`:'  -> nothing within 7 m'));}delete res.vis;}
 console.log(JSON.stringify(res));
}
