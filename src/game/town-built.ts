/** Maple Falls as painted in the town builder (scripts/town-builder/export-game.mjs -> public/assets/town-built/).
 *  The ground is one baked picture (roads, lots, paving, every flat decal and every sprite's shape shadow), streamed in
 *  1024 px tiles around the camera over a quarter-size overview. Every upright sprite is a prop with its measured
 *  collision footprint; houses, venues and the arcade get front doors, candy stands and vending machines become shops,
 *  jungle gyms become Candy Cannons and the gazebos are the rescue hideouts. */
import {MAP_W,MAP_H,CR,CW,CH,isoX,isoY} from './config';
import type {GameMap,PropInst,HouseInst,LightSrc} from './map';
import {blockedCircle} from './map';
import {G} from './art/tiles';
import type {PropSprite} from './art/props';
import {rawCanvas} from './art/draw';
import type {Img} from './assets';
import {settings} from './settings';

interface Box {hx:number;hy:number;dx:number;dy:number}
interface Item {name:string;cat:string;file:string;w:number;h:number;ax:number;ay:number;boxes:Box[];kind:string;door?:boolean;doorAt?:{u:number;v:number};solid:number;big:boolean;shadow?:boolean}
interface Town {frame:{X0:number;Y0:number;map:number;gx0:number;gy0:number;tile:number;cols:number;rows:number;width:number;height:number;overviewScale:number};
 ids:string[];items:Record<string,Item>;props:[number,number,number,number,number,number,number][];ground:string;outside:string}
export interface GroundTile {x:number;y:number;w:number;h:number;url:string;img:Img|null;loading:boolean;used:number}
export interface BuiltGround {tiles:GroundTile[];overview:Img;overviewRect:{x:number;y:number;w:number;h:number}}

const base=()=>(import.meta as unknown as {env:{BASE_URL:string}}).env.BASE_URL||'./';
const url=(f:string)=>base()+'assets/town-built/'+f;
let town:Town|undefined,overview:Img|undefined;const images=new Map<string,Img>();
async function image(f:string):Promise<Img>{
 for(let attempt=0;;attempt++){
  try{const r=await fetch(url(f));if(!r.ok)throw Error(f+' '+r.status);return await createImageBitmap(await r.blob());}
  catch(e){if(attempt>=3)throw e;await new Promise(res=>setTimeout(res,400*(attempt+1)));}
 }
}
let loading:Promise<void>|undefined;
/** Load the exported town: its data, every sprite it uses and the ground overview. Runs once. */
export function loadBuiltTown(progress?:(p:number)=>void){
 return loading??=(async()=>{
  const r=await fetch(url('town.json'));if(!r.ok)throw Error('Missing town export');town=await r.json() as Town;
  const files=[...new Set(Object.values(town.items).map(i=>i.file))];let done=0;
  // High graphics loads the double-resolution sprites (sprites-hd/), falling back to the normal ones
  const pick=(f:string)=>settings.hq?image('sprites-hd/'+f.slice('sprites/'.length)).catch(()=>image(f)):image(f);
  await Promise.all([image('ground/overview.webp').then(i=>{overview=i;}),...files.map(f=>pick(f).then(i=>{images.set(f,i);progress?.(++done/files.length);}))]);
 })();
}

const mirrored=new Map<Img,Img>();
function mirror(img:Img){let m=mirrored.get(img);if(!m){const c=rawCanvas(img.width,img.height),ctx=c.getContext('2d')!;ctx.translate(c.width,0);ctx.scale(-1,1);ctx.drawImage(img,0,0);m=c;mirrored.set(img,m);}return m;}
const sprites=new Map<string,PropSprite>();

let template:GameMap|undefined;
export function buildBuiltTown():GameMap{
 const t=template??=build();
 // fresh mutable state for this run; paint and bitmaps are shared
 const props=t.props.map(p=>({...p})),byId=new Map(props.map(p=>[p.id,p])),prop=(p:PropInst)=>byId.get(p.id)!;
 const lights=t.lights.map(l=>({...l})),lightOf=new Map(t.lights.map((l,i)=>[l,lights[i]]));
 return {...t,coll:t.coll.slice(),props,lights,
  houses:t.houses.map(h=>({...h,prop:prop(h.prop),door:{...h.door},light:h.light?lightOf.get(h.light)!:null})),
  shops:t.shops.map(s=>({...s,prop:prop(s.prop)})),gates:t.gates.map(g=>({...g,propIds:[],cells:[]})),
  barriers:[],turrets:t.turrets.map(q=>({...q,gym:prop(q.gym)})),hideouts:t.hideouts.map(h=>({...h})),pois:t.pois?.map(p=>({...p})),start:{...t.start},
  builtGround:{...t.builtGround!,tiles:t.builtGround!.tiles}};
}

