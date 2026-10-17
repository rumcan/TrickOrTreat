/** Review sheets: every upright sprite with its shadow and its footprint/collision diamond (cyan = fw x fh at the anchor).
 *  node scripts/town-builder/footprint-sheet.mjs [filter]  ->  output/town-builder/review/footprints-N.png */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {ROOT} from '../lib/town-scene.mjs';
const LIB=path.join(ROOT,'output/town-builder/library'),OUT=path.join(ROOT,'output/town-builder/review'),filter=process.argv[2]||'';
const lib=JSON.parse(await fs.readFile(path.join(LIB,'library.json'),'utf8'));
const its=lib.items.filter(i=>!i.flat&&!i.hidden&&i.id.includes(filter));
const CW=400,CH=400,COLS=6,PER=36;await fs.mkdir(OUT,{recursive:true});
for(let p=0;p*PER<its.length;p++){const page=its.slice(p*PER,(p+1)*PER),comp=[];let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${CW*COLS}" height="${CH*Math.ceil(page.length/COLS)}">`;
 for(const [k,it] of page.entries()){const x0=(k%COLS)*CW,y0=Math.floor(k/COLS)*CH,s=Math.min(1,(CW-40)/Math.max(it.w,(it.fw+it.fh)*64+20),(CH-70)/Math.max(it.h,1));
  const ax=x0+CW/2+(it.ax-it.w/2)*s,ay=y0+20+it.ay*s;
  if(it.shadow){const sh=it.shadow;comp.push({input:await sharp(path.join(LIB,sh.file)).resize(Math.max(1,Math.round(sh.w*s)),Math.max(1,Math.round(sh.h*s))).png().toBuffer(),left:Math.round(ax-sh.ax*s),top:Math.round(ay+(sh.dy||0)*s-sh.ay*s)});}
  comp.push({input:await sharp(path.join(LIB,it.file)).resize(Math.max(1,Math.round(it.w*s)),Math.max(1,Math.round(it.h*s))).png().toBuffer(),left:Math.round(ax-it.ax*s),top:Math.round(ay-it.ay*s)});
  const B=it.base||{hx:it.fw,hy:it.fh,dx:0,dy:0},P=(X,Y)=>{X+=B.dx||0;Y+=B.dy||0;return `${(ax+(X-Y)*32*s).toFixed(1)},${(ay+(X+Y)*16*s).toFixed(1)}`;},a=B.hx,b=B.hy;
  svg+=`<polygon points="${P(-a,-b)} ${P(a,-b)} ${P(a,b)} ${P(-a,b)}" fill="none" stroke="#3df2ff" stroke-width="2"/><circle cx="${ax}" cy="${ay}" r="3" fill="#ff3dd2"/>`;
  svg+=`<text x="${x0+6}" y="${y0+CH-10}" fill="#fff" font-size="14" font-family="monospace">${k+p*PER} ${it.id.replace(/&/g,'&amp;').slice(0,40)}</text>`;}
 svg+='</svg>';const W=CW*COLS,H=CH*Math.ceil(page.length/COLS);
 await sharp({create:{width:W,height:H,channels:3,background:'#4a6630'}}).composite([...comp.filter(c=>c.left>-2000),{input:Buffer.from(svg),left:0,top:0}]).resize({width:2400}).png().toFile(path.join(OUT,`footprints-${p}.png`));}
console.log(its.length,'sprites,',Math.ceil(its.length/PER),'sheets');
