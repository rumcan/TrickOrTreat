import fs from 'node:fs/promises';
import sharp from 'sharp';
import {chromium} from 'playwright-core';
const folder='art/arcade/staff';await fs.mkdir(folder,{recursive:true});
if(process.argv[2]==='export'){
 const browser=await chromium.launch({channel:'msedge'});let records;
 try{const page=await browser.newPage();await page.goto('http://127.0.0.1:5190/');records=await page.evaluate(async()=>{
  const {arcadeStaffSheet}=await import('/src/game/art/arcade-staff.ts');const {allAssets}=await import('/src/game/assets.ts');const {withArtScale}=await import('/src/game/art/draw.ts');
  arcadeStaffSheet(3);arcadeStaffSheet(4);return allAssets().filter(a=>a.spec.key.startsWith('arcade_staff_')).map(a=>({key:a.spec.key,png:withArtScale(4,()=>a.gen()).toDataURL().split(',')[1]}));
 });}finally{await browser.close();}
 for(const r of records){const source=Buffer.from(r.png,'base64'),pieces=[];await fs.writeFile(`${folder}/${r.key}-vector.png`,source);
  for(let i=0;i<4;i++)pieces.push({input:await sharp(source).extract({left:i*384,top:0,width:384,height:512}).png().toBuffer(),left:64+(i%2)*512,top:Math.floor(i/2)*512});
  await sharp({create:{width:1024,height:1024,channels:4,background:'#00000000'}}).composite(pieces).png().toFile(`${folder}/${r.key}-guide.png`);
 }console.log('Exported two anchored 2x2 guides, four idle frames each.');
}else if(process.argv[2]==='pack'){
 const manifest=JSON.parse(await fs.readFile('public/assets/manifest.json','utf8'));await fs.mkdir('public/assets/arcade/staff',{recursive:true});
 for(const name of ['maya','leo']){const source=await sharp(`${folder}/arcade_staff_${name}-generated.png`).resize(1024,1024).png().toBuffer(),pieces=[];
  for(let i=0;i<4;i++)pieces.push({input:await sharp(source).extract({left:64+(i%2)*512,top:Math.floor(i/2)*512,width:384,height:512}).resize(192,256).png().toBuffer(),left:i*192,top:0});
  await sharp({create:{width:768,height:256,channels:4,background:'#00000000'}}).composite(pieces).webp({quality:92}).toFile(`public/assets/arcade/staff/${name}.webp`);
  manifest.overrides[`arcade_staff_${name}`]={file:`arcade/staff/${name}.webp`,scale:2,frames:4,anchor:[96,224]};
 }await fs.writeFile('public/assets/manifest.json',JSON.stringify(manifest,null,2)+'\n');console.log('Packed Maya and Leo four-frame idle sheets without object-bounds fitting.');
}else throw Error('Use export or pack');
