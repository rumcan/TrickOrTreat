import assert from 'node:assert/strict';
import {scaledSelection} from './app/selection-scale.js';
const items=[{uid:1,x:0,y:2,scale:1,flip:true},{uid:2,x:4,y:6,scale:2}];
const original=structuredClone(items),r=scaledSelection(items,1.5);
assert.deepEqual(items,original);assert.deepEqual(r.items.map(s=>[s.x,s.y,s.scale]),[[-1,1,1.5],[5,7,3]]);
assert.equal(r.items[0].flip,true);
assert.deepEqual(scaledSelection(items,1.5,{movePositions:false}).items.map(s=>[s.x,s.y,s.scale]),[[0,2,1.5],[4,6,3]]);
assert.equal(scaledSelection(items,10).factor,4);assert.deepEqual(scaledSelection(items,10).items.map(s=>s.scale),[4,8]);
assert.equal(scaledSelection(items,.01).factor,.05);
// a sprite with a zero/missing size does not block the group; it is treated as 1 and repaired
assert.deepEqual(scaledSelection([{x:0,y:0,scale:0},{x:2,y:0,scale:2}],.9).items.map(s=>+s.scale.toFixed(2)),[.9,1.8]);
for(const value of [0,-1,NaN,Infinity,1])assert.equal(scaledSelection(items,value),null);
assert.equal(scaledSelection([],2),null);
assert.deepEqual(scaledSelection([{x:3,y:4}],2).items,[{x:3,y:4,scale:2}]);
console.log('PASS selection scaling: group centre, in-place mode, relative sizes, shared limits, invalid/no-op factors, default scale, no input mutation');
