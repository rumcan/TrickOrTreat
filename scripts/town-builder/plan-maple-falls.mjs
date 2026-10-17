/** Maple Falls — 25 points of interest and the roads between them, inspired by the grown reference town.
 *  Writes output/town-builder/plans/maple-falls.json (ground: roads, lots, lamps, POI plots) and
 *  output/town-builder/layout-seed.json (starting sprite placements for the town builder app).
 *  World metres: X runs to screen lower-right, Y to screen lower-left. 20 m road cells; 1 game tile = 2 m.
 *  Building art only shows its front facing +Y (a road on its south side) or, mirrored, +X (a road on its east
 *  side), so frontages are planned on the north side of east-west streets and the west side of north-south ones. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {ROOT} from '../lib/town-scene.mjs';
const OUT=path.join(ROOT,'output/town-builder'),lib=JSON.parse(await fs.readFile(path.join(OUT,'library/library.json'),'utf8'));
const item=id=>{const i=lib.items.find(x=>x.id===id);if(!i)throw Error('no sprite '+id);return i;};
const NX=14,NY=12,roads=[];
const row=(y,x0,x1)=>{for(let x=x0;x<=x1;x++)roads.push(`${x},${y}`);},col=(x,y0,y1)=>{for(let y=y0;y<=y1;y++)roads.push(`${x},${y}`);};
row(5,-1,14);            // Main Street (exits west and east)
col(7,-1,12);            // Hollow Road (exits north and south)
col(3,1,9);col(11,1,9);  // Church Road, Bowl Avenue
row(1,2,6);row(1,8,14);  // Farm Lane (cul-de-sac at the farm) and School Road (exits east)
row(9,3,11);             // South Street
roads.push('5,10','9,10','9,11'); // Elm Court and Oak Court cul-de-sacs
col(3,10,11);row(11,0,2);         // Church Road runs on south and turns west as Willow Lane (cul-de-sac at the west end)
const uniq=[...new Set(roads)];
const lines={double:[],none:['5,10','9,10','9,11']};for(let x=0;x<=13;x++)if(![3,7,11].includes(x))lines.double.push(`${x},5`);
// curb references (world metres)
const N=y=>20*y+6.75,S=y=>20*y+13.25,Wc=x=>20*x+6.75,E=x=>20*x+13.25,walkN=y=>20*y+4.7,walkS=y=>20*y+15.3,walkW=x=>20*x+4.7,walkE=x=>20*x+15.3;
const lots=[],lamps=[],pois=[],place=[];
const lot=o=>{lots.push(o);return o;};
/** Place a sprite so its FRONT face sits on a line: axis 'Y' faces south (+Y), axis 'X' faces east (+X, mirrored). */
function front(id,axis,frontAt,along,opt={}){const i=item(id),s=opt.scale||1;
 if(axis==='Y')place.push({id,x:along,y:frontAt-i.fh*s,flip:!!opt.flip,scale:s});
 else place.push({id,x:frontAt-i.fh*s,y:along,flip:!opt.flip,scale:s});}
const at=(id,x,y,opt={})=>place.push({id,x,y,flip:!!opt.flip,scale:opt.scale||1});
const poi=(n,name,x0,y0,x1,y1,desc)=>pois.push({n,name,x0,y0,x1,y1,desc});

