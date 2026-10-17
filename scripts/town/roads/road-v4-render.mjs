/** Maple Falls road builder v4 — render a road network on grass, in the game's 2:1 projection.
 *  node scripts/town/roads/road-v4-render.mjs [layout] [zoom]
 *  Materials are the owner-approved painted pixels (asphalt, slabs, curbs) sampled in ground space;
 *  lamp light reproduces the painting's own measured lit/unlit response; only dashes are drawn. */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {K,RUNS,kindOf,evalRun,centre,maskAt,hash} from '../../lib/road-v4-kit.mjs';
import {load} from '../../lib/road-v4-warp.mjs';
import {ROOT} from '../../lib/town-paths.mjs';
const OUT=path.join(ROOT,'output/road-autotile-v4'),SRC=path.join(OUT,'sources');
const layoutName=process.argv[2]||'town',ZOOM=+(process.argv[3]||1);
const man=JSON.parse(await fs.readFile(path.join(SRC,'manifest.json'),'utf8')),PPM=man.pxPerM;
const clamp=(v,a,b)=>v<a?a:v>b?b:v,smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};

// ---------- sources ----------
function bil(img,x,y,o){ // clamped bilinear, straight RGBA into o
 const W=img.width,H=img.height;x=clamp(x-.5,0,W-1.001);y=clamp(y-.5,0,H-1.001);const ix=x|0,iy=y|0,fx=x-ix,fy=y-iy,d=img.data,i=(iy*W+ix)*4,j=i+W*4;
 for(let k=0;k<4;k++)o[k]=(d[i+k]*(1-fx)+d[i+4+k]*fx)*(1-fy)+(d[j+k]*(1-fx)+d[j+4+k]*fx)*fy;return o;}
function bilWrap(img,x,y,o){const W=img.width,H=img.height;x=((x-.5)%W+W)%W;y=((y-.5)%H+H)%H;const ix=x|0,iy=y|0,fx=x-ix,fy=y-iy,ix1=(ix+1)%W,iy1=(iy+1)%H,d=img.data;
 const a=(iy*W+ix)*4,b=(iy*W+ix1)*4,c=(iy1*W+ix)*4,e=(iy1*W+ix1)*4;for(let k=0;k<4;k++)o[k]=(d[a+k]*(1-fx)+d[b+k]*fx)*(1-fy)+(d[c+k]*(1-fx)+d[e+k]*fx)*fy;return o;}
function flatten(img,r){ // remove large-scale tone so the painted texture tiles evenly; keep its own mean
 const W=img.width,H=img.height,ch=[0,1,2].map(k=>{const a=new Float32Array(W*H);for(let i=0;i<W*H;i++)a[i]=img.data[i*4+k];return a;});
 const blur=a=>{const t=new Float32Array(a.length);for(let it=0;it<3;it++){for(let y=0;y<H;y++){let s=0;for(let x=-r;x<=r;x++)s+=a[y*W+clamp(x,0,W-1)];for(let x=0;x<W;x++){t[y*W+x]=s/(2*r+1);s+=a[y*W+Math.min(W-1,x+r+1)]-a[y*W+Math.max(0,x-r)];}}
  for(let x=0;x<W;x++){let s=0;for(let y=-r;y<=r;y++)s+=t[clamp(y,0,H-1)*W+x];for(let y=0;y<H;y++){a[y*W+x]=s/(2*r+1);s+=t[Math.min(H-1,y+r+1)*W+x]-t[Math.max(0,y-r)*W+x];}}}return a;};
 const mean=ch.map(a=>a.reduce((s,v)=>s+v,0)/a.length);
 for(let k=0;k<3;k++){const lo=blur(ch[k].slice());for(let i=0;i<W*H;i++)img.data[i*4+k]=clamp(Math.round(ch[k][i]-lo[i]+mean[k]),0,255);}
 img.mean=mean;return img;}
const asph=[];for(const a of man.asphalt)asph.push(flatten(await load(path.join(SRC,a.file)),22));
const asphMean=[0,1,2].map(k=>(asph[0].mean[k]*asph[0].width+asph[1].mean[k]*asph[1].width)/(asph[0].width+asph[1].width));
for(const a of asph)for(let i=0;i<a.width*a.height;i++)for(let k=0;k<3;k++)a.data[i*4+k]=clamp(Math.round(a.data[i*4+k]-a.mean[k]+asphMean[k]),0,255);
const slabs=[];for(const s of man.slabs)slabs.push(await load(path.join(SRC,s.file)));
{ // normalise every slab to one shared beige (slabs keep their own grain, joints and edge)
 const means=slabs.map(t=>{const m=[0,0,0];let n=0;for(let y=4;y<t.height-6;y++)for(let x=4;x<t.width-4;x++){const o=(y*t.width+x)*4;for(let k=0;k<3;k++)m[k]+=t.data[o+k];n++;}return m.map(v=>v/n);});
 const target=[0,1,2].map(k=>means.reduce((s,m)=>s+m[k],0)/means.length);
 slabs.forEach((t,i)=>{for(let j=0;j<t.width*t.height;j++)for(let k=0;k<3;k++)t.data[j*4+k]=clamp(Math.round(t.data[j*4+k]*target[k]/means[i][k]),0,255);});}
