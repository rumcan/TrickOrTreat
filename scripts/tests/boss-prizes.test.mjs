import {chromium} from 'playwright-core';
const browser=await chromium.launch({channel:'msedge'});
try{
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.TOT_URL||'http://127.0.0.1:5173/');
 await page.getByRole('button',{name:'Go trick-or-treating'}).waitFor({timeout:120000});
 const result=await page.evaluate(async()=>{
  const {Game}=await import('/src/game/engine.ts');
  const {rollBossRarity}=await import('/src/game/progression.ts');
  const {rollRarity}=await import('/src/game/data.ts');
  const input=()=>({keys:new Set(),pressed:new Set(),mouseActive:false,mdown:false,rpressed:false,wheel:0,touchFiring:false,endFrame(){this.pressed.clear();}});
  const fail=(ok,msg)=>{if(!ok)throw Error(msg);};
  const g=new Game(0,{hero:0,soul:0,best:0,talents:{}},input(),false,1337);g.state='play';g.p.invuln=1e9;
  if(g.tutorial)g.tutorial=null;
  // a level-up heals and never opens the picker
  g.p.hp=1;g.p.shield=0;g.p.xp=g.p.xpNext-0.5;g.pickups=[{x:g.p.x,y:g.p.y,z:0,vz:0,vx:0,vy:0,kind:'xp3',value:50,mag:true,t:1,dead:false}];
  const lvl=g.p.level;g.updatePickups(.016);
  fail(g.p.level>lvl,'XP did not level up');
  fail(g.p.hp===g.stats.maxHp&&g.p.shield===g.stats.maxShield,'A level-up must restore health and shield');
  g.update(.016);fail(g.state==='play','A level-up must not open the picker');
  // a boss kill opens the prize picker once the frame is over
  g.time=g.nextBossAt;g.director(.01);const boss=g.boss;fail(boss,'No boss spawned');
  g.killEnemy(boss);for(let i=0;i<40&&g.state==='play';i++)g.update(.016);
  fail(g.state==='levelup'&&g.choiceMode==='boss','A boss kill must open the boss prize picker '+JSON.stringify({s:g.state,m:g.choiceMode,q:g.bossPrizes.length,tot:!!g.tot,brk:g.bossBreak}));
  fail(g.gunChoices.length>=1&&g.gunChoices[0].rarity>=3,'A boss prize must offer an Epic-or-better gun');
  fail(g.gunChoices.every(w=>w.rarity>=2)&&g.choices.every(c=>c.rarity>=2)&&g.friendChoice===null,'Boss prizes are Rare or better, never a friend');
  const calm=g.calmT;g.update(1);fail(g.calmT===calm,'The quiet seconds must wait for the pick');
  g.p.weapons[1]=null;g.chooseGun(0);fail(g.state==='play'&&g.p.weapons[1],'Taking a boss gun returns to the street');
  // checkpoint: a run can start at a night the save has reached, with that night's ranks
  const c=new Game(0,{hero:0,soul:0,best:0,talents:{},checkpoint:3},input(),false);c.state='play';
  c.startAtNight(4);fail(c.night===1,'A checkpoint beyond the save must be refused');
  c.startAtNight(3);
  fail(c.night===3&&c.wave===1&&c.totalWave===51&&c.arcadeShut,'Checkpoint start must be night 3, wave 51');
  fail(c.p.weapons.every(w=>w&&w.rarity>=2)&&c.bossPrizes.length===1,'Checkpoint start gets boss-table guns and a prize');
  const m=c.spawnEnemy('zombie',c.p.x+5,c.p.y);
  fail(m.rank===2&&m.captain,'Night 3 monsters must be captains');
  // odds: boss guns are Epic+ far more often than a major-building doorbell
  const N=20000;let boss2=0,door=0;for(let i=0;i<N;i++){if(rollBossRarity(4)>=3)boss2++;if(rollRarity(2,2,4)>=3)door++;}
  return {bossEpicPlus:(boss2/N).toFixed(2),doorEpicPlus:(door/N).toFixed(2)};
 });
 if(errors.length)throw Error(errors.join('\n'));
 console.log(`Level-up heals without a picker; boss kill opens Rare+ prize with an Epic+ gun; Epic+ odds boss ${result.bossEpicPlus} vs major door ${result.doorEpicPlus}; checkpoint start at night 3 with captains: PASS`);
}finally{await browser.close();}
