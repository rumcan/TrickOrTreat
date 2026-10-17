import fs from 'node:fs/promises';
import sharp from 'sharp';
import {arcadeIslands} from '../lib/arcade-alpha.mjs';
// Sprite packing only: retain generated alpha; normalize to the vector canvas,
// footprint-centre anchor and runtime scale recorded in specs.json.
const specs=JSON.parse(await fs.readFile('art/arcade/specs.json','utf8'));
const furniture=specs.filter(s=>s.category==='prop'&&!s.key.includes('wall'));
const src='art/arcade/furniture-atlas.png',info=await sharp(src).metadata();
if(!info.hasAlpha)throw Error('Furniture must have genuine transparent alpha');
const islands=await arcadeIslands(src);
if(islands.components.length!==12)throw Error(`Expected twelve separate silhouettes, found ${islands.components.length}`);
const cells=Array.from({length:12},()=>null);
for(const island of islands.components){
 const col=Math.min(3,Math.floor(((island.x0+island.x1)/2)/info.width*4)),row=Math.min(2,Math.floor(((island.y0+island.y1)/2)/info.height*3));
 const i=row*4+col;if(cells[i])throw Error('Ambiguous atlas object placement');cells[i]=island;
}
await fs.mkdir('public/assets/arcade',{recursive:true});
const manifestPath='public/assets/manifest.json',manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
for(let i=0;i<furniture.length;i++){
 const spec=furniture[i];
 const island=cells[i];if(!island)throw Error(`Missing atlas object ${i}`);
 const pw=island.x1-island.x0+1,ph=island.y1-island.y0+1,pixels=Buffer.alloc(pw*ph*4);
 for(let y=0;y<ph;y++)for(let x=0;x<pw;x++){
  const original=(y+island.y0)*info.width+x+island.x0;
  if(islands.labels[original]===island.id)pixels.set(islands.data.subarray(original*4,original*4+4),(y*pw+x)*4);
 }
 const piece=await sharp(pixels,{raw:{width:pw,height:ph,channels:4}}).png().toBuffer();
 // Keep the whole generated silhouette. Full-width normalization aligns its
 // footprint with the same collision envelope as the vector master.
 const vector=await sharp(`art/arcade/vector/${spec.key}.png`).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let x0=vector.info.width,y0=vector.info.height,x1=0,y1=0;
 for(let py=0;py<vector.info.height;py++)for(let px=0;px<vector.info.width;px++)if(vector.data[(py*vector.info.width+px)*4+3]>64){x0=Math.min(x0,px);y0=Math.min(y0,py);x1=Math.max(x1,px);y1=Math.max(y1,py);}
 const sprite=await sharp(piece).resize(x1-x0+1,y1-y0+1,{fit:'fill'}).png().toBuffer();
 const file=`arcade/${spec.key}.webp`;
 await sharp({create:{width:spec.w*2,height:spec.h*2,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:sprite,left:x0,top:y0}]).webp({quality:90}).toFile(`public/assets/${file}`);
 manifest.overrides[spec.key]={file,scale:2,anchor:spec.anchor.map(v=>v*2)};
}
for(const [source,dest,key]of[['art/arcade/carpet.png','arcade/carpet.webp','arcade_carpet']]){
 try{await sharp(source).resize(512,512).webp({quality:90}).toFile(`public/assets/${dest}`);manifest.overrides[key]={file:dest};}catch(e){if(e.code!=='ENOENT'&&!String(e).includes('missing'))throw e;}
}
for(const spec of specs.filter(s=>s.key.includes('wall'))){
 const source=sharp('art/arcade/wall.png');
 if(spec.footprint[0]<spec.footprint[1])source.flop();
 const piece=await source.trim({background:'#00000000',threshold:8}).png().toBuffer();
 const sprite=await sharp(piece).resize(spec.w*2-32,spec.h*2-40,{fit:'fill'}).png().toBuffer();
 const file=`arcade/${spec.key}.webp`;
 await sharp({create:{width:spec.w*2,height:spec.h*2,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:sprite,left:16,top:16}]).webp({quality:90}).toFile(`public/assets/${file}`);
 manifest.overrides[spec.key]={file,scale:2,anchor:spec.anchor.map(v=>v*2)};
}
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
console.log(`Packed ${furniture.length} illustrated props with matching vector anchors; atlas ${info.width}x${info.height}, alpha retained.`);
