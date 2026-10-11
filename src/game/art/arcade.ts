import { asset, propAsset } from '../assets';
import { makeCanvas, projector, isoBox, poly, diamondPath } from './draw';
import type { PropSprite } from './props';
import type { ArcadeKind } from '../arcade-layout';

export const ARCADE_ART_KINDS: ArcadeKind[] = ['cabinet','pinball','skeeball','airhockey','foosball','prizes','pizza','booth','stage','photo','tokens','party','wall'];
export const ARCADE_ART_SIZES: Record<ArcadeKind,[number,number]> = {
  cabinet:[1.5,2], pinball:[1.5,2], skeeball:[5,6], airhockey:[5,3], foosball:[3,3],
  prizes:[10,3], pizza:[7,3], booth:[6,3], stage:[9,4], photo:[2,3], tokens:[2,2], party:[8,4], wall:[8,.75],
};
const cache = new Map<string,PropSprite>();
const neon: Record<string,string> = {cabinet:'#19bfff',pinball:'#ff8b23',skeeball:'#ff572e',prizes:'#f253db',pizza:'#ff792c',photo:'#e354df',tokens:'#ffcf56'};
const labels: Record<string,string> = {cabinet:'STAR RAID',pinball:'NIGHT RUN',skeeball:'SKEE-BALL',prizes:'PRIZES',pizza:'PIZZA',stage:'MIDNIGHT MATINEE',photo:'PHOTO BOOTH',tokens:'TOKENS',party:'HAPPY BIRTHDAY'};

/** Isometric vector masters remain available if an illustrated asset fails. */
export function getArcadeFixture(kind: ArcadeKind, fw=ARCADE_ART_SIZES[kind][0], fh=ARCADE_ART_SIZES[kind][1]): PropSprite {
  const key=`arcade_${kind}_${fw}_${fh}`;
  const found=cache.get(key); if(found) return found;
  const top=kind==='wall'?110:kind==='stage'?140:kind==='prizes'||kind==='pizza'?130:92;
  const w=Math.ceil((fw+fh)*64+32), h=Math.ceil((fw+fh)*32+top+24);
  const ax=w/2, ay=top+(fw+fh)*16;
  const draw=()=>{
    const {c,ctx}=makeCanvas(w,h), P=projector(fh*64+16,top);
    const col=neon[kind]||'#ed8634';
    const box=(x:number,y:number,a:number,b:number,z:number,t:number,colors=[col,'#462842','#211c37'])=>isoBox(ctx,P,x,y,x+a,y+b,z,t,colors[0],colors[1],colors[2]);
    box(0,0,fw,fh,0,kind==='wall'?100:kind==='stage'?18:kind==='booth'?35:54);
    if(kind==='cabinet'||kind==='pinball') {
      box(.1,.2,fw-.2,fh*.45,54,86,['#263547','#101624','#081222']);
      poly(ctx,[P(.2,fh*.5,56),P(fw-.2,fh*.5,56),P(fw-.2,fh*.65,70),P(.2,fh*.65,70)],'#163e65',col,3);
      const [x,y]=P(fw/2,fh*.68,56);ctx.fillStyle='#ff343f';ctx.beginPath();ctx.arc(x,y,4,0,7);ctx.fill();
    } else if(kind==='skeeball') {
      for(let i=0;i<3;i++){box(.25+i*1.5,.25,1.3,fh-.5,20,25,['#974935','#4e2837','#321e36']);const [x,y]=P(1+i*1.5,.7,50);ctx.strokeStyle='#ffe876';ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(x,y,22,12,0,0,7);ctx.stroke();}
    } else if(kind==='airhockey'||kind==='foosball') {
      box(.2,.2,fw-.4,fh-.4,54,58,[kind==='airhockey'?'#234ec0':'#c58d37','#183775','#141c42']);
      const a=P(fw/2,.2,59),b=P(fw/2,fh-.2,59);ctx.strokeStyle='#f4e7bc';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();
    } else if(kind==='booth'||kind==='party') {
      box(.1,.1,fw-.2,.65,35,65,['#b73637','#691f32','#4a182b']);
      box(.5,1,fw-1,fh-1.4,38,43,['#ddb576','#73482f','#4a3026']);
    } else if(kind==='prizes'||kind==='pizza'||kind==='stage') {
      box(0,0,fw,.55,54,110,['#733d37','#47233d','#291e37']);
      for(let i=1;i<fw;i++){const [x,y]=P(i,.55,80);ctx.fillStyle=i%2?'#ffa34b':'#b45bdb';ctx.beginPath();ctx.arc(x,y,10,0,7);ctx.fill();}
    }
    if(kind!=='booth'&&kind!=='airhockey'&&kind!=='foosball'){
      const [x,y]=P(fw/2,fh,Math.min(top-8,85));ctx.font=`bold ${Math.min(22,fw*8)}px sans-serif`;ctx.textAlign='center';ctx.fillStyle=col;ctx.fillText(labels[kind]||'STARCADE',x,y);
    }
    return c;
  };
  const e=propAsset({key,file:`arcade/${key}.webp`,category:'prop',w,h,anchor:[ax,ay],footprint:[fw,fh],desc:`Starcade ${kind}`,prompt:`Isolated 2:1 dimetric Halloween 1990 arcade ${kind}; match the user's warm amber/neon reference; transparent background, no floor or shadow. Keep vector silhouette and footprint ${fw}x${fh}.`},draw);
  const out={img:e.img,w:e.w,h:e.h,ax:e.anchor[0],ay:e.anchor[1],fw,fh,lights:kind==='booth'?[]:[{x:fw/2,y:fh/2,r:4,color:neon[kind]||'#ff9a2a',i:.65}]};
  cache.set(key,out);return out;
}

export function getArcadeFloor(restaurant=false) {
  const material=asset({key:'arcade_carpet',file:'arcade/carpet.webp',category:'tile',w:256,h:256,desc:'Seamless neon confetti carpet',prompt:'Seamless overhead navy 1990 arcade carpet, tiny orange magenta cyan geometric confetti; flat even lighting, no props, no perspective.'},()=>{
    const {c,ctx}=makeCanvas(256,256);ctx.fillStyle='#182035';ctx.fillRect(0,0,256,256);
    for(let i=0;i<45;i++){ctx.strokeStyle=['#bd4c28','#ba317b','#286892'][i%3];ctx.lineWidth=3;const x=(i*71)%256,y=(i*47)%256;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+8,y+5);ctx.lineTo(x+3,y+11);ctx.stroke();}return c;
  });
  const {c,ctx}=makeCanvas(128,64);diamondPath(ctx);ctx.clip();
  if(restaurant){ctx.fillStyle='#422e35';ctx.fillRect(0,0,128,64);ctx.strokeStyle='#786051';ctx.beginPath();ctx.moveTo(0,32);ctx.lineTo(64,0);ctx.moveTo(64,64);ctx.lineTo(128,32);ctx.stroke();}
  else{ctx.transform(.25,.125,-.25,.125,64,0);ctx.drawImage(material,0,0,256,256);}return c;
}
