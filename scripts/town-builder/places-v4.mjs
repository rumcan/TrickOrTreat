/** Place presets v4 — owner's rules:
 *   1. Scale guide: a doorway is as tall as the Sheet Ghost's post at 0.98, so every building is placed at its measured
 *      guideScale (scale-guide.mjs, ~2x); props and cars stay at 1, trees ~1.7.
 *   2. Nothing repeats inside a preset: every sprite id is used once. Only continuous runs (hedge blocks, fence and wall
 *      segments) repeat, because a run is one fence, not many objects.
 *   4. Few decals: at most 4 per place (2 big leaf drifts, 1 litter, 1 stain) and only where they belong; no scatter.
 *   3. Built like the owner builds: hedged/fenced lots, packed beds hugging buildings, decorations clustered at doors.
 *  node scripts/town-builder/places-v4.mjs  ->  presets/places.json (+ thumbs, places-review/*.png). Seeded, repeatable. */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {ROOT} from '../lib/town-scene.mjs';
const OUT=path.join(ROOT,'output/town-builder'),LIB=path.join(OUT,'library'),PDIR=path.join(OUT,'presets');
const lib=JSON.parse(await fs.readFile(path.join(LIB,'library.json'),'utf8')),items=new Map(lib.items.filter(i=>!i.hidden).map(i=>[i.id,i]));
const SEGMENT=/^(world:hedge|world:fence_|gen:fence-|gen:wall-|expansion:(picket|chainlink|gate-chainlink|fence-privacy)-)/;
let seed=1;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;},rr=(a,b)=>a+rnd()*(b-a);
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const has=id=>items.has(id),ids=re=>[...items.keys()].filter(k=>re.test(k));
/** calibrated fence planes per kind and grid axis (any = one plane that mirrors onto the other axis) */
const FENCE={picket:{x:'expansion:picket-x',y:'expansion:picket-y'},garden:{x:'world:fence_picket_x',y:'world:fence_picket_y'},chain:{x:'expansion:chainlink-x',y:'expansion:chainlink-y',gate:{x:'expansion:gate-chainlink-x',y:'expansion:gate-chainlink-y'}},
 privacy:{x:'expansion:fence-privacy-x',y:'expansion:fence-privacy-y'},iron:{x:'world:fence_iron_x',y:'world:fence_iron_y'},rail:{any:'gen:fence-split-rail'},boards:{any:'gen:fence-privacy-wood'}};
const fenceAxisOf=it=>it.fence?.axis;

function Place(id,name,desc){
 const members=[],ground=[],occ=[],used=new Set();let decals=0;const DECAL_MAX=4;
 const box=(it,x,y,flip,sc,pad)=>{const b=it.base||{hx:it.fw,hy:it.fh,dx:0,dy:0};let hx=b.hx*sc,hy=b.hy*sc,ox=(b.dx||0)*sc,oy=(b.dy||0)*sc;if(flip){[hx,hy]=[hy,hx];[ox,oy]=[oy,ox];}
  return [x+ox-hx-pad,y+oy-hy-pad,x+ox+hx+pad,y+oy+hy+pad];};
 const hits=r=>occ.some(o=>r[0]<o[2]&&r[2]>o[0]&&r[1]<o[3]&&r[3]>o[1]);
 const P={used,
  /** place one sprite at its guide scale (o.mul multiplies it); refuses a repeat unless it is a fence/hedge/wall segment */
  put(sid,x,y,o={}){const it=items.get(sid);if(!it)return false;if(used.has(sid)&&!SEGMENT.test(sid))return false;if(it.flat&&decals>=DECAL_MAX)return false;const sc=+((o.scale??(it.guideScale||1))*(o.mul||1)).toFixed(3),flip=!!o.flip;
   if(!it.flat){const r=box(it,x,y,flip,sc,o.pad??.25);if(!o.force&&hits(r))return false;occ.push(r);}
   if(it.flat)decals++;used.add(sid);members.push({pick:[sid],dx:+x.toFixed(2),dy:+y.toFixed(2),flip,scale:[sc,sc],chance:1,jitter:0});return true;},
  /** half extents of a sprite's collision box at its guide scale (for laying out around it) */
  size(sid,mul=1){const it=items.get(sid),sc=(it.guideScale||1)*mul,b=it.base||{hx:it.fw,hy:it.fh};return {hx:b.hx*sc,hy:b.hy*sc};},
  keep(x0,y0,x1,y1){occ.push([x0,y0,x1,y1]);},
  /** try each unused id of a pool once, somewhere in the rectangle; returns how many landed */
  fill(pool,n,x0,y0,x1,y1,o={}){let k=0;for(const sid of shuffle(pool)){if(k>=n)break;if(used.has(sid))continue;for(let t=0;t<40;t++)if(P.put(sid,rr(x0,x1),rr(y0,y1),{flip:o.flip??rnd()<.5,pad:o.pad??.2,mul:o.mul})){k++;break;}}return k;},
  /** hedge blocks (2 m) along an axis-aligned line, slightly overlapped so the run reads as one hedge */
  hedge(x0,y0,x1,y1){const L=Math.hypot(x1-x0,y1-y0),n=Math.max(1,Math.round(L/1.8));for(let i=0;i<=n;i++)P.put('world:hedge',x0+(x1-x0)*i/n,y0+(y1-y0)*i/n,{force:true,scale:1});P.keep(Math.min(x0,x1)-1,Math.min(y0,y1)-1,Math.max(x0,x1)+1,Math.max(y0,y1)+1);},
  /** A fence run made of whole pieces laid end to end from the exact corner (x0,y0) towards (x1,y1) on one grid axis.
   *  Pieces are the calibrated fence planes (fence.lengthM); the run is rounded to whole pieces and returns its real end.
   *  o.gaps: [[from,to],...] along the run axis where pieces are left out (paths, drive gaps); o.gate puts gate leaves in the first gap. */
  fence(kind,x0,y0,x1,y1,o={}){const ax=Math.abs(x1-x0)>=Math.abs(y1-y0)?'x':'y',f=FENCE[kind];if(!f)throw Error('fence kind '+kind);
   const sid=f[ax]||f.any,it=items.get(sid);if(!it)return [x1,y1];const flip=!f[ax]&&fenceAxisOf(it)!==ax,L=it.fence.lengthM,a0=ax==='x'?x0:y0,a1=ax==='x'?x1:y1,dir=Math.sign(a1-a0)||1,n=Math.max(1,Math.round(Math.abs(a1-a0)/L));
   const at=u=>ax==='x'?[u,y0]:[x0,u],gaps=o.gaps||[];let gateDone=false;
   for(let i=0;i<n;i++){const c=a0+dir*(i+.5)*L,g=gaps.find(([p,q])=>c>Math.min(p,q)-.01&&c<Math.max(p,q)+.01);
    if(g){if(o.gate&&!gateDone&&f.gate){gateDone=true;const gi=items.get(f.gate[ax]),gl=gi.fence.lengthM,k=Math.max(1,Math.round(L/gl));for(let j=0;j<k;j++)P.put(f.gate[ax],...at(c-dir*L/2+dir*(j+.5)*gl),{force:true,scale:1});}continue;}
    P.put(sid,...at(c),{force:true,flip,scale:1});}
   const e=a0+dir*n*L,[ex,ey]=at(e);P.keep(Math.min(x0,ex)-.35,Math.min(y0,ey)-.35,Math.max(x0,ex)+.35,Math.max(y0,ey)+.35);return [ex,ey];},
  /** a closed fenced yard from corner (x0,y0) sized to whole pieces; o.gaps per side {S:[[a,b]],N:..,W:..,E:..}; returns the real rectangle */
  pen(kind,x0,y0,x1,y1,o={}){const f=FENCE[kind],L=items.get(f.x||f.any).fence.lengthM,W=Math.max(1,Math.round((x1-x0)/L))*L,H=Math.max(1,Math.round((y1-y0)/L))*L,X1=x0+W,Y1=y0+H,g=o.gaps||{},skip=o.skip||'';
   if(!skip.includes('N'))P.fence(kind,x0,y0,X1,y0,{gaps:g.N,gate:o.gate});if(!skip.includes('S'))P.fence(kind,x0,Y1,X1,Y1,{gaps:g.S,gate:o.gate});
   if(!skip.includes('W'))P.fence(kind,x0,y0,x0,Y1,{gaps:g.W,gate:o.gate});if(!skip.includes('E'))P.fence(kind,X1,y0,X1,Y1,{gaps:g.E,gate:o.gate});return {x0,y0,x1:X1,y1:Y1};},
  lot(l){ground.push({kind:'lot',...l});P.keep(Math.min(l.x0,l.x1),Math.min(l.y0,l.y1),Math.max(l.x0,l.x1),Math.max(l.y0,l.y1));},
  floor(l){ground.push({kind:'lot',...l});},pave(p){ground.push({kind:'pave',...p});},
  done(){return {id,name,group:'Places (full)',desc,members,ground,fixed:true,turn:false,mirror:false,count:members.length};}};
 return P;}
