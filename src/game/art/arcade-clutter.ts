import {asset,propAsset,type AssetSpec} from '../assets';
import {makeCanvas,projector,isoBox,poly} from './draw';
import {CLUTTER_SIZES,FLOOR_CLUTTER,PILE_CLUTTER,type ClutterKind} from '../arcade-clutter';
import type {PropSprite} from './props';
const cache=new Map<ClutterKind,PropSprite>();
export function getArcadeClutter(kind:ClutterKind):PropSprite{
 const hit=cache.get(kind);if(hit)return hit;
 const [fw,fh]=CLUTTER_SIZES[kind],floor=(FLOOR_CLUTTER as readonly string[]).includes(kind);
 const top=floor?0:kind==='bigfoot'||kind==='robot'?142:kind==='poster'?118:kind==='chair'?24:kind==='vhs'?65:kind==='plant'?75:kind==='gumball'?72:108;
 const w=floor?128:Math.ceil((fw+fh)*64+32),h=floor?64:Math.ceil((fw+fh)*32+top+24);
 const anchor:[number,number]=floor?[64,32]:[w/2,top+(fw+fh)*16];
 const gen=()=>{
  const {c,ctx}=makeCanvas(w,h),P=projector(floor?64:fh*64+16,top);
  if(floor){
   const color='#e7be74';
   // Every fragment is projected in world coordinates, not a screen-space icon.
   if(kind==='popcorn')for(let i=0;i<5;i++){const x=.34+(i*17%27)/100,y=.32+(i*31%31)/100;poly(ctx,[P(x,y,0),P(x+.07,y,0),P(x+.07,y+.06,0),P(x,y+.06,0)],color);}
   if(kind==='pizza_box'){
    isoBox(ctx,P,.35,.35,.62,.62,0,3,'#b99570','#745644','#503a35');
    poly(ctx,[P(.35,.35,3),P(.62,.35,3),P(.62,.26,11),P(.35,.26,11)],'#b99570','#745644');
    poly(ctx,[P(.41,.42,3),P(.55,.42,3),P(.48,.56,3)],'#d59d4d');
   }
   if(kind==='soda'){
    const [cx,cy]=P(.51,.48,3);ctx.fillStyle='#b34043';ctx.beginPath();ctx.ellipse(cx,cy,10,5,Math.atan(.5),0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#d6c49b';ctx.beginPath();ctx.ellipse(cx+8,cy+4,4,5,Math.atan(.5),0,Math.PI*2);ctx.fill();
    const tip=P(.7,.46,3);ctx.strokeStyle='#e2c6a3';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(cx+9,cy+4);ctx.lineTo(...tip);ctx.stroke();
    poly(ctx,[P(.57,.6,0),P(.66,.58,0),P(.72,.68,0),P(.61,.72,0)],'#493028');
   }
   if(kind==='tickets')for(let i=0;i<3;i++){
    const x=.31+i*.085,y=.34+i*.06;
    poly(ctx,[P(x,y,0),P(x+.21,y,0),P(x+.21,y+.055,0),P(x,y+.055,0)],'#e68456','#9f563e',.5);
   }
   if((PILE_CLUTTER as readonly string[]).includes(kind)){
    // A large, shallow pile built in the exact floor projection. It is an overlay,
    // so characters always render above it and its footprint never blocks a step.
    for(let i=0;i<24;i++){
     const x=.12+(i*37%61)/100,y=.14+((i*i*17+i*13)%59)/100;
     if(kind==='paper_pile'||kind==='party_pile'){
      const colors=kind==='paper_pile'?['#d9b389','#bf745f','#9b998c']:['#c77a45','#aa544c','#a59472'];
      poly(ctx,[P(x,y,1),P(x+.15,y,1),P(x+.15,y+.1,1),P(x,y+.1,1)],colors[i%3],'#58423c',.5);
      if(kind==='party_pile'&&i%5===0){const [px,py]=P(x+.05,y+.05,3);ctx.fillStyle='#c6ac82';ctx.beginPath();ctx.ellipse(px,py,6,3,0,0,7);ctx.fill();}
     }else{
      const colors=kind==='arcade_junk'?['#524555','#343b50','#806349']:['#a35545','#b38752','#b59b62'];
      isoBox(ctx,P,x,y,x+.13,y+.1,0,i%4===0?5:2,colors[i%3],'#54403b','#2a2735');
      if(kind==='snack_pile'&&i%4===0){const [px,py]=P(x+.06,y+.05,5);ctx.fillStyle='#e2bf71';ctx.beginPath();ctx.ellipse(px,py,5,2.5,0,0,7);ctx.fill();}
      if(kind==='arcade_junk'&&i%6===0){poly(ctx,[P(x,y,2),P(x+.2,y+.025,2),P(x+.2,y+.055,2),P(x,y+.03,2)],'#b38951');}
     }
    }
   }
   if(kind==='popcorn')isoBox(ctx,P,.4,.35,.57,.5,0,6,'#c34d3c','#913929','#57292d');
  }else{
   if(!['plant','chair','bigfoot','robot','gumball','jukebox','vhs'].includes(kind))isoBox(ctx,P,0,0,fw,fh,0,top-15,'#be7950','#603949','#29243d');
   if(kind==='bigfoot'||kind==='robot'){
    isoBox(ctx,P,0,0,fw,fh,0,10,'#ae7950','#653f35','#392b32');
    isoBox(ctx,P,.04,.04,fw-.04,fh-.04,10,top-18,'#9bdad066','#527e8866','#31465f88');
    const [x,y]=P(fw/2,fh/2,66);ctx.fillStyle=kind==='bigfoot'?'#80512d':'#a6b4be';ctx.beginPath();ctx.ellipse(x,y,13,32,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x,y-38,11,0,7);ctx.fill();
   }else if(kind==='gumball'){isoBox(ctx,P,0,0,fw,fh,0,10,'#af4643','#672c36','#342132');isoBox(ctx,P,fw*.35,fh*.35,fw*.65,fh*.65,10,40,'#ba6050','#763643','#382b39');const [x,y]=P(fw/2,fh/2,50);ctx.fillStyle='#88bbc388';ctx.strokeStyle='#e3c895';ctx.beginPath();ctx.arc(x,y,13,0,7);ctx.fill();ctx.stroke();}
   else if(kind==='plant'){isoBox(ctx,P,0,0,fw,fh,0,18,'#95694c','#62412f','#3b2830');const [x,y]=P(fw/2,fh/2,43);ctx.fillStyle='#527a43';for(let i=0;i<5;i++){ctx.beginPath();ctx.ellipse(x+(i-2)*7,y+(i%2)*6,8,19,(i-2)/3,0,Math.PI*2);ctx.fill();}}
   else if(kind==='chair'){isoBox(ctx,P,0,0,fw,fh*.45,0,7,'#b94947','#6d303c','#381f31');isoBox(ctx,P,0,fh*.45,fw,fh,0,18,'#b94947','#6d303c','#381f31');}
   else if(kind==='vhs'){isoBox(ctx,P,0,0,fw,fh,0,34,'#956f4b','#634339','#352736');isoBox(ctx,P,fw*.08,.05,fw*.52,fh*.75,34,61,'#526170','#263343','#172233');}
   else if(kind==='jukebox'){
    const arch=(y:number)=>{const points:[number,number][]=[P(0,y,0),P(fw,y,0),P(fw,y,68)];for(let i=0;i<=12;i++){const a=i*Math.PI/12;points.push(P(fw/2+Math.cos(a)*fw/2,y,68+Math.sin(a)*25));}return points;};
    poly(ctx,[P(fw,0,0),P(fw,fh,0),P(fw,fh,68),P(fw,0,68)],'#342539');poly(ctx,arch(0),'#8b483e','#d5aa76');poly(ctx,arch(fh),'#b16243','#dab981',2);
   }
  }return c;
 };
 const spec:AssetSpec={key:`arcade_v2_clutter_${kind}`,file:`arcade/v2/arcade_v2_clutter_${kind}.webp`,category:floor?'overlay':'prop',w,h,anchor,footprint:[fw,fh],desc:`Starcade ${kind}`,prompt:`Preserve this exact projected vector ${kind}, its size and ground anchor; warm amber light, navy shadows.`};
 const a=floor?{img:asset(spec,gen),w,h,anchor}:propAsset(spec,gen);
 const out={img:a.img,w:a.w,h:a.h,ax:a.anchor[0],ay:a.anchor[1],fw,fh,lights:[]};cache.set(kind,out);return out;
}