function build():GameMap{
 if(!town||!overview)throw Error('loadBuiltTown() must finish before the town is built');
 const T=town,F=T.frame;if(F.map>MAP_W||F.map>MAP_H)throw Error(`Town needs a ${F.map}-tile map; config has ${MAP_W}`);
 const N=MAP_W*MAP_H,ground=new Uint8Array(N).fill(G.DARKGRASS),coll=new Uint8Array(CW*CH);
 const g=Uint8Array.from(atob(T.ground),c=>c.charCodeAt(0)),out=Uint8Array.from(atob(T.outside),c=>c.charCodeAt(0));
 for(let y=0;y<F.map;y++)for(let x=0;x<F.map;x++)ground[y*MAP_W+x]=g[y*F.map+x];
 const mark=(x0:number,y0:number,x1:number,y1:number,v:number)=>{
  for(let cy=Math.max(0,Math.floor(y0*CR));cy<Math.min(CH,Math.ceil(y1*CR));cy++)for(let cx=Math.max(0,Math.floor(x0*CR));cx<Math.min(CW,Math.ceil(x1*CR));cx++)if(coll[cy*CW+cx]<v)coll[cy*CW+cx]=v;};
 // the ground outside the picture and the map's own edge are walls
 for(let y=0;y<MAP_H;y++)for(let x=0;x<MAP_W;x++)if(x>=F.map||y>=F.map||out[y*F.map+x]||x<1||y<1||x>=F.map-1||y>=F.map-1)mark(x,y,x+1,y+1,2);

 const props:PropInst[]=[],houses:HouseInst[]=[],lights:LightSrc[]=[],shops:GameMap['shops']=[],turrets:GameMap['turrets']=[],gazebos:PropInst[]=[],pois:NonNullable<GameMap['pois']>=[];
 let pid=1;
 for(const [ii,x,y,flip,scale] of T.props){
  const id=T.ids[ii],it=T.items[id],k=scale,fl=!!flip;
  // footprint in tiles (2 m) around the placement point; flipped art swaps the ground axes
  const boxes=it.boxes.map(b=>{const hx=(fl?b.hy:b.hx)*k/2,hy=(fl?b.hx:b.hy)*k/2,dx=(fl?b.dy:b.dx)*k/2,dy=(fl?b.dx:b.dy)*k/2;return {x0:x+dx-hx,y0:y+dy-hy,x1:x+dx+hx,y1:y+dy+hy};});
  const x0=Math.min(...boxes.map(b=>b.x0)),y0=Math.min(...boxes.map(b=>b.y0)),x1=Math.max(...boxes.map(b=>b.x1)),y1=Math.max(...boxes.map(b=>b.y1));
  const fw=Math.max(.05,x1-x0),fh=Math.max(.05,y1-y0),cx=x0+fw/2,cy=y0+fh/2;
  // the sprite is drawn with its anchor on the placement point; the renderer anchors on the footprint centre
  const key=id+'|'+k+'|'+fl+'|'+(cx-x).toFixed(3)+'|'+(cy-y).toFixed(3);
  let sp=sprites.get(key);
  if(!sp){const img=images.get(it.file)!,w=it.w*k,h=it.h*k,ax=(fl?it.w-it.ax:it.ax)*k,ay=it.ay*k;
   sp={img:fl?mirror(img):img,w,h,ax:ax+isoX(cx-x,cy-y),ay:ay+isoY(cx-x,cy-y),fw,fh,lights:[]};sprites.set(key,sp);}
  const kind=it.kind==='decor'?'decor':it.kind==='venue'?'venue':it.kind;
  const p:PropInst={id:pid++,sp,x0,y0,fw,fh,big:it.big,kind,shadow:it.shadow?(it.big?.6:.45):0,occludesCharacter:it.big,decor:!it.big&&it.solid<2};
  props.push(p);
  for(const b of boxes){const inset=kind==='tree'?.05:0;mark(b.x0+inset,b.y0+inset,b.x1-inset,b.y1-inset,it.solid);}
  if(it.door){
   const door=it.doorAt?(fl?{x:x+it.doorAt.v*k/2,y:y+it.doorAt.u*k/2}:{x:x+it.doorAt.u*k/2,y:y+it.doorAt.v*k/2}):fl?{x:x1+.65,y:cy}:{x:cx,y:y1+.65};
   const light:LightSrc={x:door.x,y:door.y-.2,r:3.2,color:'#ffbe5c',i:.9,flicker:0};lights.push(light);
   houses.push({prop:p,door,light,lightI:light.i,visited:false,trick:false,owner:kind==='house'?OWNERS[houses.length%OWNERS.length]:it.name});
   if(kind!=='house')pois.push({...door,name:kind==='arcade'?'The Starcade':it.name});
  }
  if(kind==='lamp')lights.push({x:cx,y:cy,r:3.4,color:'#ffb347',i:.8,flicker:0});
  if(kind==='shop'||kind==='vending')shops.push({prop:p,x:cx,y:y1+.6});
  if(kind==='junglegym')turrets.push({x:cx,y:cy,gym:p});
  if(kind==='gazebo')gazebos.push(p);
 }
 // keep every door, shop counter and cannon deck usable: a decoration standing on it gives way
 const clearAround=(px:number,py:number,r:number)=>{for(const p of props){if(p.big||p.removed)continue;
  if(px+r>p.x0&&px-r<p.x0+p.fw&&py+r>p.y0&&py-r<p.y0+p.fh){p.removed=true;}}};
 for(const h of houses)clearAround(h.door.x,h.door.y,.5);for(const s of shops)clearAround(s.x,s.y,.5);
 rebuildCollision(coll,props,T,F);
 // start: on the street in front of the post office (else the first venue), at a clear spot
 const venue=houses.find(h=>/post office/i.test(h.owner))??houses.find(h=>h.prop.kind!=='house')??houses[0];
 const tmp={coll} as GameMap;let start={x:venue.door.x+.3,y:venue.door.y+.8};
 search:for(let r=0;r<12;r+=.25)for(let a=0;a<16;a++){const q={x:start.x+Math.cos(a/16*Math.PI*2)*r,y:start.y+Math.sin(a/16*Math.PI*2)*r};if(!blockedCircle(tmp,q.x,q.y,.5)){start=q;break search;}}
 // A yard the owner fenced all the way round still needs a way to its front door: open the cheapest gap through
 // fences, hedges and small yard pieces (never buildings, cars or trees) between the door and the open town.
 for(let pass=0;pass<4;pass++){
  const walk=walkable(coll),reach=flood(walk,start),stuck=[...houses.map(h=>h.door),...shops].filter(d=>!nearReach(reach,d));
  if(!stuck.length)break;
  for(const d of stuck){const path=cheapestPath(coll,walk,reach,d);if(!path)continue;
   for(const c of path){const x=(c%CW+.5)/CR,y=(Math.floor(c/CW)+.5)/CR;
    for(const p of props)if(!p.removed&&p.decor&&x>p.x0-.6&&x<p.x0+p.fw+.6&&y>p.y0-.6&&y<p.y0+p.fh+.6)p.removed=true;}}
  rebuildCollision(coll,props,T,F);
 }
 // A door that still opens onto nothing (a house at the very edge of the painted town, facing off the picture) is
 // moved round to the nearest side of the house the kid can walk up to.
 {const reach=flood(walkable(coll),start);
  for(const h of houses){if(nearReach(reach,h.door))continue;const p=h.prop,cand:{x:number;y:number}[]=[];
   for(let t=.1;t<1;t+=.1){cand.push({x:p.x0+p.fw*t,y:p.y0+p.fh+.65},{x:p.x0+p.fw+.65,y:p.y0+p.fh*t},{x:p.x0+p.fw*t,y:p.y0-.65},{x:p.x0-.65,y:p.y0+p.fh*t});}
   const ok=cand.filter(c=>nearReach(reach,c)).sort((a,b)=>Math.hypot(a.x-h.door.x,a.y-h.door.y)-Math.hypot(b.x-h.door.x,b.y-h.door.y));
   if(ok.length){h.door={...ok[0]};if(h.light){h.light.x=h.door.x;h.light.y=h.door.y-.2;}}}
  // still no way in (walled in by the map edge and trees): it is scenery, not a door to knock on
  for(let i=houses.length-1;i>=0;i--)if(!nearReach(reach,houses[i].door)){const h=houses[i];h.prop.kind=h.prop.kind==='house'?'building':h.prop.kind;if(h.light)h.light.i=.4;houses.splice(i,1);}}
 // rescue hideouts: the four gazebos (front corner), else the cannons
 const sites=gazebos.map(p=>({x:p.x0+p.fw+.2,y:p.y0+p.fh+.2,name:nearestName(p.x0+p.fw/2,p.y0+p.fh/2,pois,'the gazebo')}));
 for(const q of turrets)if(sites.length<4)sites.push({x:q.x+q.gym.fw/2+.4,y:q.y+q.gym.fh/2+.4,name:nearestName(q.x,q.y,pois,'the playground')});
 const hideouts=sites.slice(0,4).map(s=>({x:s.x,y:s.y}));
 const gates=sites.slice(0,4).map((s,id)=>({id,propIds:[],cells:[],openAt:75+id*45,name:s.name,dir:(['n','e','s','w'] as const)[id],x:s.x,y:s.y,opened:false}));
 const tiles:GroundTile[]=[];
 for(let ty=0;ty<F.rows;ty++)for(let tx=0;tx<F.cols;tx++){const w=Math.min(F.tile,F.width-tx*F.tile),h=Math.min(F.tile,F.height-ty*F.tile);
  tiles.push({x:tx*F.tile+F.gx0,y:ty*F.tile+F.gy0,w,h,url:url(`ground/${tx}_${ty}.webp`),img:null,loading:false,used:0});}
 const builtGround:BuiltGround={tiles,overview,overviewRect:{x:F.gx0,y:F.gy0,w:F.width,h:F.height}};
 return {kind:'town',name:'Maple Falls',ground,tiles:new Array(N),overlays:Array.from({length:N},()=>[]),coll,props,lights,houses,shops,gates,
  barriers:[],turrets,hideouts,pois,start,builtGround,
  bounds:{x0:1,y0:1,x1:F.map-1,y1:F.map-1}};
}
/** cells a kid (radius .3 tiles) can stand on */
function walkable(coll:Uint8Array){const w=new Uint8Array(CW*CH),m={coll} as GameMap;for(let cy=0;cy<CH;cy++)for(let cx=0;cx<CW;cx++)w[cy*CW+cx]=coll[cy*CW+cx]||blockedCircle(m,(cx+.5)/CR,(cy+.5)/CR,.3)?0:1;return w;}
function flood(walk:Uint8Array,s:{x:number;y:number}){const seen=new Uint8Array(CW*CH),q=new Int32Array(CW*CH);let h=0,t=0;const c0=Math.floor(s.y*CR)*CW+Math.floor(s.x*CR);seen[c0]=1;q[t++]=c0;
 while(h<t){const c=q[h++],x=c%CW;for(const n of [x>0?c-1:-1,x<CW-1?c+1:-1,c-CW,c+CW])if(n>=0&&n<CW*CH&&!seen[n]&&walk[n]){seen[n]=1;q[t++]=n;}}return seen;}
