/** Maple Falls ground scene: roads (v4 kit), lots/driveways/plazas/fields, lamp light, grass variety, leaves and lamps.
 *  Everything is deterministic per pixel or per seeded region, so the town can be baked in independent tiles.
 *  Materials are the owner-approved painted pixels; lamp light reproduces the painting's measured response. */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {K,RUNS,kindOf,evalRun,centre,maskAt,hash,bulbPoint} from './road-v4-kit.mjs';
import {load} from './road-v4-warp.mjs';
import {boundedRoads,gridRange,drivewayBlend,junctionMarks} from './town-builder-rules.mjs';
import {groundFrame,groundBounds} from '../town-builder/app/ground-boundary.js';

export {ROOT,TOWN_ART,artSource,artDir} from './town-paths.mjs';
import {ROOT} from './town-paths.mjs';
const SRC=path.join(ROOT,'output/road-autotile-v4/sources'),TM=path.join(ROOT,'output/terrain-materials');
const clamp=(v,a,b)=>v<a?a:v>b?b:v,smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
const SQ3=Math.sqrt(3);

// ---------------------------------------------------------------- samplers / noise
function bil(img,x,y,o){const W=img.width,H=img.height;x=clamp(x-.5,0,W-1.001);y=clamp(y-.5,0,H-1.001);const ix=x|0,iy=y|0,fx=x-ix,fy=y-iy,d=img.data,i=(iy*W+ix)*4,j=i+W*4;
 for(let k=0;k<4;k++)o[k]=(d[i+k]*(1-fx)+d[i+4+k]*fx)*(1-fy)+(d[j+k]*(1-fx)+d[j+4+k]*fx)*fy;return o;}
function bilWrap(img,x,y,o){const W=img.width,H=img.height;x=((x-.5)%W+W)%W;y=((y-.5)%H+H)%H;const ix=x|0,iy=y|0,fx=x-ix,fy=y-iy,ix1=(ix+1)%W,iy1=(iy+1)%H,d=img.data;
 const a=(iy*W+ix)*4,b=(iy*W+ix1)*4,c=(iy1*W+ix)*4,e=(iy1*W+ix1)*4;for(let k=0;k<4;k++)o[k]=(d[a+k]*(1-fx)+d[b+k]*fx)*(1-fy)+(d[c+k]*(1-fx)+d[e+k]*fx)*fy;return o;}
function vnoise(x,y,seed){const xi=Math.floor(x),yi=Math.floor(y),fx=x-xi,fy=y-yi,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
 const a=hash(xi,yi,seed),b=hash(xi+1,yi,seed),c=hash(xi,yi+1,seed),d=hash(xi+1,yi+1,seed);return (a*(1-u)+b*u)*(1-v)+(c*(1-u)+d*u)*v;}
function fbm(x,y,seed,oct=4){let s=0,a=.5,f=1,n=0;for(let i=0;i<oct;i++){s+=a*vnoise(x*f,y*f,seed+i*17);n+=a;a*=.5;f*=2.03;}return s/n;}
const HV=new Float64Array(9);
function tri(i,j){const fi=Math.floor(i),fj=Math.floor(j),fx=i-fi,fy=j-fj;
 if(fx+fy<1){HV[0]=fi;HV[1]=fj;HV[2]=1-fx-fy;HV[3]=fi+1;HV[4]=fj;HV[5]=fx;HV[6]=fi;HV[7]=fj+1;HV[8]=fy;}
 else{HV[0]=fi+1;HV[1]=fj+1;HV[2]=fx+fy-1;HV[3]=fi+1;HV[4]=fj;HV[5]=1-fy;HV[6]=fi;HV[7]=fj+1;HV[8]=1-fx;}
 const a=HV[2]**3,b=HV[5]**3,c=HV[8]**3,s=a+b+c;HV[2]=a/s;HV[5]=b/s;HV[8]=c/s;}
function makeRng(seed){let s=(Math.floor(hash(seed,77,191)*4294967296)>>>0)||1;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
const gaussOf=r=>()=>{let u=0;while(!u)u=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*r());};

// ---------------------------------------------------------------- sources
async function raw(file,resize){let s=sharp(file);if(resize)s=s.resize(resize);const {data,info}=await s.ensureAlpha().raw().toBuffer({resolveWithObject:true});return {data,width:info.width,height:info.height};}
function flatten(img,r){const W=img.width,H=img.height,ch=[0,1,2].map(k=>{const a=new Float32Array(W*H);for(let i=0;i<W*H;i++)a[i]=img.data[i*4+k];return a;});
 const blur=a=>{const t=new Float32Array(a.length);for(let it=0;it<3;it++){for(let y=0;y<H;y++){let s=0;for(let x=-r;x<=r;x++)s+=a[y*W+clamp(x,0,W-1)];for(let x=0;x<W;x++){t[y*W+x]=s/(2*r+1);s+=a[y*W+Math.min(W-1,x+r+1)]-a[y*W+Math.max(0,x-r)];}}
  for(let x=0;x<W;x++){let s=0;for(let y=-r;y<=r;y++)s+=t[clamp(y,0,H-1)*W+x];for(let y=0;y<H;y++){a[y*W+x]=s/(2*r+1);s+=t[Math.min(H-1,y+r+1)*W+x]-t[Math.max(0,y-r)*W+x];}}}return a;};
 const mean=ch.map(a=>a.reduce((s,v)=>s+v,0)/a.length);
 for(let k=0;k<3;k++){const lo=blur(ch[k].slice());for(let i=0;i<W*H;i++)img.data[i*4+k]=clamp(Math.round(ch[k][i]-lo[i]+mean[k]),0,255);}img.mean=mean;return img;}
