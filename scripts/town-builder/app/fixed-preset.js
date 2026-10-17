/** Presets are authored layouts, never random scatter brushes. Freeze legacy alternatives once. */
export function fixedPreset(p){
 const hash=text=>{let h=2166136261;for(const c of text)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
 const members=p.members.map((m,index)=>{
  if(!m.pick?.length||![m.dx,m.dy].every(Number.isFinite))throw Error('Invalid fixed preset member: '+p.id);
  const id=m.pick[hash(p.id+':'+index)%m.pick.length],scale=Array.isArray(m.scale)?(m.scale[0]+m.scale[1])/2:(m.scale??1);
  if(!Number.isFinite(scale)||scale<=0)throw Error('Invalid fixed preset scale: '+p.id);
  return {...m,pick:[id],flip:m.flip===true,scale:[scale,scale],jitter:0,chance:1};
 });
 return {...p,members,ground:p.ground||[],fixed:true,turn:false,mirror:false,count:members.length};
}
export function fixedPresetRoll(p,scale=1){
 if(!Number.isFinite(scale)||scale<=0)throw Error('Invalid preset brush scale');
 // z (layer) and o (depth nudge) keep authored layering, e.g. pumpkins drawn in front of a porch step
 return fixedPreset(p).members.map(m=>({id:m.pick[0],dx:m.dx*scale,dy:m.dy*scale,flip:m.flip,scale:m.scale[0]*scale,...(m.z!=null?{z:m.z}:{}),...(m.o!=null?{o:m.o*scale}:{})}));
}
