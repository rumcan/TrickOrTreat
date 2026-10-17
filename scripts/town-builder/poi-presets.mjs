/** Five dense, hand-planned point-of-interest presets: sprites + their own ground (car parks with bays, plazas, dirt
 *  yards, a sports field). Writes output/town-builder/presets/places.json + thumbs + large review renders.
 *  node scripts/town-builder/poi-presets.mjs
 *  Coordinates: metres from the stamp point. X runs to screen lower-right, Y to lower-left. Unflipped buildings face +Y.
 *  A sprite's footprint is [x-fw, x+fw] x [y-fh, y+fh] metres (fw, fh from the library). Placement checks footprints so
 *  nothing overlaps; decals (flat) may overlap anything. Seeded, so regenerating gives the same layouts. */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {ROOT} from '../lib/town-scene.mjs';
const OUT=path.join(ROOT,'output/town-builder'),LIB=path.join(OUT,'library'),PDIR=path.join(OUT,'presets');
const lib=JSON.parse(await fs.readFile(path.join(LIB,'library.json'),'utf8')),items=new Map(lib.items.map(i=>[i.id,i]));
for(const [k,v] of [...items])if(v.hidden)items.delete(k); // never use hidden art
let seed=1;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;},rr=(a,b)=>a+rnd()*(b-a),pick=a=>a[Math.floor(rnd()*a.length)];

function Builder(id,name,desc){
 const members=[],ground=[],occ=[];
 const fp=(it,x,y,flip,sc,pad)=>{const fw=(flip?it.fh:it.fw)*sc,fh=(flip?it.fw:it.fh)*sc;return [x-fw-pad,y-fh-pad,x+fw+pad,y+fh+pad];};
 const hits=r=>occ.some(o=>r[0]<o[2]&&r[2]>o[0]&&r[1]<o[3]&&r[3]>o[1]);
 const b={
  put(id,x,y,o={}){const it=items.get(id);if(!it)throw Error('no sprite '+id);const sc=o.scale??1,flip=!!o.flip;
   if(!it.flat){const r=fp(it,x,y,flip,sc,o.pad??.15);if(!o.force&&hits(r))return false;occ.push(r);}
   members.push({pick:[id],dx:+x.toFixed(2),dy:+y.toFixed(2),flip,scale:[+sc.toFixed(2),+sc.toFixed(2)],chance:1,jitter:0});return true;},
  keep(x0,y0,x1,y1){occ.push([x0,y0,x1,y1]);},
  scatter(ids,n,x0,y0,x1,y1,o={}){let k=0;for(let t=0;t<n*30&&k<n;t++){const id=Array.isArray(ids)?pick(ids):ids,sc=o.scale?rr(o.scale[0],o.scale[1]):1;
   if(b.put(id,rr(x0,x1),rr(y0,y1),{flip:o.flip==null?rnd()<.5:o.flip,scale:sc,pad:o.pad??.2}))k++;}return k;},
  row(ids,x0,y0,x1,y1,step,o={}){const L=Math.hypot(x1-x0,y1-y0),n=Math.max(1,Math.round(L/step));for(let i=0;i<=n;i++){if(o.skip?.(i))continue;const t=i/n;
   b.put(Array.isArray(ids)?ids[i%ids.length]:ids,x0+(x1-x0)*t+(o.jit?rr(-o.jit,o.jit):0),y0+(y1-y0)*t+(o.jit?rr(-o.jit,o.jit):0),{flip:o.flip??false,force:o.force??true,scale:o.scale??1,pad:o.pad});}},
  lot(l){ground.push({kind:'lot',...l});b.keep(Math.min(l.x0,l.x1),Math.min(l.y0,l.y1),Math.max(l.x0,l.x1),Math.max(l.y0,l.y1));},
  floor(l){ground.push({kind:'lot',...l});},
  pave(p){ground.push({kind:'pave',...p});},
  done(){return {id,name,group:'Places (full)',desc,members,ground,fixed:true,turn:false,mirror:false,count:members.length};}};
 return b;}
const LEAVES=['decal:decal-06-orange-leaf-scatter','decal:decal-07-red-leaf-cluster','decal:decal-08-yellow-leaf-scatter','town:leaf_drift','decal:scatter-tiny-leaves'];
const GRASS=['decal:decal-01-lush-grass','decal:decal-02-dry-golden-grass','decal:decal-03-moss-groundcover','decal:decal-04-low-weeds','decal:decal-05-thin-grass','decal:scatter-grass-tufts'];
const AUTUMN=['ref:tree-maple-crimson','ref:tree-birch-gold','world:tree_oak_0','world:tree_oak_1','world:tree_oak_2'],EVER=['ref:tree-spruce-blue','world:tree_pine_0','world:tree_pine_1','world:tree_pine_2'],DEAD=['world:tree_dead_0','world:tree_dead_1','world:tree_dead_2'];
const BUSH=['world:bush_0','world:bush_1','world:bush_2','town:hydrangea','town:fern','town:ornamental_grass'],PUMP=['world:pumpkin_0','world:pumpkin_1','ref:halloween-pumpkin-cluster'];
const CARS_N=['static:compact_n','static:compact_n-v2','static:pickup_n','static:pickup_n-v2'],CARS_X=['world:car_0','world:car_1','world:car_2','world:car_3','static:compact_e','static:van_e','static:van_e-v2'];
const LITTER=['town:paper_litter','town:bag_litter','poi:candy-soda-litter','poi:newspaper-cup-litter','poi:pizza-litter','poi:flyer-tape-litter'];
/** parked cars in a bay row (bays run along `from..to`; wallAt = the lot edge the cars nose toward) */
function parkRow(b,side,from,to,wallAt,depth,fill=.7){const sp=2.7,n=Math.floor((to-from)/sp+1e-6);for(let k=0;k<n;k++){const u=from+(k+.5)*sp,inset=depth/2+.25;
  if(rnd()>fill){if(rnd()<.5)b.put('town:oil_stain',side==='N'||side==='S'?u:(side==='W'?wallAt+inset:wallAt-inset),side==='N'?wallAt+inset:side==='S'?wallAt-inset:u,{scale:rr(.6,1)});continue;}
  if(side==='N')b.put(pick(CARS_N),u,wallAt+inset,{force:true});else if(side==='S')b.put('static:compact_s',u,wallAt-inset,{force:true});
  else b.put(side==='W'?pick(['static:compact_w','static:compact_w','world:car_1','world:car_3']):pick(['static:compact_e','static:van_e','static:van_e-v2','world:car_0','world:car_2']),side==='W'?wallAt+inset:wallAt-inset,u,{force:true});}}
