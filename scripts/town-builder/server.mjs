/** Maple Falls Town Builder — local server (Node built-ins + sharp).
 *  node scripts/town-builder/server.mjs [--port 5190]   then open http://127.0.0.1:5190
 *  Serves the app, sprite library and baked map tiles; saves the sprite layout and ground plan to
 *  output/town-builder/ (so they can be brought into the game); re-bakes the ground; exports PNGs. */
import http from 'node:http';
import fs from 'node:fs/promises';
import {createReadStream,existsSync} from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {migrateLamps} from './migrate-lamps.mjs';
import {GroundPreview,PREVIEW_MAX} from './ground-preview.mjs';
import {mapDirectory} from './map-storage.mjs';
import {TownCollaboration,isLocal} from './collaboration.mjs';
import {ROOT,artDir,artSource} from '../lib/town-paths.mjs';
import {fixedPreset} from './app/fixed-preset.js';
import {fenceColumn,fencePlan,repairLegacyFenceRuns} from './app/fence-projection.js';
const option=k=>{const i=process.argv.indexOf('--'+k);return i>=0?process.argv[i+1]:null;};
const HERE=path.dirname(fileURLToPath(import.meta.url)),DATA=path.resolve(option('data')||path.join(ROOT,'output/town-builder'));
const ASSETS=path.resolve(option('assets')||DATA);
const PLAN_FILE=path.join(DATA,'plans/maple-falls.json'),LAYOUT=path.join(DATA,'layout.json'),SEED=path.join(DATA,'layout-seed.json');
const port=+(process.argv[process.argv.indexOf('--port')+1]||0)||+process.env.PORT||5190;
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'};
const BAKE_STATUS=path.join(DATA,'bake-status.json');
/** Bake progress written by bake-run.mjs; a bake whose process has gone away is reported as failed with the reason. */
async function bakeStatus(){let b;try{b=JSON.parse(await fs.readFile(BAKE_STATUS,'utf8'));}catch{return {running:false,log:[],startedAt:null,finishedAt:null,code:null};}
 if(b.running&&b.pid){try{process.kill(b.pid,0);}catch{b={...b,running:false,code:1,finishedAt:Date.now(),log:[...b.log,'The bake process stopped unexpectedly. Press Bake ground again.']};await fs.writeFile(BAKE_STATUS,JSON.stringify(b));}}
 else if(b.running&&Date.now()-b.startedAt>30000){b={...b,running:false,code:1,log:[...b.log,'The bake never started. Press Bake ground again.']};}
 return b;}
async function body(req){const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>20*1024*1024)throw Error('request too large');chunks.push(c);}return Buffer.concat(chunks).toString('utf8');}
function send(res,code,obj){res.writeHead(code,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(obj));}
async function serveFile(res,file,cache=true){if(!existsSync(file)){res.writeHead(404);res.end('not found');return;}
 res.writeHead(200,{'content-type':TYPES[path.extname(file)]||'application/octet-stream','cache-control':cache?'max-age=600':'no-store'});createReadStream(file).pipe(res);}
const safeJoin=(base,rel)=>{const p=path.resolve(base,'.'+path.sep+decodeURIComponent(rel)),r=path.relative(base,p);if(r.startsWith('..')||path.isAbsolute(r))throw Error('bad path');return p;};
async function backup(file,dir){try{const t=new Date().toISOString().replace(/[:.]/g,'-');await fs.mkdir(dir,{recursive:true});await fs.copyFile(file,path.join(dir,path.basename(file,'.json')+'-'+t+'.json'));}catch{}}
let saves=0;
const fenceRenderCache=new Map();
async function fenceTexture(it,ratio=2){
 const p=it.fence;let source=path.join(ASSETS,'library',it.file),native=false;
 if(ratio>2&&it.id.startsWith('expansion:')&&it.source){const f=artSource(it.source);if(existsSync(f)){source=f;native=true;}}
 const stat=await fs.stat(source),key=it.id+'|'+ratio+'|'+stat.mtimeMs+'|'+JSON.stringify(p);
 if(fenceRenderCache.has(key))return fenceRenderCache.get(key);
 const meta=await sharp(source).metadata(),sx=meta.width/p.width,sy=meta.height/p.height;
 const point=q=>({x:q.x*sx,top:q.top*sy,bottom:q.bottom*sy});
 const plan=ratio===2&&!native?p:fencePlan({width:meta.width,height:meta.height,left:point(p.left),right:point(p.right),axis:p.axis,lengthM:p.lengthM,heightM:p.heightM,ratio});
 const src=await sharp(source).resize(plan.width,plan.height,{fit:'fill'}).ensureAlpha().raw().toBuffer();
 const buf=await sharp(warpFence(plan,src),{raw:{width:Math.ceil(plan.canvasW),height:Math.ceil(plan.canvasH),channels:4}}).png().toBuffer();fenceRenderCache.set(key,buf);
 if(fenceRenderCache.size>32)fenceRenderCache.delete(fenceRenderCache.keys().next().value);return buf;
}
/** Same projection as paintFence/fenceSvg, done as an inverse pixel warp (2×2 supersampled, premultiplied bilinear).
 *  The SVG route left fences blank (librsvg ignores embedded WebP) and took ~20 s for wide sprites. */
