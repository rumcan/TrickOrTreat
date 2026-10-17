/** Start the existing town and a separate blank town. All editable map files stay in their own data folders. */
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const BUILDER=path.join(ROOT,'.codex-session/town-worktree/scripts/town-builder');
const SHARED=path.join(ROOT,'output/town-builder'),SECOND=path.join(SHARED,'maps/second-town');
const maps=[{id:'maple-falls',name:'Maple Falls',port:5190},{id:'second-town',name:'New Town',port:5192}];
const write=async(file,value)=>{await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(value,null,2)+'\n');};
async function reachable(port){try{return (await fetch(`http://127.0.0.1:${port}/api/plan`,{signal:AbortSignal.timeout(1500)})).ok;}catch{return false;}}
function start(file,args,log){const child=spawn(process.execPath,[file,...args],{cwd:ROOT,detached:true,windowsHide:true,stdio:['ignore',log,log]});child.unref();return child.pid;}
await fs.mkdir(SECOND,{recursive:true});
const planFile=path.join(SECOND,'plans/maple-falls.json');
if(!existsSync(planFile)){
 const main=JSON.parse(await fs.readFile(path.join(SHARED,'plans/maple-falls.json'),'utf8'));
 await write(planFile,{name:'New Town',mapId:'second-town',groundShape:'isometric',nx:main.nx,ny:main.ny,roads:[],lines:{double:[],none:[]},
  lots:[],pois:[],reflections:[],paving:[],lightSpots:[],lampLayerVersion:2,night:structuredClone(main.night||{}),
  notes:'Separate blank town. Independent layout and ground; shared sprite library. Future inter-map travel is not configured.'});
}
for(const name of ['layout.json','layout-seed.json'])if(!existsSync(path.join(SECOND,name)))await write(path.join(SECOND,name),{version:1,mapId:'second-town',plan:'maple-falls.json',sprites:[]});
await write(path.join(BUILDER,'app/maps.json'),{maps});
const bakeStatusFile=path.join(SECOND,'bake-status.json');
let bakeRunning=false;try{const s=JSON.parse(await fs.readFile(bakeStatusFile,'utf8'));if(s.running&&s.pid){try{process.kill(s.pid,0);bakeRunning=true;}catch{}}}catch{}
if(!existsSync(path.join(SECOND,'map-current.json'))&&!bakeRunning){
 const log=await fs.open(path.join(SECOND,'initial-bake.log'),'a');
 console.log('Blank ground bake PID',start(path.join(BUILDER,'bake-run.mjs'),[planFile,SECOND,'--workers','4'],log.fd));await log.close();
}
if(process.argv.includes('--prepare-only')){console.log('Prepared separate map:',SECOND);process.exit(0);}
for(const map of maps){
 if(await reachable(map.port)){console.log(`${map.name} is already running on http://localhost:${map.port}/`);continue;}
 const data=map.id==='second-town'?SECOND:SHARED,log=await fs.open(path.join(data,`server-${map.port}.log`),'a');
 console.log(`${map.name} server PID`,start(path.join(BUILDER,'server.mjs'),['--port',String(map.port),'--data',data,'--assets',SHARED],log.fd));await log.close();
}
console.log('New Town: http://localhost:5192/ — saves under '+SECOND);