const presets=[];
const opt=(b,id,x,y,o={})=>items.has(id)?b.put(id,x,y,{force:true,...o}):false;

// ===================================================================================== v2: built the owner's way
// Rules learned from the owner's two-house build: buildings ~1.35x, lots enclosed by continuous hedge rows (2 m) and
// fences, plants packed in beds ~1.6-2 m apart (overlapping is fine), decorations clustered at doors/stalls,
// leaf drifts and litter covering the ground, trees tucked against buildings, nothing alone on open grass.
const DRIFTS=['gen:drift-1','gen:drift-2','gen:drift-3','gen:drift-4','gen:drift-5','gen:drift-6','gen:drift-7','gen:drift-8','town:leaf_drift','decal:decal-07-red-leaf-cluster','decal:decal-06-orange-leaf-scatter'].filter(id=>items.has(id));
const BED=['world:bush_0','world:bush_1','world:bush_2','town:fern','town:hydrangea','town:ornamental_grass','town:fern','town:hydrangea'];
const GLITTER=['town:paper_litter','town:bag_litter','poi:candy-soda-litter','poi:newspaper-cup-litter','poi:flyer-tape-litter'].concat(['gen:litter-fastfood','gen:litter-candy','gen:litter-newspaper'].filter(id=>items.has(id)));
const BS=1.35; // building scale
function kit(b){
 return {
  hedge(x0,y0,x1,y1,step=2){b.row('world:hedge',x0,y0,x1,y1,step,{pad:-.6});},
  fence(kind,x0,y0,x1,y1,step=2){const axis=Math.abs(x1-x0)>=Math.abs(y1-y0)?'x':'y';b.row(`world:fence_${kind}_${axis}`,x0,y0,x1,y1,step,{pad:-.6});},
  /** packed planting bed: jittered grid, plants may overlap each other but not buildings */
  bed(x0,y0,x1,y1,step=1.7,ids=BED,o={}){for(let y=y0;y<=y1;y+=step)for(let x=x0;x<=x1;x+=step){if(rnd()<(o.gaps??.12))continue;b.put(pick(ids),x+rr(-.45,.45),y+rr(-.45,.45),{flip:rnd()<.5,scale:rr(o.s0??.9,o.s1??1.35),pad:-.55});}},
  /** trees in a tight clump */
  clump(cx,cy,n,ids=AUTUMN,r=2.2){for(let i=0;i<n;i++){const a=rnd()*6.28,d=r*Math.sqrt(rnd());b.put(pick(ids),cx+Math.cos(a)*d,cy+Math.sin(a)*d,{flip:rnd()<.5,scale:rr(1.05,1.5),pad:-.4});}},
  cover(x0,y0,x1,y1,perM2=1/11,ids=DRIFTS){const n=Math.round((x1-x0)*(y1-y0)*perM2);for(let i=0;i<n;i++)b.put(pick(ids),rr(x0,x1),rr(y0,y1),{flip:rnd()<.5,scale:rr(.7,1.3)});},
  litter(x0,y0,x1,y1,n){for(let i=0;i<n;i++)b.put(pick(GLITTER),rr(x0,x1),rr(y0,y1),{flip:rnd()<.5,scale:rr(.8,1.1)});},
  /** cluster at a front door or stall front */
  door(x,y,big=false){const set=['ref:halloween-pumpkin-cluster','world:pumpkin_0','world:pumpkin_1','ref:halloween-mums','ref:halloween-mums'];
   for(let i=0;i<(big?7:4);i++)b.put(pick(set),x+rr(-1.6,1.6),y+rr(-.2,1.4),{flip:rnd()<.5,scale:rr(.8,1.05),pad:-.4});b.put('ref:halloween-lantern',x+rr(1.2,2),y+rr(.2,1),{force:true});}};}