function warpFence(p,src){
 const W=Math.ceil(p.canvasW),H=Math.ceil(p.canvasH),out=Buffer.alloc(W*H*4),acc=new Float64Array(4);
 const sample=(x,y)=>{
  if(x<0||y<0||x>p.width||y>p.height)return;
  const fx=Math.min(Math.max(x-.5,0),p.width-1),fy=Math.min(Math.max(y-.5,0),p.height-1),x0=Math.floor(fx),y0=Math.floor(fy),x1=Math.min(x0+1,p.width-1),y1=Math.min(y0+1,p.height-1),tx=fx-x0,ty=fy-y0;
  for(const [xx,yy,w] of [[x0,y0,(1-tx)*(1-ty)],[x1,y0,tx*(1-ty)],[x0,y1,(1-tx)*ty],[x1,y1,tx*ty]]){
   if(!w)continue;const i=(yy*p.width+xx)*4,a=src[i+3]*w/255;acc[0]+=src[i]*a;acc[1]+=src[i+1]*a;acc[2]+=src[i+2]*a;acc[3]+=a;}
 };
 for(let X=0;X<W;X++)for(const ox of [.25,.75]){
  const x=(X+ox-p.pad+p.minX)/p.scale+p.cx;if(x<0||x>p.width)continue;
  const c=fenceColumn(p,Math.min(x,p.width-1e-6));
  for(let Y=0;Y<H;Y++){acc.fill(0);for(const oy of [.25,.75])sample(x,(Y+oy-c.y)/c.sy);if(!acc[3])continue;
   const o=(Y*W+X)*4,prev=out[o+3]/255,a=acc[3]/4;
   // two x sub-columns per output column: add the second half to the first
   const r=out[o]*prev+acc[0]/4,g=out[o+1]*prev+acc[1]/4,b=out[o+2]*prev+acc[2]/4,na=prev+a;
   out[o]=Math.round(r/na);out[o+1]=Math.round(g/na);out[o+2]=Math.round(b/na);out[o+3]=Math.round(Math.min(1,na)*255);}
 }
 return out;
}
async function json(file,fallback){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}}
async function presets(){const generated=await json(path.join(ASSETS,'presets/presets.json'),{presets:[]}),poi=await json(path.join(ASSETS,'presets/poi.json'),{presets:[]}),sharedUser=await json(path.join(ASSETS,'presets/user.json'),{presets:[]}),user=await json(path.join(DATA,'presets/user.json'),{presets:[]}),places=await json(path.join(ASSETS,'presets/places.json'),{presets:[]});
 return {presets:[...new Map([...places.presets,...generated.presets,...poi.presets,...sharedUser.presets,...user.presets].map(p=>[p.id,p])).values()].map(fixedPreset)};}