export async function loadSources(zoom=1){
 const man=JSON.parse(await fs.readFile(path.join(SRC,'manifest.json'),'utf8')),S={man,PPM:man.pxPerM,zoom};
 S.asph=[];for(const a of man.asphalt)S.asph.push(flatten(await load(path.join(SRC,a.file)),22));
 const A=S.asph;S.asphMean=[0,1,2].map(k=>(A[0].mean[k]*A[0].width+A[1].mean[k]*A[1].width)/(A[0].width+A[1].width));
 for(const a of A)for(let i=0;i<a.width*a.height;i++)for(let k=0;k<3;k++)a.data[i*4+k]=clamp(Math.round(a.data[i*4+k]-a.mean[k]+S.asphMean[k]),0,255);
 S.LUMA0=.3*S.asphMean[0]+.59*S.asphMean[1]+.11*S.asphMean[2];
 // Car-park asphalt: one large generated texture (output/paving-kit/lot-texture/lot-asphalt-3.png, ~28 m across) with cracks,
 // tar-sealed seams, patches and faded areas. Its large-scale tone is kept (that IS the variation); only its mean is matched
 // to sit a touch lighter and greyer than the road, so lot reflections behave exactly like road ones.
 {const t=await raw(path.join(ROOT,'output/paving-kit/lot-texture/lot-asphalt-3.png'));const m=[0,0,0];for(let i=0;i<t.width*t.height;i++)for(let k=0;k<3;k++)m[k]+=t.data[i*4+k];
  for(let k=0;k<3;k++)m[k]/=t.width*t.height;const target=[S.asphMean[0]*1.06+2,S.asphMean[1]*1.06+2,S.asphMean[2]*1.02];
  for(let i=0;i<t.width*t.height;i++)for(let k=0;k<3;k++)t.data[i*4+k]=clamp(Math.round(t.data[i*4+k]-m[k]+target[k]),0,255);t.ppm=t.width/28;S.lotTex=t;S.lotMean=target;}
 S.slabs=[];for(const s of man.slabs)S.slabs.push(await load(path.join(SRC,s.file)));
 {const means=S.slabs.map(t=>{const m=[0,0,0];let n=0;for(let y=4;y<t.height-6;y++)for(let x=4;x<t.width-4;x++){const o=(y*t.width+x)*4;for(let k=0;k<3;k++)m[k]+=t.data[o+k];n++;}return m.map(v=>v/n);});
  const target=[0,1,2].map(k=>means.reduce((s,m)=>s+m[k],0)/means.length);
  S.slabs.forEach((t,i)=>{for(let j=0;j<t.width*t.height;j++)for(let k=0;k<3;k++)t.data[j*4+k]=clamp(Math.round(t.data[j*4+k]*target[k]/means[i][k]),0,255);});}
 S.curbV=await load(path.join(SRC,man.curb.visible.file));S.curbH=await load(path.join(SRC,man.curb.hidden.file));
 S.stamp=await load(path.join(SRC,man.pool.intensity));S.STAMP_U=man.pool.lampU;S.STAMP_V=man.pool.curbRow;
 const L=man.light;S.IB=L.IB;S.DMU=L.DMU;S.DSG=L.DSG;for(let b=1;b<S.IB.length;b++)S.DSG[0][b]=Math.max(S.DSG[0][b],Math.min(30,S.DSG[0][b-1]));
 // stamp: brightest point and principal streak direction, both in screen pixels at zoom 1
 {let best=0,bu=0,bv=0,sx=0,sy=0,sw=0;const st=S.stamp;for(let v=0;v<st.height;v++)for(let u=0;u<st.width;u++){const a=st.data[(v*st.width+u)*4+3]/255;if(a<=0)continue;
   if(a>best){best=a;bu=u;bv=v;}const du=(u-S.STAMP_U)/S.PPM,dv=(v-S.STAMP_V)/S.PPM;if(dv<=0)continue;const w=a*a;sx+=w*32*(du-dv);sy+=w*16*(du+dv);sw+=w;}
  S.stampHot={du:(bu-S.STAMP_U)/S.PPM,dv:(bv-S.STAMP_V)/S.PPM};S.stampAngle=Math.atan2(sy/sw,sx/sw);}
 // grass and ground materials (screen-space tileable paintings at the approved 256 px repeat)
 const GR=Math.max(32,Math.round(256*zoom));S.GR=GR;
 S.grassA=await raw(path.join(TM,'grass-base.png'),{width:GR,height:GR,kernel:'lanczos3'});
 S.grassB=await raw(path.join(TM,'grass-v2-base.png'),{width:GR,height:GR,kernel:'lanczos3'});
 S.soil=await raw(path.join(TM,'soil-mud-v2-base.png'),{width:GR,height:GR,kernel:'lanczos3'});
 S.decals=[];
 for(const [file,kind,base] of [['decal-01-lush-grass','grass',230],['decal-02-dry-golden-grass','grass',230],['decal-03-moss-groundcover','grass',250],['decal-04-low-weeds','grass',190],['decal-05-thin-grass','grass',210],['decal-06-orange-leaf-scatter','leaves',170],['decal-07-red-leaf-cluster','leaves',150],['decal-08-yellow-leaf-scatter','leaves',150],['scatter-grass-tufts','tufts',260]]){
  const m=await sharp(path.join(TM,file+'.png')).metadata();const w=Math.max(16,Math.round(base*zoom));S.decals.push({kind,img:await raw(path.join(TM,file+'.png'),{width:w,height:Math.round(w*m.height/m.width),kernel:'lanczos3'}),file});}
 // leaves (orange/red sprites cut from the existing scatters)
 const leafMeta=JSON.parse(await fs.readFile(path.join(SRC,'leaves.json'),'utf8'));S.leafImgs=[];S.roundLeaves=[];
 for(const l of leafMeta){const img=await load(path.join(SRC,'leaves',l.file));let green=0,n=0,r=0,g=0;for(let i=0;i<img.width*img.height;i++){if(img.data[i*4+3]<150)continue;n++;r+=img.data[i*4];g+=img.data[i*4+1];if(img.data[i*4+1]>img.data[i*4]*.95)green++;}
  if(!n||green/n>=.12||Math.max(img.width,img.height)<14||(r-g)/n<58)continue;img.dim=Math.max(img.width,img.height);(l.source==='tiny'?S.roundLeaves:S.leafImgs).push(img);}
 S.leafImgs.sort((a,b)=>a.dim-b.dim);S.roundLeaves.sort((a,b)=>a.dim-b.dim);
 // the game's painted street lamp (atlas: 80 x 240 at 1x, anchor 40,204)
 const lampW=Math.round(80*zoom),lampH=Math.round(240*zoom);
 S.lamp=await raw(path.join(ROOT,'art/world/staged/streetlamp-57c1616a5a639908.png'),{width:lampW,height:lampH,kernel:'lanczos3'});S.lampAnchor=[40*zoom,204*zoom];
 return S;}

// ---------------------------------------------------------------- scene
const CURB_HOT={top:[254,240,190],face:[215,115,45],joint:[205,140,80],gutter:[165,90,22]},CURB_MU={top:[222,190,168],face:[78,68,78],joint:[120,99,85],gutter:[40,38,48]};
const STAIN=[.84,.78,.72]; // measured on the owner's S-bend painting
const MID=.4+(K.walk-.4)/2;  // lamp posts stand mid-sidewalk, between the grass and the road

/** Rounded rectangle helpers (lots). */
/** Painted lots: a union of circle / isometric-square stamps (minus erase stamps), blended with a smooth minimum
 *  so overlapping dabs give one soft-cornered outline. Square = axis-aligned in ground metres = a diamond on screen. */
function sdStamp(t,X,Y){const dx=X-t.x,dy=Y-t.y;if(t.s==='q'){const rr=Math.min(.35,t.r*.25),qx=Math.abs(dx)-t.r+rr,qy=Math.abs(dy)-t.r+rr;return Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)-rr;}return Math.hypot(dx,dy)-t.r;}
function sdPaint(l,X,Y){const g=l.grid,gx=Math.floor((X-g.x0)/g.c),gy=Math.floor((Y-g.y0)/g.c);if(gx<0||gy<0||gx>=g.w||gy>=g.h)return 99;const list=g.cells[gy*g.w+gx];if(!list)return 99;
 let d=99,k=.9;for(const t of list){if(t.neg)continue;const e=sdStamp(t,X,Y);const h=Math.max(k-Math.abs(d-e),0)/k;d=Math.min(d,e)-h*h*k/4;}
 for(const t of list){if(!t.neg)continue;d=Math.max(d,-sdStamp(t,X,Y));}return d;}
function sdRect(l,X,Y){if(l.grid)return sdPaint(l,X,Y);const px=X-l.cx,py=Y-l.cy,qx=Math.abs(px)-l.hx+l.r,qy=Math.abs(py)-l.hy+l.r;return Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)-l.r;}
function rectFrame(l,X,Y,out){if(l.grid)return paintFrame(l,X,Y,out);return rectFrameBox(l,X,Y,out);}
/** Border frame for painted lots: normal from the distance-field gradient; slab coordinate runs along the local tangent. */
function paintFrame(l,X,Y,out){const e=.05,gx=sdPaint(l,X+e,Y)-sdPaint(l,X-e,Y),gy=sdPaint(l,X,Y+e)-sdPaint(l,X,Y-e),gl=Math.hypot(gx,gy)||1,nx=gx/gl,ny=gy/gl;
 out.nx=-nx;out.ny=-ny;out.tx=ny;out.ty=-nx;const along=X*out.tx+Y*out.ty;out.along=along;out.slabLen=2.5;out.slab=along/2.5;out.total=1e9;out.side='C';return out;}
function rectFrameBox(l,X,Y,out){ // outward normal, tangent and perimeter coordinate (for border slabs)
 const px=X-l.cx,py=Y-l.cy,ex=l.hx-l.r,ey=l.hy-l.r,qx=Math.abs(px)-ex,qy=Math.abs(py)-ey,rr=l.r+l.border/2,arc=Math.PI/2*rr;
 let nx,ny,per;const top=2*ex,side=2*ey;
 if(qx>0&&qy>0){const sx=Math.sign(px),sy=Math.sign(py),ang=Math.atan2(qy,qx);nx=sx*Math.cos(ang);ny=sy*Math.sin(ang);
  // corners in clockwise order from top-left start: TR, BR, BL, TL
  if(sx>0&&sy<0)per=top+(Math.PI/2-ang)*rr;else if(sx>0&&sy>0)per=top+arc+side+ang*rr;else if(sx<0&&sy>0)per=2*top+2*arc+side+(Math.PI/2-ang)*rr;else per=2*top+3*arc+2*side+ang*rr;}
 else if(qx>qy){nx=Math.sign(px);ny=0;per=px>0?top+arc+(py+ey):2*top+3*arc+side+(ey-py);}
 else{nx=0;ny=Math.sign(py);per=py<0?(px+ex):top+2*arc+side+(ex-px);}
 const total=2*top+2*side+4*arc;out.nx=-nx;out.ny=-ny;out.tx=ny;out.ty=-nx;out.along=per;const n=Math.max(1,Math.round(total/K.slab));out.slab=per/total*n;out.slabLen=total/n;out.total=total;out.side=nx>.7?'E':nx<-.7?'W':ny>.7?'S':ny<-.7?'N':'C';return out;}