const curbV=await load(path.join(SRC,man.curb.visible.file)),curbH=await load(path.join(SRC,man.curb.hidden.file));
const segV=[0,132,265,402],segH=[0,139,276,411];
const stampImg=await load(path.join(SRC,man.pool.intensity));
const STAMP_U=man.pool.lampU,STAMP_V=man.pool.curbRow;
// grass: approved tileable grass, at the earlier review's approved scale (one repeat = 256 screen px at zoom 1)
const GR=Math.max(32,Math.round(256*ZOOM));
const grassImg=await (async()=>{const {data,info}=await sharp(path.join(ROOT,'output/terrain-materials/grass-base.png')).resize(GR,GR,{kernel:'lanczos3'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});return {data,width:info.width,height:info.height};})();

// ---------- layout ----------
const LAYOUTS={
 // 7 x 5 cells: Main Street (y=2) with a crossroads, a cross street leaving north and south, and two loops
 // that use all four bend orientations, both tee types and both straight axes. Cells outside the map are exits.
 town:{nx:7,ny:5,cells:['3,-1','3,0','4,0','5,0','6,0','6,1','3,1','0,2','1,2','2,2','3,2','4,2','5,2','6,2','0,3','3,3','0,4','1,4','2,4','3,4','3,5'],
  lamps:[{x:30,y:40+6.75,mode:'native'},{x:96,y:40+6.75,mode:'native'},{x:60+6.75,y:24,mode:'mirror'},{x:60+6.75,y:72,mode:'mirror'},
   {x:47,y:80+6.75,mode:'native'},{x:92,y:6.75,mode:'native'},{x:6.75,y:66,mode:'mirror'},{x:120+6.75,y:28,mode:'mirror'}]},
};
// One straight with the lamp exactly where the painting has it: the fidelity test against the approved art.
LAYOUTS.compare={nx:1,ny:1,cells:['-1,0','0,0','1,0'],lamps:[{x:390/55.2,y:6.75,mode:'native'}],noLeaves:true};
// Main Street (row 2) carries a worn double yellow; residential streets keep the painting's dashes.
LAYOUTS.town.lineStyle=(cx,cy)=>cy===2?'double':'dash';
const L=LAYOUTS[layoutName];if(!L)throw Error('unknown layout '+layoutName);
const lineStyle=L.lineStyle||(()=> 'dash');
// Optional dressing layers (quality tiers can switch them off): GRIME=0, WEAR=0
const GRIME=process.env.GRIME!=='0',WEAR=process.env.WEAR!=='0';
const cells=new Set(L.cells),NX=L.nx,NY=L.ny;
const masks=new Int8Array(NX*NY);
for(let cy=0;cy<NY;cy++)for(let cx=0;cx<NX;cx++){if(!cells.has(`${cx},${cy}`))continue;const m=maskAt(cells,cx,cy),k=kindOf(m);
 if(!['straight','bend','tee','cross'].includes(k))throw Error(`cell ${cx},${cy}: unsupported ${k} (mask ${m})`);masks[cy*NX+cx]=m;}
for(const l of L.lamps){l.nx=l.mode==='mirror'?1:0;l.ny=l.mode==='mirror'?0:1;const mid=.4+(K.walk-.4)/2;l.px=l.x-l.nx*mid;l.py=l.y-l.ny*mid;l.strength=l.strength||1;}

// ---------- projection ----------
const SCALE=32*ZOOM,MARGIN=Math.round(40*ZOOM);
const W=Math.round((NX+NY)*20*SCALE)+2*MARGIN,H=Math.round((NX+NY)*10*SCALE)+2*MARGIN,OX=NY*20*SCALE+MARGIN,OY=MARGIN;
const toWorld=(sx,sy)=>{const a=(sx-OX)/SCALE,b=(sy-OY)/(SCALE/2);return [(a+b)/2,(b-a)/2];};
const toScreen=(X,Y)=>[OX+(X-Y)*SCALE,OY+(X+Y)*SCALE/2];
console.log(JSON.stringify({layout:layoutName,W,H,cells:cells.size,zoom:ZOOM}));

// ---------- the painting's measured lamp response (asphalt), see sources analysis ----------
const {IB,DMU,DSG}=man.light;
// Saturated bins under-report spread (pixels clip at 255); keep the measured unsaturated spread for red.
for(let b=1;b<IB.length;b++)DSG[0][b]=Math.max(DSG[0][b],Math.min(30,DSG[0][b-1]));
function tbl(t,I){if(I<=0)return 0;if(I>=1)return t[t.length-1];let i=1;while(IB[i]<I)i++;const f=(I-IB[i-1])/(IB[i]-IB[i-1]);return t[i-1]+(t[i]-t[i-1])*f;}
const LUMA0=.3*asphMean[0]+.59*asphMean[1]+.11*asphMean[2];

