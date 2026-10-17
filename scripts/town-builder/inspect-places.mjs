/** Stamp every place preset into a throwaway town (never the owner's), bake its ground and leave it ready to open in the
 *  town builder for inspection:  node scripts/town-builder/inspect-places.mjs [--no-bake]
 *  then: node scripts/town-builder/server.mjs --port 5198 --data output/town-builder/upgrade-review/places-inspect --assets output/town-builder
 *  Places are packed in rows with roads between them; stamping matches the app (fence planes flagged, ground -> plan lots/paving).
 *  Writes places-inspect/index.json with each place's centre so the camera can jump to it. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {ROOT} from '../lib/town-scene.mjs';
const HERE=path.dirname(fileURLToPath(import.meta.url)),LIVE=path.join(ROOT,'output/town-builder'),DATA=path.join(LIVE,'upgrade-review','places-inspect');
const lib=JSON.parse(await fs.readFile(path.join(LIVE,'library/library.json'),'utf8')),items=new Map(lib.items.map(i=>[i.id,i]));
const {presets}=JSON.parse(await fs.readFile(path.join(LIVE,'presets/places.json'),'utf8'));
const CELL=20,ROW_W=300,GAP=8;
// bounds of each place in its own coordinates
const bounds=p=>{let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;const add=(a,b,c,d)=>{x0=Math.min(x0,a);y0=Math.min(y0,b);x1=Math.max(x1,c);y1=Math.max(y1,d);};
 for(const m of p.members){const it=items.get(m.pick[0]);if(!it)continue;const s=m.scale[0],hx=(m.flip?it.fh:it.fw)*s,hy=(m.flip?it.fw:it.fh)*s;add(m.dx-hx,m.dy-hy,m.dx+hx,m.dy+hy);}
 for(const g of p.ground||[])add(Math.min(g.x0,g.x1),Math.min(g.y0,g.y1),Math.max(g.x0,g.x1),Math.max(g.y0,g.y1));return {x0,y0,x1,y1,w:x1-x0,h:y1-y0};};
// shelf packing; each row sits on a road (a row of road cells along its front)
let cx=CELL,cy=CELL,rowH=0;const at=[],roadRows=[];
for(const p of presets){const b=bounds(p);if(cx+b.w>ROW_W){roadRows.push(cy+rowH);cy+=Math.ceil((rowH+GAP+CELL)/CELL)*CELL;cx=CELL;rowH=0;}at.push({p,b,ox:cx-b.x0,oy:cy-b.y0});cx+=b.w+GAP;rowH=Math.max(rowH,b.h);}
roadRows.push(cy+rowH);const nx=Math.ceil((ROW_W+CELL)/CELL),ny=Math.ceil((cy+rowH+2*CELL)/CELL);
const roads=[];for(const y of roadRows){const j=Math.floor(y/CELL)+1;if(j<ny)for(let i=0;i<nx;i++)roads.push(`${i},${j}`);}
const sprites=[],lots=[],paving=[],index=[];let uid=1;
for(const {p,b,ox,oy} of at){const g='g-'+p.id;
 for(const m of p.members){const it=items.get(m.pick[0]);if(!it)continue;const o={uid:uid++,id:m.pick[0],x:+(ox+m.dx).toFixed(2),y:+(oy+m.dy).toFixed(2),flip:!!m.flip,scale:m.scale[0],g};if(it.fence)o.fencePlaneVersion=1;sprites.push(o);}
 (p.ground||[]).forEach((gr,i)=>{const c=JSON.parse(JSON.stringify(gr)),kind=c.kind;delete c.kind;c.x0=+(c.x0+ox).toFixed(2);c.x1=+(c.x1+ox).toFixed(2);c.y0=+(c.y0+oy).toFixed(2);c.y1=+(c.y1+oy).toFixed(2);
  for(const bb of c.bays||[]){const o=bb.side==='N'||bb.side==='S'?ox:oy;bb.from=+(bb.from+o).toFixed(2);bb.to=+(bb.to+o).toFixed(2);}
  c.id=(kind==='pave'?'pave-':'lot-')+p.id+'-'+i;(kind==='pave'?paving:lots).push(c);});
 index.push({id:p.id,name:p.name,x:+(ox+(b.x0+b.x1)/2).toFixed(1),y:+(oy+(b.y0+b.y1)/2).toFixed(1),w:+b.w.toFixed(1),h:+b.h.toFixed(1)});}
await fs.rm(DATA,{recursive:true,force:true});await fs.mkdir(path.join(DATA,'plans'),{recursive:true});await fs.mkdir(path.join(DATA,'presets'),{recursive:true});
const plan={name:'Place presets — inspection',nx,ny,roads,lines:{},lots,paving,lamps:[],reflections:[]};
await fs.writeFile(path.join(DATA,'plans/maple-falls.json'),JSON.stringify(plan,null,1));await fs.writeFile(path.join(DATA,'layout.json'),JSON.stringify({version:1,sprites}));
await fs.copyFile(path.join(LIVE,'presets/places.json'),path.join(DATA,'presets/places.json'));await fs.writeFile(path.join(DATA,'index.json'),JSON.stringify(index,null,1));
console.log(`${presets.length} places, ${sprites.length} sprites, ${lots.length} lots, ${paving.length} paving, map ${nx}x${ny} cells`);
if(!process.argv.includes('--no-bake')){const r=spawnSync(process.execPath,[path.join(HERE,'bake.mjs'),path.join(DATA,'plans/maple-falls.json'),path.join(DATA,'map')],{cwd:path.resolve(HERE,'../..'),stdio:'inherit'});process.exit(r.status??1);}