export function buildScene(plan,S,opts={}){
 const zoom=S.zoom,SCALE=32*zoom,NX=plan.nx,NY=plan.ny,MARGIN=Math.round(60*zoom);
 const {W,H,OX,OY}=groundFrame(plan,zoom);
 const sc={plan,S,zoom,SCALE,NX,NY,W,H,OX,OY,groundBounds:plan.groundShape==='isometric'?groundBounds(plan):null};
 sc.toWorld=(sx,sy)=>{const a=(sx-OX)/SCALE,b=(sy-OY)/(SCALE/2);return [(a+b)/2,(b-a)/2];};
 sc.toScreen=(X,Y)=>[OX+(X-Y)*SCALE,OY+(X+Y)*SCALE/2];
 // cells may lie anywhere on the picture (negative or past nx/ny): index them inside the picture's whole cell range
 const G=gridRange(NX,NY,plan.groundShape),GX=G.cx1-G.cx0+1,GY=G.cy1-G.cy0+1,ci=(cx,cy)=>cx<G.cx0||cy<G.cy0||cx>G.cx1||cy>G.cy1?-1:(cy-G.cy0)*GX+(cx-G.cx0);Object.assign(sc,{G,GX,GY,ci});
 const cells=boundedRoads(plan.roads,NX,NY,plan.groundShape);sc.masks=new Int8Array(GX*GY);
 sc.warnings=[];
 for(let cy=G.cy0;cy<=G.cy1;cy++)for(let cx=G.cx0;cx<=G.cx1;cx++){if(!cells.has(`${cx},${cy}`))continue;const m=maskAt(cells,cx,cy),k=kindOf(m);
  if(!['straight','bend','tee','cross','end'].includes(k)){sc.warnings.push(`cell ${cx},${cy}: lone road cell skipped`);continue;}sc.masks[ci(cx,cy)]=m;}
 const dbl=new Set(plan.lines?.double||[]),none=new Set(plan.lines?.none||[]);
 sc.lineStyle=(cx,cy)=>{const k=`${cx},${cy}`;return none.has(k)?null:dbl.has(k)?'double':'dash';};
 // lots: rounded rectangles in world metres
 sc.lots=(plan.lots||[]).map((l,i)=>{if(l.stamps?.length){const pos=l.stamps.filter(t=>!t.neg);if(!pos.length)return null;
   const x0=Math.min(...pos.map(t=>t.x-t.r)),x1=Math.max(...pos.map(t=>t.x+t.r)),y0=Math.min(...pos.map(t=>t.y-t.r)),y1=Math.max(...pos.map(t=>t.y+t.r));
   const border=l.border==='none'?0:l.border==='curb'?.42:(l.borderWidth??1.6),c=2,pad=border+1.2,gw=Math.ceil((x1-x0+2*pad)/c),gh=Math.ceil((y1-y0+2*pad)/c),cells=new Array(gw*gh);
   for(const t of l.stamps){const m=t.r+pad;for(let gy=Math.max(0,Math.floor((t.y-m-(y0-pad))/c));gy<=Math.min(gh-1,Math.floor((t.y+m-(y0-pad))/c));gy++)for(let gx=Math.max(0,Math.floor((t.x-m-(x0-pad))/c));gx<=Math.min(gw-1,Math.floor((t.x+m-(x0-pad))/c));gx++)(cells[gy*gw+gx]??=[]).push(t);}
   return {...l,i,cx:(x0+x1)/2,cy:(y0+y1)/2,hx:(x1-x0)/2,hy:(y1-y0)/2,r:.5,border,noBorder:new Set(),surface:l.surface||'asphalt',auto:false,openings:[],grid:{x0:x0-pad,y0:y0-pad,c,w:gw,h:gh,cells}};}
  const x0=Math.min(l.x0,l.x1),x1=Math.max(l.x0,l.x1),y0=Math.min(l.y0,l.y1),y1=Math.max(l.y0,l.y1);
  return {...l,i,cx:(x0+x1)/2,cy:(y0+y1)/2,hx:(x1-x0)/2,hy:(y1-y0)/2,r:l.radius??(l.surface==='dirt'?3:1.2),border:l.border==='none'?0:l.border==='curb'?.42:(l.borderWidth??1.6),noBorder:new Set(l.noBorder||[]),surface:l.surface||'asphalt'};}).filter(Boolean);sc.lots.forEach((l,i)=>l.i=i);
 // driveways: from a lot opening straight across the road sidewalk to the road asphalt
 sc.drives=[];
 const roadClass=(X,Y)=>{const cx=Math.floor(X/20),cy=Math.floor(Y/20),i=ci(cx,cy);if(i<0)return 99;const m=sc.masks[i];if(!m)return 99;let bs=-1e9;const o={};for(const r of RUNS[m]){evalRun(r,X-cx*20,Y-cy*20,X,Y,o);if(o.s>bs)bs=o.s;}return bs;};
 // lots drawn in the app (auto): a side that lies on a road sidewalk loses its own border and gets a 6 m driveway
 for(const l of sc.lots){if(!l.auto||l.openings?.length)continue;l.openings=[];
  for(const side of ['N','S','E','W']){const along=side==='N'||side==='S',a0=along?l.cx-l.hx:l.cy-l.hy,a1=along?l.cx+l.hx:l.cy+l.hy,mid=(a0+a1)/2;
   const ex=side==='E'?l.cx+l.hx:side==='W'?l.cx-l.hx:mid,ey=side==='S'?l.cy+l.hy:side==='N'?l.cy-l.hy:mid,d={N:[0,-1],S:[0,1],E:[1,0],W:[-1,0]}[side];
   let hitRoad=false;for(let t=.2;t<3.5;t+=.2){const c=roadClass(ex+d[0]*t,ey+d[1]*t);if(c<K.walk){hitRoad=true;break;}}
   if(hitRoad&&a1-a0>=7)l.openings.push({side,a0:mid-3,a1:mid+3});}}
 for(const l of sc.lots)for(const op of l.openings||[]){
  const dir={N:[0,-1],S:[0,1],E:[1,0],W:[-1,0]}[op.side],along=op.side==='N'||op.side==='S';
  const mid=(op.a0+op.a1)/2,sx=along?mid:(op.side==='E'?l.cx+l.hx:l.cx-l.hx),sy=along?(op.side==='S'?l.cy+l.hy:l.cy-l.hy):mid;
  let t=0;while(t<12&&roadClass(sx+dir[0]*t,sy+dir[1]*t)>-.3)t+=.05;if(t>=12)continue;
  const a=Math.min(op.a0,op.a1),b=Math.max(op.a0,op.a1),e0=-.3,e1=t+.35;
  sc.drives.push(along?{x0:a,x1:b,y0:op.side==='S'?sy+e0:sy-e1,y1:op.side==='S'?sy+e1:sy-e0,lot:l.i,side:op.side}:{y0:a,y1:b,x0:op.side==='E'?sx+e0:sx-e1,x1:op.side==='E'?sx+e1:sx-e0,lot:l.i,side:op.side});}
 // lamps: snap to the nearest curb, point every reflection straight south (down the screen), stand the post
 // behind the brightest part of the reflection, mid-sidewalk.
 sc.viewer=[W/2,H];const o={};sc.lamps=[];
 for(const lp of plan.reflections??plan.lamps??[]){
  let H0,n;
  if(lp.free){H0=[lp.x,lp.y];n=null;}
  else{const cx=Math.floor(lp.x/20),cy=Math.floor(lp.y/20),m=sc.masks[ci(cx,cy)];if(!m)continue;let best=null;
   for(const r of RUNS[m]){evalRun(r,lp.x-cx*20,lp.y-cy*20,lp.x,lp.y,o);if(!best||Math.abs(o.s)<Math.abs(best.s))best={...o};}
   n=[best.nx,best.ny];H0=[lp.x+best.nx*best.s,lp.y+best.ny*best.s];}
  const target=(Number.isFinite(lp.angle)?lp.angle:90)*Math.PI/180,rotA=target-S.stampAngle; // straight down the screen (south) unless the glow is turned (angle, screen degrees)
  // ground direction of the streak
  const dx=Math.cos(target),dy=Math.sin(target),gu=(dx/32+dy/16)/2,gv=(dy/16-dx/32)/2,gl=Math.hypot(gu,gv),g=[gu/gl,gv/gl];
  // brightest point of the (rotated) stamp, in world metres
  const hs=S.stampHot,hsx=32*(hs.du-hs.dv),hsy=16*(hs.du+hs.dv),c=Math.cos(rotA),s=Math.sin(rotA),rx=hsx*c-hsy*s,ry=hsx*s+hsy*c;
  const B=[H0[0]+(rx/32+ry/16)/2,H0[1]+(ry/16-rx/32)/2];
  let post;
  if(n){const gn=g[0]*n[0]+g[1]*n[1],depth=(B[0]-H0[0])*n[0]+(B[1]-H0[1])*n[1]+MID;post=gn>.3?[B[0]-g[0]*depth/gn,B[1]-g[1]*depth/gn]:[H0[0]-n[0]*MID,H0[1]-n[1]*MID];}
  else post=[B[0]-g[0]*1.2,B[1]-g[1]*1.2];
  sc.lamps.push({x:H0[0],y:H0[1],px:post[0],py:post[1],rot:rotA,cos:Math.cos(-rotA),sin:Math.sin(-rotA),strength:lp.strength??1,scale:lp.scale??1,free:!!lp.free,tint:hexRgb(lp.tint),turned:Number.isFinite(lp.angle)&&lp.angle!==90});}
 sc.paving=(plan.paving||[]).map((l,i)=>{const x0=Math.min(l.x0,l.x1),x1=Math.max(l.x0,l.x1),y0=Math.min(l.y0,l.y1),y1=Math.max(l.y0,l.y1);return {...l,i,cx:(x0+x1)/2,cy:(y0+y1)/2,hx:(x1-x0)/2,hy:(y1-y0)/2,r:l.border==='none'?.02:.2,border:l.border==='none'?0:.25}; /* border:'none' = slabs straight onto the grass, no curb rim */});
 // spatial index: things that can affect each 20 m cell
 sc.cellLots=[...Array(GX*GY)].map(()=>[]);sc.cellDrives=[...Array(GX*GY)].map(()=>[]);sc.cellLamps=[...Array(GX*GY)].map(()=>[]);
 sc.cellPaving=[...Array(GX*GY)].map(()=>[]);
 const addBox=(arr,item,x0,y0,x1,y1)=>{for(let cy=Math.max(G.cy0,Math.floor(y0/20));cy<=Math.min(G.cy1,Math.floor(y1/20));cy++)for(let cx=Math.max(G.cx0,Math.floor(x0/20));cx<=Math.min(G.cx1,Math.floor(x1/20));cx++)arr[ci(cx,cy)].push(item);};
 for(const l of sc.lots)addBox(sc.cellLots,l,l.cx-l.hx-l.border-1,l.cy-l.hy-l.border-1,l.cx+l.hx+l.border+1,l.cy+l.hy+l.border+1);
 for(const d of sc.drives)addBox(sc.cellDrives,d,d.x0,d.y0,d.x1,d.y1);
 for(const l of sc.lamps){const r=18*l.scale;addBox(sc.cellLamps,l,Math.min(l.x,l.px)-r,Math.min(l.y,l.py)-r,Math.max(l.x,l.px)+r,Math.max(l.y,l.py)+r);}
 for(const p of sc.paving)addBox(sc.cellPaving,p,p.cx-p.hx-.3,p.cy-p.hy-.3,p.cx+p.hx+.3,p.cy+p.hy+.3);
 placeLeaves(sc);placeGrassDressing(sc);
 return sc;}