const MAIN_N=walkN(5)-.3; // shop fronts along Main Street's north sidewalk (Y 104.4)
// ---- 1-5: Main Street west block (between the west edge and Church Road)
poi(1,'Pike & Pine Outfitters',6,90,16,104.7,'Fish & tackle shop at the west end of Main Street');
front('town:fish_tackle','Y',MAIN_N,11);
poi(2,"Rose's Bakery & Barber",17,90,32,104.7,'Bakery and barber shop fronting Main Street');
front('town:bakery','Y',MAIN_N,20.5);front('town:barber','Y',MAIN_N,28);
poi(3,'Maple Pharmacy',33,90,40,104.7,'Corner pharmacy');front('town:pharmacy','Y',MAIN_N,36.5);
poi(4,'Maple Family Market',41,80,62,104.7,'The grocery with its side car park');front('town:grocery','Y',MAIN_N,46);
lot({id:'market-lot',x0:52.5,y0:84,x1:62.5,y1:104.7,surface:'asphalt',noBorder:['S'],openings:[{side:'S',a0:54,a1:61}],bays:[{side:'N',from:54,to:61,depth:5}]});
poi(5,'Blackwood House',30,40,64.7,80,'The haunted Victorian on Church Road, with a spooky yard');
front('ref:building-house-large','X',walkW(3)-.4,58);
for(const [x,y,id] of [[52,46,'world:tree_dead_0'],[44,52,'world:tree_dead_1'],[38,66,'world:tree_dead_2'],[56,70,'world:grave_0'],[53,73,'world:grave_1'],[58,49,'ref:halloween-sheet-ghost'],[60,66,'ref:halloween-pumpkin-cluster'],[47,63,'ref:halloween-witch-sign'],[62,52,'ref:halloween-lantern']])at(id,x,y);
for(let y=44;y<=76;y+=2)at('world:fence_iron_y',63.6,y);
// ---- 6-8: Church, cemetery, post office (Church Road to Hollow Road)
poi(6,'Maple Falls Post Office',77,90,88,104.7,'Post office on Main Street');front('town:postoffice','Y',MAIN_N,83);
poi(7,"St. Hallow's Church",89,82,106,104.7,'The white church and its car park');front('world:church','Y',MAIN_N,98);
lot({id:'church-lot',x0:108,y0:84,x1:143,y1:104.7,surface:'asphalt',noBorder:['S'],openings:[{side:'S',a0:122,a1:129}],bays:[{side:'N',from:110,to:141,depth:5}]});
poi(8,'Old Hollow Cemetery',77,38,143,80,'Walled graveyard with the crypt and mausoleum');
at('world:crypt',110,52);front('ref:building-mausoleum','Y',70,130);front('ref:building-mausoleum','Y',58,90);
{let k=0;for(let y=44;y<=76;y+=4)for(let x=82;x<=140;x+=5){if(Math.hypot(x-110,y-52)<9||Math.hypot(x-130,y-68)<5||Math.hypot(x-90,y-56)<5)continue;at(`world:grave_${k++%3}`,x+((y/4)%2)*1.5,y);}}
for(let x=78;x<=142;x+=2){at('world:fence_iron_x',x,37.6);if(Math.abs(x-110)>3)at('world:fence_iron_x',x,81.4);}
for(let y=39;y<=80;y+=2){at('world:fence_iron_y',77,y);at('world:fence_iron_y',143.4,y);}
for(const [x,y] of [[80,42],[141,44],[86,78],[137,78]])at('world:tree_dead_'+(Math.round(x)%3),x,y);
// ---- 9-11: Fire station, hardware, laundromat; football field behind (Hollow Road to Bowl Avenue)
poi(9,'Maple Falls Fire House',157,86,171,104.7,'Fire station at the town-square corner');front('town:firestation','Y',MAIN_N,164);
poi(10,'Bellamy Hardware',173,90,183,104.7,'Mom-and-pop hardware store');front('town:hardware','Y',MAIN_N,178);
poi(11,'Spin Cycle Laundry',185,90,196,104.7,'Laundromat');front('town:laundromat','Y',MAIN_N,190.5);
lot({id:'firehouse-apron',x0:157,y0:96,x1:171,y1:104.7,surface:'slab',border:'none'});
poi(12,'Panther Field',157,38,223,82,'High-school football field with bleachers and scoreboard');
lot({id:'field',x0:160,y0:42,x1:221,y1:72,surface:'field',border:'none'});
for(const x of [172,190,208])front('world:bleachers','Y',82,x);at('world:goalposts',158.5,57);at('world:goalposts',222.5,57,{flip:true});at('world:scoreboard',190,39);
// ---- 13-14: Starcade and the water tower (east of Bowl Avenue)
poi(13,'The Starcade',237,84,255,104.7,'Neon arcade with its own car park');front('world:arcade','Y',MAIN_N,246);
lot({id:'arcade-lot',x0:256,y0:82,x1:279,y1:104.7,surface:'asphalt',noBorder:['S'],openings:[{side:'S',a0:262,a1:269}],bays:[{side:'N',from:258,to:277,depth:5}]});
poi(14,'Maple Falls Water Tower',237,38,279,80,'The water tower on the hill behind the arcade');at('world:watertower',258,56);
// ---- 15-17: north of Farm Lane / School Road: farm, pumpkin patch, high school
poi(15,'Hollow Farm',2,2,58,24.7,'Barn, silo, windmill, farmhouse and the farm yard');
lot({id:'farm-yard',x0:4,y0:3,x1:56,y1:24.7,surface:'dirt',border:'none'});
front('world:barn','Y',walkN(1)-1,22);at('ref:landmark-silo',33,10);at('ref:landmark-windmill',45,8);front('ref:building-farmhouse','Y',walkN(1)-1,48);front('ref:building-farm-shed','Y',14,8);
at('world:scarecrow',14,20);at('ref:halloween-hay-bales',30,20);at('ref:halloween-hay-bales',38,22);at('static:pickup_n',40,15);
poi(16,'Pumpkin Patch',76,2,143,24.7,'Pumpkin field with scarecrows and hay bales');
lot({id:'patch',x0:78,y0:3,x1:141,y1:23.5,surface:'dirt',border:'none'});
for(let y=6;y<=21;y+=3)for(let x=81;x<=138;x+=4)at('world:pumpkin_'+((x+y)%2),x+((y/3)%2)*2,y);
at('world:scarecrow',100,12);at('world:scarecrow',125,8);at('ref:halloween-hay-bales',90,20);at('world:candy_stand',134,17);
poi(17,'Maple Falls High School',156,2,224.7,24.7,'High school with its staff car park');
front('world:school','Y',walkN(1)-.4,172);
lot({id:'school-lot',x0:186,y0:4,x1:222,y1:24.7,surface:'asphalt',noBorder:['S'],openings:[{side:'S',a0:200,a1:207}],bays:[{side:'N',from:188,to:220,depth:5}]});
at('world:schoolbus',200,13);
poi(18,'Bus Depot',236,2,279,24.7,'Garages for the school buses');front('static:garage_brick','Y',walkN(1)-.4,246);front('static:garage_brick-v2','Y',walkN(1)-.4,252);at('world:schoolbus',266,14);
lot({id:'depot',x0:238,y0:4,x1:278,y1:24.7,surface:'asphalt',noBorder:['S'],openings:[{side:'S',a0:258,a1:268}]});
// ---- 19-21: south of Main Street: drive-in, park, town square
poi(19,'Moonlite Drive-In',2,116,64.7,236,'Drive-in theatre: big screen, snack bar and speaker rows');
lot({id:'drive-in',x0:14,y0:128,x1:62,y1:196,surface:'asphalt',noBorder:['E'],radius:3,openings:[{side:'E',a0:150,a1:158}]});
at('world:drivein_screen',30,126);at('world:snack_bar',40,186);at('world:drivein_marquee',walkW(3)-2.5,168); // never mirror signs: the lettering would read backwards
{const cars=['static:compact_n','static:compact_n-v2','static:pickup_n','world:car_0','world:car_2','static:compact_n','static:pickup_n-v2'];let k=0;
 for(let y=144;y<=176;y+=10)for(let x=20;x<=56;x+=6){at('world:speaker_post',x-2.5,y-2);if((x*7+y*3)%5<3)at(cars[k++%cars.length],x,y);}}
