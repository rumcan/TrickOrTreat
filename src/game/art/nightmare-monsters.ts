import {makeCanvas,ellipse} from './draw';
import {sheetAsset} from '../assets';
import {NEW_MONSTERS,FINAL_MONSTER,FINAL_BOSS} from '../boss-roster';
import type {Sheet} from './characters';
export const NIGHTMARE_MONSTERS=[...NEW_MONSTERS,FINAL_MONSTER];
/** Exact frame/feet guides and procedural fallback; painted PNG sheets replace these through the manifest. */
export function nightmareSheet(type:string):Sheet{
 const m=NIGHTMARE_MONSTERS.find(m=>m.id===type);if(!m)throw Error(`Unknown nightmare monster ${type}`);
 const giant=type===FINAL_BOSS,fw=giant?480:m.boss?(m.shape==='whale'?320:192):80,fh=giant?400:m.boss?224:104,ax=fw/2,ay=fh-12,frames=4;
 const entry=sheetAsset({key:`enemy_${type}`,file:`monsters/nightmare/enemy_${type}.png`,category:'sheet',w:fw*frames,h:fh,frameW:fw,frameH:fh,frames,rows:['walk / menacing idle'],rowFrames:[4],anchor:[ax,ay],desc:m.name,prompt:m.look},()=>{
  const {c,ctx}=makeCanvas(fw*frames,fh);
  for(let f=0;f<frames;f++){
   ctx.save();ctx.beginPath();ctx.rect(f*fw,0,fw,fh);ctx.clip();ctx.translate(f*fw+ax,ay);
   const s=giant?2.2:m.boss?1.6:.65,phase=f*Math.PI/2;ctx.scale(s,s);ctx.lineWidth=2;ctx.strokeStyle='#172031';
   if(m.shape==='whale'){
    ellipse(ctx,0,-65+Math.sin(phase)*4,m.boss?75:48,29,m.color);
    ctx.fillStyle=m.color;ctx.beginPath();ctx.moveTo(-52,-66);ctx.lineTo(-88,-92+Math.sin(phase)*6);ctx.lineTo(-79,-49);ctx.lineTo(-55,-48);ctx.fill();
    ctx.beginPath();ctx.moveTo(14,-58);ctx.lineTo(-5,-23+Math.sin(phase)*6);ctx.lineTo(37,-43);ctx.fill();ellipse(ctx,46,-64,4,4,'#d39e39');ctx.restore();continue;
   }
   if(giant||m.shape==='insect'||m.shape==='plant')for(let i=0;i<(giant?12:6);i++){
    const side=i%2?1:-1,spread=30+(i>>1)*12;
    ctx.strokeStyle=m.color;ctx.lineWidth=giant?12:6;ctx.beginPath();ctx.moveTo(side*18,-48);ctx.bezierCurveTo(side*spread,-85+Math.sin(phase+i)*12,side*(spread+15),-25,side*(spread+30),-6+Math.sin(phase+i)*5);ctx.stroke();
   }
   ctx.strokeStyle='#172031';ctx.lineWidth=2;
   if(m.shape!=='specter'&&!giant)for(const side of[-1,1]){ctx.fillStyle=m.color;ctx.beginPath();ctx.roundRect(side*14-8,-38+Math.sin(phase)*side*4,15,36,5);ctx.fill();ctx.stroke();}
   ellipse(ctx,0,-65+Math.sin(phase)*2,m.shape==='round'?40:27,42,m.color);
   ellipse(ctx,0,-108+Math.sin(phase)*2,m.shape==='alien'?27:22,m.shape==='alien'?30:20,m.color);
   for(const side of[-1,1])ellipse(ctx,side*9,-109, m.shape==='alien'?7:4,m.shape==='alien'?10:4, m.shape==='robot'?'#ffb642':'#172031');
   if(!giant){ctx.strokeStyle=m.color;ctx.lineWidth=10;for(const side of[-1,1]){ctx.beginPath();ctx.moveTo(side*22,-83);ctx.lineTo(side*(38+Math.sin(phase)*3),-43);ctx.stroke();}}
   ctx.restore();
  }return c;
 });
 return {img:entry.img,fw,fh,scale:entry.scale,rows:1,rowFrames:entry.rowFrames,ax,ay};
}
