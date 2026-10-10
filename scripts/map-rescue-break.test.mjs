import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const browser = await chromium.launch({channel:'msedge'});
try {
  const page = await browser.newPage({viewport:{width:1440,height:900}});
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button',{name:'Go trick-or-treating'}).waitFor({timeout:120000});
  const result = await page.evaluate(async () => {
    const {Game} = await import('/src/game/engine.ts');
    const {blockedCircle,cellAt} = await import('/src/game/map.ts');
    const {CW,CR} = await import('/src/game/config.ts');
    const {expansion} = await import('/src/game/expansion.ts'); expansion.preview();
    const input = () => ({keys:new Set(),pressed:new Set(),mouseActive:false,mdown:false,rpressed:false,wheel:0,endFrame(){this.pressed.clear();}});
    const check = (ok,message) => {if(!ok) throw new Error(message);};
    let doors=0, friends=0;
    for (const campaign of [false,true]) for(let seed=1;seed<=12;seed++) {
      const g = new Game(0,{hero:0,soul:0,best:0,talents:{}},input(),campaign,seed); g.state='play'; g.p.invuln=999;
      for(const gate of g.map.gates) { g.time=gate.openAt; g.director(.001); }
      g.computeFlow(true);
      for(const h of g.map.houses) {check(!blockedCircle(g.map,h.door.x,h.door.y,.3), `Blocked door ${h.owner}, seed ${seed}`); check(g.reachable(h.door.x,h.door.y),`Disconnected door ${h.owner} at ${h.door.x},${h.door.y}, seed ${seed}`); doors++;}
      for(const f of g.friends) {check(g.reachable(f.x,f.y)&&!blockedCircle(g.map,f.x,f.y,.7),'Rescue kid is not in a reachable clearing'); friends++;}
      for(const prop of g.map.props.filter(p=>p.kind==='hedge')) {
        const idx=Math.floor((prop.y0+.5)*CR)*CW+Math.floor((prop.x0+.5)*CR);
        if(g.map.gates.some(gate=>gate.propIds.includes(prop.id))) check(prop.removed&&g.map.coll[idx]===g.map.barrierBase[idx],'Opened road hedge remains solid or visible');
      }
      g.time=60; g.hordes.clear(); g.enemies=[]; g.director(.001);
      check(g.enemies.filter(e=>!e.def.fly&&!e.def.phase&&!e.def.boss).every(e=>g.reachable(e.x,e.y)&&!blockedCircle(g.map,e.x,e.y,e.r*.85)),'Ground horde spawned behind a hedge or inside an obstacle');
      check(!g.reachable(-1,20)&&!g.reachable(200,20),'Reachability wraps around map');
    }
    const g = new Game(0,{hero:0,soul:0,best:0,talents:{}},input(),false,1337);g.p.invuln=999;g.state='play';g.time=300;g.director(.001);
    const boss=g.boss;g.killEnemy(boss);check(g.state==='play'&&g.bossBreak&&g.bossBreakTime===20,'Boss does not start a playable 20-second break');
    check(!g.enemies.length&&!g.ebullets.length&&!g.bullets.length,'Boss clear left creatures/projectiles');
    const gold=g.pickups.filter(p=>p.golden);check(gold.length>=30&&gold.every(p=>p.vz>0),'Boss loot does not burst visibly');
    check(gold.filter(p=>p.kind.startsWith('xp')).reduce((n,p)=>n+p.value,0)===boss.def.xp,'Boss XP lost in capped pickup count');
    const time=g.time,wave=g.wave; g.pickups=[];g.pendingLevels=0;
    for(let i=0;i<200;i++)g.update(.05);
    check(g.time===time&&g.wave===wave&&!g.enemies.length&&Math.abs(g.bossBreakTime-10)<.1,'Combat/time/waves advance during the break');
    g.openBossShop();const remaining=g.bossBreakTime;g.update(.05);check(g.state==='shop'&&g.bossBreakTime===remaining,'Shop does not pause safe-break timer');g.closeShop();check(g.bossBreak,'Closing shop removes remaining safe time');
    g.skipBossBreak();check(!g.bossBreak&&g.state==='play','Skip cannot resume the streets');
    g.map.coll.fill(0); g.p.x=10;g.p.y=10;g.enemies=[];
    for(let y=8*CR;y<12*CR;y++)for(let x=11*CR;x<12*CR;x++)g.map.coll[y*CW+x]=1;
    g.computeFlow(true); const chaser=g.spawnEnemy('zombie',13,10);chaser.spawnT=0;
    for(let i=0;i<420;i++) {g.rebuildGrid();g.updateEnemies(1/30);}
    check(Math.hypot(chaser.x-g.p.x,chaser.y-g.p.y)<1,'Close-range ground creature gets stuck against a low garden hedge');
    return {doors,friends,goldenDrops:gold.length,time};
  });
  console.log(JSON.stringify(result));assert.ok(result.doors>500&&result.friends===48);
  console.log('All doors/rescue clearings across 24 maps, opened hedges, reachable ground hordes, exact boss XP and safe/skippable shopping break passed.');
} finally {await browser.close();}
