import {MAP_W,MAP_H,CW,CH,CR,HW,HH,TW,TH,makeRng,isoX,isoY} from './config';
import type {GameMap,PropInst,HouseInst} from './map';
import {blockedCircle} from './map';
import {G,getTile,getFringe} from './art/tiles';
import {getHouse,HOUSE_COUNT,getTree,getBush,getFence,getGrave,getCrypt,getPumpkin,getLamp,
 getMailbox,getTrash,getSchool,getPrimarySchool,getChurch,getBarn,getWaterTower,
 getDriveInScreen,getSnackBar,getSpeakerPost,getMarquee,getGazebo,getBench,getArcade,
 getDiner,getVideoRental,getVideoStore,getShop,getJungleGym,getSwings,getSchoolBus,type PropSprite} from './art/props';
import {getTownProp,getTownDecal} from './art/town';
import {staticProp,type StaticArtId} from './art/town-static';
import {STATIC_DISTRICTS,STATIC_STREETS,STATIC_CROSSINGS,smoothStreet,type Point} from './town-static-plan';
import {rawCanvas,poly} from './art/draw';
import type {Img} from './assets';

interface Rect {x:number;y:number;w:number;h:number}
interface HomeAccess {house:PropInst;garage:PropInst;driveway:Rect;road:Point}

const mirrored=new Map<PropSprite,PropSprite>();
/** The same sprite facing world +X instead of +Y (a mirror image swaps the two ground axes). A layout stand-in only:
 *  its light then falls from the wrong side, so a building that must face +X gets its own art later. */
function mirror(sp:PropSprite):PropSprite{
 let m=mirrored.get(sp);
 if(!m){
  const c=rawCanvas(sp.img.width,sp.img.height),ctx=c.getContext('2d')!;
  ctx.translate(c.width,0);ctx.scale(-1,1);ctx.drawImage(sp.img,0,0);
  m={img:c,w:sp.w,h:sp.h,ax:sp.w-sp.ax,ay:sp.ay,fw:sp.fh,fh:sp.fw,lights:sp.lights.map(l=>({...l,x:l.y,y:l.x}))};
  mirrored.set(sp,m);
 }
 return m;
}

/** Deliberately separate from buildMap: this is the town's scenery review, before progression integration.
 *  The layout is the reference town's (see town-static-plan.ts): streets first, then every place beside them. */
