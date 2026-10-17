import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {classify,slotsFor,makePrompt,slug,writeJson,readJson} from './plan.mjs';
import {invocation,validate,retryDelay,runQueue,status,outputFile,generationId} from './runner.mjs';

async function sheet(file,{opaque=false,emptyCell=-1,crossGutter=false}={}) {
  const W=512,H=512,data=Buffer.alloc(W*H*4);
  if(opaque) for(let i=3;i<data.length;i+=4)data[i]=255;
  for(let cell=0;cell<4;cell++) {
    if(cell===emptyCell)continue;
    const x0=(cell%2)*256+64,y0=Math.floor(cell/2)*256+64;
    for(let y=y0;y<y0+128;y++)for(let x=x0;x<x0+128;x++) {
      const i=(y*W+x)*4;data[i]=100;data[i+1]=140;data[i+2]=90;data[i+3]=255;
    }
  }
  if(crossGutter)for(let y=0;y<H;y++)for(let x=252;x<260;x++)data[(y*W+x)*4+3]=255;
  await sharp(data,{raw:{width:W,height:H,channels:4}}).png().toFile(file);
}
async function temp(t) {const dir=await fs.mkdtemp(path.join(os.tmpdir(),'town-variations-test-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));return dir;}

test('requested sheet types and difficult category exceptions',()=>{
  const cases=[
    [{id:'world:car_0',name:'Car',category:'Vehicles'},'vehicle',4],
    [{id:'expansion:shopping-cart',name:'Shopping cart',category:'Town odds & ends'},'cart',4],
    [{id:'gen:rubbish-bags',name:'Trash pile',flat:true},'decal',4],
    [{id:'expansion:abandoned-workshop',name:'Workshop',category:'Derelict town'},'building',1],
    [{id:'world:streetlamp',name:'Streetlamp',category:'Street furniture'},'prop',4],
    [{id:'expansion:crushed-car-stack',name:'Stack of crushed cars',category:'Scrapyard clutter'},'prop',4],
    [{id:'expansion:forklift',name:'Forklift',category:'Scrapyard clutter'},'vehicle',4],
    [{id:'world:bleachers',name:'Bleachers',category:'Landmarks & venues'},'prop',4],
    [{id:'expansion:air-compressor',name:'Old workshop air compressor',category:'Scrapyard clutter'},'prop',4],
    [{id:'world:primary_school',name:'Primary School',category:'Landmarks & venues'},'building',1],
    [{id:'expansion:boxcar',name:'Boxcar storage shed',category:'Backyard structures'},'building',1]
  ];
  for(const [item,kind,count] of cases) {assert.equal(classify(item),kind);assert.equal(slotsFor(kind,item).length,count);}
  assert.notEqual(slug('a:b'),slug('a/b'));
});

test('prompts isolate screenshot context and specify camera, period, alpha and four cart arrangements',()=>{
  const asset={id:'cart',name:'Shopping cart',kind:'cart',slots:slotsFor('cart',{})};
  const withWorld=makePrompt(asset,true),without=makePrompt(asset,false);
  assert.match(withWorld,/Input image 3/);assert.doesNotMatch(without,/Input image 3/);
  for(const text of [/1988-1992/,/26.565/,/TRANSPARENT alpha/,/fallen on its side/,/THREE empty/,/loaded cart/])assert.match(withWorld,text);
  const call=invocation('run',{manifest:{gameId:'g'},prompt:'Text with "quotes" & $(literal)',refs:['C:/a b/old.png'],target:'C:/out image.png'});
  assert.equal(call.args[call.args.indexOf('--prompt')+1],'Text with "quotes" & $(literal)');
  assert.equal(call.args[call.args.indexOf('--reference-image')+1],'C:/a b/old.png');
  assert.ok(call.args.includes('--remove-background'));
  const codex=invocation('codex',{manifest:{},prompt:'p',refs:['old.png','style.webp'],target:'sheet.png',out:'C:/out',answer:'answer.json'});
  assert.ok(codex.args.includes('--sandbox'));assert.ok(codex.args.includes('workspace-write'));
  assert.ok(!codex.args.includes('--dangerously-bypass-approvals-and-sandbox'));
  assert.match(codex.stdin,/transparent_background=true/);assert.match(codex.stdin,/Do not use the OpenAI API/);
  const vehicle={id:'car',name:'Car',kind:'vehicle',slots:slotsFor('vehicle',{})};
  const vp=makePrompt(vehicle,true);
  assert.match(vp,/HORIZONTAL BROADSIDE PROFILE/);assert.match(vp,/VERTICAL FRONT VIEW/);assert.match(vp,/VERTICAL REAR VIEW/);
  assert.match(vp,/only diagonal corner view/);assert.doesNotMatch(vp,/Only object heading changes in 90-degree steps/);
});

test('PNG checks reject opaque backgrounds, missing cells and intersecting gutters',async t=>{
  const dir=await temp(t),file=path.join(dir,'sheet.png');
  await sheet(file);const good=await validate(file,4);assert.equal(good.cells,4);assert.equal(good.visualReview,'pending');
  await sheet(file,{opaque:true});await assert.rejects(validate(file,4),/opaque/);
  await sheet(file,{emptyCell:3});await assert.rejects(validate(file,4),/empty/);
  await sheet(file,{crossGutter:true});await assert.rejects(validate(file,4),/gutters/);
});

test('quota retries respect provider delay and exponential cooldown',()=>{
  assert.ok(retryDelay('429 retry in 600 seconds',1,90000)>=615000);
  assert.ok(retryDelay('quota exceeded',4,90000)>retryDelay('quota exceeded',1,90000));
  assert.ok(retryDelay('transient failure',1,90000)>=90000);
});

test('cost routing reserves stronger model for buildings and vehicles and caps each request',()=>{
  const manifest={gameId:'g',runModel:'gemini-3.1-flash-lite-image',runBackgroundModel:'bria',runMaxCredits:90,
    runModelsByKind:{building:'gemini-3.1-flash-image-preview',vehicle:'gemini-3.1-flash-image-preview'},runMaxCreditsByKind:{building:147,vehicle:147}};
  for(const kind of ['building','vehicle','prop','decal']) {
    const call=invocation('run',{manifest,prompt:'p',refs:[],target:'file.png',asset:{kind}});
    const stronger=['building','vehicle'].includes(kind);
    assert.equal(call.args[call.args.indexOf('--model')+1],stronger?'gemini-3.1-flash-image-preview':'gemini-3.1-flash-lite-image');
    assert.equal(call.args[call.args.indexOf('--max-credits')+1],stronger?'147':'90');
    assert.equal(call.args[call.args.indexOf('--remove-background-model')+1],'bria');
    assert.ok(!call.args.includes('--remove-background-variant'));
  }
});

test('worker saves native output, skips completed work and recovers a completed image after interrupted bookkeeping',async t=>{
  const out=await temp(t),asset={id:'a',key:'a',name:'Trash',kind:'decal',slots:['a','b','c','d'],old:{file:'old.png'}};
  const job={key:'a',assetId:'a',provider:'run',phase:'production',mode:'auto'};
  await writeJson(path.join(out,'manifest.json'),{assets:[asset],jobs:[job],style:{file:'style.png'},world:{file:'world.png'},gameId:'g'});
  await writeJson(path.join(out,'reference-policy.json'),{includeWorld:false});
  for(const name of ['sheets/run','states/run','prompts/run','attempts/run','receipts/run'])await fs.mkdir(path.join(out,name),{recursive:true});
  let calls=0;
  const fake=async call=>{calls++;await sheet(call.args[call.args.indexOf('--out')+1]);return {code:0,tail:'',timedOut:false};};
  await runQueue({out,provider:'run',gap:0,limit:1,slice:false},fake);
  assert.equal(calls,1);assert.equal((await status(out)).providers.run.generated,1);
  await runQueue({out,provider:'run',gap:0,limit:1,slice:false},fake);assert.equal(calls,1);
  await fs.unlink(path.join(out,'states/run/a.json'));
  await runQueue({out,provider:'run',gap:0,limit:1,slice:false},fake);assert.equal(calls,1);
  const recovered=await readJson(path.join(out,'states/run/a.json'));assert.ok(recovered.recoveredAt);
  assert.equal((await fs.stat(outputFile(out,job))).size>0,true);
});

test('a failed attempt remains resumable; stop markers prevent generation',async t=>{
  const out=await temp(t),asset={id:'a',name:'a',kind:'decal',slots:['a','b','c','d'],old:{file:'old.png'}};
  const job={key:'a',assetId:'a',provider:'run',phase:'production',mode:'auto'};
  await writeJson(path.join(out,'manifest.json'),{assets:[asset],jobs:[job],style:{file:'style.png'},gameId:'g'});
  await writeJson(path.join(out,'reference-policy.json'),{includeWorld:false});
  for(const name of ['states/run','prompts/run','attempts/run','receipts/run'])await fs.mkdir(path.join(out,name),{recursive:true});
  await runQueue({out,provider:'run',gap:0,limit:1,slice:false},async()=>({code:1,tail:'Transient service failure',timedOut:false}));
  const state=await readJson(path.join(out,'states/run/a.json'));assert.equal(state.status,'retry');assert.equal(state.attempts,1);assert.ok(state.nextAttemptAt>Date.now());
  await fs.writeFile(path.join(out,'STOP'),'stop');
  await runQueue({out,provider:'run',gap:0,slice:false},async()=>{throw Error('Should not generate');});
});

test('each downloaded RUN image is removed from RUN storage; full storage stops the worker',async t=>{
  const out=await temp(t),assets=['a','b'].map(id=>({id,name:id,kind:'decal',slots:['a','b','c','d'],old:{file:'old.png'}}));
  const jobs=assets.map(a=>({key:a.id,assetId:a.id,provider:'run',phase:'production',mode:'auto'}));
  await writeJson(path.join(out,'manifest.json'),{assets,jobs,style:{file:'style.png'},gameId:'g'});
  await writeJson(path.join(out,'reference-policy.json'),{includeWorld:false});
  for(const name of ['sheets/run','states/run','prompts/run','attempts/run','receipts/run'])await fs.mkdir(path.join(out,name),{recursive:true});
  const id='a62f2840-3b42-4378-a85c-681484e4ce8d';
  assert.equal(generationId(`Downloading...\n{"generationId":"${id}","filePath":"x.png"}`),id);
  const removed=[];
  await runQueue({out,provider:'run',gap:0,limit:1,slice:false},async call=>{
    if(call.args[0]==='assets') {removed.push(call.args[2]);assert.deepEqual(call.args.slice(3),['--service','imagegen','--game-id','g']);return {code:0,tail:'',timedOut:false};}
    await sheet(call.args[call.args.indexOf('--out')+1]);return {code:0,tail:`{"generationId":"${id}"}`,timedOut:false};
  });
  assert.deepEqual(removed,[id]);
  assert.deepEqual(await readJson(path.join(out,'run-pending-removals.json')),[]);
  assert.equal((await readJson(path.join(out,'states/run/a.json'))).runGenerationId,id);
  let requests=0;
  await runQueue({out,provider:'run',gap:0,slice:false},async call=>{
    if(call.args[0]==='assets') throw Error('Nothing should be waiting for removal');
    requests++;return {code:1,tail:'[IMAGE_GEN_CREATOR_QUOTA_EXCEEDED] Creator storage is full',timedOut:false};
  });
  assert.equal(requests,1);
  const b=await readJson(path.join(out,'states/run/b.json'));assert.equal(b.status,'retry');assert.equal(b.attempts,0);
});

test('slicing cuts each cell into the library next to its original and archives the sheet',async t=>{
  const {sliceCampaign}=await import('./slice.mjs');
  const out=await temp(t),library=path.join(out,'library'),art=path.join(out,'art');
  for(const name of ['states/run','sheets/run',library+'/sprites',library+'/thumbs'])await fs.mkdir(path.isAbsolute(name)?name:path.join(out,name),{recursive:true});
  const asset={id:'gen:litter',key:'gen-litter',name:'Litter',kind:'decal',category:'Decals',fw:1,fh:1,slots:['a','b','c','d']};
  await writeJson(path.join(out,'manifest.json'),{assets:[asset]});
  await writeJson(path.join(library,'library.json'),{items:[{id:'gen:litter',w:100,h:50,fw:1,fh:1,flat:true,category:'Decals'},{id:'other',category:'Other'}]});
  await sheet(path.join(out,'sheets/run/gen-litter.png'));
  await writeJson(path.join(out,'states/run/gen-litter.json'),{status:'generated',phase:'production',key:'gen-litter',assetId:'gen:litter'});
  const done=await sliceCampaign({out,library,art});
  assert.equal(done[0].cells,4);
  const lib=await readJson(path.join(library,'library.json'));
  assert.deepEqual(lib.items.map(i=>i.id),['gen:litter',...[1,2,3,4].map(n=>`variation:gen-litter:${n}`),'other']);
  assert.equal(lib.items[1].w,100);assert.ok(lib.items[1].flat);
  assert.ok((await fs.stat(path.join(out,'sliced/run/gen-litter.png'))).size>0);
  await assert.rejects(fs.stat(path.join(out,'sheets/run/gen-litter.png')));
  assert.ok((await readJson(path.join(out,'states/run/gen-litter.json'))).sliced);
  assert.deepEqual(await sliceCampaign({out,library,art}),[]);
});
