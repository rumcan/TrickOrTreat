import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const url=process.env.TOT_GAME_URL||'http://127.0.0.1:5173/';
const browser=await chromium.launch(process.env.TOT_BROWSER?{executablePath:process.env.TOT_BROWSER}:{channel:'msedge'});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await page.getByRole('button',{name:'Go trick-or-treating'}).waitFor({timeout:120000});
 const result=await page.evaluate(async()=>{
  const {Game}=await import('/src/game/engine.ts'),{blockedCircle,lineOfSight}=await import('/src/game/map.ts'),{CW,CH,CR,MAP_W,MAP_H}=await import('/src/game/config.ts');
  const input=()=>({keys:new Set(),pressed:new Set(),mouseActive:false,mdown:false,rpressed:false,wheel:0,endFrame(){this.pressed.clear();}});
  const make=seed=>{const g=new Game(0,{hero:0,soul:0,best:0,talents:{}},input(),false,seed);g.state='play';g.p.invuln=1e9;g.tutorial=null;return g;};
  const check=(ok,message)=>{if(!ok)throw Error(message);};
  const g=make(1337),at=(x,y)=>Math.floor(y*CR)*CW+Math.floor(x*CR);
  g.map.coll.fill(0);g.map.coll[40*CW+41]=2;
  check(blockedCircle(g.map,10.5,10.5,.4),'Footprint misses a thin obstacle between the centre and corners');
  check(!blockedCircle(g.map,12,12,.4),'An unobstructed footprint is blocked');
  check(blockedCircle(g.map,.1,10,.4)&&blockedCircle(g.map,MAP_W-.1,10,.4),'Footprint must respect map bounds');
  g.map.coll.fill(0);for(let y=0;y<CH;y++)for(let x=12*CR;x<13*CR;x++)g.map.coll[y*CW+x]=1;
  // A one-cell gap admits a point, but cannot fit a walking creature's body.
  for(let x=12*CR;x<13*CR;x++)g.map.coll[48*CW+x]=0;
  g.p.x=10;g.p.y=12.125;g.computeFlow(true);
  check(!g.reachable(15,12.125),'Navigation accepts a body-blocked narrow gap');
  check(!g.reachable(-1,20)&&!g.reachable(MAP_W+1,20)&&!g.reachable(20,-1)&&!g.reachable(20,MAP_H+1),'Out-of-bounds reachability wraps into a valid row');
  const stranded=g.spawnEnemy('zombie',25,12.125);check(g.reachable(stranded.x,stranded.y)&&!blockedCircle(g.map,stranded.x,stranded.y,stranded.r*.85),'Spawn relocation falls back to an unreachable starting point');
  g.map.coll.fill(0);g.p.x=10;g.p.y=10;g.enemies=[];
  for(let y=8*CR;y<12*CR;y++)for(let x=11*CR;x<12*CR;x++)g.map.coll[y*CW+x]=1;
  check(lineOfSight(g.map,10,10,13,10),'Low hedges must preserve projectile sight');
  check(!lineOfSight(g.map,10,10,13,10,1),'Ground movement sight must respect low hedges');
  g.computeFlow(true);const chaser=g.spawnEnemy('zombie',13,10);chaser.spawnT=0;
  for(let i=0;i<420;i++){g.rebuildGrid();g.updateEnemies(1/30);}
  check(Math.hypot(chaser.x-g.p.x,chaser.y-g.p.y)<1,'Close-range ground enemy remains stuck on a low hedge');
  let doors=0,spawns=0;
  for(let seed=1;seed<=12;seed++){
   const game=make(seed);
   check(game.tutorialHouse&&game.reachable(game.tutorialHouse.door.x,game.tutorialHouse.door.y),'No reachable first house, seed '+seed);
   for(const gate of game.map.gates){game.time=gate.openAt;game.director(.001);}
   game.computeFlow(true);
   for(const house of game.map.houses){check(!blockedCircle(game.map,house.door.x,house.door.y,.3),'Body-blocked door, seed '+seed+': '+house.owner);check(game.reachable(house.door.x,house.door.y),'Disconnected door, seed '+seed+': '+house.owner);doors++;}
   for(let n=0;n<10;n++){
    const enemy=game.spawnEnemy('zombie',game.p.x+3+n*.1,game.p.y+3);check(game.reachable(enemy.x,enemy.y)&&!blockedCircle(game.map,enemy.x,enemy.y,enemy.r*.85),'Ground spawn is blocked or unreachable, seed '+seed);spawns++;
   }
  }
  return {doors,spawns,chaserDistance:Math.hypot(chaser.x-g.p.x,chaser.y-g.p.y)};
 });
 assert.ok(result.doors>300);assert.equal(result.spawns,120);assert.deepEqual(errors,[]);console.log('PASS full footprint, map bounds, narrow gaps, safe spawn fallback, hedge pursuit and '+result.doors+' seeded doors / '+result.spawns+' spawns');
}finally{await browser.close();}
