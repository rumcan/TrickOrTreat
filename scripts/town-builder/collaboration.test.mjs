import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright-core';
import sharp from 'sharp';
import {ROOT} from '../lib/town-scene.mjs';
import {mergeTown} from './app/town-merge.js';
const base={sprites:[{uid:1,id:'world:streetlamp',x:100,y:100,scale:1}]},a=structuredClone(base),b=structuredClone(base);
a.sprites[0].x=104;b.sprites[0].scale=2;
assert.deepEqual(mergeTown('layout',base,a,b),{value:{sprites:[{...a.sprites[0],scale:2}]},conflicts:[]});
b.sprites[0].x=108;assert.equal(mergeTown('layout',base,a,b).conflicts.length,1);
assert.equal(mergeTown('layout',base,a,b,true).value.sprites[0].x,104);
assert.equal(mergeTown('layout',base,{sprites:[]},b).conflicts.length,1);
const p={roads:['0,0'],lots:[],paving:[],reflections:[]};assert.deepEqual(new Set(mergeTown('plan',p,{...p,roads:['0,0','1,0']},{...p,roads:['2,0']}).value.roads),new Set(['1,0','2,0']));
console.log('PASS independent fields, road additions/removals and explicit conflicting edits/deletions');
const live=path.join(ROOT,'output/town-builder'),out=path.join(live,'network-review'),data=path.join(out,'fixture-'+Date.now());
await fs.mkdir(path.join(data,'plans'),{recursive:true});
const plan=JSON.parse(await fs.readFile(path.join(live,'plans/maple-falls.json'),'utf8'));Object.assign(plan,{roads:[],lots:[],paving:[],reflections:[]});
await fs.writeFile(path.join(data,'plans/maple-falls.json'),JSON.stringify(plan));await fs.writeFile(path.join(data,'layout.json'),JSON.stringify(base));
const port=5198,url=`http://127.0.0.1:${port}`,server=spawn(process.execPath,['scripts/town-builder/server.mjs','--port',String(port),'--data',data,'--assets',live],{stdio:['ignore','pipe','pipe'],windowsHide:true});
let browser,log='';server.stdout.on('data',d=>log+=d);server.stderr.on('data',d=>log+=d);
const errors=[];
try{
 for(let n=0;n<100;n++){try{if((await fetch(url+'/api/plan')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const ca=await browser.newContext({viewport:{width:1680,height:1050}}),cb=await browser.newContext({viewport:{width:1680,height:1050}}),alice=await ca.newPage(),bob=await cb.newPage();
 for(const page of [alice,bob]){page.on('pageerror',e=>errors.push(String(e)));await page.addInitScript(()=>localStorage.setItem('mf-welcomed','1'));await page.goto(url);await page.waitForFunction(()=>window.__townSharing?.connected&&window.__townBuilder?.ready&&window.__townBuilder.miniImg.complete);await page.evaluate(()=>{const s=window.__townBuilder;s.cam={x:s.man.origin.ox,y:s.man.origin.oy+100*s.man.pxPerAxisM,z:.7};});}
 await alice.waitForFunction(()=>window.__townBuilder.peers?.length===1);assert.notEqual(await alice.evaluate(()=>window.__townSharing.session.start),await bob.evaluate(()=>window.__townSharing.session.start));
 async function point(page,X,Y){return page.evaluate(([X,Y])=>{const s=window.__townBuilder,r=document.querySelector('#view').getBoundingClientRect();return {x:r.x+r.width/2+(s.man.origin.ox+(X-Y)*s.man.pxPerAxisM-s.cam.x)*s.cam.z,y:r.y+r.height/2+(s.man.origin.oy+(X+Y)*s.man.pxPerAxisM/2-s.cam.y)*s.cam.z};},[X,Y]);}
 async function click(page,X,Y){const q=await point(page,X,Y);await page.mouse.click(q.x,q.y);}
 for(const page of [alice,bob])await page.locator('[data-mode=streetlights]').click();
 await Promise.all([click(alice,94,100),click(bob,106,100)]);
 for(const page of [alice,bob])await page.waitForFunction(()=>window.__townBuilder.sprites.length===3&&window.__townBuilder.saved,{timeout:10000});
 let saved=await (await fetch(url+'/api/layout')).json();assert.equal(saved.sprites.length,3);assert.equal(new Set(saved.sprites.map(o=>o.uid)).size,3);
 await alice.keyboard.press('Control+z');await alice.waitForFunction(()=>window.__townBuilder.saved&&window.__townBuilder.sprites.length===2);await bob.waitForFunction(()=>window.__townBuilder.sprites.length===2);
 saved=await (await fetch(url+'/api/layout')).json();assert.ok(saved.sprites.some(o=>o.x===106));assert.ok(!saved.sprites.some(o=>o.x===94));
 console.log('PASS two browser simultaneous placements, unique IDs, live visibility and Undo preserving another builder’s placement');
 for(const page of [alice,bob])await page.locator('[data-mode=roads]').click();
 await Promise.all([click(alice,90,90),click(bob,110,90)]);for(const page of [alice,bob])await page.waitForFunction(()=>window.__townBuilder.plan.roads.length===2&&!window.__townBuilder.planSavePending);
 await alice.locator('input[name=roadTool][value=remove]').check();await click(alice,90,90);await bob.waitForFunction(()=>window.__townBuilder.plan.roads.length===1);
 await alice.keyboard.press('Control+z');await bob.waitForFunction(()=>window.__townBuilder.plan.roads.length===2);
 console.log('PASS concurrent road edits, removal and Undo');
 // Delay incoming updates while both users edit the same field, then require a choice.
 await bob.evaluate(()=>{window.__townBuilder.mouse.down=true;});
 await alice.evaluate(async()=>{window.__townBuilder.sprites.find(o=>o.uid===1).x=101;await window.__townSharing.save('layout');});
 await bob.evaluate(()=>{window.__townBuilder.sprites.find(o=>o.uid===1).x=102;window.__townBuilder.mouse.down=false;});
 await bob.locator('#conflictDialog').waitFor({state:'visible'});await bob.locator('#keepMine').click();await bob.evaluate(()=>window.__townSharing.save('layout'));await alice.waitForFunction(()=>window.__townBuilder.sprites.find(o=>o.uid===1).x===102);
 assert.equal((await (await fetch(url+'/api/layout')).json()).sprites.find(o=>o.uid===1).x,102);
 console.log('PASS same-field conflict requires explicit choice and preserves chosen change');
 const camera=await alice.evaluate(()=>window.__townBuilder.cam);await alice.evaluate(()=>window.__townSharing.events.close());
 await bob.evaluate(async()=>{window.__townBuilder.sprites.find(o=>o.uid===1).scale=1.3;await window.__townSharing.save('layout');});
 await alice.evaluate(()=>window.__townSharing.connect());await alice.waitForFunction(()=>window.__townBuilder.sprites.find(o=>o.uid===1).scale===1.3);assert.deepEqual(await alice.evaluate(()=>window.__townBuilder.cam),camera);
 console.log('PASS reconnect catches missed edits without changing the camera');
 await alice.locator('[data-mode=select]').click();await alice.evaluate(()=>window.__townBuilder.sel=new Set([1]));await alice.keyboard.press('ArrowRight');await alice.locator('#iX').focus();
 await bob.evaluate(async()=>{window.__townBuilder.sprites.find(o=>o.uid===1).y=105;await window.__townSharing.save('layout');});await alice.waitForFunction(()=>window.__townBuilder.sprites.find(o=>o.uid===1).y===105);
 await alice.locator('#iX').fill('103.25');await alice.locator('#iX').press('Tab');await bob.waitForFunction(()=>window.__townBuilder.sprites.find(o=>o.uid===1).x===103.25);assert.equal(await bob.evaluate(()=>window.__townBuilder.sprites.find(o=>o.uid===1).y),105);
 console.log('PASS inspector retains its current object while another builder edits a different field');
 // Sharing opens LAN only after the host explicitly starts it.
 await alice.locator('#shareBtn').click();await alice.locator('#sharingToggle').click();await alice.locator('#shareLinks input').first().waitFor();const invite=await alice.locator('#shareLinks input').first().inputValue(),network=new URL(invite).origin;
 let remote;for(let n=0;n<30;n++){try{remote=await fetch(network+'/api/layout');break;}catch{}await new Promise(r=>setTimeout(r,100));}assert.equal(remote.status,403);
 const joined=await fetch(invite,{redirect:'manual'});assert.equal(joined.status,302);const cookie=joined.headers.get('set-cookie').split(';')[0];assert.equal((await fetch(network+'/api/layout',{headers:{cookie}})).status,200);
 const remoteContext=await browser.newContext({viewport:{width:1680,height:1050}}),guest=await remoteContext.newPage();guest.on('pageerror',e=>errors.push(String(e)));await guest.goto(invite);await guest.waitForFunction(()=>window.__townSharing?.connected&&window.__townBuilder.man);assert.equal(await guest.evaluate(()=>window.__townSharing.sharing.owner),false);
 // HTTP over a LAN is not a secure browser context; generated IDs must still work there.
 await guest.evaluate(()=>{const s=window.__townBuilder;s.cam={x:s.man.origin.ox,y:s.man.origin.oy+100*s.man.pxPerAxisM,z:.7};});await guest.locator('[data-mode=lamps]').click();await click(guest,104,110);await bob.waitForFunction(()=>window.__townBuilder.plan.reflections.length===1);assert.ok(await guest.evaluate(()=>window.__townBuilder.plan.reflections[0].id));
 assert.equal((await fetch(network+'/api/share',{method:'POST',headers:{cookie},body:JSON.stringify({enabled:false})})).status,403);
 assert.equal((await fetch(url+'/api/plan',{method:'PUT',headers:{origin:'http://another-site.test'},body:JSON.stringify(plan)})).status,403);
 assert.equal((await fetch(url+'/api/layout',{method:'PUT',body:JSON.stringify(base)})).status,409);
 assert.equal((await fetch(url+'/api/layout',{method:'PUT',body:JSON.stringify({sprites:[{uid:1},{uid:1}]})})).status,400);
 await alice.screenshot({path:path.join(out,'share-town.png')});await alice.locator('#sharingToggle').click();await alice.locator('#shareClose').click();
 let denied=false;for(let n=0;n<30;n++){try{denied=!(await fetch(network+'/api/layout',{headers:{cookie}})).ok;}catch{denied=true;}if(denied)break;await new Promise(r=>setTimeout(r,100));}assert.ok(denied);await guest.close();await remoteContext.close();
 console.log('PASS invitation-only LAN access, remote HTTP editing, host-only sharing controls, revoked invitation and cross-origin rejection');
 // All calibrated fence previews must contain actual opaque/colored pixels.
 const lib=await (await fetch(url+'/library/library.json')).json(),fences=lib.items.filter(o=>o.fence&&!o.hidden);assert.ok(fences.length);
 for(const item of fences){const r=await fetch(url+'/fence-render/'+encodeURIComponent(item.id)+'.png?r=2');assert.ok(r.ok,item.id);const image=await sharp(Buffer.from(await r.arrayBuffer())).ensureAlpha().raw().toBuffer();let visible=0;for(let i=3;i<image.length;i+=4)if(image[i]>32)visible++;assert.ok(visible>100,item.id+' blank');}
 await alice.locator('#search').fill('fence');await alice.locator('#palette img').first().scrollIntoViewIfNeeded();await alice.waitForFunction(()=>[...document.querySelectorAll('#palette img')].slice(0,6).every(im=>im.complete&&im.naturalWidth>0));await alice.screenshot({path:path.join(out,'fence-thumbnails.png')});
 assert.deepEqual(errors,[]);console.log('PASS '+fences.length+' nonblank fence thumbnails and no browser errors');
}catch(e){console.error(log);throw e;}finally{await browser?.close();server.kill();}