// =====================================================================================  1. HIGH SCHOOL (~64 x 48 m)
{seed=111;const b=Builder('place-high-school','Maple Falls High School','Brick school and gym wing behind a hedged forecourt: packed flower beds, bike racks, buses at the kerb, staff car park, bleachers and goals by the field, tree clumps tight against the buildings.'),k=kit(b);
 b.put('world:school',0,-15,{force:true,scale:BS});b.put('ref:building-school',20,-15.5,{force:true,scale:1.15});
 b.floor({surface:'slab',border:'curb',x0:-14,y0:-8,x1:30,y1:-1});b.keep(-2.5,-8,2.5,-4.5);b.keep(18,-8,22,-4.5);
 k.bed(-13,-9.6,-4,-8.6,1.6);k.bed(4,-9.6,15,-8.6,1.6);k.bed(25,-9.6,30,-8.6,1.6);
 for(const x of [-12,-7,6,11,26])b.put(pick(['town:planter_terracotta','town:planter_square']),x,-6.9,{force:true});
 b.put('town:bike_rack',-11.5,-3,{force:true});b.put('town:bike_rack',-11.5,-5.2,{force:true});b.put('world:bench',-6.5,-2.3,{force:true});b.put('world:bench',8,-2.3,{force:true});b.put('world:trashcan',-4.4,-2.2,{force:true});b.put('world:trashcan',14.5,-2.2,{force:true});
 b.put('world:vending',28.4,-6.6,{force:true});b.put('world:vending',28.4,-4.6,{force:true});b.put('ref:halloween-witch-sign',3.6,-3,{force:true});k.door(0,-6.3,true);k.door(20,-6.6);
 b.put('world:streetlamp',-14.6,-1.2,{force:true});b.put('world:streetlamp',30.6,-1.2,{force:true});k.litter(-13,-7.5,29,-1.5,10);k.cover(-13,-7.5,29,-1.5,1/9);
 b.lot({surface:'asphalt',border:'curb',x0:-14,y0:-1,x1:30,y1:4,auto:true});b.put('world:schoolbus',-4,1.6,{force:true});b.put('world:schoolbus',11,1.6,{force:true});b.put('town:stop_sign',30.8,2.5,{force:true});b.put('town:bus_stop',22,1.7,{force:true});
 // trees + beds hugging the building sides
 k.clump(-17,-16,3,AUTUMN,2.2);k.clump(32,-19,3,EVER,2);k.bed(-19,-12,-15,-3,1.7);k.bed(31,-14,34,-3,1.7);
 // car park east, hedge-lined
 b.lot({surface:'asphalt',x0:35,y0:-26,x1:52,y1:4,auto:true,bays:[{side:'W',from:-24,to:2,depth:5},{side:'E',from:-24,to:2,depth:5}]});parkRow(b,'W',-24,2,35,5,.8);parkRow(b,'E',-24,2,52,5,.7);
 k.hedge(53.5,-26,53.5,4);b.put('world:streetlamp',43.5,-11,{force:true});b.put('town:dumpster',49.5,-25,{force:true});b.put('town:dumpster',47,-25,{force:true});
 // bleachers + field edge, iron fence along the back
 b.floor({surface:'field',border:'none',x0:-34,y0:8,x1:2,y1:28});b.put('world:bleachers',-26,6,{force:true,scale:1.1});b.put('world:bleachers',-18,6,{force:true,scale:1.1});b.put('world:bleachers',-10,6,{force:true,scale:1.1});
 b.put('world:goalposts',-35.5,18,{force:true});b.put('world:goalposts',3.5,18,{force:true,flip:true});b.put('world:scoreboard',-16,30,{force:true});k.fence('iron',-36,31.5,4,31.5);
 b.put('world:vending',-4,5.6,{force:true});b.put('world:trashcan',-6,5.6,{force:true});k.litter(-30,5,-2,7.5,8);
 k.clump(9,14,4,AUTUMN,3);k.bed(5,10,15,22,1.8);k.clump(18,24,3,EVER,2.5);k.cover(-36,4,4,32,1/40,['gen:drift-3','gen:drift-5','gen:drift-7','decal:scatter-tiny-leaves']);k.cover(4,4,20,32,1/12);
 k.bed(-30,-20,-20,-10,1.8);k.clump(-26,-15,4,AUTUMN.concat(EVER),3);k.bed(-14,-26,30,-24,1.8);k.clump(8,-26,3,AUTUMN,2.5);k.clump(-8,-26,2,EVER,2);k.cover(-36,-28,34,-8,1/12);
 k.hedge(-36,-28,-36,4);k.hedge(-36,-28,34,-28);k.bed(-34,-26,-20,-22,1.7);k.clump(-28,-24,3,AUTUMN.concat(EVER),2.5);
 // v3 dressing: bikes at the racks, papers by the bus stop, bins by the dumpsters, a spooky spirit-week lawn
 opt(b,'gen:kids-bikes',-9,-4.4);opt(b,'gen:kids-bikes',-13.2,-6.8,{flip:true});opt(b,'gen:newspaper-box',26.4,-2.4);opt(b,'gen:trash-cans-row',44,-25);opt(b,'gen:trash-cans-row',-1,5.5);
 opt(b,'gen:inflatable-pumpkin',-24,-6,{scale:1.2});opt(b,'gen:yard-tombstones',-21,-4.5);b.put('ref:halloween-sheet-ghost',-26.5,-3.8,{force:true});opt(b,'gen:yard-tombstones',27,-3,{flip:true});
 presets.push(b.done());}

// =====================================================================================  2. STRIP MALL (~62 x 48 m)
{seed=123;const b=Builder('place-strip-mall','Hollow Plaza strip mall','Shop row on a busy covered sidewalk with clustered planters, benches, vending and Halloween displays at each door; marked car park with planted islands; dumpster alley behind a hedge and fence; tree clumps at both ends.'),k=kit(b);
 const shops=[['town:hardware',4],['town:laundromat',4],['town:bakery',3],['town:pharmacy',3],['town:barber',3],['ref:building-corner-store',3]];
 let x=-30;const doors=[];for(const [id,fw] of shops){x+=fw*BS;b.put(id,x,-15,{force:true,scale:BS});doors.push(x);x+=fw*BS+.3;}const right=x;
 b.floor({surface:'slab',border:'curb',x0:-31,y0:-10.6,x1:right+1,y1:-4.5});for(const d of doors){b.keep(d-1.4,-10.6,d+1.4,-8.2);k.door(d+2.6,-9.6);}
 for(let i=0;i<doors.length-1;i++){const m=(doors[i]+doors[i+1])/2;b.put(pick(['world:bench','world:vending','town:phone_booth','town:produce_stand','town:bike_rack','town:planter_square']),m,-6.5,{force:true});b.put(pick(['town:planter_terracotta','world:trashcan']),m+1.6,-6.2,{force:true});}
 b.put('ref:halloween-witch-sign',doors[2]+1,-5.4,{force:true});b.put('ref:halloween-sheet-ghost',doors[4]-1.8,-5.6,{force:true});k.litter(-30,-10,right,-5,12);k.cover(-30,-10,right,-5,1/10);
 b.row('world:streetlamp',-28,-4.9,right-1,-4.9,11);
 opt(b,'gen:newspaper-box',doors[0]+2.5,-6);opt(b,'gen:newspaper-box',doors[3]+2.6,-6,{flip:true});opt(b,'gen:kids-bikes',doors[1]+3,-5.6);opt(b,'gen:inflatable-pumpkin',doors[2]-2.5,-6.2);opt(b,'gen:trash-cans-row',doors[5]+3.4,-6.4);
 b.lot({surface:'asphalt',x0:-31,y0:-4.5,x1:right+1,y1:21,auto:true,bays:[{side:'N',from:-29,to:right-1,depth:5},{side:'S',from:-29,to:right-1,depth:5}]});parkRow(b,'N',-29,right-1,-4.5,5,.8);parkRow(b,'S',-29,right-1,21,5,.75);
 // planted island down the middle
 for(let xx=-26;xx<right-4;xx+=1.8)b.put(pick(['world:hedge','world:bush_0','town:ornamental_grass','world:bush_1']),xx,8.3,{force:true,scale:rr(.9,1.2),flip:rnd()<.5});
 for(const xx of [-20,-4,12])b.put(pick(AUTUMN),xx,8.3,{force:true,scale:1.25});b.put('world:streetlamp',-12,8.3,{force:true});b.put('world:streetlamp',4,8.3,{force:true});
 k.cover(-29,0,right-1,19,1/38,['town:oil_stain','town:paving_wear','town:wheel_wear','gen:oil-stain-big','town:leaf_drift'].filter(id=>items.has(id)));k.litter(-29,0,right-1,19,10);
 // alley
 b.floor({surface:'asphalt',border:'none',x0:-31,y0:-27,x1:right+1,y1:-21});for(let xx=-28;xx<right-2;xx+=6.5){b.put('town:dumpster',xx,-24.5,{force:true});b.put(pick(['town:delivery_crates','world:trashcan','world:trashcan']),xx+2.3,-24,{force:true});}
 k.cover(-30,-26.5,right,-21.5,1/6,['town:bag_litter','town:paper_litter','town:oil_stain','town:puddle'].concat(['gen:rubbish-bags','gen:rubbish-cardboard'].filter(id=>items.has(id))));
 k.fence('iron',-31,-28.5,right+1,-28.5);k.hedge(-31,-30.5,right+1,-30.5);for(let xx=-25;xx<right-6;xx+=13)opt(b,'gen:trash-cans-row',xx,-22.3);
 k.clump(-35,-12,3,AUTUMN,2.4);k.bed(-37,-8,-33,18,1.7);k.clump(right+4,-10,3,EVER,2.2);k.bed(right+2.5,-6,right+6,18,1.7);k.cover(-38,-30,right+7,22,1/30);
 presets.push(b.done());}