// pools (each id is used once per place)
const TREES=ids(/^(world:tree_(oak|pine)|ref:tree-)/),DEAD=ids(/^world:tree_dead/),PLANTS=ids(/^(world:bush_|town:(fern|hydrangea|ornamental_grass))/);
const DRIFTS=ids(/^(gen:drift-|town:leaf_drift)/),GRASS=ids(/^(decal:decal-0[1-5]|decal:scatter-grass-tufts|town:(bare_grass|mud_grass))/);
const LITTER=ids(/^(town:(paper|bag)_litter|poi:(candy-soda|newspaper-cup|pizza|flyer-tape)-litter|gen:litter-|expansion:(can|cloth)-litter)/);
const HALLOWEEN=ids(/^(ref:halloween-|world:pumpkin_|world:scarecrow|gen:(inflatable-pumpkin|yard-tombstones)|expansion:(blowmold-ghost|yard-coffin|yard-spider))/);
const CARS_N=ids(/^static:(compact_n|pickup_n)/),CARS_S=ids(/^static:compact_s/),CARS_E=ids(/^(static:(compact_e|van_e)|world:car_[02])/),CARS_W=ids(/^(static:compact_w|world:car_[13])/);
const BACKYARD=ids(/^expansion:(barbecue|lawn-chair|doghouse|canoe|camping-cooler|rain-barrel|garden-hose|rabbit-hutch|woodpile|hot-tub|washing-line|compost-bin|lawn-roller|patio-swing|brick-barbecue|garden-pump|kiddie-pool|firepit|rideon-mower|sandbox|birdhouse-post|leaf-bags|trampoline|basketball-hoop|satellite-dish|kennel|wooden-well|ivy-arbor|aboveground-pool)$/).concat(ids(/^gen:(birdbath-gnome|cooler-lawnchairs|kiddie-pool|kids-bikes|lawnmower|porch-rocker|wheelbarrow-leaves|trash-cans-row)$/));
const SCRAP=ids(/^expansion:(tyre-stack|junk-car|yard-workbench|utility-trailer|scrap-engine|appliance-pile|scrap-metal|scrap-pipes|oil-drums|pallet-stack|cement-bags|cable-spool|farm-tractor|scrap-pickup-rear|bike-scrap|forklift)$/);
const STREET=ids(/^(world:(mailbox|trashcan|hydrant|vending|bench)|town:(planter_terracotta|planter_square|phone_booth|bike_rack|street_sign|stop_sign|utility_pole|traffic_light)|gen:newspaper-box|expansion:(hydrant-yellow|utility-cabinet|parking-meter|yellow-bollard|rural-mailboxes|hvac-unit))$/);
const ODDS=ids(/^expansion:(crt-curb|milk-crates|wagon|tricycle|bicycle-rear|motorcycle-rear|shopping-cart|motorcycle-front|kiddie-car)$/);
const DOOR=['ref:halloween-pumpkin-cluster','ref:halloween-mums','world:pumpkin_0','world:pumpkin_1','ref:halloween-lantern'];
/** shared kit */
const BAY=2.7;
function kit(P){const K={
 /** building with its front (door) on the +Y side; returns its real collision rectangle and a point just outside the door */
 building(sid,cx,cy,o={}){const it=items.get(sid),sc=(it.guideScale||1)*(o.mul||1),b=it.base||{hx:it.fw,hy:it.fh,dx:0,dy:0};let hx=b.hx*sc,hy=b.hy*sc,ox=(b.dx||0)*sc,oy=(b.dy||0)*sc;if(o.flip){[hx,hy]=[hy,hx];[ox,oy]=[oy,ox];}
  P.put(sid,cx,cy,{force:true,flip:o.flip,mul:o.mul,pad:.4});const r={x0:cx+ox-hx,x1:cx+ox+hx,y0:cy+oy-hy,y1:cy+oy+hy};r.cx=(r.x0+r.x1)/2;r.door=[cx+ox+(o.doorDx||0),r.y1+.9];return r;},
 /** place a building so its collision box starts at x0 (left) with its front edge on frontY; returns the rect */
 at(sid,x0,frontY,o={}){const it=items.get(sid),sc=(it.guideScale||1)*(o.mul||1),b=it.base||{hx:it.fw,hy:it.fh,dx:0,dy:0};let hx=b.hx*sc,hy=b.hy*sc,ox=(b.dx||0)*sc,oy=(b.dy||0)*sc;if(o.flip){[hx,hy]=[hy,hx];[ox,oy]=[oy,ox];}
  return K.building(sid,x0+hx-ox,frontY-hy-oy,o);},
 bed(x0,y0,x1,y1,n){return P.fill(PLANTS,n,x0,y0,x1,y1,{pad:-.45});},
 trees(x0,y0,x1,y1,n,pool=TREES){return P.fill(pool,n,x0,y0,x1,y1,{pad:-.5});},
 drifts(x0,y0,x1,y1,n=2){return P.fill(DRIFTS,n,x0,y0,x1,y1);},
 litter(x0,y0,x1,y1){return P.fill(LITTER,1,x0,y0,x1,y1);},
 /** a little cluster at a door: n of the given pool within ~2 m of the step, never on the step itself */
 door([x,y],pool=DOOR,n=3){P.keep(x-.9,y-1,x+.9,y+1.2);return P.fill(pool,n,x-2.6,y-.6,x+2.6,y+1.4,{pad:-.35});},
 /** cars parked nose-in in a lot's painted bays (2.7 m apart), n of the slots used, spread out; cars face the right way */
 park(l,side,n){const b=l.bays.find(q=>q.side===side),dep=b.depth??5,slots=Math.floor((b.to-b.from)/BAY+1e-6),inset=.3+dep/2;
  const pool=side==='N'||side==='S'?NS_CARS:(side==='W'?W_CARS.concat(E_CARS):E_CARS.concat(W_CARS));
  const ks=shuffle([...Array(slots).keys()]).slice(0,Math.min(n,slots)).sort((a,c)=>a-c);let k=0,placed=0;const ids=side==='N'||side==='S'||side==='W'?shuffle(pool):shuffle(pool);
  for(const sid of ids){if(k>=ks.length)break;if(P.used.has(sid))continue;const u=b.from+(ks[k]+.5)*BAY;
   const x=side==='N'||side==='S'?u:(side==='W'?Math.min(l.x0,l.x1)+inset:Math.max(l.x0,l.x1)-inset),y=side==='N'?Math.min(l.y0,l.y1)+inset:side==='S'?Math.max(l.y0,l.y1)-inset:u;
   if(P.put(sid,x,y,{force:true}))placed++;k++;}return placed;}};return K;}
const NS_CARS=ids(/^static:(compact_n|compact_n-v2|pickup_n|pickup_n-v2|compact_s)$/),W_CARS=ids(/^(static:compact_w|world:car_[13])$/),E_CARS=ids(/^(static:(compact_e|van_e|van_e-v2)|world:car_[02])$/);
const places=[];

