import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import sharp from 'sharp';
import {chromium} from 'playwright-core';
import {ROOT} from '../lib/town-scene.mjs';
import {fencePoint,repairLegacyFenceRuns,alignFenceRun} from './app/fence-projection.js';
const live=path.join(ROOT,'output/town-builder'),lib=JSON.parse(await fs.readFile(path.join(live,'library/library.json'),'utf8'));
const items=new Map(lib.items.map(i=>[i.id,i])),fences=lib.items.filter(i=>i.fence);
const near=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-8,label+': '+a+' / '+b);
for(const i of fences){
 const p=i.fence,L=fencePoint(p,p.left.x,p.left.bottom),R=fencePoint(p,p.right.x,p.right.bottom);
 const LT=fencePoint(p,p.left.x,p.left.top),RT=fencePoint(p,p.right.x,p.right.top);
 near((R.y-L.y)/(R.x-L.x),p.sign*.5,i.id+' base slope');
 near((RT.y-LT.y)/(RT.x-LT.x),p.sign*.5,i.id+' top slope');
 near(L.y-LT.y,R.y-RT.y,i.id+' equal post heights');
 near((R.x-L.x)/p.ratio,p.lengthM*32,i.id+' physical length');
 near(p.postH/p.ratio,p.heightM*32*Math.sqrt(1.5),i.id+' physical height');
}
console.log('PASS '+fences.length+' fences: exact ±0.5 bases/tops, equal post heights and physical lengths');
const id='expansion:chainlink-y',p=items.get(id).fence;
const original=Array.from({length:5},(_,n)=>({uid:n+1,id,x:140+n*.25,y:158-n*3.75,scale:1.05}));
const extra={uid:99,id:'world:trashcan',x:10,y:10};
const repaired=repairLegacyFenceRuns([...original,extra],items);assert.equal(repaired.changed,5);assert.deepEqual(repaired.items.at(-1),extra);
for(let n=1;n<5;n++){near(repaired.items[n].x,repaired.items[0].x,'one grid axis');near(repaired.items[n-1].y-repaired.items[n].y,4.2,'joined section centres');}
assert.equal(repairLegacyFenceRuns(repaired.items,items).changed,0);
const selected=[{uid:1,id,x:100,y:100,scale:1},{uid:2,id,x:100.5,y:104.3,scale:1},{uid:3,id,x:101,y:108.1,scale:1}];
const aligned=alignFenceRun(selected,items);near(aligned[0].x,selected[0].x,'first piece X retained');near(aligned[0].y,selected[0].y,'first piece Y retained');
assert.ok(aligned.every(o=>o.x===100));near(aligned[1].y,104,'second piece join');near(aligned[2].y,108,'third piece join');
console.log('PASS selected-run alignment and one-time legacy repair preserve unrelated placements');
const source=path.join(live,'library',items.get(id).file),hash=b=>createHash('sha256').update(b).digest('hex'),before=hash(await fs.readFile(source));
const response=await fetch('http://127.0.0.1:5190/fence-render/'+encodeURIComponent(id)+'.png');assert.equal(response.status,200);
const native=await response.arrayBuffer(),m=await sharp(Buffer.from(native)).metadata();assert.ok(m.hasAlpha&&m.width>=1000);
assert.equal(hash(await fs.readFile(source)),before);
console.log('PASS high-resolution projected PNG export leaves the painted texture unchanged');
const fixture=path.join(live,'expansion-tests','fences-'+Date.now());await fs.mkdir(path.join(fixture,'plans'),{recursive:true});
await fs.copyFile(path.join(live,'plans/maple-falls.json'),path.join(fixture,'plans/maple-falls.json'));
await fs.writeFile(path.join(fixture,'layout.json'),JSON.stringify({version:1,sprites:original}));
const port=5198,server=spawn(process.execPath,['scripts/town-builder/server.mjs','--port',String(port),'--data',fixture,'--assets',live],{stdio:['ignore','pipe','pipe'],windowsHide:true});
let log='',browser;server.stdout.on('data',b=>log+=b);server.stderr.on('data',b=>log+=b);
try{
 let ready=false;for(let n=0;n<100;n++){try{ready=(await fetch('http://127.0.0.1:'+port+'/api/layout')).ok;if(ready)break;}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready,log);
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:'+port);
 await page.waitForFunction(()=>window.__townBuilder?.man&&window.__townBuilder.sprites.length===5);
 assert.ok(await page.evaluate(()=>window.__townBuilder.sprites.every(o=>o.fencePlaneVersion===1)));
 await page.evaluate(()=>{const s=window.__townBuilder,S=s.man.pxPerAxisM,O=s.man.origin;s.cam={x:O.ox+(140-149.5)*S,y:O.oy+(140+149.5)*S/2-35,z:1};s.show.grid=true;s.show.poi=false;s.mode='select';});
 await page.mouse.move(650,450);await page.waitForTimeout(2000);
 // Alpha hit-test at a projected post: the click must use the corrected mask.
 const click=await page.evaluate(()=>{
  const s=window.__townBuilder,o=s.sprites[2],it=s.items.get(o.id),p=it.fence,k=o.scale||1,S=s.man.pxPerAxisM,O=s.man.origin,r=document.querySelector('#view').getBoundingClientRect();
  const px=p.left.x*p.scale+p.pad,py=p.sign*(p.left.x-p.cx)*p.scale/2-p.postH/2-p.minY+p.pad;
  const mx=O.ox+(o.x-o.y)*S+(px/p.ratio-it.ax)*k,my=O.oy+(o.x+o.y)*S/2+(py/p.ratio-it.ay)*k;
  return {x:r.left+r.width/2+(mx-s.cam.x)*s.cam.z,y:r.top+r.height/2+(my-s.cam.y)*s.cam.z};
 });
 await page.mouse.click(click.x,click.y);assert.ok(await page.evaluate(()=>window.__townBuilder.sel.size>0),'corrected alpha hit-test');
 await page.evaluate(()=>{const s=window.__townBuilder;s.sel=new Set([1,2,3]);s.sprites[1].x+=.25;s.sprites[2].x+=.5;});
 await page.keyboard.press('Control+g');await page.locator('#iAlignFences').click();
 assert.ok(await page.evaluate(()=>{const s=window.__townBuilder,a=s.sprites.filter(o=>s.sel.has(o.uid));return a.length===3&&a.every(o=>Math.abs(o.x-a[0].x)<1e-8);}));
 await page.keyboard.press('Control+z');assert.ok(await page.evaluate(()=>Math.abs(window.__townBuilder.sprites[1].x-window.__townBuilder.sprites[0].x)>.2));
 assert.equal(await page.locator('#iAlignFences').count(),0,'undo clears stale selection controls');
 await page.evaluate(()=>window.__townBuilder.sel=new Set([1,2,3,4,5]));await page.keyboard.press('Control+g');await page.locator('#iAlignFences').click();
 assert.ok(await page.evaluate(()=>{const a=window.__townBuilder.sprites;return a.length===5&&a.every(o=>Math.abs(o.x-a[0].x)<1e-8)&&a.slice(1).every((o,i)=>Math.abs(a[i].y-o.y-4.2)<1e-8);}));
 console.log('PASS browser: corrected masks, Align fence run button and undo');
 // Real drag painting with an intentionally drifting mouse path.
 await page.locator('.tile').filter({has:page.locator('span',{hasText:'Chain-link fence — Y axis'})}).first().click();
 await page.evaluate(()=>{const s=window.__townBuilder;s.brush.scale=1.05;s.brush.flip=false;s.cam.z=.8;});
 const points=await page.evaluate(()=>{const s=window.__townBuilder,S=s.man.pxPerAxisM,O=s.man.origin,r=document.querySelector('#view').getBoundingClientRect();const P=(x,y)=>({x:r.left+r.width/2+(O.ox+(x-y)*S-s.cam.x)*s.cam.z,y:r.top+r.height/2+(O.oy+(x+y)*S/2-s.cam.y)*s.cam.z});return [P(136,150),P(137,162)];});
 await page.mouse.move(points[0].x,points[0].y);await page.mouse.down();await page.mouse.move(points[1].x,points[1].y,{steps:30});await page.mouse.up();
 const stroke=await page.evaluate(()=>window.__townBuilder.sprites.slice(5));assert.ok(stroke.length>=3);
 for(let n=1;n<stroke.length;n++){near(stroke[n].x,stroke[0].x,'drag locks cross axis');near(stroke[n].y-stroke[n-1].y,4.2,'drag joins scaled ends');}
 console.log('PASS browser: drifting drag paints exact joined fence sections');
 assert.deepEqual(errors,[]);
 // Show one repaired run on the real grass/map, with a cyan baseline guide.
 await page.evaluate(()=>{const s=window.__townBuilder;s.sprites=s.sprites.slice(0,5);s.sel.clear();s.mode='select';s.cam.z=1;const t=document.querySelector('#toast');if(t)t.style.display='none';});
 await page.mouse.move(655,455);await page.waitForTimeout(500);
 await page.evaluate(()=>{const s=window.__townBuilder,c=document.querySelector('#view'),r=c.getBoundingClientRect(),ctx=c.getContext('2d'),S=s.man.pxPerAxisM,O=s.man.origin,run=s.sprites.slice(0,5),X=run[0].x,ys=run.map(o=>o.y),P=(Y)=>[(O.ox+(X-Y)*S-s.cam.x)*s.cam.z+r.width/2,(O.oy+(X+Y)*S/2-s.cam.y)*s.cam.z+r.height/2];ctx.save();ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);ctx.strokeStyle='#1fe1e9';ctx.lineWidth=2;ctx.setLineDash([8,8]);ctx.beginPath();ctx.moveTo(...P(Math.min(...ys)-2.1));ctx.lineTo(...P(Math.max(...ys)+2.1));ctx.stroke();ctx.restore();});
 const screenshot=path.join(live,'expansion-review/fences-grid-verified.png');await page.locator('#view').screenshot({path:screenshot});
 console.log('PASS no browser errors; grid verification image: '+screenshot);
}finally{if(browser)await browser.close();server.kill();}
