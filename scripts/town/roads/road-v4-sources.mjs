/** v4 material sources, cut from the owner-approved painted straight (v3 painted-10-sidewalk-light).
 *  Everything here is literal painted pixels, rectified to ground space. No new texture is invented. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {load,save,blank,homography,apply,sample,put} from '../../lib/road-v4-warp.mjs';
import {ROOT} from '../../lib/town-paths.mjs';
const out=path.join(ROOT,'output/road-autotile-v4'),src3=path.resolve(out,'../road-autotile-v3');
await fs.mkdir(path.join(out,'sources/slabs'),{recursive:true});
// 1. Rectify the straight at a fixed source density: 1104 px = 20 m along the road.
const paint=await load(path.join(src3,'native/painted-10-sidewalk-light.png'));
const T=[451.46,317.61],R=[1219.95,745.11],B=[788.99,988.31],L=[36.82,551.46],NU=1104,NV=600;
const h=homography([[0,0],[NU,0],[NU,NV],[0,NV]],[T,R,B,L]);
const S=blank(NU,NV);
// 2x2 supersampled rectification so the ground strip is not aliased.
for(let y=0;y<NV;y++)for(let x=0;x<NU;x++){const a=[0,0,0,0];for(const [dx,dy] of [[.25,.25],[.75,.25],[.25,.75],[.75,.75]]){const [sx,sy]=apply(h,x+dx,y+dy),c=sample(paint,sx,sy);for(let k=0;k<3;k++)a[k]+=c[k]*c[3]/255;a[3]+=c[3];}
 const al=a[3]/4;put(S,x,y,al>0?[a[0]/(a[3]/255),a[1]/(a[3]/255),a[2]/(a[3]/255),al]:[0,0,0,0]);}
await save(S,path.join(out,'sources/straight-rectified.png'));
const px=(img,x,y)=>{x=Math.max(0,Math.min(img.width-1,x|0));y=Math.max(0,Math.min(img.height-1,y|0));const o=(y*img.width+x)*4;return [img.data[o],img.data[o+1],img.data[o+2],img.data[o+3]];};
const luma=p=>.3*p[0]+.59*p[1]+.11*p[2],warm=p=>p[0]-p[2];
const crop=(img,x0,y0,w,h)=>{const o=blank(w,h);for(let y=0;y<h;y++)for(let x=0;x<w;x++)put(o,x,y,px(img,x0+x,y0+y));return o;};

// 2. Remove the painted centre dashes by mirroring the asphalt just outside the dash band (dash pixels only).
const DASH0=296,DASH1=316;
const isDash=p=>warm(p)>18||luma(p)>78;
const clean=blank(NU,NV);clean.data.set(S.data);
const mask=new Uint8Array(NU*NV);
for(let y=DASH0;y<=DASH1;y++)for(let x=0;x<NU;x++)if(isDash(px(S,x,y)))mask[y*NU+x]=1;
const m2=mask.slice();for(let y=DASH0-2;y<=DASH1+2;y++)for(let x=2;x<NU-2;x++){if(mask[y*NU+x])continue;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)if(mask[(y+dy)*NU+x+dx])m2[y*NU+x]=1;}
// Patch inpainting: each painted dash is a bright rectangle. Find the asphalt patch (outside the dash band)
// whose surrounding ring best matches the dash's surroundings (mean-corrected, so a lamp gradient is followed),
// then paste its interior with a feathered edge. The real painted texture continues through the gap.
{
 const dashes=[];const colHas=x=>{for(let y=DASH0;y<=DASH1;y++)if(m2[y*NU+x])return true;return false;};
 for(let x=0;x<NU;){if(!colHas(x)){x++;continue;}let x1=x;while(x1<NU&&colHas(x1))x1++;if(x1-x>12)dashes.push([x,x1-1]);x=x1;}
 const lum=new Float32Array(NU*NV);for(let i=0;i<NU*NV;i++)lum[i]=.3*S.data[i*4]+.59*S.data[i*4+1]+.11*S.data[i*4+2];
 const PAD=6;
 for(const [x0,x1] of dashes){
  const bx0=Math.max(0,x0-PAD),bx1=Math.min(NU-1,x1+PAD),by0=DASH0-PAD-2,by1=DASH1+PAD+2,bw=bx1-bx0+1,bh=by1-by0+1;
  const ring=[];for(let y=by0;y<=by1;y++)for(let x=bx0;x<=bx1;x++)if(!m2[y*NU+x]&&(y<DASH0-2||y>DASH1+2||x<x0-2||x>x1+2))ring.push([x-bx0,y-by0]);
  let ringMean=0;for(const [rx,ry] of ring)ringMean+=lum[(by0+ry)*NU+bx0+rx];ringMean/=ring.length;
  let best=1e18,bu=0,bv=0;
  const inPool=x0<800&&x1>200,ulo=inPool?Math.max(0,x0-260):0,uhi=inPool?Math.min(NU-bw,x0+260):NU-bw;
  for(const [v0,v1] of [[140,DASH0-bh-4],[DASH1+8,452-bh]])for(let v=v0;v<=v1;v+=2)for(let u=ulo;u<=uhi;u+=2){
   if(!inPool&&u+bw>200&&u<800)continue;
   let m=0;for(const [rx,ry] of ring)m+=lum[(v+ry)*NU+u+rx];m/=ring.length;const off=ringMean-m;
   let e=0;for(const [rx,ry] of ring){const d=lum[(v+ry)*NU+u+rx]+off-lum[(by0+ry)*NU+bx0+rx];e+=d*d;if(e>best)break;}
   if(e<best){best=e;bu=u;bv=v;}}
  let mr=0;for(const [rx,ry] of ring)mr+=lum[(bv+ry)*NU+bu+rx];mr/=ring.length;const gain=(ringMean+20)/(mr+20);
  for(let y=0;y<bh;y++)for(let x=0;x<bw;x++){const gx=bx0+x,gy=by0+y;
   // feathered weight: 1 inside the dilated dash, ramping to 0 over the outer PAD ring
   let dd=1e9;for(let yy=-PAD;yy<=PAD;yy++)for(let xx=-PAD;xx<=PAD;xx++){const X=gx+xx,Y=gy+yy;if(X<0||X>=NU||Y<0||Y>=NV)continue;if(m2[Y*NU+X])dd=Math.min(dd,Math.hypot(xx,yy));}
   const w=dd===0?1:Math.max(0,1-dd/PAD);if(w<=0)continue;
   const a=px(S,gx,gy),b=px(S,bu+x,bv+y);put(clean,gx,gy,[0,1,2].map(k=>a[k]*(1-w)+Math.min(255,b[k]*gain)*w).concat([a[3]]));}
 }
 console.log('inpainted dashes',dashes.length);
}
// 3. Clean the uniform orange dot rows from both gutters: replace warm specks by the nearest clean pixel in the same row.
function cleanRows(img,y0,y1,thr){for(let y=y0;y<=y1;y++){const row=[];for(let x=0;x<NU;x++)row.push(warm(px(img,x,y))>thr);
 for(let x=0;x<NU;x++){if(!row[x])continue;let d=1;while(d<80&&(row[x-d]!==false)&&(row[x+d]!==false))d++;const sx=row[x-d]===false?x-d:x+d;put(img,x,y,px(img,sx,y));}}}
cleanRows(clean,113,133,8);cleanRows(clean,460,479,8);
await save(clean,path.join(out,'sources/straight-clean.png'));

// 4. Asphalt windows (unlit, dashes removed). Rows 134..459 lie between the two gutters.
const ASPH0=136,ASPH1=457;
const asphA=crop(clean,690,ASPH0,410,ASPH1-ASPH0+1),asphB=crop(clean,6,ASPH0,284,ASPH1-ASPH0+1);
await save(asphA,path.join(out,'sources/asphalt-a.png'));await save(asphB,path.join(out,'sources/asphalt-b.png'));
// 5. Slab tiles between measured joint centres (unlit only). Row 0 = curb side, last row = outer edge.
const top=[549,681,814,951,1087],bot=[2,144,284,424,564,703,840,975];
const slabs=[];
for(let i=0;i<top.length-1;i++){const t=crop(clean,top[i],0,top[i+1]-top[i]+1,92);
 const f=blank(t.width,t.height);for(let y=0;y<t.height;y++)for(let x=0;x<t.width;x++)put(f,x,y,px(t,x,t.height-1-y));
 const file=`slabs/top-${i}.png`;await save(f,path.join(out,'sources',file));slabs.push({file,row:'top',width:f.width,height:f.height});}
for(let i=0;i<bot.length-1;i++){const t=crop(clean,bot[i],491,bot[i+1]-bot[i]+1,109);const file=`slabs/bottom-${i}.png`;await save(t,path.join(out,'sources',file));slabs.push({file,row:'bottom',width:t.width,height:t.height});}
// 6. Curb strips. Visible face (camera side): rows 92..133. Hidden face: rows 458..491, flipped so row 0 = sidewalk joint.
const vis=crop(clean,549,92,402,42);
const hidRaw=crop(clean,564,458,412,34),hid=blank(hidRaw.width,hidRaw.height);for(let y=0;y<hid.height;y++)for(let x=0;x<hid.width;x++)put(hid,x,y,px(hidRaw,x,hid.height-1-y));
await save(vis,path.join(out,'sources/curb-visible.png'));await save(hid,path.join(out,'sources/curb-hidden.png'));
// 7. The painted lamp pool: curb + gutter + asphalt rows 92..470, u 200..800, alpha from the light excess.
const P0=200,P1=800,PV0=92,PV1=470,pw=P1-P0,ph=PV1-PV0+1;
const pool=crop(clean,P0,PV0,pw,ph);
// The light SHAPE is measured on the original painting for curb+gutter rows (the gutter clean-up above would
// erase the lit gutter) and on the dash-free image for asphalt rows.
const lightSrc=(x,y)=>y<134?px(S,x,y):px(clean,x,y);
const rowRef=[];for(let y=PV0;y<=PV1;y++){let l=0,n=0;for(let x=700;x<1090;x++){l+=luma(lightSrc(x,y));n++;}rowRef.push(l/n);}
const ex=new Float32Array(pw*ph);for(let y=0;y<ph;y++)for(let x=0;x<pw;x++)ex[y*pw+x]=luma(lightSrc(P0+x,PV0+y))-rowRef[y];
function blur(a,w,h,r){const t=new Float32Array(a.length);for(let it=0;it<3;it++){for(let y=0;y<h;y++){let s=0;for(let x=-r;x<=r;x++)s+=a[y*w+Math.max(0,Math.min(w-1,x))];for(let x=0;x<w;x++){t[y*w+x]=s/(2*r+1);s+=a[y*w+Math.min(w-1,x+r+1)]-a[y*w+Math.max(0,x-r)];}}
 for(let x=0;x<w;x++){let s=0;for(let y=-r;y<=r;y++)s+=t[Math.max(0,Math.min(h-1,y))*w+x];for(let y=0;y<h;y++){a[y*w+x]=s/(2*r+1);s+=t[Math.min(h-1,y+r+1)*w+x]-t[Math.max(0,y-r)*w+x];}}}return a;}
const lo=blur(ex.slice(),pw,ph,8);
const intensity=blank(pw,ph);
let peak=0;for(const v of lo)peak=Math.max(peak,v);
for(let y=0;y<ph;y++)for(let x=0;x<pw;x++){const v=lo[y*pw+x],a=Math.max(0,Math.min(1,(v-3)/14));
 // Wide, soft alpha: the decal fringe is the same painted asphalt as the global source, so the fade is invisible.
 const edge=Math.min(x,pw-1-x,ph-1-y)/40,fe=Math.max(0,Math.min(1,edge));
 const o=(y*pw+x)*4;pool.data[o+3]=Math.round(255*Math.min(1,a*1.6)*fe*(pool.data[o+3]/255));
 const iv=Math.max(0,Math.min(1,v/peak));put(intensity,x,y,[255,255,255,Math.round(255*iv)]);}
await save(pool,path.join(out,'sources/pool-straight.png'));await save(intensity,path.join(out,'sources/pool-straight-intensity.png'));
let best=0,lampU=0;for(let x=250;x<600;x++){let l=0;for(let y=97;y<=101;y++)l+=luma(px(S,x,y));if(l>best){best=l;lampU=x;}}
// 8. Reverse-engineer the painting's lamp response on asphalt: for each light level I (from the shape above),
// the painted pixels' mean and spread versus the same asphalt unlit. The renderer applies exactly this table.
const statsOf=list=>{const n=list.length,m=[0,0,0],q=[0,0,0];for(const p of list)for(let k=0;k<3;k++){m[k]+=p[k];q[k]+=p[k]*p[k];}return {n,mean:m.map(v=>v/n),std:m.map((v,k)=>Math.sqrt(Math.max(0,q[k]/n-(v/n)**2)))};};
const asphRows=[];for(let y=140;y<=455;y++)if(y<292||y>320)asphRows.push(y);
const unl=[];for(const y of asphRows)for(let x=700;x<1095;x++)unl.push(px(clean,x,y));const U=statsOf(unl);
const IB=[0,.05,.15,.25,.35,.45,.55,.65,.75,.85,.95,1],bins=IB.map(()=>[]);
for(const y of asphRows)for(let x=P0+10;x<P1-10;x++){const iv=intensity.data[((y-PV0)*pw+(x-P0))*4+3]/255;if(iv<.02)continue;let b=1;while(b<IB.length-1&&IB[b]+.05<iv)b++;bins[b].push(px(clean,x,y));}
const DMU=[[0],[0],[0]],DSG=[[0],[0],[0]];
for(let b=1;b<IB.length;b++){const st=bins[b].length>200?statsOf(bins[b]):null;for(let k=0;k<3;k++){
 const prev=DMU[k][b-1];DMU[k].push(st?st.mean[k]-U.mean[k]:prev);DSG[k].push(st?Math.max(0,st.std[k]-U.std[k]):DSG[k][b-1]);}}
const light={IB,DMU,DSG,unlit:U,counts:bins.map(b=>b.length)};
const manifest={version:4,pxPerM:NU/20,cellM:20,
 rectify:{source:'output/road-autotile-v3/native/painted-10-sidewalk-light.png',corners:{T,R,B,L},size:[NU,NV]},
 profile:{curbLineTop:112.5,curbLineBottom:479.5,note:'rows of straight-rectified.png; top = camera-facing curb (visible face)'},
 asphalt:[{file:'asphalt-a.png',width:asphA.width,height:asphA.height},{file:'asphalt-b.png',width:asphB.width,height:asphB.height}],
 slabs,curb:{visible:{file:'curb-visible.png',curbRow:20.5},hidden:{file:'curb-hidden.png',curbRow:12.5}},
 pool:{file:'pool-straight.png',intensity:'pool-straight-intensity.png',u0:P0,v0:PV0,curbRow:112.5-PV0,lampU:lampU-P0,peakExcess:peak},light};
await fs.writeFile(path.join(out,'sources/manifest.json'),JSON.stringify(manifest,null,1));
console.log(JSON.stringify({slabs:slabs.length,lampU,peak:Math.round(peak),pool:[pw,ph]}));