// =====================================================================================  1. HIGH SCHOOL
{seed=401;const P=Place('place-high-school','Maple Falls High School','The brick high school with planted beds along its front, a slab forecourt with bike rack, benches and the bus stop, the school bus in the drop-off lane, a staff car park on the east side, and the football field with bleachers behind a chain-link fence.'),K=kit(P);
 const S=K.building('world:school',0,0);
 // forecourt + drop-off lane
 const F={x0:S.x0-1,y0:S.y1,x1:S.x1+1,y1:S.y1+7};P.floor({surface:'slab',border:'curb',...F});K.bed(S.x0,S.y1+.2,S.door[0]-2.5,S.y1+1.6,7);K.bed(S.door[0]+2.5,S.y1+.2,S.x1,S.y1+1.6,7);K.door(S.door,['ref:halloween-pumpkin-cluster','ref:halloween-mums','ref:halloween-witch-sign'],3);
 P.keep(S.door[0]-1.5,S.y1,S.door[0]+1.5,F.y1);
 P.put('town:bike_rack',S.x0+3,F.y1-2.2,{force:true});P.put('gen:kids-bikes',S.x0+6,F.y1-2,{force:true});P.put('world:bench',S.door[0]-5,F.y1-1.5,{force:true});P.put('world:trashcan',S.door[0]-3.2,F.y1-1.2,{force:true});
 P.put('town:planter_square',S.door[0]+3.4,F.y1-1.6,{force:true});P.put('world:vending',S.x1-3,S.y1+2.6,{force:true});P.put('gen:newspaper-box',S.x1-5,S.y1+2.4,{force:true});
 const D={x0:F.x0,y0:F.y1,x1:F.x1,y1:F.y1+7};P.lot({surface:'asphalt',border:'curb',...D});P.put('world:schoolbus',S.cx-3,D.y0+3.4,{force:true});P.put('town:bus_stop',S.cx+8,F.y1-1.4,{force:true});
 P.put('world:streetlamp',F.x0+.6,F.y1-.6,{force:true});P.put('world:streetlamp',F.x1-.6,F.y1-.6,{force:true});P.put('town:stop_sign',D.x1+.8,D.y1-.6,{force:true});K.litter(F.x0+2,F.y0+3,F.x1-2,F.y1-.5);
 // staff car park east: W and E bays
 const C={surface:'asphalt',border:'curb',x0:S.x1+3,y0:S.y0,x1:S.x1+3+17,y1:D.y1,bays:[{side:'W',from:S.y0+1.5,to:S.y0+1.5+8*BAY,depth:5},{side:'E',from:S.y0+1.5,to:S.y0+1.5+8*BAY,depth:5}]};P.lot(C);
 K.park(C,'W',4);K.park(C,'E',4);P.put('town:dumpster',C.x0+8.5,C.y0+1.4,{force:true});P.put('expansion:hvac-unit',S.x1+1.6,S.y0+5,{force:true});P.put('expansion:utility-cabinet',S.x1+1.4,S.y0+9,{force:true});
 // field west behind chain-link
 const fx1=S.x0-4,Fd=P.pen('chain',fx1-48,S.y0,fx1,D.y1,{gaps:{E:[[S.y1-4,S.y1]]},gate:true});P.floor({surface:'field',border:'none',x0:Fd.x0+.5,y0:Fd.y0+.5,x1:Fd.x1-.5,y1:Fd.y1-.5});
 P.put('world:bleachers',(Fd.x0+Fd.x1)/2,Fd.y0+3,{force:true});P.put('world:goalposts',Fd.x0+3,(Fd.y0+Fd.y1)/2,{force:true});P.put('world:scoreboard',Fd.x1-3,Fd.y0+2,{force:true});
 // trees behind and between
 K.trees(S.x0-3,S.y0-8,S.x1+18,S.y0-2,6,TREES.filter(t=>/pine|spruce|oak/.test(t)));K.trees(fx1+.5,S.y0+2,S.x0-.8,S.y1-2,2);K.bed(fx1+.5,S.y0+1,S.x0-.6,S.y1-1,6);K.drifts(S.x0-3,S.y0-6,S.x1,S.y0-1,1);
 places.push(P.done());}

// =====================================================================================  2. STRIP MALL
{seed=402;const P=Place('place-strip-mall','Hollow Plaza strip mall','Four shops in a row behind a covered sidewalk, each door dressed differently, a short row of marked bays in front with a few cars, a side lot, and the shop backs with dumpsters and pallets along a fenced service alley.'),K=kit(P);
 const shops=['town:hardware','town:laundromat','town:bakery','town:pharmacy'];let x=0;const B=[];for(const sid of shops){const r=K.at(sid,x,0);B.push(r);x=r.x1+.3;}const R=x-.3;
 const W={x0:-.5,y0:0,x1:R+.5,y1:5};P.floor({surface:'slab',border:'curb',...W});
 const dress=[['town:delivery_crates','expansion:pallet-stack','ref:halloween-witch-sign'],['world:vending','expansion:milk-crates','town:planter_square'],['town:produce_stand','ref:halloween-pumpkin-cluster','town:planter_terracotta'],['gen:newspaper-box','world:bench','ref:halloween-mums']];
 B.forEach((r,i)=>{P.keep(r.door[0]-1.2,0,r.door[0]+1.2,3.4);P.fill(dress[i],3,r.x0+.6,.6,r.x1-.6,3.8,{flip:false});});
 P.put('world:streetlamp',W.x0+.6,W.y1-.5,{force:true});P.put('world:streetlamp',R/2,W.y1-.5,{force:true});P.put('world:streetlamp',W.x1-.6,W.y1-.5,{force:true});P.put('world:hydrant',R*.25,W.y1-.6,{force:true});P.put('world:trashcan',R*.75,W.y1-.7,{force:true});K.litter(0,1,R,4.6);
 const L={surface:'asphalt',border:'curb',x0:-.5,y0:5,x1:R+.5,y1:20,bays:[{side:'N',from:3,to:3+Math.floor((R-6)/BAY)*BAY,depth:5}]};P.lot(L);K.park(L,'N',5);P.put('expansion:shopping-cart',R*.6,13,{force:true});P.fill(['town:oil_stain'],1,4,7,R-4,9);
 const L2={surface:'asphalt',border:'curb',x0:R+.5,y0:-6,x1:R+13,y1:20,bays:[{side:'E',from:-4,to:-4+8*BAY,depth:5}]};P.lot(L2);K.park(L2,'E',4);
 // backs + alley behind (north)
 const top=Math.min(...B.map(r=>r.y0));P.floor({surface:'asphalt',border:'none',x0:-.5,y0:top-8,x1:R+.5,y1:top});P.fence('chain',-.5,top-8,R+.5,top-8);
 P.fill(['town:dumpster','gen:trash-cans-row','expansion:oil-drums','expansion:hvac-unit','expansion:cement-bags','gen:rubbish-bags'],6,0,top-7.2,R,top-.8,{flip:false});
 K.trees(-6,top-6,-2,18,3);K.bed(-4.5,top,-1.2,18,7);K.drifts(-4,top,-1,6,1);
 places.push(P.done());}