// =====================================================================================  3. FARM (~56 x 56 m)
{seed=137;const b=Builder('place-farm','Hollow Creek Farm','Farmhouse in a picket-fenced cottage garden, barns and silo round a muddy yard full of hay, crates and pickups, rows of pumpkins with scarecrows, a stand at the lane, windbreak trees.'),k=kit(b);
 b.floor({surface:'dirt',border:'none',x0:-8,y0:-20,x1:20,y1:2});
 b.put('world:barn',2,-25,{force:true,scale:BS});b.put('ref:building-barn-v2',17,-25,{force:true,scale:1.15});b.put('ref:landmark-silo',26,-21,{force:true,scale:1.2});b.put('ref:landmark-windmill',26,-10,{force:true,scale:1.2});b.put('ref:building-farm-shed',21,-4,{force:true,scale:1.15});
 b.put('static:pickup_n',6,-6,{force:true});b.put('static:pickup_n-v2',11,-9,{force:true});b.put('world:scarecrow',-2,-12,{force:true});
 for(let i=0;i<10;i++)b.put('ref:halloween-hay-bales',rr(-6,17),rr(-18,0),{flip:rnd()<.5,scale:rr(.9,1.1),pad:-.2});for(let i=0;i<4;i++)b.put('town:delivery_crates',rr(-6,4),rr(-6,0),{pad:-.2});
 k.cover(-8,-20,20,2,1/7,['town:mud_grass','town:wheel_wear','town:wheel_wear','gen:wheel-tracks-mud','town:leaf_drift','gen:drift-6'].filter(id=>items.has(id)));k.bed(-12,-8,-9,0,1.7);k.clump(-11,-2,2,AUTUMN,1.5);
 // farmhouse garden
 if(!opt(b,'gen:house-farmhouse-wrap',-24,-21))b.put('world:house_1',-24,-22,{force:true,scale:BS});opt(b,'gen:porch-rocker',-29,-14.6);opt(b,'gen:birdbath-gnome',-31.5,-13);k.door(-24,-15.6,true);k.fence('picket',-34,-11,-27,-11);k.fence('picket',-21,-11,-14,-11);k.fence('picket',-34.4,-31,-34.4,-11.5);k.fence('picket',-13.6,-31,-13.6,-11.5);
 k.bed(-33,-15,-27,-12.2,1.5);k.bed(-21,-15,-15,-12.2,1.5);k.bed(-33,-30,-31,-17,1.6);k.clump(-17,-29,2,AUTUMN,1.5);b.put('world:mailbox',-25.5,-9.4,{force:true});b.put('ref:halloween-sheet-ghost',-31,-17,{force:true});
 // pumpkin field
 b.floor({surface:'dirt',border:'none',x0:-32,y0:6,x1:6,y1:28});for(let r=0;r<6;r++)for(let c=0;c<15;c++){if(rnd()<.12)continue;b.put(pick(PUMP),-30+c*2.5+rr(-.3,.3),8+r*3.6+rr(-.3,.3),{scale:rr(.85,1.1),flip:rnd()<.5,pad:-.4});}
 b.put('world:scarecrow',-18,16,{force:true});b.put('world:scarecrow',-4,22,{force:true});if(items.has('gen:fence-split-rail'))b.row('gen:fence-split-rail',-28,4.6,4,4.6,8);else k.fence('picket',-32,4.6,6,4.6);k.cover(-32,6,6,28,1/12,['decal:scatter-grass-tufts','decal:decal-02-dry-golden-grass','town:mud_grass'].filter(id=>items.has(id)));
 // lane stand
 b.put('town:produce_stand',14,20,{force:true});b.put('world:candy_stand',19,15,{force:true});for(let i=0;i<5;i++)b.put('ref:halloween-hay-bales',rr(10,22),rr(21,24),{pad:-.2});k.door(14,21.5,true);b.put('ref:halloween-witch-sign',22,23,{force:true});b.put('static:compact_e',24,18,{force:true});
 k.cover(8,13,26,26,1/8);if(items.has('gen:wall-stone-dry'))b.row('gen:wall-stone-dry',4,28.5,28,28.5,8);opt(b,'gen:wheelbarrow-leaves',-4,-2);opt(b,'gen:wheelbarrow-leaves',16,-15,{flip:true});opt(b,'gen:trash-cans-row',23,-1);
 // windbreaks
 b.row(EVER,-36,-34,30,-34,3.2,{jit:.5,scale:1.2});b.row(EVER,-38,-32,-38,28,3.4,{jit:.5,scale:1.2});b.row(AUTUMN,30,-16,30,26,3.6,{jit:.5,scale:1.2});k.bed(27,-14,29,26,2);
 presets.push(b.done());}

