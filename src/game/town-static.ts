import {MAP_W,MAP_H,CW,CH,CR,HW,HH,makeRng,isoX,isoY} from './config';
import type {GameMap,PropInst,HouseInst} from './map';
import {blockedCircle} from './map';
import {G,getTile,getCurb,getFringe,getRoadLine,getCrosswalk} from './art/tiles';
import {getHouse,HOUSE_COUNT,getTree,getBush,getFence,getGrave,getCrypt,getPumpkin,getLamp,
 getMailbox,getTrash,getSchool,getPrimarySchool,getChurch,getBarn,getWaterTower,
 getDriveInScreen,getSnackBar,getSpeakerPost,getMarquee,getGazebo,getBench,getArcade,
 getDiner,getVideoRental,getShop,getJungleGym,getSwings,getSchoolBus,getBleachers,
 getGoalPosts,getScoreboard,type PropSprite} from './art/props';
import {getTownProp,getTownDecal} from './art/town';
import {staticProp,type StaticArtId} from './art/town-static';
import {STATIC_DISTRICTS,STATIC_STREETS,type Point} from './town-static-plan';
import {rawCanvas,poly} from './art/draw';

interface Rect {x:number;y:number;w:number;h:number}
interface HomeAccess {house:PropInst;garage:PropInst;driveway:Rect;road:Point}

