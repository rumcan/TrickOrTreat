/** Places v5 authoring kit: presets laid out the way the owner paints the town.
 *
 *  Every preset is designed for one road block. Coordinates are block-local metres:
 *    u runs along +X (screen lower-right) from the block's WEST sidewalk edge,
 *    v runs along +Y (screen lower-left) from the block's NORTH sidewalk edge.
 *  A standard block (roads 80 m apart) is 69.4 x 69.4 m; a narrow one (roads 60 m apart) is 49.4 m.
 *  Outside the block: the sidewalk is the 2.05 m band beyond each edge, then the curb, then the road (centre 5.3 m out).
 *  The preset's stamp point is the block centre, so a stamp snapped to the block lands exactly where it was designed.
 *
 *  Art facing: an unflipped building's front faces +Y (the SOUTH street, screen lower-left); flip:true faces +X (the
 *  EAST street, screen lower-right). Nothing can face north or west: use the rear-view sprites there, or face a court.
 *
 *  Every placement carries its reasons: why:{use:'what it is for', look:'what it does for the picture'}. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ROOT} from '../../lib/town-paths.mjs';
const HERE=path.dirname(fileURLToPath(import.meta.url));
export const DATA=path.join(ROOT,'output/town-builder');
export const ROAD=Object.freeze({walk:2.05,curb:2.05,centre:5.3,half:3.25});
const lib=JSON.parse(fs.readFileSync(path.join(DATA,'library/library.json'),'utf8'));
export const ITEMS=new Map(lib.items.map(i=>[i.id,i]));
export const SCALES=JSON.parse(fs.readFileSync(path.join(HERE,'scales.json'),'utf8'));
/** The scale a sprite has on the owner's map (the one it most often has), or the reviewed/estimated scale. */
export const scaleOf=id=>{const s=SCALES[id];if(!s)throw Error('no scale for '+id);return s.scale;};
/** Map scales only: a requested size (absolute, or the map scale times mul) snaps to the nearest scale the owner has
 *  actually placed that sprite at. Sprites the owner has not placed yet use the estimate times mul. */
export const mapScale=(id,{scale,mul}={})=>{const s=SCALES[id];if(!s)throw Error('no scale for '+id);const want=scale??s.scale*(mul??1);
 if(s.source!=='owner')return +want.toFixed(3);return s.placed.reduce((b,x)=>Math.abs(x-want)<Math.abs(b-want)?x:b,s.scale);};

/** Fence and hedge runs as the owner builds them: sprite, scale and flip per run direction. step = lengthM * scale. */
export const RUNS={
 picket:{u:{id:'expansion:picket-x',flip:false},v:{id:'expansion:picket-x',flip:true}},
 privacy:{u:{id:'expansion:fence-privacy-x',flip:false},v:{id:'expansion:fence-privacy-y',flip:false}},
 chain:{u:{id:'expansion:gate-chainlink-x',flip:false},v:{id:'expansion:gate-chainlink-x',flip:true}},
 chainTall:{u:{id:'expansion:chainlink-x',flip:false},v:{id:'expansion:chainlink-y',flip:false}},
 iron:{u:{id:'world:fence_iron_x',flip:false},v:{id:'world:fence_iron_y',flip:false}},
 gardenPicket:{u:{id:'world:fence_picket_x',flip:false},v:{id:'world:fence_picket_y',flip:false}},
 splitRail:{u:{id:'gen:fence-split-rail',flip:false},v:{id:'gen:fence-split-rail',flip:true}},
 hedge:{u:{id:'world:hedge',flip:false,stepM:2},v:{id:'world:hedge',flip:false,stepM:2}},
};
// every run uses the scale that sprite has on the owner's map; step = segment length at that scale
for(const k of Object.keys(RUNS))for(const ax of ['u','v']){const r=RUNS[k][ax];r.scale=scaleOf(r.id);if(r.stepM)r.step=+(r.stepM*r.scale).toFixed(3);}
const STREET_CATS=new Set(['Street furniture','City utility details','Road & mud decals','Decals & ground','Vehicles']);
const UPRIGHT_SKIP=/^(world:hedge|world:fence_|gen:fence-|gen:wall-|expansion:(picket|chainlink|gate-chainlink|fence-privacy)-)/;

function why(w,ctx){
 if(!w||typeof w!=='object')throw Error(`${ctx}: give why:{use,look}`);
 for(const k of ['use','look'])if(typeof w[k]!=='string'||w[k].trim().length<12)throw Error(`${ctx}: why.${k} must say something real (12+ characters)`);
 return {use:w.use.trim(),look:w.look.trim()};
}

