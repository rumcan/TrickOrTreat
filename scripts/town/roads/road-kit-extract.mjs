import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {TOWN_ART,artDir} from '../../lib/town-paths.mjs';
const out=path.join(artDir('road-kit'));
await fs.mkdir(out,{recursive:true});
const file='ground-quadrants/generated/1_4_1_2.png';
const {data,info}=await sharp(path.join(TOWN_ART,file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
// Bilinear rectification of an existing good straight. No image synthesis, no grass/soil generation.
const quad=[[1175,31],[1555,243],[1305,375],[925,163]],width=768,height=512;
const pixels=Buffer.alloc(width*height*4);
for(let y=0;y<height;y++)for(let x=0;x<width;x++){
 const u=(x+.5)/width,v=(y+.5)/height;
 const px=(1-v)*((1-u)*quad[0][0]+u*quad[1][0])+v*((1-u)*quad[3][0]+u*quad[2][0]);
 const py=(1-v)*((1-u)*quad[0][1]+u*quad[1][1])+v*((1-u)*quad[3][1]+u*quad[2][1]);
 const ix=Math.floor(px),iy=Math.floor(py),fx=px-ix,fy=py-iy;
 if(ix<0||iy<0||ix>=info.width-1||iy>=info.height-1)throw Error('Source sample outside native master');
 const a=(iy*info.width+ix)*4,b=a+4,c=a+info.width*4,d=c+4,o=(y*width+x)*4;
 for(let k=0;k<4;k++)pixels[o+k]=Math.round((data[a+k]*(1-fx)+data[b+k]*fx)*(1-fy)+(data[c+k]*(1-fx)+data[d+k]*fx)*fy);
}
const target=path.join(out,'road-band.png');
await sharp(pixels,{raw:{width,height,channels:4}}).png().toFile(target);
await fs.writeFile(path.join(out,'source.json'),JSON.stringify({source:file,quad,width,height,
 method:'Bilinear rectification of existing PNG pixels; no new/generated materials',scope:'Structured paving only'},null,2)+'\n');
console.log(target);
