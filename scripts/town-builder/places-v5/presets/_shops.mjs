// Measuring sheet (not a preset): shops at map scale on a metre grid, to read fronts and doors.
import {Preset} from '../kit.mjs';
const W={use:'measuring sheet for shop fronts',look:'reference only, never stamped'};
export default function(){
 const P=Preset({id:'place-shops',name:'shops',desc:'sheet'});
 for(const [id,u,v] of [['town:hardware',10,12],['town:barber',30,12],['ref:building-corner-shop',52,12],
  ['town:pharmacy',10,34],['town:bakery',28,34],['town:laundromat',50,34],
  ['ref:building-corner-store',8,58],['static:shop_market_rear',28,58],['town:grocery',52,56]])P.put(id,u,v,{why:W});
 return P.done();
}
