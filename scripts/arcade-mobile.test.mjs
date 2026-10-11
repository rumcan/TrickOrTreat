import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({channel:'msedge'});
try{
 for(const viewport of [{width:390,height:844},{width:844,height:390}]){
  const context=await browser.newContext({viewport,hasTouch:true,isMobile:true,deviceScaleFactor:2}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.goto(process.env.TOT_ARCADE_URL || 'http://127.0.0.1:5190/');
  await page.getByRole('button',{name:'Go trick-or-treating'}).waitFor({timeout:120000});await page.getByRole('button',{name:'Go trick-or-treating'}).tap();
  await page.waitForFunction(()=>window.__tot?.game);
  await page.evaluate(()=>{const g=window.__tot.game;g.director=()=>{};g.enemies=[];g.p.invuln=1e9;Object.assign(g.p,g.map.houses.find(h=>h.prop.kind==='arcade').door);g.updateInteract();});
  const interact=page.getByRole('button',{name:'Interact',exact:true});await interact.tap();
  await page.waitForFunction(()=>window.__tot.game.map.kind==='arcade');
  await page.getByRole('button',{name:'Map',exact:true}).tap();await page.waitForFunction(()=>window.__tot.game.bigMap);
  await page.getByRole('button',{name:'Map',exact:true}).tap();await page.waitForFunction(()=>!window.__tot.game.bigMap);
  await page.evaluate(async()=>{(await import('/src/game/expansion.ts')).expansion.preview();}); // the arcade crew is recruited in the full game
  await page.evaluate(()=>{const g=window.__tot.game,s=g.availableArcadeStaff.find(s=>s.hero===3);g.p.coins=2000;Object.assign(g.p,{x:s.x,y:s.y+.5});g.updateInteract();});
  await interact.tap();const hire=page.getByRole('dialog',{name:'Recruit Maya'});await hire.waitFor();
  await hire.getByRole('button',{name:'Not now · back to the arcade'}).tap();await page.waitForFunction(()=>window.__tot.game.state==='play');
  await interact.tap();await page.getByRole('dialog',{name:'Recruit Maya'}).getByRole('button',{name:'Recruit Maya · 1000 coins'}).tap();
  await page.waitForFunction(()=>window.__tot.game.state==='play'&&window.__tot.game.friends.some(f=>f.hero===3&&f.status==='rescued'));
  await page.evaluate(()=>{const g=window.__tot.game;Object.assign(g.p,g.map.start);g.updateInteract();});await interact.tap();
  await page.waitForFunction(()=>window.__tot.game.map.kind!=='arcade');assert.deepEqual(errors,[]);
  console.log(`${viewport.width}x${viewport.height}: touch entry/exit, map toggle and cancellable coin recruitment work.`);
  await context.close();
 }
}finally{await browser.close();}
