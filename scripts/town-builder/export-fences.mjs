/** Export corrected fence art and pixel anchors together. Painted source images remain untouched. */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {ROOT,artSource,artDir} from '../lib/town-scene.mjs';
import {fencePlan,fenceSvg,fencePoint} from './app/fence-projection.js';
import assert from 'node:assert/strict';
const LIB=path.join(ROOT,'output/town-builder/library'),ART=path.join(artDir('expansion-1988'));
const library=JSON.parse(await fs.readFile(path.join(LIB,'library.json'),'utf8'));
const dir=path.join(ART,'projected-fences');await fs.mkdir(dir,{recursive:true});
const records=[];
for(const it of library.items.filter(i=>i.fence)){
 const p=it.fence,ratio=8;
 let source=path.join(LIB,it.file);
 if(it.id.startsWith('expansion:')&&it.source){const candidate=artSource(it.source);try{await fs.access(candidate);source=candidate;}catch{}}
 const data=await fs.readFile(source),meta=await sharp(data).metadata();
 const sx=meta.width/p.width,sy=meta.height/p.height,point=q=>({x:q.x*sx,top:q.top*sy,bottom:q.bottom*sy});
 const plan=fencePlan({width:meta.width,height:meta.height,left:point(p.left),right:point(p.right),axis:p.axis,lengthM:p.lengthM,heightM:p.heightM,ratio});
 const left=fencePoint(plan,plan.left.x,plan.left.bottom),right=fencePoint(plan,plan.right.x,plan.right.bottom);
 assert.ok(Math.abs((right.y-left.y)/(right.x-left.x)-plan.sign*.5)<1e-8);
 const filename=it.id.replace(':','-')+'.png';
 await sharp(Buffer.from(fenceSvg(plan,'data:image/'+meta.format+';base64,'+data.toString('base64')))).png().toFile(path.join(dir,filename));
 records.push({id:it.id,file:filename,axis:plan.axis,lengthM:plan.lengthM,heightM:plan.heightM,pixelsPerAxisMetre:32*ratio,width:plan.canvasW,height:plan.canvasH,anchor:{x:plan.ax,y:plan.ay},endPosts:{left,right},logicalFrame:{width:plan.w,height:plan.h,anchorX:plan.ax/ratio,anchorY:plan.ay/ratio}});
}
await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify({projection:'2:1 orthographic ground axes +/-0.5',textureScale:8,items:records},null,2));
console.log(JSON.stringify({exported:records.length,dir}));