poi(20,'Hollow Park',76,116,143,184.7,'Town park with the gazebo, fountain and paths');
lot({id:'park-path-ew',x0:78,y0:148,x1:142,y1:152,surface:'slab',border:'none'});lot({id:'park-path-ns',x0:108,y0:118,x1:112,y1:184,surface:'slab',border:'none'});
lot({id:'park-plaza',x0:100,y0:140,x1:120,y1:160,surface:'slab',border:'curb'});
at('ref:landmark-fountain-v2',110,150);at('world:gazebo',88,132);for(const [x,y] of [[98,145],[122,145],[98,156],[122,156]])at('world:bench',x,y);
poi(21,'Town Square',156,116,186,140,'Paved square by the crossroads, the heart of Maple Falls');
lot({id:'square',x0:157,y0:116.5,x1:186,y1:140,surface:'slab',border:'curb'});at('ref:landmark-fountain',171,128);
for(const [x,y] of [[162,121],[180,121],[162,135],[180,135]])at('town:planter_terracotta',x,y);at('town:phone_booth',184,118);
// ---- 22-23: video store and primary school (Hollow Road to Bowl Avenue, south of Main)
poi(22,'Video Vault',196,140,224.7,165,'Video rental store facing Bowl Avenue');front('world:video_rental','Y',165.5,208); // faces its car park; mirroring would reverse VIDEO VAULT
lot({id:'video-lot',x0:196,y0:166,x1:224.7,y1:180,surface:'asphalt',noBorder:['E'],openings:[{side:'E',a0:169,a1:176}],bays:[{side:'S',from:198,to:216,depth:5}]});
poi(23,'Hollow Creek Primary',156,145,195,184.7,'Primary school and playground on South Street');
front('world:primary_school','Y',walkN(9)-.4,170);lot({id:'playground',x0:158,y0:146,x1:194,y1:162,surface:'dirt',border:'none'});
at('world:swings',164,152);at('world:junglegym_0',176,154);at('world:merrygoround',188,152);
// ---- 24-25: diner and gas station (east of Bowl Avenue, on their own forecourts)
poi(24,'Moonlight Diner',236,116,279,170,'Chrome diner on its car park');
lot({id:'diner-lot',x0:236,y0:138,x1:278,y1:168,surface:'asphalt',noBorder:['W'],openings:[{side:'W',a0:150,a1:158}],bays:[{side:'S',from:240,to:276,depth:5}]});
front('world:diner','Y',137.5,256);at('static:compact_w',248,148);at('static:compact_e',268,147);
poi(25,'Hollow Gas & Service',236,172,279,236,'Gas station: pumps under the canopy and the service shop');
lot({id:'gas',x0:236,y0:176,x1:272,y1:210,surface:'asphalt',noBorder:['W'],openings:[{side:'W',a0:180,a1:188},{side:'W',a0:198,a1:206}]});
at('ref:building-gas-canopy',252,193);front('ref:building-gas-shop','Y',186,266);at('static:van_e',262,204);at('static:compact_s',250,191);
// ---- homes: Elm Court and Oak Court, and Hollow Road south
const homes=['world:house_0','world:house_1','world:house_2','world:house_3','world:house_4','world:house_5','ref:building-house-cottage','ref:building-house-dormer','ref:building-house-garage'];let h=0;
for(const y of [206,226])front(homes[h++%homes.length],'X',walkW(5)-.6,y);         // Elm Court, west side
for(const y of [204,220,234])front(homes[h++%homes.length],'X',walkW(9)-.6,y);    // Oak Court, west side
for(const y of [204,222])front(homes[h++%homes.length],'X',walkW(7)-.6,y);        // Hollow Road south, west side
for(const x of [24,36,48])front(homes[h++%homes.length],'Y',walkN(11)-.6,x);    // Willow Lane, north side
for(const y of [204,224])front(homes[h++%homes.length],'Y',y+6,128);              // east of Elm Court
for(const x of [244,258,272])front(homes[h++%homes.length],'Y',236,x);             // the south-east corner
// ---- street lamps on the camera-facing curbs, and a few in the larger car parks
for(const x of [22,48,94,134,176,206,254,272])lamps.push({x,y:N(5)});
for(const y of [44,78,130,170,214,232])lamps.push({x:Wc(7),y});
for(const y of [46,86,134,176])lamps.push({x:Wc(3),y});for(const y of [46,86,132,174])lamps.push({x:Wc(11),y});
for(const x of [88,128,178,214,262])lamps.push({x,y:N(1)});for(const x of [92,130,172,206])lamps.push({x,y:N(9)});
for(const [x,y] of [[30,140],[30,200],[126,96],[268,96],[256,160],[248,212],[206,16]])lamps.push({x,y,free:true});
for(const y of [190,210])lamps.push({x:Wc(3),y});for(const x of [12,30,48])lamps.push({x,y:N(11)});
// ---------------------------------------------------------------- dressing: cars in bays, house fronts, trees by zone
let seed=7;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;},pick=a=>a[Math.floor(rnd()*a.length)];
// parked cars in roughly half of the marked bays, nose-in
for(const l of lots)for(const b of l.bays||[]){const sp=b.spacing??2.7,dep=b.depth??5,n=Math.floor((b.to-b.from)/sp+1e-6);
 for(let k=0;k<n;k++){if(rnd()>.55)continue;const u=b.from+(k+.5)*sp,inset=.3+dep/2;
  if(b.side==='N'||b.side==='S'){const id=pick(['static:compact_n','static:compact_s','static:compact_n-v2','static:pickup_n']);at(id,u,b.side==='N'?Math.min(l.y0,l.y1)+inset:Math.max(l.y0,l.y1)-inset);}
  else{const id=pick(['static:compact_e','static:compact_w','static:van_e']);at(id,b.side==='W'?Math.min(l.x0,l.x1)+inset:Math.max(l.x0,l.x1)-inset,u);}}}
