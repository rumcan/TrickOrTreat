/** Draw sprites on a ground grid in metres from their anchor (u along +X, v along +Y), with the current collision
 *  footprint, to read where an object really stands.  node scripts/town-builder/measure-footprint.mjs id [id ...]
 *  -> output/town-builder/collision-audit/measure-<n>.png */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {ROOT} from '../lib/town-scene.mjs';
const DATA=path.join(ROOT,'output/town-builder'),LIB=path.join(DATA,'library'),OUT=path.join(DATA,'collision-audit');
const lib=JSON.parse(await fs.readFile(path.join(LIB,'library.json'),'utf8')),items=new Map(lib.items.map(i=>[i.id,i]));
const OVR=JSON.parse(await fs.readFile(new URL('./collision-overrides.json',import.meta.url),'utf8'));
const boxesOf=it=>OVR[it.id]?.boxes||[it.base||{shape:'rect',hx:it.fw,hy:it.fh,dx:0,dy:0}];
const S=32,K=3,tiles=[];
for(const id of process.argv.slice(2)){const it=items.get(id);if(!it){console.log('unknown',id);continue;}
 const src=it.fence?Buffer.from(await (await fetch('http://127.0.0.1:5190/fence-render/'+encodeURIComponent(id)+'.png?r=2')).arrayBuffer()):path.join(LIB,it.file);
 const pad=40,W=Math.round(it.w*K)+2*pad,H=Math.round(it.h*K)+2*pad,ax=it.ax*K+pad,ay=it.ay*K+pad,P=(u,v)=>[ax+(u-v)*S*K,ay+(u+v)*S/2*K];
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><g font-family="Arial" font-size="13">`;
 const R=Math.ceil(Math.max(it.w,it.h)/S)+2;
 for(let u=-R;u<=R;u++){const [a,b]=P(u,-R),[c,d]=P(u,R);svg+=`<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" stroke="${u?'#ffffff40':'#ffd166'}" stroke-width="1"/>`;}
 for(let v=-R;v<=R;v++){const [a,b]=P(-R,v),[c,d]=P(R,v);svg+=`<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" stroke="${v?'#ffffff40':'#66d1ff'}" stroke-width="1"/>`;}
 for(let u=-R;u<=R;u+=2)for(let v=-R;v<=R;v+=2){const [x,y]=P(u,v);if(x>0&&y>0&&x<W&&y<H)svg+=`<text x="${x+2}" y="${y-2}" fill="#ffd166" stroke="#000" stroke-width="2.5" paint-order="stroke">${u},${v}</text>`;}
 const B=boxesOf(it),b=B[0];
 for(const q of B){const pts=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([s,t])=>P((q.dx||0)+s*q.hx,(q.dy||0)+t*q.hy));svg+=`<polygon points="${pts.map(p=>p.join(',')).join(' ')}" fill="#ff4040" fill-opacity=".25" stroke="#ff4040" stroke-width="2"/>`;}
 svg+=`<text x="6" y="18" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke" font-size="16">${id}  box ${(2*b.hx).toFixed(2)}x${(2*b.hy).toFixed(2)} @ ${(b.dx||0).toFixed(2)},${(b.dy||0).toFixed(2)}</text></g></svg>`;
 const pic=await sharp(src).resize(Math.round(it.w*K),Math.round(it.h*K),{fit:'fill'}).png().toBuffer();
 tiles.push(await sharp({create:{width:W,height:H,channels:4,background:{r:46,g:58,b:40,alpha:1}}}).composite([{input:pic,left:pad,top:pad},{input:Buffer.from(svg)}]).png().toBuffer());
}
let n=0;for(const t of tiles)await sharp(t).toFile(path.join(OUT,`measure-${n++}.png`));console.log(n,'written');
