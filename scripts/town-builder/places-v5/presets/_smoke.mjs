// Smoke test for the kit and stage (not a real preset; build.mjs skips files starting with _).
import {Preset} from '../kit.mjs';
export default function(){
 const P=Preset({id:'place-smoke',name:'Smoke',desc:'kit test'});
 const W={use:'test placement for the stage renderer',look:'shows scale against the owner reference'};
 P.section('Lot 1');
 P.put('world:house_1',12,56,{why:W});
 P.put('static:compact_e',22,63,{why:W});
 P.run('picket',[0,67.5],[20,67.5],{why:W,skip:[2]});
 P.run('privacy',[23,40],[23,69.4],{why:W});
 P.put('ref:halloween-mums',8,61.5,{why:W});
 P.lot({surface:'asphalt',u0:19,v0:58,u1:25,v1:69.4,auto:true,why:W});
 return P.done();
}