// =====================================================================================  4. CEMETERY (~48 x 44 m)
{seed=153;const b=Builder('place-cemetery','Old Hollow Cemetery','Iron-fenced graveyard packed with weathered graves, a chapel, crypt and mausoleum, slab paths, overgrown beds along the fence, dead trees and spruces, lanterns, ghosts and deep leaf drifts.'),k=kit(b);
 const X0=-22,X1=24,Y0=-22,Y1=20;
 b.put('ref:building-church',0,-15,{force:true,scale:1.05});b.put('world:crypt',15,-13,{force:true,scale:1.2});b.put('ref:building-mausoleum',-14,-14,{force:true,scale:1.1});
 b.pave({x0:-1.6,y0:-8.5,x1:2.4,y1:Y1,border:'none'});b.keep(-1.8,-8.5,2.6,Y1+1);b.pave({x0:X0+1,y0:2,x1:X1-1,y1:5,border:'none'});b.keep(X0+1,2,X1-1,5);
 k.fence('iron',X0,Y1+.6,-2.6,Y1+.6);k.fence('iron',3.6,Y1+.6,X1,Y1+.6);k.fence('iron',X0,Y0,X1,Y0);k.fence('iron',X0-.6,Y0+1,X0-.6,Y1);k.fence('iron',X1+.6,Y0+1,X1+.6,Y1);
 for(const [gx0,gx1,gy0,gy1] of [[X0+2.5,-4,-7.5,.8],[5,X1-2.5,-6.5,.8],[X0+2.5,-4,6.8,Y1-1.5],[5,X1-2.5,6.8,Y1-1.5]])
  for(let y=gy0;y<=gy1;y+=2.2)for(let x=gx0;x<=gx1;x+=1.8){if(rnd()<.1)continue;b.put(pick(['world:grave_0','world:grave_1','world:grave_2']),x+rr(-.25,.25),y+rr(-.2,.2),{flip:rnd()<.5,scale:rr(.9,1.15),pad:-.2});}
 for(let i=0;i<14;i++)b.put(pick(['ref:halloween-mums','world:pumpkin_0','world:pumpkin_1','ref:halloween-lantern']),rr(X0+2,X1-2),rr(-8,Y1-1),{pad:-.3,scale:rr(.75,.95),flip:rnd()<.5});
 // overgrown beds along the inside of the fence + dead trees in them
 k.bed(X0+.6,Y0+1,X0+1.8,Y1-1,1.6,['world:bush_2','town:fern','town:ornamental_grass','world:bush_1']);k.bed(X1-1.8,Y0+1,X1-.6,Y1-1,1.6,['world:bush_2','town:fern','town:ornamental_grass','world:bush_1']);
 for(const [x,y] of [[-19,-4],[21,-2],[-10,12],[13,14],[-20,16],[8,-8]])b.put(pick(DEAD),x,y,{force:true,scale:rr(1.1,1.4),flip:rnd()<.5});
 b.put('ref:halloween-sheet-ghost',-8,9,{force:true});b.put('ref:halloween-sheet-ghost',11,-3,{force:true});b.put('world:bench',-6,3.5,{force:true});b.put('world:bench',9,3.5,{force:true});
 b.put('world:streetlamp',-3.2,Y1+1.6,{force:true});b.put('world:streetlamp',4.2,Y1+1.6,{force:true});opt(b,'gen:wheelbarrow-leaves',-19,-9);opt(b,'gen:trash-cans-row',-18.5,-6.5);
 b.row(EVER,X0-3,Y0-3,X1+3,Y0-3,3,{jit:.4,scale:1.25});b.row(['ref:tree-spruce-blue','world:tree_dead_1','world:tree_pine_1'],X0-3.5,Y0+1,X0-3.5,Y1,3.6,{jit:.4,scale:1.2});b.row(['world:tree_pine_2','world:tree_dead_2','ref:tree-spruce-blue'],X1+3.5,Y0+1,X1+3.5,Y1,3.6,{jit:.4,scale:1.2});
 k.cover(X0,Y0,X1,Y1+3,1/6,DRIFTS.concat(['town:bare_grass','town:mud_grass','gen:bare-grass-patch','gen:twigs-branches','gen:pinecones-needles'].filter(id=>items.has(id))));
 presets.push(b.done());}

