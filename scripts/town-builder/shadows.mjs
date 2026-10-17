/** Base shadows + collision footprints for every library sprite.
 *  node scripts/town-builder/shadows.mjs [--force]
 *  For each upright sprite: a feathered ground shape at its base, projected in the game's 2:1 view, saved as one small WebP
 *  (library/shadows/<id>.webp) so the app/export draw it with ONE image draw. The same shape is recorded as `base`
 *  {shape:'rect'|'ellipse', hx, hy (half extents, metres, before mirroring)} — a ready-made collision box.
 *  Shapes:  buildings / vehicles / big venues -> their footprint;  fences -> a thin strip along their axis;
 *           poles, lamps, signs, hydrants, small props -> measured from the bottom of the silhouette (small and dark);
 *           trees, bushes, pumpkins, hay, ghosts -> round, sized from the trunk/base, not the canopy.
 *  The server runs ensureShadows() at start-up, so any sprite added later gets its shadow automatically. */
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {fileURLToPath} from 'node:url';
import {ROOT} from '../lib/town-paths.mjs';
const LIB=path.join(ROOT,'output/town-builder/library');
const PX=32,VERSION=13; // game px per axis metre at zoom 1
const ROUND=/tree|tree_|tree-|bush|fern|hydrangea|ornamental|mums|pumpkin|hay|ghost|scarecrow|shrub|plant|grass_clump|witch|lantern/i;
const POLE=/lamp|utility_pole|pole|street_sign|stop_sign|traffic|speaker_post|goalpost|hydrant|mailbox|marquee|sign|post|flag/i;
const FOOTPRINT=/^(Houses|Shops & services|Landmarks & venues|Vehicles)$/;
const clamp=(v,a,b)=>v<a?a:v>b?b:v,smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
/** Width (game px) of the silhouette's lowest band, and its centre offset from the anchor. */
async function baseWidth(it,band){const {data,info}=await sharp(path.join(LIB,it.file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const W=info.width,H=info.height,k=it.w/W;let yb=-1;for(let y=H-1;y>=0&&yb<0;y--)for(let x=0;x<W;x++)if(data[(y*W+x)*4+3]>110){yb=y;break;}
 if(yb<0)return null;const rows=Math.max(3,Math.round(band*H));let best=0,cx=0;
 for(let y=yb;y>yb-rows&&y>=0;y--){let x0=-1,x1=-1;for(let x=0;x<W;x++)if(data[(y*W+x)*4+3]>110){if(x0<0)x0=x;x1=x;}if(x0>=0&&x1-x0>best){best=x1-x0;cx=(x0+x1)/2;}}
 return {w:best*k,cx:cx*k,bottom:yb*k};}
/** Lowest opaque pixel (game px from sprite top) within the middle third of the sprite: the drawn ground contact. */
async function contactY(it){const {data,info}=await sharp(path.join(LIB,it.file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});const W=info.width,H=info.height,k=it.h/H;
 const x0=Math.floor(W*.3),x1=Math.ceil(W*.7);for(let y=H-1;y>=0;y--)for(let x=x0;x<x1;x++)if(data[(y*W+x)*4+3]>110)return y*k;return null;}
/** Fit the real ground box from the drawing: in 2:1 a box with half-extents a (X) and b (Y) metres has left/right ground
 *  corners (a+b)*64 px apart and its front corner (a-b)*32 px right of their midpoint. Uses the lower 45% of the silhouette.
 *  Returns half-extents and the box centre's ground offset (metres) from the sprite anchor. */
export async function fitBox(it){const {data,info}=await sharp(path.join(LIB,it.file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});const W=info.width,H=info.height,k=it.w/W,A=(x,y)=>data[(y*W+x)*4+3];
 let bx=0,by=-1;for(let y=H-1;y>=0&&by<0;y--){let s=0,n=0;for(let x=0;x<W;x++)if(A(x,y)>120){s+=x;n++;}if(n){bx=s/n;by=y;}}if(by<0)return null;
 let xl=W,xr=0;for(let y=Math.floor(H*.55);y<H;y++)for(let x=0;x<W;x++)if(A(x,y)>120){if(x<xl)xl=x;if(x>xr)xr=x;}
 const sum=(xr-xl)*k/64,diff=(bx*k-(xl+xr)/2*k)/32,a=Math.max(.2,(sum+diff)/2),b=Math.max(.2,(sum-diff)/2),cx=(xl+xr)/2*k,cy=by*k-(a+b)*16;
 const sx=cx-it.ax,sy=cy-it.ay;return {a,b,dx:(sx/32+sy/16)/2,dy:(sy/16-sx/32)/2};}
const BOXY=/^(Houses|House backs|Shops & services|Landmarks & venues|Vehicles)$/,NOFIT=/drivein_screen|drive-in-screen|fountain|gazebo|silo|windmill|watertower|water-tower|marquee|bleachers|gate|junglegym|swings|merrygoround/;
/** Fences/walls drawn as one run: the ground line runs from the lowest opaque pixel of the left end to that of the right end.
 *  Returns axis, half-length and the line centre's ground offset from the anchor. */
export async function fitLine(it){const {data,info}=await sharp(path.join(LIB,it.file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});const W=info.width,H=info.height,k=it.w/W,A=(x,y)=>data[(y*W+x)*4+3];
 const low=x=>{for(let y=H-1;y>=0;y--)if(A(x,y)>120)return y;return -1;};let xl=0,xr=W-1;while(xl<W&&low(xl)<0)xl++;while(xr>0&&low(xr)<0)xr--;
 const band=Math.max(2,Math.round((xr-xl)*.04));let yl=0,yr=0;for(let i=0;i<band;i++){yl=Math.max(yl,low(xl+i));yr=Math.max(yr,low(xr-i));}
 const p0=[xl*k,yl*k],p1=[xr*k,yr*k],axis=p1[1]>p0[1]?'x':'y',len=(p1[0]-p0[0])/32/2,mx=(p0[0]+p1[0])/2,my=(p0[1]+p1[1])/2,sx=mx-it.ax,sy=my-it.ay;
 return {axis,half:len/2,dx:(sx/32+sy/16)/2,dy:(sy/16-sx/32)/2};}
export async function shapeFor(it){
 const id=it.id,name=(it.name||'')+' '+id,fw=it.fw||1,fh=it.fh||1;
 if(it.fence)return {shape:'rect',hx:it.fence.axis==='x'?it.fence.lengthM*.49:.1,hy:it.fence.axis==='y'?it.fence.lengthM*.49:.1,core:.72,feather:.06};
 if(id.startsWith('expansion:')&&it.physicalMetres){
  if(it.physicalMetres.base)return {...it.physicalMetres.base,core:.7,feather:.12};
  if(id==='expansion:treehouse')return {shape:'ellipse',hx:.65,hy:.65,core:.7,feather:.16};
  return {shape:'rect',hx:Math.max(.06,fw*.94),hy:Math.max(.06,fh*.94),core:.68,feather:Math.min(.35,Math.max(.08,Math.min(fw,fh)*.2))};
 }
 if(/^gen:(fence|wall)-/.test(it.id)){const L=await fitLine(it);const t=/wall-stone/.test(it.id)?.45:/wall/.test(it.id)?.3:.14;
  return {shape:'rect',hx:L.axis==='x'?L.half*.98:t,hy:L.axis==='y'?L.half*.98:t,core:.7,feather:.1,ox:L.dx,oy:L.dy,fit:{a:L.axis==='x'?L.half:t/.97,b:L.axis==='y'?L.half:t/.97,dx:L.dx,dy:L.dy}};}
 // round structures: a circle of radius r metres is about 90.5*r px wide on screen
 if(/fountain|gazebo|merrygoround/.test(id)){const m=await baseWidth(it,.3);if(m){const r=clamp(m.w/90.5*.95,.5,4);return {shape:'ellipse',hx:r,hy:r,core:.6,feather:.3};}}
 if(BOXY.test(it.category)&&!NOFIT.test(id)&&!ROUND.test(name)&&!POLE.test(id)&&!it.fence){const fb=await fitBox(it);
  if(fb&&fb.a*fb.b>=.45*fw*fh&&fb.a*fb.b<=2.2*fw*fh){const veh=/car|van|pickup|schoolbus|compact/.test(id);return veh?{shape:'rect',hx:fb.a*1.08,hy:fb.b*1.12,core:.95,feather:.3,ox:fb.dx,oy:fb.dy,fit:fb}:{shape:'rect',hx:fb.a*.97,hy:fb.b*.97,core:.55,feather:.32,ox:fb.dx,oy:fb.dy,fit:fb};}}
 if(/fence_.*_x|fence.*\bx\b/i.test(id))return {shape:'rect',hx:fw*.95,hy:.16,core:.62,feather:.14};
 if(/fence_.*_y/i.test(id))return {shape:'rect',hx:.16,hy:fh*.95,core:.62,feather:.14};
 // vehicles: a dark pool that reaches past the body (bumpers, wheels) rather than the tight footprint
 if(/car|van|pickup|schoolbus|compact/.test(id)&&!/candy|scarecrow/.test(id)){const sb=/schoolbus/.test(id);return {shape:'rect',hx:fw*(sb?1.06:1.12),hy:fh*(sb?1.25:1.35),core:.95,feather:.34,ox:0,oy:0};}
 if(FOOTPRINT.test(it.category)&&!POLE.test(id)&&!ROUND.test(name)&&(fw>=1.5||fh>=1.5||/car|van|pickup|bus|compact/.test(id)))
  return {shape:'rect',hx:fw*.94,hy:fh*.94,core:/car|van|pickup|bus|compact/.test(id)?.62:.5,feather:/car|van|pickup|bus|compact/.test(id)?.22:.35};
 if(POLE.test(name)&&!/stop_sign|bus_stop/.test(id)){const m=await baseWidth(it,.1);if(!m)return null;const r=clamp(m.w/(PX*2)*.75,.12,.6);return {shape:'ellipse',hx:r,hy:r,core:.7,feather:.1};}
 if(ROUND.test(name)){const m=await baseWidth(it,/tree/i.test(name)?.08:.3);if(!m)return null;
  const canopy=it.w/(PX*2),trunk=m.w/(PX*2),r=/tree/i.test(name)?clamp(Math.max(trunk*1.6,canopy*.32),.45,1.6):clamp(m.w/(PX*2)*.95,.25,Math.max(fw,fh));
  return {shape:'ellipse',hx:r,hy:r,core:.58,feather:clamp(r*.35,.12,.5)};}
 if(POLE.test(name)){const m=await baseWidth(it,.1);if(!m)return null;const r=clamp(m.w/(PX*2)*.75,.12,.6);return {shape:'ellipse',hx:r,hy:r,core:.7,feather:.1};}
 // other props: measure the base, keep the library's aspect
 const m=await baseWidth(it,.45);if(!m)return null;const sum=clamp(Math.max(m.w/(PX*2),(fw+fh)*.45),.3,fw+fh),hx=sum*fw/(fw+fh),hy=sum*fh/(fw+fh);
 return {shape:'rect',hx:hx*.9,hy:hy*.9,core:.6,feather:clamp(sum*.12,.1,.3)};}
/** Render a shape into the 2:1 projection: returns {buf,w,h,ax,ay} at game scale. */
async function render(sh){const f=sh.feather,ox=sh.ox||0,oy=sh.oy||0,ex=sh.hx+f*1.6+Math.abs(ox),ey=sh.hy+f*1.6+Math.abs(oy),w=Math.ceil((ex+ey)*2*PX)+4,h=Math.ceil((ex+ey)*PX)+4 /* full diamond: x=(X-Y)*32, y=(X+Y)*16 */,ax=w/2,ay=h/2,buf=Buffer.alloc(w*h*4),SS=3;
 for(let py=0;py<h;py++)for(let px=0;px<w;px++){let a=0;for(let i=0;i<SS;i++)for(let j=0;j<SS;j++){const sx=px+(i+.5)/SS-ax,sy=py+(j+.5)/SS-ay,A=sx/PX,B=sy/(PX/2),X=(A+B)/2-ox,Y=(B-A)/2-oy;let d;
   if(sh.shape==='ellipse'){const q=Math.hypot(X/sh.hx,Y/sh.hy);d=(q-1)*Math.min(sh.hx,sh.hy);}
   else{const r=Math.min(.18,sh.hx*.5,sh.hy*.5),qx=Math.abs(X)-sh.hx+r,qy=Math.abs(Y)-sh.hy+r;d=Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)-r;}
   // darkest at the base, feathered both inside and outside the edge
   a+=sh.core*(1-smooth(-f,f*1.2,d))*(.82+.18*smooth(0,-Math.min(sh.hx,sh.hy),d));}
  const o=(py*w+px)*4;buf[o]=6;buf[o+1]=8;buf[o+2]=13;buf[o+3]=Math.round(clamp(a/(SS*SS),0,1)*255);}
 return {buf,w,h,ax,ay};}
export async function ensureShadows({force=false,log=console.log}={}){
 const file=path.join(LIB,'library.json');if(!existsSync(file))return 0;const lib=JSON.parse(await fs.readFile(file,'utf8'));await fs.mkdir(path.join(LIB,'shadows'),{recursive:true});let made=0;
 for(const it of lib.items){if(it.flat){delete it.shadow;continue;}if(!force&&it.shadow?.v===VERSION&&existsSync(path.join(LIB,it.shadow.file)))continue;
  let sh;try{sh=await shapeFor(it);}catch(e){log('shadow skipped '+it.id+': '+e.message);continue;}if(!sh)continue;
  const r=await render(sh),safe=it.id.replace(/[^a-z0-9_-]+/gi,'_'),rel='shadows/'+safe+'.webp';
  await sharp(r.buf,{raw:{width:r.w,height:r.h,channels:4}}).webp({quality:90,alphaQuality:100}).toFile(path.join(LIB,rel));
  // If the art's drawn bottom does not meet the footprint's front corner, move shadow + collision to where it is drawn.
  // Buildings, vehicles and arcade pieces keep their game footprint; only props/plants/poles are re-seated.
  const reseat=!(FOOTPRINT.test(it.category)&&!POLE.test(it.id+' '+(it.name||'')))&&!it.id.startsWith('arcade:')&&!it.physicalMetres;
  const yb=reseat&&!sh.fit?await contactY(it):null;let off=0;if(yb!=null){const expect=it.ay+(sh.shape==='ellipse'?sh.hx:(sh.hx+sh.hy))*PX/2;off=yb-expect;if(Math.abs(off)<3)off=0;off=clamp(off,-160,60);}
  it.shadow={v:VERSION,file:rel,w:r.w,h:r.h,ax:r.ax,ay:r.ay,dy:+off.toFixed(1)};if(!sh.fit&&sh.shape==='ellipse'&&/tree/i.test(it.id+' '+(it.name||''))){sh={...sh,hx:Math.min(.6,Math.max(.3,sh.hx*.4)),hy:Math.min(.6,Math.max(.3,sh.hy*.4))};}
  else if(!sh.fit&&sh.shape==='ellipse'&&/bush|hedge|fern|hydrangea|ornamental/i.test(it.id))sh={...sh,hx:sh.hx*.8,hy:sh.hy*.8};
  it.base=sh.fit?{shape:'rect',hx:+(sh.fit.a*.97).toFixed(2),hy:+(sh.fit.b*.97).toFixed(2),dx:+sh.fit.dx.toFixed(2),dy:+sh.fit.dy.toFixed(2)}:{shape:sh.shape,hx:+sh.hx.toFixed(2),hy:+sh.hy.toFixed(2),dx:+(off/PX).toFixed(2),dy:+(off/PX).toFixed(2)};made++;}
 if(made){const tmp=file+'.shadow-pending';await fs.writeFile(tmp,JSON.stringify(lib,null,1));await fs.rename(tmp,file);}
 log(`shadows: ${made} generated`);return made;}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await ensureShadows({force:process.argv.includes('--force')});
