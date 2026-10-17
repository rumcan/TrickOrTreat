// Measuring sheet (not a preset): houses at owner scale on a metre grid, to read door and wall positions.
import {Preset} from '../kit.mjs';
const W={use:'measuring sheet for door positions',look:'reference only, never stamped'};
export const SHEET=[
 ['world:house_0',12,16],['world:house_1',36,16],['world:house_2',58,16],
 ['world:house_3',12,40],['world:house_4',36,40],['world:house_5',58,40],
 ['gen:house-splitlevel',12,62],['gen:house-l-shape',36,62],['gen:house-duplex',58,62]];
export default function(){
 const P=Preset({id:'place-doors',name:'doors',desc:'sheet'});
 for(const [id,u,v] of SHEET)P.put(id,u,v,{why:W});
 return P.done();
}
