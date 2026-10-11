import fs from 'node:fs/promises';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({channel:'msedge'});
try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:5173/');
 const assets=await page.evaluate(async()=>{
  const {ARCADE_ART_KINDS,getArcadeFixture}=await import('/src/game/art/arcade.ts');
  const {allAssets}=await import('/src/game/assets.ts');
  const {withArtScale}=await import('/src/game/art/draw.ts');
  ARCADE_ART_KINDS.forEach(k=>getArcadeFixture(k));getArcadeFixture('wall',.75,7.5);
  return allAssets().filter(a=>a.spec.key.startsWith('arcade_')).map(a=>({spec:a.spec,data:withArtScale(2,()=>a.gen()).toDataURL().split(',')[1]}));
 });
 await fs.mkdir('art/arcade/vector',{recursive:true});
 for(const a of assets)await fs.writeFile(`art/arcade/vector/${a.spec.key}.png`,Buffer.from(a.data,'base64'));
 await fs.writeFile('art/arcade/specs.json',JSON.stringify(assets.map(a=>a.spec),null,2)+'\n');
 console.log(`Exported ${assets.length} vector masters and exact anchor/footprint specs.`);
}finally{await browser.close();}