// =====================================================================================  5. FALL FESTIVAL (~44 x 40 m)
{seed=171;const b=Builder('place-fall-festival','Harvest Fall Festival','Hedge-ringed town green: gazebo plaza inside a ring of flower beds, a row of stalls each heaped with hay and pumpkins, picnic tables under a tree clump, a fenced playground, a hay-bale maze and a visitor car park by the gate.'),k=kit(b);
 // plaza + gazebo, beds around it, benches facing in
 b.floor({surface:'slab',border:'curb',x0:-7,y0:-7,x1:7,y1:7});b.put('world:gazebo',0,0,{force:true,scale:BS});b.keep(-1.8,1.8,1.8,7);
 for(const [x,y,f] of [[-4.6,4.6,false],[4.6,4.6,true],[-4.6,-4.6,false],[4.6,-4.6,true]])b.put('world:bench',x,y,{force:true,flip:f});for(const [x,y] of [[-6.4,-6.4],[6.4,-6.4],[-6.4,6.4],[6.4,6.4]])b.put('ref:halloween-lantern',x,y,{force:true});
 k.bed(-9.5,-9.5,9.5,-8,1.6);k.bed(-9.5,-6,-8,9.5,1.6);k.bed(8,-6,9.5,9.5,1.6);for(let i=0;i<8;i++)b.put(pick(PUMP),rr(-6,6),rr(-6,6),{pad:-.3,scale:rr(.8,1)});
 // stall row along the back, touching, each with a heaped front
 const stalls=[['world:candy_stand',-14],['town:produce_stand',-8],['world:snack_bar',0],['world:candy_stand',9],['town:produce_stand',15]];for(const [id,x] of stalls){b.put(id,x,-16,{force:true,scale:id==='world:snack_bar'?1:1.1,flip:false});k.door(x,-13.4,true);for(let i=0;i<3;i++)b.put('ref:halloween-hay-bales',x+rr(-2.4,2.4),-12.4+rr(0,.8),{pad:-.3});}
 b.put('world:vending',19,-14,{force:true});b.put('world:vending',20.4,-14,{force:true});b.put('world:trashcan',-17.6,-12,{force:true});k.litter(-18,-13,21,-10,10);
 // picnic grove (dirt under a tree clump)
 b.floor({surface:'dirt',border:'none',x0:-21,y0:7,x1:-10,y1:19});for(let i=0;i<4;i++)b.put('town:picnic_table',-18.5+(i%2)*5,9.5+Math.floor(i/2)*5,{force:true,flip:i%2===1});
 k.clump(-15.5,15,3,AUTUMN,2.6);b.put('world:trashcan',-11,8,{force:true});k.litter(-21,7,-10,19,10);
 // fenced playground
 b.floor({surface:'dirt',border:'none',x0:11,y0:7,x1:22,y1:19});b.put('world:junglegym_0',14.5,11.5,{force:true});b.put('world:swings',19.5,10,{force:true});b.put('world:merrygoround',18.5,16,{force:true});b.put('world:bench',13,17.6,{force:true});
 k.fence('picket',10.6,6.4,22.4,6.4);k.fence('picket',22.6,7,22.6,19.5);k.fence('picket',10.4,10,10.4,19.5);k.bed(11.2,18.6,21.6,19.6,1.6);
 // hay maze
 for(let i=0;i<6;i++)b.put('ref:halloween-hay-bales',-6+i*1.8,12,{force:true});for(let i=0;i<4;i++)b.put('ref:halloween-hay-bales',4.8,13.8+i*1.8,{force:true});for(let i=0;i<4;i++)b.put('ref:halloween-hay-bales',-4+i*1.8,17,{force:true});
 b.put('world:scarecrow',-1,14.3,{force:true});b.put('ref:halloween-sheet-ghost',2.6,19,{force:true});b.put('ref:halloween-witch-sign',-7.4,13.6,{force:true});
 // hedge ring with gate gaps, trees outside, car park by the gate
 k.hedge(-24,-20,24,-20);k.hedge(-24,-20,-24,22);k.hedge(24,-20,24,22);k.hedge(-24,22,-3,22);k.hedge(3,22,24,22);
 k.clump(-27,-14,3,AUTUMN,2.4);k.clump(27,-12,3,AUTUMN.concat(EVER),2.4);k.clump(-27,14,3,EVER,2.4);k.clump(27,15,3,AUTUMN,2.4);
 b.put('world:streetlamp',-2.6,22.6,{force:true});b.put('world:streetlamp',2.6,22.6,{force:true});opt(b,'gen:inflatable-pumpkin',-6,20,{scale:1.25});opt(b,'gen:inflatable-pumpkin',6.5,20,{scale:1.1});
 opt(b,'gen:cooler-lawnchairs',-9,9);opt(b,'gen:cooler-lawnchairs',-20,20,{flip:true});opt(b,'gen:kids-bikes',9.2,9);opt(b,'gen:yard-tombstones',7.8,16.5);opt(b,'gen:trash-cans-row',21.5,-11);
 b.lot({surface:'asphalt',border:'curb',x0:-24,y0:24,x1:24,y1:31,auto:true,bays:[{side:'S',from:-22,to:22,depth:5}]});for(let xx=-21;xx<22;xx+=2.7)if(rnd()<.75)b.put(pick(['static:compact_s']),xx,28.2,{force:true});
 k.cover(-24,-20,24,22,1/9);
 presets.push(b.done());}

// =====================================================================================  6. THE OWNER'S TWO HOMES (traced from layout.json)
try{const u=JSON.parse(await fs.readFile(path.join(OUT,'user-sample.json'),'utf8'));const b=Builder('place-two-homes','Two homes on the corner (your build)','Your hand-built pair of homes with garages, driveway van and car, hedged yards, picket fence, backyard playground and picnic tables. Saved from the map as a reference layout.');
 for(const s of u.items){if(!items.has(s.id))continue;b.put(s.id,s.dx,s.dy,{force:true,flip:s.flip,scale:s.scale});if(s.z)b.done().members.at(-1);}presets.push(b.done());}catch(e){console.warn('owner sample',e.message);}


// =====================================================================================  7. MAPLE LANE HOMES (3 lots, ~66 x 40 m)
{seed=211;const b=Builder('place-maple-lane','Maple Lane — three homes','Three different 1980s homes on hedged 20 m lots: driveways with cars, garage, picket fences and mailboxes, packed front beds, each yard dressed differently (spooky lawn, kids and yard work, garden), backyards with fences, pool, bins and swing set.'),k=kit(b);
 b.pave({x0:-33,y0:4,x1:33,y1:6,border:'none'}); // front sidewalk
 const lots=[[-22,'gen:house-l-shape',false],[0,'gen:house-splitlevel',true],[22,'gen:house-l-ranch',true]];
 lots.forEach(([cx,house,garage],i)=>{
  if(!opt(b,house,cx-1,-8.5))b.put('world:house_'+i,cx-1,-8.5,{force:true,scale:BS});
  b.floor({surface:'asphalt',border:'none',x0:cx+6,y0:-6,x1:cx+9.6,y1:4});b.put(pick(CARS_N),cx+7.8,-.5,{force:true});
  if(garage)b.put(pick(['static:garage_brick','static:garage_brick-v2','static:garage_timber']),cx+7.8,-9.5,{force:true});
  k.door(cx-2,-3.6,true);b.put('world:mailbox',cx+5.4,3.4,{force:true});
  k.fence('picket',cx-9.5,3.2,cx+4.2,3.2);k.bed(cx-9,-4.2,cx+4,-3.2,1.5);k.hedge(cx+10.5,-17,cx+10.5,3);
  k.clump(cx-7.5,-1,2,AUTUMN,1.6);k.cover(cx-10,-5,cx+10,4,1/7);
  // backyards
  k.fence(['iron','picket','iron'][i],cx-10,-19.5,cx+10,-19.5);k.bed(cx-9.5,-18.6,cx-6,-14.5,1.6);
 });
 k.hedge(-32.5,-17,-32.5,3);
 // front-yard stories
 opt(b,'gen:inflatable-pumpkin',-26,0,{scale:1.2});opt(b,'gen:yard-tombstones',-29,1.4);b.put('ref:halloween-sheet-ghost',-23,0.6,{force:true});b.put(pick(DEAD),-29.5,-2,{force:true,scale:1.3});
 opt(b,'gen:kids-bikes',-4,0.5);opt(b,'gen:lawnmower',-6.5,-0.6);opt(b,'gen:wheelbarrow-leaves',2.5,0);b.put('gen:drift-2',-1,1.5,{scale:1.1});
 opt(b,'gen:birdbath-gnome',17,0.3);opt(b,'gen:porch-rocker',19.5,-3);b.put('ref:halloween-hay-bales',15,1.5,{force:true});b.put('world:scarecrow',14.5,-.5,{force:true});
 // backyards
 opt(b,'gen:kiddie-pool',-26,-16.5);opt(b,'gen:trash-cans-row',-15,-17.5);b.put('world:swings',2,-16.5,{force:true});opt(b,'gen:cooler-lawnchairs',-4,-16.8);opt(b,'gen:trash-cans-row',6.5,-17.6);
 b.put('town:picnic_table',24,-16.6,{force:true});opt(b,'gen:kids-bikes',18,-17);k.clump(30,-15,2,EVER,1.6);k.cover(-32,-19,32,-13,1/10);
 b.row('world:streetlamp',-30,5.6,30,5.6,30);b.put('world:hydrant',11,5.4,{force:true});k.litter(-32,4,32,6,6);
 presets.push(b.done());}

