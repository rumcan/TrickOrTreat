/** Live ground preview for the town builder: renders one rectangle of the finished ground (full map resolution) with
 *  the same code Rebuild ground uses (scripts/lib/town-scene.mjs), so a Light glow edit can be seen in a couple of
 *  seconds without re-baking the whole town. A few worker threads each load the painted sources once, rebuild the
 *  scene only when the plan changes, and render a horizontal strip of the rectangle; the strips come back as one
 *  WebP. Nothing is written to the map: the builder lays the patch over its tiles until the next Rebuild ground. */
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {fileURLToPath} from 'node:url';
import os from 'node:os';
import sharp from 'sharp';

if(!isMainThread){
 const {loadSources,buildScene,renderRect}=await import('../lib/town-scene.mjs');
 const S=await loadSources(workerData.zoom||1);let rev=null,sc=null;
 parentPort.postMessage({ready:true});
 parentPort.on('message',m=>{try{
  if(m.rev!==rev){sc=buildScene(JSON.parse(m.plan),S);rev=m.rev;}
  const buf=renderRect(sc,m.x,m.y,m.w,m.h);parentPort.postMessage({id:m.id,buf});
 }catch(e){parentPort.postMessage({id:m.id,error:e.message});}});
}

const HERE=fileURLToPath(import.meta.url);
/** the most a single preview may cover (full-resolution map pixels); bigger asks are refused */
export const PREVIEW_MAX=2400*1400;

export class GroundPreview{
 constructor(n=Math.max(2,Math.min(4,os.cpus().length-2))){this.n=n;this.pool=null;this.seq=0;this.wait=new Map();this.queue=Promise.resolve();}
 start(){if(this.pool)return this.pool;
  this.pool=Promise.all([...Array(this.n)].map(()=>new Promise((ok,bad)=>{const w=new Worker(HERE,{workerData:{zoom:1}});
   w.on('message',m=>{if(m.ready){ok(w);return;}const p=this.wait.get(m.id);if(!p)return;this.wait.delete(m.id);m.error?p.bad(Error(m.error)):p.ok(m.buf);});
   w.on('error',e=>{bad(e);for(const p of this.wait.values())p.bad(e);this.wait.clear();this.pool=null;});w.unref();})));
  return this.pool;}
 job(w,msg){const id=++this.seq;return new Promise((ok,bad)=>{this.wait.set(id,{ok,bad});w.postMessage({...msg,id});});}
 /** render map rectangle x,y,w,h of `plan` (its JSON text; rev changes whenever it does) to a WebP buffer */
 render(planText,rev,x,y,w,h){
  const run=async()=>{const pool=await this.start();const strips=[],step=Math.ceil(h/pool.length);
   for(let k=0;k<pool.length;k++){const sy=y+k*step,sh=Math.min(step,y+h-sy);if(sh<=0)continue;strips.push(this.job(pool[k],{plan:planText,rev,x,y:sy,w,h:sh}).then(buf=>({buf,top:sy-y,h:sh})));}
   const parts=await Promise.all(strips),all=Buffer.alloc(w*h*4);
   for(const p of parts)Buffer.from(p.buf.buffer,p.buf.byteOffset,p.buf.byteLength).copy(all,p.top*w*4);
   return sharp(all,{raw:{width:w,height:h,channels:4}}).removeAlpha().webp({quality:92}).toBuffer();};
  // one preview at a time: the workers share the scene
  const r=this.queue.then(run,run);this.queue=r.catch(()=>{});return r;}
}
