import assert from 'node:assert/strict';
import {fixedPreset,fixedPresetRoll} from './app/fixed-preset.js';
const recipe={id:'legacy-arrangement',turn:true,mirror:true,members:[{dx:1,dy:2,pick:['a','b'],flip:'random',scale:[.8,1.2],jitter:10,chance:.1},{dx:-3,dy:4,pick:['c'],flip:true,scale:[2,2],jitter:3,chance:0}]};
const before=structuredClone(recipe),fixed=fixedPreset(recipe);assert.deepEqual(recipe,before);assert.deepEqual(fixedPreset(fixed),fixed);
const roll=fixedPresetRoll(recipe);assert.equal(roll.length,2);assert.deepEqual(roll.map(m=>[m.dx,m.dy,m.scale,m.flip]),[[1,2,1,false],[-3,4,2,true]]);
const oldRandom=Math.random;Math.random=()=>{throw Error('No runtime randomness allowed in presets');};
try{for(let n=0;n<100;n++)assert.deepEqual(fixedPresetRoll(recipe),roll);}finally{Math.random=oldRandom;}
assert.deepEqual(fixedPresetRoll(fixed,2),roll.map(m=>({...m,dx:m.dx*2,dy:m.dy*2,scale:m.scale*2})));
console.log('PASS deterministic presets: exact positions, sizes/facing, no omitted members, no jitter/turn/mirror/reroll, immutable input, idempotence, uniform area scale');
