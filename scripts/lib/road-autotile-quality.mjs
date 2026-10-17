/** Exact ground geometry. Visible asphalt, joints and curb pixels are painted raster sources. */
import {ROAD,PORTS,kind,mod} from './road-autotile.mjs';
export const QUALITY=Object.freeze({supersample:2,stemM:2,curveRadiusM:6,cornerRadiusM:2,textureRepeatM:4,concreteRepeatM:2,dashPeriodM:4,dashLengthM:1.65});
const topology=Array.from({length:16},(_,m)=>kind(m));
export function turn(x,y,n){for(let i=0;i<mod(n,4);i++)[x,y]=[16-y,x];return {x,y};}
function segment(x,y,a,b){const dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy),t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(l*l))),qx=a.x+dx*t,qy=a.y+dy*t;return {distance:Math.hypot(x-qx,y-qy),signed:(x-qx)*(-dy/l)+(y-qy)*(dx/l),s:t*l,tx:dx/l,ty:dy/l,qx,qy,part:'straight'};}
export function field(mask,x,y){
 const half=ROAD.asphaltM/2,k=topology[mask];
 if(k==='curve'){
  const n=({3:0,6:1,12:2,9:3})[mask],p=turn(x,y,-n),r=QUALITY.curveRadiusM,stem=QUALITY.stemM,cx=8+r,cy=stem;
  const angle=Math.max(Math.PI/2,Math.min(Math.PI,Math.atan2(Math.max(0,p.y-cy),p.x-cx))),theta=Math.PI-angle,q=turn(cx+r*Math.cos(angle),cy+r*Math.sin(angle),n),tq=turn(cx+r*Math.cos(angle)+Math.sin(angle),cy+r*Math.sin(angle)-Math.cos(angle),n);
  const arc={distance:Math.hypot(x-q.x,y-q.y),signed:(x-q.x)*-(tq.y-q.y)+(y-q.y)*(tq.x-q.x),s:stem+r*theta,tx:tq.x-q.x,ty:tq.y-q.y,qx:q.x,qy:q.y,part:'arc',theta,turns:n};
  const a=segment(x,y,turn(8,0,n),turn(8,stem,n)),b=segment(x,y,turn(cx,8,n),turn(16,8,n));a.s+=0;b.s+=stem+r*Math.PI/2;a.turns=b.turns=n;
  const v=[arc,a,b].reduce((a,b)=>a.distance<b.distance?a:b);return {...v,roadDistance:v.distance-half,type:v.distance<half?'asphalt':v.distance<half+ROAD.sidewalkM?'sidewalk':'grass'};
 }
 const arms=PORTS.filter(p=>mask&p.bit);
 let v;
 if(mask===5)v=segment(x,y,{x:8,y:0},{x:8,y:16});
 else if(mask===10)v=segment(x,y,{x:0,y:8},{x:16,y:8});
 else if(arms.length)v=arms.map(p=>segment(x,y,p,{x:8,y:8})).reduce((a,b)=>a.distance<b.distance?a:b);
 else v={distance:Math.hypot(x-8,y-8),signed:0,s:0,tx:1,ty:0,qx:8,qy:8,part:'cap'};
 let d=v.distance-half;
 if(k==='tee'||k==='cross'){
  const sx=Math.sign(x-8)||1,sy=Math.sign(y-8)||1,px=sx>0?2:8,py=sy>0?4:1,a=Math.abs(x-8),b=Math.abs(y-8),r=QUALITY.cornerRadiusM;
  if((mask&px)&&(mask&py)&&a<half+r&&b<half+r){
   const centre=half+r,len=Math.hypot(a-centre,b-centre),rounded=r-len;
   if(rounded<d){d=rounded;v={...v,part:'return',theta:Math.atan2(centre-b,centre-a),cornerX:8+sx*centre,cornerY:8+sy*centre,cornerSX:sx,cornerSY:sy,cornerRadius:r};}
  }
 }
 if((k==='end'&&Math.abs(v.s-8)<1e-8)||k==='isolated')v={...v,part:'cap',theta:Math.atan2(y-8,x-8)};
 return {...v,roadDistance:d,type:d<0?'asphalt':d<ROAD.sidewalkM?'sidewalk':'grass'};
}
/** Reset texture phase only at a deliberate short/cut slab, never stretch the slab/grain. */
export function cutPhase(s,total,start=0,end=0){
 const delta=mod(end-start-total,2),cut=Math.floor(total/2+start+delta)-start-delta;
 return start+s+(s>=cut?delta:0);
}
export function pavingUV(mask,x,y,v){
 const d=Math.max(0,v.roadDistance),rowCentre=ROAD.sidewalkM/2;
 let along=Math.abs(v.tx)>.5?x:y;
 if(v.part==='arc'){
  const side=Math.sign(v.signed)||1,r=QUALITY.curveRadiusM+side*(ROAD.asphaltM/2+rowCentre),physical=r*v.theta,total=r*Math.PI/2;
  along=2+cutPhase(physical,total,0,0);
 }else if(v.part==='return'){
  const r=Math.max(.15,v.cornerRadius-rowCentre),theta=v.theta,start=v.cornerY,end=v.cornerX,direction=-v.cornerSY;
  along=start+direction*cutPhase(r*theta,r*Math.PI/2,0,direction*(end-start));
 }else if(v.part==='cap'){
  const r=ROAD.asphaltM/2+rowCentre;
  if(mask){const start=({1:0,2:Math.PI/2,4:Math.PI,8:Math.PI*1.5})[mask],theta=mod(v.theta-start,Math.PI*2);along=8+cutPhase(r*theta,r*Math.PI,0,0);}
  else{const theta=mod(v.theta,Math.PI*2);along=cutPhase(r*theta,r*Math.PI*2,0,0);}
 }
 return {cross:d,along};
}
export function sourceOver(base,paint,alpha){return base.map((c,i)=>Math.round(c*(1-alpha)+paint[i]*alpha));}
/** Light can only shade current pixels; it never imports foreign pavement/curb geometry. */
export function relight(base,energy,type){
 const e=Math.max(0,Math.min(1,energy)),g=type==='sidewalk'?[.58,.27,.05]:[6.5,2.7,.12];
 return base.map((c,k)=>Math.min(255,Math.round(c*(1+g[k]*e))));
}
export function variantFor(x,y,mask){const h=(Math.imul(x+41,73856093)^Math.imul(y+67,19349663)^Math.imul(mask,83492791))>>>0;return {light:h%5===0,leaves:h%4!==0};}
/** A fixed ground-plane light decal, anchored at a real curb, NOT warped round a path. */
export function lightFrame(mask){
 const k=topology[mask],half=ROAD.asphaltM/2;
 if(k==='end'||k==='isolated')return null;
 if(k==='curve'){
  const n=({3:0,6:1,12:2,9:3})[mask],q=turn(14-6/Math.SQRT2,2+6/Math.SQRT2,n),t=turn(14-5/Math.SQRT2,2+7/Math.SQRT2,n);
  const tx=t.x-q.x,ty=t.y-q.y;return {x:q.x,y:q.y,tx,ty,nx:-ty,ny:tx};
 }
 if(k==='tee'||k==='cross'){
  const corners=[[-1,-1,9],[1,-1,3],[1,1,6],[-1,1,12]],c=corners.find(([, ,bits])=>(mask&bits)===bits),[sx,sy]=c,r=QUALITY.cornerRadiusM;
  const curbX=8+sx*(half+r)-sx*r/Math.SQRT2,curbY=8+sy*(half+r)-sy*r/Math.SQRT2,nx=-sx/Math.SQRT2,ny=-sy/Math.SQRT2;
  return {x:curbX+nx*half,y:curbY+ny*half,tx:ny,ty:-nx,nx,ny};
 }
 return mask===5?{x:8,y:8,tx:0,ty:1,nx:-1,ny:0}:{x:8,y:8,tx:1,ty:0,nx:0,ny:1};
}
export function leafUV(dx,dy,length,aspect,angle){const c=Math.cos(angle),s=Math.sin(angle);return {u:(dx*c+dy*s)/length+.5,v:(-dx*s+dy*c)/(length*aspect)+.5};}
