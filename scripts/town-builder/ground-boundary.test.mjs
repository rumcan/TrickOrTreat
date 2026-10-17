import test from 'node:test';
import assert from 'node:assert/strict';
import {groundBounds,groundCorners,groundContains,groundGrid,groundFrame} from './app/ground-boundary.js';
import {gridRange,boundedRoads} from '../lib/town-builder-rules.mjs';
import {groundState,groundMatches} from './app/ground-state.js';
test('terrain expands to the original full editor grid, preserving its negative cells and scale',()=>{
 const plan={nx:14,ny:12,groundShape:'isometric'},old=gridRange(14,12),next=groundGrid(plan);
 for(const key of ['cx0','cy0','cx1','cy1'])assert.equal(next[key],old[key]);
 for(const road of ['-5,5','17,7','0,0','13,5'])assert.ok(boundedRoads([road],14,12,'isometric').has(road));
 const frame=groundFrame(plan),legacy=groundFrame({nx:14,ny:12});assert.ok(frame.W>legacy.W);assert.ok(frame.H>legacy.H);
 const project=(x,y)=>[frame.OX+(x-y)*32,frame.OY+(x+y)*16];
 for(const p of groundCorners(plan)){const [x,y]=project(...p);assert.ok(x>=0&&x<frame.W&&y>=0&&y<frame.H);}
 const a=project(0,0),b=project(20,0);assert.equal(b[0]-a[0],640);assert.equal(b[1]-a[1],320);
 assert.equal(next.cx1-next.cx0+1,28);assert.equal(next.cy1-next.cy0+1,28);
});
test('ground edge and road grid have identical world extents',()=>{
 const p={nx:14,ny:12,groundShape:'isometric'},g=groundGrid(p),b=groundBounds(p);
 assert.equal(b.x0,g.cx0*20);assert.equal(b.y0,g.cy0*20);assert.equal(b.x1,(g.cx1+1)*20);assert.equal(b.y1,(g.cy1+1)*20);
 assert.ok(groundContains(p,b.x0+.1,b.y0+.1));assert.ok(!groundContains(p,b.x0-.1,b.y0));assert.ok(!groundContains(p,b.x1,b.y1));
});
test('existing rectangular towns keep the exact frame and ground compatibility',()=>{
 const p={nx:14,ny:12,roads:['2,5'],lots:[],paving:[],reflections:[],lines:{}};
 assert.deepEqual(groundFrame(p),{W:16760,H:8640,OX:7740,OY:260});assert.equal(groundCorners(p),null);
 assert.ok(groundMatches(p,groundState(p)));assert.ok(!groundMatches({...p,groundShape:'isometric'},groundState(p)));
});
