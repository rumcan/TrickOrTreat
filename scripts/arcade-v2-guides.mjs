import fs from 'node:fs/promises';
import sharp from 'sharp';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({channel:'msedge'});
let records;
try{
 const page=await browser.newPage();await page.goto(process.env.TOT_ARCADE_URL||'http://127.0.0.1:5190/');
 records=await page.evaluate(async()=>{
  const {ARCADE_ART_KINDS,getArcadeFixture,getArcadeFloor}=await import('/src/game/art/arcade.ts');
  const {CLUTTER_KINDS}=await import('/src/game/arcade-clutter.ts');
  const {getArcadeClutter}=await import('/src/game/art/arcade-clutter.ts');
  const {withArtScale}=await import('/src/game/art/draw.ts');const {allAssets}=await import('/src/game/assets.ts');
  ARCADE_ART_KINDS.forEach(k=>getArcadeFixture(k));getArcadeFixture('wall',.15,7.5);getArcadeFloor();CLUTTER_KINDS.forEach(getArcadeClutter);
  return allAssets().filter(a=>a.spec.key.startsWith('arcade_v2_')).map(a=>({spec:a.spec,png:withArtScale(2,()=>a.gen()).toDataURL().split(',')[1]}));
 });
}finally{await browser.close();}
await fs.mkdir('art/arcade/v2/guides',{recursive:true});await fs.mkdir('art/arcade/v2/vector',{recursive:true});
const specs=[];
for(const {spec,png}of records){
 const input=Buffer.from(png,'base64');await fs.writeFile(`art/arcade/v2/vector/${spec.key}.png`,input);
 const meta=await sharp(input).metadata(),scale=Math.min(896/meta.width,896/meta.height);
 const width=Math.round(meta.width*scale),height=Math.round(meta.height*scale),left=Math.floor((1024-width)/2),top=Math.floor((1024-height)/2);
 const vector=await sharp(input).resize(width,height).png().toBuffer();
 await sharp({create:{width:1024,height:1024,channels:4,background:'#00000000'}}).composite([{input:vector,left,top}]).png().toFile(`art/arcade/v2/guides/${spec.key}.png`);
 specs.push({...spec,guide:{left,top,width,height,scale},pixelWidth:meta.width,pixelHeight:meta.height});
}
await fs.writeFile('art/arcade/v2/specs.json',JSON.stringify(specs,null,2)+'\n');console.log(`Exported ${specs.length} individual projection-correct guides, each 1024 square with recorded inverse transform.`);