function nearReach(reach:Uint8Array,d:{x:number;y:number},r=.25){for(let y=Math.floor((d.y-r)*CR);y<=Math.floor((d.y+r)*CR);y++)for(let x=Math.floor((d.x-r)*CR);x<=Math.floor((d.x+r)*CR);x++)if(x>=0&&y>=0&&x<CW&&y<CH&&reach[y*CW+x])return true;return false;}
/** cheapest walk from a door to the reachable town where low scenery (coll 1) costs 25 per cell and tall scenery is a wall */
function cheapestPath(coll:Uint8Array,walk:Uint8Array,reach:Uint8Array,d:{x:number;y:number}):number[]|null{
 const N=CW*CH,cost=new Float64Array(N).fill(Infinity),prev=new Int32Array(N).fill(-1),R=60*CR,cx0=Math.floor(d.x*CR),cy0=Math.floor(d.y*CR);
 const heap:[number,number][]=[];const push=(c:number,v:number)=>{heap.push([v,c]);let i=heap.length-1;while(i){const p=(i-1)>>1;if(heap[p][0]<=heap[i][0])break;[heap[p],heap[i]]=[heap[i],heap[p]];i=p;}};
 const pop=()=>{const top=heap[0],last=heap.pop()!;if(heap.length){heap[0]=last;let i=0;for(;;){const l=2*i+1,r=l+1;let m=i;if(l<heap.length&&heap[l][0]<heap[m][0])m=l;if(r<heap.length&&heap[r][0]<heap[m][0])m=r;if(m===i)break;[heap[m],heap[i]]=[heap[i],heap[m]];i=m;}}return top;};
 const c0=cy0*CW+cx0;cost[c0]=0;push(c0,0);
 while(heap.length){const [v,c]=pop();if(v>cost[c])continue;if(reach[c]){const path=[];for(let k=c;k>=0;k=prev[k])path.push(k);return path;}
  const x=c%CW,y=Math.floor(c/CW);if(Math.abs(x-cx0)>R||Math.abs(y-cy0)>R)continue;
  for(const n of [x>0?c-1:-1,x<CW-1?c+1:-1,y>0?c-CW:-1,y<CH-1?c+CW:-1]){if(n<0||coll[n]>=2)continue;const step=walk[n]?1:25,nv=v+step;if(nv<cost[n]){cost[n]=nv;prev[n]=c;push(n,nv);}}}
 return null;}
