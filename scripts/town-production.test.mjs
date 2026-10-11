import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import {chromium} from 'playwright-core';
const report=JSON.parse(await fs.readFile('art/town/packing-report.json','utf8'));
const manifest=JSON.parse(await fs.readFile('dist/assets/manifest.json','utf8'));
let pngBytes=0,releaseBytes=0,decodedBytes=0;
for(const r of report){
 const m=manifest.overrides['town_'+r.id];
 assert.ok(m.file.startsWith('town/')&&m.file.endsWith('.webp'));
 assert.equal(m.scale,r.scale);assert.deepEqual(m.anchor,r.anchor);
 const meta=await sharp('dist/assets/'+m.file).metadata();
 assert.equal(meta.width,r.w);assert.equal(meta.height,r.h);assert.ok(meta.hasAlpha);
 pngBytes+=(await fs.stat('public/assets/'+r.file)).size;
 releaseBytes+=(await fs.stat('dist/assets/'+m.file)).size;
 decodedBytes+=r.w*r.h*4;
}
const browser=await chromium.launch({channel:'msedge'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[],loaded=new Set();page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.ok())loaded.add(new URL(r.url()).pathname);});
 page.on('console',m=>{if(m.text().includes('[assets]'))errors.push(m.text());});
 await page.goto(process.env.TOWN_RELEASE_URL||'http://127.0.0.1:5193/');
 await page.getByRole('button',{name:'Go trick-or-treating'}).waitFor({timeout:120000});
 const fetched=[...loaded].filter(r=>r.includes('/assets/town/')&&r.endsWith('.webp')).length;
 assert.equal(fetched,35,'Release loads every new painted asset');
 await page.getByRole('button',{name:'Go trick-or-treating'}).click();
 await page.getByText('Ring doorbells',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>typeof window.__tot),'undefined','No debug globals in release');
 assert.deepEqual(errors,[]);
 const result={paintedAssets:fetched,gameplayStarted:true,pngBytes,releaseBytes,decodedBytes,errors};
 await fs.writeFile('art/town/checks/production-report.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
}finally{await browser.close();}
