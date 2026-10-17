import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out='art/redesign-checks/layout-v4';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge'});
const errors=[];
async function settle(page){await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].filter(i=>i.getBoundingClientRect().width).map(i=>i.decode().catch(()=>{})));});await page.waitForTimeout(100);}
async function geometry(page){return page.locator('.title-panel,.title-play,.title-character,.title-nav button:visible').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height];}));}
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080},reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5173/');await page.getByRole('button',{name:'Go trick-or-treating',exact:true}).waitFor({timeout:120000});await settle(page);
 for(const viewport of [{width:1920,height:1080},{width:1672,height:941},{width:1366,height:768}]){
  await page.setViewportSize(viewport);await page.mouse.move(viewport.width-1,viewport.height-1);await settle(page);
  const original=await geometry(page);
  for(const button of await page.locator('.title-play,.title-nav button:visible').all()){
   await button.hover({position:{x:1,y:1}});await page.waitForTimeout(100);
   const hovered=await geometry(page);
   assert.equal(hovered.length,original.length);
   hovered.forEach((r,i)=>r.forEach((v,k)=>assert.ok(Math.abs(v-original[i][k])<.15,'Hover cannot move or resize menu items or the character panel')));
   await button.hover();await page.waitForTimeout(100);
   const centered=await geometry(page);centered.forEach((r,i)=>r.forEach((v,k)=>assert.ok(Math.abs(v-original[i][k])<.15,'Hovering the center keeps the same layout')));
  }
  const artwork=await page.locator('.reference-art-button img:visible').evaluateAll(es=>es.map(i=>({src:i.currentSrc,width:i.getBoundingClientRect().width,height:i.getBoundingClientRect().height,natural:i.naturalWidth,naturalHeight:i.naturalHeight})));
  artwork.forEach(i=>{assert.ok(i.width<=i.natural+.1,'Menu artwork never exceeds its source dimensions');assert.ok(Math.abs(i.width/i.height-i.natural/i.naturalHeight)<.01,'Artwork keeps its aspect ratio');});
  await page.screenshot({path:`${out}/menu-${viewport.width}.png`});
 }
 await page.getByRole('button',{name:'Talents',exact:true}).click();await settle(page);
 for(const viewport of [{width:1672,height:941},{width:1280,height:720},{width:390,height:844}]){
  await page.setViewportSize(viewport);await settle(page);
  await page.locator('.talent-panel-scroll').evaluate(e=>e.scrollTop=0);
  const panel=page.locator('.talent-side');
  const audit=await panel.evaluate(p=>{
   const rect=p.getBoundingClientRect();const footer=p.querySelector('.talent-action-footer').getBoundingClientRect();
   const text=p.querySelector('.talent-effect');const bounds=text.getBoundingClientRect();
   return {panelWidth:p.clientWidth,contentWidth:p.scrollWidth,footerBottom:footer.bottom,panelBottom:rect.bottom,fontSize:parseFloat(getComputedStyle(text).fontSize),lineHeight:parseFloat(getComputedStyle(text).lineHeight),textWidth:bounds.width,textContentWidth:text.scrollWidth};
  });
  assert.ok(audit.contentWidth<=audit.panelWidth+1,'Talent panel has no horizontal clipping');
  assert.ok(audit.fontSize>=18&&audit.lineHeight>=24,'Selected talent text is readable');
  assert.ok(audit.textContentWidth<=audit.textWidth+1,'Talent effect fits its card');
  if(viewport.width>=1024)assert.ok(audit.footerBottom<=viewport.height-20,'Talent actions stay inside the frame');
  else await panel.scrollIntoViewIfNeeded();
  await page.screenshot({path:`${out}/talents-${viewport.width}.png`});
  await page.locator('.talent-invest').scrollIntoViewIfNeeded();
  const investBounds=await page.locator('.talent-invest').boundingBox();
  const actionBounds=await page.locator('.talent-action-footer').boundingBox();
  assert.ok(investBounds.y>=0&&investBounds.y+investBounds.height<=actionBounds.y+1,'Talent investment stays above the footer while scrolling');
  await page.locator('.talent-guide summary').scrollIntoViewIfNeeded();await page.locator('.talent-guide summary').click();
  assert.ok(await page.locator('.talent-guide').evaluate(e=>e.open));await page.locator('.talent-guide summary').click();
 }
 await page.setViewportSize({width:1366,height:768});await page.getByRole('button',{name:'Back',exact:true}).click();
 await page.getByRole('button',{name:'Go trick-or-treating',exact:true}).click();
 await page.waitForFunction(()=>window.__tot?.game);
 await page.evaluate(async()=>{const {SCROLL_BY_ID,makeWeapon}=await import('/src/game/data.ts');const g=window.__tot.game;g.state='play';g.tutorial=null;g.director=()=>{};g.enemies=[];g.p.invuln=99999;g.openLevelUp('house');g.choiceGiver='Maple Falls Post Office';g.choices=['owl','longshot'].map(id=>SCROLL_BY_ID[id]);g.gunChoices=[makeWeapon('sabre',2,1,true),makeWeapon('stream',3,1,true)];g.friendChoice=null;g.lockedChoice={scroll:SCROLL_BY_ID.friendship,weapon:null};g.treatGuideNotice=true;});
 for(const viewport of [{width:1366,height:768},{width:1280,height:720},{width:390,height:844},{width:844,height:390}]){
  await page.setViewportSize(viewport);await page.locator('.lvl-reroll').waitFor();await settle(page);
  const audit=await page.locator('.redesign-rewards').evaluate(p=>{
   const r=p.getBoundingClientRect(),button=p.querySelector('.lvl-reroll').getBoundingClientRect();
   const fill=getComputedStyle(p,'::before'),frame=getComputedStyle(p.querySelector('.painted-frame'));
   return {bottomGap:r.bottom-button.bottom,rightGap:r.right-button.right,buttonBottom:button.bottom,fillOpacity:fill.opacity,fillInset:parseFloat(fill.top),background:getComputedStyle(p).backgroundColor,frame:frame.borderImageSource,repeat:frame.borderImageRepeat,grid:p.querySelector('.lvl-grid').getBoundingClientRect().height};
  });
  assert.ok(audit.bottomGap-audit.fillInset>=20,`Reroll clears the visible bottom frame by at least 20px: ${viewport.width} ${JSON.stringify(audit)}`);
  assert.ok(audit.rightGap-audit.fillInset>=14,'Reroll clears the visible right frame');
  assert.ok(audit.buttonBottom<=viewport.height-20,'Reward actions stay visible');
  assert.equal(audit.fillOpacity,'1','Panel ink fill is opaque');assert.equal(audit.background,'rgba(0, 0, 0, 0)','Root does not paint an oversized black rectangle');
  assert.ok(audit.frame.includes('generated-v4/frame.png')&&audit.repeat==='repeat','One continuous frame repeats its edges');
  assert.ok(audit.grid>=100,'Offer list has usable scrolling space');
  await page.screenshot({path:`${out}/reward-${viewport.width}.png`});
 }
 await page.setViewportSize({width:1366,height:768});
 await page.evaluate(()=>{const g=window.__tot.game;g.state='play';g.endRun(false);});
 await page.getByRole('button',{name:'Spend talent points',exact:true}).click();await settle(page);
 const invest=page.getByRole('button',{name:/^Invest/});await invest.scrollIntoViewIfNeeded();
 const previous=Number(await page.locator('.talent-wallet b').textContent());await invest.click();
 assert.ok(Number(await page.locator('.talent-wallet b').textContent())<previous,'Invest spends Essence and updates the wallet');
 for(const viewport of [{width:1366,height:768},{width:390,height:844}]){
  await page.setViewportSize(viewport);await settle(page);
  const footer=page.locator('.talent-action-footer');await footer.scrollIntoViewIfNeeded();
  for(const name of ['Main menu','Play again']){
   const b=await footer.getByRole('button',{name,exact:true}).boundingBox();
   assert.ok(b.y>=0&&b.y+b.height<=viewport.height-16,`${name} remains reachable with footer padding`);
   assert.ok(b.height>=48,`${name} has a usable target`);
  }
  await page.screenshot({path:`${out}/talents-after-run-${viewport.width}.png`});
 }
 assert.deepEqual(errors,[]);console.log('Verified stable hover geometry, source-size limits, talent purchases and actions, opaque inset fills and footer clearances on desktop/mobile.');
}finally{await browser.close();}