// ---------------------------------------------------------------- shading
const tmp=[0,0,0,0],HR=[0,0,0],run0={},best={},cen={},slabCol=[0,0,0,0],lt={road:0,curb:0,walk:0,lx:0,ly:0,rt:null,ct:null,wt:null},tintBase=[0,0,0];
/** '#rrggbb' to [r,g,b], or null (a glow without a picked colour keeps the painted amber exactly) */
function hexRgb(h){const m=/^#?([0-9a-f]{6})$/i.exec(h||'');if(!m)return null;const v=parseInt(m[1],16);return [v>>16&255,v>>8&255,v&255];}
/** A coloured glow: the light a lamp added to a pixel (c - base) keeps its brightness but takes the glow's colour. */
function retint(c,b,t){const d0=c[0]-b[0],d1=c[1]-b[1],d2=c[2]-b[2],lum=.3*d0+.59*d1+.11*d2;if(!(lum>0))return;const tl=.3*t[0]+.59*t[1]+.11*t[2]||1;for(let k=0;k<3;k++)c[k]=b[k]+lum*t[k]/tl;}
function asphalt(S,X,Y,o){const HEX=1.6,j=Y/(HEX*SQ3/2);tri(X/HEX-j/2,j);HR[0]=HR[1]=HR[2]=0;let w2=0;
 for(let q=0;q<9;q+=3){const vi=HV[q],vj=HV[q+1],w=HV[q+2];if(w<1e-5)continue;w2+=w*w;const vx=vi*HEX+vj*HEX/2,vy=vj*HEX*SQ3/2,img=S.asph[hash(vi,vj,7)<.6?0:1],m=HEX*S.PPM+2;
  bil(img,(X-vx)*S.PPM+m+hash(vi,vj,11)*(img.width-2*m),(Y-vy)*S.PPM+m+hash(vi,vj,13)*(img.height-2*m),tmp);
  HR[0]+=w*(tmp[0]-S.asphMean[0]);HR[1]+=w*(tmp[1]-S.asphMean[1]);HR[2]+=w*(tmp[2]-S.asphMean[2]);}
 const n=1/Math.sqrt(w2);o[0]=S.asphMean[0]+HR[0]*n;o[1]=S.asphMean[1]+HR[1]*n;o[2]=S.asphMean[2]+HR[2]*n;return o;}
/** Car-park surface: the big lot texture laid in large (9 m) hex patches with random offsets, so cracks and patches never repeat in a grid. */
function lotAsphalt(S,X,Y,o){const HEX=9,j=Y/(HEX*SQ3/2),T=S.lotTex;tri(X/HEX-j/2,j);HR[0]=HR[1]=HR[2]=0;let w2=0;
 for(let q=0;q<9;q+=3){const vi=HV[q],vj=HV[q+1],w=HV[q+2];if(w<1e-5)continue;w2+=w*w;bilWrap(T,(X+hash(vi,vj,71)*28)*T.ppm,(Y+hash(vi,vj,73)*28)*T.ppm,tmp);
  HR[0]+=w*(tmp[0]-S.lotMean[0]);HR[1]+=w*(tmp[1]-S.lotMean[1]);HR[2]+=w*(tmp[2]-S.lotMean[2]);}
 const n=1/Math.sqrt(w2);o[0]=S.lotMean[0]+HR[0]*n;o[1]=S.lotMean[1]+HR[1]*n;o[2]=S.lotMean[2]+HR[2]*n;return o;}
function tbl(S,t,I){if(I<=0)return 0;if(I>=1)return t[t.length-1];let i=1;while(S.IB[i]<I)i++;const f=(I-S.IB[i-1])/(S.IB[i]-S.IB[i-1]);return t[i-1]+(t[i]-t[i-1])*f;}
function rolloff(c){const mx=Math.max(c[0],c[1],c[2]);if(mx>248){const over=mx-248,k=248/mx;c[0]=c[0]*k+over*.42;c[1]=c[1]*k+over*.36;c[2]=c[2]*k+over*.3;}for(let i=0;i<3;i++)c[i]=clamp(c[i],0,255);return c;}
function litAsphalt(S,c,I,tint){if(I<.003)return c;if(tint){tintBase[0]=c[0];tintBase[1]=c[1];tintBase[2]=c[2];}const z=clamp((.3*c[0]+.59*c[1]+.11*c[2]-S.LUMA0)/8.8,-3,3);
 for(let k=0;k<3;k++)c[k]=c[k]+tbl(S,S.DMU[k],I)+z*tbl(S,S.DSG[k],I);
 if(c[0]>140){const k=smooth(140,200,c[0]);c[1]=Math.min(c[1],c[1]*(1-k)+c[0]*.9*k);}if(tint)retint(c,tintBase,tint);return rolloff(c);}
function stampAt(sc,l,X,Y){const S=sc.S,[sx,sy]=[((X-Y)*32-(l.x-l.y)*32)/l.scale,((X+Y)*16-(l.x+l.y)*16)/l.scale],rx=sx*l.cos-sy*l.sin,ry=sx*l.sin+sy*l.cos;
 const du=(rx/32+ry/16)/2,dv=(ry/16-rx/32)/2,u=S.STAMP_U+du*S.PPM,v=S.STAMP_V+dv*S.PPM;if(u<0||v<0||u>=S.stamp.width-1||v>=S.stamp.height-1)return 0;bil(S.stamp,u,v,tmp);const edge=Math.min(u,S.stamp.width-1-u,v,S.stamp.height-1-v),fade=l.free||l.turned?smooth(0,46,edge):smooth(0,12,Math.min(u,S.stamp.width-1-u,S.stamp.height-1-v));return tmp[3]/255*l.strength*fade;} // free-standing lamps: no hard edge where the painted shape was cut
function lights(sc,X,Y,cell){let road=0,curb=0,walk=0,lx=0,ly=0,rt=null,ct=null,wt=null;
 for(const l of sc.cellLamps[cell]){const dx=X-l.x,dy=Y-l.y,d2=dx*dx+dy*dy;if(d2>324*l.scale*l.scale)continue;const sa=stampAt(sc,l,X,Y);if(sa>road){road=sa;rt=l.tint;}if(!l.free){const cv=l.strength*Math.exp(-d2/(2.2*l.scale*l.scale));if(cv>curb){curb=cv;ct=l.tint;}}
  const qx=X-l.px,qy=Y-l.py,wv=l.strength*Math.exp(-(qx*qx+qy*qy)/(2*4.2*4.2*l.scale*l.scale));if(wv>walk){walk=wv;lx=l.px;ly=l.py;wt=l.tint;}}
 lt.road=road;lt.curb=curb;lt.walk=walk;lt.lx=lx;lt.ly=ly;lt.rt=rt;lt.ct=ct;lt.wt=wt;return lt;}
function grime(o,X,Y,key,edgeJoint,edgeOuter){const wx=fbm(X*.35,Y*.35,91,2)-.5,wy=fbm(X*.35,Y*.35,93,2)-.5,blot=fbm(X*1.15+wx*1.6,Y*1.15+wy*1.6,95,4),speck=fbm(X*9,Y*9,97,2);
 let st=smooth(.36,.64,blot)*(.35+.65*key)*.95+smooth(.5,.8,speck)*.3;st+=(1-smooth(.03,.12,edgeJoint))*.7*(.6+.4*speck);st+=(1-smooth(.04,.22,edgeOuter))*.6*(.5+.5*blot);
 st=clamp(st,0,1);for(let k=0;k<3;k++)o[k]*=1-(1-STAIN[k])*st;return o;}
function slab(sc,o,X,Y,s,f,bandEnd,fr,slabLen,frame,key,tileKey,lt){
 const S=sc.S,t=clamp((s-f-.21)/(bandEnd-f-.21),0,1),tile=S.slabs[Math.floor(tileKey*S.slabs.length)];
 bil(tile,fr*(tile.width-1)+.5,t*(tile.height-1)+.5,slabCol);const g=.965+.07*key;for(let k=0;k<3;k++)o[k]=slabCol[k]*g;
 const acr=bandEnd-f-.21,dA=fr*slabLen,dB=(1-fr)*slabLen,dC=t*acr,dD=(1-t)*acr,dm=Math.min(dA,dB,dC,dD);
 grime(o,X,Y,key,Math.min(dA,dB,dC),dD);
 if(lt.walk>.003){const wb=lt.wt?[o[0],o[1],o[2]]:null,I=lt.walk;o[0]=o[0]*(1+.32*I)+30*I*I;o[1]=o[1]*(1+.08*I)+12*I*I;o[2]*=1-.34*I;
  if(dm<.14){let ex,ey;if(dm===dA){ex=-frame.tx;ey=-frame.ty;}else if(dm===dB){ex=frame.tx;ey=frame.ty;}else if(dm===dC){ex=frame.nx;ey=frame.ny;}else{ex=-frame.nx;ey=-frame.ny;}
   const qx=lt.lx-X,qy=lt.ly-Y,ql=Math.hypot(qx,qy)||1,face=Math.max(0,(ex*qx+ey*qy)/ql),rim=Math.exp(-(((dm-.065)/.03)**2)),h=I*rim*(.3+.7*face);o[0]+=190*h;o[1]+=105*h;o[2]+=20*h;}if(wb)retint(o,wb,lt.wt);}
 return rolloff(o);}
function curbZone(sc,o,s,f,fr,rh,lt){const S=sc.S,segV=[0,132,265,402],segH=[0,139,276,411],q=Math.floor(rh*3),uV=segV[q]+fr*(segV[q+1]-segV[q]),uH=segH[q]+fr*(segH[q+1]-segH[q]);let zone;
 if(s>=f+.13){zone='joint';bil(S.curbH,uH,(f+.21-s)/.08*3.5+.5,o);}else if(s>=f){zone='top';bil(S.curbH,uH,4+(f+.13-s)/.13*6.5+.5,o);}else{zone='face';bil(S.curbV,uV,10+(f-s)/Math.max(f,.001)*10.5+.5,o);}
 const I=lt.curb;if(I>.003){const hot=CURB_HOT[zone],mu=CURB_MU[zone],e=Math.pow(I,.85),cb=lt.ct?[o[0],o[1],o[2]]:null;for(let k=0;k<3;k++)o[k]=clamp(o[k]+(hot[k]-mu[k])*e,0,255);if(cb){retint(o,cb,lt.ct);for(let k=0;k<3;k++)o[k]=clamp(o[k],0,255);}}return o;}
function gutter(sc,o,s,vis,fr,rh){const S=sc.S,segV=[0,132,265,402],segH=[0,139,276,411],q=Math.floor(rh*3),uV=segV[q]+fr*(segV[q+1]-segV[q]),uH=segH[q]+fr*(segH[q+1]-segH[q]);
 const gv=clamp(vis,0,1);bil(S.curbV,uV,20.5+(-s)*S.PPM+.5,tmp);const a0=tmp[0],a1=tmp[1],a2=tmp[2];bil(S.curbH,uH,11.5+(-s)*S.PPM+.5,tmp);
 const gw=smooth(-.40,-.24,s);o[0]=o[0]*(1-gw)+(a0*gv+tmp[0]*(1-gv))*gw;o[1]=o[1]*(1-gw)+(a1*gv+tmp[1]*(1-gv))*gw;o[2]=o[2]*(1-gw)+(a2*gv+tmp[2]*(1-gv))*gw;return o;}
function paint(o,a,col,I){if(a<=0)return;o[0]=o[0]*(1-a)+Math.min(255,col[0]+12*I)*a;o[1]=o[1]*(1-a)+Math.min(255,col[1]+40*I)*a;o[2]=o[2]*(1-a)+Math.min(255,col[2]+30*I)*a;}
function wear(along,d,seed){const chip=fbm(along*6,d*6,61+seed,3),gap=fbm(along*.55,seed,63,2),film=fbm(along*.9,d*4,65,2);return smooth(.28,.4,chip)*(.45+.55*smooth(.2,.3,gap))*(.88+.12*film);}
function inDrive(sc,cell,X,Y){for(const d of sc.cellDrives[cell])if(X>=d.x0&&X<=d.x1&&Y>=d.y0&&Y<=d.y1)return d;return null;}
const fr0={};
/** Shade one ground sample. Returns alpha of the paved layer (0 = grass/dirt handled later) and colour in o.
 *  info.I = light at this point (for leaves), info.surf = 'dirt'|'field'|... for ground-type surfaces. */
export function shade(sc,X,Y,o,info){
 const S=sc.S;info.I=0;info.surf=null;
 const cx=Math.floor(X/20),cy=Math.floor(Y/20),cell=sc.ci(cx,cy);if(cell<0)return 0;const m=sc.masks[cell];
 let bs=-1e9,bi=-1;
 if(m){const x=X-cx*20,y=Y-cy*20,runs=RUNS[m];for(let i=0;i<runs.length;i++){evalRun(runs[i],x,y,X,Y,run0);if(run0.s>bs){bs=run0.s;bi=i;Object.assign(best,run0);}}}
 const L=lights(sc,X,Y,cell);
 for(const p of sc.cellPaving[cell]){const d=sdRect(p,X,Y);if(d>=p.border)continue;
  if(d>=0){rectFrame(p,X,Y,fr0);curbZone(sc,o,d,0,fr0.slab%1,hash(p.i,Math.floor(fr0.slab)),L);info.I=L.curb;return smooth(p.border,p.border-.03,d);}
  const u=(X-(p.cx-p.hx))/K.slab,v=(Y-(p.cy-p.hy))/K.slab,iu=Math.floor(u),iv=Math.floor(v);fr0.nx=0;fr0.ny=-1;fr0.tx=1;fr0.ty=0;
  slab(sc,o,X,Y,.21+(v-iv)*(K.walk-.21),0,K.walk,u-iu,K.slab,fr0,hash(iu,iv,p.i,9),hash(iu,iv,p.i,3),L);info.I=L.walk*.6;return 1;}
 const drive=sc.cellDrives[cell].length?inDrive(sc,cell,X,Y):null;
 // ---- road surface
 if(m&&bs<K.walk&&!(drive&&bs>-.05)){
  const vis=clamp((best.nx+best.ny)/Math.SQRT2/.7071,0,1.4),f=.18*vis,s=bs,seg=Math.floor(best.slab+1e-6),fr=best.slab-seg,rh=hash(cx,cy,bi,seg);
  if(s>=f+.21){slab(sc,o,X,Y,s,f,K.walk,fr,best.slabLen,best,hash(cx,cy,bi,seg,9),hash(cx,cy,bi,seg,3),L);info.I=L.walk*.6;return smooth(K.walk,K.walk-.03,s);}
  if(s>=0){curbZone(sc,o,s,f,fr,rh,L);info.I=L.curb;return 1;}
  asphalt(S,X,Y,o);if(s>-.4)gutter(sc,o,s,vis,fr,rh);
  const c=centre(m,X-cx*20,Y-cy*20,cen),style=sc.lineStyle(cx,cy);
  let I=L.road*(s>-.4?.62+.38*smooth(-.1,-.4,s):1);
  const jm=style?junctionMarks(m,X-cx*20,Y-cy*20):{yellow:0,white:0};
  if(jm.white>.001||jm.yellow>.001){litAsphalt(S,o,I,L.rt);paint(o,jm.yellow*wear(X,Y,17)*.78,[223,169,61],I);paint(o,jm.white*(.8+.2*wear(X,Y,19))*.84,[229,225,207],I);info.I=I;return 1;}
  if(style&&Math.abs(c.d)<.3){let a;
   if(style==='double')a=smooth(.065,.045,Math.abs(Math.abs(c.d)-.12));
   else{const n=Math.max(1,Math.round(c.len/3.333)),per=c.len/n,dl=1.63*per/3.333,loc=((c.s%per)+per)%per-per/2;a=smooth(.125,.095,Math.abs(c.d))*smooth(dl/2+.03,dl/2-.03,Math.abs(loc));}
   if(a>0){a*=wear(c.s+cx*131+cy*71,c.d,0);litAsphalt(S,o,I,L.rt);const lum=(.3*o[0]+.59*o[1]+.11*o[2]-S.LUMA0)/40;paint(o,a*clamp(.86+.5*lum,.6,1)*.93,[246,168,36],I);info.I=I;return 1;}}
  if(I>.003)litAsphalt(S,o,I,L.rt);info.I=I;return 1;}
 // ---- driveway across the sidewalk
 if(drive){asphalt(S,X,Y,o);const lotC=lotAsphalt(S,X,Y,[0,0,0]),mix=drivewayBlend(drive,X,Y);for(let k=0;k<3;k++)o[k]=o[k]*(1-mix)+lotC[k]*mix;
  if(L.road>.003)litAsphalt(S,o,L.road,L.rt);info.I=L.road;return 1;}
 // ---- lots, plazas, fields, dirt yards
 let bestLot=null,bd=1e9;for(const l of sc.cellLots[cell]){const d=sdRect(l,X,Y);if(d<l.border&&d<bd){bd=d;bestLot=l;}}
 if(bestLot){const l=bestLot;
  if(bd<0){
   if(l.surface==='asphalt'){lotAsphalt(S,X,Y,o);
    const a=bays(l,X,Y);if(a>0){litAsphalt(S,o,L.road,L.rt);paint(o,a,[222,219,204],L.road);info.I=L.road;return 1;}
    if(L.road>.003)litAsphalt(S,o,L.road,L.rt);info.I=L.road;return 1;}
   if(l.surface==='slab'){ // plaza: the same painted slabs laid on a 2.5 m grid
    const u=(l.grid?X:X-(l.cx-l.hx))/K.slab,v=(l.grid?Y:Y-(l.cy-l.hy))/K.slab,iu=Math.floor(u),iv=Math.floor(v);
    const key=hash(iu,iv,l.i,9);fr0.nx=0;fr0.ny=-1;fr0.tx=1;fr0.ty=0;slab(sc,o,X,Y,.21+(v-iv)*(K.walk-.21),0,K.walk,u-iu,K.slab,fr0,key,hash(iu,iv,l.i,3),L);info.I=L.walk*.6;return 1;}
   info.surf=l.surface;info.lot=l;info.d=bd;return 0;} // dirt / field are painted with the grass pass
  if(l.border>0){rectFrame(l,X,Y,fr0);
   const vis=clamp((fr0.nx+fr0.ny)/Math.SQRT2/.7071,0,1.4),f=.18*vis,s=bd,seg=Math.floor(fr0.slab+1e-6),fr=fr0.slab-seg,rh=hash(l.i,seg,5);
   if(l.border<.5){if(s<f+.21){curbZone(sc,o,s,f,fr,rh,L);return smooth(l.border,l.border-.03,s);}return 0;}
   if(s>=f+.21){slab(sc,o,X,Y,s,f,l.border,fr,fr0.slabLen,fr0,hash(l.i,seg,9),hash(l.i,seg,3),L);info.I=L.walk*.6;return smooth(l.border,l.border-.03,s);}
   curbZone(sc,o,s,f,fr,rh,L);info.I=L.curb;return 1;}}
 return 0;}
function bays(l,X,Y){if(!l.bays)return 0;let a=0;
 for(const b of l.bays){const sp=b.spacing??2.7,dep=b.depth??5,w=.12;let u,v;
  if(b.side==='N'){u=X;v=Y-(l.cy-l.hy);}else if(b.side==='S'){u=X;v=(l.cy+l.hy)-Y;}else if(b.side==='W'){u=Y;v=X-(l.cx-l.hx);}else{u=Y;v=(l.cx+l.hx)-X;}
  if(v<.3||v>dep+.3||u<b.from-w||u>b.to+w)continue;const k=Math.round((u-b.from)/sp),uk=b.from+k*sp;if(uk>b.to+.01)continue;
  const line=smooth(w/2+.025,w/2-.02,Math.abs(u-uk))*smooth(dep+.3,dep+.25,v);a=Math.max(a,line*wear(v+k*7.3,u-uk,5)*.85);}
 return a;}

// ---------------------------------------------------------------- dressing placement (deterministic per cell / region)
function sizeOf(r,k){const u=r();return (k==='stray'?.96:1)*(u<.22?.11+r()*.08:u<.58?.2+r()*.1:u<.88?.32+r()*.15:.49+r()*.16);}
function curbPointOf(run,cx,cy,along){
 if(run.type==='bulb'){const [x,y,nx,ny]=bulbPoint(run,along);return [cx*20+x,cy*20+y,nx,ny];}
 if(run.type==='line'){if(run.n[0]!==0)return [cx*20+(run.n[0]>0?run.c:-run.c),cy*20+along,-run.n[0],0];return [cx*20+along,cy*20+(run.n[1]>0?run.c:-run.c),0,-run.n[1]];}
 const {C,e1,e2,r,rRef}=run;let p,g;
 if(along<K.stem){const t=K.stem-along;p=[C[0]-r*e1[0]+t*e2[0],C[1]-r*e1[1]+t*e2[1]];g=[-e1[0],-e1[1]];}
 else if(along<K.stem+Math.PI/2*rRef){const ph=(along-K.stem)/rRef,dx=-e1[0]*Math.cos(ph)-e2[0]*Math.sin(ph),dy=-e1[1]*Math.cos(ph)-e2[1]*Math.sin(ph);p=[C[0]+r*dx,C[1]+r*dy];g=[dx,dy];}
 else{const a1=along-K.stem-Math.PI/2*rRef;p=[C[0]-r*e2[0]+a1*e1[0],C[1]-r*e2[1]+a1*e1[1]];g=[-e2[0],-e2[1]];}
 const sgn=run.inner?1:-1;return [cx*20+p[0],cy*20+p[1],g[0]*sgn,g[1]*sgn];}
function pickLeaf(S,r,sizeM){const size=sizeM*45.25*S.zoom,want=size*1.15,pool=sizeM<.2&&r()<.7?S.roundLeaves:S.leafImgs;let lo=0,hi=pool.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(pool[mid].dim<want)lo=mid+1;else hi=mid;}
 return {img:pool[Math.min(pool.length-1,lo+Math.floor(r()*Math.min(40,pool.length-lo)))],size,ang:r()*Math.PI*2,tint:.9+r()*.2};}