// =====================================================================================  3. FARM
{seed=403;const P=Place('place-farm','Hollow Creek Farm','Farmhouse in a picket-fenced yard with a planted front and porch pumpkins, the barn, silo, windmill and shed around a dirt yard with tractor, pickup, well and trailer, the chicken coop in its own run, a glasshouse, and a split-rail pumpkin patch with scarecrow and hay.'),K=kit(P);
 // farmhouse in a picket yard (yard sized to whole 4 m pieces)
 const H=K.building('gen:house-farmhouse-wrap',0,0);const Y=P.pen('picket',H.x0-4,H.y0-4,H.x1+4,H.y1+8,{gaps:{S:[[H.door[0]-2,H.door[0]+2]]}});
 K.door(H.door,['ref:halloween-mums','ref:halloween-lantern','gen:porch-rocker'],3);K.bed(H.x0+.3,H.y1+.3,H.door[0]-2.4,H.y1+2,6);K.bed(H.door[0]+2.4,H.y1+.3,H.x1-.3,H.y1+2,6);
 P.fill(['gen:birdbath-gnome','expansion:washing-line','expansion:birdhouse-post','expansion:rain-barrel'],4,Y.x0+1,H.y1+3,Y.x1-1,Y.y1-1);P.put('world:mailbox',H.door[0]+3,Y.y1+1,{force:true});K.trees(Y.x0+.8,Y.y0+.8,Y.x0+3,H.y1,1);
 // yard with barn, silo, windmill, shed
 const yx=Y.x1+6;const Bn=K.at('world:barn',yx+4,Y.y0+14);P.put('ref:landmark-silo',Bn.x1+4,Bn.y0+4,{force:true});
 const yd={x0:yx,y0:Bn.y1,x1:Bn.x1+12,y1:Y.y1+6};P.floor({surface:'dirt',border:'none',...yd});P.put('ref:landmark-windmill',yd.x1-3,yd.y0+4,{force:true});K.building('ref:building-farm-shed',yd.x1+5,yd.y1-6);
 P.put('expansion:farm-tractor',Bn.cx-4,Bn.y1+4,{force:true});P.put('static:pickup_n',yd.x0+4,yd.y1-4,{force:true});P.fill(['expansion:wooden-well','expansion:utility-trailer','ref:halloween-hay-bales','expansion:oil-drums','town:delivery_crates','gen:wheelbarrow-leaves'],6,yd.x0+2,yd.y0+2,yd.x1-2,yd.y1-2);P.put('expansion:mud-tracks-x',Bn.cx,Bn.y1+5,{force:true});
 // chicken run + glasshouse behind the house
 const Cp=P.pen('garden',H.x0-4,Y.y0-14,H.x0+8,Y.y0-2,{gaps:{S:[[H.x0+2,H.x0+4]]}});K.building('expansion:chicken-coop',Cp.x0+4,Cp.y0+4);P.fill(['expansion:compost-bin'],1,Cp.x0+1,Cp.y0+1,Cp.x1-1,Cp.y1-1);
 K.building('expansion:glasshouse',H.x1-4,Y.y0-7);
 // pumpkin patch: split rail (8 m pieces) on dirt
 const Pp=P.pen('rail',H.x0-4,Y.y1+6,H.x0+20,Y.y1+22,{gaps:{N:[[H.x0+4,H.x0+12]]}});P.floor({surface:'dirt',border:'none',x0:Pp.x0+.5,y0:Pp.y0+.5,x1:Pp.x1-.5,y1:Pp.y1-.5});
 P.fill(['world:pumpkin_0','world:pumpkin_1','ref:halloween-pumpkin-cluster','world:scarecrow','gen:inflatable-pumpkin'],5,Pp.x0+2,Pp.y0+2,Pp.x1-2,Pp.y1-2,{pad:.6});
 // lane stand
 P.put('world:candy_stand',Pp.x1+5,Pp.y1-3,{force:true});P.put('town:produce_stand',Pp.x1+5,Pp.y1-7,{force:true});P.put('expansion:wagon',Pp.x1+8,Pp.y1-5,{force:true});
 K.trees(Y.x0-8,Y.y0-20,yd.x1+10,Y.y0-14,6,TREES.filter(t=>/pine|spruce/.test(t)));K.trees(yd.x1+8,yd.y0,yd.x1+12,yd.y1,2);K.drifts(Y.x0,Y.y1-2,Y.x1,Y.y1+2,1);K.drifts(yd.x0,yd.y1-2,yd.x1,yd.y1,1);
 places.push(P.done());}

// =====================================================================================  4. CHURCHYARD
{seed=404;const P=Place('place-cemetery','Old Hollow churchyard','The white church with a slab path to its door, the graveyard beside it inside an iron fence with a gateway: weathered graves, tombstones, a coffin, the crypt and mausoleum, a blow-mold ghost, dead trees and lanterns. Each grave and decoration is different.'),K=kit(P);
 const C=K.building('world:church',0,0);P.pave({x0:C.door[0]-1.5,y0:C.y1,x1:C.door[0]+1.5,y1:C.y1+10,border:'none'});P.keep(C.door[0]-1.6,C.y1,C.door[0]+1.6,C.y1+10);
 K.door(C.door,['ref:halloween-lantern','ref:halloween-mums'],2);K.bed(C.x0+.3,C.y1+.3,C.door[0]-2,C.y1+1.8,5);K.bed(C.door[0]+2,C.y1+.3,C.x1-.3,C.y1+1.8,5);
 // graveyard to the east, iron fence 2 m pieces with a 4 m gateway on the south side
 const G=P.pen('iron',C.x1+3,C.y0-2,C.x1+27,C.y1+8,{gaps:{S:[[C.x1+11,C.x1+15]]}});P.put('ref:halloween-lantern',G.x0+8,G.y1+.8,{force:true,flip:true});
 K.building('world:crypt',G.x1-4,G.y0+4);K.building('ref:building-mausoleum',G.x0+6,G.y0+5,{mul:.75});
 const graves=['world:grave_0','world:grave_1','world:grave_2','gen:yard-tombstones','expansion:yard-coffin'];graves.forEach((g,i)=>P.put(g,G.x0+4+(i%3)*6+rr(-.6,.6),G.y0+13+Math.floor(i/3)*5+rr(-.5,.5),{force:true}));
 P.fill(['expansion:blowmold-ghost','ref:halloween-sheet-ghost','world:pumpkin_0','expansion:yard-spider'],4,G.x0+2,G.y0+11,G.x1-2,G.y1-2,{pad:.4});
 K.trees(G.x0+1,G.y0+1,G.x1-1,G.y1-1,3,DEAD);K.bed(G.x1-3,G.y0+9,G.x1-.6,G.y1-1,5);K.trees(C.x0-6,C.y0-4,C.x0-1,C.y1,3,TREES.filter(t=>/pine|spruce/.test(t)));
 P.put('world:streetlamp',C.door[0]-2.4,C.y1+9.4,{force:true});P.put('world:bench',C.x0+3,C.y1+5,{force:true});K.drifts(G.x0+1,G.y1-4,G.x1-1,G.y1-.5,2);
 places.push(P.done());}

// =====================================================================================  5. FALL FESTIVAL
{seed=405;const P=Place('place-fall-festival','Harvest Fall Festival','A hedge-ringed green: the gazebo on a slab plaza, a row of stalls with hay and pumpkins, picnic area with fire pit, a playground, Halloween yard pieces and a small visitor car park.'),K=kit(P);
 P.floor({surface:'slab',border:'curb',x0:-7,y0:-7,x1:7,y1:7});P.put('world:gazebo',0,0,{force:true});P.put('world:bench',-5.6,4.5,{force:true});P.put('ref:halloween-lantern',5.4,5.4,{force:true});P.put('town:planter_square',5.6,-5.6,{force:true});P.put('town:planter_terracotta',-5.6,-5.6,{force:true});
 ['world:candy_stand','town:produce_stand','world:snack_bar'].forEach((sid,i)=>K.at(sid,-22+i*15,-11));P.fill(['ref:halloween-hay-bales','world:pumpkin_0','world:pumpkin_1','ref:halloween-pumpkin-cluster','ref:halloween-mums','ref:halloween-witch-sign','world:trashcan'],7,-24,-10.4,24,-8);
 P.floor({surface:'dirt',border:'none',x0:-24,y0:9,x1:-11,y1:20});P.fill(['town:picnic_table','expansion:firepit','gen:cooler-lawnchairs','expansion:camping-cooler'],4,-23,10,-12,19,{pad:.5});
 P.floor({surface:'dirt',border:'none',x0:11,y0:9,x1:24,y1:20});P.put('world:junglegym_0',14.5,12.5,{force:true});P.put('world:swings',20.5,12.5,{force:true});P.put('world:merrygoround',17.5,17.5,{force:true});P.put('world:bench',22,18.5,{force:true,flip:true});
 P.fill(['gen:inflatable-pumpkin','expansion:blowmold-ghost','expansion:yard-spider','world:scarecrow','ref:halloween-sheet-ghost'],5,-9,9,9,20,{pad:.6});
 P.hedge(-27,-22,27,-22);P.hedge(-27,-22,-27,23);P.hedge(27,-22,27,23);P.hedge(-27,23,-3,23);P.hedge(3,23,27,23);K.trees(-33,-22,-29,22,3);K.trees(29,-22,33,22,3);
 const L={surface:'asphalt',border:'curb',x0:-26,y0:25,x1:26,y1:33,bays:[{side:'S',from:-24,to:-24+18*BAY,depth:5}]};P.lot(L);K.park(L,'S',5);P.put('world:streetlamp',0,25.5,{force:true});
 K.drifts(-26,-21,-8,22,1);K.drifts(8,-21,26,22,1);K.litter(-10,-6,10,8);
 places.push(P.done());}

