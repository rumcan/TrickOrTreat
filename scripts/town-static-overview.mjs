import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {chromium} from 'playwright-core';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const review=path.join(root,'art/town/static/review');
const sections=path.join(root,'art/town/static/sections');
const oldReview=path.join(root,'art/town/review');
const basename='maple-falls-static';
const url=process.env.TOWN_URL||'http://127.0.0.1:5192/';
const beforeRegions={
  farm:[3,3,18,18],campus:[24,3,66,18],'church-cemetery':[3,24,18,65],
  'main-street':[24,38,45,30],park:[73,39,14,13],leisure:[49,24,40,14],
  'north-homes':[24,24,21,14],'south-homes':[72,55,18,35],'drive-in':[50,74,40,16],
  // (the old Lantern Row has no district of its own any more: its homes are part of Lantern Lane & Willow Court)
};

function validateMeta(meta,label){
  if(!Number.isInteger(meta.width)||!Number.isInteger(meta.height)||meta.width<=0||meta.height<=0||
     !Number.isFinite(meta.scale)||meta.scale<=0||!Array.isArray(meta.origin)||meta.origin.length!==2||
     !meta.origin.every(Number.isFinite))throw Error(`${label}: invalid overview dimensions, scale or origin`);
}

// Coordinates are native scene pixels relative to the full overview's origin.
// These are rectangular context crops, not isolated district silhouettes.
function cropBounds(rect,meta,projection,margins){
  const {x,y,w,h}=rect;
  if(![x,y,w,h].every(Number.isFinite)||w<=0||h<=0)throw Error('Invalid district world rectangle');
  const corners=[[x,y],[x+w,y],[x+w,y+h],[x,y+h]].map(([a,b])=>[
    (a-b)*projection.hw,(a+b)*projection.hh,
  ]);
  const pixelX=world=>(world-meta.origin[0])*meta.scale;
  const pixelY=world=>(world-meta.origin[1])*meta.scale;
  const left=Math.max(0,Math.min(meta.width-1,Math.floor(pixelX(Math.min(...corners.map(p=>p[0]))-margins.side))));
  const top=Math.max(0,Math.min(meta.height-1,Math.floor(pixelY(Math.min(...corners.map(p=>p[1]))-margins.roof))));
  const right=Math.max(left+1,Math.min(meta.width,Math.ceil(pixelX(Math.max(...corners.map(p=>p[0]))+margins.side))));
  const bottom=Math.max(top+1,Math.min(meta.height,Math.ceil(pixelY(Math.max(...corners.map(p=>p[1]))+margins.bottom))));
  return {left,top,width:right-left,height:bottom-top};
}

async function checkImage(file,meta){
  const image=await sharp(file).metadata();
  if(image.width!==meta.width||image.height!==meta.height)throw Error(`Image/metadata dimensions differ: ${file}`);
}

async function exists(file){
  try{await fs.access(file);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}
}