// ---------- per-sample shading ----------
const HEX=1.6,SQ3=Math.sqrt(3),rs={},cen={},tmp=[0,0,0,0];
const HV=new Float64Array(9),HR=[0,0,0];
/** Triangle-lattice vertices + weights around (i,j) written into HV as [vi,vj,w]*3, no allocation. */
function tri(i,j){const fi=Math.floor(i),fj=Math.floor(j),fx=i-fi,fy=j-fj;
 if(fx+fy<1){HV[0]=fi;HV[1]=fj;HV[2]=1-fx-fy;HV[3]=fi+1;HV[4]=fj;HV[5]=fx;HV[6]=fi;HV[7]=fj+1;HV[8]=fy;}
 else{HV[0]=fi+1;HV[1]=fj+1;HV[2]=fx+fy-1;HV[3]=fi+1;HV[4]=fj;HV[5]=1-fy;HV[6]=fi;HV[7]=fj+1;HV[8]=1-fx;}
 const a=HV[2]**3,b=HV[5]**3,c=HV[8]**3,s=a+b+c;HV[2]=a/s;HV[5]=b/s;HV[8]=c/s;}
function asphalt(X,Y,o){ // by-example hex tiling of the painted asphalt in global ground coordinates
 const j=Y/(HEX*SQ3/2);tri(X/HEX-j/2,j);HR[0]=HR[1]=HR[2]=0;let w2=0;
 for(let q=0;q<9;q+=3){const vi=HV[q],vj=HV[q+1],w=HV[q+2];if(w<1e-5)continue;w2+=w*w;const vx=vi*HEX+vj*HEX/2,vy=vj*HEX*SQ3/2,img=asph[hash(vi,vj,7)<.6?0:1],m=HEX*PPM+2;
  bil(img,(X-vx)*PPM+m+hash(vi,vj,11)*(img.width-2*m),(Y-vy)*PPM+m+hash(vi,vj,13)*(img.height-2*m),tmp);
  HR[0]+=w*(tmp[0]-asphMean[0]);HR[1]+=w*(tmp[1]-asphMean[1]);HR[2]+=w*(tmp[2]-asphMean[2]);}
 const n=1/Math.sqrt(w2);o[0]=asphMean[0]+HR[0]*n;o[1]=asphMean[1]+HR[1]*n;o[2]=asphMean[2]+HR[2]*n;return o;}
function stampAt(l,X,Y){let du=X-l.x,dv=Y-l.y;if(l.mode==='mirror'){const t=du;du=dv;dv=t;}
 const sx=STAMP_U+du*PPM,sy=STAMP_V+dv*PPM;if(sx<0||sy<0||sx>=stampImg.width-1||sy>=stampImg.height-1)return 0;bil(stampImg,sx,sy,tmp);return tmp[3]/255*l.strength;}
function lights(X,Y){let road=0,curb=0,walk=0,lx=0,ly=0;
 for(const l of L.lamps){const dx=X-l.x,dy=Y-l.y;if(dx*dx+dy*dy>260)continue;road=Math.max(road,stampAt(l,X,Y));
  curb=Math.max(curb,l.strength*Math.exp(-(dx*dx+dy*dy)/2.2));
  const qx=X-l.px,qy=Y-l.py,wv=l.strength*Math.exp(-(qx*qx+qy*qy)/(4.2*4.2));if(wv>walk){walk=wv;lx=l.px;ly=l.py;}}
 rs.road=road;rs.curb=curb;rs.walk=walk;rs.lx=lx;rs.ly=ly;return rs;}
function litAsphalt(c,I){if(I<.003)return c;const z=clamp((.3*c[0]+.59*c[1]+.11*c[2]-LUMA0)/8.8,-3,3);
 for(let k=0;k<3;k++)c[k]=c[k]+tbl(DMU[k],I)+z*tbl(DSG[k],I);
 // the painted light is always amber: red >= green >= blue, even on the brightest ridges
 if(c[0]>140){const k=smooth(140,200,c[0]);c[1]=Math.min(c[1],c[1]*(1-k)+c[0]*.9*k);}return rolloff(c);}
/** Over-exposed light keeps its hue and burns toward warm white (as in the painting), instead of clipping
 *  channel by channel into yellow-green. */
function rolloff(c){const mx=Math.max(c[0],c[1],c[2]);if(mx>248){const over=mx-248,k=248/mx;c[0]=c[0]*k+over*.42;c[1]=c[1]*k+over*.36;c[2]=c[2]*k+over*.3;}
 for(let i=0;i<3;i++)c[i]=clamp(c[i],0,255);return c;}