// Halloween at every home: something on the porch side and a mailbox at the walk
for(const p of place.slice()){if(!homes.includes(p.id))continue;const i=item(p.id),hw=(p.flip?i.fh:i.fw),hh=(p.flip?i.fw:i.fh);
 const deco=['ref:halloween-pumpkin-cluster','ref:halloween-mums','ref:halloween-lantern','ref:halloween-sheet-ghost','ref:halloween-witch-sign','world:pumpkin_0','world:pumpkin_1','ref:halloween-hay-bales'];
 if(p.flip){at(pick(deco),p.x+hw+1.3,p.y-hh*.5);at(pick(deco),p.x+hw+1.1,p.y+hh*.6);at('world:mailbox',p.x+hw+2.6,p.y+hh+.6);}
 else{at(pick(deco),p.x-hw*.55,p.y+hh+1.3);at(pick(deco),p.x+hw*.6,p.y+hh+1.1);at('world:mailbox',p.x+hw+.6,p.y+hh+2.6);}
 at(pick(['world:bush_0','world:bush_1','world:bush_2','town:hydrangea']),p.x-hw-1.2,p.y+(rnd()-.5)*hh);}
// occupancy: roads + sidewalks (+ margin), lots, and everything already placed
const {RUNS,evalRun,maskAt}=await import('../lib/road-v4-kit.mjs');const cellSet=new Set(uniq),o={};
const onRoad=(X,Y,m=1.4)=>{for(const [dx,dy] of [[0,0],[m,0],[-m,0],[0,m],[0,-m]]){const x=X+dx,y=Y+dy,cx=Math.floor(x/20),cy=Math.floor(y/20);if(!cellSet.has(`${cx},${cy}`))continue;
 for(const r of RUNS[maskAt(cellSet,cx,cy)]){evalRun(r,x-cx*20,y-cy*20,x,y,o);}let bs=-1e9;for(const r of RUNS[maskAt(cellSet,cx,cy)]){evalRun(r,x-cx*20,y-cy*20,x,y,o);bs=Math.max(bs,o.s);}if(bs<2.05)return true;}return false;};
