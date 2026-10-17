/** Measure every upright sprite's real ground footprint from its drawing and compare it with the library.
 *  node scripts/town-builder/fit-footprints.mjs [--apply]
 *  In the 2:1 view a box with half-extents a (X) and b (Y) metres has its left/right ground corners (a+b)*64 px apart and
 *  its front corner (a-b)*32 px right of their midpoint. So from the silhouette's lower part (leftmost, rightmost and
 *  lowest opaque points) we get a, b and the footprint centre. Writes review/footprint-fit.json and a check sheet;
 *  --apply rewrites fw/fh/ax/ay for flagged generated sprites (gen:*), then regenerates their shadows/collision. */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {ROOT} from '../lib/town-scene.mjs';
const LIB=path.join(ROOT,'output/town-builder/library'),apply=process.argv.includes('--apply');
const lib=JSON.parse(await fs.readFile(path.join(LIB,'library.json'),'utf8'));
const rows=[];
for(const it of lib.items){if(it.flat||it.hidden)continue;
 const {data,info}=await sharp(path.join(LIB,it.file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});const W=info.width,H=info.height,k=it.w/W,A=(x,y)=>data[(y*W+x)*4+3];
 let bx=0,by=-1;for(let y=H-1;y>=0&&by<0;y--){let s=0,n=0;for(let x=0;x<W;x++)if(A(x,y)>120){s+=x;n++;}if(n){bx=s/n;by=y;}}
 // left/right extremes within the lower 45% (ground corners; ignores roof overhang above)
 let xl=W,xr=0;for(let y=Math.floor(H*.55);y<H;y++)for(let x=0;x<W;x++)if(A(x,y)>120){if(x<xl)xl=x;if(x>xr)xr=x;}
 const sum=(xr-xl)*k/64,diff=(bx*k-(xl+xr)/2*k)/32;let a=(sum+diff)/2,b=(sum-diff)/2;
 a=Math.max(.15,a);b=Math.max(.15,b);const cx=(xl+xr)/2*k,cy=by*k-(a+b)*16;
 const dFw=Math.abs(a-it.fw)/Math.max(.5,it.fw),dFh=Math.abs(b-it.fh)/Math.max(.5,it.fh),dA=Math.hypot(cx-it.ax,cy-it.ay);
 const big=(it.fw+it.fh)>=3;const bad=big&&((dFw>.45||dFh>.45)&&Math.abs((a+b)-(it.fw+it.fh))<(it.fw+it.fh)*.6||dA>Math.max(18,(it.fw+it.fh)*10));
 rows.push({id:it.id,lib:{fw:it.fw,fh:it.fh,ax:+it.ax.toFixed(1),ay:+it.ay.toFixed(1)},fit:{fw:+a.toFixed(2),fh:+b.toFixed(2),ax:+cx.toFixed(1),ay:+cy.toFixed(1)},swapped:big&&Math.abs(a-it.fh)<Math.abs(a-it.fw)*.6,bad});
 if(apply&&bad&&it.id.startsWith('gen:')){it.fw=+a.toFixed(2);it.fh=+b.toFixed(2);it.ax=+cx.toFixed(1);it.ay=+cy.toFixed(1);delete it.shadow;delete it.base;}}
await fs.mkdir(path.join(ROOT,'output/town-builder/review'),{recursive:true});
await fs.writeFile(path.join(ROOT,'output/town-builder/review/footprint-fit.json'),JSON.stringify(rows,null,1));
if(apply){await fs.writeFile(path.join(LIB,'library.json'),JSON.stringify(lib,null,1));const {ensureShadows}=await import('./shadows.mjs');await ensureShadows();}
for(const r of rows.filter(r=>r.bad))console.log((r.swapped?'SWAP ':'     ')+r.id.padEnd(40),'lib',JSON.stringify(r.lib),'fit',JSON.stringify(r.fit));
console.log(rows.length,'checked',rows.filter(r=>r.bad).length,'flagged');