// ---------- value noise for grime and paint wear (ground metres, deterministic) ----------
function vnoise(x,y,seed){const xi=Math.floor(x),yi=Math.floor(y),fx=x-xi,fy=y-yi,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
 const a=hash(xi,yi,seed),b=hash(xi+1,yi,seed),c=hash(xi,yi+1,seed),d=hash(xi+1,yi+1,seed);return (a*(1-u)+b*u)*(1-v)+(c*(1-u)+d*u)*v;}
function fbm(x,y,seed,oct=4){let s=0,a=.5,f=1,n=0;for(let i=0;i<oct;i++){s+=a*vnoise(x*f,y*f,seed+i*17);n+=a;a*=.5;f*=2.03;}return s/n;}
const STAIN=[.84,.78,.72]; // measured on the S-bend painting: darkest slab stains vs. its median slab colour
/** Brown pavement grime: blotchy stains that run across slabs, a dirt level that differs per slab,
 *  dirt packed into joints, and mud bleeding in from the grass edge. */
function grime(o,X,Y,slabKey,edgeJoint,edgeOuter){
 const wx=fbm(X*.35,Y*.35,91,2)-.5,wy=fbm(X*.35,Y*.35,93,2)-.5;
 const blot=fbm(X*1.15+wx*1.6,Y*1.15+wy*1.6,95,4),speck=fbm(X*9,Y*9,97,2);
 const level=.35+.65*slabKey;
 let st=smooth(.36,.64,blot)*level*.95+smooth(.5,.8,speck)*.3;
 st+=(1-smooth(.03,.12,edgeJoint))*.7*(.6+.4*speck);
 st+=(1-smooth(.04,.22,edgeOuter))*.6*(.5+.5*blot);
 st=clamp(st,0,1);for(let k=0;k<3;k++)o[k]*=1-(1-STAIN[k])*st;return o;}
