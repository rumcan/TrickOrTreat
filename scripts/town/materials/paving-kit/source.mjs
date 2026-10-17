/** The repaired paved town layer (output/town-paved-layer/town-paved-repaired-v2.png) as a ground-space sampler.
 *  Uses the same registration as scripts/town-paved-pack.mjs (Codex worktree): game tile (wx,wy) on the 94x94 town grid ->
 *  reference-image pixel (trace homography) -> paved-layer pixel. One game tile = 2 m. */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {ROOT,artDir} from '../../../lib/town-paths.mjs';
export {ROOT};
const n=94;
function homography(src,dst){const a=[],b=[];
 for(let i=0;i<4;i++){const[x,y]=src[i],[u,v]=dst[i];a.push([x,y,1,0,0,0,-x*u,-y*u]);b.push(u);a.push([0,0,0,x,y,1,-x*v,-y*v]);b.push(v);}
 for(let c=0;c<8;c++){let p=c;for(let r=c+1;r<8;r++)if(Math.abs(a[r][c])>Math.abs(a[p][c]))p=r;[a[c],a[p]]=[a[p],a[c]];[b[c],b[p]]=[b[p],b[c]];
  for(let r=0;r<8;r++)if(r!==c){const f=a[r][c]/a[c][c];for(let k=c;k<8;k++)a[r][k]-=f*a[c][k];b[r]-=f*b[c];}}
 const h=b.map((v,i)=>v/a[i][i]);return(x,y)=>{const w=h[6]*x+h[7]*y+1;return[(h[0]*x+h[1]*y+h[2])/w,(h[3]*x+h[4]*y+h[5])/w];};}
export async function pavedSource(file=path.join(ROOT,'output/town-paved-layer/town-paved-repaired-v2.png')){
 const trace=JSON.parse(await fs.readFile(path.join(artDir('static/ground/trace/trace.json')),'utf8')),inset=trace.inset??0;
 const ref=await sharp(path.join(artDir('static/ground/trace/town-reference.png'))).metadata();
 const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const pixel=homography([[0,0],[n,0],[n,n],[0,n]],trace.corners),sx=info.width/ref.width,sy=info.height/ref.height;
 /** ground metres (X,Y) -> paved-layer pixel */
 const toPx=(X,Y)=>{const wx=X/2,wy=Y/2,[u,v]=pixel((wx-inset)*n/(n-2*inset),(wy-inset)*n/(n-2*inset));return [u*sx,v*sy];};
 /** premultiplied bilinear sample at ground metres -> [r,g,b,a] */
 const sample=(X,Y,o)=>{const [x,y]=toPx(X,Y),fx0=x-.5,fy0=y-.5,ix=Math.floor(fx0),iy=Math.floor(fy0),fx=fx0-ix,fy=fy0-iy;o[0]=o[1]=o[2]=o[3]=0;
  if(ix<0||iy<0||ix+1>=info.width||iy+1>=info.height)return o;let a=0,r=0,g=0,b=0;
  for(const [dx,dy,w] of [[0,0,(1-fx)*(1-fy)],[1,0,fx*(1-fy)],[0,1,(1-fx)*fy],[1,1,fx*fy]]){const i=((iy+dy)*info.width+ix+dx)*4,al=data[i+3]/255*w;a+=al;r+=data[i]*al;g+=data[i+1]*al;b+=data[i+2]*al;}
  if(a>1e-6){o[0]=r/a;o[1]=g/a;o[2]=b/a;o[3]=a*255;}return o;};
 // source pixels per ground metre near the middle (for honest resolution reporting)
 const [a0,b0]=toPx(94,94),[a1,b1]=toPx(95,94),[c1,d1]=toPx(94,95),pxPerM=(Math.hypot(a1-a0,b1-b0)+Math.hypot(c1-a0,d1-b0))/2;
 return {sample,toPx,pxPerM,width:info.width,height:info.height,groundM:n*2};}
