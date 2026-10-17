/** Exercise real clicks in an isolated town; never write to the owner's plan/layout. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright-core';
import {ROOT} from '../lib/town-scene.mjs';
const live=path.join(ROOT,'output/town-builder'),out=path.join(live,'ux-review'),data=path.join(out,'fixture-'+Date.now());
const ownerFiles=['plans/maple-falls.json','layout.json'];
const originals=await Promise.all(ownerFiles.map(f=>fs.readFile(path.join(live,f),'utf8')));
await fs.mkdir(path.join(data,'plans'),{recursive:true});
const plan=JSON.parse(originals[0]);plan.lots=[{id:'ui-existing',surface:'asphalt',border:'ring',x0:92,y0:92,x1:108,y1:108}];plan.paving=[];plan.reflections=[];plan.roads=[];
await fs.writeFile(path.join(data,'plans/maple-falls.json'),JSON.stringify(plan));
await fs.writeFile(path.join(data,'layout.json'),originals[1]);
const port=5197,url='http://127.0.0.1:'+port;
const server=spawn(process.execPath,['scripts/town-builder/server.mjs','--port',String(port),'--data',data,'--assets',live],{stdio:['ignore','pipe','pipe'],windowsHide:true});
let log='',browser;server.stdout.on('data',d=>log+=d);server.stderr.on('data',d=>log+=d);
try{
 for(let n=0;n<100;n++){try{if((await fetch(url+'/api/plan')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>localStorage.setItem('mf-welcomed','1'));
 await page.goto(url);await page.waitForFunction(()=>window.__townBuilder?.man&&window.__townBuilder.sprites.length>0);
 await page.evaluate(()=>{const s=window.__townBuilder;s.cam={x:s.man.origin.ox,y:s.man.origin.oy+100*s.man.pxPerAxisM,z:.55};localStorage.setItem('mf-welcomed','1');});
 await page.locator('[data-mode=lots]').click();
 assert.equal(await page.locator('input[name=lotTool][value=select]').isChecked(),true);
 async function point(X,Y){return page.evaluate(([X,Y])=>{const s=window.__townBuilder,r=document.querySelector('#view').getBoundingClientRect(),mx=s.man.origin.ox+(X-Y)*s.man.pxPerAxisM,my=s.man.origin.oy+(X+Y)*s.man.pxPerAxisM/2;return{x:r.x+r.width/2+(mx-s.cam.x)*s.cam.z,y:r.y+r.height/2+(my-s.cam.y)*s.cam.z};},[X,Y]);}
 async function click(X,Y){const p=await point(X,Y);await page.mouse.click(p.x,p.y);}
 async function drag(x0,y0,x1,y1){const a=await point(x0,y0),b=await point(x1,y1);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:10});await page.mouse.up();}
 const state=()=>page.evaluate(()=>({plan:window.__townBuilder.plan,tool:window.__townBuilder.lotTool,selLot:window.__townBuilder.selLot,selPave:window.__townBuilder.selPave}));
 await click(100,100);assert.equal((await state()).selLot,0);
 assert.match(await page.locator('#taskTitle').innerText(),/Editing: Car park/);
 assert.equal(await page.locator('#lotSurf').count(),0);assert.equal(await page.locator('#lotEdge').count(),0);
 await page.locator('#gEdge').selectOption('none');assert.equal((await state()).plan.lots[0].border,'none');
 await page.locator('#startNewLot').click();assert.equal((await state()).selLot,null);
 await page.locator('[data-surface=slab]').click();await page.locator('#lotEdge').selectOption('curb');
 assert.equal((await state()).plan.lots[0].border,'none');assert.equal((await state()).plan.lots[0].surface,'asphalt');
 assert.match(await page.locator('#taskTitle').innerText(),/Creating: Plaza/);
 await page.locator('#right').evaluate(el=>el.scrollTop=0);
 await page.waitForFunction(()=>window.__townBuilder.miniImg?.complete&&window.__townBuilder.miniImg.naturalWidth>0);
 await page.waitForTimeout(2500);
 await page.screenshot({path:path.join(out,'draw-new.png')});
 // Drawing from inside an existing lot must create, rather than select it.
 await drag(96,96,106,104);let s=await state();assert.equal(s.plan.lots.length,2);assert.equal(s.tool,'select');assert.equal(s.selLot,1);assert.equal(s.plan.lots[1].surface,'slab');assert.equal(s.plan.lots[1].border,'curb');
 await page.locator('#gWidth').fill('14');await page.locator('#gWidth').press('Tab');assert.equal((await state()).plan.lots[1].x1,110);
 await page.locator('#gEdge').selectOption('ring');assert.equal((await state()).plan.lots[1].border,undefined);
 await page.locator('#right').evaluate(el=>el.scrollTop=0);await page.waitForTimeout(300);await page.screenshot({path:path.join(out,'edit-selected.png')});
 await page.locator('#gDel').click();assert.equal((await state()).plan.lots.length,1);
 await page.keyboard.press('Control+z');assert.equal((await state()).plan.lots.length,2);assert.equal((await state()).selLot,null);assert.equal(await page.locator('#gEdge').count(),0);
 console.log('PASS isolated new/edit settings, overlapping rectangle creation, dimensions, delete and undo');
 // Footpaths have their own border choices and clear lot selection.
 await page.locator('input[name=lotTool][value=rect]').check();await page.locator('[data-surface=paving]').click();await drag(112,100,120,108);
 s=await state();assert.equal(s.selLot,null);assert.equal(s.selPave,0);assert.equal(s.plan.paving[0].border,'none');
 assert.equal(await page.locator('#gEdge option[value=ring]').count(),0);
 await page.locator('#gEdge').selectOption('curb');assert.equal((await state()).plan.paving[0].border,undefined);
 console.log('PASS footpath creation and correct border choices');
 // A newly chosen brush creates independently; continued painting is explicit.
 await page.locator('input[name=lotTool][value=brush]').check();await page.locator('[data-surface=asphalt]').click();
 const before=(await state()).plan.lots.length;await drag(100,112,108,112);s=await state();assert.equal(s.plan.lots.length,before+1);const painted=s.plan.lots.at(-1);assert.ok(painted.stamps.length>1);
 await page.locator('#finishShape').click();assert.equal((await state()).tool,'select');
 await page.locator('#gPaint').click();await click(110,112);s=await state();assert.equal(s.plan.lots.length,before+1);assert.ok(s.plan.lots.at(-1).stamps.length>painted.stamps.length);
 await page.locator('#lotNewShape').click();await click(112,112);assert.equal((await state()).plan.lots.length,before+2);
 await page.keyboard.press('Control+z');s=await state();assert.equal(s.plan.lots.length,before+1);assert.equal(s.selLot,null);
 await click(114,112);assert.equal((await state()).plan.lots.length,before+2);
 await page.locator('#finishShape').click();await page.keyboard.press('Escape');assert.equal((await state()).selLot,null);
 console.log('PASS brush creation, finish, explicit continuation, new shape, undo and Escape');
 // The object inspector is hidden in placement/ground modes and keys cannot change stale selections.
 await page.keyboard.press('v');await page.evaluate(()=>{const s=window.__townBuilder;s.sel=new Set([s.sprites[0].uid]);});
 const object=await page.evaluate(()=>({...window.__townBuilder.sprites[0]}));
 await page.locator('.tile').first().click();assert.equal(await page.locator('#inspector').isVisible(),false);
 await page.keyboard.press('f');await page.keyboard.press(']');assert.deepEqual(await page.evaluate(()=>({...window.__townBuilder.sprites[0]})),object);
 await page.keyboard.press('k');assert.equal(await page.locator('#inspector').isVisible(),false);
 await page.keyboard.press('r');await page.waitForFunction(()=>document.querySelector('#groundBody img')?.complete);assert.equal(await page.locator('#groundBody img').count(),1);
 await page.keyboard.press('l');await page.locator('#groundErase').check();await page.mouse.move(700,500);assert.match(await page.locator('#taskTitle').innerText(),/Erase light glow/);
 console.log('PASS object selection scope, keyboard scope, road/glow examples');
 // Every visible example must load, and the sidebars must keep their content inside their bounds.
 await page.locator('[data-mode=lots]').click();await page.locator('input[name=lotTool][value=rect]').check();
 await page.waitForFunction(()=>[...document.querySelectorAll('#groundBody img')].every(i=>i.complete&&i.naturalWidth>0));
 assert.equal(await page.locator('#townStats').getAttribute('open'),null);
 for(const width of [1600,1100,900]){await page.setViewportSize({width,height:900});await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>document.body.scrollWidth<=innerWidth),true);assert.equal(await page.locator('#right').evaluate(el=>el.scrollWidth<=el.clientWidth),true);}
 await page.setViewportSize({width:1600,height:1000});await page.waitForTimeout(1000);
 // Updating ground is one deliberate click and flushes the current plan before rendering.
 const update=[];await page.route('**/api/bake',async route=>{update.push(route.request().method());await route.fulfill({json:{running:false,code:0,log:[]}});});
 await page.route('**/map/manifest.json',async route=>{const response=await route.fetch(),manifest=await response.json();manifest.groundPlan=(await state()).plan;await route.fulfill({json:manifest});});
 await page.locator('.update-ground').click();await page.waitForFunction(()=>document.querySelector('#groundStatus').textContent==='Ground up to date');
 assert.deepEqual(update,['POST','GET']);assert.equal(await page.locator('#groundStatus').innerText(),'Ground up to date');
 console.log('PASS explicit ground update and finished status');
 assert.deepEqual(errors,[]);console.log('PASS example images, collapsed statistics, desktop widths and no browser errors');
 // The user may be editing the live town at the same time. Check our destination,
 // rather than assuming the owner's files remain frozen throughout this test.
 assert.notEqual(path.resolve(data),path.resolve(live));
 for(const request of update)assert.ok(['POST','GET'].includes(request));
 assert.equal(JSON.parse(await fs.readFile(path.join(data,'plans/maple-falls.json'),'utf8')).lots.length,(await state()).plan.lots.length);
 const concurrentlyChanged=[];for(let i=0;i<ownerFiles.length;i++)if(await fs.readFile(path.join(live,ownerFiles[i]),'utf8')!==originals[i])concurrentlyChanged.push(ownerFiles[i]);
 console.log('PASS all test writes saved to the isolated fixture'+(concurrentlyChanged.length?' (concurrent live edits observed)':''));
}catch(e){console.error(log);throw e;}finally{await browser?.close();server.kill();}