// =====================================================================================  6. MAPLE LANE
{seed=406;const P=Place('place-maple-lane','Maple Lane — three homes','Three different houses on fenced lots: each with its own garage, driveway and car, a picket front fence with a path gap, a privacy fence behind, beds along the front, a different front-yard story and a different backyard.'),K=kit(P);
 const homes=[['gen:house-l-shape','static:garage_brick'],['gen:house-splitlevel','static:garage_timber'],['gen:house-l-ranch','static:garage_timber-v2']];
 const stories=[['gen:inflatable-pumpkin','expansion:blowmold-ghost','gen:yard-tombstones','expansion:yard-spider','ref:halloween-sheet-ghost'],['gen:kids-bikes','gen:lawnmower','gen:wheelbarrow-leaves','expansion:tricycle','expansion:leaf-bags'],['gen:birdbath-gnome','ref:halloween-hay-bales','world:scarecrow','expansion:birdhouse-post','gen:porch-rocker']];
 const backs=[['expansion:barbecue','gen:cooler-lawnchairs','expansion:firepit','expansion:patio-swing'],['expansion:trampoline','expansion:doghouse','expansion:sandbox','expansion:basketball-hoop'],['expansion:hot-tub','expansion:compost-bin','expansion:rain-barrel','expansion:washing-line']];
 const doorSets=[['ref:halloween-pumpkin-cluster','ref:halloween-lantern'],['world:pumpkin_0','ref:halloween-mums'],['world:pumpkin_1','ref:halloween-witch-sign']];
 let x=0;const front=14;
 homes.forEach(([h,g],i)=>{const lot0=x,H=K.at(h,x+2,0),G=K.at(g,H.x1+2,0);const lot1=Math.ceil((G.x1+2-lot0)/4)*4+lot0;
  P.floor({surface:'asphalt',border:'none',x0:G.x0+.3,y0:G.y1,x1:G.x1-.3,y1:front+1});const cars=NS_CARS.filter(c=>!P.used.has(c));P.put(cars[i%cars.length],(G.x0+G.x1)/2,G.y1+4.2,{force:true});
  P.fence('picket',lot0,front,G.x0,front,{gaps:[[H.door[0]-2,H.door[0]+2]]});P.pave({x0:H.door[0]-1,y0:H.y1,x1:H.door[0]+1,y1:front+1,border:'none'});P.keep(H.door[0]-1.1,H.y1,H.door[0]+1.1,front);
  K.door(H.door,doorSets[i],2);K.bed(H.x0+.3,H.y1+.3,H.door[0]-2,H.y1+1.8,5);K.bed(H.door[0]+2,H.y1+.3,H.x1-.3,H.y1+1.8,4);
  P.fill(stories[i],4,lot0+1,H.y1+3,G.x0-1,front-1,{pad:.4});K.trees(lot0+1,H.y1+2.5,lot0+4,front-1.5,1);P.put(i===1?'expansion:rural-mailboxes':'world:mailbox',H.door[0]+2.6,front+.9,{force:true});
  const back=Math.min(H.y0,G.y0)-9;P.fence('privacy',lot0,back,lot1,back);P.fill(backs[i],4,lot0+1,back+1,lot1-1,Math.min(H.y0,G.y0)-.8,{pad:.4});
  if(i>0)P.fence('privacy',lot0,back,lot0,Math.min(H.y0,G.y0)+2);K.bed(G.x1+.4,G.y0,lot1-.4,G.y1,3);x=lot1;});
 P.pave({x0:0,y0:front+1,x1:x,y1:front+3.5,border:'none'});P.put('world:hydrant',x/2,front+3.2,{force:true});P.put('world:streetlamp',.6,front+3.2,{force:true});P.put('world:streetlamp',x-.6,front+3.2,{force:true});
 K.drifts(0,front-2,x,front,2);
 places.push(P.done());}

// =====================================================================================  7. BACKYARDS
{seed=407;const P=Place('place-backyards','Backyards on Birch Street','The backs of three houses, each yard a different life (barbecue party, garden and hot tub, kids and pets), divided by chain-link and picket fences that run to a privacy fence along the alley.'),K=kit(P);
 const backs=['gen:back-bbq-deck','gen:back-screened-porch','gen:back-swingset'];let x=0;const yards=[];
 for(const b of backs){const H=K.at(b,x+2,0);const x1=Math.ceil((H.x1+2-x)/4)*4+x;yards.push({x0:x,x1,H});x=x1;}
 const yb=Math.max(...yards.map(y=>y.H.y1))+12,yt=Math.min(...yards.map(y=>y.H.y0));
 P.fence('chain',yards[1].x0,yt,yards[1].x0,yb);P.fence('picket',yards[2].x0,yt,yards[2].x0,yb);P.fence('privacy',0,yb,x,yb);
 const sets=[['expansion:barbecue','expansion:brick-barbecue','gen:cooler-lawnchairs','town:picnic_table','expansion:firepit','ref:halloween-lantern'],['expansion:hot-tub','gen:birdbath-gnome','expansion:garden-pump','expansion:glasshouse','expansion:rain-barrel','expansion:garden-hose'],['expansion:trampoline','expansion:doghouse','expansion:sandbox','gen:kids-bikes','expansion:rabbit-hutch','expansion:kiddie-car']];
 yards.forEach((y,i)=>{P.fill(sets[i],6,y.x0+1.2,y.H.y1+1.5,y.x1-1.2,yb-1.2,{pad:.45});K.bed(y.x0+.5,y.H.y1+.3,y.x0+4,y.H.y1+2,4);K.trees(y.x1-4,yb-4,y.x1-1,yb-1,1);});
 P.fill(['gen:trash-cans-row','expansion:leaf-bags'],2,1,yb+.8,x-1,yb+2);K.drifts(0,yb-3,x,yb-.5,2);
 places.push(P.done());}

