/** Side-by-side: the owner-approved painted straight, re-projected into the game's 2:1 view at game scale,
 *  next to the builder's straight with its lamp at the same spot. Run road-v4-render.mjs compare first. */
import path from 'node:path';
import sharp from 'sharp';
import {load,sample} from '../../lib/road-v4-warp.mjs';
import {ROOT} from '../../lib/town-paths.mjs';
const OUT=path.join(ROOT,'output/road-autotile-v4');
const built=await load(path.join(OUT,'maps/compare.png'));
const paint=await load(path.join(OUT,'sources/straight-rectified.png'));
const W=built.width,H=built.height,SCALE=32,MARGIN=40,OX=20*SCALE+MARGIN,OY=MARGIN;
const outBuf=Buffer.alloc(W*H*4);
for(let sy=0;sy<H;sy++)for(let sx=0;sx<W;sx++){
 let r=0,g=0,b=0,a=0;
 for(const [dx,dy] of [[.25,.25],[.75,.25],[.25,.75],[.75,.75]]){const A=(sx+dx-OX)/SCALE,B=(sy+dy-OY)/(SCALE/2),X=(A+B)/2,Y=(B-A)/2;
  // painting rows 112.5 / 479.5 are its two curb lines; the builder puts them at y = 6.75 / 13.25
  const u=X*55.2,v=112.5+(Y-6.75)*(367/6.5);const c=sample(paint,u,v);const w=c[3]/255;r+=c[0]*w;g+=c[1]*w;b+=c[2]*w;a+=w;}
 const o=(sy*W+sx)*4,bo=o;const ba=built.data[bo+3]/255;
 if(a>0){outBuf[o]=r/a;outBuf[o+1]=g/a;outBuf[o+2]=b/a;outBuf[o+3]=255*a/4;}
}
const bg={r:28,g:36,b:30,alpha:1};
const left=await sharp(outBuf,{raw:{width:W,height:H,channels:4}}).flatten({background:bg}).png().toBuffer();
const right=await sharp(path.join(OUT,'maps/compare-roads-transparent.png')).flatten({background:bg}).png().toBuffer();
const label=t=>Buffer.from(`<svg width="${W}" height="48"><rect width="${W}" height="48" fill="#101b20"/><text x="20" y="32" fill="#eee7d8" font-family="sans-serif" font-size="24">${t}</text></svg>`);
await sharp({create:{width:W*2+20,height:H+48,channels:4,background:bg}}).composite([
 {input:label('Approved painted straight (v3), re-projected to the game 2:1 view'),left:0,top:0},{input:left,left:0,top:48},
 {input:label('Road builder v4: same lamp position, same game scale'),left:W+20,top:0},{input:right,left:W+20,top:48}]).png().toFile(path.join(OUT,'review/compare-straight.png'));
console.log(path.join(OUT,'review/compare-straight.png'));
