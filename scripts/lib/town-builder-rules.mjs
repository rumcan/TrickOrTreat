/** Pure authoring rules; projected by the painter, never used as replacement art. */
import {groundGrid} from '../town-builder/app/ground-boundary.js';
export const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
/** Every 20 m cell that shows on the baked picture of an nx x ny town. The picture is the rectangle around the nx x ny
 *  diamond (same size formula as buildScene/bake), so its corners reach far past the original grid; roads, lots and
 *  paving may go anywhere on it. Zoom-independent. Returns {cx0,cy0,cx1,cy1,has(cx,cy)}. */
export function gridRange(nx,ny,shape){
 if(shape==='isometric')return groundGrid({nx,ny});
 const S=32,M=60,W=(nx+ny)*20*S+2*M,H=(nx+ny)*10*S+2*M+200,OX=ny*20*S+M,OY=M+200;
 const toWorld=(sx,sy)=>{const a=(sx-OX)/S,b=(sy-OY)/(S/2);return [(a+b)/2,(b-a)/2];};
 const inPic=(X,Y)=>{const sx=OX+(X-Y)*S,sy=OY+(X+Y)*S/2;return sx>=0&&sx<=W&&sy>=0&&sy<=H;};
 const cs=[[0,0],[W,0],[0,H],[W,H]].map(([x,y])=>toWorld(x,y));
 const cx0=Math.floor(Math.min(...cs.map(c=>c[0]))/20),cx1=Math.floor(Math.max(...cs.map(c=>c[0]))/20),cy0=Math.floor(Math.min(...cs.map(c=>c[1]))/20),cy1=Math.floor(Math.max(...cs.map(c=>c[1]))/20);
 const on=new Set();
 for(let cy=cy0;cy<=cy1;cy++)for(let cx=cx0;cx<=cx1;cx++){let hit=false;for(let i=0;i<=4&&!hit;i++)for(let j=0;j<=4&&!hit;j++)hit=inPic(cx*20+i*5,cy*20+j*5);if(hit)on.add(cx+','+cy);}
 return {cx0,cy0,cx1,cy1,has:(cx,cy)=>on.has(cx+','+cy)};
}
export function boundedRoads(roads,nx,ny,shape){const G=gridRange(nx,ny,shape);return new Set(roads.filter(s=>{const a=s.split(',').map(Number);return a.length===2&&a.every(Number.isInteger)&&G.has(a[0],a[1]);}));}
export function drivewayBlend(d,X,Y){
 const v=d.side==='N'?Y-d.y0:d.side==='S'?d.y1-Y:d.side==='W'?X-d.x0:d.x1-X;
 const len=d.side==='N'||d.side==='S'?d.y1-d.y0:d.x1-d.x0;
 return smooth(.2,Math.max(.8,len-.1),v);
}
export function junctionMarks(mask,x,y){
 const n=[1,2,4,8].filter(b=>mask&b).length;if(n<3)return {yellow:0,white:0};
 let yellow=0,white=0;
 for(const [bit,along,cross,incoming]of [[1,y,x-10,-1],[2,20-x,y-10,-1],[4,20-y,x-10,1],[8,x,y-10,1]]){
  if(!(mask&bit)||along<0||along>6)continue;
  // Long white bars follow vehicle travel, distributed across the carriageway.
  const phase=((cross+3.05)% .72+.72)%.72;
  const zebra=smooth(.025,.065,phase)*smooth(.43,.39,phase)*smooth(2.15,2.25,along)*smooth(4.25,4.15,along)*smooth(3.08,3.02,Math.abs(cross));
  const stop=smooth(.105,.075,Math.abs(along-4.85))*smooth(.1,.2,cross*incoming)*smooth(3.08,3.02,Math.abs(cross));
  const line=smooth(.095,.065,Math.abs(cross))*smooth(1.7,1.55,along);
  yellow=Math.max(yellow,line);white=Math.max(white,zebra,stop);
 }
 return {yellow,white};
}
export function parkingColour(c,mean){return c.map((v,k)=>(mean[k]+(v-mean[k])*.7)*.70);}
