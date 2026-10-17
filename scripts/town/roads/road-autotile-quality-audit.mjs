/** Audit the exported v2 art, including every E/W and N/S join, not just same sockets. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import crypto from 'node:crypto';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import {ROAD,PORTS,project,unproject} from '../../lib/road-autotile.mjs';
import {field,variantFor} from '../../lib/road-autotile-quality.mjs';
import {ROOT} from '../../lib/town-paths.mjs';
const out=path.join(ROOT,'output/road-autotile-v2'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const atlas=JSON.parse(await fs.readFile(path.join(out,'atlas.json'),'utf8'));
const audit={dateUTC:new Date().toISOString(),version:2,scope:'Road art prototype only; no live/mobile gameplay or production feature completion',sourceReceipts:[],layers:[],geometryNotes:'Run node --test scripts/town/roads/road-autotile*.test.mjs separately',joins:{pairs:0,samples:0,pixelMismatches:0,alphaGaps:0},accents:{partialPaintPixels:0,lightAsphaltPixels:0,lightSidewalkPixels:0},browser:{status:'not run'},warnings:[]};
const curbFile=path.resolve(out,'../road-autotile-v1/native/material-master.png'),curbMaster=await fs.readFile(curbFile),curbProfile=JSON.parse(await fs.readFile(path.resolve(out,'../road-autotile-v1/sources/profile.json'),'utf8'));
assert.equal(hash(curbMaster),curbProfile.sha);audit.curbSource={file:curbFile,sha:hash(curbMaster),sample:{left:675,top:1150,width:20,height:25},method:'Average a narrow painted curb cross section; do not import a whole foreign sidewalk'};
for(const s of atlas.sources){
 const b=await fs.readFile(path.join(out,'native',s.id+'.png')),m=await sharp(b).metadata(),r=JSON.parse(await fs.readFile(path.join(out,'native',s.id+'.json'),'utf8'));
 assert.equal(hash(b),s.sha);assert.equal(r.sha,s.sha);assert.equal(m.width,s.width);assert.equal(m.height,s.height);
 for(const ref of r.referenceHashes)assert.equal(hash(await fs.readFile(ref.path)),ref.sha);
 audit.sourceReceipts.push({id:s.id,width:m.width,height:m.height,hasAlpha:m.hasAlpha,sha:s.sha});
}
const bases=[];
for(const a of atlas.assets){
 for(const file of [a.file,a.lines,a.light,a.sidewalkLeaves,a.gutterLeaves]){
  const b=await fs.readFile(path.join(out,'tiles',file)),m=await sharp(b).metadata();assert.equal(m.width,1024);assert.equal(m.height,512);assert.equal(m.hasAlpha,true);
  audit.layers.push({file,bytes:b.length});
  const raw=await sharp(b).ensureAlpha().raw().toBuffer();
  if(file===a.file){assert.equal(hash(b),a.sha);bases[a.mask]=raw;}
  if(file===a.lines)for(let i=3;i<raw.length;i+=4)if(raw[i]>0&&raw[i]<255)audit.accents.partialPaintPixels++;
  if(file===a.light)for(let i=3;i<raw.length;i+=4)if(raw[i]>128){const p=(i-3)/4,q=unproject(p%1024+.5,Math.floor(p/1024)+.5),v=field(a.mask,q.x,q.y);if(v.type==='asphalt')audit.accents.lightAsphaltPixels++;else if(v.type==='sidewalk')audit.accents.lightSidewalkPixels++;}
 }
 for(const category of ['sidewalk','gutter'])for(const l of a.leaves[category]){assert.ok(l.lengthM>=.12&&l.lengthM<=.25);assert.ok(Number.isFinite(l.angle));}
}
function pixel(mask,p){const x=Math.floor(p.x),y=Math.floor(p.y);if(x<0||y<0||x>=1024||y>=512)return [0,0,0,0];const o=(y*1024+x)*4;return [...bases[mask].subarray(o,o+4)];}
function pair(a,b,p,dx,dy){const first=pixel(a,project(p.x,p.y)),second=pixel(b,project(p.x-dx,p.y-dy)),sa=first[3]/255,sb=second[3]/255,alpha=sb+sa*(1-sb);if(!alpha)return[0,0,0,0];return [0,1,2].map(k=>Math.round((second[k]*sb+first[k]*sa*(1-sb))/alpha)).concat(Math.round(alpha*255));}
for(const port of [PORTS[1],PORTS[2]]){
 const horizontal=port.name==='E',ref=horizontal?10:5,dx=horizontal?16:0,dy=horizontal?0:16;
 for(let a=1;a<16;a++)for(let b=1;b<16;b++){
  if(!(a&port.bit)||!(b&port.opposite))continue;audit.joins.pairs++;
  for(let along=-.8;along<=.8;along+=.073)for(let cross=-4.8;cross<=4.8;cross+=.091){
   const p=horizontal?{x:16+along,y:8+cross}:{x:8+cross,y:16+along},actual=pair(a,b,p,dx,dy),expected=pair(ref,ref,p,dx,dy);
   if(actual.some((v,k)=>v!==expected[k]))audit.joins.pixelMismatches++;
   if(actual[3]<255)audit.joins.alphaGaps++;audit.joins.samples++;
  }
 }
}
assert.equal(audit.joins.pairs,128);assert.equal(audit.joins.pixelMismatches,0,'Actual opposite-port base pixels do not match continuous straight material');assert.equal(audit.joins.alphaGaps,0,'Transparent crack at an actual joined socket');
assert.ok(audit.accents.partialPaintPixels>5000);assert.ok(audit.accents.lightAsphaltPixels>1000);assert.ok(audit.accents.lightSidewalkPixels>100);
audit.memory={layersDecodedMiB:atlas.assets.length*5*1024*512*4/1024**2,layerFilesMiB:audit.layers.reduce((n,a)=>n+a.bytes,0)/1024**2,fullProofDecodedMiB:7168*3584*4/1024**2};
audit.warnings.push('Authoring uses 80 editable layers (160 MiB decoded). Do not preload these in gameplay: bake visible static chunks first.');
audit.warnings.push('Connector tests establish base pixel/alpha continuity, not automatic visual acceptance of every style choice or future typed road adapter.');
if(process.argv.includes('--browser')){
 const {chromium}=await import('playwright-core'),browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  audit.browser={status:'pass',checks:[],scope:'Art editor at DPR 1/2 and mobile portrait viewport, NOT the game'};
  for(const config of [{name:'desktop',width:1440,height:1000,dpr:1},{name:'retina',width:1440,height:1000,dpr:2},{name:'phone',width:390,height:844,dpr:2}]){
   const context=await browser.newContext({viewport:{width:config.width,height:config.height},deviceScaleFactor:config.dpr}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(pathToFileURL(path.join(out,'review/road-builder.html')).href);await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('25 sections'));
   await page.locator('#clear').click();await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('0 sections'));
   await page.locator('#reset').click();await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('25 sections'));
   await page.locator('#zoom').evaluate(e=>{e.value='100';e.dispatchEvent(new Event('input'));});
   const state=await page.evaluate(()=>({canvas:{width:canvas.width,height:canvas.height,cssWidth:canvas.getBoundingClientRect().width},view:{width:view.clientWidth,height:view.clientHeight},dpr:devicePixelRatio,zoom:document.getElementById('zoom-value').textContent,smoothing:ctx.imageSmoothingEnabled,quality:ctx.imageSmoothingQuality}));
   assert.equal(state.zoom,'100%');assert.equal(state.canvas.width,Math.round(state.view.width*config.dpr));assert.ok(state.canvas.width*state.canvas.height<config.width*config.height*config.dpr**2);assert.equal(state.smoothing,true);
   await page.locator('#lines').uncheck();await page.locator('#lights').uncheck();await page.locator('#leaves').uncheck();await page.locator('#lines').check();await page.locator('#lights').check();await page.locator('#leaves').check();
   // DPR-aware pointer hit test on empty section 4,4 after panning to its centre.
   await page.evaluate(()=>{view.scrollLeft=4608-view.clientWidth/2;view.scrollTop=2304-view.clientHeight/2;});
   const r=await page.locator('#view').boundingBox();await page.mouse.click(r.x+r.width/2,r.y+r.height/2);
   await page.waitForFunction(()=>cells.has('4,4'));assert.equal(await page.evaluate(()=>cells.size),26);
   await page.locator('#erase').click();await page.mouse.click(r.x+r.width/2,r.y+r.height/2);await page.waitForFunction(()=>!cells.has('4,4'));assert.equal(await page.evaluate(()=>cells.size),25);
   assert.deepEqual(errors,[]);await page.screenshot({path:path.join(out,'review',`browser-${config.name}.png`)});
   audit.browser.checks.push({...config,state,pageErrors:errors,clearReset:true,toggles:true,nativeZoom:true,buildEraseHitTest:true});await context.close();
  }
 }finally{await browser.close();}
}
await fs.writeFile(path.join(out,'validation.json'),JSON.stringify({pass:true,...audit},null,2));
console.log(JSON.stringify({pass:true,sources:audit.sourceReceipts.length,layers:audit.layers.length,joins:audit.joins,accents:audit.accents,memory:audit.memory,browser:audit.browser,report:path.join(out,'validation.json')}));