// =====================================================================================  8. BACKYARDS (3 house backs, ~64 x 30 m)
{seed=223;const b=Builder('place-backyards','Backyards on Birch Street','The backs of three houses facing you: a barbecue deck, a patio with an above-ground pool and a swing-set yard, split by chain-link, picket and split-rail fences, with coolers, bikes, bins, firepit-style clutter, trees and leaf drifts.'),k=kit(b);
 const backs=[[-21,'gen:back-bbq-deck'],[0,'gen:back-patio-pool'],[21,'gen:back-swingset']];
 backs.forEach(([cx,id],i)=>{if(!opt(b,id,cx,-9))b.put('world:house_'+(i+3),cx,-9,{force:true,scale:BS});k.bed(cx-9,-4.6,cx-5,-3.4,1.4);k.cover(cx-10,-4,cx+10,9,1/8);});
 if(items.has('gen:fence-chainlink'))b.row('gen:fence-chainlink',-10.5,-12,-10.5,8,8);else k.fence('iron',-10.5,-12,-10.5,8);
 k.fence('picket',10.5,-12,10.5,8);if(items.has('gen:fence-split-rail'))b.row('gen:fence-split-rail',-28,9.5,28,9.5,8);else k.fence('picket',-31,9.5,31,9.5);
 // yard 1: party
 opt(b,'gen:cooler-lawnchairs',-24,1);b.put('town:picnic_table',-18,3,{force:true});b.put('ref:halloween-lantern',-14,1,{force:true});opt(b,'gen:trash-cans-row',-29,-2);b.put('ref:halloween-pumpkin-cluster',-21,5,{force:true});k.litter(-28,0,-12,8,5);
 // yard 2: pool + gnome garden
 opt(b,'gen:birdbath-gnome',6,3);opt(b,'gen:kiddie-pool',-5,5);opt(b,'gen:lawnmower',-7,1);k.bed(4,5,9,8,1.4);
 // yard 3: kids
 opt(b,'gen:kids-bikes',17,3);b.put('world:merrygoround',25,4,{force:true});opt(b,'gen:wheelbarrow-leaves',29,1);b.put('gen:drift-2',22,6,{scale:1.2});
 k.clump(-31,-8,3,AUTUMN.concat(EVER),2.2);k.clump(31,-7,3,AUTUMN,2.2);k.clump(10.5,-15,2,EVER,1.6);
 presets.push(b.done());}

// =====================================================================================  9. THE HAUNTED HOUSE ON THE HILL (~30 x 30 m)
{seed=233;const b=Builder('place-halloween-house','The Halloween house','One house that goes all-out: iron fence with a gate, a front-yard graveyard of foam tombstones, a big inflatable jack-o-lantern, sheet ghosts in a dead tree, hay bales and scarecrows, lanterns lining the path, pumpkins everywhere and a candy table at the door.'),k=kit(b);
 if(!opt(b,'gen:house-duplex',0,-7))b.put('world:house_2',0,-7,{force:true,scale:BS});
 b.pave({x0:-1.2,y0:-1.5,x1:1.2,y1:10,border:'none'});b.keep(-1.3,-1.6,1.3,10.5);
 k.fence('iron',-13,10.5,-1.8,10.5);k.fence('iron',1.8,10.5,13,10.5);k.fence('iron',-13.6,-12,-13.6,10);k.fence('iron',13.6,-12,13.6,10);
 for(const y of [1,4,7])for(const sx of [-1,1])b.put('ref:halloween-lantern',sx*2,y,{force:true});
 opt(b,'gen:yard-tombstones',-7,2);opt(b,'gen:yard-tombstones',-10,5.5,{flip:true});opt(b,'gen:yard-tombstones',-5,7.5);for(const [x,y] of [[-9,1],[-11.5,8],[-6,4.6]])b.put(pick(['world:grave_0','world:grave_1','world:grave_2']),x,y,{force:true,scale:.9});
 opt(b,'gen:inflatable-pumpkin',8,6,{scale:1.35});b.put('world:tree_dead_1',10.5,-1.5,{force:true,scale:1.4});b.put('ref:halloween-sheet-ghost',7,1.5,{force:true});b.put('ref:halloween-sheet-ghost',11,2.5,{force:true});
 b.put('world:scarecrow',11.5,8,{force:true});for(let i=0;i<3;i++)b.put('ref:halloween-hay-bales',5+i*1.6,9,{force:true});b.put('world:candy_stand',5.5,3.2,{force:true,scale:.8});
 k.door(-2.5,-1.4,true);k.door(3,-1.4);for(let i=0;i<14;i++)b.put(pick(PUMP),rr(-12,12),rr(-1,9.5),{pad:-.2,scale:rr(.8,1.05),flip:rnd()<.5});
 b.put('ref:halloween-witch-sign',-3,9.4,{force:true});k.bed(-12.8,-11,-10,-1,1.4,['world:bush_2','town:fern','town:ornamental_grass']);k.bed(10,-11,12.8,-1,1.4,['world:bush_2','town:fern']);
 k.cover(-13,-2,13,10,1/4,DRIFTS.concat(['town:bare_grass','gen:twigs-branches'].filter(id=>items.has(id))));k.clump(-16.5,-8,3,DEAD.concat(EVER),2);k.clump(16.5,-6,2,DEAD,1.6);
 presets.push(b.done());}