export function buildStaticTown(seed=1337){
 const rng=makeRng(seed),N=MAP_W*MAP_H;
 const ground=new Uint8Array(N).fill(G.GRASS),coll=new Uint8Array(CW*CH);
 const props:PropInst[]=[],houses:HouseInst[]=[],lights:GameMap['lights']=[];
 const protectedAreas:({name:string}&Rect)[]=[],homes:HomeAccess[]=[];
 const pois:NonNullable<GameMap['pois']>=[],approaches:{from:{x:number;y:number};name:string}[]=[];
 /** per tile: something solid stands here / decoration must stay off it */
 const occupied=new Uint8Array(N),clear=new Uint8Array(N);
 let pid=1;
 const idx=(x:number,y:number)=>Math.floor(y)*MAP_W+Math.floor(x);
 const inside=(x:number,y:number)=>x>=0&&y>=0&&x<MAP_W&&y<MAP_H;
 const rectTiles=(r:Rect,fn:(x:number,y:number)=>void)=>{
  for(let y=Math.floor(r.y);y<Math.ceil(r.y+r.h);y++)for(let x=Math.floor(r.x);x<Math.ceil(r.x+r.w);x++)if(inside(x,y))fn(x,y);
 };
 const paint=(x:number,y:number,w:number,h:number,g:G)=>rectTiles({x,y,w,h},(a,b)=>ground[idx(a,b)]=g);
 const keep=(r:Rect)=>rectTiles(r,(x,y)=>clear[idx(x,y)]=1);
 const contains=(r:Rect,x:number,y:number)=>x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h;
 const overlaps=(a:Rect,b:Rect)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
 const footprint=(p:PropInst):Rect=>({x:p.x0,y:p.y0,w:p.fw,h:p.fh});
 const mark=(r:Rect,solid=2)=>{
  for(let y=Math.max(0,Math.floor(r.y*CR));y<Math.min(CH,Math.ceil((r.y+r.h)*CR));y++)
   for(let x=Math.max(0,Math.floor(r.x*CR));x<Math.min(CW,Math.ceil((r.x+r.w)*CR));x++)coll[y*CW+x]=solid;
 };

 // 0. The streets of the plan as smooth curves. Their coverage of every tile decides what may stand where; the same
 //    curves are drawn onto the ground at the end, so a road bends instead of stepping along the grid.
 const streets=STATIC_STREETS.map(s=>{
  const line=smoothStreet(s),along=[0];
  for(let k=1;k<line.length;k++)along.push(along[k-1]+Math.hypot(line[k][0]-line[k-1][0],line[k][1]-line[k-1][1]));
  return {...s,line,along};
 });
 const PAVEMENT=1,SAMPLES=8;
 const coverage=(width:(street:number)=>number)=>{
  const c=rawCanvas(MAP_W*SAMPLES,MAP_H*SAMPLES),ctx=c.getContext('2d',{willReadFrequently:true})!;
  ctx.scale(SAMPLES,SAMPLES);ctx.strokeStyle='#fff';ctx.lineCap='round';ctx.lineJoin='round';
  for(const s of streets){
   ctx.lineWidth=width(s.width);ctx.beginPath();ctx.moveTo(s.line[0][0],s.line[0][1]);
   for(let k=1;k<s.line.length;k++)ctx.lineTo(s.line[k][0],s.line[k][1]);
   ctx.stroke();
  }
  const data=ctx.getImageData(0,0,c.width,c.height).data,out=new Float32Array(N);
  for(let y=0;y<MAP_H;y++)for(let x=0;x<MAP_W;x++){
   let n=0;
   for(let b=0;b<SAMPLES;b++)for(let a=0;a<SAMPLES;a++)if(data[((y*SAMPLES+b)*c.width+x*SAMPLES+a)*4+3]>127)n++;
   out[y*MAP_W+x]=n/(SAMPLES*SAMPLES);
  }
  c.width=c.height=0;
  return out;
 };
 const roadCover=coverage(w=>w),paveCover=coverage(w=>w+PAVEMENT*2),lineCover=coverage(()=>.5);

 const FURNITURE=new Set(['lamp','mailbox','town_furniture','sign','trash','bench']);
 const add=(sp:PropSprite,x:number,y:number,kind:string,optional=false,solid=2,occludes=true)=>{
  const r={x,y,w:sp.fw,h:sp.fh};
  let problem=x<1||y<1||x+sp.fw>MAP_W-1||y+sp.fh>MAP_H-1?'is outside the map':props.some(p=>overlaps(r,footprint(p)))?'overlaps other scenery':'';
  // street furniture belongs on a pavement; everything else keeps off the pavement as well as the road
  if(!problem)rectTiles(r,(a,b)=>{if(roadCover[idx(a,b)]>.04||(!FURNITURE.has(kind)&&paveCover[idx(a,b)]>.34))problem='stands on a street';});
  if(problem){if(optional)return null;throw Error(`${kind} at ${x},${y} ${problem}`);}
  const p:PropInst={id:pid++,sp,x0:x,y0:y,fw:sp.fw,fh:sp.fh,big:kind!=='tree'&&kind!=='bush'&&kind!=='lamp'&&!kind.startsWith('fence'),kind,shadow:kind==='tree'?.55:kind==='car'?.3:.6,occludesCharacter:occludes};
  props.push(p);
  if(solid){
   const inset=kind==='tree'?.32:kind==='lamp'?.4:kind.startsWith('fence')?.18:.03;
   mark({x:x+inset,y:y+inset,w:sp.fw-inset*2,h:sp.fh-inset*2},solid);
   if(kind!=='tree'&&kind!=='lamp')rectTiles(r,(a,b)=>occupied[idx(a,b)]=1);
  }
  for(const l of sp.lights)lights.push({...l,x:x+l.x,y:y+l.y,flicker:0});
  return p;
 };
 /** a place with a door to knock on; 'x' = a mirrored sprite whose front faces +X */
 const venue=(sp:PropSprite,x:number,y:number,kind:string,name:string,face:'y'|'x'='y')=>{
  const p=add(sp,x,y,kind)!;
  const door=face==='y'?{x:x+sp.fw/2,y:y+sp.fh+.65}:{x:x+sp.fw+.65,y:y+sp.fh/2};
  houses.push({prop:p,door,light:null,lightI:1,visited:false,trick:false,owner:name});
  keep({x:door.x-.75,y:door.y-.65,w:1.5,h:1.3});pois.push({...door,name});approaches.push({from:door,name});
  return p;
 };
 const detail=(id:Parameters<typeof getTownProp>[0],x:number,y:number)=>add(getTownProp(id),x,y,'town_furniture',true,1);
 const car=(id:StaticArtId,x:number,y:number)=>add(staticProp(id),x,y,'car',true);
 const protect=(name:string,x:number,y:number,w:number,h:number)=>protectedAreas.push({name,x,y,w,h});
 const walkway=(x:number,y:number,w:number,h:number)=>{paint(x,y,w,h,G.FLAGSTONE);keep({x,y,w,h});};
 const lot=(x:number,y:number,w:number,h:number,g:G=G.DRIVEWAY)=>{paint(x,y,w,h,g);keep({x,y,w,h});};

 // 1. Surfaces that lie under the streets' edges: yards, lots and forecourts (tile-aligned, like their buildings).
 paint(6,10,9,8,G.DIRT);paint(16,7,11,10,G.DIRT);                                   // pumpkin field, farmyard
 paint(4,29,15,2,G.SIDEWALK);paint(11,27,7,2,G.SIDEWALK);                           // school forecourt
 lot(5,31,6,5);lot(12,31,6,5);lot(18,32,4,2);paint(18,24,3,6,G.DIRT);               // ball court, school lot, playground
 paint(4,41,10,17,G.DARKGRASS);                                                     // cemetery
 lot(7,66,5,5);lot(12,68,2,2);                                                      // West Road lay-by
 lot(21,36,26,3);lot(21,39,15,1);                                                   // service lot behind the shops
 paint(21,43,15,2,G.SIDEWALK);paint(36,42,11,2,G.SIDEWALK);                         // Main Street pavement at the shop fronts
 lot(42,25,4,4);lot(46,26,2,2);paint(37,28,5,1,G.SIDEWALK);                         // Starcade lot
 lot(29,50,5,4);lot(31,49,2,1);lot(42,50,4,4);lot(46,51,2,2);                       // corner-store lot, plaza lot
 lot(62,2,16,5);lot(66,7,3,2);lot(80,14,10,6);lot(84,20,3,1);                       // gas station, diner
 lot(25,67,23,16,G.GRAVEL);lot(22,68,3,12,G.GRAVEL);lot(48,72,6,2);                 // drive-in field, its screen, its gate
 const under=ground.slice();
 for(let i=0;i<N;i++){
  if(roadCover[i]>=.5)ground[i]=G.ROAD;
  else if(paveCover[i]>=.5&&[G.GRASS,G.DARKGRASS,G.DIRT].includes(ground[i]))ground[i]=G.SIDEWALK;
 }

 // 2. The places of the reference, each where the trace puts it.
 // Pumpkin farm: field, barn and silo, farmhouse and shed in the corner between the two legs of Farm Road.
 venue(getBarn(),16,4,'barn','Pumpkin farm barn');add(getWaterTower(),21,4,'tower');
 add(staticProp('garage_timber'),24,4,'garage');car('pickup_n',19,10);
 for(let y=10;y<18;y+=2)for(let x=6;x<15;x+=2)add(getPumpkin((x+y)%2),x,y,'pumpkin',true,0,false);
 for(let x=6;x<15;x++){add(getFence('picket','x'),x,9,'fencex',true,1);add(getFence('picket','x'),x,18,'fencex',true,1);}
 protect('Pumpkin rows',6,10,9,8);

 // The school: two wings facing their forecourt, the ball court and car park in front, the playground by School Road.
 venue(getSchool(),4,25,'school','Maple Falls Elementary');
 venue(getPrimarySchool(),11,24,'school','Hollow Creek Primary');
 add(getSchoolBus(false),13,32,'car',true);car('compact_s',17,33);car('compact_n',12,33);
 add(getJungleGym(0),18,24,'junglegym');add(getSwings(),18,28,'swings');
 detail('bike_rack',8,30);detail('bus_stop',15,29);
 protect('Playground',18,24,3,6);

 // St. Hallow's and its cemetery, walled, with the gate on School Road.
 venue(getChurch(),7,43,'church',"St. Hallow's Church");
 venue(getCrypt(),5,52,'crypt','The Old Crypt');
 walkway(9,48,1,3);walkway(9,50,6,1);walkway(6,55,4,1);walkway(9,51,1,4);
 for(let y=44;y<57;y+=2)for(let x=4;x<14;x+=2){if(clear[idx(x,y)]||occupied[idx(x,y)])continue;add(getGrave((x+y)%3),x,y,'grave',true,1,false);}
 for(let x=4;x<14;x++){add(getFence('iron','x'),x,40,'fencex',true,1);add(getFence('iron','x'),x,58,'fencex',true,1);}
 for(let y=41;y<58;y++){add(getFence('iron','y'),3,y,'fencey',true,1);if(y!==50)add(getFence('iron','y'),14,y,'fencey',true,1);}
 protect('Church & cemetery',4,41,10,17);

 // Main Street: one continuous row of shop fronts on its north side, the service lot and a second row behind.
 const retail:[Parameters<typeof getTownProp>[0],number,number][]=[['bakery',21,40],['hardware',24,40],['pharmacy',28,40],['grocery',31,40],['laundromat',36,39],['barber',40,39],['fish_tackle',43,39]];
 for(const [id,x,y]of retail)venue(getTownProp(id),x,y,'town_'+id,id.replace(/_/g,' '));
 venue(getTownProp('postoffice'),37,33,'town_postoffice','Maple Falls Post Office');
 venue(getTownProp('firestation'),42,32,'town_firestation','Maple Falls Fire House');
 for(const [x,y]of [[23,36],[30,36],[34,37]])detail('dumpster',x,y);
 for(const [x,y]of [[27,36],[33,36]])detail('delivery_crates',x,y);
 car('van_e',25,38);car('compact_e',30,38);car('compact_w',39,37);
 for(const x of [22,27,33,38,44]){detail('planter_terracotta',x,x<36?43:42);}
 detail('phone_booth',35,43);detail('produce_stand',33,43);
 // the block across Hollow Street: the Starcade with its own lot, under the water tower
 venue(getArcade(),37,25,'arcade','The Starcade');add(getWaterTower(),34,24,'tower');
 car('compact_s',42,25);car('compact_n',44,26);detail('bike_rack',37,29);
 // the corner store and the fountain plaza between Main Street and West Road
 venue(getVideoRental(),23,50,'videorental','Video Vault');car('compact_e',30,51);car('compact_w',31,53);
 for(let y=49;y<54;y++)for(let x=36;x<41;x++)if(Math.hypot(x+.5-38.5,y+.5-51.5)<2.4){ground[idx(x,y)]=G.FLAGSTONE;clear[idx(x,y)]=1;}
 add(getShop(),34,50,'shop');detail('planter_square',38,51);
 add(getBench(),37,49,'bench',true,1,false);add(getBench(),40,53,'bench',true,1,false);
 car('compact_n',42,50);car('compact_s',44,51);detail('bus_stop',43,54);
 protect('Fountain plaza',35,49,6,5);

 // Moonlight park inside Pond Circle: the pond, a path around it, the gazebo towards the east.
 const pond={cx:59.7,cy:16.5,r:4};
 for(let y=10;y<24;y++)for(let x=52;x<68;x++){
  const d=Math.hypot(x+.5-pond.cx,y+.5-pond.cy);
  if(d>4.8&&d<5.7&&paveCover[idx(x,y)]<.05){ground[idx(x,y)]=G.FLAGSTONE;clear[idx(x,y)]=1;}
  if(d<pond.r){mark({x,y,w:1,h:1});occupied[idx(x,y)]=1;clear[idx(x,y)]=1;}
 }
 walkway(48,16,6,1);walkway(65,16,2,1);walkway(69,17,5,1);walkway(59,22,1,3);
 add(getGazebo(),67,16,'gazebo');add(getBench(),55,21,'bench',true,1,false);add(getBench(),64,12,'bench',true,1,false);
 detail('picnic_table',63,21);detail('picnic_table',52,13);
 protect('Moonlight park',47,10,29,15);

 // Gas station and diner beyond the east side of Pond Circle. (The station is a stand-in building: no art yet.)
 const station=getVideoStore();
 venue(station,70,3,'gasstation','Gas station');
 car('compact_e',64,3);car('compact_w',66,5);car('compact_s',75,3);
 venue(getDiner(),81,10,'diner',"Mel's Diner");
 for(const [id,x,y]of [['compact_e',81,15],['compact_w',84,17],['compact_n',87,15],['compact_s',88,17],['pickup_n',82,17]] as [StaticArtId,number,number][])car(id,x,y);
 detail('phone_booth',86,13);detail('dumpster',86,10);

 // Moonlite Drive-In: the screen along the west side of its field, cars parked facing it, snack bar at the gate.
 add(mirror(getDriveInScreen()),22,69,'screen');
 venue(getSnackBar(),49,76,'snackbar','Moonlite snack bar');add(getMarquee(),50,70,'sign',true,1);
 for(let column=0;column<5;column++)for(let row=0;row<6;row++){
  const x=27+column*4,y=69+row*2+(column%2);
  if((row+column*2)%5!==0)car((row+column)%3?'compact_w':'van_e',x,y);
  if(row%2===0)add(getSpeakerPost(),x+3,y,'speaker',true,1,false);
 }
 for(let x=25;x<48;x++){add(getFence('iron','x'),x,66,'fencex',true,1);add(getFence('iron','x'),x,83,'fencex',true,1);}
 for(let y=67;y<83;y++)if(y<71||y>74)add(getFence('iron','y'),48,y,'fencey',true,1);
 protect('Drive-in field',25,67,23,16);

 // Homes. Each faces the camera like the reference's; a garage, where there is room, gets a drive straight to its street.
 let homeIndex=0;
 const home=(x:number,y:number,opts:{face?:'x'|'y';garage?:'after'|'before'|false;look?:number;owner?:string}={})=>{
  const index=homeIndex++,face=opts.face??'y',base=getHouse((opts.look??index)%HOUSE_COUNT,false),sp=face==='y'?base:mirror(base);
  const p=add(sp,x,y,'house')!,pl=sp.lights[0],door={x:x+pl.x,y:y+pl.y};
  houses.push({prop:p,door,light:null,lightI:1,visited:false,trick:false,owner:opts.owner??'Maple Falls resident '+(index+1)});
  keep({x:door.x-.7,y:door.y-.7,w:1.4,h:1.4});approaches.push({from:door,name:'home '+(index+1)});
  if(opts.garage&&face==='y'){
   const gsp=staticProp(index%2?'garage_brick':'garage_timber');
   const garage=add(gsp,opts.garage==='before'?x-gsp.fw-1:x+sp.fw+1,y+sp.fh-gsp.fh,'garage')!;
   let end=garage.y0+garage.fh;
   while(end<MAP_H-1&&ground[idx(garage.x0,end)]!==G.ROAD&&ground[idx(garage.x0+1,end)]!==G.ROAD){
    if(end-garage.y0>16||occupied[idx(garage.x0,end)]||occupied[idx(garage.x0+1,end)])throw Error(`Drive of home ${index+1} at ${x},${y} does not reach a street`);
    end++;
   }
   const driveway={x:garage.x0,y:garage.y0+garage.fh,w:2,h:end-(garage.y0+garage.fh)};
   rectTiles(driveway,(a,b)=>{if(ground[idx(a,b)]!==G.ROAD)ground[idx(a,b)]=G.DRIVEWAY;});
   keep(driveway);homes.push({house:p,garage,driveway,road:[driveway.x+.5,end+.5]});
   if(driveway.h>=4)car(index%2?'compact_n':'compact_s',driveway.x+(index%2),driveway.y+1);
  }
  add(getPumpkin(index%2),Math.floor(door.x)+1,Math.floor(door.y),'pumpkin',true,0,false);
 };
 home(22,8,{garage:false,owner:'The farmhouse'});
 home(34,2,{garage:'after'});home(44,2,{garage:'after'});home(53,2,{garage:'after'});          // Orchard Lane
 home(32,14,{garage:false});home(39,14,{garage:'before'});                                       // Hollow Street
 home(53,38,{garage:'after'});home(62,38,{garage:'after'});home(76,37,{garage:'after'});home(53,32,{garage:false}); // above Main Street
 home(53,50,{garage:false});home(66,48,{face:'x',garage:false});home(62,55,{garage:'after'});   // inside the Lantern Lane bend
 home(77,50,{garage:'after',look:5,owner:'The Willow Link mansion'});
 home(63,70,{garage:false});home(70,68,{garage:false});home(71,73,{garage:false});home(76,68,{garage:false}); // south of Lantern Lane

 // 3. A path from every door to the nearest pavement, lot or existing path, around whatever stands in the way.
 const PAVED=[G.ROAD,G.SIDEWALK,G.DRIVEWAY,G.GRAVEL,G.FLAGSTONE];
 for(const {from,name}of approaches){
  const start=idx(from.x,from.y),prev=new Int32Array(N).fill(-1),queue=[start];
  let goal=-1;prev[start]=start;
  for(let head=0;head<queue.length&&goal<0;head++){
   const n=queue[head],x=n%MAP_W,y=Math.floor(n/MAP_W);
   if(PAVED.includes(ground[n])){goal=n;break;}
   for(const [dx,dy]of [[0,1],[1,0],[0,-1],[-1,0]]){
    const a=x+dx,b=y+dy,i=b*MAP_W+a;
    if(a<2||b<2||a>=MAP_W-2||b>=MAP_H-2||prev[i]>=0||occupied[i])continue;
    prev[i]=n;queue.push(i);
   }
  }
  if(goal<0)throw Error('No way from a street to '+name);
  for(let n=goal;;n=prev[n]){
   clear[n]=1;
   if([G.GRASS,G.DARKGRASS,G.DIRT].includes(ground[n]))ground[n]=G.FLAGSTONE;
   if(n===start)break;
  }
 }

 // 4. Gardens, woods and street lights after every entrance, path and road is fixed.
 const safeDecor=(x:number,y:number)=>inside(x,y)&&!clear[idx(x,y)]&&!occupied[idx(x,y)]&&paveCover[idx(x,y)]<.02&&
  [G.GRASS,G.DARKGRASS].includes(ground[idx(x,y)])&&!props.some(p=>overlaps({x,y,w:1,h:1},footprint(p)));
 const WOODED:Record<string,number>={farm:.03,campus:.05,'church-cemetery':.06,'main-street':.035,park:.11,leisure:.05,'north-homes':.09,'south-homes':.1,'drive-in':.14};
 for(let y=2;y<MAP_H-2;y++)for(let x=2;x<MAP_W-2;x++){
  const edge=Math.min(x,y,MAP_W-1-x,MAP_H-1-y),r=rng();
  if(!safeDecor(x,y))continue;
  const district=STATIC_DISTRICTS.find(d=>contains(d,x,y));
  const treeChance=edge<5?.5:!district?.2:WOODED[district.id];
  if(r<treeChance)add(getTree(edge<6?'pine':rng()<.7?'oak':'dead',Math.floor(rng()*3)),x,y,'tree',true);
  else if(r<treeChance+.03)add(getBush(Math.floor(rng()*3)),x,y,'bush',true,1,false);
 }
 for(const home of homes)for(const [x,y]of [[home.house.x0-1,home.house.y0+1],[home.house.x0+1,home.house.y0+home.house.fh+1]]){
  if(safeDecor(x,y))detail('hydrangea',x,y);
 }
 for(let y=3;y<91;y++)for(let x=3;x<91;x++){
  const i=idx(x,y);
  if(ground[i]===G.SIDEWALK&&paveCover[i]>.9&&roadCover[i]===0&&!clear[i]&&(x*7+y*3)%17===0)add(getLamp(),x,y,'lamp',true);
  else if(ground[i]===G.SIDEWALK&&paveCover[i]>.9&&roadCover[i]===0&&!clear[i]&&(x*5+y*11)%61===0)add(getMailbox(),x,y,'mailbox',true,1,false);
 }
 add(getTrash(),41,49,'trash',true,1,false);
 mark({x:0,y:0,w:MAP_W,h:.6});mark({x:0,y:MAP_H-.6,w:MAP_W,h:.6});
 mark({x:0,y:0,w:.6,h:MAP_H});mark({x:MAP_W-.6,y:0,w:.6,h:MAP_H});

 // 5. Ground art. A tile a street only partly covers keeps the surface beside the street and gets the street drawn
 //    over it, in the tile's own projection: pavement, kerb, asphalt and centre line all follow the smooth curve.
 const tiles:GameMap['tiles']=new Array(N),overlays:GameMap['overlays']=Array.from({length:N},()=>[]);
 const vr=makeRng(seed+9),nb=[[0,-1],[1,0],[0,1],[-1,0]];
 const scratch=rawCanvas(TW,TH),sctx=scratch.getContext('2d')!;
 const world=(ctx:CanvasRenderingContext2D,x:number,y:number)=>ctx.setTransform(HW,HH,-HW,HH,HW-isoX(x,y),-isoY(x,y));
 /** the stretches of every street that pass within reach of a tile */
 const near=(x:number,y:number)=>{
  const runs:{path:Path2D;width:number;offset:number}[]=[];
  for(const s of streets){
   const reach=s.width/2+PAVEMENT+1.6;
   let from=-1;
   for(let k=0;k<=s.line.length;k++){
    const close=k<s.line.length&&Math.abs(s.line[k][0]-x-.5)<reach&&Math.abs(s.line[k][1]-y-.5)<reach;
    if(close&&from<0)from=k;
    if(!close&&from>=0){
     const a=Math.max(0,from-1),b=Math.min(s.line.length-1,k),path=new Path2D();
     path.moveTo(s.line[a][0],s.line[a][1]);
     for(let j=a+1;j<=b;j++)path.lineTo(s.line[j][0],s.line[j][1]);
     runs.push({path,width:s.width,offset:s.along[a]});from=-1;
    }
   }
  }
  return runs;
 };
 const streetTile=(x:number,y:number,roadTex:Img,paveTex:Img)=>{
  const c=rawCanvas(TW,TH),ctx=c.getContext('2d')!,runs=near(x,y);
  ctx.beginPath();ctx.moveTo(HW,-1);ctx.lineTo(TW+2,HH);ctx.lineTo(HW,TH+1);ctx.lineTo(-2,HH);ctx.closePath();ctx.clip();
  const layer=(extra:number,fill:Img|string)=>{
   sctx.setTransform(1,0,0,1,0,0);sctx.globalCompositeOperation='source-over';sctx.clearRect(0,0,TW,TH);
   world(sctx,x,y);sctx.lineCap='round';sctx.lineJoin='round';sctx.strokeStyle=typeof fill==='string'?fill:'#000';
   for(const run of runs){sctx.lineWidth=run.width+extra;sctx.stroke(run.path);}
   if(typeof fill!=='string'){sctx.setTransform(1,0,0,1,0,0);sctx.globalCompositeOperation='source-in';sctx.drawImage(fill,-1,-.5,TW+2,TH+1);}
   ctx.drawImage(scratch,0,0);
  };
  layer(PAVEMENT*2+.12,'rgba(14,18,16,.55)');layer(PAVEMENT*2,paveTex);
  layer(.2,'#a9a69c');layer(.06,'#3a3b40');layer(0,roadTex);
  world(ctx,x,y);
  ctx.strokeStyle='rgba(214,176,70,.8)';ctx.lineWidth=.07;ctx.lineCap='butt';ctx.setLineDash([.5,.6]);
  for(const run of runs){ctx.lineDashOffset=run.offset;ctx.stroke(run.path);}
  ctx.setLineDash([]);ctx.fillStyle='rgba(226,224,214,.82)';
  for(const {at,along}of STATIC_CROSSINGS){
   if(Math.abs(at[0]-x-.5)>3||Math.abs(at[1]-y-.5)>3)continue;
   const d=Math.hypot(along[0],along[1]),ux=along[0]/d,uy=along[1]/d;
   for(let k=-2;k<=2;k++){
    const cx=at[0]+ux*k*.42,cy=at[1]+uy*k*.42,half=1.25;
    ctx.beginPath();ctx.moveTo(cx-ux*.1+uy*half,cy-uy*.1-ux*half);ctx.lineTo(cx+ux*.1+uy*half,cy+uy*.1-ux*half);
    ctx.lineTo(cx+ux*.1-uy*half,cy+uy*.1+ux*half);ctx.lineTo(cx-ux*.1-uy*half,cy-uy*.1+ux*half);ctx.closePath();ctx.fill();
   }
  }
  return c;
 };
 for(let y=0;y<MAP_H;y++)for(let x=0;x<MAP_W;x++){
  const i=idx(x,y),g=ground[i] as G,variant=Math.floor(vr()*30);
  const fullRoad=roadCover[i]>=.995,fullPave=paveCover[i]>=.995&&roadCover[i]<=.005,street=paveCover[i]>.005;
  const partial=street&&!fullRoad&&!fullPave;
  const base=partial&&(g===G.ROAD||g===G.SIDEWALK)?under[i] as G:g;
  tiles[i]=getTile(base,variant);
  for(let e=0;e<4;e++){
   const a=x+nb[e][0],b=y+nb[e][1];if(!inside(a,b))continue;
   if([G.GRAVEL,G.DIRT,G.DRIVEWAY,G.SIDEWALK].includes(base)&&!street&&[G.GRASS,G.DARKGRASS].includes(ground[idx(a,b)]))overlays[i].push(getFringe(e));
  }
  if(partial||(fullRoad&&lineCover[i]>0))overlays[i].push(streetTile(x,y,getTile(G.ROAD,variant),getTile(G.SIDEWALK,variant)));
  if(Math.abs(x+.5-pond.cx)<pond.r+1.5&&Math.abs(y+.5-pond.cy)<pond.r+1.5){
   const c=rawCanvas(TW,TH),ctx=c.getContext('2d')!;
   ctx.beginPath();ctx.moveTo(HW,0);ctx.lineTo(TW,HH);ctx.lineTo(HW,TH);ctx.lineTo(0,HH);ctx.closePath();ctx.clip();
   const points:[number,number][]=[];
   for(let k=0;k<64;k++){const a=k/64*Math.PI*2,px=pond.cx+Math.cos(a)*pond.r,py=pond.cy+Math.sin(a)*pond.r;points.push([HW+isoX(px,py)-isoX(x,y),isoY(px,py)-isoY(x,y)]);}
   poly(ctx,points,'#274753','#657b69',6);overlays[i].push(c);
  }
 }
 scratch.width=scratch.height=0;
 for(const p of props){
  const x=Math.floor(p.x0),y=Math.floor(p.y0+p.fh),i=idx(x,y);
  if(!inside(x,y)||clear[i])continue;
  if(p.kind==='tree'&&rng()<.35&&ground[i]===G.GRASS)overlays[i].push(getTownDecal('leaf_drift'));
  if(p.kind==='car'&&[G.DRIVEWAY,G.GRAVEL].includes(ground[i]))overlays[i].push(getTownDecal('oil_stain'));
 }
 const map:GameMap={kind:'town',name:'Maple Falls - reference layout',ground,coll,tiles,overlays,props,lights,houses,
  shops:props.filter(p=>p.kind==='shop').map(prop=>({prop,x:prop.x0+prop.fw/2,y:prop.y0+prop.fh+.6})),
  gates:[],barriers:[],turrets:[],hideouts:[],pois,start:{x:38.5,y:54.6}};

 // Quarter-tile, character-radius reachability detects access errors before exporting.
 const seen=new Uint8Array(CW*CH),queue=new Int32Array(CW*CH);
 const fits=(x:number,y:number)=>!blockedCircle(map,(x+.5)/CR,(y+.5)/CR,.24);
 let head=0,tail=0;const start=Math.floor(map.start.y*CR)*CW+Math.floor(map.start.x*CR);
 if(!fits(start%CW,Math.floor(start/CW)))throw Error('Blocked review start');seen[start]=1;queue[tail++]=start;
 while(head<tail){const n=queue[head++],x=n%CW,y=Math.floor(n/CW);for(const [dx,dy]of nb){
  const a=x+dx,b=y+dy,i=b*CW+a;if(a<0||b<0||a>=CW||b>=CH||seen[i]||!fits(a,b))continue;seen[i]=1;queue[tail++]=i;
 }}
 const reachable=(p:{x:number;y:number})=>{for(let y=Math.floor((p.y-.8)*CR);y<=Math.ceil((p.y+.8)*CR);y++)
  for(let x=Math.floor((p.x-.8)*CR);x<=Math.ceil((p.x+.8)*CR);x++)if(x>=0&&y>=0&&x<CW&&y<CH&&seen[y*CW+x])return true;return false;};
 const unreachable=houses.filter(h=>!reachable(h.door)).map(h=>h.owner);
 if(unreachable.length)throw Error('Unreachable review entrances: '+unreachable.join(', '));
 for(const access of homes)if(!reachable({x:access.road[0],y:access.road[1]})||ground[idx(...access.road)]!==G.ROAD)throw Error('Disconnected driveway');
 const audit={districts:STATIC_DISTRICTS.length,streets:streets.length,buildings:houses.length,homes:homeIndex,garages:homes.length,
  separateOccluders:props.filter(p=>p.occludesCharacter).length,props:props.length,roadTiles:Array.from(ground).filter(g=>g===G.ROAD).length,
  smoothStreetTiles:overlays.reduce((n,o,i)=>n+(paveCover[i]>.005&&o.length?1:0),0),
  protectedAreas:protectedAreas.map(r=>r.name),roadConflicts:0,unreachableDoors:unreachable,drivewaysConnected:homes.length,
  vehicleVariants:new Set(props.filter(p=>p.kind==='car').map(p=>p.sp)).size,liveGameplayChanged:false};
 return {map,districts:STATIC_DISTRICTS.map(d=>({...d})),audit};
}
