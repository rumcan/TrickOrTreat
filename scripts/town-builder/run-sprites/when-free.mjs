/** Wait until RUN generated-asset storage has been cleared, then run the sprite batch (generate.mjs, 90 s apart).
 *  Checks every 2 minutes with `rundot assets list` (no generation, no quota use). Gives up after 6 hours. */
import {execFileSync,spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const HERE=path.dirname(fileURLToPath(import.meta.url)),ROOT=path.resolve(HERE,'../../..'),GAME='AFjPSjQH9kbcCl57sgO3';
const count=()=>{let n=0;for(const g of [['--game-id',GAME],[]])for(const s of ['imagegen','audiogen','threedgen']){let out='';
 try{out=execFileSync('rundot',['assets','list',...g,'--service',s,'--limit','100'],{cwd:g.length?ROOT:'C:\\',encoding:'utf8',shell:true});}catch(e){out=String(e.stdout||'');}
 n+=(out.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g)||[]).length;}return n;};
const t0=Date.now();
for(;;){const n=count();console.log(new Date().toISOString(),'generated assets still stored:',n);
 if(n===0)break;if(Date.now()-t0>6*3600e3){console.log('gave up waiting');process.exit(1);}await new Promise(r=>setTimeout(r,120e3));}
spawnSync(process.execPath,[path.join(HERE,'generate.mjs'),'--gap','90'],{cwd:ROOT,stdio:'inherit'});
