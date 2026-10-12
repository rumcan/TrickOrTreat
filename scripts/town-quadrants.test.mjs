import test from 'node:test';
import assert from 'node:assert/strict';
import {splitBounds} from './town-quadrants.mjs';
test('odd-sized source has no missing or duplicated pixels at quadrant seams',()=>{
  const walk=(b,d)=>d?splitBounds(b).flatMap(c=>walk(c,d-1)):[b];
  const leaves=walk({left:0,top:0,width:1672,height:941},3);
  assert.equal(leaves.length,64);
  const counts=new Uint8Array(1672*941);
  for(const b of leaves)for(let y=b.top;y<b.top+b.height;y++)for(let x=b.left;x<b.left+b.width;x++)counts[y*1672+x]++;
  assert.ok(counts.every(n=>n===1));
});
test('quadrant naming order is TL, TR, BL, BR',()=>{
  assert.deepEqual(splitBounds({left:10,top:20,width:8,height:6}),[
    {left:10,top:20,width:4,height:3},{left:14,top:20,width:4,height:3},
    {left:10,top:23,width:4,height:3},{left:14,top:23,width:4,height:3},
  ]);
});
