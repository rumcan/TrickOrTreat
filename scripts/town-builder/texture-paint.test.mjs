/** Ground paint brush on a throwaway copy of the town: picking a dab sets its spacing, a drag lays an even stroke on
 *  the lowest layer, slab dabs snap to the 2.5 m slab grid. node scripts/town-builder/texture-paint.test.mjs */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright-core';
import {ROOT} from '../lib/town-scene.mjs';
const live=path.join(ROOT,'output/town-builder'),data=path.join(live,'network-review','paint-'+Date.now()),port=5195,url=`http://127.0.0.1:${port}`;
await fs.mkdir(path.join(data,'plans'),{recursive:true});
await fs.writeFile(path.join(data,'layout.json'),JSON.stringify({version:1,sprites:[]}));await fs.copyFile(path.join(live,'plans/maple-falls.json'),path.join(data,'plans/maple-falls.json'));
const server=spawn(process.execPath,['scripts/town-builder/server.mjs','--port',String(port),'--data',data,'--assets',live],{stdio:'ignore',windowsHide:true});
let browser;const errors=[];
try{
 for(let n=0;n<150;n++){try{if((await fetch(url+'/api/plan')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await (await browser.newContext({viewport:{width:1600,height:950}})).newPage();page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>localStorage.setItem('mf-welcomed','1'));await page.goto(url);await page.waitForFunction(()=>window.__townBuilder?.ready&&window.__townSharing?.connected);
 await page.evaluate(()=>{const s=window.__townBuilder;s.cam={x:s.man.origin.ox,y:s.man.origin.oy+60*s.man.pxPerAxisM,z:.8};});
 const point=(X,Y)=>page.evaluate(([X,Y])=>{const s=window.__townBuilder,r=document.querySelector('#view').getBoundingClientRect();return {x:r.x+r.width/2+(s.man.origin.ox+(X-Y)*s.man.pxPerAxisM-s.cam.x)*s.cam.z,y:r.y+r.height/2+(s.man.origin.oy+(X+Y)*s.man.pxPerAxisM/2-s.cam.y)*s.cam.z};},[X,Y]);
 await page.getByRole('button',{name:/^Ground paint/}).click();
 await page.locator('#palette [title*="paint:slabs-blob-4m-1"]').first().click();
 assert.equal(await page.inputValue('#bSpacing'),'2.5');assert.equal(await page.isChecked('#bRandFlip'),true);
 const a=await point(52,62),b=await point(70,62);await page.mouse.move(a.x,a.y);await page.mouse.down();for(let i=1;i<=20;i++)await page.mouse.move(a.x+(b.x-a.x)*i/20,a.y+(b.y-a.y)*i/20);await page.mouse.up();
 await page.waitForFunction(()=>window.__townBuilder.saved,null,{timeout:10000});
 const placed=await page.evaluate(()=>window.__townBuilder.sprites.filter(o=>o.id.startsWith('paint:')));
 assert.ok(placed.length>=6,'stroke laid '+placed.length);
 for(const o of placed){assert.equal(o.z,-100);assert.equal(Math.abs(o.x/2.5-Math.round(o.x/2.5))<1e-6&&Math.abs(o.y/2.5-Math.round(o.y/2.5))<1e-6,true,'snapped '+o.x+','+o.y);}
 const saved=await (await fetch(url+'/api/layout')).json();assert.equal(saved.sprites.filter(o=>o.id.startsWith('paint:')).length,placed.length);
 await page.screenshot({path:path.join(data,'paint-stroke.png')});
 assert.deepEqual(errors,[]);console.log(`PASS ground paint: spacing 2.5, mirror on, ${placed.length} dabs on 2.5 m grid at layer -100, saved; screenshot ${path.join(data,'paint-stroke.png')}`);
}finally{await browser?.close();server.kill();}
