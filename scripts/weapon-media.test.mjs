import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { chromium } from 'playwright-core';
const ids = ['pea','nerf','shotgun','roman','soaker','balloon','rocket','laser','slingshot','gloom','marshmallow','bubblegum','acorn'];
let bytes=0;
for(const id of ids) {
  const master=await sharp(`art/weapon-cards/masters/${id}-v1.png`).metadata();assert.equal(master.width,1536);assert.equal(master.height,1024);
  for(const width of [480,960]) {
    const file=`public/images/weapon-cards/${id}-v1-${width}.webp`,meta=await sharp(file).metadata();assert.equal(meta.width,width);assert.equal(meta.height,width*2/3);
    bytes+=(await fs.stat(file)).size;
  }
}
assert.ok(bytes<2*1024*1024);
const browser=await chromium.launch({channel:'msedge'});
try {
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/');await page.getByRole('button',{name:'Go trick-or-treating'}).waitFor({timeout:120000});
  assert.equal(await page.locator('[data-weapon-card-art]').count(),0,'Landing should not load every card illustration');
  await page.getByRole('button',{name:'Discover the full game'}).click();
  const dialog=page.getByRole('dialog',{name:'HIDE & SHRIEK'});
  for(const size of [{width:1440,height:900},{width:390,height:844},{width:844,height:390}]) {
    await page.setViewportSize(size);assert.equal(await dialog.locator('[data-weapon-card-art]').count(),4);
    await dialog.locator('[data-weapon-card-art]').evaluateAll(async images=>{await Promise.all(images.map(i=>i.decode()));if(images.some(i=>!i.currentSrc.endsWith('.webp')||!i.naturalWidth))throw Error('Card art not decoded');});
    assert.ok(await dialog.evaluate(d=>d.querySelector('.unlock-scroll').scrollWidth<=d.querySelector('.unlock-scroll').clientWidth+2));
  }
  await page.keyboard.press('Escape');await page.setViewportSize({width:1440,height:900});
  await page.getByRole('button',{name:'Go trick-or-treating'}).click();await page.waitForFunction(()=>window.__tot?.game.state==='play');
  const sounds=await page.evaluate(async()=>{
    const {gameAudio,SFX_LOW_PASS_HZ,NORMAL_SFX_LOW_PASS_HZ}=await import('/src/game/audio.ts');const {settings}=await import('/src/game/settings.ts');settings.muted=false;gameAudio.unlock();gameAudio.last.clear();
    const calls=[],bank=gameAudio.bank.play,detail=gameAudio.detail;gameAudio.bank.play=(_,id)=>{calls.push(id);return true;};
    let layers=0;gameAudio.detail=(...args)=>{layers++;return detail.apply(gameAudio,args);};
    for(const id of ['shot','reload','pickup','impact','slotStart','slotTick','slotWin','slotExit'])gameAudio.play(id,.5);
    const first=layers;gameAudio.play('shot');gameAudio.play('slotTick');if(layers!==first)throw Error('Sound throttling lost');
    const bounded=gameAudio.normalVoices<=12;gameAudio.setMuted(true);gameAudio.play('slotStart');if(layers!==first)throw Error('Muted detail sounds leak');gameAudio.setMuted(false);
    gameAudio.bank.play=bank;gameAudio.detail=detail;return {calls,layers,bounded,deep:SFX_LOW_PASS_HZ,normal:NORMAL_SFX_LOW_PASS_HZ};
  });
  assert.deepEqual(sounds.calls.slice(0,7),['shot','tick','reload','click','pickup','impact']);
  assert.equal(sounds.layers,10);assert.ok(sounds.bounded);assert.equal(sounds.deep,700);assert.equal(sounds.normal,6500);
  await page.waitForTimeout(750);assert.equal(await page.evaluate(async()=>(await import('/src/game/audio.ts')).gameAudio.normalVoices),0,'Synth voices must clean up');
  await page.evaluate(()=>{const g=window.__tot.game;g.enemies=[];g.pickups=[];g.pendingLevels=0;g.p.invuln=999;g.time=300;g.director(.001);g.killEnemy(g.boss);g.pickups=[];g.pendingLevels=0;g.banner=null;});
  const panel=page.locator('.boss-break-panel');
  try {await panel.waitFor({timeout:5000});} catch(e) {console.log(await page.evaluate(()=>({state:window.__tot.game.state,break:window.__tot.game.bossBreak,remaining:window.__tot.game.bossBreakTime,body:document.body.innerText.slice(-500)})));throw e;}
  for(const size of [{width:1440,height:900},{width:390,height:844},{width:844,height:390}]) {
    await page.setViewportSize(size);
    assert.ok(await panel.evaluate(p=>{const r=p.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<innerHeight*.55&&[...p.querySelectorAll('button')].every(b=>b.getBoundingClientRect().height>=44);}),'Safe-break panel must fit and retain touch targets');
    await page.screenshot({path:`art/world/checks/boss-break-${size.width}.png`});
  }
  await page.setViewportSize({width:1440,height:900});
  await panel.getByRole('button',{name:'Visit upgrade shop'}).click();await page.waitForFunction(()=>window.__tot.game.state==='shop');
  await page.waitForTimeout(200);await page.keyboard.press('Escape');await panel.waitFor();await panel.getByRole('button',{name:'Skip break'}).click();await panel.waitFor({state:'detached'});
  await page.evaluate(async()=>{
    const g=window.__tot.game;const {expansion}=await import('/src/game/expansion.ts');expansion.preview();
    const {Game}=await import('/src/game/engine.ts');const next=new Game(0,g.save,g.input,true,1337);next.state='play';next.p.invuln=999;next.banner=null;window.__tot.game=next;
  });
  // Renderer regression uses the campaign independently without replacing App ownership.
  const arrows=await page.evaluate(()=>{const {game:g,renderer:r}=window.__tot;const f=g.friends[0];g.p.x=f.x;g.p.y=f.y;g.state='pause';g.vw=1;let beacons=0;const draw=r.ctx.fillText.bind(r.ctx);r.ctx.fillText=(...args)=>{if(String(args[0]).includes('· rescue'))beacons++;draw(...args);};r.render(g,1/60);r.ctx.fillText=draw;return beacons;});
  assert.ok(arrows>0,'Green rescue arrows/names absent');assert.deepEqual(errors,[]);
  console.log(`13 high-resolution masters, 26 optimized card images (${bytes} bytes), responsive showcase, preserved deep SFX + bounded/muted conventional layers, actual boss-shop/skip UI and foreground rescue markers passed.`);
}finally{await browser.close();}