// =====================================================================================  8. THE HALLOWEEN HOUSE
{seed=408;const P=Place('place-halloween-house','The Halloween house','One house that goes all out: an iron fence with a gateway, a front-yard graveyard of every tombstone and the coffin, the inflatable pumpkin and blow-mold ghost, a giant spider, a dead tree with a sheet ghost, scarecrow, hay, lanterns and the candy stand at the gate.'),K=kit(P);
 const H=K.building('gen:house-duplex',0,0);const Y=P.pen('iron',H.x0-2,H.y0+4,H.x1+2,H.y1+14,{skip:'N',gaps:{S:[[H.door[0]-2,H.door[0]+2]]}});
 P.pave({x0:H.door[0]-1.1,y0:H.y1,x1:H.door[0]+1.1,y1:Y.y1+1,border:'none'});P.keep(H.door[0]-1.2,H.y1,H.door[0]+1.2,Y.y1+1);K.door(H.door,['ref:halloween-pumpkin-cluster','ref:halloween-lantern','ref:halloween-mums'],3);
 ['world:grave_0','world:grave_1','world:grave_2','gen:yard-tombstones','expansion:yard-coffin'].forEach((g,i)=>P.put(g,Y.x0+2.5+(i%3)*3.2,H.y1+4+Math.floor(i/3)*4.2,{force:true}));
 P.put('world:tree_dead_1',H.x1-3,H.y1+4,{force:true});P.put('ref:halloween-sheet-ghost',H.x1-5.5,H.y1+5.5,{force:true});
 P.fill(['gen:inflatable-pumpkin','expansion:blowmold-ghost','expansion:yard-spider','world:scarecrow','ref:halloween-hay-bales'],5,H.door[0]+2.5,H.y1+7,Y.x1-1,Y.y1-1,{pad:.4});
 P.put('world:candy_stand',H.door[0]+4.5,Y.y1+2.2,{force:true});P.put('ref:halloween-witch-sign',H.door[0]-2.8,Y.y1+1.2,{force:true});P.put('world:mailbox',Y.x0+1,Y.y1+1,{force:true});
 K.bed(H.x0+.3,H.y1+.3,H.door[0]-2,H.y1+1.8,5);K.bed(H.door[0]+2,H.y1+.3,H.x1-.3,H.y1+1.8,4);K.trees(H.x0-6,H.y0-6,H.x0-2,H.y1,2,DEAD.concat(TREES));K.drifts(Y.x0,Y.y1-3,Y.x1,Y.y1-.4,2);
 places.push(P.done());}

// =====================================================================================  9. DRIVE-IN
{seed=409;const P=Place('place-drive-in','Moonlite Drive-In','The big screen over an asphalt field, the few cars of a quiet night all facing it beside speaker posts, the snack bar behind, the marquee at the gate, chain-link sides and popcorn litter.'),K=kit(P);
 P.put('world:drivein_screen',0,-18,{force:true});const A={x0:-24,y0:-15,x1:24,y1:16};P.floor({surface:'asphalt',border:'none',...A});
 const cars=NS_CARS.filter(c=>/_n/.test(c)).concat(['expansion:stationwagon-rear']);const spots=shuffle([[-14,-6],[-5,-6],[5,-6],[14,-6],[-10,2],[0,2],[10,2]]);cars.forEach((c,i)=>{const [x,y]=spots[i];P.put(c,x,y,{force:true});});
 P.put('world:speaker_post',-9.5,-6.5,{force:true});P.put('world:snack_bar',0,A.y1+9,{force:true});P.fill(['world:vending','gen:trash-cans-row','world:bench'],3,-9,A.y1+.5,9,A.y1+2.5,{flip:false});
 P.put('world:drivein_marquee',A.x1+3,A.y1+4,{force:true});K.litter(-20,-10,20,12);P.fill(['town:oil_stain'],1,-20,-10,20,12);
 P.fence('chain',A.x0-.5,A.y0-4,A.x0-.5,A.y1);P.fence('chain',A.x1+.5,A.y0-4,A.x1+.5,A.y1);K.trees(A.x0-8,A.y0-6,A.x0-2,A.y1,3);K.trees(A.x1+2,A.y0-6,A.x1+8,A.y1,3);K.bed(A.x0-3,A.y0,A.x0-1,A.y1,5);
 places.push(P.done());}

// =====================================================================================  10. VIDEO VAULT & STARCADE
{seed=410;const P=Place('place-video-arcade','Video Vault & Starcade','The video store and the arcade side by side on one sidewalk: tape return, standee, VHS carton, skates, bikes, phone booth and a kerb TV, with a short row of bays in front.'),K=kit(P);
 const V=K.at('world:video_rental',0,0),A=K.at('world:arcade',V.x1+1,0);const W={x0:V.x0-.5,y0:0,x1:A.x1+.5,y1:5};P.floor({surface:'slab',border:'curb',...W});
 P.keep(V.door[0]-1.2,0,V.door[0]+1.2,3.4);P.keep(A.door[0]-1.2,0,A.door[0]+1.2,3.4);
 P.fill(['poi:tape-return','poi:movie-display','poi:vhs-carton','town:phone_booth'],4,V.x0+.6,.6,V.x1-.6,4,{flip:false});P.fill(['poi:skates-crate','town:bike_rack','gen:kids-bikes','world:vending','expansion:crt-curb'],5,A.x0+.6,.6,A.x1-.6,4,{flip:false});
 K.door([V.door[0]+2.4,V.door[1]],['ref:halloween-pumpkin-cluster'],1);P.put('world:streetlamp',(V.x1+A.x0)/2,W.y1-.5,{force:true});K.litter(W.x0,1,W.x1,4.6);
 const L={surface:'asphalt',border:'curb',x0:W.x0,y0:5,x1:W.x1,y1:18,bays:[{side:'S',from:W.x0+2,to:W.x0+2+Math.floor((W.x1-W.x0-4)/BAY)*BAY,depth:5}]};P.lot(L);K.park(L,'S',4);
 K.trees(V.x0-6,V.y0,V.x0-2,16,2);K.bed(V.x0-4,V.y0+1,V.x0-.8,16,6);K.trees(A.x1+2,A.y0,A.x1+6,16,2);P.hedge(V.x0,Math.min(V.y0,A.y0)-2,A.x1,Math.min(V.y0,A.y0)-2);
 places.push(P.done());}

// =====================================================================================  11. CORNER GARDEN
{seed=411;const P=Place('place-corner-garden','Corner pocket garden','A walled pocket garden with an arbour entrance: brick wall and hedge, a paved path, birdbath, bench, maple, lantern, and packed beds of every plant.'),K=kit(P);
 P.put('gen:wall-brick-low',-6,-10,{force:true});P.put('gen:wall-brick-low',6,-10,{force:true});P.hedge(-10.5,-9,-10.5,9);P.hedge(10.5,-9,10.5,9);
 P.pave({x0:-1,y0:-9.5,x1:1,y1:10,border:'none'});P.keep(-1.1,-9.5,1.1,10.5);P.put('expansion:ivy-arbor',0,9.5,{force:true});
 P.put('ref:tree-maple-crimson',-5.5,-4,{force:true});P.put('gen:birdbath-gnome',5,-3,{force:true});P.put('world:bench',-3.5,3,{force:true,flip:true});P.put('ref:halloween-lantern',2.4,7.5,{force:true});P.put('expansion:birdhouse-post',6,5,{force:true});
 K.bed(-9.8,-9,-1.6,9,7);K.bed(1.6,-9,9.8,9,7);K.drifts(-9,-9,9,9,2);
 places.push(P.done());}

// =====================================================================================  12. GAS & DINER
{seed=412;const P=Place('place-gas-diner','Route 9 gas & diner','A roadside stop: the pump canopy with a car at each side, the chrome diner with planters and a phone booth, a few cars in its bays, oil drums and a tyre stack by the bins.'),K=kit(P);
 const D=K.at('world:diner',10,0);const L={surface:'asphalt',border:'curb',x0:-22,y0:0,x1:D.x1+1,y1:20,bays:[{side:'S',from:D.x0+1,to:D.x0+1+Math.floor((D.x1-D.x0-2)/BAY)*BAY,depth:5}]};P.lot(L);
 P.floor({surface:'slab',border:'curb',x0:D.x0-.5,y0:D.y0-4,x1:D.x0,y1:0});P.keep(D.door[0]-1.2,0,D.door[0]+1.2,2.6);
 P.put('ref:building-gas-canopy',-12,9,{force:true});P.put('static:compact_e',-16.5,9,{force:true});P.put('world:car_1',-7.5,9,{force:true});K.park(L,'S',4);
 P.fill(['town:phone_booth','town:planter_square','gen:newspaper-box'],3,D.x0+1,.5,D.x1-1,2.5,{flip:false});P.fill(['town:dumpster','expansion:oil-drums','expansion:tyre-stack','expansion:hvac-unit'],4,D.x1+1.5,D.y0,D.x1+5,D.y1,{flip:false});
 K.door(D.door,['ref:halloween-pumpkin-cluster','ref:halloween-mums'],2);P.put('world:streetlamp',-21.4,19.4,{force:true});P.put('world:streetlamp',D.x1+.4,19.4,{force:true});P.put('town:street_sign',-21.4,.6,{force:true});
 K.litter(-20,1,D.x1,18);P.fill(['town:oil_stain'],1,-18,5,-6,13);K.trees(-30,-10,-24,20,3);K.bed(-25,-6,-23,20,5);P.hedge(-22,-3,D.x0-2,-3);
 places.push(P.done());}