function nearestName(x:number,y:number,pois:{x:number;y:number;name:string}[],fallback:string){
 let best=fallback,d=Infinity;for(const p of pois){const q=Math.hypot(p.x-x,p.y-y);if(q<d&&q<40){d=q;best=p.name;}}return best;}
/** collision after decorations were cleared from doors: only what still stands */
function rebuildCollision(coll:Uint8Array,props:PropInst[],T:Town,F:Town['frame']){
 const removed=props.filter(p=>p.removed);if(!removed.length)return;
 // recompute from scratch: map edges + standing props
 coll.fill(0);
 const out=Uint8Array.from(atob(T.outside),c=>c.charCodeAt(0));
 const mark=(x0:number,y0:number,x1:number,y1:number,v:number)=>{
  for(let cy=Math.max(0,Math.floor(y0*CR));cy<Math.min(CH,Math.ceil(y1*CR));cy++)for(let cx=Math.max(0,Math.floor(x0*CR));cx<Math.min(CW,Math.ceil(x1*CR));cx++)if(coll[cy*CW+cx]<v)coll[cy*CW+cx]=v;};
 for(let y=0;y<MAP_H;y++)for(let x=0;x<MAP_W;x++)if(x>=F.map||y>=F.map||out[y*F.map+x]||x<1||y<1||x>=F.map-1||y>=F.map-1)mark(x,y,x+1,y+1,2);
 let pid=1;
 for(const [ii,x,y,flip,scale] of T.props){const p=props[pid-1];pid++;if(p.removed)continue;const it=T.items[T.ids[ii]],k=scale,fl=!!flip;
  for(const b of it.boxes){const hx=(fl?b.hy:b.hx)*k/2,hy=(fl?b.hx:b.hy)*k/2,dx=(fl?b.dy:b.dx)*k/2,dy=(fl?b.dx:b.dy)*k/2;mark(x+dx-hx,y+dy-hy,x+dx+hx,y+dy+hy,it.solid);}}
}

