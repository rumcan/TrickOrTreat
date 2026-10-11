import { asset, propAsset } from '../assets';
import { makeCanvas, projector, isoBox, poly, diamondPath } from './draw';
import type { PropSprite } from './props';
import type { ArcadeKind } from '../arcade-layout';

export const ARCADE_ART_KINDS: ArcadeKind[] = ['cabinet','cabinet_retro','cabinet_racer','cabinet_back','cabinet_back_alt','pinball','pinball_back','skeeball','airhockey','foosball','prizes','pizza','booth','stage','photo','tokens','party','wall'];
export const ARCADE_ART_SIZES: Record<ArcadeKind,[number,number]> = {
  cabinet:[.55,.75], cabinet_retro:[.55,.75], cabinet_racer:[.55,.75], cabinet_back:[.55,.75], cabinet_back_alt:[.55,.75], pinball:[.65,1.15], pinball_back:[.65,1.15], skeeball:[2.1,2.7], airhockey:[2.1,1.2], foosball:[1.5,1],
  prizes:[5,1.2], pizza:[6,1.4], booth:[2.4,1.3], stage:[5,2.4], photo:[.8,.7], tokens:[.55,.6], party:[3,1.8], wall:[8,.15],
};
const cache = new Map<string,PropSprite>();
const neon: Record<string,string> = {cabinet:'#19bfff',cabinet_retro:'#baf456',cabinet_racer:'#ff516c',cabinet_back:'#19bfff',cabinet_back_alt:'#baf456',pinball:'#ff8b23',pinball_back:'#e867ce',skeeball:'#ff572e',prizes:'#f253db',pizza:'#ff792c',photo:'#e354df',tokens:'#ffcf56'};
const labels: Record<string,string> = {cabinet:'STAR RAID',pinball:'NIGHT RUN',skeeball:'SKEE-BALL',prizes:'PRIZES',pizza:'PIZZA',stage:'MIDNIGHT MATINEE',photo:'PHOTO BOOTH',tokens:'TOKENS',party:'HAPPY BIRTHDAY'};

