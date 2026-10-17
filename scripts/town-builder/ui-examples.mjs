/** Regenerate the small UI examples without touching the owner's map or plan. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {loadSources,buildScene,renderRect} from '../lib/town-scene.mjs';
const out=path.join(path.dirname(fileURLToPath(import.meta.url)),'app/examples');
await fs.mkdir(out,{recursive:true});
const source=await loadSources(.36);
async function example(name,surface,border='none',patch=false){
 const area={id:'example',x0:20,y0:20,x1:40,y1:36,surface,border};
 const plan={nx:3,ny:3,roads:[],lots:patch?[]:[area],paving:patch?[area]:[],reflections:[]};
 const sc=buildScene(plan,source),[x,y]=sc.toScreen(30,28),w=460,h=260;
 const buf=renderRect(sc,Math.round(x-w/2),Math.round(y-h/2),w,h);
 await sharp(buf,{raw:{width:w,height:h,channels:4}}).resize(320,180).webp({quality:88}).toFile(path.join(out,name+'.webp'));
 console.log('Rendered '+name);
}
for(const surface of ['asphalt','slab','dirt','field'])await example(surface,surface,surface==='asphalt'||surface==='slab'?'ring':'none');
await example('paving','slab','none',true);
for(const surface of ['asphalt','slab','dirt','field'])for(const border of ['ring','curb','none'])await example('edge-'+surface+'-'+border,surface,border);
for(const border of ['curb','none'])await example('paving-'+border,'slab',border,true);
for(const glow of [false,true]){
 const sc=buildScene({nx:3,ny:3,roads:['0,1','1,1','2,1'],lots:[],paving:[],reflections:glow?[{x:30,y:30,free:true,strength:1,scale:1}]:[]},source);
 const [x,y]=sc.toScreen(30,30),w=460,h=260,buf=renderRect(sc,Math.round(x-w/2),Math.round(y-h/2),w,h);
 await sharp(buf,{raw:{width:w,height:h,channels:4}}).resize(320,180).webp({quality:88}).toFile(path.join(out,(glow?'glow':'road')+'.webp'));
}
