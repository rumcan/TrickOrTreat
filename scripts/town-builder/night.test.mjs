/** Night lighting in the builder on a throwaway copy of the town: the panel appears, the preview washes the map blue
 *  and keeps colour round the lamps, a setting saves into plan.night, and N toggles the preview.
 *  node scripts/town-builder/night.test.mjs   -> screenshots in output/town-builder/network-review/night-<time>/ */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright-core';
import {ROOT} from '../lib/town-scene.mjs';
const live=path.join(ROOT,'output/town-builder'),data=path.join(live,'network-review','night-'+Date.now()),port=5194,url=`http://127.0.0.1:${port}`;
await fs.mkdir(path.join(data,'plans'),{recursive:true});
await fs.copyFile(path.join(live,'layout.json'),path.join(data,'layout.json'));await fs.copyFile(path.join(live,'plans/maple-falls.json'),path.join(data,'plans/maple-falls.json'));
const server=spawn(process.execPath,['scripts/town-builder/server.mjs','--port',String(port),'--data',data,'--assets',live],{stdio:'ignore',windowsHide:true});
let browser;const errors=[];
try{
 for(let n=0;n<150;n++){try{if((await fetch(url+'/api/plan')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await (await browser.newContext({viewport:{width:1600,height:950}})).newPage();page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>localStorage.setItem('mf-welcomed','1'));await page.goto(url);await page.waitForFunction(()=>window.__townBuilder?.ready&&window.__townSharing?.connected);
 await page.evaluate(()=>{const s=window.__townBuilder,l=s.sprites.find(o=>o.id==='world:streetlamp');s.cam={x:s.man.origin.ox+(l.x-l.y)*32,y:s.man.origin.oy+(l.x+l.y)*16,z:.55};document.querySelector('#nightPanel').open=true;window.dispatchEvent(new Event('resize'));});
 await page.waitForTimeout(4000);await page.screenshot({path:path.join(data,'night-on.png')});
 await page.keyboard.press('n');await page.waitForTimeout(1500);await page.screenshot({path:path.join(data,'night-off.png')});await page.keyboard.press('n');
 await page.locator('[data-n="strength"]').fill('0.9');await page.locator('[data-n="strength"]').dispatchEvent('input');
 await page.waitForTimeout(1500);const plan=await (await fetch(url+'/api/plan')).json();assert.equal(plan.night?.strength,0.9,'strength saved to the plan');
 assert.deepEqual(errors,[]);console.log('PASS night lighting; screenshots in',data);
}finally{await browser?.close();server.kill();}