/** Isometric vector masters remain available if an illustrated asset fails. */
export function getArcadeFixture(kind: ArcadeKind, fw=ARCADE_ART_SIZES[kind][0], fh=ARCADE_ART_SIZES[kind][1]): PropSprite {
  const key=`arcade_v2_${kind}_${fw}_${fh}`;
  const found=cache.get(key); if(found) return found;
  const top=kind==='wall'?154:kind==='stage'?150:kind==='prizes'||kind==='pizza'?156:kind==='booth'?70:kind==='airhockey'||kind==='foosball'?58:120;
  const w=Math.ceil((fw+fh)*64+32), h=Math.ceil((fw+fh)*32+top+24);
  const ax=(fw+fh)*32+16, ay=top+(fw+fh)*16;
  const draw=()=>{
    const {c,ctx}=makeCanvas(w,h), P=projector(fh*64+16,top);
    const col=neon[kind]||'#ed8634';
    const cabinet=kind.startsWith('cabinet'), pinball=kind.startsWith('pinball'), back=kind.includes('_back');
    const box=(x:number,y:number,a:number,b:number,z:number,t:number,colors=[col,'#462842','#211c37'])=>isoBox(ctx,P,x,y,x+a,y+b,z,t,colors[0],colors[1],colors[2]);
    if(!pinball&&kind!=='airhockey'&&kind!=='foosball')box(0,0,fw,fh,0,kind==='wall'?142:kind==='photo'?108:kind==='tokens'?80:kind==='stage'?18:kind==='booth'?24:44);
    if(cabinet||pinball) {
      if(cabinet&&back){
        poly(ctx,[P(fw,0,0),P(fw,fh,0),P(fw,fh,104),P(fw,fh*.72,104),P(fw,fh*.72,96),P(fw,fh*.4,61),P(fw,0,53)],'#162238',col,1);
        poly(ctx,[P(0,fh*.72,104),P(fw,fh*.72,104),P(fw,fh,104),P(0,fh,104)],'#344453',col,1);
        poly(ctx,[P(0,fh,0),P(fw,fh,0),P(fw,fh,104),P(0,fh,104)],kind==='cabinet_back_alt'?'#3c4530':'#243246',col,1);
        for(const z of [28,34,40,74,80,86]){
          const a=P(.06,fh,z),b=P(fw-.06,fh,z);ctx.strokeStyle='#090e18';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();
        }
        poly(ctx,[P(.14,fh,48),P(fw-.14,fh,48),P(fw-.14,fh,64),P(.14,fh,64)],'#ab9270');
      }else if(cabinet){
        box(0,0,fw,fh*.28,44,104,['#263547','#101624','#081222']);
        poly(ctx,[P(fw,0,0),P(fw,fh,0),P(fw,fh,53),P(fw,fh*.6,61),P(fw,fh*.28,96),P(fw,fh*.28,104),P(fw,0,104)],'#1c273c',col,1);
        poly(ctx,[P(0,0,104),P(fw,0,104),P(fw,fh*.28,104),P(0,fh*.28,104)],'#293e55',col,1);
        poly(ctx,[P(0,fh*.28,96),P(fw,fh*.28,96),P(fw,fh*.6,61),P(0,fh*.6,61)],'#163e65',col,2);
        poly(ctx,[P(0,fh*.6,61),P(fw,fh*.6,61),P(fw,fh,53),P(0,fh,53)],'#29374c',col,2);
      }else if(back){
        for(const x of [.06,fw-.12])for(const y of [.06,fh-.12])box(x,y,.06,.06,0,38);
        poly(ctx,[P(0,0,39),P(fw,0,39),P(fw,fh,51),P(0,fh,51)],'#614775',col,2);
        poly(ctx,[P(fw,0,39),P(fw,fh,51),P(fw,fh,44),P(fw,0,32)],'#31273e',col,1);
        box(0,fh-.12,fw,.12,51,96,['#96578f','#38223d','#231d31']);
        for(const z of [66,72,78]){const a=P(.08,fh,z),b=P(fw-.08,fh,z);ctx.strokeStyle='#0e1322';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();}
      }else{
        for(const x of [.06,fw-.12])for(const y of [.06,fh-.12])box(x,y,.06,.06,0,38);
        poly(ctx,[P(0,0,51),P(fw,0,51),P(fw,fh,39),P(0,fh,39)],'#163e65',col,2);
        poly(ctx,[P(fw,0,51),P(fw,fh,39),P(fw,fh,32),P(fw,0,44)],'#293746',col,1);
        box(0,0,fw,.12,51,96,['#bf7536','#4c2a3e','#231d31']);
      }
      if(!back){const [x,y]=P(fw/2,fh*.8,cabinet?56:43);ctx.fillStyle='#ff343f';ctx.beginPath();ctx.arc(x,y,2.5,0,7);ctx.fill();}
    } else if(kind==='skeeball') {
      for(let i=0;i<3;i++){const x=i*fw/3,a=fw/3-.05;box(x,0,a,.4,0,72,['#974935','#4e2837','#321e36']);poly(ctx,[P(x,.4,37),P(x+a,.4,37),P(x+a,fh,20),P(x,fh,20)],'#a36a44',col,2);const [cx,cy]=P(x+a/2,.2,54);ctx.strokeStyle='#ffe876';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(cx,cy,10,5,0,0,7);ctx.stroke();}
    } else if(kind==='airhockey'||kind==='foosball') {
      for(const x of [.06,fw-.12])for(const y of [.06,fh-.12])box(x,y,.06,.06,0,38);
      box(0,0,fw,fh,38,44,[kind==='airhockey'?'#234e89':'#5a7948','#183755','#141c32']);
      const a=P(fw/2,0,45),b=P(fw/2,fh,45);ctx.strokeStyle='#f4e7bc';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();
    } else if(kind==='booth'||kind==='party') {
      box(0,0,fw,.25,24,58,['#b73637','#691f32','#4a182b']);
      box(fw*.15,.55,fw*.7,fh-.65,32,38,['#ddb576','#73482f','#4a3026']);
    } else if(kind==='prizes'||kind==='pizza'||kind==='stage') {
      box(0,0,fw,.22,44,138,['#733d37','#47233d','#291e37']);
      if(kind==='stage')for(let i=0;i<3;i++){const [x,y]=P((i+.5)*fw/3,.7,70);ctx.fillStyle=['#b48654','#956aaf','#d49643'][i];ctx.beginPath();ctx.ellipse(x,y,15,27,0,0,7);ctx.fill();ctx.beginPath();ctx.arc(x,y-35,13,0,7);ctx.fill();}
      else for(let z=64;z<134;z+=25)box(.12,.23,fw-.24,.15,z,z+4,['#b08556','#6b4538','#3b2b33']);
    }
    if(kind!=='booth'&&kind!=='airhockey'&&kind!=='foosball'){
      if(fw>=2){const [x,y]=P(fw/2,fh,Math.min(top-8,85));ctx.font=`bold ${Math.min(18,fw*8)}px sans-serif`;ctx.textAlign='center';ctx.fillStyle=col;ctx.fillText(labels[kind]||'STARCADE',x,y);}
    }
    return c;
  };
  const e=propAsset({key,file:`arcade/${key}.webp`,category:'prop',w,h,anchor:[ax,ay],footprint:[fw,fh],desc:`Starcade ${kind}`,prompt:`Isolated 2:1 dimetric Halloween 1990 arcade ${kind}; match the user's warm amber/neon reference; transparent background, no floor or shadow. Keep vector silhouette and footprint ${fw}x${fh}.`},draw);
  const out={img:e.img,w:e.w,h:e.h,ax:e.anchor[0],ay:e.anchor[1],fw,fh,lights:kind==='booth'||kind==='wall'?[]:[{x:fw/2,y:fh/2,r:2,color:neon[kind]||'#ff9a2a',i:.3}]};
  cache.set(key,out);return out;
}

