import { MAP_W,MAP_H,CW,CH,CR } from './config';
import { ARCADE_SIZE,ARCADE_ORIGIN,ARCADE_FIXTURES,ARCADE_ENTRY,ARCADE_POIS } from './arcade-layout';
import { getArcadeFixture,getArcadeFloor,getArcadeExitMat } from './art/arcade';
import type { GameMap,PropInst } from './map';
import { G } from './art/tiles';
import {ARCADE_DECOR,ARCADE_PILES,CLUTTER_SIZES,SMALL_FLOOR_CLUTTER,PILE_CLUTTER} from './arcade-clutter';
import {getArcadeClutter} from './art/arcade-clutter';

export function buildArcadeMap():GameMap {
  const ground=new Uint8Array(MAP_W*MAP_H).fill(G.DARKGRASS),coll=new Uint8Array(CW*CH).fill(2);
  const carpet=getArcadeFloor(),dining=getArcadeFloor(true);
  const tiles=Array.from({length:MAP_W*MAP_H},()=>carpet),overlays:GameMap['overlays']=Array.from({length:MAP_W*MAP_H},()=>[]);
  const map:GameMap={kind:'arcade',name:'The Starcade',ground,coll,tiles,overlays,props:[],lights:[],shops:[],houses:[],gates:[],barriers:[],turrets:[],hideouts:[],start:{...ARCADE_ENTRY},portals:[{...ARCADE_ENTRY,label:'Return to Maple Falls',target:'town'}],pois:ARCADE_POIS};
  map.bounds={x0:3,y0:3,x1:ARCADE_ORIGIN+ARCADE_SIZE-1,y1:ARCADE_ORIGIN+ARCADE_SIZE-1};
  for(let y=ARCADE_ORIGIN+1;y<ARCADE_ORIGIN+ARCADE_SIZE-1;y++)for(let x=ARCADE_ORIGIN+1;x<ARCADE_ORIGIN+ARCADE_SIZE-1;x++){
    const i=y*MAP_W+x;ground[i]=G.FLAGSTONE;tiles[i]=x>=25&&y>=14?dining:carpet;
    for(let cy=y*CR;cy<(y+1)*CR;cy++)for(let cx=x*CR;cx<(x+1)*CR;cx++)coll[cy*CW+cx]=0;
  }
  for(const f of ARCADE_FIXTURES){
    const sp=getArcadeFixture(f.kind,f.w,f.h),prop:PropInst={id:map.props.length+1,sp,x0:f.x,y0:f.y,fw:f.w,fh:f.h,big:true,kind:`arcade_${f.kind}`,shadow:.2};
    map.props.push(prop);
    for(let cy=Math.floor(f.y*CR);cy<Math.ceil((f.y+f.h)*CR);cy++)for(let cx=Math.floor(f.x*CR);cx<Math.ceil((f.x+f.w)*CR);cx++)coll[cy*CW+cx]=f.kind==='booth'||f.kind==='airhockey'||f.kind==='foosball'?1:2;
    for(const l of sp.lights)map.lights.push({...l,x:f.x+l.x,y:f.y+l.y,flicker:0});
    if(f.kind==='pizza')map.shops.push({prop,x:f.x+f.w/2,y:f.y+f.h+.8});
    if(f.kind==='tokens') { prop.kind='vending';map.shops.push({prop,x:f.x+f.w/2,y:f.y+f.h+.8}); }
    if(f.kind==='prizes'||f.kind==='party'||f.kind==='stage')map.houses.push({prop,door:{x:f.x+f.w/2,y:f.y+f.h+.8},owner:f.label,visited:false,trick:false,light:null,lightI:1});
  }
  for(const d of ARCADE_DECOR){
    const [fw,fh]=CLUTTER_SIZES[d.kind];
    if(ARCADE_FIXTURES.some(f=>d.x<f.x+f.w&&d.x+fw>f.x&&d.y<f.y+f.h&&d.y+fh>f.y))continue;
    const sp=getArcadeClutter(d.kind);
    map.props.push({id:map.props.length+1,sp,x0:d.x,y0:d.y,fw,fh,big:true,kind:`arcade_decor_${d.kind}`,shadow:.1});
    if(d.solid)for(let cy=Math.floor(d.y*CR);cy<Math.ceil((d.y+fh)*CR);cy++)for(let cx=Math.floor(d.x*CR);cx<Math.ceil((d.x+fw)*CR);cx++)coll[cy*CW+cx]=2;
  }
  // Static floor decals cost no particles or per-frame simulation. Seeded placement
  // repeats on re-entry and never changes navigation, shops or collision.
  const litterSites=[...ARCADE_FIXTURES.filter(f=>!['wall','prizes','pizza','photo','tokens'].includes(f.kind)).map(f=>({x:Math.floor(f.x+f.w),y:Math.ceil(f.y+f.h)})),...ARCADE_DECOR.filter(d=>d.kind==='plant').map(d=>({x:Math.floor(d.x),y:Math.floor(d.y)}))];
  for(const {x,y}of litterSites){
    let seed=(Math.imul(x+7,73856093)^Math.imul(y+11,19349663))>>>0;
    seed^=seed>>>16;seed=Math.imul(seed,0x45d9f3b);seed=(seed^(seed>>>16))>>>0;
    const px=x,py=y;
    if(seed%5===0||coll[(py*CR+1)*CW+px*CR+1]!==0||overlays[py*MAP_W+px].length)continue;
    const kind=SMALL_FLOOR_CLUTTER[seed%SMALL_FLOOR_CLUTTER.length];
    overlays[py*MAP_W+px].push(getArcadeClutter(kind).img);
  }
  for(const [i,{x,y}]of ARCADE_PILES.entries()){
    if(ARCADE_FIXTURES.some(f=>x<f.x+f.w&&x+1>f.x&&y<f.y+f.h&&y+1>f.y))continue;
    overlays[y*MAP_W+x].push(getArcadeClutter(PILE_CLUTTER[i%PILE_CLUTTER.length]).img);
  }
  overlays[30*MAP_W+16].push(getArcadeExitMat());
  map.lights.push({x:17,y:31,r:3,color:'#8aff9c',i:.55,flicker:0});
  // Soft practical light in every aisle, without occluding furniture or collision.
  for(let y=8;y<ARCADE_SIZE;y+=8)for(let x=8;x<ARCADE_SIZE;x+=8)map.lights.push({x,y,r:6,color:'#ffab55',i:.32,flicker:0});
  return map;
}
