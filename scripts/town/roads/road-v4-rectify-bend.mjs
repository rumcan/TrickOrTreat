/** Rectify the approved bend with the SAME camera (affine) as the straight, so both share one ground scale. */
import path from 'node:path';
import {load,save,blank,sample,put} from '../../lib/road-v4-warp.mjs';
import {ROOT} from '../../lib/town-paths.mjs';
const out=path.join(ROOT,'output/road-autotile-v4');
const src=await load(path.resolve(out,'../road-autotile-v3/native/painted-3.png'));
const eu=[0.6887,0.3914],ev=[-0.7047,0.3976]; // screen px per rectified px, from the straight
const det=eu[0]*ev[1]-eu[1]*ev[0],inv=(sx,sy)=>[(sx*ev[1]-sy*ev[0])/det,(-sx*eu[1]+sy*eu[0])/det];
// ground bbox from the screen bbox
let mnu=1e9,mxu=-1e9,mnv=1e9,mxv=-1e9;for(let y=0;y<src.height;y+=2)for(let x=0;x<src.width;x+=2){if(src.data[(y*src.width+x)*4+3]<128)continue;const [u,v]=inv(x,y);mnu=Math.min(mnu,u);mxu=Math.max(mxu,u);mnv=Math.min(mnv,v);mxv=Math.max(mxv,v);}
const W=Math.ceil(mxu-mnu)+8,H=Math.ceil(mxv-mnv)+8,img=blank(W,H);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const u=x+mnu-4,v=y+mnv-4;put(img,x,y,sample(src,u*eu[0]+v*ev[0],u*eu[1]+v*ev[1]));}
await save(img,path.join(out,'sources/bend-rectified-raw.png'));
console.log(JSON.stringify({W,H,originU:mnu-4,originV:mnv-4}));
