/** Real rendering, publication, and browser removals in a separate tiny town. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright-core';
import sharp from 'sharp';
import {ROOT,loadSources,buildScene,renderRect} from '../lib/town-scene.mjs';
import {mapDirectory,publishMap} from './map-storage.mjs';
const assets=path.join(ROOT,'output/town-builder'),out=path.join(ROOT,'output/repo-cleanup/road-rebuild'),data=path.join(out,'fixture-'+Date.now());
await fs.mkdir(path.join(data,'plans'),{recursive:true});
const original={nx:4,ny:3,roads:['0,1','1,1','2,1','3,1'],lots:[{id:'test-lot',x0:8,y0:4,x1:22,y1:16,surface:'slab',border:'none'}],paving:[{id:'test-path',x0:46,y0:4,x1:56,y1:14,border:'none'}],reflections:[{x:52,y:30,free:true,strength:1,scale:1}],pois:[]};
const planFile=path.join(data,'plans/maple-falls.json');await fs.writeFile(planFile,JSON.stringify(original));await fs.writeFile(path.join(data,'layout.json'),JSON.stringify({sprites:[]}));
async function bake(file){const child=spawn(process.execPath,['scripts/town-builder/bake-run.mjs',file,data,'--zoom','.2','--workers','1'],{windowsHide:true});let log='';child.stdout.on('data',d=>log+=d);child.stderr.on('data',d=>log+=d);await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error(log)));});const status=JSON.parse(await fs.readFile(path.join(data,'bake-status.json'),'utf8'));assert.equal(status.code,0,status.log.join('\n'));return mapDirectory(data);}
const before=await bake(planFile);console.log('PASS initial real ground bake publishes a complete version');
const port=5199,url='http://127.0.0.1:'+port,server=spawn(process.execPath,['scripts/town-builder/server.mjs','--port',String(port),'--data',data,'--assets',assets],{windowsHide:true,stdio:'ignore'});let browser;
try{
 for(let n=0;n<100;n++){try{if((await fetch(url+'/api/plan')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1500,height:960}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>localStorage.setItem('mf-welcomed','1'));await page.goto(url);await page.waitForFunction(()=>window.__townBuilder?.miniImg?.naturalWidth>0);
 await page.evaluate(()=>{const s=window.__townBuilder;s.cam={x:s.man.origin.ox+(40-25)*s.man.pxPerAxisM,y:s.man.origin.oy+(40+25)*s.man.pxPerAxisM/2,z:1.25};});
 async function point(X,Y){return page.evaluate(([X,Y])=>{const s=window.__townBuilder,r=document.querySelector('#view').getBoundingClientRect();return {x:r.x+r.width/2+(s.man.origin.ox+(X-Y)*s.man.pxPerAxisM-s.cam.x)*s.cam.z,y:r.y+r.height/2+(s.man.origin.oy+(X+Y)*s.man.pxPerAxisM/2-s.cam.y)*s.cam.z};},[X,Y]);}
 async function click(X,Y){const a=await point(X,Y);await page.mouse.click(a.x,a.y);}
 async function drag(X0,Y0,X1,Y1){const a=await point(X0,Y0),b=await point(X1,Y1);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:20});await page.mouse.up();}
 const roadCount=()=>page.evaluate(()=>window.__townBuilder.plan.roads.length);
 await page.locator('[data-mode=roads]').click();await click(10,30);assert.equal(await roadCount(),4); // add is idempotent
 await page.locator('input[name=roadTool][value=remove]').check();await drag(10,30,70,30);assert.equal(await roadCount(),0);assert.match(await page.locator('#taskTitle').innerText(),/Removing roads/);
 await page.waitForTimeout(400);await page.screenshot({path:path.join(out,'remove-roads.png')});
 await page.keyboard.press('Control+z');assert.equal(await roadCount(),4);await page.keyboard.press('Control+y');assert.equal(await roadCount(),0);
 await page.locator('input[name=roadTool][value=add]').check();await drag(10,30,70,30);assert.equal(await roadCount(),4);await drag(10,30,70,30);assert.equal(await roadCount(),4);
 await page.keyboard.down('Shift');await drag(10,30,70,30);await page.keyboard.up('Shift');assert.equal(await roadCount(),0);
 console.log('PASS build/remove drag tools, repeated strokes, Shift erase, whole-stroke undo and redo');
 await page.locator('[data-mode=lots]').click();await click(15,10);await page.locator('#gDel').click();await click(51,9);await page.locator('#gDel').click();
 await page.locator('[data-mode=lamps]').click();await page.locator('#groundErase').check();await click(52,30);
 assert.deepEqual(await page.evaluate(()=>{const p=window.__townBuilder.plan;return[p.lots.length,p.paving.length,p.reflections.length];}),[0,0,0]);
 await page.waitForTimeout(900);await page.reload();await page.waitForFunction(()=>window.__townBuilder?.man);assert.equal(await page.evaluate(()=>window.__townBuilder.planDirty),true);
 console.log('PASS lot/path/glow deletion and pending rebuild state survives reload');
 const edited=JSON.parse(await fs.readFile(planFile,'utf8')),frozen=path.join(data,'bake-plan-test.json');await fs.writeFile(frozen,JSON.stringify(edited));
 const after=await bake(frozen);assert.notEqual(after,before);assert.ok((await fs.stat(before)).isDirectory());
 const man=JSON.parse(await fs.readFile(path.join(after,'manifest.json'),'utf8'));assert.equal(man.groundPlan.roads.length,0);assert.equal(man.groundPlan.lots.length,0);assert.equal(man.groundPlan.paving.length,0);assert.equal(man.groundPlan.reflections.length,0);
 // Exact pixel comparison against a fresh empty scene proves no old surfaces remain.
 const sources=await loadSources(.2),scene=buildScene(edited,sources),w=Math.min(1024,man.width),h=Math.min(1024,man.height);
 const expected=await sharp(renderRect(scene,0,0,w,h),{raw:{width:w,height:h,channels:4}}).removeAlpha().raw().toBuffer();
 const actual=await sharp(path.join(after,'full/0_0.png')).removeAlpha().raw().toBuffer();assert.ok(actual.equals(expected),'Rebuild must equal freshly rendered grass');
 const previous=await sharp(path.join(before,'full/0_0.png')).removeAlpha().raw().toBuffer();assert.ok(!actual.equals(previous),'Deleted features must change the ground pixels');
 console.log('PASS deleted roads/lots/paving/glow are gone from actual baked pixels');
 await page.evaluate(()=>window.__townBuilderLiveUpdate({map:true}));await page.waitForFunction(()=>!window.__townBuilder.planDirty);await page.locator('[data-mode=roads]').click();
 assert.equal((await (await fetch(url+'/map/manifest.json')).json()).bakedAt,man.bakedAt);
 await page.waitForTimeout(600);await page.screenshot({path:path.join(out,'after-rebuild.png')});
 // A broken/incomplete version must never replace the installed map.
 const incomplete=path.join(data,'map-version-incomplete');await fs.mkdir(incomplete);await fs.writeFile(path.join(incomplete,'manifest.json'),JSON.stringify(man));
 await assert.rejects(publishMap(data,incomplete));assert.equal(await mapDirectory(data),after);
 console.log('PASS server serves new map, previous map stays intact, incomplete map cannot publish');
 // Two builders requesting the same rebuild must launch only one job with a frozen accepted plan.
 const requests=await Promise.all([fetch(url+'/api/bake',{method:'POST'}),fetch(url+'/api/bake',{method:'POST'})]);assert.deepEqual(requests.map(r=>r.status).sort(),[200,409]);
 const inputs=(await fs.readdir(data)).filter(f=>/^bake-plan-\d+\.json$/.test(f));assert.equal(inputs.length,1);assert.deepEqual(JSON.parse(await fs.readFile(path.join(data,inputs[0]),'utf8')),await (await fetch(url+'/api/plan')).json());
 let status;for(let n=0;n<240;n++){status=await (await fetch(url+'/api/bake')).json();if(!status.running)break;await new Promise(r=>setTimeout(r,250));}assert.equal(status.code,0,status.log?.join('\n'));assert.equal(status.running,false);
 const published=await mapDirectory(data);assert.notEqual(published,after);assert.deepEqual(JSON.parse(await fs.readFile(path.join(published,'manifest.json'),'utf8')).groundPlan.roads,[]);
 console.log('PASS concurrent rebuild requests start one job and publish the frozen accepted plan');
 assert.deepEqual(errors,[]);
}finally{await browser?.close();server.kill();}
