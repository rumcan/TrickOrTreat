/** Collision audit: every upright sprite placed in the town, with its collision base drawn on the picture.
 *    node scripts/town-builder/collision-audit.mjs   -> output/town-builder/collision-audit/{sheet-*.png,report.json}
 *  Scores: cover = share of the collision footprint the drawn object covers (low = box sticks out of the object);
 *          contact = share of the object's ground-contact strip (lowest 18% of its opaque rows) inside the box
 *          (low = the object stands on ground the box leaves open). Fences, trees and lamps are judged on their feet. */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {ROOT} from '../lib/town-scene.mjs';
const DATA=path.join(ROOT,'output/town-builder'),LIB=path.join(DATA,'library'),OUT=path.join(DATA,'collision-audit');
await fs.mkdir(OUT,{recursive:true});
const lib=JSON.parse(await fs.readFile(path.join(LIB,'library.json'),'utf8')),items=new Map(lib.items.map(i=>[i.id,i]));
const OVR=JSON.parse(await fs.readFile(new URL('./collision-overrides.json',import.meta.url),'utf8'));
const boxesOf=it=>OVR[it.id]?.boxes||[it.base||{shape:'rect',hx:it.fw,hy:it.fh,dx:0,dy:0}];
const layout=JSON.parse(await fs.readFile(path.join(DATA,'layout.json'),'utf8'));
const ids=[...new Set(layout.sprites.map(s=>s.id))].filter(id=>{const it=items.get(id);return it&&!it.flat&&!id.startsWith('kid:');}).sort();
const S=32;// game px per metre along an axis
async function source(it){if(it.fence){const r=await fetch('http://127.0.0.1:5190/fence-render/'+encodeURIComponent(it.id)+'.png?r=2');return Buffer.from(await r.arrayBuffer());}return path.join(LIB,it.file);}
const report=[],tiles=[];
for(const id of ids){const it=items.get(id),B=boxesOf(it),b=B[0];
 const W=Math.round(it.w*2),H=Math.round(it.h*2),k=2;// sprite pixels per game px in the audit
 const {data}=await sharp(await source(it)).resize(W,H,{fit:'fill'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const A=(x,y)=>x<0||y<0||x>=W||y>=H?0:data[(y*W+x)*4+3];
 // footprint polygon in sprite pixels: ground point (u,v) metres from the anchor -> screen
 const P=(u,v)=>[(it.ax+(u-v)*S)*k,(it.ay+(u+v)*S/2)*k];
 const inBox=(q,u,v)=>q.shape==='ellipse'?((u-(q.dx||0))/q.hx)**2+((v-(q.dy||0))/q.hy)**2<=1:Math.abs(u-(q.dx||0))<=q.hx&&Math.abs(v-(q.dy||0))<=q.hy,inside=(u,v)=>B.some(q=>inBox(q,u,v));
 const toUV=(x,y)=>{const a=(x/k-it.ax)/S,c=(y/k-it.ay)/(S/2);return [(a+c)/2,(c-a)/2];};
 let n=0,covered=0;
 for(let i=0;i<600;i++){const q=B[i%B.length],u=(q.dx||0)+(Math.random()*2-1)*q.hx,v=(q.dy||0)+(Math.random()*2-1)*q.hy;if(!inBox(q,u,v))continue;const [x,y]=P(u,v);n++;if(A(Math.round(x),Math.round(y))>100)covered++;}
 // contact strip: opaque pixels in the lowest 18% of the opaque rows, mapped to the ground plane
 let top=H,bot=-1;for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(A(x,y)>100){top=Math.min(top,y);bot=Math.max(bot,y);break;}
 let cn=0,cin=0;const band=Math.max(2,Math.round((bot-top)*.18));
 for(let y=bot-band;y<=bot;y++)for(let x=0;x<W;x+=2)if(A(x,y)>100){cn++;const [u,v]=toUV(x,y);
  // a contact pixel sits at the foot of a wall: accept if the nearest footprint point is within 0.35 m
  if(B.some(q=>{const cu=Math.max((q.dx||0)-q.hx,Math.min((q.dx||0)+q.hx,u)),cv=Math.max((q.dy||0)-q.hy,Math.min((q.dy||0)+q.hy,v));return Math.hypot(u-cu,v-cv)<.35+(q.shape==='ellipse'?.15:0);}))cin++;}
 const r={id,cat:it.category,shape:b.shape,boxes:B.length,box:[+(2*b.hx).toFixed(2),+(2*b.hy).toFixed(2)],override:!!OVR[id],cover:n?+(covered/n).toFixed(2):0,contact:cn?+(cin/cn).toFixed(2):0};
 r.flag=(r.cover<.75?'box sticks out ':'')+(r.contact<.55?'object stands outside box':'');if(r.override)r.flag=r.flag?'measured: '+r.flag:'';report.push(r);
 // tile: sprite + footprint outline + verdict
 const polys=B.map(q=>q.shape==='ellipse'?Array.from({length:32},(_,i)=>{const a=i/32*Math.PI*2;return P((q.dx||0)+Math.cos(a)*q.hx,(q.dy||0)+Math.sin(a)*q.hy);}):[[-1,-1],[1,-1],[1,1],[-1,1]].map(([s,t])=>P((q.dx||0)+s*q.hx,(q.dy||0)+t*q.hy)));
 const col=r.flag?'#ff4040':'#40ff70';
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${polys.map(pts=>`<polygon points="${pts.map(p=>p.join(',')).join(' ')}" fill="${col}" fill-opacity="0.28" stroke="${col}" stroke-width="${Math.max(2,W/120)}"/>`).join('')}</svg>`;
 const pic=await sharp({create:{width:W,height:H,channels:4,background:{r:58,g:72,b:52,alpha:1}}}).composite([{input:await sharp(await source(it)).resize(W,H,{fit:'fill'}).png().toBuffer()},{input:Buffer.from(svg)}]).png().toBuffer();
 const TS=300,label=`<svg xmlns="http://www.w3.org/2000/svg" width="${TS}" height="44"><text x="4" y="16" font-family="Arial" font-size="13" fill="#fff">${id.replace(/&/g,'&amp;').slice(0,40)}</text><text x="4" y="36" font-family="Arial" font-size="13" fill="${col}">cover ${r.cover} contact ${r.contact} ${r.flag}</text></svg>`;
 tiles.push(await sharp({create:{width:TS,height:TS+44,channels:3,background:'#1b1f18'}}).composite([{input:await sharp(pic).resize(TS,TS,{fit:'contain',background:'#1b1f18'}).png().toBuffer(),left:0,top:44},{input:Buffer.from(label),left:0,top:0}]).png().toBuffer());
}
const C=6,R=4;for(let s=0;s*C*R<tiles.length;s++){const comp=tiles.slice(s*C*R,(s+1)*C*R).map((input,i)=>({input,left:(i%C)*300,top:Math.floor(i/C)*344}));
 await sharp({create:{width:C*300,height:R*344,channels:3,background:'#111'}}).composite(comp).jpeg({quality:82}).toFile(path.join(OUT,`sheet-${String(s).padStart(2,'0')}.jpg`));}
await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify(report,null,1));
const bad=report.filter(r=>r.flag);console.log(`${report.length} sprites audited, ${bad.length} flagged`);for(const r of bad)console.log(r.id.padEnd(40),r.cat.padEnd(24),'cover',r.cover,'contact',r.contact,r.flag);
