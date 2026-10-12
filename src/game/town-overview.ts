import {HW,HH,MAP_W,MAP_H,isoX,isoY} from './config';
import type {GameMap,PropInst} from './map';
import {rawCanvas} from './art/draw';
import {orderWorldItems,type WorldDrawItem} from './render-order';

export interface TownOverviewOptions {
  /** 1 = native world pixels; 0.5 = lighter overview. */
  scale?:number;
  hideBarriers?:boolean;
}
interface SceneryItem extends WorldDrawItem {prop:PropInst}

/** Full painted scene, not a stitched minimap or an AI recreation. No HUD/player
 * fading/visibility mask. This is read-only: live gates and collision are untouched. */
export function townOverview(map:GameMap,options:TownOverviewOptions={}){
  const scale=options.scale??1;
  if(!Number.isFinite(scale)||scale<.1||scale>1)throw Error('Overview scale must be between 0.1 and 1');
  const hidden=new Set<number>();
  if(options.hideBarriers!==false){
    for(const barrier of map.barriers)if(barrier.prop)hidden.add(barrier.prop.id);
    for(const gate of map.gates)for(const id of gate.propIds)hidden.add(id);
  }
  const visible=map.props.filter(p=>!p.removed&&!hidden.has(p.id));
  let x0=-MAP_H*HW,y0=0,x1=MAP_W*HW,y1=(MAP_W+MAP_H)*HH;
  const items:SceneryItem[]=[],bigs:SceneryItem[]=[];
  for(const p of visible){
    const x=p.x0+p.fw/2,y=p.y0+p.fh/2;
    const sx=isoX(x,y)-p.sp.ax,sy=isoY(x,y)-p.sp.ay;
    const item:SceneryItem={key:x+y,x,y,prop:p,bx0:sx,by0:sy,bx1:sx+p.sp.w,by1:sy+p.sp.h};
    x0=Math.min(x0,item.bx0);x1=Math.max(x1,item.bx1);
    y0=Math.min(y0,item.by0);y1=Math.max(y1,item.by1);
    if(p.big){item.big=p;bigs.push(item);}else items.push(item);
  }
  const margin=96,left=Math.floor(x0-margin),top=Math.floor(y0-margin);
  const width=Math.ceil((x1+margin-left)*scale),height=Math.ceil((y1+margin-top)*scale);
  if(width>16384||height>16384||width*height>100_000_000)throw Error('Overview exceeds canvas budget; use a smaller scale');
  const canvas=rawCanvas(width,height),ctx=canvas.getContext('2d')!;
  ctx.fillStyle='#17212c';ctx.fillRect(0,0,width,height);
  ctx.setTransform(scale,0,0,scale,-left*scale,-top*scale);
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  // Finish ALL ground before decals: no neighbouring tile can cover an overlay.
  for(let y=0;y<MAP_H;y++)for(let x=0;x<MAP_W;x++)ctx.drawImage(map.tiles[y*MAP_W+x],isoX(x,y)-HW,isoY(x,y));
  for(let y=0;y<MAP_H;y++)for(let x=0;x<MAP_W;x++)for(const image of map.overlays[y*MAP_W+x])ctx.drawImage(image,isoX(x,y)-HW,isoY(x,y));
  ctx.fillStyle='rgba(4,4,18,.38)';
  for(const p of visible){
    if(p.big){
      const s=1.1*p.shadow,x=p.x0,y=p.y0,w=p.fw,h=p.fh;
      const pts=[[x,y],[x+w,y],[x+w+s,y+s*.15],[x+w+s,y+h+s*.15],[x+s,y+h+s*.15],[x,y+h]];
      ctx.beginPath();pts.forEach(([a,b],i)=>i?ctx.lineTo(isoX(a,b),isoY(a,b)):ctx.moveTo(isoX(a,b),isoY(a,b)));ctx.fill();
    }else if(p.shadow>0){
      ctx.beginPath();ctx.ellipse(isoX(p.x0+p.fw/2,p.y0+p.fh/2)+6,isoY(p.x0+p.fw/2,p.y0+p.fh/2)+2,p.shadow*HW,p.shadow*HH,0,0,Math.PI*2);ctx.fill();
    }
  }
  for(const it of orderWorldItems(items,bigs)){
    const s=it.prop.sp;ctx.drawImage(s.img,it.bx0,it.by0,s.w,s.h);
  }
  return {canvas,meta:{width,height,scale,origin:[left,top],tiles:MAP_W*MAP_H,propsDrawn:visible.length,hiddenBarrierProps:hidden.size,hideBarriers:options.hideBarriers!==false,fog:false}};
}
