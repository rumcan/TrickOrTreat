/** Read-only live-server test. Client-side test state is never saved to the owner's map. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const url='http://127.0.0.1:5190';
const before=await Promise.all(['/api/layout','/api/plan'].map(async p=>await (await fetch(url+p)).text()));
const revisions=await (await fetch(url+'/api/live')).json();
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1680,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 let responses=0;await page.route('**/api/live',async route=>{responses++;await route.fulfill({json:revisions});});
 await page.goto(url);await page.waitForFunction(()=>window.__townBuilder?.man&&window.__townBuilder.presets.length>0);
 await page.waitForFunction(()=>window.__townBuilder.lib.items.filter(i=>i.id.startsWith('arcade:')).length===35);
 while(responses<1)await page.waitForTimeout(200);
 const state=await page.evaluate(()=>{const s=window.__townBuilder;s.cam={x:7000,y:3000,z:.8};s.undo=['live-test-sentinel'];s.saved=false;return JSON.stringify({sprites:s.sprites,cam:s.cam,undo:s.undo});});
 revisions.library+=':test-update';await page.waitForTimeout(2400);
 assert.equal(await page.evaluate(()=>window.__townBuilder.libraryVer),undefined,'Must defer updates while edits are unsaved');
 await page.evaluate(()=>window.__townBuilder.saved=true);
 await page.waitForFunction(()=>window.__townBuilder.libraryVer>0);
 assert.equal(await page.evaluate(()=>JSON.stringify({sprites:window.__townBuilder.sprites,cam:window.__townBuilder.cam,undo:window.__townBuilder.undo})),state,'Asset updates must preserve editing state');
 console.log('PASS automatic library refresh, unsaved-edit deferral and state preservation');
 const version=await page.evaluate(()=>window.__townBuilder.ver);revisions.map+=':test-update';
 await page.waitForFunction(v=>window.__townBuilder.ver!==v,version);
 assert.equal(await page.evaluate(()=>JSON.stringify(window.__townBuilder.cam)),JSON.stringify({x:7000,y:3000,z:.8}));
 console.log('PASS completed ground update preserves camera');
 revisions.app+=':test-update';await page.waitForEvent('load');
 await page.waitForFunction(()=>window.__townBuilder?.cam.x===7000&&window.__townBuilder.cam.y===3000&&window.__townBuilder.cam.z===.8);
 console.log('PASS app reload restores camera');assert.deepEqual(errors,[]);
 const after=await Promise.all(['/api/layout','/api/plan'].map(async p=>await (await fetch(url+p)).text()));assert.deepEqual(after,before,'Owner map must remain untouched');
 console.log('PASS saved layout and ground plan unchanged');
}finally{await browser.close();}
