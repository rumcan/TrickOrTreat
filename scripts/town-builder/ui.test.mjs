/** Browser tests write only a fresh test layout; the owner's town is never touched. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright-core';
import {ROOT} from '../lib/town-scene.mjs';
const live=path.join(ROOT,'output/town-builder'),out=path.join(live,'upgrade-review'),data=path.join(out,'ui-fixture-'+Date.now());
await fs.mkdir(path.join(data,'plans'),{recursive:true});await fs.mkdir(path.join(data,'presets'),{recursive:true});
await fs.copyFile(path.join(live,'plans/maple-falls.json'),path.join(data,'plans/maple-falls.json'));
await fs.writeFile(path.join(data,'layout.json'),JSON.stringify({version:1,sprites:[]}));
for(const name of ['presets.json','poi.json'])try{await fs.copyFile(path.join(live,'presets',name),path.join(data,'presets',name));}catch(e){if(e.code!=='ENOENT')throw e;}
const port=5194,url='http://127.0.0.1:'+port,server=spawn(process.execPath,['scripts/town-builder/server.mjs','--port',String(port),'--data',data,'--assets',live],{stdio:['ignore','pipe','pipe'],windowsHide:true});
let browser;const errors=[];let log='';server.stdout.on('data',d=>log+=d);server.stderr.on('data',d=>log+=d);
try{
 for(let n=0;n<100;n++){try{if((await fetch(url+'/api/plan')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1680,height:1000}});page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(url);await page.waitForFunction(()=>window.__townBuilder?.man&&window.__townBuilder.presets.length>0);
 const count=()=>page.evaluate(()=>window.__townBuilder.sprites.length);
 const origin=await page.evaluate(()=>{const s=window.__townBuilder,m=s.man;s.cam={x:m.origin.ox,y:m.origin.oy+40*m.pxPerAxisM,z:.8};return {refs:s.plan.reflections.length,paving:s.plan.paving.length};});
 const box=await page.locator('#view').boundingBox(),pt={x:box.x+box.width/2,y:box.y+box.height/2};
 await page.locator('[data-mode="streetlights"]').click();await page.mouse.click(pt.x,pt.y);
 assert.equal(await count(),1);assert.equal(await page.evaluate(()=>window.__townBuilder.sprites[0].id),'world:streetlamp');
 await page.waitForTimeout(500);await page.keyboard.press('v');await page.mouse.click(pt.x,pt.y-10);
 await page.waitForFunction(()=>window.__townBuilder.sel.size===1);await page.keyboard.press('Delete');assert.equal(await count(),0);
 await page.keyboard.press('Control+z');assert.equal(await count(),1);await page.keyboard.press('Control+y');assert.equal(await count(),0);
 console.log('PASS streetlight paint, select, delete, undo and redo');
 await page.locator('[data-mode="lamps"]').click();await page.locator('#lightSnap').uncheck();await page.mouse.click(pt.x,pt.y);
 assert.equal(await page.evaluate(()=>window.__townBuilder.plan.reflections.length),origin.refs+1);
 await page.keyboard.down('Shift');await page.mouse.click(pt.x,pt.y);await page.keyboard.up('Shift');assert.equal(await page.evaluate(()=>window.__townBuilder.plan.reflections.length),origin.refs);
 console.log('PASS independent reflection paint and erase');
 // Pavement patches live in "Lots & paving": choose the surface, drag a rectangle, click it to select, Delete removes it.
 await page.locator('[data-mode="lots"]').click();await page.locator('input[name=lotTool][value=rect]').check();await page.locator('#lotSurf').selectOption('paving');
 await page.mouse.move(pt.x,pt.y);await page.mouse.down();await page.mouse.move(pt.x+150,pt.y+40,{steps:10});await page.mouse.up();
 assert.equal(await page.evaluate(()=>window.__townBuilder.plan.paving.length),origin.paving+1);
 await page.keyboard.press('Control+z');assert.equal(await page.evaluate(()=>window.__townBuilder.plan.paving.length),origin.paving);
 await page.locator('input[name=lotTool][value=rect]').check();
 await page.mouse.move(pt.x,pt.y);await page.mouse.down();await page.mouse.move(pt.x+150,pt.y+40,{steps:10});await page.mouse.up();
 await page.mouse.click(pt.x+60,pt.y+20);await page.waitForFunction(()=>window.__townBuilder.selPave!=null);await page.keyboard.press('Delete');
 assert.equal(await page.evaluate(()=>window.__townBuilder.plan.paving.length),origin.paving);
 console.log('PASS pavement patch drag, undo, select and delete in Lots & paving');
 // grouping + forward/back one
 await page.keyboard.press('v');
 // Actual palette -> placement -> undo for all three new arcade groups, not merely JSON registration.
 for(const [category,name,id]of [['Arcade furniture','Arcade cabinet — back','arcade:arcade_v2_cabinet_back_0.55_0.75'],['Arcade decor','Bigfoot costume display','arcade:arcade_v2_clutter_bigfoot'],['Arcade floor decals','Spilled popcorn','arcade:arcade_v2_clutter_popcorn']]){
  await page.getByRole('button',{name:new RegExp('^'+category+' \\(')}).click();
  await page.locator('.tile').filter({hasText:name}).click();const before=await count();
  await page.mouse.click(pt.x,pt.y);assert.equal(await count(),before+1);
  assert.equal(await page.evaluate(()=>window.__townBuilder.sprites.at(-1).id),id);
  await page.waitForFunction(()=>[...document.images].filter(i=>i.src.includes('/library/')).every(i=>i.complete&&i.naturalWidth>0));
  await page.keyboard.press('Control+z');assert.equal(await count(),before);
 }
 console.log('PASS arcade furniture, decor and floor decal palette, image loading, placement and undo');
 for(const [id,title,building]of [['poi-fishing-frontage','Pike & Pine — dressed frontage','town:fish_tackle'],['poi-video-frontage','Video Vault — after-hours corner','world:video_rental'],['poi-street-litter','After-Halloween pavement litter',null]]){
  await page.getByRole('button',{name:/Presets \(/}).click();await page.locator('.tile').filter({hasText:title}).click();
  const before=await count(),members=await page.evaluate(id=>window.__townBuilder.presets.find(p=>p.id===id).count,id);
  await page.mouse.click(pt.x,pt.y);assert.equal(await count(),before+members);
  if(building)assert.ok(await page.evaluate(building=>window.__townBuilder.sprites.some(s=>s.id===building),building));
  assert.equal(await page.evaluate(()=>window.__townBuilder.sprites.some(s=>/^poi:.*building/.test(s.id))),false);
  await page.keyboard.press('Control+z');assert.equal(await count(),before);console.log('PASS exact reused-building/litter preset',id);
 }
 await page.getByRole('button',{name:/Presets \(/}).click();await page.locator('.tile').filter({hasText:'After-Halloween pavement litter'}).click();
 const preview=await page.evaluate(()=>structuredClone(window.__townBuilder.brush.roll));
 const verifyStamp=async(x,y)=>{const before=await count();await page.mouse.click(x,y);const added=await page.evaluate(n=>window.__townBuilder.sprites.slice(n),before);
  assert.equal(added.length,preview.length);const X=added[0].x-preview[0].dx,Y=added[0].y-preview[0].dy;
  for(let i=0;i<added.length;i++){assert.equal(added[i].id,preview[i].id);assert.equal(added[i].scale,preview[i].scale);assert.equal(added[i].flip,preview[i].flip);assert.ok(Math.abs(added[i].x-X-preview[i].dx)<1e-10);assert.ok(Math.abs(added[i].y-Y-preview[i].dy)<1e-10);}
  assert.deepEqual(await page.evaluate(()=>window.__townBuilder.brush.roll),preview,'Preview must not reroll after a stamp');await page.keyboard.press('Control+z');assert.equal(await count(),before);
 };
 await verifyStamp(pt.x,pt.y);await verifyStamp(pt.x+40,pt.y+20);
 await page.locator('#bScale').evaluate(el=>{el.value='2';el.dispatchEvent(new Event('input',{bubbles:true}));});
 assert.deepEqual(await page.evaluate(()=>window.__townBuilder.brush.roll),preview.map(m=>({...m,dx:m.dx*2,dy:m.dy*2,scale:m.scale*2})));
 await page.locator('#bScale').evaluate(el=>{el.value='1';el.dispatchEvent(new Event('input',{bubbles:true}));});
 console.log('PASS fixed preset repeated stamps match preview positions/size/facing and explicit whole-area scaling');
 const preset={id:'user-qa',name:'QA exact lamps',group:'My presets',turn:false,mirror:false,members:[{dx:-1,dy:0,pick:['world:streetlamp'],flip:false,scale:[1,1],chance:1},{dx:1,dy:0,pick:['world:streetlamp'],flip:false,scale:[1,1],chance:1}]};
 assert.equal((await page.request.post(url+'/api/presets',{data:preset})).status(),200);
 assert.ok((await page.request.post(url+'/api/presets',{data:{...preset,id:'../invalid'}})).status()>=400);
 await page.reload();await page.waitForFunction(()=>window.__townBuilder?.presets.some(p=>p.id==='user-qa'));
 await page.getByRole('button',{name:/Presets \(/}).click();await page.locator('.tile').filter({hasText:'QA exact lamps'}).click();
 await page.mouse.click(pt.x,pt.y);assert.equal(await count(),2);await page.keyboard.press('Control+z');assert.equal(await count(),0);await page.keyboard.press('Control+y');assert.equal(await count(),2);
 await page.keyboard.press('v');await page.mouse.move(pt.x-90,pt.y-70);await page.mouse.down();await page.mouse.move(pt.x+90,pt.y+70,{steps:4});await page.mouse.up();
 assert.equal(await page.evaluate(()=>window.__townBuilder.sel.size),2);
 const originals=await page.evaluate(()=>structuredClone(window.__townBuilder.sprites));
 await page.locator('#iGroupSpacing').uncheck();await page.locator('#iGroupScale').fill('150');await page.locator('#iGroupApply').click();
 const inPlace=await page.evaluate(()=>structuredClone(window.__townBuilder.sprites));
 assert.deepEqual(inPlace.map(s=>[s.x,s.y]),originals.map(s=>[s.x,s.y]));assert.deepEqual(inPlace.map(s=>s.scale),originals.map(s=>(s.scale??1)*1.5));
 await page.keyboard.press('Control+z');assert.deepEqual(await page.evaluate(()=>window.__townBuilder.sprites),originals);
 const selectGroup=async()=>{await page.mouse.move(pt.x-100,pt.y-80);await page.mouse.down();await page.mouse.move(pt.x+100,pt.y+80,{steps:4});await page.mouse.up();assert.equal(await page.evaluate(()=>window.__townBuilder.sel.size),2);};
 await selectGroup();await page.locator('#iGroupSpacing').check();await page.locator('#iGroupScale').fill('150');await page.locator('#iGroupApply').click();
 const resized=await page.evaluate(()=>structuredClone(window.__townBuilder.sprites));
 const cx=(originals[0].x+originals[1].x)/2,cy=(originals[0].y+originals[1].y)/2;
 for(let i=0;i<2;i++){assert.equal(resized[i].scale,(originals[i].scale??1)*1.5);assert.equal(resized[i].x,cx+(originals[i].x-cx)*1.5);assert.equal(resized[i].y,cy+(originals[i].y-cy)*1.5);}
 await page.keyboard.press('Control+z');assert.deepEqual(await page.evaluate(()=>window.__townBuilder.sprites),originals);
 await page.keyboard.press('Control+y');assert.deepEqual(await page.evaluate(()=>window.__townBuilder.sprites),resized);await selectGroup();
 console.log('PASS multi-selection resize controls, spacing toggle, common pivot, undo and redo');
 page.on('dialog',d=>d.type()==='prompt'?d.accept('QA saved selection'):d.dismiss());await page.locator('#iPreset').click();
 await page.waitForFunction(()=>window.__townBuilder.presets.some(p=>p.name==='QA saved selection'));
 await page.waitForTimeout(1100);await page.reload();await page.waitForFunction(()=>window.__townBuilder?.sprites.length===2);
 assert.deepEqual(await page.evaluate(()=>window.__townBuilder.sprites),resized,'Group resize must survive save/reload');
 const savedPreset=(await (await page.request.get(url+'/api/presets')).json()).presets.find(p=>p.name==='QA saved selection');assert.ok(savedPreset?.fixed);assert.equal(savedPreset.turn,false);assert.equal(savedPreset.mirror,false);
 const px=resized.reduce((sum,s)=>sum+s.x,0)/resized.length,py=resized.reduce((sum,s)=>sum+s.y,0)/resized.length;
 assert.deepEqual(savedPreset.members,resized.map(s=>({dx:s.x-px,dy:s.y-py,pick:[s.id],flip:!!s.flip,scale:[s.scale,s.scale],jitter:0,chance:1})));
 console.log('PASS preset API, stamp, undo/redo, selection save and reload');
 await page.screenshot({path:path.join(out,'builder-ui-tested.png')});assert.deepEqual(errors,[]);
 await fs.writeFile(path.join(out,'ui-results.json'),JSON.stringify({passed:10,errors,testData:data},null,2));console.log(JSON.stringify({passed:10,testData:data}));
}catch(e){console.error(log);throw e;}finally{if(browser)await browser.close();server.kill();}
