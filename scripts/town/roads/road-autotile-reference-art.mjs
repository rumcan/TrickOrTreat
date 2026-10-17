/** Reference-first edits. Each stage has a saved prompt, immutable native PNG and receipt. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import {ROAD,project,unproject,mod,kind} from '../../lib/road-autotile.mjs';
import {field} from '../../lib/road-autotile-quality.mjs';
import {ROOT} from '../../lib/town-paths.mjs';
const out=path.join(ROOT,'output/road-autotile-v3'),old=path.resolve(out,'../road-autotile-v1');
const [mode,id,file]=process.argv.slice(2),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
if(mode==='prepare'){
 for(const d of ['native','jobs','sources','guides','review','tiles'])await fs.mkdir(path.join(out,d),{recursive:true});
 await fs.copyFile(path.join(old,'sources/reference.png'),path.join(out,'sources/reference.png'));
 // Literal local crop; imagegen is never asked to divide the reference into pieces.
 await sharp(path.join(out,'sources/reference.png')).extract({left:30,top:345,width:360,height:470}).png().toFile(path.join(out,'sources/reference-bend-crop.png'));
 console.log(out);
}else if(mode==='ingest'){
 if(!id||!/^[a-z0-9-]+$/.test(id)||!file||file==='undefined')throw Error('ingest requires a safe asset id and an existing native PNG path');
 const job=JSON.parse(await fs.readFile(path.join(out,'jobs',id+'.json'),'utf8'));
 const m=await sharp(file).metadata();if(m.format!=='png'||!m.hasAlpha)throw Error('Native art must be a transparent PNG');
 const dst=path.join(out,'native',id+'.png');await fs.copyFile(file,dst,fs.constants.COPYFILE_EXCL);
 const references=[];for(const f of job.refs||[])references.push({file:f,sha:sha(await fs.readFile(f))});
 await fs.writeFile(path.join(out,'native',id+'.json'),JSON.stringify({...job,sourceTool:'built-in imagegen',sourceFile:file,width:m.width,height:m.height,hasAlpha:m.hasAlpha,sha:sha(await fs.readFile(dst)),referenceHashes:references,review:'pending'},null,2));
 console.log(JSON.stringify({id,dst,width:m.width,height:m.height,hasAlpha:m.hasAlpha}));
}else if(mode==='guides'){
 const {data,info}=await sharp(path.join(old,'native/material-master.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const sample=(x,y)=>{const o=(Math.floor(y)*info.width+Math.floor(x))*4;return [...data.subarray(o,o+3)];};
 for(const mask of [3,5,6,7,9,10,11,12,13,14,15]){
  const b=Buffer.alloc(ROAD.width*ROAD.height*4);
  for(let py=0;py<ROAD.height;py++)for(let px=0;px<ROAD.width;px++){
   const p=unproject(px+.5,py+.5);if(p.x<0||p.y<0||p.x>=16||p.y>=16)continue;
   const v=field(mask,p.x,p.y);if(v.type==='grass')continue;const o=(py*ROAD.width+px)*4;
   // Literal approved pixels, for guide colour only. The AI must refine from
   // the full original and extracted reflection, NOT invent fine aggregate.
   let c;if(v.type==='asphalt')c=sample(578+mod(p.x,4)/4*100,1092+mod(p.y,4)/4*135);
   else c=sample(694+mod(v.roadDistance,.8)/.8*24,1135+mod(Math.abs(v.tx)>.5?p.x:p.y,2)/2*105);
   for(let k=0;k<3;k++)b[o+k]=c[k];b[o+3]=255;
  }
  await sharp(b,{raw:{width:ROAD.width,height:ROAD.height,channels:4}}).extend({top:371,bottom:371,left:115,right:115,background:{r:0,g:0,b:0,alpha:0}}).png().toFile(path.join(out,'guides',`mask-${mask}.png`));
 }
 console.log('Saved 11 geometry guides using ONLY approved reference colours');
}else throw Error('prepare | ingest <id> <nativePNG> | guides');