async function smokeViewer(browser,baseURL,districts){
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const fits=()=>page.evaluate(()=>{
    const image=document.querySelector('#town'),stage=document.querySelector('#stage');
    const a=image.getBoundingClientRect(),b=stage.getBoundingClientRect();
    return a.width>0&&a.height>0&&a.left>=b.left-1&&a.top>=b.top-1&&a.right<=b.right+1&&a.bottom<=b.bottom+1;
  });
  const districtFits=()=>page.evaluate(()=>{
    const meta=JSON.parse(document.querySelector('#town-metadata').textContent);
    const stage=document.querySelector('#stage'),image=document.querySelector('#town');
    const id=document.querySelector('[data-district][aria-pressed="true"]')?.dataset.district;
    const bounds=meta.districts.find(d=>d.id===id)?.crops[stage.dataset.phase]?.bounds;
    if(!bounds)return false;
    const a=image.getBoundingClientRect(),b=stage.getBoundingClientRect();
    const scale=a.width/(stage.dataset.phase==='before'?meta.before.width:meta.width);
    return a.left+bounds.left*scale>=b.left-1&&a.top+bounds.top*scale>=b.top-1&&
      a.left+(bounds.left+bounds.width)*scale<=b.right+1&&a.top+(bounds.top+bounds.height)*scale<=b.bottom+1;
  });
  try{
    await page.goto(new URL('art/town/static/review/index.html',baseURL).href);
    await page.waitForFunction(()=>document.querySelector('#stage')?.dataset.ready==='true',null,{timeout:120000});
    assert.equal(await page.locator('[data-district]').count(),districts.length);
    assert.ok(await fits(),'Static map fits desktop');
    await page.getByRole('button',{name:'100%',exact:true}).click();
    assert.equal(await page.evaluate(()=>Math.round(document.querySelector('#town').getBoundingClientRect().width)),
      await page.evaluate(()=>document.querySelector('#town').naturalWidth));
    await page.locator('[data-district]').first().click();
    assert.equal(await page.locator('[data-district][aria-pressed="true"]').count(),1);
    assert.ok(await districtFits(),'Selected district fits desktop');
    await page.getByRole('button',{name:'Show before map',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#stage')?.dataset.phase==='before'&&document.querySelector('#stage')?.dataset.ready==='true',null,{timeout:120000});
    assert.ok((await page.locator('#town').getAttribute('src')).includes('maple-falls-full'));
    await page.getByRole('button',{name:'Fit town',exact:true}).click();
    assert.ok(await fits(),'Before map fits desktop');
    await page.getByRole('button',{name:'Show static map',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#stage')?.dataset.phase==='after'&&document.querySelector('#stage')?.dataset.ready==='true',null,{timeout:120000});
    await page.getByRole('link',{name:'District gallery & studies',exact:true}).click();
    assert.ok(await page.locator('#district-gallery').isVisible());
    assert.equal(await page.locator('#gallery-grid article').count(),districts.length);
    await page.getByRole('button',{name:'Close gallery',exact:true}).click();
    await page.setViewportSize({width:390,height:844});
    await page.getByRole('button',{name:'Fit town',exact:true}).click();
    assert.ok(await fits(),'Static map fits phone');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No phone page overflow');
    // Verify the compact preview still uses full-map coordinates for navigation.
    await page.route('**/maple-falls-static.png',route=>route.abort());
    await page.reload();
    await page.waitForFunction(()=>document.querySelector('#stage')?.dataset.ready==='true'&&document.querySelector('#town')?.getAttribute('src')?.endsWith('.webp'),null,{timeout:120000});
    assert.ok(await fits(),'Compact preview fits phone');
    await page.locator('[data-district]').first().click();
    assert.equal(await page.locator('[data-district][aria-pressed="true"]').count(),1);
    assert.ok(await districtFits(),'District navigation uses full-map coordinates with phone preview');
    assert.deepEqual(errors,[]);
    return {desktop:true,phone:true,districtNavigation:true,beforeToggle:true,gallery:true,previewFallback:true};
  }finally{await page.close();}
}

// Fail before browser work if the original comparison source is unavailable.
const oldMeta=JSON.parse(await fs.readFile(path.join(oldReview,'maple-falls-full.json'),'utf8'));
validateMeta(oldMeta,'Before');
await checkImage(path.join(oldReview,'maple-falls-full.png'),oldMeta);
await fs.mkdir(review,{recursive:true});
await fs.mkdir(sections,{recursive:true});
const browser=await chromium.launch({channel:'msedge'});
try{
  const page=await browser.newPage({viewport:{width:1200,height:800},acceptDownloads:true});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.text().includes('[assets]'))errors.push(message.text());});
  await page.goto(url);
  // The title's ready button appears after the production art preloader finishes.
  await page.getByRole('button',{name:'Go trick-or-treating',exact:true}).waitFor({timeout:120000});
  // Arm the download listener first; consume rejection if evaluation fails.
  const download=page.waitForEvent('download',{timeout:120000});
  download.catch(()=>{});
  const meta=await page.evaluate(async({basename,knownIds})=>{
    const {buildStaticTown}=await import('/src/game/town-static.ts');
    // Vite can stamp dependency URLs after edits. Use the builder's exact loader
    // URL so loadStaticTownArt and staticProp share the same module cache.
    const source=await(await fetch('/src/game/town-static.ts')).text();
    const artURL=source.match(/(?:from\s*|import\s*)["']([^"']*\/art\/town-static\.ts[^"']*)["']/)?.[1]||'/src/game/art/town-static.ts';
    const {loadStaticTownArt}=await import(artURL);
    const {townOverview}=await import('/src/game/town-overview.ts');
    const {HW,HH}=await import('/src/game/config.ts');
    await loadStaticTownArt();
    const {map,districts,audit}=buildStaticTown();
    if(!map||!Array.isArray(districts)||!districts.length||audit==null)throw Error('buildStaticTown must return {map, districts, audit}');
    const seen=new Set();
    for(const district of districts){
      if(!knownIds.includes(district.id)||seen.has(district.id))throw Error('Unsupported or duplicate district id: '+district.id);
      if(typeof district.name!=='string'||![district.x,district.y,district.w,district.h].every(Number.isFinite)||district.w<=0||district.h<=0)throw Error('Invalid district: '+district.id);
      seen.add(district.id);
    }
    if(seen.size!==knownIds.length)throw Error('Static town must include every comparison district');
    const snapshot=()=>JSON.stringify({props:map.props.map(p=>[p.id,p.removed,p.fade]),collision:Array.from(map.coll),gates:map.gates.map(g=>g.opened),barriers:map.barriers.map(b=>b.cleared)});
    const before=snapshot();
    const result=townOverview(map,{scale:1,hideBarriers:true});
    if(snapshot()!==before)throw Error('Static overview mutated the map');
    const blob=await new Promise(resolve=>result.canvas.toBlob(resolve,'image/png'));
    if(!blob)throw Error('PNG encoding failed');
    const href=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=href;link.download=basename+'.png';document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(href),30000);
    result.canvas.width=result.canvas.height=0;
    return {...result.meta,districts,audit,projection:{hw:HW,hh:HH},
      cropMargins:{side:128,roof:Math.ceil(Math.max(640,...map.props.map(p=>p.sp.ay))),bottom:128},mapStateUnchanged:true};
  },{basename,knownIds:Object.keys(beforeRegions)});
  validateMeta(meta,'Static');
  if(meta.scale!==1)throw Error('Static overview must use native scale 1');
  await(await download).saveAs(path.join(review,basename+'.png'));
  if(errors.length)throw Error(errors.join('\n'));
  await page.close();
  const fullPNG=path.join(review,basename+'.png');
  await checkImage(fullPNG,meta);
  await sharp(fullPNG).resize({width:4000}).webp({quality:92,effort:5}).toFile(path.join(review,basename+'-overview.webp'));
  for(const district of meta.districts){
    const [x,y,w,h]=beforeRegions[district.id];
    district.crops={};district.studies={};
    for(const phase of ['before','after']){
      const phaseMeta=phase==='before'?oldMeta:meta;
      const worldRect=phase==='before'?{x,y,w,h}:{x:district.x,y:district.y,w:district.w,h:district.h};
      const bounds=cropBounds(worldRect,phaseMeta,meta.projection,meta.cropMargins);
      const file=`${district.id}-${phase}.webp`;
      await sharp(phase==='before'?path.join(oldReview,'maple-falls-full.png'):fullPNG)
        .extract(bounds).resize({width:1600}).webp({quality:92,effort:5}).toFile(path.join(sections,file));
      district.crops[phase]={file:'../sections/'+file,source:phase==='before'?'../../review/maple-falls-full.png':basename+'.png',
        worldRect,bounds,approximate:phase==='before',previewWidth:1600};
      const study=`${district.id}-${phase}-study.png`;
      if(await exists(path.join(sections,study)))district.studies[phase]='../sections/'+study;
    }
  }
  const metadata={...meta,bytes:(await fs.stat(fullPNG)).size,
    image:basename+'.png',preview:basename+'-overview.webp',
    before:{...oldMeta,image:'../../review/maple-falls-full.png',preview:'../../review/maple-falls-full-overview.webp'},
    cropNote:'Actual rectangular scene crops; before regions are approximate district equivalents. Neighbouring scenery may appear.',
    referenceStudy:await exists(path.join(root,'art/town/static/reference-study.png'))?'../reference-study.png':null};
  const json=JSON.stringify(metadata,null,2);
  await fs.writeFile(path.join(review,basename+'.json'),json+'\n');
  const viewer=path.join(review,'index.html');
  const html=await fs.readFile(viewer,'utf8');
  const marker=/<script id="town-metadata" type="application\/json">[\s\S]*?<\/script>/;
  if(!marker.test(html))throw Error('Viewer is missing its embedded metadata marker');
  await fs.writeFile(viewer,html.replace(marker,()=>'<script id="town-metadata" type="application/json">'+json.replaceAll('<','\\u003c')+'</script>'));
  const smoke=await smokeViewer(browser,url,meta.districts);
  console.log(JSON.stringify({file:path.relative(root,fullPNG),preview:path.relative(root,path.join(review,basename+'-overview.webp')),
    metadata:path.relative(root,path.join(review,basename+'.json')),viewer:path.relative(root,viewer),
    width:meta.width,height:meta.height,districts:meta.districts.length,crops:meta.districts.length*2,audit:meta.audit,smoke},null,2));
}finally{await browser.close();}
