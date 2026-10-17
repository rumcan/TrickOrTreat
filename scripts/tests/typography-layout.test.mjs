import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright-core';

const out='art/redesign-checks/typography';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge'});
const page=await browser.newPage({viewport:{width:1672,height:941},reducedMotion:'reduce'});
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
const report=[];
async function shot(name) {
  await page.evaluate(()=>document.fonts.ready);
  await page.evaluate(()=>Promise.all([...document.images].filter(i=>i.getBoundingClientRect().width>0).map(i=>i.decode().catch(()=>{}))));
  await page.waitForTimeout(150);
  await page.screenshot({path:`${out}/${name}.png`,animations:'disabled'});
}
async function font(selector,expected) {
  const session=await page.context().newCDPSession(page);
  await session.send('DOM.enable'); await session.send('CSS.enable');
  const {root}=await session.send('DOM.getDocument');
  const {nodeId}=await session.send('DOM.querySelector',{nodeId:root.nodeId,selector});
  const {fonts}=await session.send('CSS.getPlatformFontsForNode',{nodeId});
  assert.ok(fonts.some(f=>f.familyName.includes(expected)&&f.isCustomFont),`${selector}: render the intended bundled font`);
  report.push({selector,fonts}); await session.detach();
}
async function heading(name) {
  const result=await page.locator(`[data-heading="${name}"] img`).first().evaluate(async image=>{
    await image.decode();const r=image.getBoundingClientRect();
    return {source:image.currentSrc,natural:[image.naturalWidth,image.naturalHeight],rendered:[r.width,r.height]};
  });
  assert.ok(Math.abs(result.natural[0]/result.natural[1]-result.rendered[0]/result.rendered[1])<.02,'Painted heading keeps its aspect ratio');
  report.push({heading:name,...result});
}
try {
  await page.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Go trick-or-treating',exact:true}).waitFor({timeout:120000});
  await shot('01-title'); await font('.title-kid','Barlow Condensed');
  await page.getByRole('button',{name:'Character details',exact:true}).click();
  await shot('02-character'); await heading('choose-kid');
  await page.getByRole('button',{name:'Back',exact:true}).click();
  await page.getByRole('button',{name:'Talents',exact:true}).click();
  await shot('03-talents'); await heading('talents');
  await page.getByRole('button',{name:'Back',exact:true}).click();
  await page.getByRole('button',{name:'Go trick-or-treating',exact:true}).click();
  await page.waitForFunction(()=>window.__tot?.game);
  await page.evaluate(()=>{
    const g=window.__tot.game;g.director=()=>{};g.enemies=[];g.tutorial=null;g.p.invuln=99999;g.state='play';g.banner=null;g.toasts=[];
  });
  for(const viewport of [{width:1672,height:941},{width:1366,height:768},{width:1280,height:720}]) {
    await page.setViewportSize(viewport);
    await page.evaluate(async()=>{
      const {SCROLL_BY_ID,makeWeapon}=await import('/src/game/data.ts');const g=window.__tot.game;
      g.state='play';g.openLevelUp('house');g.choiceGiver='Maple Falls Post Office';
      g.choices=['owl','longshot'].map(id=>SCROLL_BY_ID[id]);
      g.lockedChoice={scroll:SCROLL_BY_ID.friendship,weapon:null};g.gunChoices=[makeWeapon('sabre',2,1,true),makeWeapon('stream',3,1,true)];g.friendChoice=null;g.treatGuideNotice=true;g.p.hp=100;g.time=21;
    });
    await page.locator('.redesign-rewards .lvl-bar').waitFor({state:'visible'});
    await page.waitForTimeout(250);
    await shot(`04-doorstep-${viewport.width}x${viewport.height}`);
    const layout=await page.locator('.redesign-rewards').evaluate(panel=>{
      const r=panel.getBoundingClientRect(),footer=panel.querySelector('.lvl-bar').getBoundingClientRect();
      return {top:r.top,bottom:r.bottom,height:r.height,content:panel.scrollHeight,client:panel.clientHeight,footerBottom:footer.bottom,
        cards:[...panel.querySelectorAll('.lvl-card')].map(c=>({width:c.clientWidth,contentWidth:c.scrollWidth,height:c.clientHeight,contentHeight:c.scrollHeight}))};
    });
    report.push({viewport,layout});console.log(JSON.stringify({viewport,layout}));
    assert.ok(layout.top>=0&&layout.bottom<=viewport.height,'The complete reward panel fits the viewport');
    assert.ok(layout.footerBottom<=viewport.height,'Reward actions remain on screen');
    assert.ok(layout.content<=layout.client+2,'Rewards do not require panel scrolling');
    for(const c of layout.cards) {assert.ok(c.contentWidth<=c.width+2,'Card text fits its width');assert.ok(c.contentHeight<=c.height+2,'Card information fits its height');}
    await font('.hm-pick-name','Anton'); await font('.hm-pick-desc','Barlow Condensed');
  }
  for (const viewport of [{width:390,height:844},{width:844,height:390}]) {
    await page.setViewportSize(viewport);
    await shot(`04-doorstep-${viewport.width}x${viewport.height}`);
    const panel=page.locator('.redesign-rewards');
    const widths=await panel.evaluate(p=>[p,...p.querySelectorAll('.lvl-card')].map(c=>({width:c.clientWidth,content:c.scrollWidth})));
    for(const w of widths) assert.ok(w.content<=w.width+2,'Mobile rewards fit their width');
    await page.locator('.redesign-rewards .lvl-bar .hm-btn').scrollIntoViewIfNeeded();
    const footer=await page.locator('.redesign-rewards .lvl-bar .hm-btn').boundingBox();
    assert.ok(footer.y>=0&&footer.y+footer.height<=viewport.height,'Mobile reward action is reachable');
    report.push({viewport,mobileWidths:widths});
  }
  await page.setViewportSize({width:1672,height:941});
  await page.evaluate(()=>{const g=window.__tot.game;g.state='play';g.endRun(false);});
  await page.getByRole('button',{name:'Spend talent points',exact:true}).waitFor();
  await shot('05-end-screen'); await font('.end-next','Anton');
  assert.deepEqual(errors,[]);console.log('Typography and desktop reward layout verified.');
} finally {
  await fs.writeFile(`${out}/report.json`,JSON.stringify({report,browserErrors:errors},null,2));
  await browser.close();
}