function placeLeaves(sc){const S=sc.S,info={},col=[0,0,0,0];sc.leaves=[];
 for(let cy=sc.G.cy0;cy<=sc.G.cy1;cy++)for(let cx=sc.G.cx0;cx<=sc.G.cx1;cx++){const m=sc.masks[sc.ci(cx,cy)];if(!m)continue;const r=makeRng(cx*1000+cy+1),g=gaussOf(r);
  RUNS[m].forEach(run=>{const len=run.type==='line'?20:run.len,pts=[];
   for(let a=0;a<len;){a+=.8+r()*3;if(a>=len)break;if(r()<.25)continue;const n=4+Math.floor(r()*r()*24);for(let i=0;i<n;i++)pts.push([clamp(a+g()*.65,0,len-.01),.06+Math.abs(g())*.24+r()*r()*.5,'gutter']);}
   for(let a=0;a<len;){a+=.7+r()*2.2;if(a>=len)break;const d=.35-Math.log(1-r()*.985)*.75;if(d<3.15)pts.push([a,d,'stray']);}
   for(let a=0;a<len;a+=5){if(r()>.38)continue;const c0=a+r()*5,n=4+Math.floor(r()*12),edge=r()<.6;for(let i=0;i<n;i++)pts.push([clamp(c0+g()*1.1,0,len-.01),edge?-(K.walk-.15-Math.abs(g())*.45):-(.35+r()*(K.walk-.5)),'walk']);}
   for(let a=0;a<len;a+=.6+r()*1.6){if(r()<.45)continue;const n=1+Math.floor(r()*4);for(let i=0;i<n;i++)pts.push([clamp(a+g()*.3,0,len-.01),-(K.walk+.04+Math.abs(g())*.3),'edge']);}
   for(const [al,d,kind] of pts){const [X0,Y0,nx,ny]=curbPointOf(run,cx,cy,al),X=X0+nx*d,Y=Y0+ny*d,a=shade(sc,X,Y,col,info),sizeM=sizeOf(r,kind),lf=pickLeaf(S,r,sizeM);
    if(kind==='edge'){if(a>.1)continue;}else{if(a<.8)continue;if(kind!=='walk'&&info.I>.45&&r()<.6)continue;}
    const [sx,sy]=sc.toScreen(X,Y);sc.leaves.push({sx,sy,...lf,layer:kind==='edge'?'grass':'pave',light:info.I});}});}}
