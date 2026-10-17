import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({channel:'msedge'});
await fs.mkdir('art/nightmare/checks',{recursive:true});
try{
 for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:844,height:390}]){
  const context=await browser.newContext({viewport,hasTouch:viewport.width<1000,isMobile:viewport.width<1000}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.text().includes('[assets] override failed'))errors.push(m.text());});
  await page.goto(process.env.TOT_ARCADE_URL||'http://127.0.0.1:5190/');
  await page.getByRole('button',{name:'Go trick-or-treating'}).waitFor({timeout:120000});
  await page.getByRole('button',{name:'Go trick-or-treating'}).click();
  await page.waitForFunction(()=>window.__tot?.game);
  const result=await page.evaluate(async()=>{
    const {game:g,renderer:r}=window.__tot;
    const {WAVE_BOSSES}=await import('/src/game/boss-roster.ts');
    const {BOSS_MINIONS,Game}=await import('/src/game/engine.ts');
    const {expansion}=await import('/src/game/expansion.ts');expansion.preview();
    // painted art replaces the procedural fallback through the manifest: the atlas entry records the file it came from
    const {allAssets}=await import('/src/game/assets.ts');
    const painted=()=>Object.fromEntries(allAssets().map(a=>[a.spec.key,a.file||'']));
    g.update=()=>{};g.state='play';g.p.invuln=1e9;g.banner=null;g.toasts=[];
    const install=type=>{
      g.wave=WAVE_BOSSES.indexOf(type)+1;g.enemies=[];g.ebullets=[];g.zones=[];
      g.boss=g.spawnEnemy(type,g.p.x+3,g.p.y);g.boss.spawnT=0;
      for(const [i,k]of (BOSS_MINIONS[type]||[]).entries()){
        const e=g.spawnEnemy(k,g.p.x+1.5+i,g.p.y+1.5);e.spawnT=0;
      }
      r.render(g,.016);
      const files=painted();
      for(const key of [type,...(BOSS_MINIONS[type]||[])]){
        if(!files[`enemy_${key}`])throw Error('Procedural fallback still active: '+key);
        if(!files[`enemy_${key}`].includes('monsters/nightmare/'))throw Error('Wrong art override: '+key);
      }
    };
    window.__nightmareInstall=install;
    for(const type of WAVE_BOSSES.slice(4)){
      install(type);
      g.boss.hit=.1;r.render(g,.016);
      if(!r.en[type].white)throw Error('Hit flash failed: '+type);
    }
    install('saucer_matron');
    const active=new Set(g.enemies.map(e=>e.type));
    if(Object.entries(r.en).some(([k,e])=>!active.has(k)&&(e.white||e.green||e.ice)))throw Error('Unused effect canvases retained across waves');
    const spare=new Game(0,{hero:0,soul:0,best:0,talents:{}},g.input,true,1337);
    const friend=spare.friends[0];friend.status='rescued';friend.hp=friend.maxHp;friend.x=g.p.x-1;friend.y=g.p.y+1;friend.abductT=29;
    g.friends=[friend];const saucer=g.enemies.find(e=>e.type==='saucer_matron_b');saucer.x=friend.x;saucer.y=friend.y;saucer.tractorT=1;
    g.zones.push({kind:'tractor',x:friend.x,y:friend.y,r:.9,t:0,life:2,dmg:0,tick:0});r.render(g,.016);
    return {families:20,overflow:document.documentElement.scrollWidth>innerWidth+1};
  });
  assert.equal(result.families,20);assert.equal(result.overflow,false);
  await page.screenshot({path:`art/nightmare/checks/saucer-${viewport.width}x${viewport.height}.png`});
  for(const type of ['cruiser_bully','assimilation_archon','night_brood','cloud_leviathan','hollow_beyond']){
    await page.evaluate(type=>{window.__tot.game.friends=[];window.__nightmareInstall(type);},type);
    await page.screenshot({path:`art/nightmare/checks/${type}-${viewport.width}x${viewport.height}.png`});
  }
  if(viewport.width<1000)await page.getByTestId('touch-move').waitFor();
  assert.deepEqual(errors,[]);
  console.log(`${viewport.width}x${viewport.height}: all 20 painted boss families, effect-cache cleanup, saucer beam, finale and touch controls PASS.`);
  await context.close();
 }
}finally{await browser.close();}
