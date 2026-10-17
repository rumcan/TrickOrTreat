/** Measure the painted v3 straight's silhouette: fit its four edges and corners. */
import sharp from 'sharp';
const file=process.argv[2];
const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const W=info.width,H=info.height,a=(x,y)=>data[(y*W+x)*4+3];
// boundary points: for each row, first and last opaque pixel; for each column likewise
const pts=[];
for(let y=0;y<H;y++){let f=-1,l=-1;for(let x=0;x<W;x++)if(a(x,y)>127){if(f<0)f=x;l=x;}if(f>=0){pts.push([f,y]);pts.push([l,y]);}}
let minx=[1e9,0],maxx=[-1,0],miny=[0,1e9],maxy=[0,-1];
for(const p of pts){if(p[0]<minx[0])minx=p;if(p[0]>maxx[0])maxx=p;if(p[1]<miny[1])miny=p;if(p[1]>maxy[1])maxy=p;}
console.log(JSON.stringify({minx,miny,maxx,maxy}));
// classify boundary points to 4 edges by which corner pair they lie between, then least squares lines
const C=[minx,miny,maxx,maxy];
function fit(P){let n=P.length,sx=0,sy=0;for(const p of P){sx+=p[0];sy+=p[1];}const mx=sx/n,my=sy/n;let sxx=0,sxy=0,syy=0;for(const p of P){const dx=p[0]-mx,dy=p[1]-my;sxx+=dx*dx;sxy+=dx*dy;syy+=dy*dy;}const ang=.5*Math.atan2(2*sxy,sxx-syy);return {mx,my,dx:Math.cos(ang),dy:Math.sin(ang),n};}
const edges=[];
for(let i=0;i<4;i++){const A=C[i],B=C[(i+1)%4];const P=pts.filter(p=>{const t=((p[0]-A[0])*(B[0]-A[0])+(p[1]-A[1])*(B[1]-A[1]))/((B[0]-A[0])**2+(B[1]-A[1])**2);if(t<.1||t>.9)return false;const d=Math.abs((p[0]-A[0])*(B[1]-A[1])-(p[1]-A[1])*(B[0]-A[0]))/Math.hypot(B[0]-A[0],B[1]-A[1]);return d<6;});edges.push(fit(P));}
function inter(e,f){const det=e.dx*(-f.dy)-e.dy*(-f.dx);const t=((f.mx-e.mx)*(-f.dy)-(f.my-e.my)*(-f.dx))/det;return [e.mx+t*e.dx,e.my+t*e.dy];}
const corners=[];for(let i=0;i<4;i++)corners.push(inter(edges[(i+3)%4],edges[i]).map(v=>+v.toFixed(2)));
console.log(JSON.stringify({edges:edges.map(e=>({slope:+(e.dy/e.dx).toFixed(4),deg:+(Math.atan2(e.dy,e.dx)*180/Math.PI).toFixed(2),n:e.n})),corners}));
