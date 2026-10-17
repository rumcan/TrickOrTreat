// Test sheet (not a preset): strokes laid exactly as the brush lays them (item spacing, 2.5 m snap for slabs/pavement).
import {Preset,ITEMS} from '../kit.mjs';
const W={use:'test strokes for the ground paint brushes',look:'checks seams and soft edges against grass and road'};
export default function(){
 const P=Preset({id:'place-paint-test',name:'paint test',desc:'sheet'});
 const put=(id,u,v)=>{const sn=ITEMS.get(id).paint.snap;if(sn){u=Math.round(u/sn)*sn;v=Math.round(v/sn)*sn;}P.put(id,u,v,{scale:1,why:W,z:-100});};
 const stroke=(id,u0,v,len,vars)=>{const sp=ITEMS.get(id+'-1').paint.spacing;for(let i=0,u=u0;u<=u0+len;i++,u+=sp)put(`${id}-${1+i%vars}`,u,v);};
 let row=5;
 for(const s of ['asphalt','slabs','pavement','dirt']){
  stroke(`paint:${s}-blob-4m`,4,row,20,4);stroke(`paint:${s}-blob-2m`,28,row,6,3);
  for(let i=0;i<3;i++)for(let j=0;j<2;j++)put(`paint:${s}-square-4m-${1+(i+j)%2}`,40+i*4,row-2+j*4);
  put(`paint:${s}-blob-8m-1`,60,row);row+=15;}
 // leaves on top: paint must stay under them
 P.put('gen:drift-3',8,5,{why:W});P.put('town:leaf_drift',12,20,{why:W});
 return P.done();
}
