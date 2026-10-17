/** Rectify the painted straight into a top-down ground strip (u along road, v across). Review aid. */
import path from 'node:path';
import {load,save,blank,homography,apply,sample,put} from '../../lib/road-v4-warp.mjs';
import {ROOT} from '../../lib/town-paths.mjs';
const out=path.join(ROOT,'output/road-autotile-v4');
const src=await load(path.resolve(out,'../road-autotile-v3/native/painted-10-sidewalk-light.png'));
// Fitted silhouette corners: T(top/north start), R(north end), B(south end), L(south start)
const T=[451.46,317.61],R=[1219.95,745.11],B=[788.99,988.31],L=[36.82,551.46];
const Nu=+process.argv[2]||1104,Nv=+process.argv[3]||600;
const h=homography([[0,0],[Nu,0],[Nu,Nv],[0,Nv]],[T,R,B,L]);
const img=blank(Nu,Nv);
for(let y=0;y<Nv;y++)for(let x=0;x<Nu;x++){const [sx,sy]=apply(h,x+.5,y+.5);put(img,x,y,sample(src,sx,sy));}
await save(img,path.join(out,'sources/straight-rectified-raw.png'));
console.log(JSON.stringify({Nu,Nv,h}));
