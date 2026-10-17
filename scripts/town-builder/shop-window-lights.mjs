/** Shop fronts: one light per lit window and a single soft round light over the front, instead of find-glows' cloud of
 *  up to 48 small circles (which washed the shops yellow at night).
 *    node scripts/town-builder/shop-window-lights.mjs            -> review sheet only (output/town-builder/collision-audit)
 *    node scripts/town-builder/shop-window-lights.mjs --apply    -> also rewrites the shops in library.json (backed up)
 *  Each window is a cluster of lit pixels, fitted with the four-sided shape the isometric art draws it as: upright sides
 *  and a top and bottom sloping at the view's 1:2 (or level), whichever wraps the light tightest. Stored on the item as
 *  glowQuads:[[[x,y]x4]] in game pixels at scale 1 (like glows), and glows becomes one {x,y,r,plain:true}: a plain glow
 *  keeps its radius (no Lit windows size) and adds no warmth, it only puts the painted colour back. The old circles are
 *  kept as glowsAuto so a shop can go back. */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {ROOT} from '../lib/town-scene.mjs';
const LIB=path.join(ROOT,'output/town-builder/library'),OUT=path.join(ROOT,'output/town-builder/collision-audit');
const APPLY=process.argv.includes('--apply');
export const SHOP_FRONTS=/^(town:(bakery|barber|fish_tackle|grocery|hardware|laundromat|pharmacy|postoffice|firestation)|ref:building-(corner-shop|corner-store|grocery)|world:(video_rental|video|snack_bar|arcade|diner))$/;
const CELL=3;// file pixels per analysis cell
// the window light of find-glows: warm amber, and neon pink / cyan for the arcade and diner
const lit=(r,g,b)=>{const max=Math.max(r,g,b),min=Math.min(r,g,b),lum=.3*r+.59*g+.11*b;
 if(max>200&&g>170&&b>200&&r<140)return true;if(lum>165&&r>200&&g>140&&b<g*.82&&r-b>70)return true;if(max>220&&max-min>110&&lum>120&&(r>200&&b>170&&g<150))return true;return false;};
/** the tightest window shape round a cluster of cell centres: upright sides, top and bottom at slope s (file px) */
function fit(pts){let best=null;
 for(const s of [-.5,0,.5]){let x0=1e9,x1=-1e9,v0=1e9,v1=-1e9;for(const [x,y] of pts){const v=y-s*x;x0=Math.min(x0,x);x1=Math.max(x1,x);v0=Math.min(v0,v);v1=Math.max(v1,v);}
  const a=(x1-x0+CELL)*(v1-v0+CELL);if(!best||a<best.a)best={a,s,x0:x0-CELL/2,x1:x1+CELL/2,v0:v0-CELL/2,v1:v1+CELL/2};}
 const {s,x0,x1,v0,v1}=best;return {area:best.a,quad:[[x0,s*x0+v0],[x1,s*x1+v0],[x1,s*x1+v1],[x0,s*x0+v1]]};}