// =====================================================================================  10. MOONLITE DRIVE-IN (~44 x 40 m)
{seed=241;const b=Builder('place-drive-in','Moonlite Drive-In','Big screen over an asphalt field: rows of cars nosed toward the screen with speaker posts between them, the snack bar with bins and queue clutter, the marquee at the gate, chain-link sides, trees and popcorn litter.'),k=kit(b);
 b.put('world:drivein_screen',0,-17,{force:true});b.floor({surface:'asphalt',border:'none',x0:-20,y0:-14,x1:20,y1:18});
 for(const y of [-9,-3,3])for(let x=-17;x<=17;x+=3.4){b.put('world:speaker_post',x-1.5,y-2.3,{force:true});if(rnd()<.78)b.put(pick(CARS_N),x,y,{force:true});else b.put('town:oil_stain',x,y,{scale:.9});}
 b.put('world:snack_bar',0,13,{force:true});for(const x of [-5,5])opt(b,'gen:trash-cans-row',x,12.5);b.put('world:vending',-4,16.5,{force:true});b.put('world:bench',5,16.6,{force:true});
 b.put('world:drivein_marquee',18,21.5,{force:true});b.put('world:streetlamp',-19,17,{force:true});b.put('world:streetlamp',19,17,{force:true});
 k.litter(-18,-12,18,17,22);k.cover(-19,-13,19,17,1/40,['town:oil_stain','town:wheel_wear','town:leaf_drift','gen:drift-3']);
 if(items.has('gen:fence-chainlink'))for(const x of [-21,21])b.row('gen:fence-chainlink',x,-14,x,18,8);
 k.clump(-25,-14,3,EVER,2.4);k.clump(25,-12,3,EVER,2.4);k.clump(-25,8,3,AUTUMN,2.4);k.clump(25,10,2,AUTUMN,2);k.bed(-24,-6,-22,18,1.8);k.bed(22,-6,24,18,1.8);
 presets.push(b.done());}

// =====================================================================================  11. VIDEO VAULT & STARCADE (~44 x 32 m)
{seed=251;const b=Builder('place-video-arcade','Video Vault & Starcade','A late-night corner: the video store and the arcade side by side on a busy sidewalk with a tape-return slot, movie standee, VHS cartons, skates, bike racks full of kids\' bikes, newspaper boxes, a phone booth, and a small car park out front.'),k=kit(b);
 b.put('world:video_rental',-9,-12,{force:true,scale:1.2});b.put('world:arcade',11,-12,{force:true,scale:1.25});
 b.floor({surface:'slab',border:'curb',x0:-20,y0:-7.5,x1:20,y1:-1.5});b.keep(-10.5,-7.5,-7.5,-5);b.keep(9.5,-7.5,12.5,-5);
 b.put('poi:tape-return',-5.5,-6.6,{force:true});b.put('poi:movie-display',-12.5,-6.6,{force:true});b.put('poi:vhs-carton',-14.5,-5.6,{force:true});b.put('poi:skates-crate',6.8,-6.4,{force:true});
 b.put('town:bike_rack',2,-3,{force:true});opt(b,'gen:kids-bikes',4.6,-3.5);opt(b,'gen:kids-bikes',-.4,-4.8,{flip:true});opt(b,'gen:newspaper-box',-17.5,-3);b.put('town:phone_booth',17.5,-6.4,{force:true});b.put('world:vending',15.2,-6.6,{force:true});
 opt(b,'gen:trash-cans-row',-2,-6.6);b.put('world:bench',-15,-2.4,{force:true});k.door(-6,-6.2);k.door(14,-6.4);b.row('world:streetlamp',-18,-2,18,-2,12);
 k.litter(-19,-7,19,-2,14);k.cover(-19,-7,19,-2,1/8);
 b.lot({surface:'asphalt',x0:-20,y0:-1.5,x1:20,y1:12,auto:true,bays:[{side:'S',from:-18,to:18,depth:5}]});for(let x=-16.6;x<18;x+=2.7)if(rnd()<.6)b.put('static:compact_s',x,9.2,{force:true});
 k.cover(-19,0,19,11,1/30,['town:oil_stain','town:paving_wear','town:leaf_drift']);
 k.clump(-23,-14,3,AUTUMN,2.2);k.bed(-24,-9,-21,10,1.6);k.clump(23,-13,2,EVER,1.8);k.bed(21,-9,24,10,1.6);k.hedge(-20,-19,20,-19);
 presets.push(b.done());}

// =====================================================================================  12. CORNER LOT GARDEN (~24 x 24 m, small infill)
{seed=263;const b=Builder('place-corner-garden','Corner pocket garden','A small infill piece: a brick-walled pocket garden with a birdbath, bench, packed beds, a crimson maple, a lantern and leaf drifts — drop it into any leftover corner.'),k=kit(b);
 if(items.has('gen:wall-brick-low')){b.row('gen:wall-brick-low',-4,-10.5,4,-10.5,8);b.put('gen:wall-brick-low',-6,10.5,{force:true});b.put('gen:wall-brick-low',6.2,10.5,{force:true});}else{k.hedge(-10,-10.5,10,-10.5);k.hedge(-10,10.5,10,10.5);}
 k.hedge(-10.5,-10,-10.5,10);b.pave({x0:-1,y0:-9,x1:1.2,y1:10,border:'none'});b.keep(-1.1,-9,1.3,10.5);
 opt(b,'gen:birdbath-gnome',3,0);b.put('world:bench',-3,1,{force:true});b.put('ref:halloween-lantern',2.5,5,{force:true});b.put('ref:tree-maple-crimson',-5,-5,{force:true,scale:1.35});
 k.bed(-9.5,-9.5,-2,9.5,1.4);k.bed(2,-9.5,9.5,9.5,1.4);k.cover(-10,-10,10,10,1/4);
 presets.push(b.done());}

// ------------------------------------------------------------------------------------- render thumbs + big reviews
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
