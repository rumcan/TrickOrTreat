import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright-core';

// Geometry and actual render checks for the isolated scenery proposal.
const browser=await chromium.launch({channel:'msedge'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.TOWN_URL||'http://127.0.0.1:5192/');
 await page.getByRole('button',{name:'Go trick-or-treating',exact:true}).waitFor({timeout:120000});
 const audit=await page.evaluate(async()=>{
  const {buildStaticTown}=await import('/src/game/town-static.ts');
  const source=await(await fetch('/src/game/town-static.ts')).text();
  const artURL=source.match(/from\s*["']([^"']*\/art\/town-static\.ts[^"']*)["']/)?.[1]||'/src/game/art/town-static.ts';
  const {loadStaticTownArt}=await import(artURL);await loadStaticTownArt();
  const {map,audit}=buildStaticTown();
  for(const p of map.props){
   if(p.kind==='house'||p.kind==='garage'||p.kind==='tree'||p.kind==='screen'||p.kind.startsWith('town_rear')){
    if(!p.occludesCharacter)throw Error('Missing independent fading for '+p.kind);
   }
  }
  return audit;
 });
 // not every home has room for a garage in the reference layout; every garage must reach its street
 assert.equal(audit.garages,audit.drivewaysConnected);
 assert.ok(audit.homes>=15,'the reference town has its homes');
 assert.deepEqual(audit.unreachableDoors,[]);
 assert.equal(audit.roadConflicts,0);assert.ok(audit.vehicleVariants>=6);
 // Use the real renderer to prove a separate building fades over a character.
 await page.getByRole('button',{name:'Go trick-or-treating',exact:true}).click();
 await page.waitForFunction(()=>window.__tot?.game);
 const fading=await page.evaluate(async()=>{
  const {buildStaticTown}=await import('/src/game/town-static.ts');
  const {game:g,renderer}=window.__tot;
  const {map}=buildStaticTown();g.update=()=>{};g.map=map;g.state='play';g.campaign=false;
  g.enemies=[];g.friends=[];g.pickups=[];g.tutorialHouse=null;g.banner=null;g.mounted=-1;g.tot=null;
  const building=map.props.find(p=>p.kind==='town_hardware');
  // Put the player's feet behind its footprint, inside the projected wall silhouette.
  g.p.x=building.x0+building.fw*.5;g.p.y=building.y0-.1;
  g.camX=(g.p.x-g.p.y)*64;g.camY=(g.p.x+g.p.y)*32-40;
  for(let i=0;i<15;i++)renderer.render(g,1/60);
  const hidden=building.fade;
  g.p.x=map.start.x;g.p.y=map.start.y;
  for(let i=0;i<30;i++)renderer.render(g,1/60);
  const restored=building.fade;
  return {hidden,restored};
 });
 assert.ok(fading.hidden<.6,'Building fades when it hides the character');
 assert.ok(fading.restored>.95,'Building opacity restores when the character leaves');
 assert.deepEqual(errors,[]);
 const report={audit,fading,errors};
 await fs.mkdir('art/town/static/review',{recursive:true});
 await fs.writeFile('art/town/static/review/layout-check.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