const onLot=(X,Y,m=1.2)=>lots.some(l=>X>Math.min(l.x0,l.x1)-m&&X<Math.max(l.x0,l.x1)+m&&Y>Math.min(l.y0,l.y1)-m&&Y<Math.max(l.y0,l.y1)+m);
const near=(X,Y,r)=>place.some(p=>{const i=item(p.id);if(i.flat)return false;const hw=(p.flip?i.fh:i.fw)*(p.scale||1)+r,hh=(p.flip?i.fw:i.fh)*(p.scale||1)+r;return Math.abs(X-p.x)<hw&&Math.abs(Y-p.y)<hh;});
const autumn=['ref:tree-maple-crimson','ref:tree-birch-gold','world:tree_oak_0','world:tree_oak_1','world:tree_oak_2','ref:tree-maple-crimson'],evergreen=['ref:tree-spruce-blue','world:tree_pine_0','world:tree_pine_1','world:tree_pine_2'],spooky=['world:tree_dead_0','world:tree_dead_1','world:tree_dead_2'];
function dress(x0,y0,x1,y1,perM2,palette,minD=4,bushes=0){const n=Math.round((x1-x0)*(y1-y0)*perM2*3);let placed=0;
 for(let t=0;t<n&&placed<n/3;t++){const X=x0+rnd()*(x1-x0),Y=y0+rnd()*(y1-y0);if(X<1||Y<1||X>NX*20-1||Y>NY*20-1||onRoad(X,Y)||onLot(X,Y)||near(X,Y,minD))continue;
  at(rnd()<bushes?pick(['world:bush_0','world:bush_1','world:bush_2','town:fern','town:ornamental_grass','town:hydrangea']):pick(palette),+X.toFixed(1),+Y.toFixed(1),{flip:rnd()<.5,scale:+(0.85+rnd()*.3).toFixed(2)});placed++;}}
