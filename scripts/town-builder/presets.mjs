/** Generate the town builder's preset arrangements (stamps) + thumbnails.
 *  node scripts/town-builder/presets.mjs  ->  output/town-builder/presets/{presets.json,thumbs/*.webp}
 *  A preset is a list of members {dx,dy (metres from the stamp centre), pick:[sprite ids], flip:'random'|bool,
 *  Legacy recipe alternatives are resolved ONCE into a fixed arrangement before thumbnailing and saving.
 *  Stamping never randomizes the result. User-saved presets live in presets/user.json. */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {ROOT} from '../lib/town-scene.mjs';
import {fixedPreset} from './app/fixed-preset.js';
const OUT=path.join(ROOT,'output/town-builder'),PDIR=path.join(OUT,'presets');
await fs.mkdir(path.join(PDIR,'thumbs'),{recursive:true});
const lib=JSON.parse(await fs.readFile(path.join(OUT,'library/library.json'),'utf8')),items=new Map(lib.items.map(i=>[i.id,i]));
let seed=1;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;},rr=(a,b)=>a+rnd()*(b-a),pick=a=>a[Math.floor(rnd()*a.length)];
const gauss=()=>{let u=0;while(!u)u=rnd();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*rnd());};
// ---- families (alternatives a member can roll between)
const F={
 autumn:['ref:tree-maple-crimson','ref:tree-birch-gold','world:tree_oak_0','world:tree_oak_1','world:tree_oak_2'],
 maple:['ref:tree-maple-crimson','world:tree_oak_1','world:tree_oak_2'],birch:['ref:tree-birch-gold'],
 ever:['ref:tree-spruce-blue','world:tree_pine_0','world:tree_pine_1','world:tree_pine_2'],dead:['world:tree_dead_0','world:tree_dead_1','world:tree_dead_2'],
 bush:['world:bush_0','world:bush_1','world:bush_2'],plant:['town:fern','town:hydrangea','town:ornamental_grass','world:bush_0','world:bush_1','world:bush_2'],
 flower:['ref:halloween-mums','town:hydrangea','town:planter_terracotta','town:planter_square'],
 grassDecal:['decal:decal-01-lush-grass','decal:decal-02-dry-golden-grass','decal:decal-03-moss-groundcover','decal:decal-04-low-weeds','decal:decal-05-thin-grass'],
 leafDecal:['decal:decal-06-orange-leaf-scatter','decal:decal-07-red-leaf-cluster','decal:decal-08-yellow-leaf-scatter','town:leaf_drift','decal:scatter-tiny-leaves'],
 tufts:['decal:scatter-grass-tufts','town:ornamental_grass'],mud:['town:mud_grass','town:bare_grass','town:puddle'],litter:['town:paper_litter','town:bag_litter'],
 pumpkin:['world:pumpkin_0','world:pumpkin_1','ref:halloween-pumpkin-cluster'],spooky:['ref:halloween-sheet-ghost','ref:halloween-witch-sign','ref:halloween-lantern','ref:halloween-pumpkin-cluster'],
 grave:['world:grave_0','world:grave_1','world:grave_2'],car:['world:car_0','world:car_1','world:car_2','world:car_3','static:compact_e','static:compact_s','static:pickup_n','static:van_e'],
 carN:['static:compact_n','static:compact_n-v2','static:pickup_n','static:pickup_n-v2'],
};
for(const [k,v] of Object.entries(F))F[k]=v.filter(id=>{if(!items.has(id)){console.warn('missing',id);return false;}return true;});
const R=id=>{const i=items.get(Array.isArray(id)?id[0]:id);return i?Math.max(.5,Math.min(i.fw,i.fh)*.9):1;}; // footprint "radius" in metres
const presets=[];
/** member helper */
const M=(pickList,dx,dy,o={})=>({dx:+dx.toFixed(2),dy:+dy.toFixed(2),pick:Array.isArray(pickList)?pickList:[pickList],flip:o.flip??'random',scale:o.scale??[.88,1.12],jitter:o.jitter??.3,chance:o.chance??1});
/** Poisson-ish scatter of a family inside an ellipse; returns members, avoiding everything already in `taken`. */
function scatter(taken,fam,n,rx,ry,o={}){const out=[];for(let t=0;t<n*40&&out.length<n;t++){const a=rnd()*Math.PI*2,r=Math.sqrt(rnd()),x=Math.cos(a)*r*rx+(o.cx||0),y=Math.sin(a)*r*ry+(o.cy||0),rad=(o.r??R(fam))*(o.gap??1);
 if(taken.some(p=>Math.hypot(p.x-x,p.y-y)<(p.r+rad)*.8))continue;taken.push({x,y,r:rad});out.push(M(fam,x,y,o));}return out;}
