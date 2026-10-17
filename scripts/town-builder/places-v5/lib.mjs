import {scaleOf} from './kit.mjs';
/** Shared helpers for places-v5 presets: the owner's recurring small compositions, in block-local metres.
 *  Each helper takes the reasons it places things for, so callers keep every why specific to the spot. */
export function rng(seed){let s=seed>>>0||1;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}

/** Measured house geometry (from 1 m grid close-ups, output/town-builder/presets-v5-study/stage/doors/), at the owner
 *  scale `s`, as offsets from the footprint centre for an UNFLIPPED house (front toward +v):
 *  wall = front wall line, door = door centre along u, step = where the front steps meet the lawn,
 *  ends = facade ends along u, garage = built-in garage doors {a0,a1 along u, wall}.
 *  The art already paints foundation planting, porch pumpkins and lights: never stack more on the facade. */
export const HOUSE={
 'gen:house-splitlevel':{s:1.307,wall:3.9,door:-1,step:5.5,ends:[-6.6,6.8]},
 'world:house_1':{s:1.404,wall:4.6,door:-2.8,step:6.4,ends:[-6.6,5.6]},
 'gen:house-l-shape':{s:1.202,wall:2.2,door:-6.2,step:4.2,ends:[-7.6,7],garage:{a0:-2,a1:3.6,wall:4.6}},
 'world:house_4':{s:1.435,wall:3.6,door:-2,step:6,ends:[-5.4,4.8]},
};
/** world points of a placed house: {wall, door:[u,v], step:[u,v], ends, garage} in block metres, honouring flip and scale */
export function home(id,u,v,{flip=false,scale}={}){const g=HOUSE[id];if(!g)throw Error('no measured geometry for '+id);const k=(scale??scaleOf(id))/g.s;
 const at=(a,b)=>flip?[u+b*k,v+a*k]:[u+a*k,v+b*k];
 return {id,u,v,flip,wall:flip?u+g.wall*k:v+g.wall*k,door:at(g.door,g.wall),step:at(g.door,g.step),ends:g.ends.map(e=>at(e,g.wall)),
  garage:g.garage?{a:[at(g.garage.a0,g.garage.wall),at(g.garage.a1,g.garage.wall)]}:null};}

/** a planting bed hugging a wall: plants in a row from a to b, alternating ids, sizes varied a little (owner: 1.8-2.3 m apart) */
export function bed(P,ids,[u0,v0],[u1,v1],n,why,{seed=7,mul=[.9,1.15],flip=true}={}){
 const r=rng(seed),out=[];for(let i=0;i<n;i++){const t=n===1?.5:i/(n-1);
  out.push(P.put(ids[i%ids.length],u0+(u1-u0)*t+(r()-.5)*.3,v0+(v1-v0)*t+(r()-.5)*.3,{mul:mul[0]+r()*(mul[1]-mul[0]),flip:flip&&r()<.5,why}));}
 return out;}

/** leaf drifts / ground decals from a list [[u,v,id,mul,flip?],...] sharing one reason */
export function decals(P,list,why,o={}){return list.map(([u,v,id,mul=1,flip=false])=>P.put(id,u,v,{mul,flip,why,street:o.street}));}

/** gutter leaves along a curb, in irregular clumps (owner: packed at the curb, thinning out; never an even dotted row).
 *  edge S|N|E|W, along = list of positions along that edge */
export function gutter(P,fit,edge,along,why,{seed=3}={}){
 const r=rng(seed),out=[];
 for(const a of along){const off=1.55+r()*.35,id=r()<.7?'expansion:gutter-leaves-y':'expansion:gutter-leaves-sparse';
  const [u,v]=edge==='S'?[a,fit.h+off]:edge==='N'?[a,-off]:edge==='E'?[fit.w+off,a]:[-off,a];
  out.push(P.put(id,u,v,{flip:edge==='E'||edge==='W'?r()<.5:r()<.5,mul:.9+r()*.25,street:true,why}));}
 return out;}
