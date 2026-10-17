import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile), root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const ids = ['tommy','sam','jess','maya','leo','tommy_pumpkin','sam_astronaut','jess_vampire','maya_knight','leo_moth'];
let next=0;
await Promise.all(Array.from({length:2},async()=>{
  while(next<ids.length) {
    const id=ids[next++]; console.log(`Rendering ${id}`);
    const result=await run(process.execPath,['scripts/art/render-hero-3d.mjs',id,'--defer-metadata'],{cwd:root,maxBuffer:1<<22});
    console.log(result.stdout.trim());
  }
}));
const hands={};
for (const id of ids) hands[id]=JSON.parse(await fs.readFile(path.join(root,'art/3d',id,'hands.json'),'utf8'));
await fs.writeFile(path.join(root,'src/game/art/hero3d.json'),JSON.stringify(Object.fromEntries(Object.entries(hands).sort(([a],[b])=>a.localeCompare(b))))+'\n');
console.log('All ten sprites rendered; hand metadata merged without parallel-write races.');
