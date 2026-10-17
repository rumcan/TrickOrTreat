/** Homography + sampling helpers for registering painted AI masters to exact ground geometry. */
import sharp from 'sharp';
export async function load(file){const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});return {data,width:info.width,height:info.height};}
export async function save(img,file){await sharp(img.data,{raw:{width:img.width,height:img.height,channels:4}}).png().toFile(file);}
export function blank(width,height){return {width,height,data:Buffer.alloc(width*height*4)};}
/** Solve 3x3 homography mapping src[i] -> dst[i] (4 point pairs). Returns h such that dst ~ H*src. */
export function homography(src,dst){
 const A=[],b=[];
 for(let i=0;i<4;i++){const [x,y]=src[i],[u,v]=dst[i];A.push([x,y,1,0,0,0,-u*x,-u*y]);b.push(u);A.push([0,0,0,x,y,1,-v*x,-v*y]);b.push(v);}
 const n=8;for(let c=0;c<n;c++){let p=c;for(let r=c+1;r<n;r++)if(Math.abs(A[r][c])>Math.abs(A[p][c]))p=r;[A[c],A[p]]=[A[p],A[c]];[b[c],b[p]]=[b[p],b[c]];
  for(let r=0;r<n;r++){if(r===c)continue;const f=A[r][c]/A[c][c];for(let k=c;k<n;k++)A[r][k]-=f*A[c][k];b[r]-=f*b[c];}}
 const h=b.map((v,i)=>v/A[i][i]);h.push(1);return h;
}
export function apply(h,x,y){const w=h[6]*x+h[7]*y+h[8];return [(h[0]*x+h[1]*y+h[2])/w,(h[3]*x+h[4]*y+h[5])/w];}
/** Bilinear RGBA sample with premultiplied alpha; returns [r,g,b,a] (straight alpha). */
export function sample(img,x,y){
 x-=.5;y-=.5;const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;let r=0,g=0,b=0,a=0;
 for(const [dx,dy,w] of [[0,0,(1-fx)*(1-fy)],[1,0,fx*(1-fy)],[0,1,(1-fx)*fy],[1,1,fx*fy]]){
  const X=ix+dx,Y=iy+dy;if(X<0||Y<0||X>=img.width||Y>=img.height||w===0)continue;const o=(Y*img.width+X)*4,al=img.data[o+3]/255*w;
  r+=img.data[o]*al;g+=img.data[o+1]*al;b+=img.data[o+2]*al;a+=al;}
 return a>1e-6?[r/a,g/a,b/a,a*255]:[0,0,0,0];
}
/** Supersampled area sample: average n x n bilinear taps over a footprint (dx,dy vectors in source px). */
export function sampleArea(img,x,y,ux,uy,vx,vy,n=2){let r=0,g=0,b=0,a=0;
 for(let i=0;i<n;i++)for(let j=0;j<n;j++){const s=(i+.5)/n-.5,t=(j+.5)/n-.5;const c=sample(img,x+s*ux+t*vx,y+s*uy+t*vy),w=c[3]/255;r+=c[0]*w;g+=c[1]*w;b+=c[2]*w;a+=w;}
 const N=n*n;return a>1e-6?[r/a,g/a,b/a,a/N*255]:[0,0,0,0];}
export function put(img,x,y,c){const o=(y*img.width+x)*4;img.data[o]=Math.round(c[0]);img.data[o+1]=Math.round(c[1]);img.data[o+2]=Math.round(c[2]);img.data[o+3]=Math.round(c[3]);}
