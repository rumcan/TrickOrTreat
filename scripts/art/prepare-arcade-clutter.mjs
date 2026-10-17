import fs from 'node:fs/promises';
import sharp from 'sharp';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({channel:'msedge'});
let specs;
try{
 const page=await browser.newPage();await page.goto(process.env.TOT_ARCADE_URL||'http://127.0.0.1:5190/');
 specs=await page.evaluate(async()=>{
  const {CLUTTER_KINDS}=await import('/src/game/arcade-clutter.ts');
  const {getArcadeClutter}=await import('/src/game/art/arcade-clutter.ts');
  const {allAssets}=await import('/src/game/assets.ts');
  const {withArtScale}=await import('/src/game/art/draw.ts');
  CLUTTER_KINDS.forEach(getArcadeClutter);
  return CLUTTER_KINDS.map(kind=>{const a=allAssets().find(a=>a.spec.key===`arcade_clutter_${kind}`);return {...a.spec,vector:withArtScale(2,()=>a.gen()).toDataURL().split(',')[1]};});
 });
}finally{await browser.close();}
const source=sharp('art/arcade/clutter-atlas.png'),info=await source.metadata();
assertAlpha(info);
const manifest=JSON.parse(await fs.readFile('public/assets/manifest.json','utf8'));
for(let i=0;i<specs.length;i++){
 const spec=specs[i],col=i%4,row=Math.floor(i/4);
 // The generated top row contains tall displays; verified row gaps are not
 // equal thirds. Crop the actual transparent gaps, preserving full silhouettes.
 const rows=[0,.435,.775,1];
 const x0=Math.round(col*info.width/4),x1=Math.round((col+1)*info.width/4),y0=Math.round(rows[row]*info.height),y1=Math.round(rows[row+1]*info.height);
 const crop=await source.clone().extract({left:x0,top:y0,width:x1-x0,height:y1-y0}).png().toBuffer();
 const piece=await sharp(crop).trim({background:'#00000000',threshold:8}).png().toBuffer();
 // Preserve aspect ratio and fit the entire silhouette inside the exact footprint.
 const floor=spec.category==='overlay';
 const sprite=await sharp(piece).resize(floor?128:spec.w*2-32,floor?70:spec.h*2-40,{fit:'contain',background:'#00000000'}).png().toBuffer();
 await sharp({create:{width:spec.w*2,height:spec.h*2,channels:4,background:'#00000000'}}).composite([{input:sprite,left:floor?64:16,top:floor?29:16}]).webp({quality:90}).toFile(`public/assets/${spec.file}`);
 manifest.overrides[spec.key]={file:spec.file,scale:2,anchor:spec.anchor.map(v=>v*2)};
 await fs.writeFile(`art/arcade/vector/${spec.key}.png`,Buffer.from(spec.vector,'base64'));delete spec.vector;
}
await fs.writeFile('art/arcade/clutter-specs.json',JSON.stringify(specs,null,2)+'\n');
await fs.writeFile('public/assets/manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log(`Packed ${specs.length} reference-matched clutter sprites.`);
function assertAlpha(info){if(!info.hasAlpha)throw Error('Clutter needs genuine alpha');}
