/** Runs one ground bake on its own, detached from the town builder server, so a server restart (node --watch) can't kill
 *  it: bakes into a fresh version folder, then switches map-current.json after validation.
 *  Progress goes to <data>/bake-status.json, which the server reads for GET /api/bake.
 *  node scripts/town-builder/bake-run.mjs <plan.json> <dataDir> */
import fs from 'node:fs/promises';
import {writeFileSync,renameSync} from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {publishMap} from './map-storage.mjs';
const HERE=path.dirname(fileURLToPath(import.meta.url)),[plan,DATA,...options]=process.argv.slice(2),STATUS=path.join(DATA,'bake-status.json');
const st={running:true,pid:process.pid,log:[],startedAt:Date.now(),finishedAt:null,code:null};
const save=()=>{try{writeFileSync(STATUS+'.tmp',JSON.stringify(st));renameSync(STATUS+'.tmp',STATUS);}catch{}};
const stamp=new Date().toISOString().replace(/[:.]/g,'-'),stage=path.join(DATA,'map-version-'+stamp);save();
const ch=spawn(process.execPath,[path.join(HERE,'bake.mjs'),plan,stage,...options],{cwd:path.resolve(HERE,'../..'),windowsHide:true});
let t=0;const onData=d=>{for(const line of d.toString().split(/\r?\n/))if(line.trim())st.log.push(line.trim());if(st.log.length>200)st.log.splice(0,st.log.length-200);if(Date.now()-t>1000){t=Date.now();save();}};
ch.stdout.on('data',onData);ch.stderr.on('data',onData);
/* progress from the tiles on disk (stdout from the bake's worker threads can stall in a pipe on Windows) */
const tick=setInterval(async()=>{let n=0;try{n=(await fs.readdir(path.join(stage,'tiles/0'))).length;}catch{}const line=`${n} tiles, ${((Date.now()-st.startedAt)/1000).toFixed(0)}s`;
 st.log=st.log.filter(l=>!/^\d+ tiles, \d+s/.test(l));st.log.push(line);save();},1000);
ch.on('error',e=>{clearInterval(tick);st.log.push(String(e));st.running=false;st.code=1;st.finishedAt=Date.now();save();});
ch.on('close',async code=>{clearInterval(tick);try{if(code===0){const installed=await publishMap(DATA,stage);
   st.log.push('Ground installed; previous map preserved at '+installed.previous);}
  else{st.log.push(`Bake process exited with code ${code}`);}}
 catch(e){code=1;st.log.push('Install failed: '+String(e.message||e));}
 st.running=false;st.code=code;st.finishedAt=Date.now();save();});
