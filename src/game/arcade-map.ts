import { MAP_W,MAP_H,CW,CH,CR } from './config';
import { ARCADE_SIZE,ARCADE_ORIGIN,ARCADE_FIXTURES,ARCADE_ENTRY,ARCADE_POIS } from './arcade-layout';
import { getArcadeFixture,getArcadeFloor } from './art/arcade';
import type { GameMap,PropInst } from './map';
import { G } from './art/tiles';

export function buildArcadeMap():GameMap {
  const ground=new Uint8Array(MAP_W*MAP_H).fill(G.DARKGRASS),coll=new Uint8Array(CW*CH).fill(2);
  const carpet=getArcadeFloor(),dining=getArcadeFloor(true);
  const tiles=Array.from({length:MAP_W*MAP_H},()=>carpet),overlays=Array.from({length:MAP_W*MAP_H},()=>[]);
  const map:GameMap={kind:'arcade',name:'The Starcade',ground,coll,tiles,overlays,props:[],lights:[],shops:[],houses:[],gates:[],barriers:[],turrets:[],hideouts:[],start:{...ARCADE_ENTRY},portals:[{...ARCADE_ENTRY,label:'Return to Maple Falls',target:'town'}],pois:ARCADE_POIS};
  map.bounds={x0:3,y0:3,x1:49,y1:49};
  for(let y=ARCADE_ORIGIN+1;y<ARCADE_ORIGIN+ARCADE_SIZE-1;y++)for(let x=ARCADE_ORIGIN+1;x<ARCADE_ORIGIN+ARCADE_SIZE-1;x++){
    const i=y*MAP_W+x;ground[i]=G.FLAGSTONE;tiles[i]=x>=37&&y>=22?dining:carpet;
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
  // Soft practical light in every aisle, without occluding furniture or collision.
  for(let y=8;y<48;y+=8)for(let x=8;x<48;x+=8)map.lights.push({x,y,r:6,color:'#ffab55',i:.32,flicker:0});
  return map;
}
