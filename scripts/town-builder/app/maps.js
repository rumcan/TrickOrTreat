/** Each map has its own origin, save folder, sessions and caches. Flush pending edits before navigating. */
export async function mapPicker({save,notify,plan}){
 const select=document.querySelector('#mapSelect');if(!select)return;
 try{
  const response=await fetch('/app/maps.json',{cache:'no-store'});if(!response.ok){select.hidden=true;return;}
  const {maps}=await response.json(),current=maps.find(m=>String(m.port)===(location.port||'80'));
  if(!current){select.hidden=true;return;}
  document.querySelector('#mapName').textContent=current.name;document.title=current.name+' — Town Builder';
  select.replaceChildren(...maps.map(map=>{const option=document.createElement('option');option.value=map.id;option.textContent=map.name;return option;}));
  select.value=current.id;select.setAttribute('aria-label','Choose map');
  select.onchange=async()=>{
   const target=maps.find(m=>m.id===select.value);if(!target||target.id===current.id)return;
   select.disabled=true;
   try{
    await save();
    const url=new URL('/',location.href);url.port=String(target.port);
    // Check that the other map is running without exposing either map's saved documents across origins.
    const probe=await fetch(url.href,{mode:'no-cors',signal:AbortSignal.timeout(4000)});
    if(!probe)throw Error('Other map is not running');
    location.assign(url.href);
   }catch(e){select.value=current.id;select.disabled=false;notify('Could not switch maps: '+e.message+'. Your current map stays open.');}
  };
  if(current.id!=='maple-falls'&&!plan.roads?.length)notify('New Town is a separate blank map. Place objects or draw roads here; edits save to this town only.');
 }catch(e){select.hidden=true;console.warn('Map selector:',e);}
}