/** Deliberately separate from buildMap: this is the town's scenery review, before progression integration. */
export function buildStaticTown(seed=1337){
 const rng=makeRng(seed),N=MAP_W*MAP_H;
 const ground=new Uint8Array(N).fill(G.GRASS),coll=new Uint8Array(CW*CH);
 const props:PropInst[]=[],houses:HouseInst[]=[],lights:GameMap['lights']=[];
 const protectedAreas:({name:string}&Rect)[]=[],keepClear:Rect[]=[],homes:HomeAccess[]=[];
 const roadAxes=new Uint8Array(N),pois:NonNullable<GameMap['pois']>=[];
 let pid=1;
 const idx=(x:number,y:number)=>Math.floor(y)*MAP_W+Math.floor(x);
 const inside=(x:number,y:number)=>x>=0&&y>=0&&x<MAP_W&&y<MAP_H;
 const rectTiles=(r:Rect,fn:(x:number,y:number)=>void)=>{
  for(let y=Math.floor(r.y);y<Math.ceil(r.y+r.h);y++)for(let x=Math.floor(r.x);x<Math.ceil(r.x+r.w);x++)if(inside(x,y))fn(x,y);
 };
 const paint=(x:number,y:number,w:number,h:number,g:G)=>rectTiles({x,y,w,h},(a,b)=>ground[idx(a,b)]=g);
 const contains=(r:Rect,x:number,y:number)=>x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h;
 const overlaps=(a:Rect,b:Rect)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
 const footprint=(p:PropInst):Rect=>({x:p.x0,y:p.y0,w:p.fw,h:p.fh});
 const mark=(r:Rect,solid=2)=>{
  for(let y=Math.max(0,Math.floor(r.y*CR));y<Math.min(CH,Math.ceil((r.y+r.h)*CR));y++)
   for(let x=Math.max(0,Math.floor(r.x*CR));x<Math.min(CW,Math.ceil((r.x+r.w)*CR));x++)coll[y*CW+x]=solid;
 };
 const add=(sp:PropSprite,x:number,y:number,kind:string,optional=false,solid=2,occludes=true)=>{
  const r={x,y,w:sp.fw,h:sp.fh};
  if(x<1||y<1||x+sp.fw>MAP_W-1||y+sp.fh>MAP_H-1||props.some(p=>overlaps(r,footprint(p)))){
   if(optional)return null;throw Error(`Overlapping scenery: ${kind} at ${x},${y}`);
  }
  const p:PropInst={id:pid++,sp,x0:x,y0:y,fw:sp.fw,fh:sp.fh,big:kind!=='tree'&&kind!=='bush'&&kind!=='lamp'&&!kind.startsWith('fence'),kind,shadow:kind==='tree'?.55:kind==='car'?.3:.6,occludesCharacter:occludes};
  props.push(p);
  if(solid){const inset=kind==='tree'?.32:kind==='lamp'?.4:kind.startsWith('fence')?.18:.03;mark({x:x+inset,y:y+inset,w:sp.fw-inset*2,h:sp.fh-inset*2},solid);}
  for(const l of sp.lights)lights.push({...l,x:x+l.x,y:y+l.y,flicker:0});
  return p;
 };
 const venue=(sp:PropSprite,x:number,y:number,kind:string,name:string,rear=false)=>{
  const p=add(sp,x,y,kind)!;
  const door={x:x+sp.fw/2,y:rear?y-.6:y+sp.fh+.65};
  houses.push({prop:p,door,light:null,lightI:1,visited:false,trick:false,owner:name});
  keepClear.push({x:door.x-.75,y:door.y-.65,w:1.5,h:1.3});pois.push({...door,name});
  return p;
 };
 const detail=(id:Parameters<typeof getTownProp>[0],x:number,y:number)=>add(getTownProp(id),x,y,'town_furniture',true,1);
 const car=(id:StaticArtId,x:number,y:number)=>add(staticProp(id),x,y,'car');
 const protect=(name:string,x:number,y:number,w:number,h:number)=>protectedAreas.push({name,x,y,w,h});
 const walkway=(x:number,y:number,w:number,h:number)=>{paint(x,y,w,h,G.FLAGSTONE);keepClear.push({x,y,w,h});};

 // 1. Reserve distinct places and their buildings before any public road exists.
 for(const district of STATIC_DISTRICTS)paint(district.x,district.y,district.w,district.h,G.GRASS);
 paint(5,5,19,14,G.DIRT);
 venue(getBarn(),16,7,'barn','Pumpkin farm barn');add(getWaterTower(),24,6,'tower');
 walkway(19,12,2,11);paint(21,11,3,12,G.DRIVEWAY);car('pickup_n',22,14);
 for(let y=7;y<19;y+=3)for(let x=7;x<16;x+=2)add(getPumpkin((x+y)%2),x,y,'pumpkin',false,0,false);
 protect('Pumpkin rows',6,6,10,14);

 venue(getSchool(),32,6,'school','Maple Falls Elementary');
 venue(getPrimarySchool(),42,6,'school','Hollow Creek Primary');
 venue(getTownProp('firestation'),49,6,'town_firestation','Maple Falls Fire House');
 paint(31,10,24,4,G.SIDEWALK);paint(49,10,6,3,G.DRIVEWAY);
 paint(32,15,14,10,G.FIELD);protect('Football field',32,15,14,10);
 add(getBleachers(),35,13,'bleachers');add(getGoalPosts(),32,19,'goalposts');add(getGoalPosts(),45,19,'goalposts');add(getScoreboard(),44,13,'scoreboard');
 paint(48,15,7,12,G.DIRT);protect('Playground',48,15,7,12);
 add(getJungleGym(0),48,16,'junglegym');add(getSwings(),49,22,'swings');
 paint(39,25,7,3,G.DRIVEWAY);add(getSchoolBus(false),40,25,'car');
 walkway(46,14,2,14);detail('bike_rack',39,10);detail('bus_stop',36,27);

 venue(getChurch(),9,31,'church',"St. Hallow's Church");
 paint(7,39,18,13,G.DARKGRASS);protect('Church & cemetery',7,30,18,23);
 walkway(13,35,2,19);walkway(7,43,18,2);walkway(7,49,18,2);
 venue(getCrypt(),20,45,'crypt','The Old Crypt');
 for(let y=40;y<52;y+=3)for(let x=8;x<25;x+=3){if(keepClear.some(r=>contains(r,x,y)))continue;add(getGrave((x+y)%3),x,y,'grave',true,1,false);}
 for(let x=7;x<25;x++){if(x<13||x>15)add(getFence('iron','x'),x,52,'fencex',true,1);}
 for(let y=39;y<52;y++){add(getFence('iron','y'),6,y,'fencey',true,1);add(getFence('iron','y'),25,y,'fencey',true,1);}
 detail('planter_square',8,36);add(getLamp(),16,36,'lamp');

 // A compact shopping street with genuine rear walls on the southern row.
 paint(30,38,35,3,G.SIDEWALK);paint(30,44,35,2,G.SIDEWALK);
 paint(30,32,35,2,G.DRIVEWAY);paint(30,50,35,2,G.DRIVEWAY);
 const retail:[Parameters<typeof getTownProp>[0],number][]=[['bakery',31],['hardware',35],['pharmacy',40],['grocery',44],['laundromat',50],['barber',55],['fish_tackle',59]];
 for(const [id,x]of retail)venue(getTownProp(id),x,35,'town_'+id,id.replace(/_/g,' '));
 for(const [i,x]of [32,39,46,53,59].entries())venue(staticProp(i%2?'shop_market_rear':'shop_brick_rear'),x,46,'town_rear_shop', ['Town books','Corner market','Record shop','Repair shop','Florist'][i],true);
 venue(getTownProp('postoffice'),33,54,'town_postoffice','Maple Falls Post Office');
 venue(getVideoRental(),41,54,'videorental','Video Vault');
 walkway(31,57,30,2);detail('bus_stop',54,55);detail('bike_rack',49,55);
 add(getShop(),57,54,'shop');
 for(const [x,y]of [[33,30],[47,30],[60,30],[33,52],[47,52],[61,52]])detail('dumpster',x,y);
 for(const [x,y]of [[37,32],[52,32],[41,50],[56,50]])detail('delivery_crates',x,y);
 car('van_e',38,32);car('compact_w',54,50);
 for(const x of [34,42,51,60]){detail('planter_terracotta',x,40);detail('planter_square',x,44);}
 detail('phone_booth',30,40);detail('produce_stand',61,44);

 // Homes get independently placed garages and continuous driveways to local lanes.
 const home=(x:number,y:number,roadY:number,index:number)=>{
  const sp=getHouse(index%HOUSE_COUNT,false),p=add(sp,x,y,'house')!;
  const garage=add(staticProp(index%2?'garage_brick':'garage_timber'),x+sp.fw+1,y,'garage')!;
  const driveway={x:garage.x0,y:garage.y0+garage.fh,w:2,h:roadY-(garage.y0+garage.fh)+1};
  if(driveway.h<1)throw Error('Driveway points away from street');
  paint(driveway.x,driveway.y,driveway.w,driveway.h,G.DRIVEWAY);
  keepClear.push(driveway);homes.push({house:p,garage,driveway,road:[driveway.x+.5,roadY]});
  const pl=sp.lights[0],door={x:x+pl.x,y:y+pl.y};
  houses.push({prop:p,door,light:null,lightI:1,visited:false,trick:false,owner:'Lantern Lane resident '+(index+1)});
  walkway(Math.floor(door.x),Math.ceil(y+sp.fh),1,Math.max(1,roadY-Math.ceil(y+sp.fh)));
  keepClear.push({x:door.x-.7,y:door.y-.7,w:1.4,h:1.4});
  add(getMailbox(),x,roadY-1,'mailbox',true,1,false);
  add(getPumpkin(index%2),x-1,y+sp.fh,'pumpkin',true,0,false);
  for(let a=x;a<x+sp.fw;a++)add(getFence('picket','x'),a,y-1,'fencex',true,1);
  if(driveway.h>4)car(index%2?'compact_n':'compact_s',driveway.x,driveway.y+1);
 };
 let homeIndex=0;
 for(const [x,y]of [[59,7],[69,8],[79,9]])home(x,y,18,homeIndex++);
 for(const [x,y]of [[60,24],[70,24],[80,24]])home(x,y,32,homeIndex++);
 for(const [x,y]of [[36,64],[47,65],[58,66]])home(x,y,73,homeIndex++);
 for(const [x,y]of [[40,78],[51,78],[62,78]])home(x,y,86,homeIndex++);
 home(79,70,75,homeIndex++);home(79,82,88,homeIndex++);

 // Park paths and water belong to their own precinct; roads stay at its perimeter.
 protect('Moonlight park',69,35,21,21);
 const pond={cx:79,cy:44,rx:4,ry:3};
 for(let y=36;y<55;y++)for(let x=70;x<89;x++){
  const ring=Math.hypot((x+.5-79)/8.5,(y+.5-44)/8.5);
  if(ring>.8&&ring<1.02)paint(x,y,1,1,G.FLAGSTONE);
  if(((x+.5-pond.cx)/pond.rx)**2+((y+.5-pond.cy)/pond.ry)**2<1)mark({x,y,w:1,h:1});
 }
 walkway(66,49,7,2);walkway(72,49,2,6);
 add(getGazebo(),72,50,'gazebo');add(getBench(),74,47,'bench');add(getBench(),83,49,'bench');
 detail('picnic_table',85,38);detail('picnic_table',71,39);
 venue(getArcade(),76,57,'arcade','The Starcade');venue(getDiner(),83,57,'diner',"Mel's Diner");
 paint(75,60,15,7,G.DRIVEWAY);walkway(75,60,15,2);
 for(const [id,x,y]of [['compact_e',76,63],['compact_w',80,65],['compact_n',87,63]] as [StaticArtId,number,number][])car(id,x,y);
 detail('bike_rack',81,61);detail('dumpster',90,58);detail('phone_booth',74,59);

 // Cinema is a private gravel lot, with internal aisles and screen-facing cars.
 paint(5,62,25,26,G.GRAVEL);protect('Drive-in interior',5,62,25,26);
 add(getDriveInScreen(),10,64,'screen');venue(getSnackBar(),23,83,'snackbar','Moonlite snack bar');
 for(let row=0;row<3;row++)for(let k=0;k<6;k++){
  const x=7+k*3,y=69+row*4;
  if((row+k)%5!==0)car((row+k)%4===0?'pickup_n':'compact_n',x,y);
  add(getSpeakerPost(),x+1,y+1,'speaker',false,1,false);
 }
 // one private entrance off the Cinema approach: a gravel apron, not a public road through the lot
 walkway(26,81,2,6);paint(28,62,4,3,G.DRIVEWAY);paint(28,84,3,2,G.DRIVEWAY);add(getMarquee(),29,66,'sign');
 for(let x=6;x<29;x++)add(getFence('iron','x'),x,61,'fencex',true,1);
 for(let y=64;y<87;y++)add(getFence('iron','y'),4,y,'fencey',true,1);
 for(const [x,y]of [[7,82],[17,82],[28,78]])add(getLamp(),x,y,'lamp');

 // 2. Connect the planned district approaches with offset, finite streets.
 const distanceTo=(x:number,y:number,a:Point,b:Point)=>{
  const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));
  return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);
 };
 for(const street of STATIC_STREETS)for(let k=1;k<street.points.length;k++){
  const shift=street.width%2===1?.5:0;
  const a:Point=[street.points[k-1][0]+shift,street.points[k-1][1]+shift],b:Point=[street.points[k][0]+shift,street.points[k][1]+shift],axis=a[1]===b[1]?1:a[0]===b[0]?2:4;
  for(let y=1;y<MAP_H-1;y++)for(let x=1;x<MAP_W-1;x++)if(distanceTo(x+.5,y+.5,a,b)<=street.width/2){
   if(protectedAreas.some(r=>contains(r,x+.5,y+.5)))throw Error(`${street.name} crosses a protected district at ${x},${y}`);
   if(props.some(p=>p.big&&overlaps({x,y,w:1,h:1},footprint(p))))throw Error(`${street.name} crosses ${props.find(p=>p.big&&overlaps({x,y,w:1,h:1},footprint(p)))!.kind} at ${x},${y}`);
   ground[idx(x,y)]=G.ROAD;roadAxes[idx(x,y)]|=axis;
  }
 }
 // Sidewalks follow actual streets, preserving every planned yard/driveway/special surface.
 for(let y=1;y<MAP_H-1;y++)for(let x=1;x<MAP_W-1;x++)if(ground[idx(x,y)]===G.GRASS&&
  [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>ground[idx(x+dx,y+dy)]===G.ROAD)&&
  !props.some(p=>contains(footprint(p),x+.5,y+.5)))ground[idx(x,y)]=G.SIDEWALK;

 // 3. Dress gardens and wooded margins after all entrances and roads are reserved.
 const safeDecor=(x:number,y:number)=>inside(x,y)&&!keepClear.some(r=>contains(r,x+.5,y+.5))&&
  ![G.ROAD,G.SIDEWALK,G.DRIVEWAY,G.FLAGSTONE,G.FIELD,G.GRAVEL,G.DIRT].includes(ground[idx(x,y)])&&
  !props.some(p=>overlaps({x,y,w:1,h:1},footprint(p)))&&
  ((x+.5-pond.cx)/pond.rx)**2+((y+.5-pond.cy)/pond.ry)**2>1.5;
 for(let y=2;y<MAP_H-2;y++)for(let x=2;x<MAP_W-2;x++){
  const edge=Math.min(x,y,MAP_W-1-x,MAP_H-1-y),r=rng();
  if(!safeDecor(x,y))continue;
  const district=STATIC_DISTRICTS.find(d=>contains(d,x,y));
  const treeChance=edge<5?.48:!district?.18:district.id==='park'?.1:.025;
  if(r<treeChance)add(getTree(edge<6?'pine':rng()<.7?'oak':'dead',Math.floor(rng()*3)),x,y,'tree',true);
  else if(r<treeChance+.03)add(getBush(Math.floor(rng()*3)),x,y,'bush',true,1,false);
 }
 for(const home of homes)for(const [x,y]of [[home.house.x0-1,home.house.y0+1],[home.house.x0+1,home.house.y0+home.house.fh+1]]){
  if(safeDecor(x,y))detail('hydrangea',x,y);
 }
 for(let y=3;y<91;y++)for(let x=3;x<91;x++)if(ground[idx(x,y)]===G.SIDEWALK&&(x*3+y)%13===0&&
  !keepClear.some(r=>contains(r,x,y)))add(getLamp(),x,y,'lamp',true);
 add(getTrash(),68,50,'trash',true,1,false);
 mark({x:0,y:0,w:MAP_W,h:.6});mark({x:0,y:MAP_H-.6,w:MAP_W,h:.6});
 mark({x:0,y:0,w:.6,h:MAP_H});mark({x:MAP_W-.6,y:0,w:.6,h:MAP_H});

 const tiles:GameMap['tiles']=new Array(N),overlays:GameMap['overlays']=Array.from({length:N},()=>[]);
 const vr=makeRng(seed+9),nb=[[0,-1],[1,0],[0,1],[-1,0]];
 for(let y=0;y<MAP_H;y++)for(let x=0;x<MAP_W;x++){
  const i=idx(x,y),g=ground[i] as G;
  tiles[i]=getTile(g,g===G.FIELD?(y-15)%4===0?2:(x+y)%2:Math.floor(vr()*30));
  for(let e=0;e<4;e++){
   const a=x+nb[e][0],b=y+nb[e][1];if(!inside(a,b))continue;
   if(g===G.SIDEWALK&&ground[idx(a,b)]===G.ROAD)overlays[i].push(getCurb(e));
   else if([G.GRAVEL,G.DIRT,G.DRIVEWAY,G.SIDEWALK].includes(g)&&[G.GRASS,G.DARKGRASS].includes(ground[idx(a,b)]))overlays[i].push(getFringe(e));
  }
  if(g===G.ROAD){
   // Direction derives from the local road, not any former district coordinates.
   if(roadAxes[i]===1&&ground[idx(x,y-1)]!==G.ROAD)overlays[i].push(getRoadLine(2));
   if(roadAxes[i]===2&&ground[idx(x-1,y)]!==G.ROAD)overlays[i].push(getRoadLine(1));
   if(roadAxes[i]===1&&[31,63].includes(x)&&y>=40&&y<=43)overlays[i].push(getCrosswalk('x'));
  }
  if(x>=74&&x<=83&&y>=40&&y<=48){
   const c=rawCanvas(128,64),ctx=c.getContext('2d')!;
   ctx.beginPath();ctx.moveTo(HW,0);ctx.lineTo(128,HH);ctx.lineTo(HW,64);ctx.lineTo(0,HH);ctx.closePath();ctx.clip();
   const points: [number,number][]=[];
   for(let k=0;k<64;k++){const a=k/64*Math.PI*2,px=pond.cx+Math.cos(a)*pond.rx,py=pond.cy+Math.sin(a)*pond.ry;points.push([HW+isoX(px,py)-isoX(x,y),isoY(px,py)-isoY(x,y)]);}
   poly(ctx,points,'#274753','#657b69',6);overlays[i].push(c);
  }
 }
 for(const p of props){
  const x=Math.floor(p.x0),y=Math.floor(p.y0+p.fh),i=idx(x,y);
  if(!inside(x,y)||keepClear.some(r=>contains(r,x,y)))continue;
  if(p.kind==='tree'&&rng()<.35&&ground[i]===G.GRASS)overlays[i].push(getTownDecal('leaf_drift'));
  if(p.kind==='car'&&[G.DRIVEWAY,G.GRAVEL].includes(ground[i]))overlays[i].push(getTownDecal('oil_stain'));
 }
 const map:GameMap={kind:'town',name:'Maple Falls - layout review',ground,coll,tiles,overlays,props,lights,houses,
  shops:props.filter(p=>p.kind==='shop').map(prop=>({prop,x:prop.x0+prop.fw/2,y:prop.y0+prop.fh+.6})),
  gates:[],barriers:[],turrets:[],hideouts:[],pois,start:{x:43,y:42}};

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
 const audit={districts:STATIC_DISTRICTS.length,buildings:houses.length,homes:homes.length,garages:homes.length,
  separateOccluders:props.filter(p=>p.occludesCharacter).length,props:props.length,roadTiles:Array.from(ground).filter(g=>g===G.ROAD).length,
  protectedAreas:protectedAreas.map(r=>r.name),roadConflicts:0,unreachableDoors:unreachable,drivewaysConnected:homes.length,
  vehicleVariants:new Set(props.filter(p=>p.kind==='car').map(p=>p.sp)).size,frontAndRearShops:true,liveGameplayChanged:false};
 return {map,districts:STATIC_DISTRICTS.map(d=>({...d})),audit};
}
