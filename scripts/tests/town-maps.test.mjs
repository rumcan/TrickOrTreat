import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {chromium} from 'playwright-core';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),shared=path.join(ROOT,'output/town-builder');
const builder=path.join(ROOT,'scripts/town-builder');
const out=path.join(ROOT,'output/town-map-tests',String(Date.now()));await fs.mkdir(out,{recursive:true});
const digest=async file=>createHash('sha256').update(await fs.readFile(file)).digest('hex');
const protectedFiles=['layout.json','plans/maple-falls.json','map-current.json'].map(p=>path.join(shared,p));
const original=await Promise.all(protectedFiles.map(digest));
const servers=[];let browser;
try{
 for(const [index,port] of [5194,5195].entries()){
  const data=path.join(out,String(port));await fs.mkdir(path.join(data,'plans'),{recursive:true});await fs.mkdir(path.join(data,'map/tiles/0'),{recursive:true});await fs.mkdir(path.join(data,'map/full'),{recursive:true});
  const plan={name:'Isolation '+index,nx:1,ny:1,roads:[],lots:[],pois:[],paving:[],reflections:[],lampLayerVersion:2};
  await fs.writeFile(path.join(data,'plans/maple-falls.json'),JSON.stringify(plan));await fs.writeFile(path.join(data,'layout.json'),JSON.stringify({version:1,plan:'maple-falls.json',sprites:[]}));
  const img=sharp({create:{width:512,height:512,channels:3,background:'#30452a'}});
  await img.clone().webp().toFile(path.join(data,'map/tiles/0/0_0.webp'));await img.clone().webp().toFile(path.join(data,'map/preview.webp'));await img.clone().png().toFile(path.join(data,'map/full/0_0.png'));
  const manifest={width:512,height:512,tileSize:1024,levels:[{level:0,width:512,height:512,cols:1,rows:1}],pxPerAxisM:32,origin:{ox:256,oy:100},nx:1,ny:1,cellM:20,groundPlan:{...plan,lines:{}},bakedAt:new Date().toISOString()};
  await fs.writeFile(path.join(data,'map/manifest.json'),JSON.stringify(manifest));
  servers.push(spawn(process.execPath,[path.join(builder,'server.mjs'),'--port',String(port),'--data',data,'--assets',shared],{cwd:ROOT,windowsHide:true,stdio:'ignore'}));
  let ready=false;for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${port}/api/plan`)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready,'Fixture server started');
 }
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1500,height:960}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>localStorage.setItem('mf-welcomed','1'));
 await page.route('**/app/maps.json',route=>route.fulfill({json:{maps:[{id:'test-a',name:'Isolation A',port:5194},{id:'test-b',name:'Isolation B',port:5195}]}}));
 await page.goto('http://127.0.0.1:5194/');await page.waitForFunction(()=>window.__townBuilder?.ready);
 await page.locator('.tile[title*="world:pumpkin_0"]').click();await page.locator('#view').click();
 await page.waitForFunction(()=>window.__townBuilder.sprites.length===1&&window.__townBuilder.saved);
 const a=()=>fetch('http://127.0.0.1:5194/api/layout').then(r=>r.json()),b=()=>fetch('http://127.0.0.1:5195/api/layout').then(r=>r.json());
 assert.equal((await a()).sprites.length,1);assert.equal((await b()).sprites.length,0);
 await page.reload();await page.waitForFunction(()=>window.__townBuilder?.ready);assert.equal(await page.evaluate(()=>window.__townBuilder.sprites.length),1);
 await page.locator('[data-mode=roads]').click();await page.locator('#view').click();await page.waitForFunction(()=>window.__townBuilder.plan.roads.length===1&&!window.__townBuilder.planSavePending);
 assert.equal((await fetch('http://127.0.0.1:5195/api/plan').then(r=>r.json())).roads.length,0);
 const presets=await fetch('http://127.0.0.1:5194/api/presets').then(r=>r.json());assert.ok(presets.presets.length,'Shared presets are available');
 const exported=await fetch('http://127.0.0.1:5194/api/export',{method:'POST'});assert.equal(exported.status,200,await exported.text());
 // Switch immediately after placing an object: the picker must flush the pending debounce first.
 await page.locator('.tile[title*="world:pumpkin_0"]').click();await page.locator('#view').click();
 await page.locator('#mapSelect').selectOption('test-b');await page.waitForURL('http://127.0.0.1:5195/');await page.waitForFunction(()=>window.__townBuilder?.ready);
 assert.equal((await a()).sprites.length,2);assert.equal((await b()).sprites.length,0);assert.equal(await page.locator('#mapName').innerText(),'Isolation B');
 await page.locator('#mapSelect').selectOption('test-a');await page.waitForURL('http://127.0.0.1:5194/');await page.waitForFunction(()=>window.__townBuilder?.ready);
 assert.equal(await page.evaluate(()=>window.__townBuilder.sprites.length),2);
 // A missing independent ground bake must never display the existing town as a fallback.
 const mf=path.join(out,'5195/map/manifest.json');await fs.rename(mf,mf+'.hold');assert.equal((await fetch('http://127.0.0.1:5195/map/manifest.json')).status,404);await fs.rename(mf+'.hold',mf);
 assert.deepEqual(await Promise.all(protectedFiles.map(digest)),original,'Existing town layout, plan and bake pointer remain byte-identical');assert.deepEqual(errors,[]);
 await page.screenshot({path:path.join(out,'independent-edit.png')});
 console.log('PASS independent saves, map switching flushes pending edits, reload, shared presets, isolated export, missing-ground protection; original town unchanged.');
}finally{await browser?.close();for(const server of servers)server.kill();}