/** Draw the streamed ground for the view rectangle (world px), loading what is needed and dropping what is far. */
const MAX_TILES=24;
export function drawBuiltGround(ctx:CanvasRenderingContext2D,gr:BuiltGround,vx0:number,vy0:number,vx1:number,vy1:number,now:number){
 const o=gr.overviewRect;ctx.drawImage(gr.overview,o.x,o.y,o.w,o.h);
 let loaded=0;
 for(const t of gr.tiles){
  if(t.img)loaded++;
  const visible=t.x+t.w>vx0&&t.x<vx1&&t.y+t.h>vy0&&t.y<vy1,near=t.x+t.w>vx0-700&&t.x<vx1+700&&t.y+t.h>vy0-500&&t.y<vy1+500;
  if(near){t.used=now;if(!t.img&&!t.loading){t.loading=true;fetch(t.url).then(r=>r.blob()).then(b=>createImageBitmap(b)).then(i=>{t.img=i;}).catch(()=>{}).finally(()=>{t.loading=false;});}}
  if(visible&&t.img)ctx.drawImage(t.img,t.x,t.y,t.w,t.h);
 }
 if(loaded>MAX_TILES){const far=gr.tiles.filter(t=>t.img&&t.used<now).sort((a,b)=>a.used-b.used);for(const t of far.slice(0,loaded-MAX_TILES)){(t.img as ImageBitmap).close?.();t.img=null;}}
}

const OWNERS=['Mrs. Henderson','Mr. Kowalski','Old Man Jenkins','The Nguyens','Ms. Petrova','Grandma Rose','Coach Miller','Dr. Alvarez','The Johnsons','Mrs. Okafor','Mr. Bellamy','The Pruitts','Mrs. Abbott','The Bakers','Mr. Ruiz'];
