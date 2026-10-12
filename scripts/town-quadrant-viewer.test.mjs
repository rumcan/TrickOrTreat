import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({channel:'msedge'});
try{
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const url=(process.env.TOWN_URL||'http://127.0.0.1:5192')+'/art/town/quadrants/index.html';
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
    await page.setViewportSize(viewport);await page.goto(url);
    await page.waitForFunction(()=>document.querySelectorAll('article').length===25);
    await page.waitForFunction(()=>document.querySelector('article img')?.complete&&document.querySelector('article img')?.naturalWidth>0);
    await page.evaluate(async()=>{await Promise.all([...document.querySelectorAll('article img')].slice(0,4).map(im=>im.decode()));});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');
    if(viewport.width===1440){
      await fs.mkdir('art/town/checks',{recursive:true});
      await page.evaluate(async()=>{
        const images=[...document.querySelectorAll('article img')];
        images.forEach(im=>im.loading='eager');await Promise.all(images.map(im=>im.decode()));
      });
      await page.screenshot({path:'art/town/checks/individual-objects-desktop.png'});
      await page.screenshot({path:'art/town/checks/individual-objects-full.png',fullPage:true});
    }
    await page.locator('article img').first().click();
    assert.equal(await page.locator('dialog').evaluate(d=>d.open),true);
    await page.locator('#close').click();
    await page.getByRole('button',{name:'Quadrant comparisons',exact:true}).click();
    assert.equal(await page.locator('article').count(),84);
    await page.getByRole('button',{name:'Ground & earlier studies',exact:true}).click();
    assert.ok(await page.getByText('NOT approved for buildings',{exact:false}).count()>0);
  }
  assert.deepEqual(errors,[]);
  console.log('Individual-object viewer passed desktop and portrait-phone checks.');
}finally{await browser.close();}
