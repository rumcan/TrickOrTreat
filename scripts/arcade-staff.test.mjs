import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import {chromium} from 'playwright-core';
for(const name of ['maya','leo']){
 const info=await sharp(`public/assets/arcade/staff/${name}.webp`).metadata();assert.equal(info.width,768);assert.equal(info.height,256);assert.ok(info.hasAlpha);
 const raw=await sharp(`public/assets/arcade/staff/${name}.webp`).ensureAlpha().raw().toBuffer();
 for(let frame=0;frame<4;frame++){let opaque=0;for(let y=0;y<256;y++)for(let x=frame*192;x<(frame+1)*192;x++)if(raw[(y*768+x)*4+3]>96)opaque++;assert.ok(opaque>3000,`${name} frame ${frame} empty`);}
}
const browser=await chromium.launch({channel:'msedge'});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.TOT_ARCADE_URL||'http://127.0.0.1:5190/');await page.getByRole('button',{name:'Go trick-or-treating'}).waitFor({timeout:120000});await page.getByRole('button',{name:'Go trick-or-treating'}).click();await page.waitForFunction(()=>window.__tot?.game);
 await page.evaluate(()=>{const g=window.__tot.game;g.director=()=>{};g.enemies=[];g.p.invuln=1e9;g.state='play';Object.assign(g.p,g.map.houses.find(h=>h.prop.kind==='arcade').door);g.travelArcade('arcade');});
 const approach=async(hero,coins)=>page.evaluate(({hero,coins})=>{const g=window.__tot.game,s=g.availableArcadeStaff.find(s=>s.hero===hero);g.p.coins=coins;g.rescuePrompt='';Object.assign(g.p,{x:s.x,y:s.y+.5});g.input.pressed.clear();g.input.pressed.add('e');g.updateInteract();if(g.state!=='hire')throw Error('Staff interaction did not open hiring');},{hero,coins});
 await approach(3,20);const maya=page.getByRole('dialog',{name:'Recruit Maya'});await maya.waitFor();assert.ok(await maya.getByRole('button',{name:'Recruit Maya · 120 coins'}).isDisabled());
 const pause=await page.evaluate(()=>{const g=window.__tot.game,time=g.time,x=g.p.x;g.update(10);return g.time===time&&g.p.x===x;});assert.ok(pause,'Hiring must pause combat');
 await maya.getByRole('button',{name:'Not now · back to the arcade'}).click();await page.waitForFunction(()=>window.__tot.game.state==='play');assert.equal(await page.evaluate(()=>window.__tot.game.p.coins),20);
 await approach(3,500);await page.getByRole('dialog',{name:'Recruit Maya'}).getByRole('button',{name:'Recruit Maya · 120 coins'}).click();await page.waitForFunction(()=>window.__tot.game.state==='play');
 assert.equal(await page.evaluate(()=>{const g=window.__tot.game;g.hireStaff();if(g.friends.filter(f=>f.hero===3&&f.status==='rescued').length!==1)throw Error('Maya missing or duplicated');return g.p.coins;}),380);
 await approach(4,380);await page.getByRole('dialog',{name:'Recruit Leo'}).getByRole('button',{name:'Recruit Leo · 150 coins'}).click();await page.waitForFunction(()=>window.__tot.game.state==='play');
 const team=await page.evaluate(()=>{const g=window.__tot.game;if(g.p.coins!==230||g.availableArcadeStaff.length)throw Error('Wrong payment or a worker remained after hiring');g.p.weapons[0].level=7;g.syncTeamWeapons();if(g.friends.some(f=>f.weapon.level<7))throw Error('Hired workers did not inherit gun levels');Object.assign(g.p,g.map.start);g.travelArcade('town');if(g.map.kind==='arcade'||g.friends.some(f=>Math.hypot(f.x-g.p.x,f.y-g.p.y)>3))throw Error('Hired workers did not follow outside');g.travelArcade('arcade');if(g.availableArcadeStaff.length||g.friends.length!==2)throw Error('Re-entry duplicated workers');return g.friends.map(f=>f.hero);});assert.deepEqual(team,[3,4]);
 await page.evaluate(async()=>{const {Game}=await import('/src/game/engine.ts'),{expansion}=await import('/src/game/expansion.ts');expansion.preview();const input=()=>({keys:new Set(),pressed:new Set(),wheel:0,endFrame(){this.pressed.clear();}});for(const hero of [0,3,4]){const g=new Game(hero,{hero,soul:0,best:0,talents:{}},input(),true,123);if(g.state!=='intro'||g.friends.some(f=>f.hero>=3))throw Error('Workers still participate in hide-and-seek');if(g.availableArcadeStaff.some(s=>s.hero===hero))throw Error('Player duplicated as worker');if(hero===0)for(let i=0;i<6;i++){g.introTime=i*2.8+.01;if(g.introText.hero>=3)throw Error('Worker still speaks in opening intro');}}});
 assert.deepEqual(errors,[]);console.log('PASS arcade crew: animated sheets, paused/cancellable coin hiring, no double charge or duplicates, shared gun levels, cross-scene following and premium intro roster.');
}finally{await browser.close();}
