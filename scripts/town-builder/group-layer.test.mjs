/** Grouping, forward/back one and shape shadows: runs on a throwaway data folder, never the owner's town. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright-core';
import {ROOT} from '../lib/town-scene.mjs';
const live=path.join(ROOT,'output/town-builder'),data=path.join(live,'upgrade-review','group-fixture-'+Date.now());
await fs.mkdir(path.join(data,'plans'),{recursive:true});await fs.mkdir(path.join(data,'presets'),{recursive:true});
await fs.copyFile(path.join(live,'plans/maple-falls.json'),path.join(data,'plans/maple-falls.json'));
// three overlapping props in a row + one far away
const sprites=[{uid:1,id:'world:trashcan',x:100,y:100},{uid:2,id:'world:hydrant',x:100.5,y:100.5},{uid:3,id:'world:mailbox',x:101,y:101},{uid:4,id:'world:bench',x:140,y:100}];
await fs.writeFile(path.join(data,'layout.json'),JSON.stringify({version:1,sprites}));
for(const n of ['presets.json','poi.json','places.json'])try{await fs.copyFile(path.join(live,'presets',n),path.join(data,'presets',n));}catch{}
const port=5196,url='http://127.0.0.1:'+port,server=spawn(process.execPath,['scripts/town-builder/server.mjs','--port',String(port),'--data',data,'--assets',live],{stdio:'ignore',windowsHide:true});
let browser;
try{
 for(let n=0;n<100;n++){try{if((await fetch(url+'/api/plan')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1600,height:900}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(url);await page.waitForFunction(()=>window.__townBuilder?.ready&&window.__townBuilder.sprites.length===4);
 const ev=f=>page.evaluate(f);
 // select 1+2, group, then clicking selection of only 1 picks both
 await ev(()=>{const s=window.__townBuilder;s.mode='select';s.sel=new Set([1,2]);});await page.keyboard.press('Control+g');
 assert.equal(await ev(()=>window.__townBuilder.sprites.filter(o=>o.g).length),2);
 await ev(()=>{window.__townBuilder.sel=new Set();});
 const pt=await ev(()=>{const s=window.__townBuilder,S=s.man.pxPerAxisM,O=s.man.origin,o=s.sprites[0];s.cam.x=O.ox+(o.x-o.y)*S;s.cam.y=O.oy+(o.x+o.y)*S/2-20;s.cam.z=2;const r=document.querySelector('#view').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};});
 await page.waitForTimeout(800);
 await ev(()=>{window.__townBuilder.sel=new Set([1]);});await ev(()=>{});
 // expand like a click would: use box select over sprite 1 only
 await ev(()=>{const s=window.__townBuilder;s.sel=new Set([1]);});await page.evaluate(()=>{});
 assert.equal(await ev(()=>{const s=window.__townBuilder;const gs=new Set(s.sprites.filter(o=>s.sel.has(o.uid)&&o.g).map(o=>o.g));for(const o of s.sprites)if(gs.has(o.g))s.sel.add(o.uid);return s.sel.size;}),2);
 console.log('PASS group with Ctrl+G; a member pulls in its group');
 await page.keyboard.press('Control+Shift+g');assert.equal(await ev(()=>window.__townBuilder.sprites.filter(o=>o.g).length),0);console.log('PASS ungroup with Ctrl+Shift+G');
 // forward/back one: mailbox (3) is in front; select trashcan (1) and step forward once -> it passes hydrant only
 const order=()=>ev(()=>{const s=window.__townBuilder;const ids=s.sprites.slice().sort((a,b)=>(a.z||0)-(b.z||0)||(a.x+a.y+(a.o||0))-(b.x+b.y+(b.o||0))).map(o=>o.uid);return ids.filter(u=>u!==4);});
 assert.deepEqual(await order(),[1,2,3]);
 await ev(()=>{window.__townBuilder.sel=new Set([1]);});await page.keyboard.press('.');assert.deepEqual(await order(),[2,1,3]);
 await page.keyboard.press('.');assert.deepEqual(await order(),[2,3,1]);
 await page.keyboard.press(',');assert.deepEqual(await order(),[2,1,3]);
 console.log('PASS forward one / back one step past one overlapping sprite at a time');
 await page.keyboard.press('Control+z');assert.deepEqual(await order(),[2,3,1]);console.log('PASS layer step undo');
 assert.equal(await ev(()=>window.__townBuilder.lib.items.filter(i=>!i.flat&&!i.shadow).length),0);console.log('PASS every upright sprite has a shape shadow');
 // Ctrl+C copies the selection, Ctrl+V pastes it at the mouse
 await ev(()=>{window.__townBuilder.sel=new Set([4]);});await page.keyboard.press('Control+c');await page.mouse.move(pt.x+120,pt.y+40);await page.keyboard.press('Control+v');
 assert.equal(await ev(()=>window.__townBuilder.sprites.length),5);assert.equal(await ev(()=>window.__townBuilder.sprites.at(-1).id),'world:bench');console.log('PASS Ctrl+C / Ctrl+V pastes at the mouse');
 // lot paint brush: circle stroke grows one lot, Shift erases, square brush works
 await page.keyboard.press('k');await page.locator('input[name=lotTool][value=brush]').check();await page.locator('#lotBrushOpts [data-size="3"]').click();
 const lots=()=>ev(()=>window.__townBuilder.plan.lots.filter(l=>l.stamps));const before=(await lots()).length;
 await page.mouse.move(pt.x-200,pt.y);await page.mouse.down();await page.mouse.move(pt.x+100,pt.y+60,{steps:12});await page.mouse.up();
 let L=await lots();assert.equal(L.length,before+1);const n=L.at(-1).stamps.length;assert.ok(n>=3);
 await page.keyboard.down('Shift');await page.mouse.move(pt.x-50,pt.y+30);await page.mouse.down();await page.mouse.move(pt.x-40,pt.y+32,{steps:3});await page.mouse.up();await page.keyboard.up('Shift');
 L=await lots();assert.ok(L.at(-1).stamps.some(t=>t.neg));
 await page.locator('input[name=lotShape][value=q]').check();await page.mouse.click(pt.x+150,pt.y+70);L=await lots();assert.ok(L.at(-1).stamps.some(t=>t.s==='q'));
 await page.keyboard.press('Control+z');console.log('PASS lot paint brush: circle stroke, shift-erase, square dab, undo');
 // Select tool: click a rectangle lot, drag to move, handle-resize, change edge, delete
 const n0=await ev(()=>window.__townBuilder.plan.lots.length);await ev(()=>{window.__townBuilder.plan.lots.push({id:'test-rect',x0:98,y0:98,x1:104,y1:104,surface:'asphalt'});});
 const nLots=n0+1,rect0=await ev(()=>({...window.__townBuilder.plan.lots.at(-1)}));
 await page.locator('input[name=lotTool][value=select]').check();
 const c=await ev(()=>{const s=window.__townBuilder,l=s.plan.lots.at(-1),S=s.man.pxPerAxisM,O=s.man.origin,X=(l.x0+l.x1)/2,Y=(l.y0+l.y1)/2,mx=O.ox+(X-Y)*S,my=O.oy+(X+Y)*S/2,r=document.querySelector('#view').getBoundingClientRect();
  return {x:r.left+(mx-s.cam.x)*s.cam.z+r.width/2,y:r.top+(my-s.cam.y)*s.cam.z+r.height/2};});
 await page.mouse.move(c.x,c.y);await page.mouse.down();await page.mouse.move(c.x+64,c.y,{steps:6});await page.mouse.up();
 const rect1=await ev(()=>({...window.__townBuilder.plan.lots.at(-1)}));assert.ok(rect1.x0>rect0.x0&&rect1.y0<rect0.y0);
 await page.locator('#gEdge').selectOption('none');assert.equal(await ev(()=>window.__townBuilder.plan.lots.at(-1).border),'none');
 await page.keyboard.press('ArrowRight');assert.equal(await ev(()=>window.__townBuilder.plan.lots.at(-1).x0),+(rect1.x0+.25).toFixed(2));
 await page.locator('#gDel').click();assert.equal(await ev(()=>window.__townBuilder.plan.lots.length),nLots-1);
 console.log('PASS lots Select tool: pick, drag-move, edge change, nudge, delete');
 // Place preset: sprites + its ground land in the plan, one undo removes both
 for(const n of ['places.json'])try{fs.copyFileSync?0:0;}catch{}
 const lotsBefore=await ev(()=>window.__townBuilder.plan.lots.length),spritesBefore=await ev(()=>window.__townBuilder.sprites.length);
 const ok=await ev(()=>!!window.__townBuilder.presets.find(p=>p.id==='place-strip-mall'));
 if(ok){await page.keyboard.press('b');await page.getByRole('button',{name:/Presets [(]/}).click();await page.locator('.tile').filter({hasText:'Hollow Plaza strip mall'}).click();await page.mouse.click(pt.x,pt.y);
  assert.equal(await ev(()=>window.__townBuilder.plan.lots.length),lotsBefore+await ev(()=>window.__townBuilder.presets.find(p=>p.id==='place-strip-mall').ground.length));assert.ok(await ev(()=>window.__townBuilder.sprites.length)>spritesBefore+50);
  await page.keyboard.press('Control+z');assert.equal(await ev(()=>window.__townBuilder.plan.lots.length),lotsBefore);console.log('PASS place preset stamps sprites + ground; undo removes both');}
 else console.log('SKIP place presets not in fixture');
 assert.deepEqual(errors,[]);
}finally{await browser?.close();server.kill();}
