const copy=v=>v===undefined?undefined:structuredClone(v);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function field(base,next,current,key,conflicts,label,preferLocal){
 if(same(base?.[key],next?.[key]))return;
 if(!same(current?.[key],base?.[key])&&!same(current?.[key],next?.[key])){
  conflicts.push({item:label,field:key});if(!preferLocal)return;
 }
 if(own(next,key))current[key]=copy(next[key]);else delete current[key];
}
export function mergeEntities(base,next,current,key,label,preferLocal=false){
 const before=new Map(base.map(o=>[String(o[key]),o])),desired=new Map(next.map(o=>[String(o[key]),o]));
 const latest=new Map(current.map(o=>[String(o[key]),copy(o)])),conflicts=[];
 for(const [id,old] of before){const local=desired.get(id),remote=latest.get(id);
  if(!local){if(remote&&!same(remote,old)){conflicts.push({item:label+' '+id,field:'deleted item'});if(!preferLocal)continue;}latest.delete(id);continue;}
  if(same(local,old))continue;
  if(!remote){conflicts.push({item:label+' '+id,field:'item removed'});if(preferLocal)latest.set(id,copy(local));continue;}
  for(const k of new Set([...Object.keys(old),...Object.keys(local)]))if(k!==key)field(old,local,remote,k,conflicts,label+' '+id,preferLocal);
 }
 for(const [id,local] of desired)if(!before.has(id)){
  const remote=latest.get(id);if(remote&&!same(remote,local)){conflicts.push({item:label+' '+id,field:'new item'});if(!preferLocal)continue;}
  latest.set(id,copy(local));
 }
 return {value:[...latest.values()],conflicts};
}
export function mergeTown(kind,base,next,current,preferLocal=false){
 const value=copy(current),conflicts=[];
 if(kind==='layout'){
  const merged=mergeEntities(base.sprites||[],next.sprites||[],current.sprites||[],'uid','Object',preferLocal);
  value.sprites=merged.value;conflicts.push(...merged.conflicts);
 }else{
  // Roads merge as independent cells, including additions and removals.
  const before=new Set(base.roads||[]),wanted=new Set(next.roads||[]),roads=new Set(current.roads||[]);
  for(const k of before)if(!wanted.has(k))roads.delete(k);for(const k of wanted)if(!before.has(k))roads.add(k);value.roads=[...roads];
  for(const [collection,label] of [['lots','Lot'],['paving','Footpath'],['reflections','Light glow']]){
   const merged=mergeEntities(base[collection]||[],next[collection]||[],current[collection]||[],'id',label,preferLocal);
   value[collection]=merged.value;conflicts.push(...merged.conflicts);
  }
  for(const key of new Set([...Object.keys(base),...Object.keys(next)]))if(!['roads','lots','paving','reflections'].includes(key))field(base,next,value,key,conflicts,'Ground',preferLocal);
 }
 return {value,conflicts};
}
export function normalizeTown(kind,document){
 const doc=copy(document);
 if(kind==='plan')for(const name of ['lots','paving','reflections'])for(const [i,o] of (doc[name]||[]).entries())o.id??=`legacy-${name}-${i}-${o.x??o.x0}-${o.y??o.y0}`;
 if(kind==='layout')for(const [i,o] of (doc.sprites||[]).entries())o.uid??=i+1;
 return doc;
}
/** Only what changed between two versions of a town document, as a pair of partial documents {before, after}.
 *  mergeTown(kind, before, after, doc) applies the change to any document; applyDelta does so onto the exact `from`.
 *  Roads: before.roads = removed cells, after.roads = added cells. Unchanged objects are left out entirely. */
export function diffTown(kind,from,to){
 const before={},after={};
 const entities=(list,key,a,b)=>{const old=new Map((a||[]).map(o=>[String(o[key]),o])),next=new Map((b||[]).map(o=>[String(o[key]),o]));
  const out=[[],[]];for(const [id,o] of old){const n=next.get(id);if(!n)out[0].push(copy(o));else if(!same(o,n)){out[0].push(copy(o));out[1].push(copy(n));}}
  for(const [id,n] of next)if(!old.has(id))out[1].push(copy(n));before[list]=out[0];after[list]=out[1];};
 if(kind==='layout'){entities('sprites','uid',from.sprites,to.sprites);}
 else{const a=new Set(from.roads||[]),b=new Set(to.roads||[]);before.roads=[...a].filter(k=>!b.has(k));after.roads=[...b].filter(k=>!a.has(k));
  for(const list of ['lots','paving','reflections'])entities(list,'id',from[list],to[list]);
  for(const k of new Set([...Object.keys(from),...Object.keys(to)])){if(['roads','lots','paving','reflections'].includes(k))continue;if(!same(from[k],to[k])){if(own(from,k))before[k]=copy(from[k]);if(own(to,k))after[k]=copy(to[k]);}}}
 return {before,after};
}
export const emptyDelta=(kind,d)=>kind==='layout'?!d.before.sprites.length&&!d.after.sprites.length:Object.keys(d.before).every(k=>Array.isArray(d.before[k])?!d.before[k].length:false)&&Object.keys(d.after).every(k=>Array.isArray(d.after[k])?!d.after[k].length:false);
export const applyDelta=(kind,doc,d)=>mergeTown(kind,d.before,d.after,doc,true).value;
