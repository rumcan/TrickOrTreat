/** Maple Falls road builder v4: exact ground geometry for a 4-edge road kit.
 *  Cells are 20 m. Ports sit at edge midpoints. Every curb, sidewalk edge and slab joint is defined in ground
 *  metres, so neighbouring cells meet exactly. Painted materials are sampled by the renderer, not drawn here. */
export const K=Object.freeze({cell:20,half:3.25,walk:2.05,radius:7.5,stem:2.5,slab:2.5});
export const BIT=Object.freeze({N:1,E:2,S:4,W:8});
const CORNERS={ // shrunk corner C and the two directions pointing INTO the corner block
 NE:{C:[20-K.stem,K.stem],e1:[1,0],e2:[0,-1]},
 SE:{C:[20-K.stem,20-K.stem],e1:[1,0],e2:[0,1]},
 SW:{C:[K.stem,20-K.stem],e1:[-1,0],e2:[0,1]},
 NW:{C:[K.stem,K.stem],e1:[-1,0],e2:[0,-1]},
};
const rIn=K.radius-K.half,rOut=K.radius+K.half;
function corner(name,inner){const c=CORNERS[name],r=inner?rIn:rOut,rRef=inner?r-K.walk/2:r+K.walk/2,len=2*K.stem+Math.PI/2*rRef;
 return {type:'quarter',name,inner,C:c.C,e1:c.e1,e2:c.e2,r,rRef,len,slabs:Math.max(1,Math.round(len/K.slab))};}
const line=(nx,ny,c)=>({type:'line',n:[nx,ny],c}); // s = n.p - c, positive on the sidewalk side
const SIDE={N:line(0,-1,-(10-K.half)),S:line(0,1,10+K.half),W:line(-1,0,-(10-K.half)),E:line(1,0,10+K.half)};
export function kindOf(mask){const n=[1,2,4,8].filter(b=>mask&b).length;if(n===2)return mask===5||mask===10?'straight':'bend';return ['none','end','','tee','cross'][n];}
const BULB={c:[10,11.2],r:6,armEnd:11.2,fillet:1.8,yj:5}; // cul-de-sac bulb, canonical port N
/** Curb runs for each mask. Isolated cells return []; single ports get closed turning bulbs. */
export const RUNS=Array.from({length:16},(_,m)=>{
 const k=kindOf(m);
 if(m===5)return [SIDE.W,SIDE.E];
 if(m===10)return [SIDE.N,SIDE.S];
 if(k==='bend'){const nm={3:'NE',6:'SE',12:'SW',9:'NW'}[m];return [corner(nm,true),corner(nm,false)];}
 if(k==='tee'){const miss={7:'W',11:'S',13:'E',14:'N'}[m],cs={7:['NE','SE'],11:['NE','NW'],13:['NW','SW'],14:['SE','SW']}[m];return [SIDE[miss],...cs.map(c=>corner(c,true))];}
 if(k==='cross')return ['NE','SE','SW','NW'].map(c=>corner(c,true));
 if(k==='end')return [bulb({1:0,2:1,4:2,8:3}[m])];
 return [];
});
/** Cul-de-sac: the arm from the port widens into a turning bulb. One curb run goes from the port's left curb,
 *  round the bulb and back to its right curb, with a slab joint at the port on both sides. Canonical port = N;
 *  `turns` rotates it in the GROUND plane (never a rotated picture). */
function bulb(turns){
 const rRef=BULB.r+K.walk/2,phL=Math.atan2(BULB.yj-BULB.c[1],(10-K.half)-BULB.c[0]),phR=Math.atan2(BULB.yj-BULB.c[1],(10+K.half)-BULB.c[0]);
 const span=(phL-phR+2*Math.PI)%(2*Math.PI),len=2*BULB.yj+span*rRef;
 return {type:'bulb',turns,rRef,phL,span,len,slabs:Math.max(1,Math.round(len/K.slab))};}
const rot=(x,y,n)=>{for(let i=0;i<n;i++)[x,y]=[20-y,x];return [x,y];};
function bulbSDF(x,y){ // canonical frame, negative on the asphalt
 // The stem is open through its port. A closed rectangle makes a false transverse curb at the tile seam.
 const bx=Math.abs(x-10)-K.half,by=y-BULB.armEnd,dBox=Math.hypot(Math.max(bx,0),Math.max(by,0))+Math.min(Math.max(bx,by),0);
 const dDisc=Math.hypot(x-BULB.c[0],y-BULB.c[1])-BULB.r,k=BULB.fillet,h=Math.max(k-Math.abs(dBox-dDisc),0)/k;
 return Math.min(dBox,dDisc)-h*h*k/4;}
