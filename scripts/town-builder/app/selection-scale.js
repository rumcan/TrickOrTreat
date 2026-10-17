/** Uniform group scaling around the selected anchors' centre, preserving each item's relative scale. */
export function scaledSelection(selection,requested,{movePositions=true,min=.05,max=8}={}){
 if(!selection.length||!Number.isFinite(requested)||requested<=0)return null;
 // a missing, zero or broken size counts as 1 (and is repaired by the resize) so one bad sprite cannot block the rest
 const scales=selection.map(s=>Number.isFinite(s.scale)&&s.scale>0?s.scale:1);
 // Clamp the common factor, not each item independently: keep relative sizes and layout intact.
 const lower=Math.max(...scales.map(s=>min/s)),upper=Math.min(...scales.map(s=>max/s));
 if(lower>upper)return null;
 const factor=Math.max(lower,Math.min(upper,requested));if(Math.abs(factor-1)<1e-9)return null;
 const xs=selection.map(s=>s.x),ys=selection.map(s=>s.y);
 const cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;
 return {factor,items:selection.map((s,i)=>({...s,scale:scales[i]*factor,
  x:movePositions?cx+(s.x-cx)*factor:s.x,y:movePositions?cy+(s.y-cy)*factor:s.y}))};
}
