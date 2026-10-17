/** Fit each upright sprite's collision footprint to where its drawing actually touches the ground.
 *    node scripts/town-builder/fit-collision.mjs [--apply]   -> output/town-builder/collision-audit/fit.json
 *  On the 2:1 projection an axis-aligned footprint's lower outline is a V: the bottom vertex is its +u+v corner and the
 *  two arms run up at slope 1/2 to the +u-v and -u+v corners. We take the lowest opaque pixel of every column, find the
 *  V that the outline follows (bottom vertex = lowest point, arms = the furthest columns still on the arm lines, within
 *  a 0.3 m tolerance), and read the footprint off it. Canopies, roofs, signs and handles stand above the arms, so they
 *  do not widen the footprint; legs and wheels lie on the arms, so they bound it.
 *  --apply writes item.collision {shape:'rect',hx,hy,dx,dy} into library.json (backup first) for every sprite whose
 *  fit was accepted (see RULES below); the game export uses collision before base. */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {ROOT} from '../lib/town-scene.mjs';
const DATA=path.join(ROOT,'output/town-builder'),LIB=path.join(DATA,'library'),OUT=path.join(DATA,'collision-audit');
const lib=JSON.parse(await fs.readFile(path.join(LIB,'library.json'),'utf8')),items=new Map(lib.items.map(i=>[i.id,i]));
const layout=JSON.parse(await fs.readFile(path.join(DATA,'layout.json'),'utf8'));
const ids=[...new Set(layout.sprites.map(s=>s.id))].filter(id=>{const it=items.get(id);return it&&!it.flat&&!id.startsWith('kid:');}).sort();
const S=32,K=2;// game px per metre along an axis; audit pixels per game px
async function source(it){if(it.fence){const r=await fetch('http://127.0.0.1:5190/fence-render/'+encodeURIComponent(it.id)+'.png?r=2');return Buffer.from(await r.arrayBuffer());}return path.join(LIB,it.file);}
const results=[];
for(const id of ids){const it=items.get(id),W=Math.round(it.w*K),H=Math.round(it.h*K);
 const {data}=await sharp(await source(it)).resize(W,H,{fit:'fill'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const low=new Float64Array(W).fill(-1);for(let x=0;x<W;x++)for(let y=H-1;y>=0;y--)if(data[(y*W+x)*4+3]>110){low[x]=y;break;}
 // bottom vertex: the lowest point (centre of the lowest run, so a flat bottom edge does not bias it)
 let yb=-1;for(let x=0;x<W;x++)yb=Math.max(yb,low[x]);if(yb<0)continue;
 let xs=[];for(let x=0;x<W;x++)if(low[x]>=yb-1)xs.push(x);const xb=xs.reduce((a,b)=>a+b,0)/xs.length;
 const tol=.3*S*K/2;// 0.3 m measured along screen y
 let xl=xb,xr=xb;
 for(let x=0;x<W;x++){if(low[x]<0)continue;const line=yb-(xb-x)*.5,line2=yb-(x-xb)*.5;
  if(x<xb&&Math.abs(low[x]-line)<=tol)xl=Math.min(xl,x);
  if(x>xb&&Math.abs(low[x]-line2)<=tol)xr=Math.max(xr,x);}
 // screen -> metres relative to the anchor
 const d=x=>(x/K-it.ax)/S,sv=y=>(y/K-it.ay)/(S/2);
 const db=d(xb),sb=sv(yb),u1=(sb+db)/2,v1=(sb-db)/2,u0=d(xl)+v1,v0=u1-d(xr);
 let hx=Math.max(.15,(u1-u0)/2),hy=Math.max(.15,(v1-v0)/2),dx=(u0+u1)/2,dy=(v0+v1)/2;
 const b=it.base||{hx:it.fw,hy:it.fh,dx:0,dy:0};
 results.push({id,cat:it.category,fit:{hx:+hx.toFixed(2),hy:+hy.toFixed(2),dx:+dx.toFixed(2),dy:+dy.toFixed(2)},base:{shape:b.shape,hx:+b.hx.toFixed(2),hy:+b.hy.toFixed(2),dx:+(b.dx||0).toFixed(2),dy:+(b.dy||0).toFixed(2)}});
}
await fs.writeFile(path.join(OUT,'fit.json'),JSON.stringify(results,null,1));
for(const r of results){const f=r.fit,b=r.base,move=Math.hypot(f.dx-b.dx,f.dy-b.dy),area=(f.hx*f.hy)/(b.hx*b.hy);
 if(move>.35||area<.5||area>2)console.log(r.id.padEnd(38),'base',`${(2*b.hx).toFixed(1)}x${(2*b.hy).toFixed(1)}@${b.dx},${b.dy}`.padEnd(22),'fit',`${(2*f.hx).toFixed(1)}x${(2*f.hy).toFixed(1)}@${f.dx},${f.dy}`);}
