/** Two builders on a copy of the real town: how long one builder's edit takes to reach the other, how long the
 *  receiving page freezes, and how many bytes travel. node scripts/town-builder/sync-speed.bench.mjs [port] [label] */
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright-core';
import {ROOT} from '../lib/town-scene.mjs';
const live=path.join(ROOT,'output/town-builder'),data=path.join(live,'network-review','bench-'+Date.now()),port=+(process.argv[2]||5197),url=`http://127.0.0.1:${port}`,label=process.argv[3]||'';
await fs.mkdir(path.join(data,'plans'),{recursive:true});
await fs.copyFile(path.join(live,'layout.json'),path.join(data,'layout.json'));await fs.copyFile(path.join(live,'plans/maple-falls.json'),path.join(data,'plans/maple-falls.json'));
const server=spawn(process.execPath,[process.env.SERVER||'scripts/town-builder/server.mjs','--port',String(port),'--data',data,'--assets',live],{stdio:'ignore',windowsHide:true});
let browser;
try{
 for(let n=0;n<150;n++){try{if((await fetch(url+'/api/plan')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const pages=[];for(let i=0;i<2;i++){const c=await browser.newContext({viewport:{width:1400,height:900}}),p=await c.newPage();await p.addInitScript(()=>localStorage.setItem('mf-welcomed','1'));
  let bytes=0;p.on('request',r=>{if(r.method()==='PUT')bytes+=(r.postData()||'').length;});p.bytes=()=>bytes;
  await p.goto(url);await p.waitForFunction(()=>window.__townSharing?.connected&&window.__townBuilder?.ready,null,{timeout:60000});pages.push(p);}
 const [alice,bob]=pages;await alice.waitForFunction(()=>window.__townBuilder.peers?.length===1);
 // a long editing session: 150 undo steps on both sides (what the history holds after a while)
 for(const p of pages)await p.evaluate(()=>{const s=window.__townBuilder;for(let i=0;i<150;i++)s.undo.push(s.histLog?{j:JSON.stringify({s:s.sprites,p:s.plan}),n:s.histLog.length}:JSON.stringify({s:s.sprites,p:s.plan}));});
 await bob.evaluate(()=>{const T=window.__townSharing,prof=window.__prof={};const wrap=(o,k)=>{const f=o[k].bind(o);o[k]=(...a)=>{const t=performance.now();const r=f(...a);const done=()=>{prof[k]=(prof[k]||0)+performance.now()-t;};if(r&&r.then)return r.finally(done);done();return r;};};for(const k of ['apply','rebase','receive','get'])wrap(T,k);window.__freeze=0;new PerformanceObserver(l=>{for(const e of l.getEntries())window.__freeze=Math.max(window.__freeze,e.duration);}).observe({type:'longtask'});});
 const rows=[];
 for(let k=0;k<5;k++){
  const uid=await alice.evaluate(()=>window.__townBuilder.sprites[0].uid),x=await alice.evaluate(()=>window.__townBuilder.sprites[0].x)+1;
  const t0=Date.now(),before=alice.bytes();
  await alice.evaluate(([uid,x])=>{window.__townBuilder.sprites.find(o=>o.uid===uid).x=x;return window.__townSharing.save('layout');},[uid,x]);
  const saved=Date.now()-t0;await bob.waitForFunction(([uid,x])=>window.__townBuilder.sprites.find(o=>o.uid===uid)?.x===x,[uid,x],{timeout:60000});
  rows.push({saveMs:saved,seenByOtherMs:Date.now()-t0,uploadKB:+((alice.bytes()-before)/1024).toFixed(1)});
 }
 const freeze=await bob.evaluate(()=>window.__freeze);console.log('bob profile ms',JSON.stringify(await bob.evaluate(()=>window.__prof)));
 const avg=k=>Math.round(rows.reduce((a,r)=>a+r[k],0)/rows.length*10)/10;
 console.log(JSON.stringify({label,sprites:(JSON.parse(await fs.readFile(path.join(data,'layout.json'),'utf8'))).sprites.length,saveMs:avg('saveMs'),seenByOtherMs:avg('seenByOtherMs'),uploadKB:avg('uploadKB'),longestFreezeMs:Math.round(freeze)}));
}finally{await browser?.close();server.kill();}