const CURB_HOT={top:[254,240,190],face:[215,115,45],joint:[205,140,80],gutter:[165,90,22]},CURB_MU={top:[222,190,168],face:[78,68,78],joint:[120,99,85],gutter:[40,38,48]};
const run0={},best={};
const slabCol=[0,0,0,0];
/** Shade one ground sample. Returns alpha (0 = grass) and writes colour into acc-like o. lightOut gets intensity. */
function shade(X,Y,o,info){
 const cx=Math.floor(X/20),cy=Math.floor(Y/20);if(cx<0||cy<0||cx>=NX||cy>=NY)return 0;const m=masks[cy*NX+cx];if(!m)return 0;
 const x=X-cx*20,y=Y-cy*20,runs=RUNS[m];let bs=-1e9,bi=-1;
 for(let i=0;i<runs.length;i++){evalRun(runs[i],x,y,X,Y,run0);if(run0.s>bs){bs=run0.s;bi=i;Object.assign(best,run0);}}
 if(bs>=K.walk)return 0;
 const Lt=lights(X,Y);info.I=0;
 const vis=clamp((best.nx+best.ny)/Math.SQRT2/.7071,0,1.4),f=.18*vis,s=bs;
 const seg=Math.floor(best.slab+1e-6),fr=best.slab-seg,rh=hash(cx,cy,bi,seg);
 if(s>=f+.21){ // ---- slab ----
  const t=(s-f-.21)/(K.walk-f-.21),tile=slabs[Math.floor(hash(cx,cy,bi,seg,3)*slabs.length)];
  bil(tile,fr*(tile.width-1)+.5,t*(tile.height-1)+.5,slabCol);const g=.965+.07*hash(cx,cy,bi,seg,5);for(let k=0;k<3;k++)o[k]=slabCol[k]*g;
  const sl=best.slabLen,acr=K.walk-f-.21,dA=fr*sl,dB=(1-fr)*sl,dC=t*acr,dD=(1-t)*acr,dm=Math.min(dA,dB,dC,dD);
  if(GRIME)grime(o,X,Y,hash(cx,cy,bi,seg,9),Math.min(dA,dB,dC),dD);
  if(Lt.walk>.003){const I=Lt.walk;o[0]=o[0]*(1+.32*I)+30*I*I;o[1]=o[1]*(1+.08*I)+12*I*I;o[2]*=1-.34*I;
   // bevel catch: slab rims that face the lamp
   if(dm<.14){let ex,ey;if(dm===dA){ex=-best.tx;ey=-best.ty;}else if(dm===dB){ex=best.tx;ey=best.ty;}else if(dm===dC){ex=best.nx;ey=best.ny;}else{ex=-best.nx;ey=-best.ny;}
    const qx=Lt.lx-X,qy=Lt.ly-Y,ql=Math.hypot(qx,qy)||1,face=Math.max(0,(ex*qx+ey*qy)/ql),rim=Math.exp(-(((dm-.065)/.03)**2));
    const hgl=I*rim*(.3+.7*face);o[0]+=190*hgl;o[1]+=105*hgl;o[2]+=20*hgl;}
   info.I=I*.6;}
  rolloff(o);
  return smooth(K.walk,K.walk-.03,s);}
 // ---- curb / gutter / asphalt ----
 let zone,col;
 const sv=segV[Math.floor(rh*3)],ev=segV[Math.floor(rh*3)+1],sh=segH[Math.floor(rh*3)],eh=segH[Math.floor(rh*3)+1];
 const uV=sv+fr*(ev-sv),uH=sh+fr*(eh-sh);
 if(s>=0){
  if(s>=f+.13){zone='joint';bil(curbH,uH,(f+.21-s)/.08*3.5+.5,o);}
  else if(s>=f){zone='top';bil(curbH,uH,4+(f+.13-s)/.13*6.5+.5,o);}
  else{zone='face';bil(curbV,uV,10+(f-s)/Math.max(f,.001)*10.5+.5,o);}
  const I=Lt.curb;if(I>.003){const hot=CURB_HOT[zone],mu=CURB_MU[zone],e=Math.pow(I,.85);for(let k=0;k<3;k++)o[k]=clamp(o[k]+(hot[k]-mu[k])*e,0,255);}
  info.I=I;return 1;}
 // road side
 asphalt(X,Y,o);
 if(s>-.40){const gv=clamp(vis,0,1),rowV=20.5+(-s)*PPM,rowH=11.5+(-s)*PPM;bil(curbV,uV,rowV+.5,tmp);const a0=tmp[0],a1=tmp[1],a2=tmp[2];bil(curbH,uH,rowH+.5,tmp);
  const gw=smooth(-.40,-.24,s);o[0]=o[0]*(1-gw)+(a0*gv+tmp[0]*(1-gv))*gw;o[1]=o[1]*(1-gw)+(a1*gv+tmp[1]*(1-gv))*gw;o[2]=o[2]*(1-gw)+(a2*gv+tmp[2]*(1-gv))*gw;}
 // centre dashes (the only drawn marking), world-length phase per cell, gaps at every port
 const c=centre(m,x,y,cen),style=lineStyle(cx,cy);
 if(style&&Math.abs(c.d)<.3){let a;
  if(style==='double'){const d=Math.abs(c.d);a=smooth(.065,.045,Math.abs(d-.12));} // two solid lines, 9 cm wide, 24 cm apart
  else{const n=Math.max(1,Math.round(c.len/3.333)),per=c.len/n,dl=1.63*per/3.333,loc=((c.s%per)+per)%per-per/2;
   a=smooth(.125,.095,Math.abs(c.d))*smooth(dl/2+.03,dl/2-.03,Math.abs(loc));}
  // paint wear: small chips, the odd longer worn gap, and an uneven film (all in ground metres along the line)
  if(a>0&&WEAR){const along=c.s+cx*131+cy*71,chip=fbm(along*6,c.d*6,61,3),gap=fbm(along*.55,0,63,2),film=fbm(along*.9,c.d*4,65,2);
   a*=smooth(.28,.4,chip)*(.45+.55*smooth(.2,.3,gap))*(.88+.12*film);}
  if(a>0){const I=Lt.road;if(I>.003)litAsphalt(o,I);const lum=(.3*o[0]+.59*o[1]+.11*o[2]-LUMA0)/40,wear=clamp(.86+.5*lum,.6,1)*.93;const pa=a*wear;
   // paint under the lamp brightens gently; it does not glow like the wet asphalt reflection
   o[0]=o[0]*(1-pa)+Math.min(255,246+12*I)*pa;o[1]=o[1]*(1-pa)+(168+40*I)*pa;o[2]=o[2]*(1-pa)+(36+30*I)*pa;info.I=I;return 1;}}
 // the gutter sits in the curb's shadow: it catches the reflection, but less than open asphalt
 const I=Lt.road*(s>-.4?.62+.38*smooth(-.1,-.4,s):1);if(I>.003){litAsphalt(o,I);}
 info.I=I;return 1;}

// ---------- render paving with 2x2 supersampling ----------
const pave=Buffer.alloc(W*H*4),light=new Float32Array(W*H);const col=[0,0,0,0],info={I:0};
const SS=[[.25,.25],[.75,.25],[.25,.75],[.75,.75]];
const t0=Date.now();
for(let sy=0;sy<H;sy++){for(let sx=0;sx<W;sx++){
 let r=0,g=0,b=0,a=0,li=0;
 for(const [dx,dy] of SS){const [X,Y]=toWorld(sx+dx,sy+dy);const al=shade(X,Y,col,info);if(al>0){r+=col[0]*al;g+=col[1]*al;b+=col[2]*al;a+=al;li+=info.I;}}
 if(a>0){const o=(sy*W+sx)*4;pave[o]=Math.round(r/a);pave[o+1]=Math.round(g/a);pave[o+2]=Math.round(b/a);pave[o+3]=Math.round(a/4*255);light[sy*W+sx]=li/4;}
}if(sy%400===0)console.log('row',sy,'/',H,((Date.now()-t0)/1000).toFixed(0)+'s');}

