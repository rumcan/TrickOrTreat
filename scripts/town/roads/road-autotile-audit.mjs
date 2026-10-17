/** Read existing road assets, record planning evidence; never rewrite source art. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import crypto from 'node:crypto';
import sharp from 'sharp';
import {ROAD, unproject, surface, socket} from '../../lib/road-autotile.mjs';
import {ROOT} from '../../lib/town-paths.mjs';

const delivery=path.join(ROOT, 'output/road-autotile-v1');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const atlas=JSON.parse(await fs.readFile(path.join(delivery, 'atlas.json'), 'utf8'));
const priorCheck=JSON.parse(await fs.readFile(path.join(delivery, 'validation.json'), 'utf8'));
const audit={
 schemaVersion:1,
 measuredAtUTC:new Date().toISOString(),
 scope:'Existing art prototype only; not production gameplay or phone performance',
 sourceImages:[], nativeReceipts:[], layers:[], lights:[], warnings:[],
 checks:{samePortPixels:priorCheck,oppositePortSeams:'NOT COVERED by the existing check',geometryTests:'Run node --test scripts/town/roads/road-autotile.test.mjs separately'},
 sourceDetail:{
  asphaltCrop:{width:92,height:152},
  asphaltSampler:{worldRepeatM:4,overlapPixels:{x:14,y:24},effectiveSamplePixels:{x:78,y:128},effectiveSourcePxPerAuthoredMetre:{x:19.5,y:32},sourceRectification:'Not independently verified; sampling density is not a guarantee of material fidelity'},
  curbPavementProfile:{width:178,height:108},nativeResolutionClaim:false,
 },
 browser:{status:'not run'},
};
for(const relative of ['sources/reference.png', 'native/material-master.png']){
 const b=await fs.readFile(path.join(delivery, relative)), m=await sharp(b).metadata();
 audit.sourceImages.push({file:relative,width:m.width,height:m.height,hasAlpha:m.hasAlpha,sha256:hash(b)});
}
for(const name of (await fs.readdir(path.join(delivery,'native'))).filter(n=>n.endsWith('.json')).sort()){
 const receipt=JSON.parse(await fs.readFile(path.join(delivery,'native',name),'utf8'));
 const b=await fs.readFile(path.join(delivery,'native',receipt.id+'.png')), m=await sharp(b).metadata();
 if(hash(b)!==receipt.sha||m.width!==receipt.width||m.height!==receipt.height)throw Error('Native receipt mismatch: '+name);
 for(const ref of receipt.referenceHashes)if(hash(await fs.readFile(ref.path))!==ref.sha)throw Error('Reference changed: '+ref.path);
 audit.nativeReceipts.push({id:receipt.id,width:m.width,height:m.height,hasAlpha:m.hasAlpha,sha256:hash(b),recordedReview:receipt.review});
}
for(const a of atlas.assets){
 for(const file of [a.file,a.lines,a.light,a.sidewalkLeaves,a.gutterLeaves]){
  const b=await fs.readFile(path.join(delivery,'tiles',file)),m=await sharp(b).metadata();
  if(m.width!==ROAD.width||m.height!==ROAD.height||!m.hasAlpha)throw Error('Layer size/alpha mismatch: '+file);
  audit.layers.push({file,width:m.width,height:m.height,bytesOnDisk:b.length,rgbaBytes:m.width*m.height*4});
 }
 const raw=await sharp(path.join(delivery,'tiles',a.light)).ensureAlpha().raw().toBuffer();
 const base=await sharp(path.join(delivery,'tiles',a.file)).ensureAlpha().raw().toBuffer();
 const stat={mask:a.mask,kind:a.kind,peakAlpha:0,paintedPixels:0,asphaltPixels:0,sidewalkPixels:0,outsidePavingPixels:0,insideSocketPixels:0,roi:null};
 let minX=ROAD.width,maxX=-1,minY=ROAD.height,maxY=-1,unlitLuma=0,litLuma=0;
 for(let i=3;i<raw.length;i+=4){
  const alpha=raw[i];if(!alpha)continue;
  stat.peakAlpha=Math.max(stat.peakAlpha,alpha);stat.paintedPixels++;
  const p=(i-3)/4,{x,y}=unproject(p%ROAD.width+.5,Math.floor(p/ROAD.width)+.5),v=surface(a.mask,x,y);
  const px=p%ROAD.width,py=Math.floor(p/ROAD.width);minX=Math.min(minX,px);maxX=Math.max(maxX,px);minY=Math.min(minY,py);maxY=Math.max(maxY,py);
  // A repeatable sRGB luma proxy of the source-over composite; not a physical light model.
  const weight=[.2126,.7152,.0722],blend=alpha/255;
  for(let k=0;k<3;k++){unlitLuma+=weight[k]*base[i-3+k];litLuma+=weight[k]*(raw[i-3+k]*blend+base[i-3+k]*(1-blend));}
  if(v.type==='asphalt')stat.asphaltPixels++;else if(v.type==='sidewalk')stat.sidewalkPixels++;else stat.outsidePavingPixels++;
  if(socket(a.mask,x,y))stat.insideSocketPixels++;
 }
 if(stat.paintedPixels){stat.roi={x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1};stat.meanSRGBLumaOverPaintedPixels={unlit:unlitLuma/stat.paintedPixels,litSourceOver:litLuma/stat.paintedPixels};}
 if(stat.outsidePavingPixels)throw Error('Light escaped paving: mask '+a.mask);
 audit.lights.push(stat);
}
audit.memory={
 fullyDecodedAuthoringLayersMiB:audit.layers.reduce((s,l)=>s+l.rgbaBytes,0)/1024**2,
 layerFilesMiB:audit.layers.reduce((s,l)=>s+l.bytesOnDisk,0)/1024**2,
 proofRGBA_MiB:7168*3584*4/1024**2,
 excludes:'browser overhead, extra canvas copies, GPU backing, grass, props, actors and effects',
};
audit.warnings.push('Light alpha/containment checks do not establish visual fidelity, source anchoring or clean curb registration.');
audit.warnings.push('Do not preload all 80 editable layers or the full proof image in mobile gameplay.');
audit.warnings.push('Native receipts still say review pending; retain those truthful statuses until individual source review is recorded.');
if(process.argv.includes('--browser')){
 const candidates=[
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
 ];
 let executable;
 for(const f of candidates){try{await fs.access(f);executable=f;break;}catch{}}
 if(!executable)audit.browser={status:'not run',reason:'No supported browser executable found at standard paths; no download/install attempted'};
 else{
  const {chromium}=await import('playwright-core');
  const browser=await chromium.launch({executablePath:executable,headless:true});
  try{
   const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(pathToFileURL(path.join(delivery,'review/road-builder.html')).href);
   await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('25 sections'),null,{timeout:30000});
   const png=path.join(delivery,'review/planning-browser.png');
   await page.screenshot({path:png});
   await page.locator('#clear').click();
   await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('0 sections'));
   await page.locator('#reset').click();
   await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('25 sections'));
   if(errors.length)throw Error(errors.join('\n'));
   audit.browser={status:'pass',scope:'Desktop art-review page load and clear/reset only; not game/mobile/performance verification',executable,screenshot:'review/planning-browser.png',pageErrors:errors};
  }finally{await browser.close();}
 }
}
await fs.writeFile(path.join(delivery,'review/planning-audit.json'),JSON.stringify(audit,null,2)+'\n');
console.log(JSON.stringify({nativeReceiptsVerified:audit.nativeReceipts.length,layers:audit.layers.length,memory:audit.memory,lightPeaks:audit.lights.filter(l=>[3,5,10,15].includes(l.mask)),browser:audit.browser,report:path.join(delivery,'review/planning-audit.json')}));