const REG=512;
function placeGrassDressing(sc){sc.regions=new Map();}
function regionDressing(sc,rx,ry){const key=rx+','+ry;let d=sc.regions.get(key);if(d)return d;const S=sc.S,z=S.zoom,r=makeRng(rx*7919+ry*104729+13),g=gaussOf(r),R=REG*z,info={},col=[0,0,0,0];
 d={decals:[],leaves:[],soil:[]};const areaM2=R*R/(1024*z*z);
 // grass variety: big soft patches of the five grass decals, a few leaf-scatter decals, and tufts
 for(let i=0;i<areaM2/22;i++){const k=r()<.82?Math.floor(r()*5):r()<.7?5+Math.floor(r()*3):8;d.decals.push({k,sx:rx*R+r()*R,sy:ry*R+r()*R,s:.7+r()*.6,flip:r()<.5,a:.55+r()*.4});}
 // bare soil patches
 if(r()<.3){const n=1;for(let i=0;i<n;i++)d.soil.push({sx:rx*R+r()*R,sy:ry*R+r()*R,rad:(1.5+r()*2.8)*45*z,seed:Math.floor(r()*1e6)});}
 // the same leaves as the road, on grass: a sparse scatter plus a few drifts
 const add=(sx,sy,sizeM)=>{const [X,Y]=sc.toWorld(sx,sy);if(shade(sc,X,Y,col,info)>.1)return;d.leaves.push({sx,sy,...pickLeaf(S,r,sizeM),layer:'grass',light:0});};
 for(let i=0;i<areaM2*.3;i++)add(rx*R+r()*R,ry*R+r()*R,sizeOf(r,'stray'));
 for(let c=0;c<areaM2/55;c++){const [X0,Y0]=sc.toWorld(rx*R+r()*R,ry*R+r()*R),n=4+Math.floor(r()*r()*22),sp=.35+r()*.6;for(let i=0;i<n;i++){const [sx,sy]=sc.toScreen(X0+g()*sp,Y0+g()*sp);add(sx,sy,sizeOf(r,'gutter'));}}
 sc.regions.set(key,d);return d;}