// =====================================================================================  13. SCRAPYARD
{seed=413;const P=Place('place-scrapyard','Dutch’s salvage yard','A chain-linked salvage yard with a double gate: the old workshop and a boxcar office, the junk car, scrap pickup, appliance pile, engines, pipes, pallets, cable spool, forklift and tyre stacks on oily dirt.'),K=kit(P);
 const Y=P.pen('chain',-24,-20,24,20,{gaps:{S:[[-4,0]]},gate:true});P.floor({surface:'dirt',border:'none',x0:Y.x0+.4,y0:Y.y0+.4,x1:Y.x1-.4,y1:Y.y1-.4});
 K.at('expansion:abandoned-workshop',Y.x0+2,Y.y0+17);K.at('expansion:boxcar',Y.x1-23,Y.y0+8);
 P.fill(SCRAP,16,Y.x0+2,Y.y0+19,Y.x1-2,Y.y1-2,{flip:false,pad:.3});P.fill(['town:oil_stain','expansion:paint-spill'],2,Y.x0+2,Y.y0+18,Y.x1-2,Y.y1-2);
 P.put('ref:halloween-witch-sign',4,Y.y1+1.4,{force:true});K.trees(Y.x0-8,Y.y0,Y.x0-2,Y.y1,3,DEAD.concat(TREES));K.bed(Y.x0-2.5,Y.y0+2,Y.x0-.8,Y.y1,4);
 places.push(P.done());}

// =====================================================================================  14. TRAILER PARK
{seed=414;const P=Place('place-trailer-park','Pine Hollow trailer lots','Two trailer lots under the pines: a mobile home and a camper with a boat trailer, satellite dish, kennel, washing line, fire pit and ride-on mower, split by a muddy track.'),K=kit(P);
 const M=K.at('expansion:mobile-home',-22,0),C=K.at('expansion:camper',6,0);P.put('expansion:boat-trailer',C.x1+4,-3,{force:true});
 P.floor({surface:'dirt',border:'none',x0:-3,y0:-16,x1:3,y1:12});P.put('expansion:mud-tracks-y',0,-2,{force:true});
 P.fill(['expansion:satellite-dish','expansion:kennel','expansion:washing-line','expansion:firepit','gen:cooler-lawnchairs','expansion:lean-to-shed','expansion:woodpile'],7,-22,-14,-4,10,{pad:.4});
 P.fill(['expansion:rideon-mower','expansion:camping-cooler','expansion:barbecue','expansion:lawn-chair','expansion:outhouse','expansion:motorcycle-rear'],6,4,-14,22,10,{pad:.4});
 P.fence('chain',-24,12,-4,12);P.fence('picket',4,12,24,12);K.trees(-30,-26,30,-18,6,TREES.filter(t=>/pine|spruce/.test(t)));K.trees(-30,-16,-25,10,2);K.drifts(-24,-16,24,10,2);
 places.push(P.done());}

// =====================================================================================  15. MAIN STREET
{seed=415;const P=Place('place-main-street','Main Street civic block','Post office, fire house, grocery, barber and tackle shop in a row on a wide sidewalk with a traffic light, parking meters, hydrant, mailbox, planters, benches and a bike rack, and kerbside cars in a parking lane.'),K=kit(P);
 const row=['town:postoffice','town:firestation','town:grocery','town:barber','town:fish_tackle'];let x=0;const B=[];for(const sid of row){const r=K.at(sid,x,0);B.push(r);x=r.x1+.3;}const R=x-.3;
 const W={x0:-.5,y0:0,x1:R+.5,y1:6};P.floor({surface:'slab',border:'curb',...W});B.forEach(r=>P.keep(r.door[0]-1.2,0,r.door[0]+1.2,3.4));
 P.fill(['town:traffic_light','expansion:parking-meter','world:hydrant','world:mailbox','town:planter_terracotta','town:planter_square','world:bench','town:bike_rack','gen:newspaper-box','town:phone_booth','world:trashcan','town:street_sign','expansion:utility-cabinet'],13,.5,.6,R-.5,5.6,{flip:false});
 B.forEach((r,i)=>K.door([r.door[0]+2.2,r.door[1]],[['ref:halloween-mums'],['ref:halloween-pumpkin-cluster'],['town:produce_stand'],['world:pumpkin_0'],['poi:rod-bucket']][i],1));
 for(let k=0;k<4;k++)P.put('world:streetlamp',(k+.5)*R/4,W.y1-.5,{force:true});K.litter(0,1,R,5.6);
 P.floor({surface:'asphalt',border:'none',x0:-.5,y0:6,x1:R+.5,y1:9.6});const cars=shuffle(E_CARS.concat(W_CARS));for(let k=0;k<Math.min(6,cars.length);k++)P.put(cars[k],6+k*(R-12)/5,7.9,{force:true});
 K.trees(-6,-16,-2,5,2);K.trees(R+2,-16,R+6,5,2);P.hedge(0,Math.min(...B.map(r=>r.y0))-2,R,Math.min(...B.map(r=>r.y0))-2);K.drifts(0,1,R,5.6,1);
 places.push(P.done());}

// =====================================================================================  16. TOWN PARK (new)
{seed=416;const P=Place('place-town-park','Founders’ Park','A hedged town park: the fountain on a slab circle with benches and lamps, paved paths to each side, a playground corner, a picnic lawn, the old water tower, and big autumn trees.'),K=kit(P);
 P.floor({surface:'slab',border:'curb',x0:-8,y0:-8,x1:8,y1:8});P.put('ref:landmark-fountain',0,0,{force:true});P.pave({x0:-1.2,y0:8,x1:1.2,y1:24,border:'none'});P.pave({x0:8,y0:-1.2,x1:24,y1:1.2,border:'none'});P.pave({x0:-24,y0:-1.2,x1:-8,y1:1.2,border:'none'});
 P.keep(-1.3,8,1.3,24);P.keep(8,-1.3,24,1.3);P.keep(-24,-1.3,-8,1.3);
 P.put('world:bench',-6.5,6.5,{force:true});P.put('world:streetlamp',7.2,7.2,{force:true});P.put('world:streetlamp',-7.2,-7.2,{force:true});P.put('town:planter_terracotta',6.6,-6.6,{force:true});P.put('world:trashcan',-6.8,-5,{force:true});
 P.floor({surface:'dirt',border:'none',x0:10,y0:6,x1:23,y1:22});P.put('world:junglegym_1',14,10,{force:true});P.put('world:swings',19.5,10,{force:true});P.put('world:merrygoround',16.5,17,{force:true});P.put('expansion:sandbox',20.5,19,{force:true});
 P.fill(['town:picnic_table','gen:cooler-lawnchairs','expansion:kiddie-pool'],3,-22,6,-4,22,{pad:.6});P.put('ref:landmark-water-tower',-16,-15,{force:true});
 P.hedge(-25,-24,25,-24);P.hedge(-25,-24,-25,-3);P.hedge(-25,3,-25,24);P.hedge(25,-24,25,-3);P.hedge(25,3,25,24);P.hedge(-25,24,-3,24);P.hedge(3,24,25,24);
 K.trees(-23,-22,23,-9,6,TREES.filter(t=>/oak|maple|birch/.test(t)));K.trees(-23,8,-4,22,2);K.bed(-23,-22,-9,-9,6);K.drifts(-22,-22,22,22,2);
 places.push(P.done());}

