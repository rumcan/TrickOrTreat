/** Bake a town ground plan into map tiles (+ zoom pyramid + preview) for the town builder app.
 *  node scripts/town-builder/bake.mjs <plan.json> [outDir] [--zoom 1] [--workers 8] [--tiles x,y;x,y]
 *  Each worker builds the same deterministic scene and renders its share of 1024 px tiles. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {fileURLToPath} from 'node:url';
import {loadSources,buildScene,renderRect,ROOT} from '../lib/town-scene.mjs';
import {groundState} from './app/ground-state.js';
import {groundFrame} from './app/ground-boundary.js';
const TILE=1024;

if(!isMainThread){
 const {planFile,zoom,outDir}=workerData;const plan=JSON.parse(await fs.readFile(planFile,'utf8'));
 const S=await loadSources(zoom),sc=buildScene(plan,S);parentPort.postMessage({ready:true});
 parentPort.on('message',async m=>{if(m.stop){process.exit(0);}const {tx,ty}=m,w=Math.min(TILE,sc.W-tx*TILE),h=Math.min(TILE,sc.H-ty*TILE);
  const buf=renderRect(sc,tx*TILE,ty*TILE,w,h);
  const image=sharp(buf,{raw:{width:w,height:h,channels:4}});if(plan.groundShape!=='isometric')image.removeAlpha();
  await image.clone().webp({quality:90,alphaQuality:100}).toFile(path.join(outDir,'tiles/0',`${tx}_${ty}.webp`));
  // also a lossless copy for full-resolution review exports
  await image.clone().png({compressionLevel:6}).toFile(path.join(outDir,'full',`${tx}_${ty}.png`));
  parentPort.postMessage({done:[tx,ty]});});
}else{
 const args=process.argv.slice(2),planFile=path.resolve(args[0]),opt=k=>{const i=args.indexOf('--'+k);return i>=0?args[i+1]:null;};
 const outDir=path.resolve(args[1]&&!args[1].startsWith('--')?args[1]:path.join(ROOT,'output/town-builder/map'));
 const zoom=+(opt('zoom')||1),nW=+(opt('workers')||Math.max(1,Math.min(8,os.cpus().length-2)));
 const plan=JSON.parse(await fs.readFile(planFile,'utf8'));
 // picture size (same formula as buildScene)
 const SCALE=32*zoom,MARGIN=Math.round(60*zoom),{W,H,OX,OY}=groundFrame(plan,zoom);
 const cols=Math.ceil(W/TILE),rows=Math.ceil(H/TILE);
 await fs.mkdir(path.join(outDir,'tiles/0'),{recursive:true});await fs.mkdir(path.join(outDir,'full'),{recursive:true});
 let todo=[];const only=opt('tiles');
 if(only)todo=only.split(';').map(s=>s.split(',').map(Number));else for(let ty=0;ty<rows;ty++)for(let tx=0;tx<cols;tx++)todo.push([tx,ty]);
 // render centre-out so the interesting part is ready first
 todo.sort((a,b)=>Math.hypot(a[0]-cols/2,a[1]-rows/2)-Math.hypot(b[0]-cols/2,b[1]-rows/2));
 console.log(JSON.stringify({W,H,cols,rows,tiles:todo.length,workers:nW}));
 const t0=Date.now();let done=0;
 await new Promise((resolve,reject)=>{let active=0;
  for(let i=0;i<nW;i++){const wk=new Worker(fileURLToPath(import.meta.url),{workerData:{planFile,zoom,outDir}});active++;
   const next=()=>{const t=todo.shift();if(!t){wk.postMessage({stop:true});return;}wk.postMessage({tx:t[0],ty:t[1]});};
   wk.on('message',m=>{if(m.done){done++;if(done%10===0)console.log(`${done} tiles, ${((Date.now()-t0)/1000).toFixed(0)}s`);}next();});
   wk.on('error',reject);wk.on('exit',()=>{if(--active===0)resolve();});}});
 // zoom pyramid: each level halves the previous one
 let level=0,lc=cols,lr=rows,lw=W,lh=H;const levels=[{level:0,cols,rows,width:W,height:H}];
 while(lc>1||lr>1){const nc=Math.ceil(lc/2),nr=Math.ceil(lr/2),nw=Math.ceil(lw/2),nh=Math.ceil(lh/2);await fs.mkdir(path.join(outDir,'tiles',String(level+1)),{recursive:true});
  for(let ty=0;ty<nr;ty++)for(let tx=0;tx<nc;tx++){const parts=[];
   for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){const sx=tx*2+dx,sy=ty*2+dy;if(sx>=lc||sy>=lr)continue;const f=path.join(outDir,'tiles',String(level),`${sx}_${sy}.webp`);try{await fs.access(f);parts.push({input:f,left:dx*TILE,top:dy*TILE});}catch{}}
   const cw=Math.min(2*TILE,lw-tx*2*TILE),ch=Math.min(2*TILE,lh-ty*2*TILE);if(!parts.length)continue;
   const big=await sharp({create:{width:cw,height:ch,channels:plan.groundShape==='isometric'?4:3,background:plan.groundShape==='isometric'?{r:0,g:0,b:0,alpha:0}:'#2a3324'}}).composite(parts).png().toBuffer();
   await sharp(big).resize(Math.ceil(cw/2),Math.ceil(ch/2),{kernel:'lanczos3'}).webp({quality:90}).toFile(path.join(outDir,'tiles',String(level+1),`${tx}_${ty}.webp`));}
  level++;lc=nc;lr=nr;lw=nw;lh=nh;levels.push({level,cols:lc,rows:lr,width:lw,height:lh});}
 // preview from the level that fits in ~4096 px
 const pv=levels.find(l=>l.width<=4200)||levels[levels.length-1],pparts=[];
 for(let ty=0;ty<pv.rows;ty++)for(let tx=0;tx<pv.cols;tx++)pparts.push({input:path.join(outDir,'tiles',String(pv.level),`${tx}_${ty}.webp`),left:tx*TILE,top:ty*TILE});
 await sharp({create:{width:pv.width,height:pv.height,channels:plan.groundShape==='isometric'?4:3,background:plan.groundShape==='isometric'?{r:0,g:0,b:0,alpha:0}:'#2a3324'}}).composite(pparts).webp({quality:90,alphaQuality:100}).toFile(path.join(outDir,'preview.webp'));
 const manifest={plan:path.basename(planFile),groundPlan:groundState(plan),...(plan.groundShape?{groundShape:plan.groundShape}:{}),width:W,height:H,tileSize:TILE,levels,zoom,pxPerAxisM:SCALE,cellM:20,nx:plan.nx,ny:plan.ny,origin:{ox:OX,oy:OY},bakedAt:new Date().toISOString(),seconds:Math.round((Date.now()-t0)/1000)};
 await fs.writeFile(path.join(outDir,'manifest.json'),JSON.stringify(manifest,null,1));
 console.log('baked',JSON.stringify({W,H,levels:levels.length,seconds:manifest.seconds}));
}
