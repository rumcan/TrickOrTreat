import fs from 'node:fs/promises';
import {chromium} from 'playwright-core';
// Quick look at the reference-layout town: builds src/game/town-static.ts in the dev server and saves a small render.
//   node scripts/town-layout-render.mjs [scale=0.25]   -> art/town/static/ground/layout-render.png   (TOWN_URL to override)
const scale=Number(process.argv[2]||.25),url=process.env.TOWN_URL||'http://127.0.0.1:5192/';
const browser=await chromium.launch({channel:'msedge'});
try{
 const page=await browser.newPage();
 await page.goto(url);
 await page.getByRole('button',{name:'Go trick-or-treating',exact:true}).waitFor({timeout:120000});
 const result=await page.evaluate(async scale=>{
  try{
   const source=await(await fetch('/src/game/town-static.ts')).text();
   const artURL=source.match(/from\s*["']([^"']*\/art\/town-static\.ts[^"']*)["']/)?.[1]||'/src/game/art/town-static.ts';
   const {loadStaticTownArt}=await import(artURL);await loadStaticTownArt();
   const {buildStaticTown}=await import('/src/game/town-static.ts');
   const {townOverview}=await import('/src/game/town-overview.ts');
   const {map,audit}=buildStaticTown();
   return {audit,data:townOverview(map,{scale}).canvas.toDataURL('image/png')};
  }catch(error){return {error:String(error?.stack||error)};}
 },scale);
 if(result.error){console.error(result.error);process.exitCode=1;}
 else{
  await fs.writeFile('art/town/static/ground/layout-render.png',Buffer.from(result.data.split(',')[1],'base64'));
  console.log(JSON.stringify(result.audit,null,1));
 }
}finally{await browser.close();}