// =====================================================================================  17. ELM STREET DERELICTS (new)
{seed=417;const P=Place('place-elm-street','The far end of Elm Street','Where the town gives up: a rundown house and a derelict two-storey behind broken fences, a boarded shop back, junk on the lawns, dead trees, a stationwagon left to rot and a single lamp.'),K=kit(P);
 const A=K.at('expansion:rundown-house',0,0),B=K.at('expansion:derelict-two-storey',A.x1+5,0),C=K.at('expansion:boarded-store-rear',B.x1+5,0);
 P.fence('chain',-2,10,A.x1+2.5,10,{gaps:[[A.door[0]-2,A.door[0]+2]]});P.fence('privacy',A.x1+2.5,10,C.x1+2,10,{gaps:[[B.door[0]-2,B.door[0]+6]]});
 P.fill(['expansion:junk-car','expansion:appliance-pile','expansion:crt-curb','expansion:tyre-stack','expansion:bike-scrap','expansion:milk-crates','gen:rubbish-bags'],7,-1,A.y1+1.2,C.x1,9,{pad:.4});
 P.put('expansion:stationwagon-rear',C.x0+5,13,{force:true});P.put('world:streetlamp',B.cx,12.5,{force:true});P.put('ref:halloween-sheet-ghost',B.door[0]+1,B.y1+3,{force:true});
 K.trees(-6,-6,C.x1+6,A.y0-1,4,DEAD);K.trees(-6,0,-2,9,1,DEAD);K.drifts(-2,1,C.x1,10,2);
 places.push(P.done());}

// keep the owner's own two homes preset (from the previous file) unchanged
try{const old=JSON.parse(await fs.readFile(path.join(PDIR,'places.json'),'utf8'));const mine=old.presets.find(p=>p.id==='place-two-homes');if(mine)places.splice(5,0,mine);}catch{}
// sanity: no repeats except segments
for(const p of places){if(p.id==='place-two-homes')continue;const seen=new Map();for(const m of p.members){const k=m.pick[0];if(SEGMENT.test(k))continue;seen.set(k,(seen.get(k)||0)+1);}const rep=[...seen].filter(([,n])=>n>1);if(rep.length)throw Error(p.id+' repeats '+rep.map(r=>r[0]).join(','));}

{const flat=new Set(lib.items.filter(i=>i.flat).map(i=>i.id));for(const p of places)if(p.id!=='place-two-homes'){const n=p.members.filter(m=>flat.has(m.pick[0])).length;if(n>4)throw Error(p.id+' has '+n+' decals');}}
// ------------------------------------------------------------------------------------- render (same as poi-presets.mjs)
const presets=places;
const SC=32;const shapeColor={asphalt:[44,49,66],slab:[196,170,146],dirt:[104,72,48],field:[70,104,52],pave:[196,170,146]};
async function render(p,maxW){
 const parts=[];for(const m of p.members){const it=items.get(m.pick[0]),sc=m.scale[0],sx=(m.dx-m.dy)*SC,sy=(m.dx+m.dy)*SC/2;
  const w=it.w*sc,h=it.h*sc,l=m.flip?sx-(it.w-it.ax)*sc:sx-it.ax*sc,t=sy-it.ay*sc;parts.push({it,m,sc,sx,sy,w,h,l,t,flat:it.flat?0:1,depth:m.dx+m.dy});}
 const gpoly=g=>{const x0=Math.min(g.x0,g.x1),x1=Math.max(g.x0,g.x1),y0=Math.min(g.y0,g.y1),y1=Math.max(g.y0,g.y1);return [[x0,y0],[x1,y0],[x1,y1],[x0,y1]].map(([X,Y])=>[(X-Y)*SC,(X+Y)*SC/2]);};
 let X0=1e9,Y0=1e9,X1=-1e9,Y1=-1e9;for(const q of parts){X0=Math.min(X0,q.l);Y0=Math.min(Y0,q.t);X1=Math.max(X1,q.l+q.w);Y1=Math.max(Y1,q.t+q.h);}for(const g of p.ground)for(const [x,y] of gpoly(g)){X0=Math.min(X0,x);Y0=Math.min(Y0,y);X1=Math.max(X1,x);Y1=Math.max(Y1,y);}
 X0-=20;Y0-=20;const W=Math.ceil(X1-X0+20),H=Math.ceil(Y1-Y0+20);
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#3d5426"/>`;
 for(const g of p.ground){const c=shapeColor[g.kind==='pave'?'pave':g.surface]||[90,90,90],pts=gpoly(g).map(([x,y])=>`${(x-X0).toFixed(1)},${(y-Y0).toFixed(1)}`).join(' ');
  svg+=`<polygon points="${pts}" fill="rgb(${c})" stroke="${g.border==='none'?'none':'#d8c2a6'}" stroke-width="${g.border==='none'?0:6}"/>`;
  for(const bay of g.bays||[]){const x0=Math.min(g.x0,g.x1),x1=Math.max(g.x0,g.x1),y0=Math.min(g.y0,g.y1),y1=Math.max(g.y0,g.y1);for(let u=bay.from;u<=bay.to+.01;u+=bay.spacing??2.7){let a,b2;
    if(bay.side==='N'){a=[u,y0+.3];b2=[u,y0+bay.depth];}else if(bay.side==='S'){a=[u,y1-.3];b2=[u,y1-bay.depth];}else if(bay.side==='W'){a=[x0+.3,u];b2=[x0+bay.depth,u];}else{a=[x1-.3,u];b2=[x1-bay.depth,u];}
    const P=([X,Y])=>`${((X-Y)*SC-X0).toFixed(1)},${((X+Y)*SC/2-Y0).toFixed(1)}`;svg+=`<polyline points="${P(a)} ${P(b2)}" stroke="#e7e2d4" stroke-width="3"/>`;}}}
 svg+='</svg>';const comp=[];
 parts.sort((a,b)=>a.flat-b.flat||a.depth-b.depth);
 const sh=parts.filter(q=>q.flat&&q.it.shadow);const flats=parts.filter(q=>!q.flat),ups=parts.filter(q=>q.flat);
 const img=async(file,w,h,flip)=>{let s=sharp(file).resize(Math.max(1,Math.round(w)),Math.max(1,Math.round(h)));if(flip)s=s.flop();return s.png().toBuffer();};
 for(const q of flats)comp.push({input:await img(path.join(LIB,q.it.file),q.w,q.h,q.m.flip),left:Math.round(q.l-X0),top:Math.round(q.t-Y0)});
 for(const q of sh){const s=q.it.shadow,cy=q.sy+(s.dy||0)*q.sc;comp.push({input:await img(path.join(LIB,s.file),s.w*q.sc,s.h*q.sc,q.m.flip),left:Math.round((q.m.flip?q.sx-(s.w-s.ax)*q.sc:q.sx-s.ax*q.sc)-X0),top:Math.round(cy-s.ay*q.sc-Y0)});}
 for(const q of ups)comp.push({input:await img(path.join(LIB,q.it.file),q.w,q.h,q.m.flip),left:Math.round(q.l-X0),top:Math.round(q.t-Y0)});
 const big=await sharp(Buffer.from(svg)).composite(comp.filter(c=>c.left>-4000)).png().toBuffer();
 return {big,W,H,spanM:Math.max(...p.members.map(m=>Math.hypot(m.dx,m.dy)))};}
await fs.mkdir(path.join(PDIR,'thumbs'),{recursive:true});await fs.mkdir(path.join(OUT,'places-review'),{recursive:true});
for(const p of presets){const r=await render(p);p.spanM=+r.spanM.toFixed(1);p.thumb='presets/thumbs/'+p.id+'.webp';
 await sharp(r.big).resize(224,224,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).webp({quality:88}).toFile(path.join(PDIR,'thumbs',p.id+'.webp'));
 await sharp(r.big).resize({width:Math.min(r.W,2400)}).png().toFile(path.join(OUT,'places-review',p.id+'.png'));
 console.log(p.id,'sprites',p.members.length,'ground',p.ground.length,'span',p.spanM);}
const file=path.join(PDIR,'places.json');try{await fs.copyFile(file,path.join(PDIR,'history','places-before-'+Date.now()+'.json'));}catch{}
await fs.writeFile(file,JSON.stringify({version:1,presets},null,1));