/** A walk-over doorway marker, projected with the same 64/32 ground basis. */
export function getArcadeExitMat(){
  return asset({key:'arcade_v2_exit_mat',file:'arcade/v2/exit_mat.webp',category:'overlay',w:192,h:96,footprint:[2,1],desc:'Green EXIT welcome mat',prompt:'Exact 2:1 dimetric dark forest-green woven doorway mat, cream EXIT lettering and a bright green arrow toward the lower-left edge. Transparent exterior, no furniture or shadows.'},()=>{
    const {c,ctx}=makeCanvas(192,96),P=projector(64,0);
    poly(ctx,[P(0,0,0),P(2,0,0),P(2,1,0),P(0,1,0)],'#153d31','#92ef94',3);
    poly(ctx,[P(.12,.12,0),P(1.88,.12,0),P(1.88,.88,0),P(.12,.88,0)],'#205a40','#e1cc8f',2);
    ctx.save();ctx.transform(1,.5,-1,.5,64,0);ctx.fillStyle='#fff6cf';ctx.font='900 25px sans-serif';ctx.textAlign='center';ctx.fillText('EXIT',64,26);
    ctx.fillStyle='#9df69a';ctx.beginPath();ctx.moveTo(61,34);ctx.lineTo(67,34);ctx.lineTo(67,43);ctx.lineTo(77,43);ctx.lineTo(64,55);ctx.lineTo(51,43);ctx.lineTo(61,43);ctx.closePath();ctx.fill();ctx.restore();return c;
  });
}

export function getArcadeFloor(restaurant=false) {
  const material=asset({key:'arcade_v2_carpet',file:'arcade/v2/carpet.webp',category:'tile',w:256,h:256,desc:'Quiet navy confetti carpet',prompt:'Paint this exact overhead vector carpet: sparse muted orange magenta cyan confetti, navy backing, flat even lighting, no props or perspective.'},()=>{
    const {c,ctx}=makeCanvas(256,256);ctx.fillStyle='#182035';ctx.fillRect(0,0,256,256);
    for(let i=0;i<12;i++){ctx.strokeStyle=['#9d6544','#754264','#345d73'][i%3];ctx.lineWidth=3;const x=15+(i*71)%220,y=15+(i*47)%220;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+12,y+7);ctx.lineTo(x+4,y+17);ctx.stroke();}return c;
  });
  const {c,ctx}=makeCanvas(128,64);diamondPath(ctx);ctx.clip();
  if(restaurant){ctx.fillStyle='#422e35';ctx.fillRect(0,0,128,64);ctx.strokeStyle='#786051';ctx.beginPath();ctx.moveTo(0,32);ctx.lineTo(64,0);ctx.moveTo(64,64);ctx.lineTo(128,32);ctx.stroke();}
  else{ctx.transform(.25,.125,-.25,.125,64,0);ctx.drawImage(material,0,0,256,256);}return c;
}
