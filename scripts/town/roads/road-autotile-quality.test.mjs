import test from 'node:test';
import assert from 'node:assert/strict';
import {ROAD,PORTS,kind,mod} from '../../lib/road-autotile.mjs';
import {QUALITY,field,pavingUV,relight,sourceOver,variantFor,lightFrame,leafUV} from '../../lib/road-autotile-quality.mjs';
function point(p,along,cross){return{x:p.x+(p.name==='W'?along:p.name==='E'?-along:cross),y:p.y+(p.name==='N'?along:p.name==='S'?-along:cross)};}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('every topology has a true 2m straight socket, including both sides of every bend',()=>{
 for(let mask=1;mask<16;mask++)for(const p of PORTS.filter(p=>mask&p.bit))for(const along of [.001,.5,1,1.9])for(const cross of [-4.9,-4,0,4,4.9]){
  const q=point(p,along,cross),v=field(mask,q.x,q.y);near(v.distance,Math.abs(cross));assert.equal(v.type,Math.abs(cross)<3.25?'asphalt':'sidewalk');
 }
});
test('ALL opposite port pairs share geometry and slab phase at the actual boundary',()=>{
 let comparisons=0;
 for(const p of PORTS)for(let a=1;a<16;a++)for(let b=1;b<16;b++){
  if(!(a&p.bit)||!(b&p.opposite))continue;const opposite=PORTS.find(v=>v.bit===p.opposite);
  for(let cross=-4.9;cross<=4.9;cross+=.07){
   const qa=point(p,0,cross),qb=point(opposite,0,cross),va=field(a,qa.x,qa.y),vb=field(b,qb.x,qb.y);
   near(va.roadDistance,vb.roadDistance);assert.equal(va.type,vb.type);
   if(va.type==='sidewalk'){const ua=pavingUV(a,qa.x,qa.y,va),ub=pavingUV(b,qb.x,qb.y,vb);near(mod(ua.along,1),mod(ub.along,1));near(ua.cross,ub.cross);}comparisons++;
  }
 }
 assert.ok(comparisons>35000);
});
test('rounded junction returns never put pavement across an open arm',()=>{
 for(const m of [7,11,13,14,15])for(const p of PORTS.filter(p=>m&p.bit))for(let t=0;t<=1;t+=.01){const v=field(m,8+(p.x-8)*t,8+(p.y-8)*t);assert.equal(v.type,'asphalt');}
 const centre=8+3.25+2,q=centre-2/Math.SQRT2;near(field(15,q,q).roadDistance,0);assert.equal(field(15,11.5,11.5).type,'asphalt');assert.equal(field(15,12,12).type,'sidewalk');
});

test('junction distance is continuous where the rounded return meets the straight-arm rectangle',()=>{
 // The old quadrant lower-bound test made distance jump here, painting false
 // diagonal/triangular curbs across the intersection even though it stayed asphalt.
 for(const m of [7,11,13,14,15])for(const [sx,sy,bits]of [[-1,-1,9],[1,-1,3],[1,1,6],[-1,1,12]]){
  if((m&bits)!==bits)continue;
  for(const b of [3.3,3.5,4,4.5,5]){
   const a=3.25,eps=1e-6;
   for(const swapped of [false,true]){
    const p=swapped?{x:8+sx*b,y:8+sy*a}:{x:8+sx*a,y:8+sy*b};
    const dx=swapped?0:sx*eps,dy=swapped?sy*eps:0;
    const before=field(m,p.x-dx,p.y-dy).roadDistance,after=field(m,p.x+dx,p.y+dy).roadDistance;
    assert.ok(Math.abs(after-before)<3e-6,`${m}: artificial curb jump at ${JSON.stringify(p)}`);
   }
  }
 }
});
test('light decals have orthonormal ground frames, anchored to real curbs',()=>{
 for(let m=0;m<16;m++){const f=lightFrame(m);if(kind(m)==='end'||kind(m)==='isolated'){assert.equal(f,null);continue;}
  near(Math.hypot(f.tx,f.ty),1);near(Math.hypot(f.nx,f.ny),1);near(f.tx*f.nx+f.ty*f.ny,0);
  const v=field(m,f.x-f.nx*ROAD.asphaltM/2,f.y-f.ny*ROAD.asphaltM/2);near(v.roadDistance,0);
 }
});
test('light shades CURRENT material; it cannot paste a different concrete image',()=>{
 const a=[36,52,73],b=[204,168,140];assert.deepEqual(relight(a,0,'asphalt'),a);assert.deepEqual(relight(b,0,'sidewalk'),b);
 assert.ok(relight(a,.7,'asphalt')[0]>a[0]*3);assert.ok(relight(b,.7,'sidewalk')[0]>b[0]);assert.notDeepEqual(relight(a,.7,'asphalt'),relight(b,.7,'asphalt'));
 assert.deepEqual(sourceOver(a,[190,145,57],0),a);assert.deepEqual(sourceOver(a,[190,145,57],1),[190,145,57]);
});
test('marking/texture periods are exact divisors of module size; bake is supersampled',()=>{
 near(mod(ROAD.cellM,QUALITY.dashPeriodM),0);near(mod(ROAD.cellM,QUALITY.textureRepeatM),0);near(mod(ROAD.cellM,QUALITY.concreteRepeatM),0);assert.equal(QUALITY.supersample,2);
});
test('editing an unrelated cell cannot shift another section’s lighting or debris variant',()=>{
 const before=variantFor(4,2,10);for(let x=0;x<20;x++)for(let y=0;y<20;y++)variantFor(x,y,15);
 assert.deepEqual(variantFor(4,2,10),before);
});
test('curved pavement uses one radial joint phase across both slab rows',()=>{
 for(const theta of [.2,.4,.8,1.2]){
  const phases=[];for(const d of [.5,1.5]){const r=6+3.25+d,x=14-r*Math.cos(theta),y=2+r*Math.sin(theta),v=field(3,x,y);assert.equal(v.part,'arc');phases.push(pavingUV(3,x,y,v).along);}
  near(phases[0],phases[1]);
 }
});
test('junction fan joints meet the REAL incoming straight slab phases in every quadrant',()=>{
 const centre=3.25+2,d=.4,r=2-d;
 for(const [sx,sy]of [[-1,-1],[1,-1],[1,1],[-1,1]])for(const theta of [1e-7,Math.PI/2-1e-7]){
  const x=8+sx*(centre-r*Math.cos(theta)),y=8+sy*(centre-r*Math.sin(theta)),v=field(15,x,y);assert.equal(v.part,'return');const uv=pavingUV(15,x,y,v),expected=theta<.1?8+sy*centre:8+sx*centre;
  assert.ok(Math.abs(mod(uv.along-expected+.5,1)-.5)<1e-6);
 }
});
test('individual leaves retain ground aspect ratio at any rotation, never use road-strip UVs',()=>{
 for(let a=0;a<Math.PI*2;a+=.2){const length=.18,aspect=.8,c=Math.cos(a),s=Math.sin(a),u=leafUV(c*length/2,s*length/2,length,aspect,a),v=leafUV(-s*length*aspect/2,c*length*aspect/2,length,aspect,a);near(u.u,1);near(u.v,.5);near(v.u,.5);near(v.v,1);}
});