// ---------- leaves ----------
const leafMeta=JSON.parse(await fs.readFile(path.join(SRC,'leaves.json'),'utf8'));
const leafImgs=[],roundLeaves=[];for(const l of leafMeta){const img=await load(path.join(SRC,'leaves',l.file));let green=0,n=0;for(let i=0;i<img.width*img.height;i++){if(img.data[i*4+3]<150)continue;n++;if(img.data[i*4+1]>img.data[i*4]*.95)green++;}
 if(!n||green/n>=.12||Math.max(img.width,img.height)<14)continue;
 {let r=0,g=0,c=0;for(let i=0;i<img.width*img.height;i++){if(img.data[i*4+3]<150)continue;r+=img.data[i*4];g+=img.data[i*4+1];c++;}if((r-g)/c<58)continue;} // autumn orange/red only, no yellow-green
 Object.assign(img,{dim:Math.max(img.width,img.height)});
 // the 'tiny' scatter is mostly round dots: only used for the smallest leaves; maple shapes carry the rest
 (l.source==='tiny'?roundLeaves:leafImgs).push(img);}
leafImgs.sort((a,b)=>a.dim-b.dim);roundLeaves.sort((a,b)=>a.dim-b.dim);
let rng=12345;const rand=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;};
const gauss=()=>{let u=0,v=0;while(!u)u=rand();v=rand();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);};
const placed=[];
function curbPoint(run,cx,cy,along){ // ground point on a curb run at 'along' metres; returns [X,Y,nx,ny]
 if(run.type==='line'){const lx=run.n[0]!==0?(run.n[0]>0?run.c:-run.c):null,ly=run.n[1]!==0?(run.n[1]>0?run.c:-run.c):null;
  if(lx!==null)return [cx*20+lx,cy*20+along,-run.n[0],0];return [cx*20+along,cy*20+ly,0,-run.n[1]];}
 const {C,e1,e2,r,rRef}=run;let p,g;
 if(along<K.stem){const t=K.stem-along;p=[C[0]-r*e1[0]+t*e2[0],C[1]-r*e1[1]+t*e2[1]];g=[-e1[0],-e1[1]];}
 else if(along<K.stem+Math.PI/2*rRef){const ph=(along-K.stem)/rRef,dx=-e1[0]*Math.cos(ph)-e2[0]*Math.sin(ph),dy=-e1[1]*Math.cos(ph)-e2[1]*Math.sin(ph);p=[C[0]+r*dx,C[1]+r*dy];g=[dx,dy];}
 else{const a1=along-K.stem-Math.PI/2*rRef;p=[C[0]-r*e2[0]+a1*e1[0],C[1]-r*e2[1]+a1*e1[1]];g=[-e2[0],-e2[1]];}
 const sgn=run.inner?1:-1;return [cx*20+p[0],cy*20+p[1],g[0]*sgn,g[1]*sgn];}
for(let cy=0;cy<NY;cy++)for(let cx=0;cx<NX;cx++){const m=masks[cy*NX+cx];if(!m||L.noLeaves)continue;
 RUNS[m].forEach((run,ri)=>{const len=run.type==='line'?20:run.len,lineStart=0;
  // gutter drifts: clusters hugging the curb, with gaps, plus strays thinning out toward the centre line
  for(let a=0;a<len;){a+=.8+rand()*3;if(a>=len)break;if(rand()<.25)continue;const n=4+Math.floor(rand()*rand()*24);
   for(let i=0;i<n;i++){const al=clamp(a+gauss()*.5,0,len-.01),d=.06+Math.abs(gauss())*.2+rand()*rand()*.35;placed.push({run,cx,cy,along:run.type==='line'?lineStart+al:al,d,kind:'gutter'});}}
  // strays: thinning out exponentially from the gutter toward the centre line
  for(let a=0;a<len;){a+=.7+rand()*2.2;if(a>=len)break;const d=.35-Math.log(1-rand()*.985)*.75;if(d>3.15)continue;placed.push({run,cx,cy,along:run.type==='line'?lineStart+a:a,d,kind:'stray'});}
  // sidewalk: only some stretches get a patch of leaves
  for(let a=0;a<len;a+=5){if(rand()>.38)continue;const c0=a+rand()*5,n=4+Math.floor(rand()*12),edge=rand()<.6;
   for(let i=0;i<n;i++){const al=clamp(c0+gauss()*1.1,0,len-.01),d=edge?-(K.walk-.15-Math.abs(gauss())*.45):-(.35+rand()*(K.walk-.5));placed.push({run,cx,cy,along:run.type==='line'?lineStart+al:al,d,kind:'walk'});}}
 });}
