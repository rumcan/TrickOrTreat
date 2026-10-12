import type {PropInst} from './map';

export interface WorldDrawItem {
  key:number; x:number; y:number;
  bx0:number; by0:number; bx1:number; by1:number;
  big?:PropInst;
}
/** Shared footprint-aware painter order for gameplay and the stitched town export. */
export function orderWorldItems<T extends WorldDrawItem>(items:T[],bigs:T[]):T[]{
  items.sort((a,b)=>a.key-b.key);
  bigs.sort((a,b)=>a.big!.x0+a.big!.fw+a.big!.y0+a.big!.fh-(b.big!.x0+b.big!.fw+b.big!.y0+b.big!.fh));
  let order=items;
  for(const B of bigs){
    const bp=B.big!;
    let pos=0;
    for(let i=0;i<order.length;i++)if(overlapsWorldItems(order[i],B)&&behindWorldItem(order[i],bp))pos=i+1;
    const before:T[]=[],moved:T[]=[];
    for(let i=0;i<pos;i++){
      const it=order[i];
      if(overlapsWorldItems(it,B)&&!behindWorldItem(it,bp))moved.push(it);else before.push(it);
    }
    order=before.concat([B],moved,order.slice(pos));
  }
  return order;
}
export function overlapsWorldItems(a:WorldDrawItem,b:WorldDrawItem){
  return a.bx1>b.bx0&&a.bx0<b.bx1&&a.by1>b.by0&&a.by0<b.by1;
}
export function behindWorldItem(a:WorldDrawItem,B:PropInst){
  if(a.big)return a.big.x0+a.big.fw<=B.x0||a.big.y0+a.big.fh<=B.y0;
  return a.x<B.x0+B.fw&&a.y<B.y0+B.fh;
}
