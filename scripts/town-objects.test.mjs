import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {inspectObject} from './town-objects.mjs';
async function fixture(size,visible){
  const object=await sharp({create:{width:visible,height:visible,channels:4,background:'#ff8800'}}).png().toBuffer();
  return sharp({create:{width:size,height:size,channels:4,background:{r:0,g:0,b:0,alpha:0}}})
    .composite([{input:object,left:Math.floor((size-visible)/2),top:Math.floor((size-visible)/2)}]).png().toBuffer();
}
test('checks native visible object, not merely canvas dimensions',async()=>{
  const check=await inspectObject(await fixture(1200,1100));
  assert.equal(check.resolutionPass,true);assert.equal(check.nativeLongestEdge,1100);assert.equal(check.edgeClipped,false);
  const small=await inspectObject(await fixture(1200,200));
  assert.equal(small.resolutionPass,false);
});
test('opaque backgrounds and clipped silhouettes cannot pass unnoticed',async()=>{
  const opaque=await sharp({create:{width:1200,height:1200,channels:4,background:'#ff8800'}}).png().toBuffer();
  await assert.rejects(inspectObject(opaque),/transparent and visible/);
  const edge=await sharp({create:{width:1200,height:1200,channels:4,background:{r:0,g:0,b:0,alpha:0}}})
    .composite([{input:await sharp({create:{width:1000,height:1000,channels:4,background:'#ff8800'}}).png().toBuffer(),left:0,top:0}]).png().toBuffer();
  assert.equal((await inspectObject(edge)).edgeClipped,true);
});