// size: mostly small, a good share medium, a few big leaves (metres across)
const sizeOf=k=>{const u=rand();return (k==='stray'?.92:1)*(u<.2?.13+rand()*.07:u<.62?.21+rand()*.09:u<.9?.3+rand()*.12:.43+rand()*.17);};
/** Draw one leaf (screen centre sx,sy; size in metres) into buf where allow(o) is true. lightAt(o) gives lamp light. */
function drawLeaf(buf,sx,sy,sizeM,allow,lightAt){
 const size=sizeM*45.25*ZOOM,want=size*1.15,pool=sizeM<.2&&rand()<.7?roundLeaves:leafImgs;let lo=0,hi=pool.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(pool[mid].dim<want)lo=mid+1;else hi=mid;}
 const img=pool[Math.min(pool.length-1,lo+Math.floor(rand()*Math.min(40,pool.length-lo)))];
 const sc=size/img.dim,ang=rand()*Math.PI*2,ca=Math.cos(ang),sa=Math.sin(ang),squash=.74;
 const hw=img.width*sc/2,hh=img.height*sc/2,R=Math.ceil(Math.hypot(hw,hh))+2,tint=.9+rand()*.2;
 for(const pass of [0,1])for(let yy=-R;yy<=R;yy++)for(let xx=-R;xx<=R;xx++){
  const ox=xx-(pass?0:.8*ZOOM),oy=yy-(pass?0:1.1*ZOOM),qx=ox,qy=oy/squash,ux=(qx*ca+qy*sa)/sc+img.width/2,uy=(-qx*sa+qy*ca)/sc+img.height/2;
  if(ux<0||uy<0||ux>=img.width||uy>=img.height)continue;bil(img,ux,uy,tmp);const a=tmp[3]/255;if(a<.02)continue;
  const tx=Math.round(sx)+xx,ty=Math.round(sy)+yy;if(tx<0||ty<0||tx>=W||ty>=H)continue;const o=(ty*W+tx)*4;if(!allow(o))continue;
  if(!pass){const sa2=a*.2;for(let k=0;k<3;k++)buf[o+k]=Math.round(buf[o+k]*(1-sa2));continue;}
  const L2=lightAt(o);const c=[tmp[0]*tint*(1+.55*L2)+70*L2,tmp[1]*tint*(1+.3*L2)+35*L2,tmp[2]*tint*(1-.2*L2)];
  for(let k=0;k<3;k++)buf[o+k]=Math.round(clamp(buf[o+k]*(1-a)+c[k]*a,0,255));}}
const onPave=o=>pave[o+3]>=10,paveLight=o=>light[o>>2];
let drawn=0;
for(const p of placed){const [X0,Y0,nx,ny]=curbPoint(p.run,p.cx,p.cy,p.along);const X=X0+nx*p.d,Y=Y0+ny*p.d;
 const [sx,sy]=toScreen(X,Y);if(sx<0||sy<0||sx>=W||sy>=H)continue;const pi=(Math.round(sy)*W+Math.round(sx))*4;if(pave[pi+3]<200)continue;
 const li=light[Math.round(sy)*W+Math.round(sx)];if(p.kind!=='walk'&&li>.45&&rand()<.6)continue; // keep the brightest glint readable
 drawLeaf(pave,sx,sy,sizeOf(p.kind),onPave,paveLight);drawn++;}
console.log('leaves drawn',drawn,'of',placed.length);

// ---------- grass (screen space, hex-tiled) + lamp spill on grass ----------
const final=Buffer.alloc(W*H*4);const HG=GR*.75;
for(let sy=0;sy<H;sy++)for(let sx=0;sx<W;sx++){const o=(sy*W+sx)*4,pa=pave[o+3]/255;let gr=[0,0,0];
 if(pa<1){const j=sy/(HG*SQ3/2);tri(sx/HG-j/2,j);
  for(let q=0;q<9;q+=3){const w=HV[q+2];if(w<1e-5)continue;bilWrap(grassImg,sx+hash(HV[q],HV[q+1],21)*GR,sy+hash(HV[q],HV[q+1],23)*GR,tmp);gr[0]+=w*tmp[0];gr[1]+=w*tmp[1];gr[2]+=w*tmp[2];}
  const [X,Y]=toWorld(sx+.5,sy+.5);let sp=0;for(const l of L.lamps){const qx=X-l.px,qy=Y-l.py;sp=Math.max(sp,l.strength*.55*Math.exp(-(qx*qx+qy*qy)/(4.4*4.4)));}
  if(sp>.003){gr[0]*=1+.9*sp;gr[1]*=1+.45*sp;gr[2]*=1-.1*sp;}
  // soft contact shadow where grass meets the raised sidewalk edge
  let near=0;for(const [dx,dy] of [[0,-2],[0,-4],[-3,-1],[3,-1]]){const tx=sx+Math.round(dx*ZOOM),ty=sy+Math.round(dy*ZOOM);if(tx>=0&&ty>=0&&tx<W&&ty<H&&pave[(ty*W+tx)*4+3]>128)near++;}
  const shadow=1-.07*near;for(let k=0;k<3;k++)gr[k]*=shadow;}
 for(let k=0;k<3;k++)final[o+k]=Math.round(clamp(gr[k]*(1-pa)+pave[o+k]*pa,0,255));final[o+3]=255;}