function add(id,name,group,desc,members,o={}){presets.push({id,name,group,desc,members,turn:o.turn??true,mirror:o.mirror??true});}
const flat=(fam,n,rx,ry,o={})=>scatter([],fam,n,rx,ry,{r:o.r??.8,gap:o.gap??1,scale:o.scale??[.7,1.2],jitter:.6,chance:o.chance??1,...o});

// ===================================================================== TREES
for(const [v,n,rx] of [['small',6,6],['medium',11,9],['large',18,13]]){seed=17+n;const t=[];
 add(`grove-autumn-${v}`,`Autumn grove (${v})`,'Trees','Mixed maples, oaks and birches with bushes and fallen leaves underneath',
  [...flat(F.leafDecal,Math.round(n*.8),rx*.9,rx*.7),...flat(F.grassDecal,Math.round(n*.4),rx,rx*.8),...scatter(t,F.autumn,n,rx,rx*.75,{r:2.2,gap:.9}),...scatter(t,F.bush,Math.round(n*.6),rx*1.1,rx*.85,{r:.8,chance:.8}),...scatter(t,F.pumpkin,1,rx*.6,rx*.5,{r:.6,chance:.25})]);}
{seed=31;const t=[];add('stand-maple','Crimson maple stand','Trees','Tight cluster of red maples on a carpet of red and orange leaves',
 [...flat(['decal:decal-07-red-leaf-cluster','decal:decal-06-orange-leaf-scatter','town:leaf_drift'],8,6,5),...scatter(t,F.maple,7,5.5,4.5,{r:2,gap:.85})]);}
{seed=33;const t=[];add('clump-birch','Birch clump','Trees','Three to five golden birches growing close together',[...flat(['decal:decal-08-yellow-leaf-scatter','decal:scatter-tiny-leaves'],4,3,3),...scatter(t,F.birch,5,3,2.6,{r:1.3,gap:.8,chance:.85})]);}
for(const [v,n,rx] of [['small',7,6],['large',15,11]]){seed=41+n;const t=[];add(`stand-evergreen-${v}`,`Evergreen stand (${v})`,'Trees','Spruces and pines, a few ferns at their feet',
 [...flat(['decal:decal-03-moss-groundcover','decal:decal-05-thin-grass'],Math.round(n*.4),rx,rx*.8),...scatter(t,F.ever,n,rx,rx*.8,{r:1.8,gap:.85}),...scatter(t,['town:fern','world:bush_2'],Math.round(n*.5),rx,rx*.8,{r:.7,chance:.8})]);}
{seed=51;const t=[];add('woods-mixed','Mixed woodland','Trees','A dense patch of woods: evergreens at the back, autumn trees in front, undergrowth and leaves',
 [...flat(F.leafDecal,12,12,9),...flat(F.grassDecal,6,12,9),...scatter(t,F.ever,8,12,4,{cy:-4,r:1.9}),...scatter(t,F.autumn,12,12,6,{cy:2,r:2}),...scatter(t,F.plant,10,13,9,{r:.8,chance:.85}),...scatter(t,F.dead,1,10,8,{r:1.5,chance:.5})]);}
{seed=57;const m=[];for(let i=0;i<9;i++)m.push(M(F.ever,(i-4)*3.1,gauss()*.4,{jitter:.4}));for(let i=0;i<5;i++)m.push(M(F.bush,(i-2)*5.5+1.5,2.4,{jitter:.6,chance:.7}));
 add('row-windbreak','Windbreak row (pines)','Trees','A straight row of pines with a few bushes on the sunny side',m);}
{seed=59;const m=[];for(let i=0;i<7;i++)m.push(M(F.autumn,(i-3)*4.6,0,{jitter:.3}));for(let i=0;i<7;i++)m.push(M(F.leafDecal,(i-3)*4.6+rr(-1,1),rr(.5,2),{flip:'random',scale:[.7,1.1],jitter:.8,chance:.8}));
 add('row-street-trees','Street tree row','Trees','Evenly spaced autumn trees for a boulevard or a yard edge, leaves under each',m);}
{seed=61;add('tree-lone-leafpile','Lone tree + leaf pile','Trees','A single autumn tree with raked leaf piles and a pumpkin',[M(F.autumn,0,0,{jitter:0}),M(F.leafDecal,1.8,1.6,{scale:[.8,1.1]}),M(F.leafDecal,-1.5,2.2,{scale:[.7,1]}),M('town:leaf_drift',2.6,-.6,{chance:.7}),M(F.pumpkin,2.4,2.8,{chance:.6,r:.5})]);}
{seed=63;const t=[];add('copse-dead','Spooky dead copse','Trees','Bare black trees, a leaning grave and a lantern glow',[...flat(['town:bare_grass','town:mud_grass','decal:scatter-tiny-leaves'],5,5,4),...scatter(t,F.dead,6,5,4,{r:1.6,gap:.8}),...scatter(t,F.grave,2,4,3,{r:.6,chance:.7}),M('ref:halloween-lantern',.5,1.5,{chance:.6})]);}
// ===================================================================== PLANTS & GROUND
for(const [v,n,rx] of [['small',7,2.6],['large',14,4.2]]){seed=71+n;const t=[];add(`bed-shrub-${v}`,`Shrub bed (${v})`,'Plants','Bushes, ferns, hydrangeas and ornamental grass in a planted bed',
 [M('decal:decal-03-moss-groundcover',0,0,{scale:[.9,1.2],jitter:.2}),...scatter(t,F.plant,n,rx,rx*.7,{r:.75,gap:.75}),...scatter(t,['ref:halloween-mums'],2,rx*.8,rx*.6,{r:.5,chance:.6})]);}
{seed=81;const m=[];for(let i=0;i<8;i++)m.push(M('world:hedge',(i-3.5)*2,0,{flip:false,scale:[1,1],jitter:0}));add('row-hedge','Hedge row (16 m)','Plants','Eight clipped hedge blocks in a line',m,{turn:true,mirror:false});}
{seed=83;const m=[];for(let i=0;i<9;i++)m.push(M(F.flower,(i-4)*1.3,rr(-.3,.3),{jitter:.15,scale:[.85,1.05]}));for(let i=0;i<5;i++)m.push(M(F.bush,(i-2)*2.6,-1.2,{jitter:.3,chance:.8}));
 add('border-flowers','Flower border','Plants','A front-yard border of mums and hydrangeas backed by bushes',m);}
{seed=85;const t=[];add('meadow-wild','Wild meadow patch','Plants','Long grass, weeds and tufts to break up a lawn',[...flat(F.grassDecal,9,6,4.5,{r:1.2,scale:[.8,1.3]}),...flat(F.tufts,8,6,4.5,{r:.6}),...scatter(t,['town:ornamental_grass','town:fern'],5,5,4,{r:.6,chance:.8})]);}
{seed=87;const t=[];add('corner-overgrown','Overgrown corner','Plants','Weeds, a bare tree, rubbish and mud where nobody mows',[...flat(F.mud,3,3.5,2.5),...flat(F.tufts,6,4,3),...flat(F.litter,3,3,2.5,{r:.5}),...scatter(t,F.dead,1,1.5,1.5,{r:1.5}),...scatter(t,F.plant,6,4,3,{r:.7})]);}
{seed=89;add('leaves-pile','Leaf piles','Ground','Raked piles and wind-blown leaves',flat(F.leafDecal,9,4.5,3.5,{r:.9,scale:[.7,1.25]}));}
{seed=91;add('ground-mud','Mud & bare patch','Ground','Worn earth, mud and a puddle',[...flat(F.mud,6,3.5,2.6,{r:1,scale:[.8,1.3]}),...flat(['decal:scatter-tiny-leaves'],2,3,2)]);}
{seed=93;add('ground-litter','Litter scatter','Ground','Paper and bags blown into a corner',[...flat(F.litter,6,2.6,2,{r:.5}),...flat(['town:leaf_drift'],2,2.5,2)]);}
// ===================================================================== HALLOWEEN
{seed=101;const m=[];for(let r=0;r<4;r++)for(let c=0;c<6;c++)m.push(M(F.pumpkin,(c-2.5)*2.2+(r%2)*1.1,(r-1.5)*2.2,{jitter:.45,chance:.85}));
 m.push(M('world:scarecrow',.3,-.4,{jitter:.4}),M('ref:halloween-hay-bales',-6.5,3.6,{chance:.8}),M('ref:halloween-hay-bales',6.6,-3.4,{chance:.6}),...flat(['town:mud_grass','decal:decal-02-dry-golden-grass'],4,7,4.5,{r:1.2}));
 add('patch-pumpkin','Pumpkin patch','Halloween','Rows of pumpkins round a scarecrow, hay bales at the corners',m);}
{seed=103;add('yard-halloween','Halloween front yard','Halloween','Sheet ghost, witch sign, pumpkins, mums and a lantern by the path',[M('ref:halloween-sheet-ghost',-1.8,-.6),M('ref:halloween-witch-sign',1.9,-1.1,{flip:false}),M(F.pumpkin,.4,1.4),M(F.pumpkin,1.4,1.9,{chance:.8}),M('ref:halloween-mums',-.6,2),M('ref:halloween-lantern',2.8,1.2,{chance:.8}),M(F.grave,-3,1.2,{chance:.5}),M(F.leafDecal,0,1,{scale:[.7,1]})]);}
{seed=105;add('kit-porch','Trick-or-treat porch kit','Halloween','Small kit for beside a front door: pumpkins, mums, lantern',[M('ref:halloween-pumpkin-cluster',0,0,{jitter:.1}),M('ref:halloween-mums',1,-.4,{chance:.8}),M('world:pumpkin_'+(0),-.8,.5,{chance:.7}),M('ref:halloween-lantern',1.4,.6,{chance:.6})],{turn:false});}
for(const [v,rows,cols] of [['small',3,4],['large',5,7]]){seed=107+rows;const m=[];for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)m.push(M(F.grave,(c-(cols-1)/2)*2.4,(r-(rows-1)/2)*2.6,{jitter:.35,chance:.88,flip:'random'}));
 m.push(M(F.dead,(cols/2+.8)*2.4,-rows*.9,{jitter:.8}),M('ref:halloween-lantern',0,rows*1.4,{chance:.7}),...flat(['town:bare_grass','decal:scatter-tiny-leaves','decal:decal-05-thin-grass'],rows+cols,cols*1.3,rows*1.4,{r:1}));
 if(v==='large')m.push(M('ref:halloween-sheet-ghost',-cols*1.1,rows*.8,{chance:.6}),M(F.dead,-(cols/2+1)*2.4,rows*.7,{jitter:.8}));
 add(`graveyard-${v}`,`Graveyard plot (${v})`,'Halloween','Rows of weathered graves with a bare tree and a lantern',m);}
{seed=113;const m=[M('ref:building-mausoleum',0,0,{flip:'random',jitter:0,scale:[1,1]})];for(let i=0;i<6;i++){const a=i/6*Math.PI*2+.3;m.push(M(F.grave,Math.cos(a)*4.6,Math.sin(a)*4,{jitter:.4,chance:.85}));}
 m.push(M(F.dead,-4.5,-3.5),M('ref:halloween-lantern',2.4,2.6),...flat(['town:mud_grass','decal:scatter-tiny-leaves'],4,5,4));add('cemetery-mausoleum','Mausoleum & graves','Halloween','A small family mausoleum ringed by graves',m);}
{seed=117;const m=[M('world:crypt',0,0,{flip:false,jitter:0,scale:[1,1]})];for(let x=-5;x<=5;x+=2){m.push(M('world:fence_iron_x',x,-4.4,{flip:false,jitter:0,scale:[1,1]}));if(Math.abs(x)>1)m.push(M('world:fence_iron_x',x,4.4,{flip:false,jitter:0,scale:[1,1]}));}
 for(let y=-3.4;y<=3.6;y+=2){m.push(M('world:fence_iron_y',-6,y,{flip:false,jitter:0,scale:[1,1]}),M('world:fence_iron_y',6,y,{flip:false,jitter:0,scale:[1,1]}));}
 m.push(M(F.dead,4.4,-2.8),M('ref:halloween-lantern',-1.4,3.4),M('ref:halloween-lantern',1.4,3.4,{chance:.7}),...flat(['town:bare_grass','town:mud_grass'],3,4,3));add('crypt-fenced','Iron-fenced crypt','Halloween','The old crypt inside a wrought-iron fence, gap for the path, lanterns at the gate',m,{turn:false,mirror:false});}
{seed=121;const m=[M('world:candy_stand',0,0,{flip:false,jitter:0,scale:[1,1]})];for(let i=0;i<5;i++){const a=rr(0,6.28),d=rr(2.6,4.4);m.push(M('ref:halloween-hay-bales',Math.cos(a)*d,Math.sin(a)*d,{jitter:.3,chance:.85}));}
 for(let i=0;i<6;i++)m.push(M(F.pumpkin,rr(-4,4),rr(-3.5,3.5),{jitter:.3,chance:.8}));m.push(M('world:scarecrow',3.6,-2.4),M('ref:halloween-lantern',-2.6,2.6),M('ref:halloween-lantern',2.4,2.8,{chance:.7}),...flat(['decal:decal-02-dry-golden-grass','town:mud_grass'],4,4.5,3.5));
 add('fair-corner','Fall fair corner','Halloween','Candy stand, hay bales, pumpkins, a scarecrow and lanterns',m);}
{seed=123;const m=[M('ref:halloween-lantern',0,0,{jitter:0})];for(let i=0;i<5;i++){const a=i/5*Math.PI*2;m.push(M('ref:halloween-sheet-ghost',Math.cos(a)*2.8,Math.sin(a)*2.2,{jitter:.25}));}m.push(...flat(['town:bare_grass','decal:scatter-tiny-leaves'],3,3,2.5));
 add('ghost-circle','Ghost circle','Halloween','Five sheet ghosts round a lantern. Cool, creepy, very visible',m);}
{seed=125;const t=[];add('grove-haunted','Haunted grove','Halloween','Dead trees, graves, ghosts and lanterns in the fog-free night',[...flat(['town:bare_grass','town:mud_grass','decal:scatter-tiny-leaves'],7,7,5),...scatter(t,F.dead,7,7,5,{r:1.6,gap:.85}),...scatter(t,F.grave,5,6,4,{r:.6}),...scatter(t,['ref:halloween-sheet-ghost'],2,5,4,{r:.7}),...scatter(t,['ref:halloween-lantern'],3,6,4,{r:.5})]);}
{seed=127;const m=[];for(let i=0;i<4;i++)m.push(M('world:scarecrow',rr(-6,6),rr(-4,4),{jitter:.5}));m.push(...flat(['decal:decal-02-dry-golden-grass','town:mud_grass','decal:scatter-grass-tufts'],10,8,5,{r:1.2}),...flat(F.pumpkin,5,7,4,{r:.6,chance:.8}),M('ref:halloween-hay-bales',0,0));
 add('field-scarecrows','Scarecrow field','Halloween','A dry field watched over by scarecrows',m);}
