import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright-core';
const url=process.env.TOWN_URL||'http://127.0.0.1:5192/';
const browser=await chromium.launch({channel:'msedge'});
await fs.mkdir('art/town/checks',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);
 await page.getByRole('button',{name:'Go trick-or-treating'}).waitFor({timeout:120000});
 const result=await page.evaluate(async()=>{
  const {buildMap}=await import('/src/game/map.ts');
  // Import the exact dependency URL used by map.ts, including Vite's HMR stamp.
  // A bare second import otherwise creates a separate sprite cache after an edit.
  const source=await(await fetch('/src/game/map.ts')).text();
  const townURL=source.match(/from "([^"]*\/art\/town\.ts[^"]*)"/)[1];
  const {getTownProp,townGeometry}=await import(townURL);
  const {townOverview}=await import('/src/game/town-overview.ts');
  const {G}=await import('/src/game/art/tiles.ts');
  const {allAssets}=await import('/src/game/assets.ts');
  const bad=[],maps=[];
  const bike=getTownProp('bike_rack'),master=allAssets().find(a=>a.spec.key==='town_bike_rack');
  const geo=townGeometry('bike_rack');
  for(const [key,value]of Object.entries({w:master.w/2,h:master.h/2,ax:master.anchor[0]/2,ay:master.anchor[1]/2,fw:geo.a.fw/2,fh:geo.a.fh/2}))if(bike[key]!==value)bad.push('bike '+key);
  if(bike!==getTownProp('bike_rack'))bad.push('bike cache identity');
  const bus=getTownProp('bus_stop');
  for(const expanded of [false,true])for(const seed of [1337,7932,15851,23770,791903]){
   const m=buildMap(seed,expanded),buses=m.props.filter(p=>p.sp===bus);
   if(!buses.some(p=>p.x0===39&&p.y0===21))bad.push('school bus missing '+seed+' '+expanded);
   for(const p of buses)for(let y=p.y0;y<p.y0+p.fh;y++)for(let x=p.x0;x<p.x0+p.fw;x++)if(m.ground[y*94+x]===G.FIELD)bad.push('bus on field '+seed);
   maps.push({expanded,seed,buses:buses.length});
  }
  const m=buildMap(1337,true),snapshot=()=>JSON.stringify({coll:Array.from(m.coll),props:m.props.map(p=>[p.id,p.removed,p.fade]),gates:m.gates.map(g=>g.opened),barriers:m.barriers.map(b=>b.cleared)}),before=snapshot();
  const hidden=new Set([...m.barriers.flatMap(b=>b.prop?[b.prop.id]:[]),...m.gates.flatMap(g=>g.propIds)]);
  const review=townOverview(m,{scale:.1}),withBarriers=townOverview(m,{scale:.1,hideBarriers:false});
  if(before!==snapshot())bad.push('overview mutated live map');
  if(review.meta.hiddenBarrierProps!==hidden.size)bad.push('incorrect hidden props');
  if(review.meta.propsDrawn!==m.props.filter(p=>!p.removed&&!hidden.has(p.id)).length)bad.push('decoration removed');
  if(withBarriers.meta.propsDrawn-review.meta.propsDrawn!==m.props.filter(p=>!p.removed&&hidden.has(p.id)).length)bad.push('barrier toggle');
  review.canvas.width=withBarriers.canvas.width=0;
  return {bad,maps,bike:{w:bike.w,h:bike.h,fw:bike.fw,fh:bike.fh},overview:review.meta};
 });
 assert.deepEqual(result.bad,[]);
 await page.getByRole('button',{name:'Go trick-or-treating'}).click();
 await page.waitForFunction(()=>window.__tot?.game);
 const rendering=await page.evaluate(async()=>{
  const {game:g,renderer}=window.__tot;
  const {settings}=await import('/src/game/settings.ts');
  g.update=()=>{};g.state='play';g.time=0;g.enemies=[];g.banner=null;g.tutorialHouse=null;g.p.hurtT=0;g.p.invuln=0;
  g.p.x=38;g.p.y=17;g.camX=(38-17)*64;g.camY=(38+17)*32-40;
  const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d'),draw=ctx.drawImage;
  let masks=0;
  ctx.drawImage=function(image,...args){if(image instanceof HTMLCanvasElement&&image.width===canvas.width&&image.height===canvas.height)masks++;return draw.call(this,image,...args);};
  const old=settings.bright;settings.bright=0;renderer.render(g,0);settings.bright=1;renderer.render(g,0);settings.bright=old;renderer.render(g,0);ctx.drawImage=draw;
  return {masks,hasLight:'light' in renderer,hasVignette:'vignette' in renderer,filter:ctx.filter};
 });
 assert.deepEqual(rendering,{masks:0,hasLight:false,hasVignette:false,filter:'none'});
 await page.locator('canvas').first().screenshot({path:'art/town/checks/school-no-fog.png'});
 await page.goto(new URL('art/town/review/index.html',url).href);
 await page.waitForFunction(()=>document.querySelector('#town')?.naturalWidth>0,{},{timeout:120000});
 const fit=()=>page.evaluate(()=>{const i=document.querySelector('#town'),s=document.querySelector('#stage');return {fits:i.width<=s.clientWidth+1&&i.height<=s.clientHeight+1,native:i.naturalWidth,width:i.width};});
 assert.ok((await fit()).fits);
 await page.getByRole('button',{name:'100%',exact:true}).click();assert.equal((await fit()).width,(await fit()).native);
 await page.getByRole('button',{name:'Zoom in',exact:true}).click();assert.ok((await fit()).width>(await fit()).native);
 await page.getByRole('button',{name:'Fit town',exact:true}).click();
 await page.screenshot({path:'art/town/checks/overview-viewer.png'});
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Fit town',exact:true}).click();assert.ok((await fit()).fits,'Full town fits phone viewport');
 assert.deepEqual(errors,[]);
 const report={...result,rendering,viewer:{desktop:true,phone:true},errors};
 await fs.writeFile('art/town/checks/review-report.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