async function savePreset(p){
 const lib=await json(path.join(ASSETS,'library/library.json'),{items:[]}),ids=new Set(lib.items.map(i=>i.id));
 if(!/^user-[a-z0-9-]+$/i.test(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>100||!Array.isArray(p.members)||p.members.length<1||p.members.length>1000)throw Error('invalid preset');
 for(const m of p.members)if(!Number.isFinite(m.dx)||!Number.isFinite(m.dy)||!Array.isArray(m.pick)||!m.pick.length||m.pick.some(id=>!ids.has(id))||!Array.isArray(m.scale)||m.scale.length!==2||m.scale.some(s=>!Number.isFinite(s)||s<=0||s>10))throw Error('invalid preset member');
 p=fixedPreset(p);
 p.name=p.name.trim();p.group='My presets';p.count=p.members.length;delete p.thumb;
 const file=path.join(DATA,'presets/user.json'),j=await json(file,{presets:[]});
 await fs.mkdir(path.dirname(file),{recursive:true});await backup(file,path.join(DATA,'presets/history'));
 j.presets=j.presets.filter(x=>x.id!==p.id);j.presets.push(p);await fs.writeFile(file,JSON.stringify(j,null,1));return p;
}

/** Compose sprites over the baked full-resolution tiles: writes exports/<stamp>/ full tiles + a half-size picture. */
async function exportTown(){
 const map=await mapDirectory(DATA),man=JSON.parse(await fs.readFile(path.join(map,'manifest.json'),'utf8')),lib=JSON.parse(await fs.readFile(path.join(ASSETS,'library/library.json'),'utf8'));
 const layout=JSON.parse(await fs.readFile(existsSync(LAYOUT)?LAYOUT:SEED,'utf8')),items=new Map(lib.items.map(i=>[i.id,i]));
 layout.sprites=repairLegacyFenceRuns(layout.sprites,items).items;
 const S=man.pxPerAxisM,{ox,oy}=man.origin,T=man.tileSize,stamp=new Date().toISOString().replace(/[:.]/g,'-'),dir=path.join(DATA,'exports',stamp);
 await fs.mkdir(path.join(dir,'tiles'),{recursive:true});
 const placed=layout.sprites.map(s=>{const it=items.get(s.id);if(!it)return null;const mx=ox+(s.x-s.y)*S,my=oy+(s.x+s.y)*S/2,sc=s.scale||1,w=it.w*sc,h=it.h*sc;
  const left=s.flip?mx-(it.w-it.ax)*sc:mx-it.ax*sc,top=my-it.ay*sc;return {s,it,left,top,w,h,flat:it.flat?0:1,z:s.z||0,depth:my+(s.o||0)*S/2};}).filter(Boolean).sort((a,b)=>a.flat-b.flat||a.z-b.z||a.depth-b.depth); // ground first, then layer (bring to front), then depth
 const cache=new Map();const spriteBuf=async(p)=>{const k=p.it.id+'|'+Math.round(p.w)+'|'+Math.round(p.h)+'|'+(p.s.flip?1:0);if(!cache.has(k)){let im=(p.it.fence?sharp(await fenceTexture(p.it)):sharp(path.join(ASSETS,'library',p.it.file))).resize(Math.max(1,Math.round(p.w)),Math.max(1,Math.round(p.h)));if(p.s.flip)im=im.flop();cache.set(k,await im.png().toBuffer());}return cache.get(k);};
 // base shadows (library/shadows/*): drawn under every upright sprite, before any sprite
 const shadowParts=[];for(const p of placed){const sh=p.it.shadow;if(p.it.flat||!sh)continue;const sc=p.s.scale||1,mx=ox+(p.s.x-p.s.y)*S,my=oy+(p.s.x+p.s.y)*S/2+(sh.dy||0)*sc;
  shadowParts.push({p,file:path.join(ASSETS,'library',sh.file),left:p.s.flip?mx-(sh.w-sh.ax)*sc:mx-sh.ax*sc,top:my-sh.ay*sc,w:sh.w*sc,h:sh.h*sc,flip:!!p.s.flip});}
 const shadowBuf=async q=>{const k='sh|'+q.file+'|'+Math.round(q.w)+'|'+Math.round(q.h)+'|'+q.flip;if(!cache.has(k)){let im=sharp(q.file).resize(Math.max(1,Math.round(q.w)),Math.max(1,Math.round(q.h)));if(q.flip)im=im.flop();cache.set(k,await im.png().toBuffer());}return cache.get(k);};
 const L0=man.levels[0];
 for(let ty=0;ty<L0.rows;ty++)for(let tx=0;tx<L0.cols;tx++){const f=path.join(map,'full',`${tx}_${ty}.png`);if(!existsSync(f))continue;const m=await sharp(f).metadata(),x0=tx*T,y0=ty*T;const comp=[];
  for(const p of placed){if(p.flat!==0)continue; // ground decals (flat===0) first
   const l=Math.round(p.left-x0),t=Math.round(p.top-y0),w=Math.round(p.w),h=Math.round(p.h);if(l>=m.width||t>=m.height||l+w<=0||t+h<=0)continue;
   let buf=await spriteBuf(p),cl=Math.max(0,-l),ct=Math.max(0,-t),cw=Math.min(w-cl,m.width-Math.max(l,0)),ch=Math.min(h-ct,m.height-Math.max(t,0));if(cw<=0||ch<=0)continue;
   if(cl||ct||cw!==w||ch!==h)buf=await sharp(buf).extract({left:cl,top:ct,width:cw,height:ch}).png().toBuffer();comp.push({input:buf,left:Math.max(l,0),top:Math.max(t,0)});}
  for(const q of shadowParts){const l=Math.round(q.left-x0),t=Math.round(q.top-y0),w=Math.round(q.w),h=Math.round(q.h);if(l>=m.width||t>=m.height||l+w<=0||t+h<=0)continue;
   let buf=await shadowBuf(q),cl=Math.max(0,-l),ct=Math.max(0,-t),cw=Math.min(w-cl,m.width-Math.max(l,0)),ch=Math.min(h-ct,m.height-Math.max(t,0));if(cw<=0||ch<=0)continue;
   if(cl||ct||cw!==w||ch!==h)buf=await sharp(buf).extract({left:cl,top:ct,width:cw,height:ch}).png().toBuffer();comp.push({input:buf,left:Math.max(l,0),top:Math.max(t,0)});}
  for(const p of placed){if(p.flat===0)continue;const l=Math.round(p.left-x0),t=Math.round(p.top-y0),w=Math.round(p.w),h=Math.round(p.h);if(l>=m.width||t>=m.height||l+w<=0||t+h<=0)continue;
   let buf=await spriteBuf(p),cl=0,ct=0,cw=w,ch=h;if(l<0){cl=-l;cw-=cl;}if(t<0){ct=-t;ch-=ct;}cw=Math.min(cw,m.width-Math.max(l,0));ch=Math.min(ch,m.height-Math.max(t,0));if(cw<=0||ch<=0)continue;
   if(cl||ct||cw!==w||ch!==h)buf=await sharp(buf).extract({left:cl,top:ct,width:cw,height:ch}).png().toBuffer();comp.push({input:buf,left:Math.max(l,0),top:Math.max(t,0)});}
  await sharp(f).composite(comp).png({compressionLevel:6}).toFile(path.join(dir,'tiles',`${tx}_${ty}.png`));}
 // half-size picture for review
 const half=[];for(let ty=0;ty<L0.rows;ty++)for(let tx=0;tx<L0.cols;tx++){const f=path.join(dir,'tiles',`${tx}_${ty}.png`);if(!existsSync(f))continue;const m=await sharp(f).metadata();half.push({input:await sharp(f).resize(Math.ceil(m.width/2),Math.ceil(m.height/2)).png().toBuffer(),left:tx*T/2,top:ty*T/2});}
 await sharp({create:{width:Math.ceil(man.width/2),height:Math.ceil(man.height/2),channels:3,background:'#1d2619'}}).composite(half).webp({quality:92}).toFile(path.join(dir,'town-half.webp'));
 await fs.writeFile(path.join(dir,'README.txt'),`Maple Falls export ${stamp}\nFull-resolution tiles: tiles/<col>_<row>.png (${T}px, game scale 32 px per axis metre)\nHalf-size picture: town-half.webp\nLayout: ${path.basename(existsSync(LAYOUT)?LAYOUT:SEED)} (${layout.sprites.length} sprites)\n`);
 return {dir:path.relative(ROOT,dir),half:`/exports/${stamp}/town-half.webp`,sprites:placed.length};}

const sharing=await TownCollaboration.open({data:DATA,port,
 read:kind=>json(kind==='plan'?PLAN_FILE:existsSync(LAYOUT)?LAYOUT:SEED,kind==='plan'?{roads:[]}: {sprites:[]}),
 write:async(kind,doc)=>{const file=kind==='plan'?PLAN_FILE:LAYOUT;
  if(kind==='plan'||++saves%25===0)await backup(file,path.join(DATA,kind==='plan'?'plans/history':'layouts-history'));
  await fs.mkdir(path.dirname(file),{recursive:true});const temp=file+'.saving';await fs.writeFile(temp,JSON.stringify(doc));await fs.rename(temp,file);
 }
});
let rebinding=false;
function rebind(){if(rebinding)return;rebinding=true;for(const stream of sharing.streams.values())stream.end();server.close(()=>{server.listen(port,sharing.host(),()=>{rebinding=false;console.log('Sharing '+(sharing.settings.enabled?'enabled':'disabled'));});});server.closeAllConnections();}
const groundPreview=new GroundPreview();
const server=http.createServer(async(req,res)=>{
 try{const u=new URL(req.url,'http://x'),p=u.pathname;
  if(p.startsWith('/join/')&&req.method==='GET'&&sharing.settings.enabled&&p.slice(6)===sharing.settings.key){
   res.writeHead(302,{'set-cookie':`town-join=${sharing.settings.key}; HttpOnly; SameSite=Lax; Path=/`,'location':'/','referrer-policy':'no-referrer'});return res.end();
  }
  if(!sharing.authorized(req)){res.writeHead(403,{'content-type':'text/html; charset=utf-8'});return res.end('<!doctype html><title>Join Maple Falls</title><main style="font:18px system-ui;max-width:540px;margin:12vh auto;padding:24px"><h1>Join this town</h1><p>Ask the host to open <b>Share town</b> and send you the invitation link. Open that link to start building together.</p></main>');}
  if(!['GET','HEAD'].includes(req.method)&&req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return send(res,403,{error:'Open the builder on this server before saving.'});
  if(p==='/api/share'&&req.method==='GET')return send(res,200,sharing.status(isLocal(req)));
  if(p==='/api/share'&&req.method==='POST'){
   if(!isLocal(req))return send(res,403,{error:'Only the host can change sharing.'});
   const input=JSON.parse(await body(req)),changed=sharing.settings.enabled!==!!input.enabled,status=await sharing.enable(input.enabled);
   if(changed)res.once('finish',rebind);return send(res,200,status);
  }
  if(p==='/api/session'&&req.method==='POST'){const session=await sharing.session(JSON.parse(await body(req)).name);session.sharing=sharing.status(isLocal(req));return send(res,200,session);}
  if(p==='/api/events'&&req.method==='GET')return sharing.stream(u.searchParams.get('session'),req,res);
  if(p==='/api/presence'&&req.method==='POST'){const change=JSON.parse(await body(req));return send(res,sharing.presence(change.session,change)?200:409,{ok:true});}
  if(p==='/api/live'){
   const revision=async files=>(await Promise.all(files.map(async f=>{try{const s=await fs.stat(f);return `${s.mtimeMs}:${s.size}`;}catch(e){if(e.code==='ENOENT')return 'missing';throw e;}}))).join('|');
   return send(res,200,{
    app:await revision(['index.html','app.js','style.css','live.js','selection-scale.js','fixed-preset.js','fence-projection.js','ground-ui.js','ground-state.js','town-merge.js','collaboration.js'].map(f=>path.join(HERE,'app',f))),
    library:await revision([path.join(ASSETS,'library/library.json')]),
    map:await revision([path.join(await mapDirectory(DATA),'manifest.json')]),
    presets:await revision([...['presets.json','poi.json','user.json','places.json'].map(f=>path.join(ASSETS,'presets',f)),path.join(DATA,'presets/user.json')])
   });
  }
  if(p==='/'||p==='/index.html')return serveFile(res,path.join(HERE,'app/index.html'),false);
  if(p.startsWith('/app/'))return serveFile(res,safeJoin(path.join(HERE,'app'),p.slice(5)),false);
  if(p.startsWith('/library/'))return serveFile(res,safeJoin(path.join(ASSETS,'library'),p.slice(9)));
  if(p.startsWith('/fence-render/')&&p.endsWith('.png')){
   const id=decodeURIComponent(p.slice(14,-4)),lib=await json(path.join(ASSETS,'library/library.json'),{items:[]}),it=lib.items.find(i=>i.id===id);
   if(!it?.fence){res.writeHead(404);return res.end('unknown fence');}
   const buf=await fenceTexture(it,u.searchParams.get('r')==='2'?2:8);res.writeHead(200,{'content-type':'image/png','cache-control':'no-store'});return res.end(buf);
  }
  if(p==='/sprite-review/'||p==='/sprite-review')return serveFile(res,path.join(ASSETS,'expansion-review/index.html'),false);
  if(p.startsWith('/sprite-review/'))return serveFile(res,safeJoin(path.join(ASSETS,'expansion-review'),p.slice(15)),false);
  if(p.startsWith('/town-art/'))return serveFile(res,safeJoin(artDir('expansion-1988'),p.slice(10)));
  if(p.startsWith('/map/'))return serveFile(res,safeJoin(await mapDirectory(DATA),p.slice(5)),!p.endsWith('.json'));
  if(p.startsWith('/presets/'))return serveFile(res,safeJoin(path.join(ASSETS,'presets'),p.slice(9)));
  if(p.startsWith('/exports/'))return serveFile(res,safeJoin(path.join(DATA,'exports'),p.slice(9)));
  if((p==='/api/plan'||p==='/api/layout')&&req.method==='GET')return send(res,200,u.searchParams.has('rev')?await sharing.readWithRevision(p.slice(5)):await sharing.read(p.slice(5)));
  // Light glow live preview: one rectangle of the finished ground for the saved plan, rendered like Rebuild ground does
  if(p==='/api/ground-preview'&&req.method==='POST'){const q=JSON.parse(await body(req)),x=Math.max(0,Math.round(+q.x)),y=Math.max(0,Math.round(+q.y)),w=Math.round(+q.w),h=Math.round(+q.h);
   if(!(w>0&&h>0)||w*h>PREVIEW_MAX)return send(res,400,{error:'That preview area is too large.'});
   try{const {document,revision}=await sharing.readWithRevision('plan'),text=JSON.stringify(document),img=await groundPreview.render(text,revision+':'+text.length,x,y,w,h);
    res.writeHead(200,{'content-type':'image/webp','cache-control':'no-store'});res.end(img);}catch(e){send(res,500,{error:'Preview failed: '+e.message});}return;}
  if(p==='/api/presets'&&req.method==='GET')return send(res,200,await presets());
  if(p==='/api/presets'&&req.method==='POST')return send(res,200,{ok:true,preset:await savePreset(JSON.parse(await body(req)))});
  if((p==='/api/plan'||p==='/api/layout')&&req.method==='PUT'){const result=await sharing.save(p.slice(5),JSON.parse(await body(req)));return send(res,result.status,result);}
  if(p==='/api/bake'&&req.method==='POST'){const result=await sharing.serial(async()=>{if((await bakeStatus()).running)return {status:409,error:'Another builder is already rebuilding the ground.'};
   /* the bake runs detached (bake-run.mjs) so a server restart, e.g. node --watch reloading, can't kill it */
   await fs.writeFile(BAKE_STATUS,JSON.stringify({running:true,log:['starting'],startedAt:Date.now(),finishedAt:null,code:null}));
   const frozen=path.join(DATA,'bake-plan-'+Date.now()+'.json');
   await fs.writeFile(frozen,JSON.stringify(await sharing.read('plan')));
   const ch=spawn(process.execPath,[path.join(HERE,'bake-run.mjs'),frozen,DATA],{cwd:ROOT,detached:true,stdio:'ignore',windowsHide:true});ch.unref();return {status:200,started:true};});return send(res,result.status,result);}
  if(p==='/api/bake'&&req.method==='GET')return send(res,200,await bakeStatus());
  if(p==='/api/export'&&req.method==='POST')return send(res,200,await exportTown());
  res.writeHead(404);res.end('not found');
 }catch(e){send(res,500,{error:String(e.message||e)});}
});
console.log('Lamp layers:',JSON.stringify(await migrateLamps(DATA)));
if(DATA===ASSETS){
 import('./scale-guide.mjs').then(m=>m.applyScaleGuide()).catch(e=>console.warn('scale guide:',e.message));
 import('./shadows.mjs').then(m=>m.ensureShadows({log:t=>console.log(t)})).catch(e=>console.warn('shadows:',e.message));
}
server.listen(port,sharing.host(),()=>console.log(`Town builder on http://127.0.0.1:${port}  (data: ${DATA})`));