// ===================================================================== STREET & TOWN
{seed=131;add('corner-busstop','Bus stop corner','Street','Bus shelter, bench, bin, sign and a utility pole',[M('town:bus_stop',0,0,{flip:false,jitter:0,scale:[1,1]}),M('world:bench',2.8,.1,{flip:false,scale:[1,1],jitter:.1}),M('world:trashcan',-2.1,.4,{scale:[1,1]}),M('town:street_sign',3.9,1.2,{flip:false,scale:[1,1],jitter:.1}),M('town:utility_pole',-3.6,-.6,{flip:false,scale:[1,1],chance:.8}),M(F.litter,1,1.4,{chance:.6}),M('town:leaf_drift',-1,1.5,{chance:.7})],{turn:false,mirror:true});}
{seed=133;const m=[];for(let i=0;i<3;i++)m.push(M('town:picnic_table',(i-1)*4.2,rr(-.6,.6),{jitter:.4,flip:'random',chance:i===1?1:.85}));m.push(M('world:trashcan',6.3,.4),M('world:bench',0,-3.2,{chance:.7}),M(F.autumn,-5,-4),M(F.autumn,4.6,-4.6,{chance:.8}),...flat(F.leafDecal,5,6,4),...flat(['decal:decal-01-lush-grass'],2,5,3));
 add('area-picnic','Picnic area','Street','Picnic tables under autumn trees with a bin and a bench',m);}
{seed=135;add('alley-clutter','Alley clutter','Street','Dumpster, crates, bins, bags and an oil stain behind a shop',[M('town:dumpster',0,0,{flip:false,jitter:.1,scale:[1,1]}),M('town:delivery_crates',2.2,-.4,{scale:[.9,1.05]}),M('town:delivery_crates',2.8,.9,{chance:.6}),M('world:trashcan',-1.9,.3),M('world:trashcan',-2.6,-.4,{chance:.7}),M(F.litter,.6,1.6),M(F.litter,-1.2,1.8,{chance:.8}),M('town:oil_stain',1.5,2.4,{chance:.8}),M('town:puddle',-.6,2.8,{chance:.5}),M('town:gravel_spill',3,1.8,{chance:.5})]);}
{seed=137;add('front-shop','Shop front dressing','Street','Planters, bench, bike rack, vending machine and a phone booth for a sidewalk',[M('town:planter_terracotta',-3.2,0,{flip:false}),M('town:planter_square',3.2,0,{flip:false}),M('world:bench',-1.2,.2,{flip:false,scale:[1,1]}),M('town:bike_rack',1.4,.4,{flip:false,scale:[1,1],chance:.8}),M('world:vending',4.8,-.2,{flip:false,scale:[1,1],chance:.6}),M('town:phone_booth',-4.9,-.3,{flip:false,scale:[1,1],chance:.5}),M('world:trashcan',.1,-.6,{chance:.7})],{turn:false,mirror:true});}
{seed=139;const m=[M(['ref:landmark-fountain','ref:landmark-fountain-v2'],0,0,{flip:false,jitter:0,scale:[1,1]})];for(let i=0;i<4;i++){const a=i/4*Math.PI*2+Math.PI/4;m.push(M('world:bench',Math.cos(a)*4,Math.sin(a)*4,{scale:[1,1],jitter:.1}));m.push(M(F.flower,Math.cos(a+.6)*4.3,Math.sin(a+.6)*4.3,{chance:.8}));}
 m.push(M(F.autumn,-6.5,-5),M(F.autumn,6.2,-5.4,{chance:.8}),M('world:streetlamp',5,4.6,{flip:false,scale:[1,1],chance:.7}));add('nook-fountain','Fountain nook','Street','A fountain ringed by benches and flowers, trees behind',m);}
{seed=141;add('playground','Playground','Street','Swings, jungle gym, merry-go-round, bench and a bin on worn ground',[...flat(['town:bare_grass','town:mud_grass'],4,6,4,{r:1.4,scale:[1,1.4]}),M('world:swings',-4.4,-1.6,{flip:'random',scale:[1,1],jitter:.2}),M(['world:junglegym_0','world:junglegym_1'],1.6,-1.8,{scale:[1,1],jitter:.2}),M('world:merrygoround',3.4,3.2,{scale:[1,1],jitter:.2,chance:.9}),M('world:bench',-3.4,3.8,{scale:[1,1]}),M('world:trashcan',-1.3,4.4,{scale:[1,1]}),M(F.autumn,-8,2.6,{chance:.8}),...flat(F.leafDecal,3,6,4)]);}
{seed=143;add('farm-stand','Roadside farm stand','Street','Produce stand with hay, pumpkins and the farmer\'s pickup',[M('town:produce_stand',0,0,{flip:false,scale:[1,1],jitter:0}),M('ref:halloween-hay-bales',-2.6,.4),M('ref:halloween-hay-bales',2.6,.2,{chance:.7}),M(F.pumpkin,-1.2,1.6),M(F.pumpkin,1.1,1.8),M(F.pumpkin,.1,2.3,{chance:.7}),M('static:pickup_n',4.6,-2.6,{flip:false,scale:[1,1],chance:.8}),M('ref:halloween-mums',-3.2,1.8,{chance:.7}),...flat(['decal:decal-02-dry-golden-grass','town:wheel_wear'],3,4,3)],{turn:false,mirror:true});}
{seed=145;const m=[];for(let i=0;i<5;i++)m.push(M(F.carN,(i-2)*2.8,0,{flip:false,scale:[1,1],jitter:.08,chance:.8}));for(let i=0;i<3;i++)m.push(M('town:oil_stain',(i-1)*3.6+rr(-.5,.5),.8,{chance:.6}));
 add('cars-parked-row','Parked cars (5 bays)','Street','Up to five nose-in cars in 2.8 m bays: drop on a car park',m,{turn:false,mirror:true});}
{seed=147;add('kit-curb','Curb kit','Street','Hydrant, mailbox, bin and a street sign for a sidewalk corner',[M('world:hydrant',0,0,{scale:[1,1],jitter:.1}),M('world:mailbox',1.6,.2,{scale:[1,1]}),M('world:trashcan',-1.4,.3,{scale:[1,1],chance:.7}),M('town:street_sign',2.8,.1,{flip:false,scale:[1,1],chance:.6}),M('town:leaf_drift',.4,.9,{chance:.7})],{turn:false,mirror:true});}
{seed=149;const m=[];for(let i=0;i<4;i++)m.push(M('town:utility_pole',(i-1.5)*14,0,{flip:false,scale:[1,1],jitter:0}));add('row-utility-poles','Utility pole line (56 m)','Street','Four wooden utility poles 14 m apart along a road',m,{turn:false,mirror:true});}
// ===================================================================== COOL STUFF
{seed=151;add('car-abandoned','Abandoned car in the weeds','Cool stuff','An old car left to rot under a dead tree, swallowed by weeds and leaves',[M(['world:car_0','world:car_3','static:pickup_n-v2','static:van_e-v2'],0,0,{flip:'random',jitter:0,scale:[1,1]}),...flat(F.tufts,8,3.5,2.5,{r:.6}),...flat(F.leafDecal,4,3.5,2.5),M(F.dead,-3.4,-2.6),M(F.plant,2.6,1.6),M(F.plant,-2.4,1.8,{chance:.8}),M('town:mud_grass',1,-1.6,{chance:.7}),M('ref:halloween-sheet-ghost',1.8,-2.4,{chance:.25})]);}
{seed=153;const m=[];for(let x=-4;x<=4;x+=2){m.push(M('world:fence_picket_x',x,-4,{flip:false,jitter:0,scale:[1,1]}));if(Math.abs(x)>0)m.push(M('world:fence_picket_x',x,4,{flip:false,jitter:0,scale:[1,1]}));}
 for(let y=-3;y<=3;y+=2){m.push(M('world:fence_picket_y',-5,y,{flip:false,jitter:0,scale:[1,1]}),M('world:fence_picket_y',5,y,{flip:false,jitter:0,scale:[1,1]}));}
 const t=[{x:0,y:4,r:1}];m.push(...scatter(t,F.plant,8,3.6,2.6,{r:.7}),...scatter(t,['ref:halloween-mums','ref:halloween-pumpkin-cluster'],3,3,2,{r:.6}),M('decal:decal-03-moss-groundcover',0,0,{scale:[1.1,1.3],jitter:0}));
 add('garden-picket','Picket-fenced garden','Cool stuff','A little garden behind a white picket fence, gate gap at the front',m,{turn:false,mirror:false});}
{seed=155;const m=[];for(let i=0;i<3;i++)for(let j=0;j<2;j++)m.push(M(F.car,(i-1)*5.2+rr(-.6,.6),(j-.5)*4.6+rr(-.5,.5),{flip:'random',scale:[1,1],jitter:.4,chance:.85}));
 m.push(M('town:dumpster',-8,-1.5,{flip:false}),M('town:delivery_crates',-8.4,1.2),...flat(['town:oil_stain','town:gravel_spill','town:wheel_wear','town:puddle'],9,9,5,{r:1}),...flat(F.tufts,5,9,5,{r:.6}),M(F.dead,8.5,-3.2,{chance:.8}));
 add('junkyard','Junkyard','Cool stuff','Rusting cars parked every which way, oil, gravel and a dumpster',m);}
{seed=157;const m=[M('world:drivein_screen',0,-6,{flip:false,jitter:0,scale:[.55,.55]})];for(let r=0;r<2;r++)for(let c=0;c<4;c++){m.push(M('world:speaker_post',(c-1.5)*4-1.4,r*5+.5,{flip:false,scale:[1,1],jitter:0}));m.push(M(F.carN,(c-1.5)*4,r*5+1.5,{flip:false,scale:[1,1],jitter:.1,chance:.75}));}
 add('drivein-mini','Mini drive-in','Cool stuff','A half-size movie screen with two rows of cars and speaker posts',m,{turn:false,mirror:false});}
{seed=159;const t=[];add('pond-edge-reeds','Reed & fern bank','Cool stuff','Lush ferns, reeds and moss for the edge of water or a ditch',[...flat(['decal:decal-03-moss-groundcover','decal:decal-01-lush-grass','town:puddle'],6,5,2.5,{r:1.2}),...scatter(t,['town:ornamental_grass','town:fern','town:ornamental_grass'],12,5.5,2.8,{r:.55,gap:.7}),...scatter(t,F.birch,2,5,2.6,{r:1.3,chance:.7})]);}
{seed=161;const m=[];const n=14;for(let i=0;i<n;i++){const a=i/n*Math.PI*2;m.push(M('ref:halloween-pumpkin-cluster',Math.cos(a)*4.4,Math.sin(a)*3.6,{jitter:.15,scale:[.85,1.05]}));}
 m.push(M('world:scarecrow',0,0,{jitter:0}),M('ref:halloween-lantern',1.5,1,{jitter:.2}),M('ref:halloween-lantern',-1.5,-1,{jitter:.2}),...flat(['town:bare_grass','decal:scatter-tiny-leaves'],3,3,2.6));
 add('pumpkin-ring','Pumpkin ring','Cool stuff','A ring of glowing jack-o-lanterns round a scarecrow: a great landmark',m);}
