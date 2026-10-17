import test from 'node:test';
import assert from 'node:assert/strict';
import {ROAD,PORTS,project,unproject,maskFor,kind,surface,socket,tilesFor} from '../../lib/road-autotile.mjs';
test('fixed camera is 2:1; projection round trips',()=>{
 assert.equal(ROAD.width,ROAD.height*2);
 for(let x=0;x<=16;x+=.25)for(let y=0;y<=16;y+=.25){const p=project(x,y),q=unproject(p.x,p.y);assert.ok(Math.abs(q.x-x)<1e-8);assert.ok(Math.abs(q.y-y)<1e-8);}
 const p=project(0,0),q=project(16,0);assert.equal((q.y-p.y)/(q.x-p.x),.5);
});
test('all connection masks have the expected topology',()=>{
 const counts={isolated:0,end:0,straight:0,curve:0,tee:0,cross:0};for(let m=0;m<16;m++)counts[kind(m)]++;
 assert.deepEqual(counts,{isolated:1,end:4,straight:2,curve:4,tee:4,cross:1});
});
test('every open port has asphalt and both pavements at common widths',()=>{
 for(let m=1;m<16;m++)for(const p of PORTS){if(!(m&p.bit))continue;
  for(const offset of [-4.4,0,4.4]){
   let x=p.x,y=p.y;if(p.name==='N'||p.name==='S'){x+=offset;y+=p.name==='N'?.01:-.01;}else{y+=offset;x+=p.name==='W'?.01:-.01;}
   assert.equal(surface(m,x,y).type,offset===0?'asphalt':'sidewalk',`mask${m} ${p.name} ${offset}`);assert.ok(socket(m,x,y));
  }
 }
});
test('junctions never place a sidewalk across an open arm',()=>{
 for(const m of [7,11,13,14,15]){assert.equal(surface(m,8,8).type,'asphalt');for(const p of PORTS.filter(p=>m&p.bit))for(let t=0;t<=1;t+=.025)assert.equal(surface(m,8+(p.x-8)*t,8+(p.y-8)*t).type,'asphalt');}
});
test('neighbour masks are reciprocal and removal updates adjacent pieces',()=>{
 const cells=new Set(['0,0','1,0','2,0','1,1']);assert.equal(maskFor(cells,1,0),14);assert.equal(maskFor(cells,0,0),2);
 for(const t of tilesFor(cells))for(const p of PORTS.filter(p=>t.mask&p.bit))assert.ok(maskFor(cells,t.x+p.dx,t.y+p.dy)&p.opposite);
 cells.delete('1,1');assert.equal(maskFor(cells,1,0),10);
});
test('connected curves have common boundary tangents and socket phase',()=>{
 for(const m of [3,6,12,9])for(const p of PORTS.filter(p=>m&p.bit)){
  const x=p.x+(p.name==='W'?.01:p.name==='E'?-.01:0),y=p.y+(p.name==='N'?.01:p.name==='S'?-.01:0),v=surface(m,x,y),s=socket(m,x,y);assert.ok(v.distance<.001);assert.ok(s);assert.ok(Math.abs(Math.abs(v.tx)+Math.abs(v.ty)-1)<.005);
 }
});