function evalBulb(run,x,y,out){
 const [cx,cy]=rot(x,y,(4-run.turns)%4),d=bulbSDF(cx,cy),e=.01,gx=(bulbSDF(cx+e,cy)-bulbSDF(cx-e,cy))/(2*e),gy=(bulbSDF(cx,cy+e)-bulbSDF(cx,cy-e))/(2*e),gl=Math.hypot(gx,gy)||1;
 let along;
 if(cy<BULB.yj)along=cx<10?cy:run.len-cy;
 else{const ph=Math.atan2(cy-BULB.c[1],cx-BULB.c[0]),psi=((run.phL-ph)%(2*Math.PI)+2*Math.PI)%(2*Math.PI);along=BULB.yj+Math.min(psi,run.span)*run.rRef;}
 // normal pointing INTO the road, rotated back to the cell frame
 let nx=-gx/gl,ny=-gy/gl;for(let i=0;i<run.turns;i++)[nx,ny]=[-ny,nx];
 out.s=d;out.nx=nx;out.ny=ny;out.along=along;out.slab=along/run.len*run.slabs;out.slabLen=run.len/run.slabs;out.tx=-ny;out.ty=nx;return out;}
/** Curb point + road normal at 'along' metres on a bulb run (cell-local), for leaf and lamp placement. */
export function bulbPoint(run,along){
 let x,y;
 if(along<BULB.yj){x=10-K.half;y=along;}
 else if(along>run.len-BULB.yj){x=10+K.half;y=run.len-along;}
 else{const ph=run.phL-(along-BULB.yj)/run.rRef;x=BULB.c[0]+BULB.r*Math.cos(ph);y=BULB.c[1]+BULB.r*Math.sin(ph);}
 const out={};const [rx,ry]=rot(x,y,run.turns);evalBulb(run,rx,ry,out);
 // step back onto the exact curb line
 return [rx-out.nx*out.s*-1,ry-out.ny*out.s*-1,out.nx,out.ny];}
/** Evaluate one run at cell-local point (x,y). Returns signed sidewalk distance s (+ = sidewalk side),
 *  the unit normal pointing INTO the road, and along (m from the run start) / slab coordinate. */
export function evalRun(run,x,y,wx,wy,out){
 if(run.type==='bulb')return evalBulb(run,x,y,out);
 if(run.type==='line'){
  out.s=run.n[0]*x+run.n[1]*y-run.c;out.nx=-run.n[0];out.ny=-run.n[1];
  const along=run.n[0]!==0?wy:wx;out.along=along;out.slab=along/K.slab;out.slabLen=K.slab;out.tx=-out.ny;out.ty=out.nx;return out;}
 const px=x-run.C[0],py=y-run.C[1],a1=px*run.e1[0]+py*run.e1[1],a2=px*run.e2[0]+py*run.e2[1],qx=-a1,qy=-a2;
 const d=Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)-run.r;
 let gx,gy,along;
 if(qx>0&&qy>0){const l=Math.hypot(px,py)||1;gx=px/l;gy=py/l;along=K.stem+Math.atan2(qy,qx)*run.rRef;}
 else if(qy<=0&&(qx>0||qx>qy)){gx=-run.e1[0];gy=-run.e1[1];along=K.stem-a2;}
 else{gx=-run.e2[0];gy=-run.e2[1];along=K.stem+Math.PI/2*run.rRef+a1;}
 if(run.inner){out.s=-d;out.nx=gx;out.ny=gy;}else{out.s=d;out.nx=-gx;out.ny=-gy;}
 out.along=along;out.slab=along/run.len*run.slabs;out.slabLen=run.len/run.slabs;out.tx=-out.ny;out.ty=out.nx;return out;
}
/** Centre-line distance and arc length for dash markings. Junction cells carry no dashes. */
export function centre(mask,x,y,out){
 if(mask===10){out.d=y-10;out.s=x;out.len=20;return out;}
 if(mask===5){out.d=x-10;out.s=y;out.len=20;return out;}
 if(kindOf(mask)==='bend'){const run=corner({3:'NE',6:'SE',12:'SW',9:'NW'}[mask],true),px=x-run.C[0],py=y-run.C[1],a1=px*run.e1[0]+py*run.e1[1],a2=px*run.e2[0]+py*run.e2[1],qx=-a1,qy=-a2,R=K.radius,len=2*K.stem+Math.PI/2*R;
  out.len=len;
  if(qx>0&&qy>0){out.d=Math.hypot(qx,qy)-R;out.s=K.stem+Math.atan2(qy,qx)*R;}
  else if(qy<=0){out.d=qx-R;out.s=K.stem-a2;}else{out.d=qy-R;out.s=K.stem+Math.PI/2*R+a1;}
  return out;}
 out.d=1e9;return out;
}
export function maskAt(cells,cx,cy){let m=0;if(cells.has(`${cx},${cy-1}`))m|=1;if(cells.has(`${cx+1},${cy}`))m|=2;if(cells.has(`${cx},${cy+1}`))m|=4;if(cells.has(`${cx-1},${cy}`))m|=8;return m;}
export function hash(...v){let h=2166136261;for(const n of v){h^=(n|0)+0x9e3779b9+(h<<6)+(h>>>2);h=Math.imul(h,16777619);}h^=h>>>13;h=Math.imul(h,0x5bd1e995);h^=h>>>15;return (h>>>0)/4294967296;}
