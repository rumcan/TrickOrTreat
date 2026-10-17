/** Owner scale table for preset authoring: node scripts/town-builder/places-v5/make-scales.mjs
 *  For every visible sprite the owner has placed: the scale it most often has on the map (`scale`) and every distinct
 *  scale it has been placed at (`placed`): presets only ever use these exact values. Otherwise otherwise an
 *  estimate from the owner's ratio to guideScale (buildings) or their category median (props). scale-overrides.json
 *  (reviewed proposals for sprites the owner has not used yet) wins over estimates, never over the owner's own choices. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ROOT} from '../../lib/town-paths.mjs';
const HERE=path.dirname(fileURLToPath(import.meta.url));
const DATA=path.join(ROOT,'output/town-builder');
const lib=JSON.parse(fs.readFileSync(path.join(DATA,'library/library.json'),'utf8')),items=lib.items.filter(i=>!i.hidden);
const layout=JSON.parse(fs.readFileSync(path.join(DATA,'layout.json'),'utf8')).sprites;
const med=a=>{a=a.slice().sort((x,y)=>x-y);const n=a.length;return n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2;};
const used={};for(const s of layout)(used[s.id]??=[]).push(s.scale||1);
const byCat={},ratio={};
for(const it of items){const u=used[it.id];if(!u)continue;const m=med(u);(byCat[it.category]??=[]).push(m);if(it.guideScale)(ratio[it.category]??=[]).push(m/it.guideScale);}
const allRatio=med(Object.values(ratio).flat());
let overrides={};try{overrides=JSON.parse(fs.readFileSync(path.join(HERE,'scale-overrides.json'),'utf8'));}catch{}
const out={};
for(const it of items){const u=used[it.id];
 if(u){const c=new Map();for(const x of u){const k=+x.toFixed(3);c.set(k,(c.get(k)||0)+1);}const top=Math.max(...c.values()),modes=[...c].filter(([,n])=>n===top).map(([k])=>k).sort((p,q)=>p-q);
  out[it.id]={scale:modes[Math.floor((modes.length-1)/2)],placed:[...c.keys()].sort((p,q)=>p-q),min:+Math.min(...u).toFixed(3),max:+Math.max(...u).toFixed(3),n:u.length,source:'owner'};continue;}
 if(overrides[it.id]){out[it.id]={scale:overrides[it.id].scale,source:'reviewed',note:overrides[it.id].note||''};continue;}
 let s,src;
 if(it.guideScale){const r=ratio[it.category]?med(ratio[it.category]):allRatio;s=it.guideScale*r;src=`estimate: guideScale ${it.guideScale} x owner ratio ${r.toFixed(2)} (${it.category})`;}
 else if(byCat[it.category]){s=med(byCat[it.category]);src=`estimate: owner median for ${it.category}`;}
 else{s=1;src='estimate: default 1'}
 out[it.id]={scale:+s.toFixed(3),source:src};}
fs.writeFileSync(path.join(HERE,'scales.json'),JSON.stringify(out,null,1));
console.log(Object.values(out).filter(v=>v.source==='owner').length,'owner',Object.values(out).filter(v=>v.source==='reviewed').length,'reviewed',Object.values(out).filter(v=>v.source.startsWith('estimate')).length,'estimated');
