// Local development updates. No polling of saved layouts: never overwrite an active editing session.
let previous=null,busy=false,lastInput=0;
for(const event of ['pointerdown','pointermove','keydown','input'])window.addEventListener(event,()=>lastInput=Date.now(),{passive:true});
async function check(){
 if(busy)return;const st=window.__townBuilder;
 if(!st?.man||!window.__townBuilderLiveUpdate)return;
 busy=true;
 try{
  const r=await fetch('/api/live',{cache:'no-store'});if(!r.ok)return;const next=await r.json();
  if(!previous){previous=next;return;}
  if(!st.saved||st.planSavePending||st.mouse.down||st.drag||Date.now()-lastInput<1500)return;
  if(next.app!==previous.app){try{const a=(st.cam.x-st.man.origin.ox)/st.man.pxPerAxisM,b=(st.cam.y-st.man.origin.oy)/(st.man.pxPerAxisM/2);sessionStorage.setItem('mf-live-camera',JSON.stringify({...st.cam,world:[(a+b)/2,(b-a)/2]}));}catch{}location.reload();return;}
  const changed={};for(const key of ['library','presets','map'])if(next[key]!==previous[key])changed[key]=true;
  if(Object.keys(changed).length)await window.__townBuilderLiveUpdate(changed);
  previous=next;
 }catch(e){console.debug('Builder live update will retry:',e.message);}finally{busy=false;}
}
check();setInterval(check,2000);
