/** Native art gate. Does not bake or replace the live game's terrain. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {ROOT} from '../../lib/town-paths.mjs';

const out=path.join(ROOT,'output/road-autotile-v3');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const approvedBendSHA='7b293c3b1fdd9ff004e85e06c74df8556bda67d832cbb492f995e51539808264';
const ids=['reflection-extracted','painted-10','painted-3','painted-10-sidewalk-light'];
const sources={},receipts=[];
await fs.mkdir(path.join(out,'review'),{recursive:true});
for(const id of ids){
 const file=path.join(out,'native',id+'.png'),bytes=await fs.readFile(file);
 const receipt=JSON.parse(await fs.readFile(path.join(out,'native',id+'.json'),'utf8'));
 const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.equal(hash(bytes),receipt.sha,'Native source changed: '+id);
 assert.equal(info.width,receipt.width);assert.equal(info.height,receipt.height);assert.equal(info.channels,4);
 for(const r of receipt.referenceHashes)assert.equal(hash(await fs.readFile(r.file)),r.sha,'Reference changed: '+r.file);
 const corners=[0,info.width-1,(info.height-1)*info.width,info.width*info.height-1];
 for(const p of corners)assert.equal(data[p*4+3],0,'Background is not transparent: '+id);
 if(id!=='reflection-extracted'){assert.equal(info.width,1254);assert.equal(info.height,1254);}
 sources[id]={file,bytes,data,...info};
 receipts.push({id,width:info.width,height:info.height,sha:receipt.sha,hasAlpha:true});
}
assert.equal(hash(sources['painted-3'].bytes),approvedBendSHA,'Owner-approved bend must remain unchanged');

function swatch(img,x,y){
 const rgb=[0,0,0];let count=0;
 for(let yy=y-3;yy<=y+3;yy++)for(let xx=x-3;xx<=x+3;xx++){
  const o=(yy*img.width+xx)*4;if(img.data[o+3]<200)continue;
  for(let k=0;k<3;k++)rgb[k]+=img.data[o+k];count++;
 }
 assert.ok(count>30,'Swatch misses the painted surface');return rgb.map(v=>Math.round(v/count));
}
const straight=sources['painted-10-sidewalk-light'],bend=sources['painted-3'];
const measurements={
 straight:{unlitSidewalk:swatch(straight,480,392),litSidewalk:swatch(straight,670,505),unlitRoad:swatch(straight,430,488),litRoad:swatch(straight,600,578)},
 bend:{litSidewalk:swatch(bend,867,530),unlitRoad:swatch(bend,500,480),litRoad:swatch(bend,765,580),darkCrackWithinLight:swatch(bend,790,610)}
};
const s=measurements.straight;
assert.ok(s.litSidewalk[0]>s.unlitSidewalk[0]+25,'Missing localized sidewalk light');
assert.ok(s.litSidewalk[2]<s.unlitSidewalk[2]-15,'Sidewalk light is not warm relative to beige');
assert.ok(s.litRoad[0]>s.unlitRoad[0]+100,'Missing broken amber road reflection');
assert.ok(measurements.bend.litRoad[0]>measurements.bend.unlitRoad[0]+100);
assert.ok(measurements.bend.darkCrackWithinLight[0]<measurements.bend.litRoad[0]-80,'Dark fissures disappeared inside the reflection');

const background='#182529',width=2508,height=2616,labelHeight=54;
const label=(text,w=1254)=>Buffer.from(`<svg width="${w}" height="54"><rect width="${w}" height="54" fill="#101b20"/><text x="24" y="35" fill="#eee7d8" font-family="sans-serif" font-size="24">${text}</text></svg>`);
const layers=[];
for(const [id,left,top,title]of [
 ['painted-10',0,0,'Previous straight: warm material across the slabs'],
 ['painted-10-sidewalk-light',1254,0,'Corrected straight: beige + localized pavement light'],
 ['painted-3',0,1308,'Approved bend: unchanged native master']
]){
 layers.push({input:label(title),left,top},{input:await sharp(sources[id].bytes).flatten({background}).png().toBuffer(),left,top:top+labelHeight});
}
layers.push({input:label('Native detail: road + curb + sidewalk from ONE lamp'),left:1254,top:1308});
const detail=await sharp(straight.bytes).extract({left:430,top:395,width:480,height:330}).flatten({background}).png().toBuffer();
layers.push({input:detail,left:1254+32,top:1308+82});
layers.push({input:label('No orange shading repeated on every slab'),left:1254,top:1308+470});
const unlit=await sharp(straight.bytes).extract({left:280,top:530,width:540,height:350}).flatten({background}).png().toBuffer();
layers.push({input:unlit,left:1254+32,top:1308+550});
await sharp({create:{width,height,channels:4,background}}).composite(layers).png().toFile(path.join(out,'review/sidewalk-lighting-comparison.png'));
await sharp(straight.bytes).flatten({background}).png().toFile(path.join(out,'review/straight-sidewalk-light.png'));
await sharp(bend.bytes).flatten({background}).png().toFile(path.join(out,'review/approved-bend.png'));
const report={
 pass:true,dateUTC:new Date().toISOString(),scope:'Native reference-derived art masters, NOT production connector or mobile-game approval',
 builtInImagegen:true,receipts,approvedBendUnchanged:true,measurements,
 lighting:'One custom painted lamp lights its own registered asphalt, curb AND sidewalk. Unlit straight slabs are beige. No independently shifted sidewalk patch.',
 comparison:{file:'review/sidewalk-lighting-comparison.png',width,height,sourcePixelsEnlarged:false},
 outstanding:['Owner review of the corrected straight','Exact socket registration and shared connector collars for these AI masters','Registered on/off light layers in the module baker','Other axis, remaining bends and junctions','Scale and actual game/mobile proof'],
 gameplayChanged:false,merged:false,published:false
};
await fs.writeFile(path.join(out,'review/reference-art-validation.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({pass:report.pass,approvedBendUnchanged:true,measurements,comparison:path.join(out,report.comparison.file),outstanding:report.outstanding}));
