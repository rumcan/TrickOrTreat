import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({channel:'msedge'});
try{
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.TOT_ARCADE_URL||'http://127.0.0.1:5190/');
 await page.getByRole('button',{name:'Go trick-or-treating'}).waitFor({timeout:120000});
 const result=await page.evaluate(async()=>{
  const {Game,EDEF,BOSS_MINIONS,BUY_WINDOW}=await import('/src/game/engine.ts');
  const {NEW_BOSS_FAMILIES,WAVE_BOSSES,FINAL_BOSS,NEW_MONSTERS}=await import('/src/game/boss-roster.ts');
  const {expansion}=await import('/src/game/expansion.ts');expansion.preview();
  const {blockedCircle}=await import('/src/game/map.ts');
  const input=()=>({keys:new Set(),pressed:new Set(),mouseActive:false,mdown:false,rpressed:false,wheel:0,touchFiring:false,endFrame(){this.pressed.clear();}});
  const make=campaign=>{const g=new Game(0,{hero:0,soul:0,best:0,talents:{}},input(),campaign,1337);g.state='play';g.p.invuln=1e9;return g;};
  const fail=(ok,msg)=>{if(!ok)throw Error(msg);};
  fail(NEW_BOSS_FAMILIES.length===20&&WAVE_BOSSES.length===24&&new Set(WAVE_BOSSES).size===24,'Roster must contain 4 original and 20 unique new bosses');
  fail(NEW_MONSTERS.length===60,'Every new boss needs two new followers');
  const runs=[];
  for(const campaign of [false,true]){
   const g=make(campaign),rounds=[];
   for(const [i,type]of WAVE_BOSSES.entries()){
    g.bossBreak=false;g.calmT=0;g.spawnAcc=2;g.enemies=[];
    g.time=g.nextBossAt-.1;g.director(.01);
    fail(g.enemies.every(e=>BOSS_MINIONS[type].includes(e.type)),'Preboss wave mixed unrelated creatures: '+type);
    g.spawnEnemy('werewolf',g.p.x+3,g.p.y); // stray quest guardian must leave with old crowd
    g.time=g.nextBossAt;g.director(.01);
    const boss=g.boss;
    fail(boss?.type===type&&g.wave===i+1,'Wrong boss/wave: '+type);
    fail(g.enemies.every(e=>e===boss||(e.minion&&BOSS_MINIONS[type].includes(e.type))),'Wrong arrival escort: '+type);
    const wave=g.wave;
    for(let j=0;j<20;j++){g.time+=6;g.director(6);}
    fail(g.wave===wave&&g.enemies.length<=25,'Boss fight advanced waves or exceeded escort cap');
    const escortKinds=[...new Set(g.enemies.filter(e=>e!==boss).map(e=>e.type))];
    fail(escortKinds.length===2&&escortKinds.every(k=>BOSS_MINIONS[type].includes(k)),'Both themed escort types must appear: '+type);
    boss.p1=0;boss.p2=0;boss.p3=0;g.bossAI(boss,.01,g.p.x-boss.x,g.p.y-boss.y,6);
    fail(g.ebullets.length>0||boss.strikes?.length>0||boss.lungeT>0,'Boss has no working attack: '+type);
    const hp=boss.maxHp;
    if(i>0)fail(hp>rounds[i-1].hp,'Boss health must grow each wave: '+type);
    g.killEnemy(boss);g.bossBreak=false;
    fail(g.calmT===BUY_WINDOW&&g.enemies.length===0&&g.ebullets.length===0,'Boss defeat must clear combat for shopping');
    fail(g.pickups.length>0&&g.lootMagnet,'Boss must spill loot and gather dropped coins/candy');
    g.director(5);fail(g.wave===wave&&g.enemies.length===0,'Monsters spawned during buy break');
    const left=g.calmT;g.state='shop';g.update(1);fail(g.calmT===left,'Shopping must pause the break');g.closeShop();
    const at=g.nextBossAt;g.skipBuyWindow();fail(g.calmT===0&&g.nextBossAt===at-left,'Skipping break must not add wait time');
    rounds.push({type,hp,wave});
    g.pickups=[];g.pendingLevels=0;g.zones=[];
   }
   fail(g.bossKilled,'Wave24 should complete the boss gauntlet even with missing friends');
   g.startEndless();fail(g.endless&&g.wave===25,'Wave25 must be the survival finale');
   g.time=g.nextBossAt;g.updateEndless(.01);g.director(10);
   const final=g.boss;fail(final?.type===FINAL_BOSS&&g.enemies.length===1,'Final giant must have absolutely no escorts');
   const hp=final.hp,kills=g.kills;g.damageEnemy(final,1e30,'#fff',true);g.killEnemy(final);
   fail(!final.dead&&final.hp===hp&&g.kills===kills&&final.shield===0,'Final giant must be invulnerable with finite health and no fake shield');
   final.p1=0;g.bossAI(final,.01,3,3,4);
   fail(final.strikes.length===3,'Final tentacle attacks must be telegraphed');
   fail(g.snapshot().boss.invulnerable&&g.snapshot().bossIn===null,'HUD must explain final survival encounter');
   runs.push({campaign,rounds});
  }
  const g=make(true),friend=g.friends[0];
  friend.status='rescued';friend.x=g.p.x+1;friend.y=g.p.y;friend.hp=friend.maxHp;friend.weapon.cd=0;
  const saucer=g.spawnEnemy('saucer_matron_b',friend.x+1,friend.y);saucer.p3=0;
  g.rebuildGrid();g.updateEnemies(.01);
  fail(friend.abductT===30&&EDEF.saucer_matron_b.fly,'Flying saucer did not abduct a nearby rescued friend');
  fail(saucer.tractorT>0&&Math.hypot(saucer.x-friend.x,saucer.y-friend.y)<.1,'Tractor beam must have a hovering saucer directly above its victim');
  const ammo=friend.weapon.ammo;
  g.updateTeam(10);fail(friend.abductT===20&&friend.weapon.ammo===ammo,'Abducted friend must not shoot/follow');
  g.state='pause';g.update(1);fail(friend.abductT===20,'Abduction timer must pause in menus');
  g.state='play';g.enemies=[];g.updateTeam(20);
  fail(friend.abductT===0&&Math.hypot(friend.x-g.p.x,friend.y-g.p.y)<8&&!blockedCircle(g.map,friend.x,friend.y,friend.r),'Friend must return alive to a reachable spot after 30s even if saucer died');
  fail(friend.hp>0&&friend.abductImmuneT===10,'Returned friend needs safety against immediate recapture');
  const car=g.spawnEnemy('cruiser_bully_b',g.p.x+3,g.p.y);car.lungeT=-4;
  g.rebuildGrid();g.updateEnemies(.01);
  fail(car.lungeT>1&&car.def.r>.5&&g.zones.some(z=>z.kind==='warn'),'Bully driver needs a warned vehicle charge');
  return {runs,abduction:true,carCharge:true};
 });
 assert.equal(result.runs.length,2);
 assert.ok(result.abduction&&result.carCharge);
 assert.deepEqual(errors,[]);
 console.log('24 unique waves × free/campaign; 40 themed minion types; capped escorts; all boss attacks; 20s skippable shopping; unstoppable solo finale; 30s saucer abduction and driven-car charge: PASS');
}finally{await browser.close();}