// ---------------------------------------------------------------- validate + thumbnails
const SC=32;let thumbs=0;
async function thumb(p){ // resolve one variation (no jitter), project at game scale, fit into 224 px
 const parts=[];for(const m of p.members){const id=m.pick[0],it=items.get(id);const sc=m.scale[0],flip=!!m.flip;
  parts.push({it,flip,sc,sx:(m.dx-m.dy)*SC,sy:(m.dx+m.dy)*SC/2});}
 parts.sort((a,b)=>(a.it.flat?0:1)-(b.it.flat?0:1)||a.sy-b.sy);
 let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const q of parts){const w=q.it.w*q.sc,h=q.it.h*q.sc,l=q.flip?q.sx-(q.it.w-q.it.ax)*q.sc:q.sx-q.it.ax*q.sc,t=q.sy-q.it.ay*q.sc;Object.assign(q,{w,h,l,t});x0=Math.min(x0,l);y0=Math.min(y0,t);x1=Math.max(x1,l+w);y1=Math.max(y1,t+h);}
 const W=Math.ceil(x1-x0)+8,H=Math.ceil(y1-y0)+8,comp=[];
 for(const q of parts){let im=sharp(path.join(OUT,'library',q.it.file)).resize(Math.max(1,Math.round(q.w)),Math.max(1,Math.round(q.h)));if(q.flip)im=im.flop();comp.push({input:await im.png().toBuffer(),left:Math.round(q.l-x0+4),top:Math.round(q.t-y0+4)});}
 const big=await sharp({create:{width:W,height:H,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(comp).png().toBuffer();
 await sharp(big).resize(224,224,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).webp({quality:88}).toFile(path.join(PDIR,'thumbs',p.id+'.webp'));thumbs++;
 return {spanM:+Math.max(...p.members.map(m=>Math.hypot(m.dx,m.dy))).toFixed(1)};}
for(const p of presets){Object.assign(p,fixedPreset(p));for(const m of p.members)if(!m.pick.length)throw Error('empty pick in '+p.id);Object.assign(p,await thumb(p),{thumb:'presets/thumbs/'+p.id+'.webp',count:p.members.length});}
const groups=[...new Set(presets.map(p=>p.group))];
await fs.writeFile(path.join(PDIR,'presets.json'),JSON.stringify({version:1,groups,presets},null,1));
console.log(JSON.stringify({presets:presets.length,thumbs,byGroup:Object.fromEntries(groups.map(g=>[g,presets.filter(p=>p.group===g).length]))}));
