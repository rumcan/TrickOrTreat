/** Project painted fence planes onto the exact world grid. Original texture files stay untouched. */
export function fencePlan({width,height,left,right,axis,lengthM,heightM,pxPerM=32,ratio=2}){
 const span=right.x-left.x;if(!(span>0&&left.bottom>left.top&&right.bottom>right.top))throw Error('Invalid fence post calibration');
 const scale=lengthM*pxPerM*ratio/span,cx=(left.x+right.x)/2,sign=axis==='x'?1:-1;
 const postH=heightM?heightM*pxPerM*Math.sqrt(1.5)*ratio:((left.bottom-left.top)+(right.bottom-right.top))/2*scale;
 const at=x=>{
  const t=(x-left.x)/span,base=left.bottom+(right.bottom-left.bottom)*t;
  const h=(left.bottom-left.top)+((right.bottom-right.top)-(left.bottom-left.top))*t;
  return {x:(x-cx)*scale,base,h:Math.max(h,((left.bottom-left.top)+(right.bottom-right.top))/4)};
 };
 let minY=Infinity,maxY=-Infinity;
 for(let x=0;x<=width;x++){const p=at(x),b=sign*p.x/2,k=postH/p.h;minY=Math.min(minY,b-p.base*k);maxY=Math.max(maxY,b+(height-p.base)*k);}
 const pad=1.5*ratio,minX=-cx*scale,canvasW=Math.ceil(width*scale)+pad*2,canvasH=Math.ceil(maxY-minY)+pad*2;
 return {version:1,width,height,left,right,axis,lengthM,heightM,pxPerM,ratio,scale,cx,sign,postH,minX,minY,pad,
  canvasW,canvasH,ax:-minX+pad,ay:-minY+pad,w:canvasW/ratio,h:canvasH/ratio,
  sourceSlope:(right.bottom-left.bottom)/span};
}
export function fenceColumn(p,x){
 const span=p.right.x-p.left.x,t=(x-p.left.x)/span,base=p.left.bottom+(p.right.bottom-p.left.bottom)*t;
 const sourceH=(p.left.bottom-p.left.top)+((p.right.bottom-p.right.top)-(p.left.bottom-p.left.top))*t;
 const sy=p.postH/Math.max(sourceH,((p.left.bottom-p.left.top)+(p.right.bottom-p.right.top))/4),xx=(x-p.cx)*p.scale;
 return {x:xx-p.minX+p.pad,y:p.sign*xx/2-base*sy-p.minY+p.pad,sy,width:p.scale};
}
export function fencePoint(p,x,y){
 const c=fenceColumn(p,x);return {x:c.x,y:c.y+y*c.sy};
}
/** Cached once per fence type; normal map drawing still takes one draw call per instance. */
export function paintFence(ctx,image,p){
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
 for(let x=0;x<p.width;x++){
  const c=fenceColumn(p,x),sw=Math.min(1.15,p.width-x);
  ctx.drawImage(image,x,0,sw,p.height,c.x,c.y,sw*p.scale,p.height*c.sy);
 }
}
export function fenceSvg(p,href){
 const cols=[];
 for(let x=0;x<p.width;x++){const c=fenceColumn(p,x),sw=Math.min(1.15,p.width-x);
  cols.push('<svg x="'+c.x+'" y="'+c.y+'" width="'+sw*p.scale+'" height="'+p.height*c.sy+'" viewBox="'+x+' 0 '+sw+' '+p.height+'" preserveAspectRatio="none" overflow="hidden"><use href="#painted-fence"/></svg>');
 }
 return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="'+p.canvasW+'" height="'+p.canvasH+'"><defs><image id="painted-fence" width="'+p.width+'" height="'+p.height+'" href="'+href+'"/></defs>'+cols.join('')+'</svg>';
}
export function fenceAxis(it,flip=false){const axis=it.fence?.axis;if(!axis)return null;return flip?(axis==='x'?'y':'x'):axis;}
/** Straighten a selected run, keeping the first fence's outer end and each item's scale. */
export function alignFenceRun(objects,items){
 if(objects.length<2)return null;
 const first=objects[0],it=items.get(first.id),axis=fenceAxis(it,first.flip);if(!axis)return null;
 if(objects.some(o=>fenceAxis(items.get(o.id),o.flip)!==axis))return null;
 const a=axis,b=axis==='x'?'y':'x',sorted=objects.slice().sort((u,v)=>u[a]-v[a]),head=sorted[0];
 const anchor=objects[0],before=sorted.slice(0,sorted.findIndex(o=>o.uid===anchor.uid));
 let edge=anchor[a]-(items.get(anchor.id).fence.lengthM*(anchor.scale||1))/2-before.reduce((sum,o)=>sum+items.get(o.id).fence.lengthM*(o.scale||1),0);
 const line=anchor[b],positions=new Map();
 for(const o of sorted){const length=items.get(o.id).fence.lengthM*(o.scale||1);positions.set(o.uid,{x:a==='x'?edge+length/2:line,y:a==='y'?edge+length/2:line});edge+=length;}
 return objects.map(o=>({...o,...positions.get(o.uid)}));
}
/** Only unmarked newly generated chain-link Y placements affected by the reported defect are migrated.
 *  Other families/creative layouts remain user-authored; their selected runs can be aligned explicitly. */
export function repairLegacyFenceRuns(objects,items){
 const pending=objects.filter(o=>o.id==='expansion:chainlink-y'&&!o.fencePlaneVersion&&items.get(o.id)?.fence);
 if(!pending.length)return {items:objects,changed:0};
 const todo=new Set(pending),replacement=new Map();
 while(todo.size){
  const first=todo.values().next().value,group=[first];todo.delete(first);
  for(let n=0;n<group.length;n++)for(const o of [...todo]){
   const q=group[n],axis=fenceAxis(items.get(q.id),q.flip),cross=axis==='x'?'y':'x',length=items.get(q.id).fence.lengthM*(q.scale||1);
   if(fenceAxis(items.get(o.id),o.flip)===axis&&Math.abs(o[cross]-q[cross])<.8&&Math.abs(o[axis]-q[axis])<length*1.4){group.push(o);todo.delete(o);}
  }
  const anchor=group[0],p=items.get(anchor.id).fence,k=anchor.scale||1;
  const sx=(p.left.x/p.width*p.original.w-p.original.ax)*k*(anchor.flip?-1:1),sy=(p.left.bottom/p.height*p.original.h-p.original.ay)*k;
  const oldDx=(sx/p.pxPerM+sy/(p.pxPerM/2))/2,oldDy=(sy/(p.pxPerM/2)-sx/p.pxPerM)/2;
  const nsx=-p.lengthM*p.pxPerM*k/2*(anchor.flip?-1:1),nsy=p.sign*(-p.lengthM*p.pxPerM*k/2)/2;
  const newDx=(nsx/p.pxPerM+nsy/(p.pxPerM/2))/2,newDy=(nsy/(p.pxPerM/2)-nsx/p.pxPerM)/2;
  const shifted=group.map(o=>o.uid===anchor.uid?{...o,x:o.x+oldDx-newDx,y:o.y+oldDy-newDy}:{...o});
  const fixed=alignFenceRun(shifted,items)||shifted;
  for(const o of fixed)replacement.set(o.uid,{...o,fencePlaneVersion:1});
 }
 return {items:objects.map(o=>replacement.get(o.uid)||o),changed:replacement.size};
}