dress(78,118,142,182,1/110,autumn,3.5,.25);                       // Hollow Park
dress(4,38,30,88,1/90,autumn,4,.1);                               // orchard behind the west shops
for(const [a,b,c,d] of [[0,198,64,240],[76,196,144,240],[156,196,224,240],[236,212,280,240]])dress(a,b,c,d,1/150,autumn.concat(evergreen),4,.35); // homes
dress(236,30,280,80,1/160,autumn.concat(evergreen),5,.2);          // around the water tower
dress(0,0,64,36,1/220,evergreen.concat(autumn),5);dress(0,86,64,100,1/200,autumn,4,.3);
dress(156,0,280,36,1/260,evergreen,5);dress(146,140,156,196,1/200,autumn,4,.3);
for(const [a,b,c,d] of [[0,0,280,14],[0,226,280,240],[0,0,12,240],[268,0,280,240]])dress(a,b,c,d,1/120,evergreen.concat(autumn),4);  // tree line round the town
dress(0,0,280,240,1/900,autumn.concat(evergreen,spooky),6);        // the odd tree anywhere else
const plan={name:'Maple Falls — 25 points of interest',nx:NX,ny:NY,roads:uniq,lines,lots,lamps,pois,notes:'Generated by scripts/town-builder/plan-maple-falls.mjs'};
await fs.mkdir(path.join(OUT,'plans'),{recursive:true});
await fs.writeFile(path.join(OUT,'plans/maple-falls.json'),JSON.stringify(plan,null,1));
await fs.writeFile(path.join(OUT,'layout-seed.json'),JSON.stringify({version:1,plan:'maple-falls.json',sprites:place.map((p,i)=>({uid:i+1,...p}))},null,1));
console.log(JSON.stringify({roads:uniq.length,lots:lots.length,lamps:lamps.length,pois:pois.length,sprites:place.length}));
