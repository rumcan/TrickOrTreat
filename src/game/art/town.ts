import {TOWN_ASSETS,type TownAssetId} from '../town-assets';
import {asset,propAsset} from '../assets';
import {HW,HH} from '../config';
import {makeCanvas,projector,isoBox,poly,faceQuad,ellipse} from './draw';
import type {PropSprite} from './props';

const cache=new Map<string,PropSprite>();
/** The guide's footprint and ground pivot are fixed, never guessed from a generated silhouette. */
export function townGeometry(id:TownAssetId){
 const a=TOWN_ASSETS.find(a=>a.id===id)!;
 if(a.kind==='decal')return {a,w:128,h:64,ax:64,ay:32,ox:64,oy:0};
 const w=Math.ceil((a.fw+a.fh)*HW+64),h=Math.ceil((a.fw+a.fh)*HH+a.height+48);
 const ax=w/2,ay=h-(a.fw+a.fh)*HH/2-16;
 return {a,w,h,ax,ay,ox:ax-(a.fw-a.fh)*HW/2,oy:ay-(a.fw+a.fh)*HH/2};
}
export function drawTownGuide(id:TownAssetId){
 const {a,w,h,ox,oy}=townGeometry(id),{c,ctx}=makeCanvas(w,h),P=projector(ox,oy);
 if(a.kind==='building'){
  const colors=['#497a78','#a7644c','#9b855b','#dfcfa7','#59798e','#a68566','#9c655a','#7c657b','#a85a4d'];
  const col=colors[TOWN_ASSETS.indexOf(a)%colors.length];
  isoBox(ctx,P,0,0,a.fw,a.fh,0,a.height-16,'#303e56',col,'#354f65');
  isoBox(ctx,P,-.01,-.01,a.fw+.01,a.fh+.01,a.height-16,a.height,'#2a364b','#7c827d','#454f5a');
  for(let i=0;i<a.fw;i++){
   if(i===Math.floor(a.fw/2))continue;
   poly(ctx,faceQuad(P,'L',a.fh,i+.12,i+.88,12,78),'#ebba72','#e2d6b9',3);
   if(a.height>175)poly(ctx,faceQuad(P,'L',a.fh,i+.24,i+.76,123,165),'#edc989','#e2d6b9',3);
  }
  poly(ctx,faceQuad(P,'L',a.fh,a.fw/2-.36,a.fw/2+.36,0,78),'#547682','#e2d6b9',3);
  poly(ctx,faceQuad(P,'L',a.fh,.16,a.fw-.16,88,110),'#495752','#e2d6b9',2);
  for(let i=0;i<a.fh;i++)poly(ctx,faceQuad(P,'R',a.fw,i+.2,i+.8,18,70),'#e3b874','#e2d6b9',2);
  if(a.id==='firestation')for(const x of [.1,2.7])poly(ctx,faceQuad(P,'L',a.fh,x,x+2.15,0,98),'#984335','#d5c6b1',3);
 }else if(a.kind==='decal'){
  // Guides describe a horizontal 2:1 patch; final paint is an alpha decal, not a floor slab.
  const col=a.id.includes('grass')||a.id==='wheel_wear'?'#765e41':a.id==='leaf_drift'?'#b57b3d':a.id==='puddle'?'#668297':'#9a8b73';
  for(let i=0;i<22;i++){
   const x=.2+(.5+.5*Math.sin(i*15.73))*.6,y=.2+(.5+.5*Math.cos(i*11.31))*.6;
   const [sx,sy]=P(x,y);ellipse(ctx,sx,sy,3+(i%3)*3,1.5+(i%3)*1.5,col);
  }
 }else if(a.kind==='foliage'){
  for(let i=0;i<19;i++){
   const x=.5+Math.sin(i*2.4)*.32,y=.5+Math.cos(i*2.4)*.32,z=12+(i%5)*10;
   const [sx,sy]=P(x,y,z);ellipse(ctx,sx,sy,9,16,a.id==='hydrangea'&&i%3===0?'#9779a2':i%2?'#42665a':'#284940');
  }
 }else if(['traffic_light','stop_sign','street_sign','utility_pole'].includes(a.id)){
  isoBox(ctx,P,.47,.47,.53,.53,0,a.height-10,'#76818a','#687681','#3e5059');
  if(a.id==='traffic_light'){
   isoBox(ctx,P,.27,.46,.73,.63,a.height-76,a.height,'#28333d','#29353c','#151d24');
   for(let i=0;i<3;i++){const [sx,sy]=P(.5,.64,a.height-14-i*24);ellipse(ctx,sx,sy,7,8,['#913b37','#bfa95d','#649b83'][i]);}
  }else if(a.id==='stop_sign'){
   const z=a.height-25,pts=[[-.24,-24],[.24,-24],[.4,-11],[.4,11],[.24,24],[-.24,24],[-.4,11],[-.4,-11]].map(([x,h])=>P(.5+x,.55,z+h));
   poly(ctx,pts,'#af4640','#ddd4ba',3);
  }else if(a.id==='street_sign'){
   poly(ctx,faceQuad(P,'L',.55,-.2,1.2,a.height-25,a.height-8),'#416354','#ddd4ba',2);
   poly(ctx,faceQuad(P,'R',.55,-.2,1.2,a.height-45,a.height-28),'#416354','#ddd4ba',2);
  }else isoBox(ctx,P,.1,.42,.9,.58,a.height-15,a.height-5,'#655047','#54473f','#3a3433');
 }else if(['bus_stop','phone_booth'].includes(a.id)){
  isoBox(ctx,P,.05,.05,a.fw-.05,a.fh-.05,0,a.height-10,'#41576b','rgba(104,158,176,.3)','rgba(72,111,137,.25)');
  isoBox(ctx,P,0,0,a.fw,a.fh,a.height-10,a.height,'#35465b','#273649','#1d2739');
  poly(ctx,faceQuad(P,'L',a.fh-.04,.18,a.fw-.18,8,a.height-18),'rgba(122,173,193,.15)','#91a7ad',3);
 }else{
  // Footprint-safe massing for street furniture; brief supplies materials and object identity.
  const z=a.id==='picnic_table'?46:a.height;
  isoBox(ctx,P,.12,.12,a.fw-.12,a.fh-.12,8,z,'#687c68','#836e56','#4e5b60');
  if(a.id==='dumpster')isoBox(ctx,P,.1,.1,a.fw-.1,a.fh-.1,z-10,z,'#273932','#37443c','#202e29');
 }
 return c;
}
export function getTownProp(id:TownAssetId):PropSprite{
 const old=cache.get(id);if(old)return old;
 const {a,w,h,ax,ay}=townGeometry(id);
 if(a.kind==='decal')throw Error('Use getTownDecal for ground overlays');
 const entry=propAsset({key:'town_'+id,file:'town/'+id+'.png',category:'prop',w,h,anchor:[ax,ay],footprint:[a.fw,a.fh],desc:a.name,prompt:a.look},()=>drawTownGuide(id));
 // Bikes should be kid-sized, not taller than the school doors. Scale every
 // draw dimension, ground anchor AND collision footprint together; retain PNG masters.
 const scale=id==='bike_rack'?.5:1;
 const sp={img:entry.img,ax:entry.anchor[0]*scale,ay:entry.anchor[1]*scale,w:entry.w*scale,h:entry.h*scale,fw:a.fw*scale,fh:a.fh*scale,lights:a.kind==='building'?[{x:a.fw/2,y:a.fh+.35,r:3,color:'#ffd896',i:.75}]:[]};
 cache.set(id,sp);return sp;
}
export function getTownDecal(id:TownAssetId){
 const {a,w,h}=townGeometry(id);if(a.kind!=='decal')throw Error('Not a ground decal');
 return asset({key:'town_'+id,file:'town/'+id+'.png',category:'overlay',w,h,anchor:[64,32],desc:a.name,prompt:a.look},()=>drawTownGuide(id));
}