const lib=JSON.parse(await fs.readFile(path.join(LIB,'library.json'),'utf8'));const sheet=[],report=[];
for(const it of lib.items){if(!SHOP_FRONTS.test(it.id))continue;
 const {data,info}=await sharp(path.join(LIB,it.file)).ensureAlpha().raw().toBuffer({resolveWithObject:true}),W=info.width,H=info.height,gw=Math.ceil(W/CELL),gh=Math.ceil(H/CELL),cnt=new Uint16Array(gw*gh);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const o=(y*W+x)*4;if(data[o+3]<160)continue;if(lit(data[o],data[o+1],data[o+2]))cnt[Math.floor(y/CELL)*gw+Math.floor(x/CELL)]++;}
 const on=i=>cnt[i]>=CELL*CELL*.34,seen=new Uint8Array(gw*gh),wins=[];
 for(let i=0;i<gw*gh;i++){if(!on(i)||seen[i])continue;const q=[i],pts=[];seen[i]=1;
  while(q.length){const c=q.pop(),cx=c%gw,cy=Math.floor(c/gw);pts.push([cx*CELL+CELL/2,cy*CELL+CELL/2]);
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]){const a=cx+dx,b=cy+dy;if(a<0||b<0||a>=gw||b>=gh)continue;const j=b*gw+a;if(on(j)&&!seen[j]){seen[j]=1;q.push(j);}}}
  if(pts.length<6)continue;wins.push(fit(pts));}
 // a window is at least a few hundredths of a percent of the picture; keep the biggest sixteen
 const minA=W*H*.0012,kept=wins.filter(w=>w.area>=minA).sort((a,b)=>b.area-a.area).slice(0,16),k=it.w/W;
 const quads=kept.map(w=>w.quad.map(([x,y])=>[+(x*k).toFixed(1),+(y*k).toFixed(1)]));
 let round=null;if(quads.length){let ax=0,ay=0,aw=0;for(const w of kept){const c=w.quad.reduce((p,q)=>[p[0]+q[0]/4,p[1]+q[1]/4],[0,0]);ax+=c[0]*w.area;ay+=c[1]*w.area;aw+=w.area;}
  const cx=ax/aw*k,cy=ay/aw*k,r=Math.max(...quads.flat().map(([x,y])=>Math.hypot(x-cx,y-cy)))*.8;round={x:+cx.toFixed(1),y:+cy.toFixed(1),r:+r.toFixed(1),plain:true};}
 report.push(`${it.id}: ${it.glowsAuto?.length??it.glows?.length??0} circles -> ${quads.length} windows + ${round?1:0} round`);
 sheet.push({it,file:path.join(LIB,it.file),W,H,quads,round,k});
 if(APPLY&&quads.length){if(!it.glowsAuto)it.glowsAuto=it.glows||[];it.glows=[round];it.glowQuads=quads;}}
console.log(report.join('\n'));
// review sheet: every shop with its window shapes (green) and the round light (cyan)
await fs.mkdir(OUT,{recursive:true});const cols=4,cw=520,ch=460,rows=Math.ceil(sheet.length/cols),comps=[];
for(const [n,s] of sheet.entries()){const sc=Math.min((cw-20)/s.W,(ch-40)/s.H),w=Math.round(s.W*sc),h=Math.round(s.H*sc),left=(n%cols)*cw+10,top=Math.floor(n/cols)*ch+30;
 comps.push({input:await sharp(s.file).resize(w,h).png().toBuffer(),left,top});
 const f=sc/s.k,poly=s.quads.map(q=>`<polygon points="${q.map(([x,y])=>`${(x*f).toFixed(1)},${(y*f).toFixed(1)}`).join(' ')}" fill="rgba(124,255,100,.25)" stroke="#7cff64" stroke-width="2"/>`).join(''),
  circ=s.round?`<circle cx="${s.round.x*f}" cy="${s.round.y*f}" r="${s.round.r*f}" fill="none" stroke="#5fd1ff" stroke-width="2" stroke-dasharray="6 4"/>`:'';
 comps.push({input:Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${poly}${circ}</svg>`),left,top});
 comps.push({input:Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cw}" height="26"><text x="10" y="18" font-family="sans-serif" font-size="15" fill="#fff">${s.it.id} · ${s.quads.length} windows</text></svg>`),left:(n%cols)*cw,top:Math.floor(n/cols)*ch+2});}
const sheetFile=path.join(OUT,'shop-window-lights.png');
await sharp({create:{width:cols*cw,height:rows*ch,channels:4,background:{r:24,g:26,b:30,alpha:1}}}).composite(comps).png().toFile(sheetFile);console.log('sheet',sheetFile);
if(APPLY){const target=path.join(LIB,'library.json'),bak=path.join(ROOT,'output/town-builder/backups');await fs.mkdir(bak,{recursive:true});
 await fs.copyFile(target,path.join(bak,'library-before-shop-windows-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json'));
 await fs.writeFile(target+'.pending',JSON.stringify(lib,null,1));await fs.rename(target+'.pending',target);console.log('library updated');}