/** Start a preset. fit = block interior size {w,h}; group defaults to 'Places (full)'. */
export function Preset({id,name,desc,fit={w:69.4,h:69.4},group='Places (full)',story=''}){
 if(!/^place-[a-z0-9-]+$/.test(id))throw Error('preset id must look like place-something');
 const members=[],ground=[],notes=[];let section='';
 const P={id,fit,
  /** label the following placements (e.g. 'Lot 2 front yard'); shows in the review notes */
  section(name){section=name;return P;},
  /** one sprite. o: {flip, scale (absolute) | mul (times the owner scale), z, o, street:true for sidewalk/curb items} */
  put(sid,u,v,o={}){
   const it=ITEMS.get(sid);if(!it)throw Error(`unknown sprite ${sid}`);if(it.hidden)throw Error(`${sid} is hidden art; do not use it`);
   const w=why(o.why,`${id} ${sid} @${u},${v}`),sc=mapScale(sid,o);
   const m={id:sid,u:+u.toFixed(3),v:+v.toFixed(3),flip:!!o.flip,scale:sc,...w,section};
   if(o.z!=null)m.z=o.z;if(o.o!=null)m.o=o.o;if(o.street)m.street=true;if(o.run)m.run=o.run;
   members.push(m);return m;},
  /** a straight fence/hedge run between two points on one axis; skip:[segment indexes] leaves gaps (paths, drives).
   *  kind from RUNS, or {id,scale,flip,step}. Returns the placed members. */
  run(kind,[u0,v0],[u1,v1],o={}){
   const axis=Math.abs(v1-v0)<1e-6?'u':Math.abs(u1-u0)<1e-6?'v':null;if(!axis)throw Error(`${id}: run must be straight along u or v`);
   const spec=typeof kind==='string'?RUNS[kind]?.[axis]:kind;if(!spec)throw Error(`${id}: unknown run kind ${kind}`);
   const it=ITEMS.get(spec.id),step=spec.step??it.fence.lengthM*spec.scale,len=axis==='u'?u1-u0:v1-v0,n=Math.max(1,Math.round(Math.abs(len)/step)),dir=Math.sign(len)||1;
   const w=why(o.why,`${id} run ${kind}`),tag=`${typeof kind==='string'?kind:spec.id}#${members.length}`,out=[];
   for(let i=0;i<n;i++){if(o.skip?.includes(i))continue;const t=(i+.5)*step*dir;
    out.push(P.put(spec.id,axis==='u'?u0+t:u0,axis==='v'?v0+t:v0,{scale:spec.scale,flip:o.flip??spec.flip,why:w,run:tag,street:o.street}));}
   return out;},
  /** the same sprite repeated along a straight line: count items, evenly spaced, ends included */
  line(sid,[u0,v0],[u1,v1],count,o={}){const out=[];for(let i=0;i<count;i++){const t=count===1?.5:i/(count-1);out.push(P.put(sid,u0+(u1-u0)*t,v0+(v1-v0)*t,{...o}));}return out;},
  /** ground: car park / drive / yard. surface asphalt|slab|dirt|field; border none|curb|walk; bays [{side,from,to,depth}] and
   *  openings [{side,a0,a1}] (a driveway mouth cut across the sidewalk to the road) in u/v. auto:true opens a 6 m mouth on any
   *  side at least 7 m long that meets a sidewalk. A drive may run up to 2 m onto the sidewalk, as the owner's do. */
  lot(g){const w=why(g.why,`${id} lot`);ground.push({kind:'lot',surface:g.surface||'asphalt',x0:g.u0,y0:g.v0,x1:g.u1,y1:g.v1,border:g.border||'none',...(g.bays?{bays:g.bays}:{}),...(g.openings?{openings:g.openings}:{}),...(g.auto!=null?{auto:g.auto}:{}),...w,section});return P;},
  /** ground: beige paving patch (front walks, plazas, aprons) */
  pave(g){const w=why(g.why,`${id} pave`);ground.push({kind:'pave',x0:g.u0,y0:g.v0,x1:g.u1,y1:g.v1,border:g.border||'none',...w,section});return P;},
  /** ground: a lamp's glow painted on the asphalt (pair it with a world:streetlamp you add on the sidewalk) */
  glow(u,v,o={}){ground.push({kind:'refl',x:u,y:v,free:!!o.free,strength:o.strength??1,scale:o.scale??1,section});return P;},
  note(t){notes.push(t);return P;},
  members,ground,
  /** validate and convert to the town builder's preset format (dx,dy from the block centre) */
  done(){
   const {w,h}=fit,cx=w/2,cy=h/2,errors=[],warnings=[];
   const box=m=>{const it=ITEMS.get(m.id),b=it.base||{hx:it.fw,hy:it.fh,dx:0,dy:0};let hx=b.hx*m.scale,hy=b.hy*m.scale,ox=(b.dx||0)*m.scale,oy=(b.dy||0)*m.scale;if(m.flip){[hx,hy]=[hy,hx];[ox,oy]=[oy,ox];}return [m.u+ox-hx,m.v+oy-hy,m.u+ox+hx,m.v+oy+hy];};
   for(const m of members){const it=ITEMS.get(m.id),out=m.u<-.3||m.v<-.3||m.u>w+.3||m.v>h+.3;
    if(out&&!m.street)errors.push(`${m.id} @(${m.u},${m.v}) is outside the block; pass street:true for sidewalk/curb items`);
    if(m.street&&!STREET_CATS.has(it.category)&&!it.flat&&!UPRIGHT_SKIP.test(m.id))warnings.push(`${m.id} is placed on the street but is a ${it.category} item`);
    if(m.u<-ROAD.centre-1||m.v<-ROAD.centre-1||m.u>w+ROAD.centre+1||m.v>h+ROAD.centre+1)errors.push(`${m.id} @(${m.u},${m.v}) is past the road centre`);
    const s=SCALES[m.id];if(s?.source!=='owner')warnings.push(`${m.id} is not on the owner's map yet: estimated scale ${m.scale}`);}
   const solid=members.filter(m=>!ITEMS.get(m.id).flat&&!UPRIGHT_SKIP.test(m.id));
   for(let i=0;i<solid.length;i++)for(let j=i+1;j<solid.length;j++){const a=box(solid[i]),b=box(solid[j]),ix=Math.min(a[2],b[2])-Math.max(a[0],b[0]),iy=Math.min(a[3],b[3])-Math.max(a[1],b[1]);
    if(ix>0&&iy>0){const area=ix*iy,small=Math.min((a[2]-a[0])*(a[3]-a[1]),(b[2]-b[0])*(b[3]-b[1]));if(area>.35*small)warnings.push(`overlap ${Math.round(100*area/small)}%: ${solid[i].id}@(${solid[i].u},${solid[i].v}) and ${solid[j].id}@(${solid[j].u},${solid[j].v})`);}}
   for(const g of ground)if(g.kind!=='refl'&&(Math.min(g.x0,g.x1)<-2.1||Math.min(g.y0,g.y1)<-2.1||Math.max(g.x0,g.x1)>w+2.1||Math.max(g.y0,g.y1)>h+2.1))warnings.push(`ground ${g.kind} ${g.x0},${g.y0}-${g.x1},${g.y1} reaches past the sidewalk`);
   const T=(v,c)=>+(v-c).toFixed(2);
   const preset={id,name,group,desc,story,fit,anchor:'block-centre',fixed:true,turn:false,mirror:false,
    members:members.map(m=>({pick:[m.id],dx:T(m.u,cx),dy:T(m.v,cy),flip:m.flip,scale:[m.scale,m.scale],chance:1,jitter:0,...(m.z!=null?{z:m.z}:{}),...(m.o!=null?{o:m.o}:{}),use:m.use,look:m.look,section:m.section})),
    ground:ground.map(g=>{const {use,look,section:sec,...rest}=g;const c={...rest};if(c.kind==='refl'){c.x=T(c.x,cx);c.y=T(c.y,cy);}else{c.x0=T(c.x0,cx);c.x1=T(c.x1,cx);c.y0=T(c.y0,cy);c.y1=T(c.y1,cy);
     for(const b of c.bays||[]){const o=b.side==='N'||b.side==='S'?cx:cy;b.from=T(b.from,o);b.to=T(b.to,o);}
     for(const op of c.openings||[]){const o=op.side==='N'||op.side==='S'?cx:cy;op.a0=T(op.a0,o);op.a1=T(op.a1,o);}}return {...c,...(use?{use,look}:{}),...(sec?{section:sec}:{})};}),
    notes,count:members.length};
   preset.spanM=Math.max(...preset.members.map(m=>Math.hypot(m.dx,m.dy)),1);
   return {preset,errors,warnings,members};
  }};
 return P;
}