// ---------- the same leaves on the grass: sparse scatter, a few drifts, and leaves caught against sidewalk edges ----------
const grassSpill=(X,Y)=>{let sp=0;for(const l of L.lamps){const qx=X-l.px,qy=Y-l.py;sp=Math.max(sp,l.strength*.55*Math.exp(-(qx*qx+qy*qy)/(4.4*4.4)));}return sp;};
const onGrass=o=>pave[o+3]<40;let grassDrawn=0;
function grassLeaf(sx,sy,sizeM){if(sx<0||sy<0||sx>=W||sy>=H)return;if(pave[(Math.round(sy)*W+Math.round(sx))*4+3]>=40)return;const [X,Y]=toWorld(sx,sy),sp=grassSpill(X,Y);drawLeaf(final,sx,sy,sizeM,onGrass,()=>sp*.8);grassDrawn++;}
if(!L.noLeaves){
 const areaM2=W*H/(1024*ZOOM*ZOOM);
 for(let i=0;i<areaM2*.3;i++)grassLeaf(rand()*W,rand()*H,sizeOf('stray'));
 for(let c=0;c<areaM2/55;c++){const [X0,Y0]=toWorld(rand()*W,rand()*H),n=4+Math.floor(rand()*rand()*22),spread=.35+rand()*.6;
  for(let i=0;i<n;i++){const [sx,sy]=toScreen(X0+gauss()*spread,Y0+gauss()*spread);grassLeaf(sx,sy,sizeOf('gutter'));}}
 for(let cy=0;cy<NY;cy++)for(let cx=0;cx<NX;cx++){const m=masks[cy*NX+cx];if(!m)continue;
  for(const run of RUNS[m]){const len=run.type==='line'?20:run.len;for(let a=0;a<len;a+=.6+rand()*1.6){if(rand()<.45)continue;const n=1+Math.floor(rand()*4);
   for(let i=0;i<n;i++){const al=clamp(a+gauss()*.3,0,len-.01),[X0,Y0,nx,ny]=curbPoint(run,cx,cy,al),d=-(K.walk+.04+Math.abs(gauss())*.3);const [sx,sy]=toScreen(X0+nx*d,Y0+ny*d);grassLeaf(sx,sy,sizeOf('gutter'));}}}}}
console.log('grass leaves',grassDrawn);
const tag=`${layoutName}${ZOOM===1?'':'-z'+ZOOM}`;
await fs.mkdir(path.join(OUT,'maps'),{recursive:true});
await sharp(pave,{raw:{width:W,height:H,channels:4}}).png().toFile(path.join(OUT,'maps',`${tag}-roads-transparent.png`));
// ---------- the game's existing painted street lamp stands at every light pool (base on the post position) ----------
const LAMP_SRC=path.join(ROOT,'art/world/staged/streetlamp-57c1616a5a639908.png');
const lampW=Math.round(80*ZOOM),lampH=Math.round(240*ZOOM);
const lampBuf=await sharp(LAMP_SRC).resize(lampW,lampH,{kernel:'lanczos3'}).png().toBuffer();
const {data:la,info:li}=await sharp(lampBuf).raw().toBuffer({resolveWithObject:true});
let base=li.height-1;while(base>0){let any=false;for(let x=0;x<li.width;x++)if(la[(base*li.width+x)*4+3]>128){any=true;break;}if(any)break;base--;}
const anchorY=base-Math.round(4*ZOOM);
const lampLayers=L.lamps.map(l=>{const [sx,sy]=toScreen(l.px,l.py);return {input:lampBuf,left:Math.round(sx-lampW/2),top:Math.round(sy-anchorY)};}).filter(c=>c.left>=0&&c.top>=0&&c.left+lampW<=W&&c.top+lampH<=H);
const finalImg=await sharp(final,{raw:{width:W,height:H,channels:4}}).composite(lampLayers).png().toBuffer();
await fs.writeFile(path.join(OUT,'maps',`${tag}.png`),finalImg);
await sharp(finalImg).resize({width:Math.min(W,2800)}).webp({quality:92}).toFile(path.join(OUT,'maps',`${tag}-preview.webp`));
await fs.writeFile(path.join(OUT,'maps',`${tag}.json`),JSON.stringify({layout:layoutName,zoom:ZOOM,width:W,height:H,cellM:20,pxPerAxisM:SCALE,cells:L.cells,lamps:L.lamps.map(({x,y,mode,strength})=>({x,y,mode,strength})),leaves:drawn,seconds:Math.round((Date.now()-t0)/1000)},null,1));
console.log('done',((Date.now()-t0)/1000).toFixed(0)+'s');
