import {sheetAsset} from '../assets';
import {makeCanvas,poly} from './draw';
import type {Sheet} from './characters';
const cache=new Map<number,Sheet>();
/** Four restrained work/reading frames, without a gun or costume. */
export function arcadeStaffSheet(hero:number):Sheet{
 const hit=cache.get(hero);if(hit)return hit;
 const fw=96,fh=128,ax=48,ay=112,maya=hero===3;
 const entry=sheetAsset({key:`arcade_staff_${maya?'maya':'leo'}`,file:`arcade/staff/${maya?'maya':'leo'}.webp`,category:'sheet',w:384,h:128,frameW:fw,frameH:fh,frames:4,rows:['working'],anchor:[ax,ay],desc:maya?'Maya repairing a walkie-talkie':'Leo reading a monster comic',prompt:'Four steady anchored isometric idle frames; keep the existing kid identity and warm arcade lighting.'},()=>{
  const {c,ctx}=makeCanvas(384,128);
  for(let frame=0;frame<4;frame++){
   ctx.save();ctx.translate(frame*fw,0);const bob=[0,.5,0,-.5][frame],coat=maya?'#b18339':'#347779';
   ctx.fillStyle='#3c3533';ctx.fillRect(38,104,11,8);ctx.fillRect(51,102,11,8);
   ctx.fillStyle='#313748';ctx.fillRect(40,86,9,21);ctx.fillRect(52,85,9,21);
   ctx.fillStyle=coat;ctx.beginPath();ctx.roundRect(35,59+bob,30,32,6);ctx.fill();
   ctx.fillStyle='#b98759';ctx.beginPath();ctx.ellipse(49,48+bob,13,16,0,0,7);ctx.fill();
   ctx.fillStyle='#302923';ctx.beginPath();ctx.ellipse(49,38+bob,14,9,.1,0,7);ctx.fill();
   if(maya){ctx.beginPath();ctx.ellipse(35,53+bob,4,15,-.2,0,7);ctx.fill();}
   ctx.strokeStyle=coat;ctx.lineWidth=9;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(37,66+bob);ctx.lineTo(35,78+bob);ctx.lineTo(45,80+bob);ctx.moveTo(63,65+bob);ctx.lineTo(66,76+bob);ctx.lineTo(57,78+bob);ctx.stroke();
   if(maya){ctx.fillStyle='#434450';ctx.fillRect(43,73+bob,16,12);ctx.strokeStyle='#b9a56d';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(55,73+bob);ctx.lineTo(58+frame%2,66+bob);ctx.stroke();}
   else{poly(ctx,[[36,77+bob],[49,73+bob],[62,77+bob],[62,87+bob],[49,83+bob],[36,87+bob]],'#b98b64','#553d37',1);ctx.strokeStyle='#654d48';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(49,74+bob);ctx.lineTo(49,83+bob);ctx.stroke();}
   ctx.fillStyle='#c29976';ctx.beginPath();ctx.arc(43,80+bob,3,0,7);ctx.arc(59,79+bob+frame%2,3,0,7);ctx.fill();ctx.restore();
  }return c;
 });
 const out:Sheet={img:entry.img,fw,fh,scale:entry.scale,rows:1,rowFrames:[4],ax,ay};cache.set(hero,out);return out;
}
