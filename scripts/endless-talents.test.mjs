import {chromium} from 'playwright-core';
const browser=await chromium.launch({channel:'msedge'});
try{
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.TOT_URL||'http://127.0.0.1:5173/');
 await page.getByRole('button',{name:'Go trick-or-treating'}).waitFor({timeout:120000});
 const r=await page.evaluate(async()=>{
  const d=await import('/src/game/data.ts');
  const fail=(ok,msg)=>{if(!ok)throw Error(msg);};
  const sharp=d.TALENT_BY_ID.sharp,trigger=d.TALENT_BY_ID.trigger;
  fail(sharp.endless&&!trigger.endless,'Damage is endless, fire rate is not');
  const costs=[4,5,6,10,30].map(l=>d.talentCost(sharp,l));
  fail(costs.every((c,i)=>i===0||c>costs[i-1]),'Endless ranks must keep getting dearer: '+costs);
  const stats=t=>{const s=d.baseStats();d.applyTalents(s,t);return s;};
  fail(Math.abs(stats({sharp:60}).dmg/stats({}).dmg-4)<1e-9,'60 ranks of Sharp Teeth must give +300% damage');
  fail(stats({thick:105}).maxHp-stats({}).maxHp===1050,'Endless HP must keep adding');
  fail(Math.abs(stats({trigger:50}).rate/stats({trigger:3}).rate-1)<1e-9,'Capped talents stay capped');
  const st=await import('/src/game/storage.ts');
  st.setItem('tot_survivors_save_v1',JSON.stringify({soul:5,talents:{sharp:250,trigger:9},best:0,hero:0}));
  const save=d.loadSave();
  fail(save.talents.sharp===250&&save.talents.trigger===3,'A save keeps endless ranks and clamps capped ones: '+JSON.stringify(save.talents));
  st.setItem('tot_survivors_save_v1',JSON.stringify({soul:60,talents:{},best:0,hero:0}));
  return costs;
 });
 if(errors.length)throw Error(errors.join('\n'));
 console.log(`Endless talents: costs ${r.join(' → ')}; uncapped damage and HP; capped stats stay capped; saves keep endless ranks: PASS`);
}finally{await browser.close();}
