/** Alpha-aware diagnostic contact sheets, not edits to production/native sprites. */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {ROOT,artDir} from '../lib/town-scene.mjs';
import {expansion} from './expansion-specs.mjs';
const out=path.join(ROOT,'output/town-builder/expansion-review');await fs.mkdir(out,{recursive:true});
const requested=process.argv.slice(2),assets=expansion.filter(a=>!requested.length||requested.includes(a.id));
const CW=400,CH=320,COLS=3,chunk=12;
for(let start=0;start<assets.length;start+=chunk){
 const batch=assets.slice(start,start+chunk),layers=[];
 for(let j=0;j<batch.length;j++){
  const a=batch[j],file=path.join(artDir('expansion-1988/native'),a.id+'.png');
  try{await fs.access(file);}catch{continue;}
  const x=(j%COLS)*CW,y=Math.floor(j/COLS)*CH;
  const card=await sharp(file).resize(CW-24,CH-52,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();
  layers.push({input:card,left:x+12,top:y+8});
  const name=a.name.replace(/&/g,'&amp;').replace(/</g,'&lt;');
  layers.push({input:Buffer.from('<svg width="400" height="38"><text x="12" y="18" fill="#ebcf97" font-family="Arial" font-size="14">'+name+'</text><text x="12" y="35" fill="#829b90" font-family="Arial" font-size="11">'+a.w+' x '+a.d+' m / '+(a.flat?'walkable decal':'upright')+'</text></svg>'),left:x,top:y+CH-40});
 }
 const file=path.join(out,'review-'+(1+start/chunk)+'.png');
 await sharp({create:{width:COLS*CW,height:Math.ceil(batch.length/COLS)*CH,channels:4,background:'#26342e'}}).composite(layers).png().toFile(file);
 console.log(file);
}
