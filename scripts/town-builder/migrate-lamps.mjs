/** One-time migration. Original files are copied before either is changed. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {existsSync} from 'node:fs';
import {buildScene,loadSources} from '../lib/town-scene.mjs';

export function separateLamps(plan,layout,posts){
 if(plan.lampLayerVersion>=2)return {plan,layout,added:0,changed:false};
 const p=structuredClone(plan),l=structuredClone(layout);l.sprites??=[];
 let uid=l.sprites.reduce((n,s)=>Math.max(n,Number(s.uid)||0),0)+1,added=0;
 for(const post of posts){
  if(l.sprites.some(s=>s.id==='world:streetlamp'&&Math.hypot(s.x-post.px,s.y-post.py)<.6))continue;
  l.sprites.push({uid:uid++,id:'world:streetlamp',x:+post.px.toFixed(3),y:+post.py.toFixed(3),scale:1,flip:false,migratedLamp:true});added++;
 }
 p.reflections??=structuredClone(p.lamps||[]);p.paving??=[];delete p.lamps;p.lampLayerVersion=2;
 return {plan:p,layout:l,added,changed:true};
}
export async function migrateLamps(data){
 const pf=path.join(data,'plans/maple-falls.json'),lf=path.join(data,'layout.json');
 const plan=JSON.parse(await fs.readFile(pf,'utf8'));if(plan.lampLayerVersion>=2)return {changed:false};
 const source=existsSync(lf)?lf:path.join(data,'layout-seed.json');
 const layout=JSON.parse(await fs.readFile(source,'utf8'));
 const scene=buildScene(plan,await loadSources());
 const migrated=separateLamps(plan,layout,scene.lamps);
 const dir=path.join(data,'migration-backups',new Date().toISOString().replace(/[:.]/g,'-'));
 await fs.mkdir(dir,{recursive:true});
 await fs.copyFile(pf,path.join(dir,'plan.json'));await fs.copyFile(source,path.join(dir,'layout.json'));
 await fs.writeFile(lf,JSON.stringify(migrated.layout,null,1));
 await fs.writeFile(pf,JSON.stringify(migrated.plan,null,1));
 return {changed:true,added:migrated.added,reflections:migrated.plan.reflections.length,backup:dir};
}
