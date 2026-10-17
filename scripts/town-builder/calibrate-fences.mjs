/** Calibrate post coordinates, not visual guesses. Does not edit any painted sprite or owner placement. */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {ROOT,artDir} from '../lib/town-scene.mjs';
import {fencePlan,fenceSvg} from './app/fence-projection.js';
const LIB=path.join(ROOT,'output/town-builder/library'),file=path.join(LIB,'library.json');
const lib=JSON.parse(await fs.readFile(file,'utf8')),report=[];
for(const it of lib.items){
 let axis,lengthM;
 if(/^world:fence_.*_[xy]$/.test(it.id)){axis=it.id.at(-1);lengthM=2;}
 else if(/^gen:fence-/.test(it.id)){axis=it.id==='gen:fence-chainlink'?'y':'x';lengthM=it.id==='gen:fence-picket-gate'?6:8;}
 else if(it.id.startsWith('expansion:')&&it.category==='Correct-angle fences'&&/[xy]$/.test(it.id)){axis=it.id.at(-1);lengthM=axis==='x'?it.physicalMetres.width:it.physicalMetres.depth;}
 else continue;
 const {data,info}=await sharp(path.join(LIB,it.file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const cols=[];let x0=info.width,x1=-1;
 for(let x=0;x<info.width;x++){let start=-1,best={x,top:0,bottom:0,len:0};
  for(let y=0;y<=info.height;y++){const on=y<info.height&&data[(y*info.width+x)*4+3]>110;if(on){x0=Math.min(x0,x);x1=Math.max(x1,x);if(start<0)start=y;}
   else if(start>=0){if(y-start>best.len)best={x,top:start,bottom:y-1,len:y-start};start=-1;}}
  cols.push(best);
 }
 const post=(low,high)=>{
  const region=cols.filter(c=>c.x>=low&&c.x<=high),best=Math.max(...region.map(c=>c.len));
  const candidates=region.filter(c=>c.len>=best*.97),p=candidates[Math.floor(candidates.length/2)];
  if(!p||best<4)throw Error('No reliable end post: '+it.id);return {x:p.x,top:p.top,bottom:p.bottom};
 };
 const left=post(x0,x0+(x1-x0)*.14),right=post(x1-(x1-x0)*.14,x1);
 const original=it.fence?.original||{w:it.w,h:it.h,ax:it.ax,ay:it.ay};
 const heightM=it.id.startsWith('expansion:')?it.physicalMetres.height:it.id.startsWith('world:')?(it.id.includes('picket')?.8:1.3):it.id.includes('split-rail')?1.1:it.id.includes('picket')?1.2:1.8;
 const plan={...fencePlan({width:info.width,height:info.height,left,right,axis,lengthM,heightM}),original};
 it.fence=plan;it.w=plan.w;it.h=plan.h;it.ax=plan.ax/plan.ratio;it.ay=plan.ay/plan.ratio;
 it.fw=axis==='x'?lengthM/2:.08;it.fh=axis==='y'?lengthM/2:.08;
 it.physicalMetres={...(it.physicalMetres||{}),width:it.fw*2,depth:it.fh*2,height:heightM};
 delete it.shadow;delete it.base;
  report.push({id:it.id,axis,lengthM,heightM,left,right,sourceSlope:plan.sourceSlope,correctedSlope:plan.sign/2,sourceW:info.width,sourceH:info.height});
}
await fs.mkdir(path.join(LIB,'backups'),{recursive:true});await fs.copyFile(file,path.join(LIB,'backups','library-before-fence-projection-'+Date.now()+'.json'));
const pending=file+'.fence-pending';await fs.writeFile(pending,JSON.stringify(lib,null,1));await fs.rename(pending,file);
await fs.writeFile(path.join(artDir('expansion-1988/fence-calibration.json')),JSON.stringify(report,null,2));
const {ensureShadows}=await import('./shadows.mjs');await ensureShadows();
console.log(JSON.stringify({fences:report.length,placementsChanged:false,reportFile:path.join(artDir('expansion-1988/fence-calibration.json'))}));
if(process.argv.includes('--verbose'))console.log(JSON.stringify(report));
