import fs from 'node:fs/promises';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({channel:'msedge'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});await page.goto(process.env.TOT_ARCADE_URL||'http://127.0.0.1:5190/');
 await page.getByRole('button',{name:'Go trick-or-treating'}).waitFor({timeout:120000});await page.getByRole('button',{name:'Go trick-or-treating'}).click();
 await page.waitForFunction(()=>window.__tot?.game);
 await page.evaluate(()=>{const g=window.__tot.game;g.director=()=>{};g.enemies=[];g.state='play';Object.assign(g.p,g.map.houses.find(h=>h.prop.kind==='arcade').door);g.travelArcade('arcade');g.update=()=>{};g.time=0;g.p.skillCd=0;g.premiumPowerT=0;g.p.invuln=0;g.p.hurtT=0;g.p.hp=g.stats.maxHp;g.p.x=12;g.p.y=21;g.banner=null;g.toasts=[];});
 await fs.mkdir('art/arcade/v2',{recursive:true});
 await page.waitForTimeout(1600);
 for(const [name,x,y]of[['game-bays',10.5,16.5],['restaurant',26,19],['memorabilia',23,9.5],['stage',11,8],['concessions',27.5,17.2],['exit',17.7,29.7]]){
  await page.evaluate(({x,y})=>{const g=window.__tot.game;g.p.x=x;g.p.y=y;g.input.keys.clear();g.banner=null;g.toasts=[];g.computeFlow(true);},{x,y});
  await page.waitForTimeout(600);await page.screenshot({path:`art/arcade/v2/preview-${name}.png`});
 }
 console.log('Saved six in-game scale/alignment views.');
}finally{await browser.close();}
