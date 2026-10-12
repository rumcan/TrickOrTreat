import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({channel:'msedge'});
const sections=JSON.parse(await fs.readFile('art/town/section-audit.json','utf8'));
await fs.mkdir('art/town/checks/sections',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[],warnings=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.text().includes('[assets]'))warnings.push(m.text());});
 await page.goto(process.env.TOWN_URL||'http://127.0.0.1:5192/');
 await page.getByRole('button',{name:'Go trick-or-treating'}).waitFor({timeout:120000});
 const result=await page.evaluate(async()=>{
  const {buildMap,blockedCircle}=await import('/src/game/map.ts');
  const {TOWN_SITES,TOWN_CORRIDORS}=await import('/src/game/town-plan.ts');
  const {TOWN_ASSETS}=await import('/src/game/town-assets.ts');
  const {getTownProp,getTownDecal}=await import('/src/game/art/town.ts');
  const {allAssets}=await import('/src/game/assets.ts');
  const {G}=await import('/src/game/art/tiles.ts');
  const {Game}=await import('/src/game/engine.ts');
  const bad=[],stats=[];
  for(const a of TOWN_ASSETS)a.kind==='decal'?getTownDecal(a.id):getTownProp(a.id);
  const files=allAssets().filter(e=>e.spec.key.startsWith('town_')).map(e=>({key:e.spec.key,file:e.file}));
  for(const expanded of [false,true])for(const seed of [1337,7932,15851,23770,791903]){
   const input={keys:new Set(),pressed:new Set(),wheel:0,mouseActive:false,endFrame(){this.pressed.clear();}};
   const g=new Game(0,{hero:0,soul:0,best:0,talents:{}},input,expanded,seed);
   if(!g.tutorialHouse||!g.reachable(g.tutorialHouse.door.x,g.tutorialHouse.door.y))bad.push('locked tutorial route '+seed);
   const map=buildMap(seed,expanded);
   if(blockedCircle(map,map.start.x,map.start.y,.3))bad.push('blocked start '+seed);
   const newBuildings=map.props.filter(p=>TOWN_SITES.some(s=>'town_'+s.asset===p.kind));
   for(const p of newBuildings)for(const q of map.props){
    if(p===q||!q.big)continue;
    if(p.x0<q.x0+q.fw&&p.x0+p.fw>q.x0&&p.y0<q.y0+q.fh&&p.y0+p.fh>q.y0)bad.push('building overlap '+seed+' '+p.kind+' '+q.kind+' at '+q.x0+','+q.y0);
   }
   // Restore pre-blockade collision, retaining buildings/furniture; open gates.
   for(const g of map.gates)for(const [x,y]of g.cells)map.coll[y*376+x]=0;
   for(const b of map.barriers){let k=0;for(let y=b.y*4;y<(b.y+1)*4;y++)for(let x=b.x*4;x<(b.x+1)*4;x++)map.coll[y*376+x]=b.under[k++];}
   const step=.25,L=376,seen=new Uint8Array(L*L),queue=new Int32Array(L*L);
   const fits=(x,y)=>!blockedCircle(map,x*step,y*step,.24);
   const start=Math.round(map.start.y/step)*L+Math.round(map.start.x/step);
   let head=0,tail=0;seen[start]=1;queue[tail++]=start;
   while(head<tail){const n=queue[head++],x=n%L,y=Math.floor(n/L);for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){
    const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=L||yy>=L)continue;const i=yy*L+xx;
    if(!seen[i]&&fits(xx,yy)){seen[i]=1;queue[tail++]=i;}
   }}
   const reached=(point,r=1)=>{
    const x=Math.round(point.x/step),y=Math.round(point.y/step),n=Math.ceil(r/step);
    for(let j=-n;j<=n;j++)for(let i=-n;i<=n;i++){
     const xx=x+i,yy=y+j;if(xx>=0&&yy>=0&&xx<L&&yy<L&&seen[yy*L+xx]&&Math.hypot(xx*step-point.x,yy*step-point.y)<=r)return true;
    }return false;
   };
   for(const h of map.houses)if(!reached(h.door))bad.push('unreachable '+seed+' '+h.owner+' at '+h.door.x+','+h.door.y);
   for(const h of map.hideouts)if(!reached(h,2.5))bad.push('unreachable hideout '+seed+' '+JSON.stringify(h));
   for(const s of map.shops)if(!reached(s))bad.push('unreachable shop '+seed);
   for(const t of map.turrets)if(!reached(t,2.8))bad.push('unreachable turret '+seed);
   for(const s of TOWN_SITES)if(!map.houses.some(h=>h.prop.kind==='town_'+s.asset))bad.push('missing venue '+s.asset);
   for(const c of TOWN_CORRIDORS.filter(c=>c.type==='service'&&(!c.expandedOnly||expanded))){
    let paved=0;for(let y=c.y;y<c.y+c.h;y++)for(let x=c.x;x<c.x+c.w;x++)if(map.ground[y*94+x]===G.DRIVEWAY)paved++;
    if(paved<c.w*c.h*.6)bad.push('service lane lost '+c.name);
   }
   stats.push({seed,expanded,doors:map.houses.length,props:map.props.length,newBuildings:newBuildings.length,newFurniture:map.props.filter(p=>p.kind==='town_furniture').length,overlays:map.overlays.reduce((n,a)=>n+a.length,0)});
  }
  return {bad,stats,files};
 });
 await fs.writeFile('art/town/checks/layout-report.json',JSON.stringify(result,null,2));
 assert.deepEqual(result.bad,[]);
 assert.equal(result.files.length,35);assert.ok(result.files.every(e=>e.file?.startsWith('town/')),'All 35 painted assets must load, not vector fallbacks');
 await page.getByRole('button',{name:'Go trick-or-treating'}).click();
 await page.waitForFunction(()=>window.__tot?.game);
 const positions=[[32,33],[35,38],[33,44],[57,44],[35,39],[46,46],[22,34],[39,9],[35,16],[54,8],[65,16],[53,32],[61,30],[80,45],[57,68],[12,33],[16,45],[34,54],[12,59],[8,81],[41,80],[65,82],[82,84],[17,15],[5,20]];
 for(let i=0;i<sections.length;i++){
  const [x,y]=positions[i];
  await page.evaluate(async({x,y})=>{
   const {game:g,renderer}=window.__tot;
   const {buildMap}=await import('/src/game/map.ts');
   if(!window.__townReviewMap){
    const m=buildMap(1337,true);window.__townReviewMap=m;
    for(const gate of m.gates){gate.opened=true;for(const id of gate.propIds){const p=m.props.find(p=>p.id===id);if(p)p.removed=true;}}
    for(const barrier of m.barriers){barrier.cleared=true;if(barrier.prop)barrier.prop.removed=true;}
   }
   g.update=()=>{};g.map=window.__townReviewMap;g.state='play';g.hitStop=0;g.enemies=[];g.banner=null;
   g.time=0;g.p.hurtT=0;g.p.hp=g.stats.maxHp;g.p.invuln=0;g.tutorialHouse=null;
   g.p.x=x;g.p.y=y;g.camX=(x-y)*64;g.camY=(x+y)*32-40;
   renderer.render(g,0);
  },{x,y});
  await page.locator('canvas').first().screenshot({path:'art/town/checks/sections/'+sections[i].id+'.png'});
  // Gameplay now has no black lighting mask; the same scene is visible in both views.
  await page.locator('canvas').first().screenshot({path:'art/town/checks/sections/'+sections[i].id+'-placement.png'});
 }
 for(let batch=0;batch<3;batch++){
  const layers=[];
  for(let i=batch*9;i<Math.min(sections.length,batch*9+9);i++){
   const n=i-batch*9,label=Buffer.from('<svg width="480" height="24"><rect width="480" height="24" fill="#101923"/><text x="8" y="18" fill="white" font-size="15">'+sections[i].id+' '+sections[i].subsection+'</text></svg>');
   layers.push({input:await sharp('art/town/checks/sections/'+sections[i].id+'-placement.png').resize(480,300).composite([{input:label,left:0,top:0}]).png().toBuffer(),left:n%3*480,top:Math.floor(n/3)*300});
  }
  await sharp({create:{width:1440,height:900,channels:3,background:'#101923'}}).composite(layers).png().toFile('art/town/checks/section-contact-'+batch+'.png');
 }
 const mobile=[];
 for(const [width,height]of [[390,844],[844,390]]){
  await page.setViewportSize({width,height});
  const measure=await page.evaluate(()=>{
   const {game:g,renderer}=window.__tot;g.p.x=35;g.p.y=44;g.camX=-576;g.camY=2488;
   const timings=[];for(let i=0;i<30;i++){const t=performance.now();renderer.render(g,0);timings.push(performance.now()-t);}
   timings.sort((a,b)=>a-b);return {median:timings[15],p95:timings[28],horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1};
  });
  mobile.push({width,height,...measure});
  await page.locator('canvas').first().screenshot({path:'art/town/checks/mobile-'+width+'.png'});
 }
 await fs.writeFile('art/town/checks/mobile-report.json',JSON.stringify(mobile,null,2));
 assert.deepEqual(errors,[]);assert.deepEqual(warnings,[]);
 assert.ok(mobile.every(m=>!m.horizontalOverflow));
 console.log(JSON.stringify({stats:result.stats,mobile,paintedAssets:result.files.length,screenshots:sections.length,errors,warnings},null,2));
}finally{await browser.close();}