// ---------------------------------------------------------------- rendering a rectangle of the picture
export function renderRect(sc,x0,y0,w,h){
 if(sc.plan.groundShape==='isometric'){
  const b=sc.groundBounds,corners=[[x0,y0],[x0+w,y0],[x0,y0+h],[x0+w,y0+h]].map(p=>sc.toWorld(...p));
  if(corners.every(p=>p[0]<b.x0)||corners.every(p=>p[0]>=b.x1)||corners.every(p=>p[1]<b.y0)||corners.every(p=>p[1]>=b.y1))return Buffer.alloc(w*h*4);
 }
 const S=sc.S,z=S.zoom,M=Math.ceil(60*z),X0=x0-M,Y0=y0-M,W=w+2*M,H=h+2*M;
 const pave=Buffer.alloc(W*H*4),light=new Float32Array(W*H),surf=new Array(W*H);const col=[0,0,0,0],info={};
 const SS=[[.25,.25],[.75,.25],[.25,.75],[.75,.75]];
 for(let py=0;py<H;py++)for(let px=0;px<W;px++){let r=0,g=0,b=0,a=0,li=0,sf=null;
  for(const [dx,dy] of SS){const [X,Y]=sc.toWorld(X0+px+dx,Y0+py+dy);const al=shade(sc,X,Y,col,info);if(al>0){r+=col[0]*al;g+=col[1]*al;b+=col[2]*al;a+=al;li+=info.I;}else if(info.surf&&!sf)sf={surf:info.surf,lot:info.lot,d:info.d};}
  const i=py*W+px;if(a>0){const o=i*4;pave[o]=r/a;pave[o+1]=g/a;pave[o+2]=b/a;pave[o+3]=a/4*255;light[i]=li/4;}if(sf)surf[i]=sf;}
 // leaves on paving
 const drawLeaf=(buf,lf,allow,lightAt)=>{const {img,size,ang,tint}=lf,sc2=size/img.dim,ca=Math.cos(ang),sa=Math.sin(ang),sq=.74,R=Math.ceil(Math.hypot(img.width*sc2/2,img.height*sc2/2))+2,cxp=Math.round(lf.sx-X0),cyp=Math.round(lf.sy-Y0);
  if(cxp+R<0||cyp+R<0||cxp-R>=W||cyp-R>=H)return;
  for(const pass of [0,1])for(let yy=-R;yy<=R;yy++)for(let xx=-R;xx<=R;xx++){const ox=xx-(pass?0:.8*z),oy=yy-(pass?0:1.1*z),qy=oy/sq,ux=(ox*ca+qy*sa)/sc2+img.width/2,uy=(-ox*sa+qy*ca)/sc2+img.height/2;
   if(ux<0||uy<0||ux>=img.width||uy>=img.height)continue;bil(img,ux,uy,tmp);const a=tmp[3]/255;if(a<.02)continue;const tx=cxp+xx,ty=cyp+yy;if(tx<0||ty<0||tx>=W||ty>=H)continue;const o=(ty*W+tx)*4;if(!allow(o))continue;
   if(!pass){const s2=a*.2;for(let k=0;k<3;k++)buf[o+k]=buf[o+k]*(1-s2);continue;}const L2=lightAt(o);const c=[tmp[0]*tint*(1+.55*L2)+70*L2,tmp[1]*tint*(1+.3*L2)+35*L2,tmp[2]*tint*(1-.2*L2)];
   for(let k=0;k<3;k++)buf[o+k]=clamp(buf[o+k]*(1-a)+c[k]*a,0,255);}};
 for(const lf of sc.leaves)if(lf.layer==='pave')drawLeaf(pave,lf,o=>pave[o+3]>=10,o=>light[o>>2]);
 // ground: grass (two approved grass paintings mixed by low-frequency noise), soil patches, dirt yards, fields
 const ground=Buffer.alloc(W*H*4),HG=S.GR*.75,gr=[0,0,0],gb=[0,0,0];
 const rx0=Math.floor(X0/(REG*z))-1,rx1=Math.floor((X0+W)/(REG*z))+1,ry0=Math.floor(Y0/(REG*z))-1,ry1=Math.floor((Y0+H)/(REG*z))+1,regs=[];
 for(let ry=ry0;ry<=ry1;ry++)for(let rx=rx0;rx<=rx1;rx++)regs.push(regionDressing(sc,rx,ry));
 const soils=regs.flatMap(r=>r.soil).filter(s=>s.sx+s.rad*2>X0&&s.sx-s.rad*2<X0+W&&s.sy+s.rad>Y0&&s.sy-s.rad<Y0+H);
 const spill=(X,Y)=>{let sp=0;const cx=Math.floor(X/20),cy=Math.floor(Y/20),cell=sc.ci(cx,cy);if(cell<0)return 0;for(const l of sc.cellLamps[cell]){const qx=X-l.px,qy=Y-l.py;sp=Math.max(sp,l.strength*.55*Math.exp(-(qx*qx+qy*qy)/(4.4*4.4)));}return sp;};
 for(let py=0;py<H;py++)for(let px=0;px<W;px++){const i=py*W+px,o=i*4;if(pave[o+3]===255)continue;const sx=X0+px,sy=Y0+py;
  const j=sy/(HG*SQ3/2);tri(sx/HG-j/2,j);gr[0]=gr[1]=gr[2]=0;gb[0]=gb[1]=gb[2]=0;
  for(let q=0;q<9;q+=3){const w=HV[q+2];if(w<1e-5)continue;const hx=hash(HV[q],HV[q+1],21)*S.GR,hy=hash(HV[q],HV[q+1],23)*S.GR;bilWrap(S.grassA,sx+hx,sy+hy,tmp);gr[0]+=w*tmp[0];gr[1]+=w*tmp[1];gr[2]+=w*tmp[2];bilWrap(S.grassB,sx+hy,sy+hx,tmp);gb[0]+=w*tmp[0];gb[1]+=w*tmp[1];gb[2]+=w*tmp[2];}
  const mix=smooth(.38,.62,fbm(sx/(700*z),sy/(700*z),31,3)),tone=fbm(sx/(420*z),sy/(420*z),37,3),warm=fbm(sx/(900*z),sy/(900*z),41,2);
  let c0=gr[0]*(1-mix)+gb[0]*mix,c1=gr[1]*(1-mix)+gb[1]*mix,c2=gr[2]*(1-mix)+gb[2]*mix;const tb=.9+.2*tone,tw=(warm-.5)*.16;c0*=tb*(1+tw);c1*=tb*(1+tw*.4);c2*=tb*(1-tw*.6);
  // bare soil patches with ragged, feathered edges
  for(const s of soils){const dx=(sx-s.sx)/s.rad,dy=(sy-s.sy)/(s.rad*.5),d=Math.hypot(dx,dy);if(d>1.6)continue;const n=fbm(sx/(40*z),sy/(40*z),s.seed%997,3),edge=smooth(1.05,.7,d+(n-.5)*.9);if(edge<=0)continue;bilWrap(S.soil,sx,sy,tmp);const e2=edge*.8;tmp[0]=tmp[0]*.85+c0*.15;tmp[1]=tmp[1]*.85+c1*.15;tmp[2]=tmp[2]*.85+c2*.15;c0=c0*(1-e2)+tmp[0]*e2;c1=c1*(1-e2)+tmp[1]*e2;c2=c2*(1-e2)+tmp[2]*e2;continue;c0=c0*(1-edge)+tmp[0]*edge;c1=c1*(1-edge)+tmp[1]*edge;c2=c2*(1-edge)+tmp[2]*edge;}
  // ground-type lots: dirt yards and sports fields
  const sf=surf[i];if(sf){const l=sf.lot;
   if(sf.surf==='dirt'){const n=fbm(sx/(30*z),sy/(30*z),l.i*13+5,3),e=smooth(.2,-1.2,sf.d+(n-.5)*2.2);bilWrap(S.soil,sx*1.0,sy*1.0,tmp);c0=c0*(1-e)+tmp[0]*e;c1=c1*(1-e)+tmp[1]*e;c2=c2*(1-e)+tmp[2]*e;}
   else if(sf.surf==='field'){const [X,Y]=sc.toWorld(sx+.5,sy+.5);const along=l.hx>=l.hy?X-(l.cx-l.hx):Y-(l.cy-l.hy),len=2*Math.max(l.hx,l.hy),across=l.hx>=l.hy?Y-(l.cy-l.hy):X-(l.cx-l.hx),wid=2*Math.min(l.hx,l.hy);
    const stripe=Math.floor(along/5)%2?1.06:.94;c0*=stripe*.92;c1*=stripe*1.08;c2*=stripe*.9;
    const inset=1.2,inA=along-inset,inC=across-inset,LL=len-2*inset,WW=wid-2*inset;let line=0;
    if(inA>-0.1&&inA<LL+.1&&inC>-0.1&&inC<WW+.1){const ez=LL*.09;line=Math.max(smooth(.12,.06,Math.abs(inA))+0,smooth(.12,.06,Math.abs(inA-LL)),smooth(.12,.06,Math.abs(inC)),smooth(.12,.06,Math.abs(inC-WW)));
     for(let k=0;k<=10;k++){const p=ez+k*(LL-2*ez)/10;line=Math.max(line,smooth(.1,.05,Math.abs(inA-p)));}
     if(inA<ez||inA>LL-ez){c0=c0*.8+60*.2;c1=c1*.8+28*.2;c2=c2*.8+20*.2;}}
    line*=wear(along,across,11);c0=c0*(1-line*.85)+226*line*.85;c1=c1*(1-line*.85)+224*line*.85;c2=c2*(1-line*.85)+210*line*.85;}}
  const [X,Y]=sc.toWorld(sx+.5,sy+.5),sp=spill(X,Y);if(sp>.003){c0*=1+.9*sp;c1*=1+.45*sp;c2*=1-.1*sp;}
  let near=0;for(const [dx,dy] of [[0,-2],[0,-4],[-3,-1],[3,-1]]){const tx=px+Math.round(dx*z),ty=py+Math.round(dy*z);if(tx>=0&&ty>=0&&tx<W&&ty<H&&pave[(ty*W+tx)*4+3]>128)near++;}
  const shd=1-.07*near;ground[o]=clamp(c0*shd,0,255);ground[o+1]=clamp(c1*shd,0,255);ground[o+2]=clamp(c2*shd,0,255);ground[o+3]=255;}
 // grass decals (screen-space paintings) on grass only, then grass leaves
 const onGrass=o=>pave[o+3]<40&&!surf[o>>2];
 for(const rg of regs)for(const d of rg.decals){const img=S.decals[d.k].img,s=d.s,iw=img.width*s,ih=img.height*s,l0=Math.round(d.sx-iw/2-X0),t0=Math.round(d.sy-ih/2-Y0);
  if(l0+iw<0||t0+ih<0||l0>=W||t0>=H)continue;
  for(let yy=Math.max(0,t0);yy<Math.min(H,t0+ih);yy++)for(let xx=Math.max(0,l0);xx<Math.min(W,l0+iw);xx++){const o=(yy*W+xx)*4;if(!onGrass(o))continue;let ux=(xx-l0)/s;if(d.flip)ux=img.width-1-ux;bil(img,ux,(yy-t0)/s,tmp);const a=tmp[3]/255*d.a;if(a<.02)continue;
   for(let k=0;k<3;k++)ground[o+k]=ground[o+k]*(1-a)+tmp[k]*a;}}
 for(const rg of regs)for(const lf of rg.leaves)drawLeaf(ground,lf,onGrass,o=>{const [X,Y]=sc.toWorld(X0+((o>>2)%W),Y0+Math.floor((o>>2)/W));return spill(X,Y)*.8;});
 for(const lf of sc.leaves)if(lf.layer==='grass')drawLeaf(ground,lf,onGrass,()=>0);
 // composite and crop
 const outBuf=Buffer.alloc(w*h*4);
 const bounds=sc.groundBounds;
 for(let py=0;py<h;py++)for(let px=0;px<w;px++){if(bounds){const a=(x0+px+.5-sc.OX)/sc.SCALE,b=(y0+py+.5-sc.OY)/(sc.SCALE/2),X=(a+b)/2,Y=(b-a)/2;if(X<bounds.x0||Y<bounds.y0||X>=bounds.x1||Y>=bounds.y1)continue;}const i=((py+M)*W+px+M)*4,o=(py*w+px)*4,a=pave[i+3]/255;for(let k=0;k<3;k++)outBuf[o+k]=ground[i+k]*(1-a)+pave[i+k]*a;outBuf[o+3]=255;}
 // Upright lamps are editable layout sprites, NEVER part of ground tiles.
 return outBuf;}
