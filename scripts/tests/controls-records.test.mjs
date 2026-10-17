import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out='art/redesign-checks/controls-v5';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge'});const errors=[];
async function settled(p){await p.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].filter(i=>i.getBoundingClientRect().width).map(i=>i.decode().catch(()=>{})));});await p.waitForTimeout(120);}
async function paint(p,selector){const style=await p.locator(selector).first().evaluate(e=>({frame:getComputedStyle(e).borderImageSource,paint:getComputedStyle(e,'::before').backgroundImage,repeat:getComputedStyle(e).borderImageRepeat}));assert.ok(style.frame.includes('generated-v5/button-rim.png')&&style.paint.includes('generated-v5/button-paint.png')&&style.repeat==='repeat','Live primary action uses the painted asset and repeating edges');}
async function darkOutline(p){
 for(const button of await p.locator('.hm-btn.ghost:visible,.kit-btn-dark:not(.reference-art-button):visible').all()){
  const audit=async()=>button.evaluate(e=>{const s=getComputedStyle(e),fill=getComputedStyle(e,'::before');return {image:s.borderImageSource,widths:[s.borderTopWidth,s.borderRightWidth,s.borderBottomWidth,s.borderLeftWidth],styles:[s.borderTopStyle,s.borderRightStyle,s.borderBottomStyle,s.borderLeftStyle],insets:[fill.top,fill.right,fill.bottom,fill.left]};});
  const check=a=>{assert.equal(a.image,'none','Dark actions do not reuse the orange slab rim');assert.deepEqual(a.widths,['1px','1px','1px','1px']);assert.deepEqual(a.styles,['solid','solid','solid','solid']);assert.deepEqual(a.insets,['0px','0px','0px','0px'],'Dark fill meets the complete outline');};
  check(await audit());
  if(!p.viewportSize()||p.viewportSize().width>700){await button.scrollIntoViewIfNeeded();const before=await button.boundingBox();await button.hover();check(await audit());assert.deepEqual(await button.boundingBox(),before,'Dark button hover keeps its geometry');}
 }
}
try{
 for(const mobile of [false,true]){
  const p=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1366,height:768},isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'});p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://localhost:5173/');await p.getByRole('button',{name:'Night records',exact:true}).waitFor({timeout:120000});await settled(p);
  const header=await p.locator('.screen-header').boundingBox();assert.ok(header.y<=20,'Title radio is in the header');
  const radio=p.locator('.screen-header').getByRole('group',{name:'Radio',exact:true});await radio.waitFor();
  await p.getByRole('button',{name:'Night records',exact:true}).click();
  const dialog=p.getByRole('dialog',{name:'Time leaderboard',exact:true});await dialog.waitFor();await p.waitForTimeout(350);assert.ok(await dialog.isVisible(),'Missing RUN profile does not close the drawer');
  await settled(p);await darkOutline(p);await p.screenshot({path:`${out}/records-offline-${mobile?'mobile':'desktop'}.png`});
  await dialog.getByRole('button',{name:'Close leaderboard',exact:true}).click();await dialog.waitFor({state:'detached'});
  await p.getByRole('button',{name:'Night records',exact:true}).click();await dialog.waitFor();await p.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
  await p.getByRole('button',{name:'Talents',exact:true}).click();await p.mouse.move(5,5);await settled(p);
  const scroll=await p.locator('.talent-panel-scroll').evaluate(e=>({color:getComputedStyle(e).scrollbarColor,width:getComputedStyle(e).scrollbarWidth}));assert.notEqual(scroll.color,'auto');assert.equal(scroll.width,'thin');
  const scroller=p.locator('.talent-panel-scroll');const before=await scroller.evaluate(e=>e.scrollTop);await scroller.evaluate(e=>e.scrollTop=e.scrollHeight);assert.ok(await scroller.evaluate(e=>e.scrollTop)>before,'Talent menu content scrolls');await scroller.evaluate(e=>e.scrollTop=0);await p.locator('.talent-invest').scrollIntoViewIfNeeded();await paint(p,'.talent-invest');await darkOutline(p);await p.locator('.talent-invest').scrollIntoViewIfNeeded();await p.screenshot({path:`${out}/talents-${mobile?'mobile':'desktop'}.png`});
  await p.getByRole('button',{name:'Back',exact:true}).click();await p.getByRole('button',{name:'Go trick-or-treating',exact:true}).click();await p.waitForFunction(()=>window.__tot?.game);
  await p.evaluate(()=>{const g=window.__tot.game;g.state='play';g.tutorial=null;g.director=()=>{};g.enemies=[];g.p.invuln=99999;g.banner=null;});await p.locator('.hm-header-radio').waitFor();await settled(p);
  const geometry=await p.locator('.hm-topbar').evaluate(e=>{const r=e.getBoundingClientRect(),radio=e.querySelector('.hm-header-radio').getBoundingClientRect();return {width:e.clientWidth,content:e.scrollWidth,top:r.top,bottom:r.bottom,radioTop:radio.top,radioBottom:radio.bottom};});
  assert.ok(geometry.radioTop>=geometry.top&&geometry.radioBottom<=geometry.bottom+1,'Game radio remains inside the HUD header');assert.ok(geometry.content<=geometry.width+1,'HUD header does not overflow');
  await p.screenshot({path:`${out}/hud-${mobile?'mobile':'desktop'}.png`});
  await p.evaluate(()=>window.__tot.game.openLevelUp('house'));await p.locator('.lvl-reroll').waitFor();await paint(p,'.lvl-reroll');await settled(p);await p.screenshot({path:`${out}/reroll-${mobile?'mobile':'desktop'}.png`});
  await p.evaluate(()=>{const g=window.__tot.game;g.state='play';g.endRun(false);});await p.getByRole('button',{name:'Spend talent points',exact:true}).waitFor();await paint(p,'.end-next');await p.locator('.end-next').scrollIntoViewIfNeeded();await settled(p);await p.screenshot({path:`${out}/end-${mobile?'mobile':'desktop'}.png`});await p.locator('.end-next').click();await settled(p);await darkOutline(p);await p.locator('.talent-action-footer').screenshot({path:`${out}/dark-footer-${mobile?'mobile':'desktop'}.png`});await p.close();
 }
 // A deterministic service fixture exercises the signed-in list without a network write.
 const p=await browser.newPage({viewport:{width:1366,height:900},reducedMotion:'reduce'});p.on('pageerror',e=>errors.push(e.message));await p.goto('http://localhost:5173/');await p.getByRole('button',{name:'Night records',exact:true}).waitFor({timeout:120000});
 await p.evaluate(async()=>{const {leaderboard}=await import('/src/game/leaderboard.ts');leaderboard.profile=()=>({id:'visual-you',username:'Visual Tester',guest:false});leaderboard.read=async()=>({page:{entries:['PumpkinNova','Visual Tester','MapleMischief'].map((username,i)=>({profileId:i===1?'visual-you':`visual-${i}`,username,rank:i+1,score:963-i*55}))},rank:{rank:2,score:908}});window.dispatchEvent(new Event('focus'));});
 await p.getByRole('button',{name:'Night records',exact:true}).click();await p.locator('.records-row').first().waitFor();assert.equal(await p.locator('.records-row').count(),3);await settled(p);await p.screenshot({path:`${out}/records-list.png`});await p.close();
 assert.deepEqual(errors,[]);console.log('Verified header radio placement, painted controls, styled scrollbars and leaderboard opening/closing in signed-out and signed-in states.');
}finally{await browser.close();}
