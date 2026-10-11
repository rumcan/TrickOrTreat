import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({channel:'msedge'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.TOT_ARCADE_URL || 'http://127.0.0.1:5190/');
 await page.getByRole('button',{name:'Go trick-or-treating'}).waitFor({timeout:120000});
 await page.getByRole('button',{name:'Go trick-or-treating'}).click();
 await page.waitForFunction(()=>window.__tot?.game);
 const result=await page.evaluate(async()=>{
  const g=window.__tot.game;g.state='pause';
  const {buildArcadeMap}=await import('/src/game/arcade-map.ts');
  const {ARCADE_FIXTURES,ARCADE_SIZE,ARCADE_POIS,ARCADE_STAFF}=await import('/src/game/arcade-layout.ts');
  const {blockedCircle}=await import('/src/game/map.ts');
  const m=buildArcadeMap(),seen=new Set(),q=[m.start];
  const furniture=ARCADE_FIXTURES.filter(f=>f.kind!=='wall');
  for(let i=0;i<furniture.length;i++)for(let j=i+1;j<furniture.length;j++){
    const a=furniture[i],b=furniture[j];
    if(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y)throw Error(`Overlapping fixtures: ${a.kind} / ${b.kind}`);
  }
  // Navigation uses the player's actual collision radius, not just tile centres.
  for(let i=0;i<q.length;i++){
   const p=q[i],key=`${p.x},${p.y}`;if(seen.has(key)||blockedCircle(m,p.x,p.y,g.p.r))continue;seen.add(key);
   for(const [x,y]of[[p.x+.5,p.y],[p.x-.5,p.y],[p.x,p.y+.5],[p.x,p.y-.5]])if(!seen.has(`${x},${y}`))q.push({x,y});
  }
  const reachable=p=>q.some(c=>seen.has(`${c.x},${c.y}`)&&Math.hypot(c.x-p.x,c.y-p.y)<.75&&!blockedCircle(m,p.x,p.y,g.p.r));
  for(const p of [...ARCADE_POIS,...ARCADE_STAFF,...m.shops,...m.houses.map(h=>h.door)])if(!reachable(p))throw Error(`Unreachable arcade point ${JSON.stringify(p)}`);
  for(const p of [{x:1,y:17},{x:35,y:17},{x:17,y:1},{x:17,y:35}])if(!blockedCircle(m,p.x,p.y,g.p.r))throw Error('Room boundary leaks');
  const colors={cabinet:'#26a9df',pinball:'#d77332',skeeball:'#cf5734',airhockey:'#2862ac',foosball:'#aa893d',prizes:'#b638a2',pizza:'#e78036',booth:'#ac384f',stage:'#6d4998',photo:'#ba44b0',tokens:'#b39940',party:'#974e83',wall:'#323b54'};
  const rects=ARCADE_FIXTURES.map(f=>`<g><rect x="${f.x*18}" y="${f.y*18}" width="${f.w*18}" height="${f.h*18}" rx="2" fill="${colors[f.kind]||colors[f.kind.split('_')[0]]}" stroke="#fff" stroke-opacity=".3"/><title>${f.label}</title></g>`).join('')+m.props.filter(p=>p.kind?.startsWith('arcade_decor_')).map(p=>`<g><rect x="${p.x0*18}" y="${p.y0*18}" width="${p.fw*18}" height="${p.fh*18}" fill="#8d6651" stroke="#ffb86c"/><title>${p.kind}</title></g>`).join('');
  const pois=ARCADE_POIS.map(p=>`<text x="${p.x*18}" y="${p.y*18}" fill="#ffeabd" font-size="12" text-anchor="middle">${p.name}</text>`).join('');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="650" height="700" viewBox="0 0 650 700"><rect width="650" height="700" fill="#101525"/><text x="42" y="26" fill="#ffad4a" font-size="19">THE STARCADE · ${ARCADE_SIZE} × ${ARCADE_SIZE} tiles</text><rect x="36" y="36" width="576" height="576" fill="#20233c" stroke="#ec9142" stroke-width="4"/>${rects}${pois}<circle cx="306" cy="558" r="13" fill="#62f3b0"/><text x="42" y="670" fill="#fff" font-size="15">Compact bays · walkable piles · concessions crew · return to town</text></svg>`;
  const litter=m.overlays.reduce((sum,items)=>sum+items.length,0);
  if(litter<35||!m.props.some(p=>p.kind==='arcade_decor_bigfoot'))throw Error('The arcade is missing its lived-in clutter');
  if(new Set(m.overlays.flat()).size!==9)throw Error('All eight litter variants and the EXIT mat must appear');
  const {getArcadeExitMat}=await import('/src/game/art/arcade.ts');
  const {MAP_W}=await import('/src/game/config.ts');
  if(!m.overlays[30*MAP_W+16].includes(getArcadeExitMat())||!reachable({x:17,y:30.5}))throw Error('Exit mat missing or unreachable');
  if(!ARCADE_FIXTURES.some(f=>f.kind==='cabinet_back')||!ARCADE_FIXTURES.some(f=>f.kind==='pinball_back')||new Set(ARCADE_FIXTURES.filter(f=>f.kind.startsWith('cabinet')).map(f=>f.kind)).size!==5)throw Error('Machine orientation/design variation missing');
  if(m.props.filter(p=>p.kind==='arcade_decor_plant').length<35)throw Error('Additional plants missing');
  const {ARCADE_PILES}=await import('/src/game/arcade-clutter.ts');
  for(const p of ARCADE_PILES)if(blockedCircle(m,p.x+.5,p.y+.5,g.p.r))throw Error(`Clutter pile is not walkable: ${JSON.stringify(p)}`);
  // Tightened banks retain a real walking corridor, not just an apparent gap.
  for(const p of [{x:10.4,y:12},{x:8,y:12.5},{x:15,y:21.5},{x:28,y:20}])if(!reachable(p))throw Error(`Furniture aisle too tight: ${JSON.stringify(p)}`);
  if(m.props.some(p=>p.kind==='arcade_decor_chair'))throw Error('Rejected chair sprite is still placed');
  return {svg,size:ARCADE_SIZE,fixtures:m.props.length,reachable:seen.size,litter};
 });
 assert.equal(result.size,32);assert.ok(result.fixtures>40);
 await fs.mkdir('art/arcade',{recursive:true});await fs.writeFile('art/arcade/layout.svg',result.svg);
 const travel=await page.evaluate(async()=>{
  const {weaponStats}=await import('/src/game/data.ts');
  const g=window.__tot.game;g.director=()=>{};g.enemies=[];g.state='play';
  const door=g.map.houses.find(h=>h.prop.kind==='arcade').door;Object.assign(g.p,door);g.p.invuln=1e9;
  const map=g.map,coins=g.p.coins,level=g.p.level,gun=g.weapon.uid;
  g.openLevelUp('house',3,0);g.friendChoice=1;g.chooseFriend();
  if(!g.friends.some(f=>f.status==='rescued'))throw Error('Test friend was not recruited');
  g.updateInteract();if(g.interact?.kind!=='portal')throw Error('Arcade entrance must offer entry');
  g.input.pressed.add('e');g.updateInteract();if(g.map.kind!=='arcade')throw Error('E did not enter');
  const interior=g.map;g.enemies=[];g.dropPickup(18,27,'coin',17);const loot=g.pickups.at(-1);
  const viewR=g.viewR;g.viewR=40;g.computeFlow(true);let spawns=0;
  for(let i=0;i<30;i++)if(g.spawnPos(false))spawns++;
  g.viewR=viewR;if(spawns<5)throw Error('Compact room stopped spawning enemies on a large display');
  for(const f of g.friends)if(f.status==='rescued'&&Math.hypot(f.x-g.p.x,f.y-g.p.y)>3)throw Error('Friend did not enter with the player');
  g.state='pause';g.travelArcade('town');if(g.map!==interior)throw Error('Travel must not bypass paused states');g.state='play';
  Object.assign(g.p,interior.start);g.travelArcade('town');if(g.map!==map)throw Error('Town was rebuilt');
  if(Math.hypot(g.p.x-door.x,g.p.y-door.y)>.01)throw Error('Return point changed');
  if(g.p.coins!==coins||g.p.level!==level||g.weapon.uid!==gun)throw Error('Travel changed inventory');
  g.travelArcade('arcade');if(g.map!==interior||!g.pickups.includes(loot))throw Error('Room or loot reset on reentry');
  const boss=g.spawnEnemy('hex',18,24);g.boss=boss;g.travelArcade('town');if(g.map!==interior)throw Error('Portal bypassed boss encounter');g.boss=null;g.enemies=[];
  const e=g.spawnEnemy('zombie',18,24);g.rebuildGrid();const hp=e.hp;g.hitscan(18,27,0,-1,{...weaponStats(g.weapon,g.stats),dmg:10,range:5,pierce:0},'#ffcc55',null);if(!Number.isFinite(e.hp)||e.hp>=hp)throw Error('Interior combat did not hit');
  const indoorShops=g.map.shops.map(s=>[s.x,s.y]);
  const townEnemy=g.townScene.enemies[0]??{dead:false};g.townScene.enemies=[townEnemy];
  g.enemies=[];const indoorBoss=g.spawnEnemy('hex',18,24);g.boss=indoorBoss;g.killEnemy(indoorBoss);
  if(g.enemies.length||g.townScene.enemies.length||g.calmT!==20)throw Error('Interior boss did not clear both scenes and start the quiet window');
  if(JSON.stringify(indoorShops)!==JSON.stringify(g.map.shops.map(s=>[s.x,s.y])))throw Error('Indoor shops moved out of the room');
  g.state='play';Object.assign(g.p,interior.start);g.travelArcade('town');
  if(g.townShopMovePending||g.map!==map)throw Error('Deferred town shop refresh failed');
  g.travelArcade('arcade');g.enemies=[];g.state='play';g.p.x=9.5;g.p.y=16.5;g.hitStop=0;g.p.hurtT=0;g.p.hp=g.stats.maxHp;
  // A boss clear sets a one-frame interruption, normally consumed by update().
  g.bossBreak=false;g.computeFlow(true);for(let i=0;i<180;i++)g.updateTeam(1/30);
  if(g.friends.some(f=>f.status==='rescued'&&f.hp>0&&Math.hypot(f.x-g.p.x,f.y-g.p.y)>4))throw Error('Friend failed to keep up inside');
  if(![g.time,g.p.hp,g.p.x,g.p.y].every(Number.isFinite))throw Error('Transition corrupted run state');
  return {kind:g.map.kind,coins,level,fixtures:g.map.props.length};
 });
 assert.equal(travel.kind,'arcade');
 await page.evaluate(async()=>{
  const {game:g,renderer:r}=window.__tot,{getArcadeExitMat}=await import('/src/game/art/arcade.ts');
  const mat=getArcadeExitMat(),tiles=new Set(g.map.tiles),overlays=new Set(g.map.overlays.flat());
  const previous={x:g.p.x,y:g.p.y,state:g.state};
  Object.assign(g.p,{x:17.7,y:29.7});g.state='pause';g.bigMap=false;
  const original=r.ctx.drawImage;let floorStarted=false,matDraws=0;
  r.ctx.drawImage=function(img,...args){
    if(tiles.has(img)&&floorStarted)throw Error('A carpet tile painted over a floor overlay');
    if(overlays.has(img))floorStarted=true;
    if(img===mat)matDraws++;
    return original.call(this,img,...args);
  };
  try{r.render(g,.001);}finally{r.ctx.drawImage=original;}
  if(matDraws!==1||mat.width!==192||mat.height!==96)throw Error('Exit mat missing, clipped or scaled incorrectly');
  Object.assign(g.p,{x:previous.x,y:previous.y});g.state=previous.state;
 });
 await page.waitForTimeout(800);await page.screenshot({path:'art/arcade/gameplay.png'});
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({tiles:result.size**2,fixtures:result.fixtures,litterDecals:result.litter,reachableCells:result.reachable,persistentScene:true,combat:true}));
}finally{await browser.close();}
