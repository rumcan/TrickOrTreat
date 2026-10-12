import fs from 'node:fs/promises';
import sharp from 'sharp';
import {chromium} from 'playwright-core';
const url=process.env.TOWN_URL||'http://127.0.0.1:5192/';
const arg=name=>process.argv.find(a=>a.startsWith('--'+name+'='))?.split('=')[1];
const seed=Number(arg('seed')??1337),scale=Number(arg('scale')??1);
if(!Number.isSafeInteger(seed))throw Error('Seed must be an integer');
if(!Number.isFinite(scale)||scale<.1||scale>1)throw Error('Scale must be between 0.1 and 1');
const expanded=!process.argv.includes('--free'),mode=expanded?'full':'free';
const out='art/town/review',filename='maple-falls-'+mode;
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge'});
try{
 const page=await browser.newPage({viewport:{width:1200,height:800}});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.text().includes('[assets]'))errors.push(m.text());});
 await page.goto(url);
 await page.getByRole('button',{name:'Go trick-or-treating'}).waitFor({timeout:120000});
 const download=page.waitForEvent('download',{timeout:120000});
 const meta=await page.evaluate(async({seed,scale,expanded,filename})=>{
  const {buildMap}=await import('/src/game/map.ts');
  const {townOverview}=await import('/src/game/town-overview.ts');
  const {allAssets}=await import('/src/game/assets.ts');
  const map=buildMap(seed,expanded);
  const before=map.props.map(p=>[p.id,p.removed,p.fade]),collision=Array.from(map.coll),gates=map.gates.map(g=>g.opened);
  const result=townOverview(map,{scale,hideBarriers:true});
  if(JSON.stringify(before)!==JSON.stringify(map.props.map(p=>[p.id,p.removed,p.fade])))throw Error('Export mutated props');
  if(JSON.stringify(collision)!==JSON.stringify(Array.from(map.coll)))throw Error('Export mutated collision');
  if(JSON.stringify(gates)!==JSON.stringify(map.gates.map(g=>g.opened)))throw Error('Export mutated gates');
  const assets=allAssets().filter(e=>e.spec.key.startsWith('town_'));
  if(assets.some(e=>!e.file))throw Error('Missing painted town art');
  const blob=await new Promise(resolve=>result.canvas.toBlob(resolve,'image/png'));
  if(!blob)throw Error('PNG encoding failed');
  const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=filename+'.png';link.click();
  // Release the large export canvas; do not keep 300 MB beside the running game.
  result.canvas.width=result.canvas.height=0;
  return {...result.meta,seed,expanded,paintedTownAssets:assets.length,mapStateUnchanged:true};
 },{seed,scale,expanded,filename});
 const file=await download;
 await file.saveAs(out+'/'+filename+'.png');
 if(errors.length)throw Error(errors.join('\n'));
 await sharp(out+'/'+filename+'.png').resize({width:3200,withoutEnlargement:true}).webp({quality:92,effort:5}).toFile(out+'/'+filename+'-overview.webp');
 await fs.writeFile(out+'/'+filename+'.json',JSON.stringify({...meta,bytes:(await fs.stat(out+'/'+filename+'.png')).size},null,2)+'\n');
 console.log(JSON.stringify({file:out+'/'+filename+'.png',preview:out+'/'+filename+'-overview.webp',viewer:out+'/index.html',...meta},null,2));
}finally{await browser.close();}
