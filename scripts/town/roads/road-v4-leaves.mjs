/** Cut individual leaf sprites (connected alpha components) out of the existing transparent leaf scatters.
 *  Reuses generated art; nothing new is painted. Output: output/road-autotile-v4/sources/leaves/*.png + leaves.json */
import fs from 'node:fs/promises';
import path from 'node:path';
import {load,save,blank,put} from '../../lib/road-v4-warp.mjs';
import {ROOT} from '../../lib/town-paths.mjs';
const out=path.join(ROOT,'output/road-autotile-v4/sources/leaves');
await fs.mkdir(out,{recursive:true});
const sources=[
 {id:'tiny',file:'output/terrain-materials/scatter-tiny-leaves.png',thr:110,soft:40},
 {id:'orange',file:'output/terrain-materials/decal-06-orange-leaf-scatter.png',thr:110,soft:40},
 {id:'yellow',file:'output/terrain-materials/decal-08-yellow-leaf-scatter.png',thr:110,soft:40},
];
const leaves=[];
for(const s of sources){
 const img=await load(path.join(ROOT,s.file)),W=img.width,H=img.height,A=i=>img.data[i*4+3];
 const lab=new Int32Array(W*H).fill(-1);let n=0;const comps=[];
 for(let i=0;i<W*H;i++){if(lab[i]>=0||A(i)<s.thr)continue;const st=[i];lab[i]=n;let x0=W,y0=H,x1=0,y1=0,area=0;
  while(st.length){const j=st.pop(),x=j%W,y=(j/W)|0;area++;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
   for(const k of [j-1,j+1,j-W,j+W]){if(k<0||k>=W*H||lab[k]>=0||A(k)<s.thr)continue;if(Math.abs((k%W)-x)>1)continue;lab[k]=n;st.push(k);}}
  comps.push({x0,y0,x1,y1,area,id:n});n++;}
 let kept=0;
 for(const c of comps){
  const w=c.x1-c.x0+1,h=c.y1-c.y0+1;
  if(c.area<45||c.area>9000||w>140||h>140||w<6||h<6)continue;
  if(c.area/(w*h)<.25)continue; // thin slivers / stems only
  const pad=3,cw=w+2*pad,ch=h+2*pad,leaf=blank(cw,ch);let warmth=0,cnt=0;
  for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){const sx=c.x0-pad+x,sy=c.y0-pad+y;if(sx<0||sy<0||sx>=W||sy>=H)continue;const i=sy*W+sx;
   // keep this component plus its soft antialiased rim, drop neighbours and haze
   let own=lab[i]===c.id;if(!own&&lab[i]<0){for(const k of [i-1,i+1,i-W,i+W,i-W-1,i-W+1,i+W-1,i+W+1])if(k>=0&&k<W*H&&lab[k]===c.id){own=true;break;}}
   if(!own)continue;const a=A(i);if(a<s.soft)continue;const o=i*4;put(leaf,x,y,[img.data[o],img.data[o+1],img.data[o+2],a]);
   if(a>150){warmth+=img.data[o]-img.data[o+2];cnt++;}}
  if(cnt<20||warmth/cnt<40)continue; // leaves are warm; skip grey haze blobs
  const file=`${s.id}-${kept}.png`;await save(leaf,path.join(out,file));
  leaves.push({file,source:s.id,width:cw,height:ch,area:c.area});kept++;
 }
 console.log(s.id,'components',comps.length,'kept',kept);
}
leaves.sort((a,b)=>a.area-b.area);
await fs.writeFile(path.join(out,'../leaves.json'),JSON.stringify(leaves,null,1));
const q=p=>leaves[Math.floor(p*(leaves.length-1))].area;
console.log('total',leaves.length,'area quantiles',[.1,.25,.5,.75,.9,.99].map(q));
