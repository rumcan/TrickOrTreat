/** Verification: every sprite with a guideScale, drawn at that scale, with the Sheet Ghost at 0.98 standing at its door side. */
import fs from 'node:fs/promises';import path from 'node:path';import sharp from 'sharp';import {ROOT} from '../lib/town-scene.mjs';
const LIB=path.join(ROOT,'output/town-builder/library'),OUT=path.join(ROOT,'output/town-builder/review');
const lib=JSON.parse(await fs.readFile(path.join(LIB,'library.json'),'utf8')),ghost=lib.items.find(i=>i.id==='ref:halloween-sheet-ghost');
const its=lib.items.filter(i=>i.guideScale&&!i.hidden&&i.guideScale>1.4);const S=.45,CW=600,CH=560,COLS=5,PER=20;
const gbuf=await sharp(path.join(LIB,ghost.file)).resize(Math.round(ghost.w*.98*S),Math.round(ghost.h*.98*S)).png().toBuffer();
for(let p=0;p*PER<its.length;p++){const page=its.slice(p*PER,(p+1)*PER),comp=[];let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${CW*COLS}" height="${CH*Math.ceil(page.length/COLS)}">`;
 for(const [k,it] of page.entries()){const x0=(k%COLS)*CW,y0=Math.floor(k/COLS)*CH,s=it.guideScale*S,w=Math.round(it.w*s),h=Math.round(it.h*s),fit=Math.min(1,(CW-90)/w,(CH-40)/h,1);
  const W=Math.max(1,Math.round(w*fit)),Hh=Math.max(1,Math.round(h*fit));const left=x0+70,top=Math.max(y0,y0+CH-30-Hh);comp.push({input:await sharp(path.join(LIB,it.file)).resize(W,Hh).png().toBuffer(),left,top});
  const gh=Math.round(ghost.h*.98*S*fit),gw=Math.round(ghost.w*.98*S*fit);comp.push({input:await sharp(gbuf).resize(Math.max(1,gw),Math.max(1,gh)).png().toBuffer(),left:x0+6,top:y0+CH-30-gh});
  svg+=`<line x1="${x0}" y1="${y0+CH-30-gh}" x2="${x0+CW}" y2="${y0+CH-30-gh}" stroke="#ff3dd2" stroke-dasharray="6 4"/><text x="${x0+6}" y="${y0+CH-8}" fill="#fff" font-size="15" font-family="monospace">${it.id} ×${it.guideScale}</text>`;}
 const HH=CH*Math.ceil(page.length/COLS),safe=[];for(const c of comp){const m=await sharp(c.input).metadata();let buf=c.input,l=Math.max(0,c.left),t=Math.max(0,c.top);const w=Math.min(m.width,CW*COLS-l),h=Math.min(m.height,HH-t);if(w<1||h<1)continue;if(w<m.width||h<m.height)buf=await sharp(c.input).extract({left:0,top:0,width:w,height:h}).png().toBuffer();safe.push({input:buf,left:l,top:t});}
 await sharp({create:{width:CW*COLS,height:HH,channels:3,background:'#4a6630'}}).composite([...safe,{input:Buffer.from(svg+'</svg>'),left:0,top:0}]).png().toBuffer().then(b=>sharp(b).resize({width:2400})).then(x=>x.toFile(path.join(OUT,`guide-${p}.png`)));}
console.log(its.length,'checked');
