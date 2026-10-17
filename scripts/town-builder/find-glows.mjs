/** Find the lit spots painted into every upright sprite (amber windows, porch and street lamps, lanterns, pumpkin faces,
 *  neon) and store them on the library item as glows:[{x,y,r}] in game pixels at scale 1, relative to the sprite's top
 *  left. The night uses them to put the painted colour back exactly where something shines.
 *    node scripts/town-builder/find-glows.mjs [--sheet]   (backs up library.json; --sheet writes a review image) */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {ROOT} from '../lib/town-scene.mjs';
const LIB=path.join(ROOT,'output/town-builder/library'),OUT=path.join(ROOT,'output/town-builder/collision-audit');
const target=path.join(LIB,'library.json'),lib=JSON.parse(await fs.readFile(target,'utf8'));
const CELL=6;// file pixels per analysis cell
// a lit pixel: bright, warm, yellow-orange (lamplight), or saturated neon pink/cyan; leaves and brick are too dark
// only things that really give off light are scanned: buildings, vehicles (headlights), lamps, lanterns, pumpkins, stands
const SHINES=/^(Houses|Shops & services|Landmarks & venues|House backs|House rear & side views|Vehicles)$/,SHINE_ID=/^(world:(streetlamp|vending|candy_stand|pumpkin_d|schoolbus|drivein_screen|drivein_marquee|snack_bar|gazebo)|ref:building-drive-in-screen|town:traffic_light|ref:halloween-(lantern|pumpkin-cluster)|town:(phone_booth|bus_stop)|gen:inflatable-pumpkin|expansion:(firepit|blowmold-ghost|homemade-ufo|treehouse|camper|pop-up-caravan|glasshouse|rocket-playfort|mobile-home)|ref:halloween-hay-bales)$/;
const LEAFY=/^expansion:treehouse$/;
const lit=(r,g,b,car,screen,leafy)=>{
 if(leafy){const lum=.3*r+.59*g+.11*b;return lum>200&&r>235&&g>185&&b<g*.8;}const max=Math.max(r,g,b),min=Math.min(r,g,b),lum=.3*r+.59*g+.11*b;
 if(screen&&lum>135)return true;                                    // the drive-in's lit screen
 if(car)return lum>232&&r>225&&g>205&&b>120&&b<=r+5;                 // vehicles: only the bright lamps, not a yellow or cream body
 if(max>235&&g<110&&r>220)return true;                              // red signal / tail light glow
 if(car&&lum>205&&r>205&&g>190&&b>110&&b<=r)return true;            // headlights: near-white warm
 if(max>200&&g>170&&b>200&&r<140)return true;                       // cyan / blue neon
 if(lum>165&&r>200&&g>140&&b<g*.82&&r-b>70)return true;           // amber / yellow window light
 if(max>220&&max-min>110&&lum>120&&(r>200&&b>170&&g<150))return true; // pink neon
 return false;};
let n=0,withGlow=0;const review=[];
for(const it of lib.items){if(it.flat||it.hidden||it.fence)continue;if(!SHINES.test(it.category)&&!SHINE_ID.test(it.id)){delete it.glows;continue;}const car=it.category==='Vehicles'||it.id==='world:schoolbus',screen=/drive-in-screen|drivein_screen/.test(it.id),leafy=LEAFY.test(it.id);
 const file=path.join(LIB,it.file);let raw;try{raw=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});}catch{continue;}
 const {data,info}=raw,W=info.width,H=info.height,gw=Math.ceil(W/CELL),gh=Math.ceil(H/CELL),cells=new Float32Array(gw*gh);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const o=(y*W+x)*4;if(data[o+3]<160)continue;if(lit(data[o],data[o+1],data[o+2],car,screen,leafy))cells[Math.floor(y/CELL)*gw+Math.floor(x/CELL)]++;}
 const on=new Uint8Array(gw*gh);for(let i=0;i<gw*gh;i++)on[i]=cells[i]>=CELL*CELL*.18?1:0;
 // connected clusters of lit cells
 const seen=new Uint8Array(gw*gh),glows=[];
 for(let i=0;i<gw*gh;i++){if(!on[i]||seen[i])continue;const q=[i];seen[i]=1;let sx=0,sy=0,cnt=0,x0=1e9,x1=-1,y0=1e9,y1=-1;
  while(q.length){const c=q.pop(),cx=c%gw,cy=Math.floor(c/gw);sx+=cx;sy+=cy;cnt++;x0=Math.min(x0,cx);x1=Math.max(x1,cx);y0=Math.min(y0,cy);y1=Math.max(y1,cy);
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]){const a=cx+dx,b=cy+dy;if(a<0||b<0||a>=gw||b>=gh)continue;const j=b*gw+a;if(on[j]&&!seen[j]){seen[j]=1;q.push(j);}}}
  if(cnt<1)continue;const k=it.w/W;// game px per file px
  const r=Math.max((x1-x0+1),(y1-y0+1))*CELL*k/2;
  if(car&&r>7)continue;// a headlight is small: a big patch on a car is paintwork
  if(car&&(sy/cnt+.5)*CELL<H*.55)continue;// lamps sit low on a vehicle: bright spots up top are roof and glass highlights
  glows.push({x:+((sx/cnt+.5)*CELL*k).toFixed(1),y:+((sy/cnt+.5)*CELL*k).toFixed(1),r:+Math.max(3,r).toFixed(1),a:cnt});}
 glows.sort((a,b)=>b.a-a.a);it.glows=glows.slice(0,48).map(({a,...g})=>g);if(!it.glows.length)delete it.glows;else withGlow++;n++;
 if(process.argv.includes('--sheet')&&it.glows&&/treehouse/.test(it.id))review.push(it);
}
await fs.mkdir(path.join(LIB,'backups'),{recursive:true});await fs.copyFile(target,path.join(LIB,'backups','library-before-glows-'+Date.now()+'.json'));
const pending=target+'.pending';await fs.writeFile(pending,JSON.stringify(lib,null,1));await fs.rename(pending,target);
console.log(`${n} upright sprites scanned, ${withGlow} have lit spots`);
if(review.length){const T=300,tiles=[];for(const it of review.slice(0,36)){const W=Math.round(it.w*2),H=Math.round(it.h*2);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${it.glows.map(g=>`<circle cx="${g.x*2}" cy="${g.y*2}" r="${g.r*2}" fill="none" stroke="#00ffd0" stroke-width="3"/>`).join('')}</svg>`;
  const pic=await sharp({create:{width:W,height:H,channels:4,background:'#222'}}).composite([{input:await sharp(path.join(LIB,it.file)).resize(W,H,{fit:'fill'}).png().toBuffer()},{input:Buffer.from(svg)}]).png().toBuffer();
  tiles.push(await sharp(pic).resize(T,T,{fit:'contain',background:'#111'}).png().toBuffer());}
 await sharp({create:{width:6*T,height:Math.ceil(tiles.length/6)*T,channels:3,background:'#111'}}).composite(tiles.map((input,i)=>({input,left:(i%6)*T,top:Math.floor(i/6)*T}))).jpeg({quality:82}).toFile(path.join(OUT,'glows.jpg'));}
