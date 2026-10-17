import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out='art/redesign-checks/polish';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge'});
async function settled(page){await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].filter(i=>i.getBoundingClientRect().width).map(i=>i.decode().catch(()=>{})));});}
try {
 for(const touch of [false,true]) {
  const page=await browser.newPage({viewport:touch?{width:390,height:844}:{width:1440,height:900},isMobile:touch,hasTouch:touch,reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:5173/');
  const play=page.getByRole('button',{name:'Go trick-or-treating',exact:true});
  await play.waitFor({timeout:120000});await settled(page);
  if(!touch){
   const nav=page.getByRole('button',{name:'Play',exact:true});
   await nav.hover();
   assert.ok(await nav.locator('img').evaluate(i=>i.naturalWidth>0),'The original menu artwork is decoded');
  }
  await page.screenshot({path:`${out}/title-${touch?'mobile':'desktop'}.png`});
  await page.getByRole('group',{name:'Radio',exact:true}).waitFor({state:'visible'});
  for(const image of await page.locator('.reference-art-button img').all()){
   if(!await image.isVisible())continue;
   const ratio=await image.evaluate(i=>{const r=i.getBoundingClientRect();return [r.width/r.height,i.naturalWidth/i.naturalHeight];});
   assert.ok(Math.abs(ratio[0]-ratio[1])<.01,`Original menu art keeps its aspect ratio: ${await image.getAttribute('src')} ${ratio}`);
  }
  await play.click();await page.waitForFunction(()=>window.__tot?.game);
  await page.evaluate(()=>{const g=window.__tot.game;g.state='play';g.tutorial=null;g.director=()=>{};g.enemies=[];g.p.invuln=99999;g.banner=null;});
  await page.getByRole('button',{name:'Map',exact:true}).click();
  const close=page.getByRole('button',{name:'Close map',exact:true});
  await close.waitFor({state:'visible'});await settled(page);
  await page.screenshot({path:`${out}/map-${touch?'mobile':'desktop'}.png`});
  if(touch) await close.tap();else await close.click();
  await page.waitForFunction(()=>!window.__tot.game.bigMap);
  await close.waitFor({state:'detached'});
  if(!touch){
   await page.keyboard.press('m');await close.waitFor({state:'visible'});
   await page.keyboard.press('m');await close.waitFor({state:'detached'});
   await page.getByRole('button',{name:'Map',exact:true}).click();await close.waitFor({state:'visible'});
   await page.keyboard.press('Escape');await close.waitFor({state:'detached'});
   assert.equal(await page.evaluate(()=>window.__tot.game.state),'play','Escape closes map without pausing');
  }
  for(const [title,kind] of [['NEW WEAPON!','loot'],['Trick or Treat... or FIGHT!','info'],['TOMMY JOINS YOU!','loot']]){
   await page.evaluate(({title,kind})=>{window.__tot.game.setBanner(title,'A matching illustrated notification with readable game details.',kind);window.__tot.game.banner.t=99;},{title,kind});
   await page.locator('.illustrated-notice').waitFor();await settled(page);
   // Keep the effect in its normal display phase while capturing.
   await page.evaluate(()=>window.__tot.game.banner.t=2.5);
   await page.waitForTimeout(150);
   await settled(page);
   await page.screenshot({path:`${out}/notice-${title.startsWith('NEW')?'weapon':title.startsWith('Trick')?'opening':'friend'}-${touch?'mobile':'desktop'}.png`});
  }
  await page.evaluate(async()=>{
   const {SCROLL_BY_ID,makeWeapon}=await import('/src/game/data.ts');const g=window.__tot.game;
   g.state='play';g.openLevelUp('house');g.choices=['owl','longshot'].map(id=>SCROLL_BY_ID[id]);
   g.gunChoices=[makeWeapon('sabre',2,1,true),makeWeapon('stream',3,1,true)];g.lockedChoice=null;g.friendChoice=2;
  });
  await page.locator('.hm-pick-friend').waitFor();await settled(page);
  const friend=page.locator('.hm-pick-friend');
  await friend.scrollIntoViewIfNeeded();
  const bounds=await friend.evaluate(e=>({width:e.clientWidth,content:e.scrollWidth,height:e.clientHeight,contentHeight:e.scrollHeight}));
  assert.ok(bounds.content<=bounds.width+2&&bounds.contentHeight<=bounds.height+2,'Companion offer fits its card');
  await friend.screenshot({path:`${out}/friend-card-${touch?'mobile':'desktop'}.png`});
  await page.evaluate(()=>{const g=window.__tot.game;g.state='play';g.endRun(false);});
  await page.locator('.illustrated-notice--died').waitFor();await settled(page);
  await page.screenshot({path:`${out}/died-${touch?'mobile':'desktop'}.png`});
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('Verified desktop/mobile map close, M toggle, Escape, hover contrast and illustrated notifications.');
} finally {await browser.close();}
