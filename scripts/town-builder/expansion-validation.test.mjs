/** Read-only library checks plus export into a separate tiny fixture, never the owner's town. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {spawn} from 'node:child_process';
import {ROOT} from '../lib/town-scene.mjs';
const live=path.join(ROOT,'output/town-builder'),lib=JSON.parse(await fs.readFile(path.join(live,'library/library.json'),'utf8'));
const added=lib.items.filter(i=>i.id.startsWith('expansion:'));
assert.ok(added.length>=30);assert.equal(new Set(lib.items.map(i=>i.id)).size,lib.items.length);
for(const i of added){
 const m=await sharp(path.join(live,'library',i.file)).metadata();assert.ok(m.hasAlpha,i.id);
 assert.ok(i.ax>=0&&i.ax<i.w&&i.ay>=0&&i.ay<i.h,i.id+' anchor');assert.ok(i.physicalMetres,i.id+' retained dimensions');
 if(i.flat)assert.ok(!i.shadow&&!i.base,i.id+' flat must not block or cast shadow');
 else{assert.ok(i.shadow&&i.base,i.id+' shadow and collision footprint');await fs.access(path.join(live,'library',i.shadow.file));}
}
console.log('PASS '+added.length+' new alpha sprites: dimensions, anchors, shadows and walkable decals');
const fixture=path.join(live,'expansion-tests','export-'+Date.now());
await fs.mkdir(path.join(fixture,'map/full'),{recursive:true});await fs.mkdir(path.join(fixture,'library/sprites'),{recursive:true});
await fs.mkdir(path.join(fixture,'plans'),{recursive:true});
const decal=added.find(i=>i.id==='expansion:manhole');assert.ok(decal);
await fs.copyFile(path.join(live,'library',decal.file),path.join(fixture,'library',decal.file));
await fs.writeFile(path.join(fixture,'library/library.json'),JSON.stringify({items:[decal]}));
await fs.writeFile(path.join(fixture,'plans/maple-falls.json'),JSON.stringify({roads:[],reflections:[],paving:[],lampLayerVersion:2}));
await fs.writeFile(path.join(fixture,'layout.json'),JSON.stringify({version:1,sprites:[{uid:1,id:decal.id,x:2,y:2,scale:1}]}));
await fs.writeFile(path.join(fixture,'map/manifest.json'),JSON.stringify({width:512,height:512,tileSize:512,pxPerAxisM:32,origin:{ox:256,oy:128},levels:[{rows:1,cols:1}]}));
await sharp({create:{width:512,height:512,channels:4,background:'#26342e'}}).png().toFile(path.join(fixture,'map/full/0_0.png'));
const port=5197,server=spawn(process.execPath,['scripts/town-builder/server.mjs','--port',String(port),'--data',fixture,'--assets',fixture],{stdio:['ignore','pipe','pipe'],windowsHide:true});
let serverLog='';server.stdout.on('data',b=>serverLog+=b);server.stderr.on('data',b=>serverLog+=b);
try{
 let ready=false;
 for(let n=0;n<100;n++){try{ready=(await fetch('http://127.0.0.1:'+port+'/api/layout')).ok;if(ready)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 assert.ok(ready,'fixture server: '+serverLog);
 const response=await fetch('http://127.0.0.1:'+port+'/api/export',{method:'POST'}),result=await response.json();assert.equal(response.status,200,JSON.stringify(result));
 const before=await sharp(path.join(fixture,'map/full/0_0.png')).raw().toBuffer();
 const after=await sharp(path.join(ROOT,result.dir,'tiles/0_0.png')).raw().toBuffer();
 assert.notDeepEqual(after,before,'export must paint the decal');
 console.log('PASS export paints flat decals over ground (isolated fixture)');
 const health=await fetch('http://127.0.0.1:5190/library/library.json');assert.ok(health.ok);assert.ok((await health.json()).items.some(i=>i.id===decal.id));
 console.log('PASS live builder serves registered sprites on port 5190');
}finally{server.kill();}
