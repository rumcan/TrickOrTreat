// Maple Falls Town Builder — paint the town with the sprite library on top of the baked ground.
// World metres (X to screen lower-right, Y to screen lower-left) are the saved coordinates; the map is the game's
// 2:1 projection at 32 px per axis metre, so a placement here is a placement in the game.
import {scaledSelection} from './selection-scale.js';
import {fixedPresetRoll} from './fixed-preset.js';
import {surfaces,edges,surfaceChoices,edgeChoices,gesture} from './ground-ui.js';
import {groundState,groundMatches} from './ground-state.js';
import {SharedTown} from './collaboration.js';
import {NIGHT_DEFAULT,LIGHT_TYPES,lightType,nightSettings,spriteLights,spriteGlows,applyNight,spotCorners,ownLights,toOwnLights,glowOff} from './night-light.js';
import {mergeTown} from './town-merge.js';
import {paintFence,alignFenceRun,repairLegacyFenceRuns,fenceAxis} from './fence-projection.js';
import {mapPicker} from './maps.js';
import {clipGround,groundGrid} from './ground-boundary.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const view=$('#view'),ctx=view.getContext('2d'),mini=$('#mini'),mctx=mini.getContext('2d');
const st={histLog:[],man:null,lib:null,items:new Map(),plan:null,sprites:[],uid:1,cam:{x:0,y:0,z:.25},mode:'select',brush:null,sel:new Set(),undo:[],redo:[],
 show:{grid:false,poi:true,plan:false,shadows:true},presets:[],mouse:{sx:0,sy:0,mx:0,my:0,down:false},drag:null,space:false,cat:'All',filter:'',saved:true,planDirty:false,ver:Date.now(),selLot:null};
const tiles=new Map(),spriteImg=new Map(),alphaMask=new Map();let need=true,dpr=1;
window.__townBuilder=st; // handy for debugging in the console
new ResizeObserver(()=>{need=true;}).observe(view);
const req=()=>{need=true;};
const newId=()=>town.session.id+'-'+[...crypto.getRandomValues(new Uint32Array(2))].map(n=>n.toString(36)).join('-');
function updateEntities(previous,next,key){const existing=new Map((previous||[]).map(o=>[o[key],o]));return (next||[]).map(value=>{const o=existing.get(value[key]);if(!o)return value;for(const k of Object.keys(o))if(!(k in value))delete o[k];Object.assign(o,value);return o;});}
const town=new SharedTown({
 get:kind=>kind==='plan'?st.plan:{version:1,plan:'maple-falls.json',sprites:st.sprites},
 busy:()=>!!st.drag||st.mouse.down,
 lease:start=>st.uid=Math.max(st.uid,start),peers:users=>{st.peers=users;req();},
 notify:message=>{const t=$('#toast');t.textContent=message;t.style.display='block';clearTimeout(t._t);t._t=setTimeout(()=>t.style.display='none',5000);},
 // another builder's change is logged once; undo/redo snapshots get it applied only when they are restored (see restore)
 rebase:(kind,before,after)=>{st.histLog.push({kind,before,after});},
 apply:(kind,doc)=>{let removedSelection=false;if(kind==='layout'){st.sprites=updateEntities(st.sprites,doc.sprites,'uid');const ids=new Set(st.sprites.map(o=>o.uid)),selected=st.sel.size;st.sel=new Set([...st.sel].filter(id=>ids.has(id)));removedSelection=selected!==st.sel.size;}
  else{const lot=st.plan.lots?.[st.selLot]?.id,pave=st.plan.paving?.[st.selPave]?.id,paint=st.paintLot?.id;for(const k of ['lots','paving','reflections'])doc[k]=updateEntities(st.plan[k],doc[k],'id');st.plan=doc;const find=(list,id)=>{const i=id==null?-1:(list||[]).findIndex(o=>o.id===id);return i<0?null:i;};st.selLot=find(doc.lots,lot);st.selPave=find(doc.paving,pave);removedSelection=lot!=null&&st.selLot==null||pave!=null&&st.selPave==null;st.paintLot=doc.lots?.find(o=>o.id===paint)||null;st.planDirty=!groundMatches(doc,st.bakedGround);}
  if(removedSelection||!document.activeElement?.matches('input,select,textarea')){clearTimeout(st.panelT);st.panelT=setTimeout(()=>{stats();inspector();groundPanel();buildPois();},removedSelection?0:250);nightPanel();}else st.sharedPanelPending=true;req();}
});
window.addEventListener('focusout',()=>setTimeout(()=>{if(st.man&&st.sharedPanelPending&&!document.activeElement?.matches('input,select,textarea')){st.sharedPanelPending=false;stats();inspector();groundPanel();}},0));
// ---------------------------------------------------------------- coordinates
const S=()=>st.man.pxPerAxisM,O=()=>st.man.origin;
const w2m=(X,Y)=>[O().ox+(X-Y)*S(),O().oy+(X+Y)*S()/2];
const m2w=(mx,my)=>{const a=(mx-O().ox)/S(),b=(my-O().oy)/(S()/2);return [(a+b)/2,(b-a)/2];};
const s2m=(sx,sy)=>[st.cam.x+(sx-view.clientWidth/2)/st.cam.z,st.cam.y+(sy-view.clientHeight/2)/st.cam.z];
const m2s=(mx,my)=>[(mx-st.cam.x)*st.cam.z+view.clientWidth/2,(my-st.cam.y)*st.cam.z+view.clientHeight/2];
function adoptMap(man){const centre=st.man?m2w(st.cam.x,st.cam.y):null;st.man=man;if(centre)[st.cam.x,st.cam.y]=w2m(...centre);}
// ---------------------------------------------------------------- loading
async function load(){
 const [man,lib,plan,layout]=await Promise.all(['/map/manifest.json','/library/library.json','/api/plan','/api/layout'].map(u=>fetch(u,{cache:'no-store'}).then(r=>{if(!r.ok)throw Error(u+' '+r.status);return r.json();})));
 st.man=man;st.lib=lib;st.plan=plan;st.bakedGround=man.groundPlan||structuredClone(groundState(plan));st.planDirty=!groundMatches(plan,man.groundPlan);st.ver=Date.parse(man.bakedAt)||Date.now();for(const i of lib.items)st.items.set(i.id,i);
 st.sprites=(layout.sprites||[]).filter(s=>st.items.has(s.id));st.uid=st.sprites.reduce((m,s)=>Math.max(m,s.uid||0),0)+1;for(const s of st.sprites)if(!s.uid)s.uid=st.uid++;
 await town.start({plan,layout});
 await mapPicker({plan,notify:message=>toast(message,7000),save:async()=>{clearTimeout(saveT);clearTimeout(planT);await town.save('layout');await town.save('plan');st.saved=true;st.planSavePending=false;setSave('saved','ok');}});
 const fit=Math.min(view.clientWidth/man.width,view.clientHeight/man.height)*1.4;st.cam={x:man.width/2,y:man.height/2,z:Number.isFinite(fit)&&fit>.02?fit:.1};
 try{const c=JSON.parse(sessionStorage.getItem('mf-live-camera'));if(c&&[c.x,c.y,c.z].every(Number.isFinite)&&c.z>0){st.cam=c;if(c.world?.every(Number.isFinite))[st.cam.x,st.cam.y]=w2m(...c.world);}sessionStorage.removeItem('mf-live-camera');}catch{}
 const repaired=repairLegacyFenceRuns(st.sprites,st.items);if(repaired.changed){st.sprites=repaired.items;console.info('Aligned '+repaired.changed+' legacy chain-link placements to the grid');}
 buildPalette();buildPois();stats();setMode('select');save('loaded');
 try{if(!localStorage.getItem('mf-welcomed')){localStorage.setItem('mf-welcomed','1');if(plan.mapId!=='second-town')setTimeout(()=>toast('Welcome to Maple Falls: 25 places are laid out with their buildings. Pick a sprite on the left and click the map to paint; use Go to place in the top bar to fly there. Press <kbd>?</kbd> for shortcuts. Everything autosaves.',12000),400);}}catch{}
 await loadPresets();
 st.miniImg=new Image();st.miniImg.onload=req;st.miniImg.src='/map/preview.webp?v='+st.ver;
 try{const status=await (await fetch('/api/bake',{cache:'no-store'})).json();if(status.running){$('#bakeBtn').disabled=true;pollBake();}else if(status.code&&status.finishedAt){st.bakeError='The last ground rebuild failed';req();}}catch{}
 st.ready=true;document.body.removeAttribute('aria-busy');nightPanel();
}
function sprite(id){let im=spriteImg.get(id);if(!im){im=new Image();im.onload=()=>{
  if(spriteImg.get(id)!==im)return;const p=st.items.get(id).fence;
  if(p){const canvas=new OffscreenCanvas(p.canvasW,p.canvasH);paintFence(canvas.getContext('2d'),im,p);canvas.complete=true;canvas.naturalWidth=canvas.width;canvas.naturalHeight=canvas.height;spriteImg.set(id,canvas);}req();
 };im.src='/library/'+st.items.get(id).file+'?v='+(st.libraryVer||st.ver);spriteImg.set(id,im);}return im;}
function tile(L,x,y){const k=L+'/'+x+'_'+y;let t=tiles.get(k);if(!t){t={img:new Image(),ok:false,used:0};t.img.onload=()=>{t.ok=true;req();};t.img.onerror=()=>{t.bad=true;};t.img.src=`/map/tiles/${L}/${x}_${y}.webp?v=${st.ver}`;tiles.set(k,t);}t.used=performance.now();return t;}
function prune(){if(tiles.size<420)return;const arr=[...tiles.entries()].sort((a,b)=>a[1].used-b[1].used);for(const [k] of arr.slice(0,tiles.size-320))tiles.delete(k);}
// ---------------------------------------------------------------- palette
function buildPalette(){
 const cats=['Presets','All',...st.lib.categories];$('#cats').innerHTML='';
 for(const c of cats){const b=document.createElement('button');b.textContent=c==='Presets'?`★ Presets (${st.presets.length})`:c==='All'?`All (${st.lib.items.filter(i=>!i.hidden).length})`:`${c} (${st.lib.items.filter(i=>i.category===c&&!i.hidden).length})`;b.className=c===st.cat?'on':'';b.onclick=()=>{st.cat=c;buildPalette();};$('#cats').append(b);}
 const g0=$('#palette');if(st.cat==='Presets'){buildPresetPalette(g0);return;}
 const q=st.filter.toLowerCase(),list=st.lib.items.filter(i=>!i.hidden&&(st.cat==='All'||i.category===st.cat)&&(!q||(i.name+' '+i.id+' '+i.category+' '+(i.tags||[]).join(' ')).toLowerCase().includes(q)));
 const g=$('#palette');g.innerHTML='';
 for(const it of list){const d=document.createElement('div');d.className='tile'+(st.brush?.id===it.id?' on':'');d.title=`${it.name}\n${it.id}\n${it.fw}×${it.fh} tiles${it.flat?' · ground decal':''}\n${(it.tags||[]).join(' ').slice(0,180)}`;
  d.innerHTML=`<img loading="lazy" src="${thumbSrc(it)}" alt=""><span>${it.name}</span>`;fenceFallback(d.querySelector('img'),it);d.onclick=()=>pickBrush(it.id);g.append(d);}
}
function thumbSrc(it){return (it.fence?'/fence-render/'+encodeURIComponent(it.id)+'.png?r=2&v=':'/library/'+it.thumb+'?v=')+(st.libraryVer||st.ver);}
function fenceFallback(img,it){img.onerror=null;if(!it.fence)return;img.onerror=()=>{img.onerror=null;img.src='/library/'+it.thumb+'?v='+(st.libraryVer||st.ver);};}
const SIZE_KEY='mf-last-size';let lastSize={};try{lastSize=JSON.parse(localStorage.getItem(SIZE_KEY)||'{}');}catch{}
/** Remember the size an item was last placed or resized at, so picking it again starts at that size. */
function rememberSize(key,scale){if(!key||!Number.isFinite(scale))return;lastSize[key]=+(+scale).toFixed(3);try{localStorage.setItem(SIZE_KEY,JSON.stringify(lastSize));}catch{}}
function sizeFor(key){if(lastSize[key])return lastSize[key];const gs=st.items.get(key)?.guideScale;if(gs)return gs;const placed=st.sprites.filter(s=>s.id===key);return placed.length?(placed.at(-1).scale||1):1;}
function setBrushScaleUI(v){$('#bScale').value=v;$('#bScaleV').textContent=(+v).toFixed(2);}
function pickBrush(id){const it=st.items.get(id),sc=sizeFor(id);
 // ground paint dabs: lay them like a texture brush, evenly and without scatter, at the spacing they were made for
 if(it.paint){$('#bSpacing').value=it.paint.spacing;for(const k of ['#bJitter','#bVar'])if($(k))$(k).value=0;if($('#bRandFlip'))$('#bRandFlip').checked=it.paint.shape!=='tile';}setBrushScaleUI(sc);st.brush={id,preset:null,scale:sc,flip:$('#bFlip').checked};$('#brushThumb').src=thumbSrc(it);$('#brushName').textContent=it.name;
 fenceFallback($('#brushThumb'),it);
 if(it.fence){$('#bSpacing').value=it.fence.lengthM*st.brush.scale;$('#bJitter').value=0;$('#bVar').value=0;$('#bRandFlip').checked=false;}
 $('#brushMeta').textContent=`${it.category} · ${it.fw}×${it.fh} tiles${it.flat?' · decal':''}`;if(!+$('#bSpacing').value&&(/tree|bush|leaf|decal|pumpkin|grave|fence/i.test(id)))$('#bSpacing').value=/fence/.test(id)?2:/decal|leaf/.test(id)?3:6;
 setMode('paint');buildPalette();}
// ---------------------------------------------------------------- places (points of interest)
function buildPois(){const sel=$('#goPlace');if(!sel)return;const pois=st.plan.pois||[];sel.innerHTML='<option value="">Go to place…</option>'+pois.map((p,i)=>`<option value="${i}">${p.n?p.n+'. ':''}${p.name}</option>`).join('');
 sel.onchange=()=>{const p=pois[+sel.value];if(p)flyTo((p.x0+p.x1)/2,(p.y0+p.y1)/2,.9);sel.value='';sel.blur();};}
function flyTo(X,Y,z){const [mx,my]=w2m(X,Y);st.cam.x=mx;st.cam.y=my;if(z)st.cam.z=z;req();}
// ---------------------------------------------------------------- history & saving
/** History entries remember how much of the shared change log they already include ({j: json, n: log position}). */
const histEntry=()=>({j:JSON.stringify({s:st.sprites,p:st.plan}),n:st.histLog.length});
function snapshot(){st.undo.push(histEntry());if(st.undo.length>150)st.undo.shift();st.redo=[];}
function restore(entry){const legacy=typeof entry==='string',o=JSON.parse(legacy?entry:entry.j);
 for(const c of st.histLog.slice(legacy?st.histLog.length:entry.n)){if(c.kind==='plan')o.p=mergeTown('plan',c.before,c.after,o.p,true).value;else o.s=mergeTown('layout',c.before,c.after,{sprites:o.s},true).value.sprites;}st.sprites=o.s;const planChanged=JSON.stringify(st.plan)!==JSON.stringify(o.p);st.plan=o.p;st.sel.clear();st.selLot=null;st.selPave=null;st.paintLot=null;if(planChanged){st.planDirty=true;savePlan();}save();stats();inspector();groundPanel();req();}
function undo(){if(!st.undo.length)return;if(spot.owner)leaveOwnLights();st.redo.push(histEntry());restore(st.undo.pop());}
function redo(){if(!st.redo.length)return;if(spot.owner)leaveOwnLights();st.undo.push(histEntry());restore(st.redo.pop());}
let saveT=0,planT=0;
function save(msg){if(msg==='loaded'){setSave('saved','ok');return;}st.saved=false;setSave('saving…');clearTimeout(saveT);saveT=setTimeout(async()=>{
 try{const body=JSON.stringify({version:1,plan:'maple-falls.json',sprites:st.sprites});try{localStorage.setItem('mf-layout',body);}catch{}
  await town.save('layout');if(body===JSON.stringify({version:1,plan:'maple-falls.json',sprites:st.sprites})){st.saved=true;setSave('saved','ok');}else save();}catch(e){setSave('save failed — retrying','err');console.error(e);saveT=setTimeout(()=>save(),3000);}},900);}
let planSaveVersion=0;
// ---------------------------------------------------------------- night lighting (settings live in plan.night)
const makeCanvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;},nightScratch={};
let nightPreview=true;try{nightPreview=localStorage.getItem('mf-night-preview')!=='0';}catch{}
const nightOn=()=>(nightPreview||st.mode==='walk')&&!!st.plan;
function drawNight(cw,ch,z,tx,ty,x0,y0,x1,y1){
 const night=nightSettings(st.plan),lights=[],k=S()*Math.SQRT2*z*dpr;
 for(const s of st.sprites){const it=st.items.get(s.id);if(!it)continue;
  if(it.glows){const q=rect(s);if(!(q.left>x1+50||q.top>y1+50||q.left+q.w<x0-50||q.top+q.h<y0-50))for(const g of spriteGlows(s,it,night,q.left,q.top,q.w))lights.push({sx:(g.x*z+tx)*dpr,sy:(g.y*z+ty)*dpr,rx:g.r*z*dpr,ry:g.r*z*dpr,i:night.glowStrength});}
  const own=s===spot.owner?spot.ownerList:ownLights(s);if(own){for(const l of own)pushSpot(l);continue;}
  const t=s.light!=null||lightType(s.id);if(!t)continue;
  for(const l of spriteLights(s,it,night)){const [mx,my]=w2m(l.x,l.y);if(mx<x0-400||mx>x1+400||my<y0-300||my>y1+300)continue;lights.push({sx:(mx*z+tx)*dpr,sy:(my*z+ty)*dpr,rx:l.r*k,ry:l.r*k/2,i:l.i});}}
 for(const l of spotLights())pushSpot(l);
 function pushSpot(l){const tint=l.color||null;
  const soft=l.soft??night.feather;// the light's own edge (hard 0 .. soft 1), or the town's
  if(l.shape==='rect'){const pts=spotPts(l),quad=pts.map(([X,Y])=>{const [mx,my]=w2m(X,Y);return [(mx*z+tx)*dpr,(my*z+ty)*dpr];});lights.push({quad,blur:soft*spotInner(pts)*k*.5,i:l.i,tint});return;}
  const [mx,my]=w2m(l.x,l.y);lights.push({sx:(mx*z+tx)*dpr,sy:(my*z+ty)*dpr,rx:l.r*k,ry:l.r*k/2,i:l.i,tint,feather:l.soft});}
 // the kid's torch, as the game lights it (night.torch metres round the feet)
 if(st.mode==='walk'&&night.torch>0){const [mx,my]=w2m(walk.x,walk.y);lights.push({sx:(mx*z+tx)*dpr,sy:(my*z+ty)*dpr,rx:night.torch*k,ry:night.torch*k/2,i:1,torch:true});}
 ctx.save();ctx.setTransform(1,0,0,1,0,0);applyNight(ctx,night,lights,nightScratch,makeCanvas);ctx.restore();
 ctx.setTransform(z*dpr,0,0,z*dpr,tx*dpr,ty*dpr);}
let nightT=0;
function setNight(change){st.plan.night={...nightSettings(st.plan),...change};req();clearTimeout(nightT);nightT=setTimeout(()=>town.save('plan').catch(e=>toast('Night settings could not save: '+e.message)),500);}
function nightPanel(){const body=$('#nightBody');if(!body||body.contains(document.activeElement))return;const n=nightSettings(st.plan);
 const row=(label,key,min,max,step,val,fmt=v=>(+v).toFixed(2))=>`<label class="nrow">${label}<input type="range" data-n="${key}" min="${min}" max="${max}" step="${step}" value="${val}"><span>${fmt(val)}</span></label>`;
 body.innerHTML=`<label><input type="checkbox" id="nPreview" ${nightPreview?'checked':''}> Show night on the map <kbd>N</kbd></label>
  <label class="nrow">Moonlight colour <input type="color" data-n="tint" value="${n.tint}"></label>
  ${row('Moonlight strength','strength',0,1,.01,n.strength)}${row('Wash out colour','desat',0,1,.01,n.desat)}${row('Darken','dark',0,.8,.01,n.dark)}
  ${row('Light softness','feather',.05,1,.01,n.feather)}${row('Lit windows size','glowSize',0,5,.05,n.glowSize)}${row('Lit windows strength','glowStrength',0,1,.01,n.glowStrength)}${row('Warm glow','warmth',0,1,.01,n.warmth)}${row('Player torch (m)','torch',0,16,.5,n.torch,v=>(+v).toFixed(1))}
  <h4>Lights by kind</h4>${LIGHT_TYPES.map(t=>`<div class="ntype"><b>${t.label}</b>${row('Radius (m)','types.'+t.key+'.r',0,18,.25,n.types[t.key].r,v=>(+v).toFixed(2))}${row('Strength','types.'+t.key+'.i',0,1,.01,n.types[t.key].i)}</div>`).join('')}
  <h4>Selected objects</h4><p class="muted">Give the selected objects their own light (any object can glow), or none.</p>
  <label class="nrow">Light radius (m) <input type="number" id="nSelR" min="0" max="30" step="0.5" placeholder="default"></label>
  <div class="btns"><button id="nSelApply">Apply to selection</button><button id="nSelOff">No light</button><button id="nSelReset">Default</button></div>
  <button id="nReset">Reset night to defaults</button>`;
 $('#nPreview').onchange=e=>{nightPreview=e.target.checked;try{localStorage.setItem('mf-night-preview',nightPreview?'1':'0');}catch{}req();};
 for(const el of body.querySelectorAll('[data-n]')){el.oninput=()=>{const key=el.dataset.n,v=el.type==='color'?el.value:+el.value;if(el.nextElementSibling?.tagName==='SPAN')el.nextElementSibling.textContent=(el.step>=.25&&el.step<1?(+v).toFixed(2):(+v).toFixed(el.step<.1?2:1));
  if(key.startsWith('types.')){const [,t,f]=key.split('.'),cur=nightSettings(st.plan);setNight({types:{...cur.types,[t]:{...cur.types[t],[f]:v}}});}else setNight({[key]:v});};}
 const sel=v=>{const list=st.sprites.filter(s=>st.sel.has(s.uid));if(!list.length){toast('Select objects first (Select / edit, then click them).');return;}snapshot();for(const s of list){if(v===undefined)delete s.light;else s.light=v;}save();req();toast(list.length+' object'+(list.length>1?'s':'')+' updated.');};
 $('#nSelApply').onclick=()=>{const v=$('#nSelR').value;sel(v===''?undefined:+v);};$('#nSelOff').onclick=()=>sel(0);$('#nSelReset').onclick=()=>sel(undefined);
 $('#nReset').onclick=()=>{st.plan.night=structuredClone(NIGHT_DEFAULT);req();town.save('plan').catch(()=>{});nightPanel();};}
// ---------------------------------------------------------------- walk as the kid · light spots
// Walk (T): the game's kid walks the map at game speed with WASD / arrows, the camera follows at the zoom the game would
// use for this window, the night is always on and the kid carries the game's torch: the town as the game shows it.
// Light spots (Y): bare lights with no object under them, kept in plan.lightSpots ({x,y,r,i,type}, metres) and exported
// to the game with every other night light (export-game.mjs).
const KID_SPEED=6.8;// m/s: the game's 3.4 tiles a second at 2 m a tile
const KIDS=['tommy','jess','sam'];
const walk={x:0,y:0,face:'front',flip:false,keys:new Set(),last:0,saved:null,kid:'tommy',ghost:false,moving:false};
const kidSprite=()=>({id:`kid:${walk.kid}-${walk.face}`,x:walk.x,y:walk.y,flip:walk.flip,scale:1,kid:true});
/** the game's zoom for a window this size (render.ts: clamp(min(vw/1500,vh/860),.62,1.35), x0.8 in the painted town),
 *  in builder units: a game world pixel is S()/45.25 map pixels (45.25 px a metre along the iso axis in the game) */
function gameZoom(){const g=Math.min(1.35,Math.max(.62,Math.min(view.clientWidth/1500,view.clientHeight/860)))*.8;return g*45.25/S();}
/** solid ground under (X,Y): any upright object's footprint, the same box the Select tool outlines (Alt walks through) */
function walkBlocked(X,Y){if(walk.ghost)return false;const r=.25;
 for(const o of st.sprites){const it=st.items.get(o.id);if(!it||it.flat||it.hidden)continue;const b=it.base||{hx:it.fw||0,hy:it.fh||0,dx:0,dy:0},k=o.scale||1;let hw=b.hx*k,hh=b.hy*k,ox=(b.dx||0)*k,oy=(b.dy||0)*k;if(o.flip){[hw,hh]=[hh,hw];[ox,oy]=[oy,ox];}
  if(!(hw>.05&&hh>.05))continue;const cx=o.x+ox,cy=o.y+oy;
  if(b.shape==='ellipse'){const u=(X-cx)/(hw+r),v=(Y-cy)/(hh+r);if(u*u+v*v<1)return true;}else if(Math.abs(X-cx)<hw+r&&Math.abs(Y-cy)<hh+r)return true;}
 return false;}
/** the free ground nearest (X,Y), searched in rings half a metre apart */
function freeNear(X,Y){if(!walkBlocked(X,Y))return [X,Y];for(let r=.5;r<=30;r+=.5)for(let a=0;a<16;a++){const x=X+Math.cos(a/16*6.283)*r,y=Y+Math.sin(a/16*6.283)*r;if(!walkBlocked(x,y))return [x,y];}return [X,Y];}
function walkEnter(){// back where the kid stopped if the view has not moved since; else on free ground at the middle of the view
 const same=walk.leftCam&&walk.leftCam.x===st.cam.x&&walk.leftCam.y===st.cam.y;if(!same){const [X,Y]=freeNear(...m2w(st.cam.x,st.cam.y));walk.x=X;walk.y=Y;}walk.keys.clear();walk.last=0;walk.saved={cam:{...st.cam},show:{...st.show}};
 st.show.grid=false;st.show.poi=false;st.show.plan=false;document.body.classList.add('walking');requestAnimationFrame(walkStep);}
function walkExit(){if(!walk.saved)return;// the view stays where the kid stood (walk to a dark corner, Esc, Y, click a light there)
 Object.assign(st.show,walk.saved.show);walk.leftCam={x:st.cam.x,y:st.cam.y};walk.saved=null;walk.keys.clear();document.body.classList.remove('walking');req();}
function walkStep(t){if(st.mode!=='walk')return;const dt=walk.last?Math.min(.05,(t-walk.last)/1000):0;walk.last=t;const k=walk.keys;
 let dx=0,dy=0;if(k.has('a')||k.has('arrowleft'))dx--;if(k.has('d')||k.has('arrowright'))dx++;if(k.has('w')||k.has('arrowup'))dy--;if(k.has('s')||k.has('arrowdown'))dy++;
 walk.moving=!!(dx||dy);
 if(walk.moving){// the game's screenDirToWorld: screen direction to a unit world direction
  let X=dx+2*dy,Y=2*dy-dx;const l=Math.hypot(X,Y)||1,step=KID_SPEED*(k.has('shift')?2:1)*dt;X=X/l*step;Y=Y/l*step;
  if(walkBlocked(walk.x,walk.y)||!walkBlocked(walk.x+X,walk.y+Y)){walk.x+=X;walk.y+=Y;}// already inside something (a moved object): walk out freelyelse if(!walkBlocked(walk.x+X,walk.y))walk.x+=X;else if(!walkBlocked(walk.x,walk.y+Y))walk.y+=Y;
  if(dy)walk.face=dy>0?'front':'back';if(dx)walk.flip=dx<0;}
 const [mx,my]=w2m(walk.x,walk.y);st.cam.z=gameZoom();st.cam.x=mx;st.cam.y=my-40*S()/45.25;// the game frames the kid a little low (isoY - 40)
 req();requestAnimationFrame(walkStep);}
function walkKey(e,down){const k=e.key.toLowerCase();
 if(down&&(k==='escape'||k==='t')&&!e.ctrlKey){setMode('select');return true;}
 if(down&&k==='c'&&!e.ctrlKey&&!e.metaKey){walk.kid=KIDS[(KIDS.indexOf(walk.kid)+1)%KIDS.length];req();return true;}
 if(k==='alt'){walk.ghost=down;e.preventDefault();return true;}
 if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift'].includes(k)){if(down)walk.keys.add(k);else walk.keys.delete(k);e.preventDefault();return true;}
 return false;}
/** is the sprite drawn at q actually painted (not transparent) at map point (x,y)? alpha read once per image, 1/4 size */
const alphaCache=new Map();
function opaqueAt(o,q,x,y){const im=sprite(o.id);if(!im.complete||!im.naturalWidth)return true;let a=alphaCache.get(o.id);
 if(!a){const w=Math.max(1,im.naturalWidth>>2),h=Math.max(1,im.naturalHeight>>2),c=makeCanvas(w,h),g=c.getContext('2d',{willReadFrequently:true});g.drawImage(im,0,0,w,h);a={w,h,d:g.getImageData(0,0,w,h).data};alphaCache.set(o.id,a);}
 let u=(x-q.left)/q.w;if(o.flip)u=1-u;const v=(y-q.top)/q.h,px=Math.min(a.w-1,Math.max(0,Math.floor(u*a.w))),py=Math.min(a.h-1,Math.max(0,Math.floor(v*a.h)));return a.d[(py*a.w+px)*4+3]>96;}
/** the game's see-through kid: a pale blue silhouette drawn over whatever stands in front of it (render.ts heroSil) */
const silCache=new Map();
function drawKidSilhouette(){const kd=kidSprite(),it=st.items.get(kd.id),im=sprite(kd.id);if(!it||!im.complete||!im.naturalWidth)return;
 let c=silCache.get(kd.id);if(!c){c=makeCanvas(im.naturalWidth,im.naturalHeight);const g=c.getContext('2d');g.drawImage(im,0,0);g.globalCompositeOperation='source-in';g.fillStyle='#7fd8ff';g.fillRect(0,0,c.width,c.height);silCache.set(kd.id,c);}
 const r=rect(kd);ctx.save();ctx.globalAlpha=.42;if(kd.flip){ctx.translate(r.mx,0);ctx.scale(-1,1);ctx.drawImage(c,-it.ax,r.top,r.w,r.h);}else ctx.drawImage(c,r.left,r.top,r.w,r.h);ctx.restore();}
// light spots
const spots=()=>spot.owner?spot.ownerList:(st.plan.lightSpots??=[]);
const setSpots=list=>{if(spot.owner)spot.ownerList=list;else st.plan.lightSpots=list;};
/** Edit a placed object's own lights with the Light spots tools: its custom ones, or its type's defaults to start from */
function editOwnLights(s){const it=st.items.get(s.id);if(!it)return;const night=nightSettings(st.plan);
 const list=ownLights(s)??spriteLights(s,it,night).map(l=>({x:+l.x.toFixed(2),y:+l.y.toFixed(2),r:l.r,i:l.i,type:l.type==='neon'?'neon':['fire','pumpkin','lantern'].includes(l.type)?'fire':'warm'}));
 setMode('spots');spot.owner=s;spot.ownerList=list;spot.sel=null;const [mx,my]=w2m(s.x,s.y);st.cam.x=mx;st.cam.y=my;st.cam.z=Math.max(st.cam.z,.5);spotsPanel();updateTask();req();}
function leaveOwnLights(){const s=spot.owner;spot.owner=null;spot.ownerList=null;spot.sel=null;if(s&&st.sprites.includes(s)){setMode('select');st.sel=new Set([s.uid]);inspector();}else spotsPanel();req();}
const spot={sel:null,r:5,i:.9,type:'warm',shape:'round',w:6,h:4,rot:0,color:''};
/** the colour each kind shows in the game when no custom colour is picked */
const SPOT_COLORS={warm:'#ffbe5c',fire:'#ff8a2a',neon:'#ff7ad9',cold:'#dff2ff'};
/** a four-sided spot's corners in world metres: its own free corners (pts), or the square its w/h/rot describe */
const spotPts=o=>o.pts||spotCorners(o);
/** how far in from its sides a four-sided spot reaches (half its narrowest width), for the soft edge */
function spotInner(q){let m=Infinity;for(let k=0;k<4;k++){const a=q[k],b=q[(k+1)%4],ex=b[0]-a[0],ey=b[1]-a[1],l=Math.hypot(ex,ey)||1;let far=0;for(const p of q)far=Math.max(far,Math.abs((p[0]-a[0])*ey-(p[1]-a[1])*ex)/l);m=Math.min(m,far/2);}return Math.max(.25,m);}
/** give a square spot free corners (once), then keep x,y (the centre) and r (reach, for the export) in step with them */
function spotFree(o){if(!o.pts){o.pts=spotCorners(o).map(([x,y])=>[+x.toFixed(2),+y.toFixed(2)]);delete o.w;delete o.h;delete o.rot;}spotSync(o);}
function spotSync(o){const q=o.pts;o.x=+(q.reduce((a,p)=>a+p[0],0)/4).toFixed(2);o.y=+(q.reduce((a,p)=>a+p[1],0)/4).toFixed(2);o.r=+Math.max(...q.map(p=>Math.hypot(p[0]-o.x,p[1]-o.y))).toFixed(2);}
/** handles in world metres: 4 corners (each moves on its own, so any four-sided shape), 4 edge middles (move that side)
 *  and the turn knob, out past the middle of the first side */
function spotHandles(o){const q=spotPts(o),out=[];const cx=q.reduce((a,p)=>a+p[0],0)/4,cy=q.reduce((a,p)=>a+p[1],0)/4;
 q.forEach((p,k)=>out.push({corner:k,p}));q.forEach((p,k)=>{const n=q[(k+1)%4];out.push({edge:k,p:[(p[0]+n[0])/2,(p[1]+n[1])/2]});});
 const m=out[4].p,dx=m[0]-cx,dy=m[1]-cy,l=Math.hypot(dx,dy)||1;out.push({rot:true,p:[m[0]+dx/l*1.6,m[1]+dy/l*1.6]});return out;}
function spotHandleAt(mx,my){const o=spot.sel;if(!o||o.shape!=='rect')return null;const tol=10/st.cam.z;
 for(const hd of spotHandles(o)){const [hx,hy]=w2m(...hd.p);if(Math.abs(hx-mx)<tol&&Math.abs(hy-my)<tol)return hd;}return null;}
/** drag a handle: a corner goes where the mouse is, a side moves with it, the knob turns the shape round its centre */
function spotHandleDrag(d,X,Y,snapAngle,free){const o=d.o,hd=d.h;spotFree(o);if(!d.base)d.base={pts:o.pts.map(p=>[...p]),X,Y,cx:o.x,cy:o.y};const b=d.base;
 const snap=v=>free?+v.toFixed(2):Math.round(v*4)/4;
 if(hd.rot){let a=Math.atan2(Y-b.cy,X-b.cx)-Math.atan2(b.Y-b.cy,b.X-b.cx);if(snapAngle)a=Math.round(a/(Math.PI/12))*(Math.PI/12);const c=Math.cos(a),sn=Math.sin(a);
  o.pts=b.pts.map(([x,y])=>{const u=x-b.cx,v=y-b.cy;return [+(b.cx+u*c-v*sn).toFixed(2),+(b.cy+u*sn+v*c).toFixed(2)];});}
 else if(hd.corner!=null)o.pts[hd.corner]=[snap(X),snap(Y)];
 else{const dx=snap(X-b.X),dy=snap(Y-b.Y);for(const k of [hd.edge,(hd.edge+1)%4])o.pts[k]=[+(b.pts[k][0]+dx).toFixed(2),+(b.pts[k][1]+dy).toFixed(2)];}
 spotSync(o);}
const SPOT_TYPES={warm:'Warm light',fire:'Fire / candle (flickers in game)',neon:'Neon (pink in game)',cold:'Cold white'};
let spotT=0;
function saveSpots(){if(spot.owner){spot.owner.lights=toOwnLights(spot.owner,spot.ownerList);save();return;}clearTimeout(spotT);spotT=setTimeout(()=>town.save('plan').catch(e=>toast('Light spots could not save: '+e.message)),400);}
function spotAt(X,Y){let best=null,bd=Math.max(1.6,16/(S()*st.cam.z));for(const o of spots()){const d=Math.hypot(o.x-X,o.y-Y);if(d<bd){bd=d;best=o;}}return best;}
const spotLabel=(x,n)=>`<span class="dot ${x.type||'warm'}" style="${x.color?'background:'+x.color:''}"></span>Spot ${n+1} · ${x.shape==='rect'?(x.pts?'free shape':`${(+x.w).toFixed(1)}×${(+x.h).toFixed(1)} m square`):`${(+x.r).toFixed(1)} m`} · ${SPOT_TYPES[x.type||'warm'].split(' ')[0]}`;
function spotsPanel(){const p=$('#spotsPanel');if(!p)return;p.hidden=st.mode!=='spots';if(p.hidden)return;const b=$('#spotsBody');const o=spot.sel;
 // keep a slider being dragged alive, but only while it still belongs to the selected light: picking another light (or
 // another object's lights) always rebuilds the panel for it, or the controls would keep editing the previous one
 if(b.contains(document.activeElement)&&spot.panelFor===o&&spot.panelOwner===spot.owner)return;if(b.contains(document.activeElement))document.activeElement.blur();
 spot.panelFor=o;spot.panelOwner=spot.owner;
 const own=spot.owner,ownIt=own&&st.items.get(own.id);
 const v=o||spot;b.innerHTML=`${own?`<div class="own-lights"><b>Lights of ${ownIt?.name||'this object'}</b><p class="muted">${own.lights?'Its own lights':'Its default lights'}: edit, add (click the map) or remove them. They move, scale and mirror with it.</p><p class="muted"><b>${spots().length}</b> light pool${spots().length===1?'':'s'} (the yellow markers)${ownIt?.glows?` and <b>${ownIt.glows.length}</b> glow${ownIt.glows.length===1?'':'s'} painted in its art (the numbered rings)`:''}.</p>
  ${ownIt?.glows?`<div class="glow-list"><b>Painted glows</b> <span class="muted">lit windows, carved faces</span>${ownIt.glows.map((g,n)=>`<label><input type="checkbox" data-glow="${n}" ${glowOff(own,n)?'':'checked'}> Glow ${n+1}</label>`).join('')}
   <div class="btns"><button id="spGlowsOff">All glows off</button><button id="spGlowsOn">All on</button></div></div>`:''}
  <div class="btns"><button id="spAllOff" ${spots().length||ownIt?.glows&&ownIt.glows.some((g,n)=>!glowOff(own,n))?'':'disabled'}>Remove all its lights</button></div>
  <div class="btns"><button id="spOwnDone">Done</button><button id="spOwnReset" ${own.lights||own.glow===false||own.glowsOff?.length?'':'disabled'}>Back to its default lights</button></div></div>`:''}<p class="muted">${o?'Editing the selected light spot.':'Click the map to place a light spot. Click a spot to select it, drag to move it, Shift-click or Delete to remove it.'}</p>
  <label class="nrow">Shape <select id="spShape"><option value="round" ${v.shape!=='rect'?'selected':''}>Round</option><option value="rect" ${v.shape==='rect'?'selected':''}>Square</option></select></label>
  ${v.shape==='rect'&&v.pts?`<p class="muted">Drag any corner anywhere for any four-sided shape, a side's middle handle to move that side, the round knob to turn it (Shift snaps to 15°, Alt drags without the ¼ m snap).</p><div class="btns"><button id="spSquare">Make it a square again</button></div>`:v.shape==='rect'?`<label class="nrow">Width (m) <input type="range" id="spW" min="0.5" max="40" step="0.25" value="${v.w}"><span>${(+v.w).toFixed(2)}</span></label>
  <label class="nrow">Depth (m) <input type="range" id="spH" min="0.5" max="40" step="0.25" value="${v.h}"><span>${(+v.h).toFixed(2)}</span></label>
  <label class="nrow">Turn (°) <input type="range" id="spRot" min="-180" max="180" step="1" value="${v.rot||0}"><span>${Math.round(v.rot||0)}</span></label>
  <p class="muted">${o?'Drag a corner anywhere for any four-sided shape, a side\u2019s middle to move that side, the round knob to turn (Shift snaps to 15°).':'Click the map to place it, then drag its handles into any shape.'}</p>`:`<label class="nrow">Radius (m) <input type="range" id="spR" min="1" max="20" step="0.25" value="${v.r}"><span>${(+v.r).toFixed(2)}</span></label>`}
  <label class="nrow">Colour <input type="color" id="spColor" value="${v.color||SPOT_COLORS[v.type||'warm']}"><span>${v.color?'custom':'kind'}</span></label>${v.color?'<button id="spColorReset" class="small">Use the kind&#39;s colour</button>':''}
  <label class="nrow">Intensity <input type="range" id="spI" min="0.1" max="1" step="0.01" value="${v.i}"><span>${(+v.i).toFixed(2)}</span></label>
  <label class="nrow" title="How the light's edge fades out: hard (a crisp pool) to soft (a wide gentle fall-off)">Edge <input type="range" id="spSoft" min="0.02" max="0.98" step="0.01" value="${v.soft??nightSettings(st.plan).feather}"><span>${v.soft==null?'town':(+v.soft).toFixed(2)}</span></label>
  <div class="btns soft-btns"><button id="spHard" title="Harden the edge">Harden</button><button id="spSoften" title="Soften the edge">Soften</button>${v.soft!=null?'<button id="spSoftReset" title="Use the night settings&#39; light softness">Town edge</button>':''}</div>
  <label class="nrow">Kind <select id="spType">${Object.entries(SPOT_TYPES).map(([k,l])=>`<option value="${k}" ${v.type===k?'selected':''}>${l}</option>`).join('')}</select></label>
  ${o?'<div class="btns"><button id="spDel">Delete spot</button><button id="spDone">Done</button></div>':''}<p class="muted">${spots().length} light${own?'':' spot'}${spots().length===1?'':'s'} ${own?'on it':'on the map'}. Walk the kid (<kbd>T</kbd>) to see them as in the game.</p>
  ${spots().length?`<div class="spot-list">${spots().map((x,n)=>`<button data-spot="${n}" class="${x===o?'on':''}">${spotLabel(x,n)}</button>`).join('')}</div>`:''}`;
 if(own){const glows=ownIt?.glows||[],setOff=list=>{delete own.glow;if(own.light===0)delete own.light;if(list.length)own.glowsOff=list;else delete own.glowsOff;};
  for(const el of b.querySelectorAll('[data-glow]'))el.onchange=e=>{e.target.blur();snapshot();const n=+el.dataset.glow,off=new Set(glows.map((g,i)=>i).filter(i=>glowOff(own,i)));if(el.checked)off.delete(n);else off.add(n);setOff([...off].sort((a,b)=>a-b));save();spotsPanel();req();};
  if($('#spGlowsOff'))$('#spGlowsOff').onclick=e=>{e.target.blur();snapshot();setOff(glows.map((g,i)=>i));save();spotsPanel();req();};
  if($('#spGlowsOn'))$('#spGlowsOn').onclick=e=>{e.target.blur();snapshot();setOff([]);save();spotsPanel();req();};
  $('#spAllOff').onclick=e=>{e.target.blur();snapshot();spot.ownerList=[];spot.sel=null;own.lights=[];setOff(glows.map((g,i)=>i));save();spotsPanel();req();};
  $('#spOwnDone').onclick=e=>{e.target.blur();leaveOwnLights();};$('#spOwnReset').onclick=e=>{e.target.blur();snapshot();delete own.lights;delete own.glow;delete own.glowsOff;save();const s=own;spot.owner=null;editOwnLights(s);};}
 for(const el of b.querySelectorAll('[data-spot]'))el.onclick=()=>{el.blur();const x=spots()[+el.dataset.spot];if(!x)return;spot.sel=x;const [mx,my]=w2m(x.x,x.y);st.cam.x=mx;st.cam.y=my;st.cam.z=Math.max(st.cam.z,.35);spotsPanel();updateTask();req();};
 const set=(key,val)=>{if(o){if(!spot.dragSnap){snapshot();spot.dragSnap=true;}o[key]=val;saveSpots();const li=b.querySelector('[data-spot].on');if(li)li.innerHTML=spotLabel(o,+li.dataset.spot);}else spot[key]=val;req();};
 const slide=(id,key,fmt=x=>(+x).toFixed(2))=>{const el=$(id);if(el)el.oninput=e=>{e.target.nextElementSibling.textContent=fmt(e.target.value);set(key,+e.target.value);};};
 slide('#spR','r');slide('#spW','w');slide('#spH','h');slide('#spRot','rot',x=>Math.round(x));slide('#spSoft','soft');
 const nudgeSoft=d=>{const cur=v.soft??nightSettings(st.plan).feather,next=+Math.min(.98,Math.max(.02,cur+d)).toFixed(2);set('soft',next);spot.dragSnap=false;spotsPanel();};
 $('#spHard').onclick=e=>{e.target.blur();nudgeSoft(-.15);};$('#spSoften').onclick=e=>{e.target.blur();nudgeSoft(.15);};
 if($('#spSoftReset'))$('#spSoftReset').onclick=e=>{e.target.blur();set('soft',null);if(o)delete o.soft;else delete spot.soft;spot.dragSnap=false;spotsPanel();};
 if($('#spSquare'))$('#spSquare').onclick=e=>{e.target.blur();const q=o.pts,len=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);snapshot();
  o.w=+((len(q[0],q[1])+len(q[2],q[3]))/2).toFixed(2);o.h=+((len(q[1],q[2])+len(q[3],q[0]))/2).toFixed(2);o.rot=+(Math.atan2(q[1][1]-q[0][1],q[1][0]-q[0][0])*180/Math.PI).toFixed(1);delete o.pts;saveSpots();spotsPanel();req();};
 $('#spShape').onchange=e=>{set('shape',e.target.value);if(o&&e.target.value==='rect'&&!o.w&&!o.pts){o.w=Math.max(1,o.r*1.4);o.h=Math.max(1,o.r);o.rot=0;}if(o&&e.target.value!=='rect')delete o.pts;e.target.blur();spotsPanel();};
 $('#spColor').oninput=e=>{set('color',e.target.value);e.target.nextElementSibling.textContent='custom';};
 $('#spColor').onchange=e=>{e.target.blur();spot.dragSnap=false;spotsPanel();};
 if($('#spColorReset'))$('#spColorReset').onclick=e=>{e.target.blur();set('color','');if(o)delete o.color;spotsPanel();};
 $('#spI').oninput=e=>{e.target.nextElementSibling.textContent=(+e.target.value).toFixed(2);set('i',+e.target.value);};
 $('#spType').onchange=e=>set('type',e.target.value);
 for(const el of [$('#spR'),$('#spW'),$('#spH'),$('#spRot'),$('#spI'),$('#spType'),$('#spColor'),$('#spSoft')])el?.addEventListener('change',()=>{spot.dragSnap=false;});
 if(o){$('#spDel').onclick=e=>{e.target.blur();snapshot();setSpots(spots().filter(x=>x!==o));spot.sel=null;saveSpots();spotsPanel();req();};$('#spDone').onclick=e=>{e.target.blur();spot.sel=null;spotsPanel();req();};}}
/** Ctrl+C copies the selected light spot, Ctrl+V pastes it at the mouse (as often as you like), Ctrl+D duplicates it
 *  a metre along; works between the town's spots and any object's own lights */
function spotClipKey(k){
 if(k==='c'){if(!spot.sel){toast('Select a light spot to copy.');return;}st.spotClip=structuredClone(spot.sel);toast('Light spot copied: Ctrl+V pastes it at the mouse.');return;}
 const src=k==='d'?spot.sel:st.spotClip;if(!src){toast(k==='d'?'Select a light spot to duplicate.':'Copy a light spot first (select it, Ctrl+C).');return;}
 const [X,Y]=k==='d'?[src.x+1,src.y+1]:m2w(st.mouse.mx,st.mouse.my),dx=X-src.x,dy=Y-src.y,n=structuredClone(src);
 n.x=+(src.x+dx).toFixed(2);n.y=+(src.y+dy).toFixed(2);if(n.pts)n.pts=n.pts.map(([x,y])=>[+(x+dx).toFixed(2),+(y+dy).toFixed(2)]);
 snapshot();spots().push(n);spot.sel=n;saveSpots();spotsPanel();updateTask();req();}
function spotDown(X,Y,e){const hd=spotHandleAt(...w2m(X,Y));if(hd){st.drag={kind:'spotHandle',o:spot.sel,h:hd,moved:false};return;}const o=spotAt(X,Y);
 if(o&&e.shiftKey){snapshot();setSpots(spots().filter(x=>x!==o));if(spot.sel===o)spot.sel=null;saveSpots();spotsPanel();req();return;}
 if(o){spot.sel=o;st.drag={kind:'spot',o,start:[X,Y],moved:false};spotsPanel();updateTask();req();return;}
 snapshot();const n={x:+X.toFixed(2),y:+Y.toFixed(2),r:spot.r,i:spot.i,type:spot.type};if(spot.soft!=null)n.soft=spot.soft;if(spot.shape==='rect')Object.assign(n,{shape:'rect',w:spot.w,h:spot.h,rot:spot.rot||0});if(spot.color)n.color=spot.color;spots().push(n);spot.sel=n;saveSpots();spotsPanel();req();}
function spotLights(){return st.plan?.lightSpots||[];}
function drawSpotMarkers(z){if(st.mode!=='spots')return;
 const own=spot.owner,oit=own&&st.items.get(own.id);
 if(oit?.glows){const q=rect(own),night=nightSettings(st.plan);
  for(const g of spriteGlows(own,oit,night,q.left,q.top,q.w,true)){const off=glowOff(own,g.n),r=Math.max(g.r/Math.max(.5,night.glowSize),8/z);
   ctx.save();ctx.setLineDash(off?[3/z,4/z]:[]);ctx.strokeStyle=off?'#8a8f99':'#7fe6ff';ctx.lineWidth=2/z;ctx.beginPath();ctx.arc(g.x,g.y,r,0,7);ctx.stroke();ctx.setLineDash([]);
   ctx.font=`700 ${12/z}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=3/z;ctx.strokeStyle='#000';ctx.fillStyle=off?'#8a8f99':'#7fe6ff';ctx.strokeText(String(g.n+1),g.x,g.y);ctx.fillText(String(g.n+1),g.x,g.y);ctx.restore();}}
 for(const o of spots()){const [mx,my]=w2m(o.x,o.y),k=S()*Math.SQRT2,sel=o===spot.sel;
  ctx.save();ctx.setLineDash([6/z,5/z]);ctx.strokeStyle=sel?'#ffe08a':'#ffe08a88';ctx.lineWidth=(sel?2:1.2)/z;ctx.beginPath();
  if(o.shape==='rect'){const q=spotPts(o).map(p=>w2m(...p));ctx.moveTo(...q[0]);for(const p of q.slice(1))ctx.lineTo(...p);ctx.closePath();}else ctx.ellipse(mx,my,o.r*k,o.r*k/2,0,0,7);
  ctx.stroke();ctx.setLineDash([]);
  if(sel&&o.shape==='rect'){const hs=spotHandles(o),top=hs.find(h=>h.edge===0),knob=hs.find(h=>h.rot);ctx.strokeStyle='#ffe08a';ctx.lineWidth=1.5/z;ctx.beginPath();ctx.moveTo(...w2m(...top.p));ctx.lineTo(...w2m(...knob.p));ctx.stroke();
   for(const h of hs){const [hx,hy]=w2m(...h.p),r=6/z;ctx.fillStyle=h.rot?'#5fd1ff':h.edge!=null?'#ffe08a99':'#ffe08a';ctx.strokeStyle='#000';ctx.lineWidth=1.2/z;ctx.beginPath();if(h.rot)ctx.arc(hx,hy,r,0,7);else if(h.edge!=null)ctx.rect(hx-r*.7,hy-r*.7,1.4*r,1.4*r);else ctx.rect(hx-r,hy-r,2*r,2*r);ctx.fill();ctx.stroke();}}
  ctx.fillStyle=o.color||SPOT_COLORS[o.type||'warm'];ctx.strokeStyle='#000';ctx.lineWidth=1.5/z;ctx.beginPath();ctx.arc(mx,my,(sel?9:7)/z,0,7);ctx.fill();ctx.stroke();if(sel){ctx.strokeStyle='#fff';ctx.lineWidth=2/z;ctx.beginPath();ctx.arc(mx,my,14/z,0,7);ctx.stroke();}ctx.restore();}}
// ---------------------------------------------------------------- Light glow: edit glows, live preview
// Light glow (L) has two tools: Paint (click/drag to add glows, Shift to erase) and Edit (click a glow to select it,
// drag to move; strength, size, colour, direction and curb snap in the panel; Del, Ctrl+C/V/D). Every change can be
// previewed live: the server renders just the changed patch of ground with the Rebuild ground code
// (/api/ground-preview) and the builder lays it over the map until the next Rebuild ground.
const GLOW_REACH=11;// metres round a glow its light can reach (the painted streak and the pavement spill)
const GLOW_AMBER='#ffb04a';// shown in the colour picker for a glow with no colour (the painted amber)
const glows=()=>st.plan.reflections??=[];
st.glowTool='paint';st.selGlow=null;st.glowPatches=[];st.glowDirty=[];st.livePreview=true;try{st.livePreview=localStorage.getItem('mf-live-glow')!=='0';}catch{}
function glowAt(mx,my){let best=null,bd=14/st.cam.z;for(const o of glows()){const [x,y]=w2m(o.x,o.y),d=Math.hypot(x-mx,y-my);if(d<bd){bd=d;best=o;}}return best;}
/** the map rectangle (full-resolution pixels) a glow at world X,Y can light */
function glowRect(X,Y,scale=1){const r=GLOW_REACH*Math.max(1,scale),c=[[X-r,Y-r],[X+r,Y-r],[X+r,Y+r],[X-r,Y+r]].map(([x,y])=>w2m(x,y)),xs=c.map(p=>p[0]),ys=c.map(p=>p[1]);
 const x0=Math.max(0,Math.floor(Math.min(...xs))),y0=Math.max(0,Math.floor(Math.min(...ys))),x1=Math.min(st.man.width,Math.ceil(Math.max(...xs))),y1=Math.min(st.man.height,Math.ceil(Math.max(...ys)));return {x:x0,y:y0,w:x1-x0,h:y1-y0};}
const hits=(a,b)=>a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h;
const unite=(a,b)=>{const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y);return {x,y,w:Math.max(a.x+a.w,b.x+b.w)-x,h:Math.max(a.y+a.h,b.y+b.h)-y};};
let glowT=0;
/** a glow changed at these world points: re-render the ground round them shortly (several quick edits share one render) */
function queueGlowPreview(points){if(!st.livePreview||!st.man)return;for(const p of points)if(p&&Number.isFinite(p[0]))st.glowDirty.push(p);clearTimeout(glowT);glowT=setTimeout(runGlowPreview,650);}
async function runGlowPreview(){const pts=st.glowDirty.splice(0);if(!pts.length)return;
 let rects=pts.map(([x,y,k])=>glowRect(x,y,k||1)).filter(r=>r.w>0&&r.h>0);
 // one patch per area: overlapping asks join, and an older patch under a new one is redrawn as part of it
 for(let again=true;again;){again=false;
  for(const g of st.glowPatches.slice())if(rects.some(r=>hits(r,g))){rects.push({x:g.x,y:g.y,w:g.w,h:g.h});st.glowPatches.splice(st.glowPatches.indexOf(g),1);}
  for(let i=0;i<rects.length&&!again;i++)for(let j=i+1;j<rects.length;j++)if(hits(rects[i],rects[j])){rects[i]=unite(rects[i],rects[j]);rects.splice(j,1);again=true;break;}}
 // the server renders the saved plan
 try{await town.save('plan');}catch(e){toast('Preview waits for the plan to save: '+e.message);return;}
 for(const r of rects){
  // big areas go in pieces the server accepts
  const pieces=[];for(let y=r.y;y<r.y+r.h;y+=1300)for(let x=r.x;x<r.x+r.w;x+=2300)pieces.push({x,y,w:Math.min(2300,r.x+r.w-x),h:Math.min(1300,r.y+r.h-y)});
  for(const q of pieces){const patch={...q,img:null,pending:true};st.glowPatches.push(patch);req();
   try{const res=await fetch('/api/ground-preview',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(q)});
    if(!res.ok)throw Error((await res.json().catch(()=>({}))).error||res.statusText);patch.img=await createImageBitmap(await res.blob());}
   catch(e){st.glowPatches.splice(st.glowPatches.indexOf(patch),1);toast('Live preview failed: '+e.message);}
   patch.pending=false;req();}}}
function drawGlowPatches(z){for(const g of st.glowPatches){if(g.img)ctx.drawImage(g.img,g.x,g.y,g.w,g.h);
  if(g.pending){ctx.save();ctx.setLineDash([10/z,8/z]);ctx.strokeStyle='#ffd166cc';ctx.lineWidth=2/z;ctx.strokeRect(g.x,g.y,g.w,g.h);ctx.restore();}}}
/** the glow editor under the Light glow panel */
function glowEditor(){const host=$('#glowEditor');if(!host)return;const o=st.selGlow&&glows().includes(st.selGlow)?st.selGlow:null;if(!o)st.selGlow=null;
 if(host.contains(document.activeElement)&&st.glowPanelFor===o)return;if(host.contains(document.activeElement))document.activeElement.blur();st.glowPanelFor=o;
 const edit=st.glowTool==='edit',busy=st.glowPatches.some(g=>g.pending);
 host.innerHTML=`<div class="btns glow-tool"><button id="gtPaint" class="${edit?'':'on'}">Paint glows</button><button id="gtEdit" class="${edit?'on':''}">Edit glows</button></div>
  <label><input type="checkbox" id="glowLive" ${st.livePreview?'checked':''}> Live preview: the changed ground re-renders in a few seconds${busy?' (rendering…)':''}</label>
  ${!edit?'':o?`<h4>Selected glow</h4>
  <label class="nrow">Strength <input type="range" id="gS" min="0.1" max="2" step="0.05" value="${o.strength??1}"><span>${(+(o.strength??1)).toFixed(2)}</span></label>
  <label class="nrow">Size <input type="range" id="gK" min="0.5" max="2" step="0.05" value="${o.scale??1}"><span>${(+(o.scale??1)).toFixed(2)}</span></label>
  <label class="nrow">Colour <input type="color" id="gC" value="${o.tint||GLOW_AMBER}"><span>${o.tint?'custom':'amber'}</span></label>
  ${o.tint?'<div class="btns"><button id="gCReset">Painted amber</button></div>':''}
  <label class="nrow">Direction (°) <input type="range" id="gA" min="0" max="359" step="1" value="${o.angle??90}"><span>${Math.round(o.angle??90)}${o.angle==null?' south':''}</span></label>
  ${o.angle!=null?'<div class="btns"><button id="gAReset">Point south</button></div>':''}
  <label><input type="checkbox" id="gSnap" ${o.free?'':'checked'}> Snap to curb (off: the glow stands free where you put it)</label>
  <div class="btns"><button id="gDup">Duplicate</button><button id="gDel">Delete</button><button id="gDone">Done</button></div>
  <p class="muted">Drag the glow on the map to move it. Del removes it; Ctrl+C / Ctrl+V / Ctrl+D copy, paste at the mouse and duplicate.</p>`
  :`<p class="muted">Click a glow marker on the map to select it (${glows().length} glows).</p>`}`;
 $('#gtPaint').onclick=e=>{e.target.blur();st.glowTool='paint';st.selGlow=null;glowEditor();updateTask();req();};
 $('#gtEdit').onclick=e=>{e.target.blur();st.glowTool='edit';glowEditor();updateTask();req();};
 $('#glowLive').onchange=e=>{st.livePreview=e.target.checked;try{localStorage.setItem('mf-live-glow',st.livePreview?'1':'0');}catch{}if(!st.livePreview){st.glowPatches=[];req();}};
 if(!o)return;let snap=false;
 const set=(fn,refresh=false)=>{if(!snap){snapshot();snap=true;}fn();savePlan();queueGlowPreview([[o.x,o.y,o.scale]]);if(refresh){snap=false;glowEditor();}req();};
 const slide=(id,key,fmt=v=>(+v).toFixed(2))=>{const el=$(id);el.oninput=e=>{e.target.nextElementSibling.textContent=fmt(e.target.value);set(()=>{o[key]=+e.target.value;});};el.onchange=()=>{snap=false;};};
 slide('#gS','strength');slide('#gK','scale');slide('#gA','angle',v=>String(Math.round(v)));
 $('#gC').oninput=e=>{e.target.nextElementSibling.textContent='custom';set(()=>{o.tint=e.target.value;});};$('#gC').onchange=()=>{snap=false;};
 if($('#gCReset'))$('#gCReset').onclick=e=>{e.target.blur();set(()=>{delete o.tint;},true);};
 if($('#gAReset'))$('#gAReset').onclick=e=>{e.target.blur();set(()=>{delete o.angle;},true);};
 $('#gSnap').onchange=e=>{e.target.blur();set(()=>{o.free=!e.target.checked;},true);};
 $('#gDup').onclick=e=>{e.target.blur();glowClip('d');};
 $('#gDel').onclick=e=>{e.target.blur();glowDelete();};
 $('#gDone').onclick=e=>{e.target.blur();st.selGlow=null;glowEditor();updateTask();req();};}
function glowDelete(){const o=st.selGlow;if(!o)return;snapshot();st.plan.reflections=glows().filter(x=>x!==o);st.selGlow=null;savePlan();queueGlowPreview([[o.x,o.y,o.scale]]);glowEditor();stats();req();}
/** Ctrl+C copies the selected glow, Ctrl+V pastes it at the mouse, Ctrl+D duplicates it 2 m along */
function glowClip(k){
 if(k==='c'){if(!st.selGlow){toast('Select a glow to copy (Edit glows, then click one).');return;}st.glowClip=structuredClone(st.selGlow);toast('Glow copied: Ctrl+V pastes it at the mouse.');return;}
 const src=k==='d'?st.selGlow:st.glowClip;if(!src){toast(k==='d'?'Select a glow to duplicate.':'Copy a glow first (select it, Ctrl+C).');return;}
 const [X,Y]=k==='d'?[src.x+2,src.y+2]:m2w(st.mouse.mx,st.mouse.my),n=structuredClone(src);n.id='glow-'+newId();n.x=Math.round(X*4)/4;n.y=Math.round(Y*4)/4;
 snapshot();glows().push(n);st.selGlow=n;savePlan();queueGlowPreview([[n.x,n.y,n.scale]]);glowEditor();stats();req();}
function glowDown(X,Y,mx,my){const o=glowAt(mx,my);st.selGlow=o;glowEditor();updateTask();req();if(o)st.drag={kind:'glowMove',o,start:[X,Y],from:[o.x,o.y],moved:false};}
function savePlan(){const version=++planSaveVersion;st.planSavePending=true;st.planSaveError=false;req();clearTimeout(planT);planT=setTimeout(async()=>{try{await town.save('plan');if(version===planSaveVersion)st.planSavePending=false;$('#bakeBtn').classList.add('attention');req();}catch(e){st.planSaveError=true;st.planSavePending=false;req();toast('Ground edits could not save: '+e.message);planT=setTimeout(()=>savePlan(),3000);}},600);}

// Hot asset updates never reload or overwrite the owner's placements, camera, or undo history.
window.__townBuilderLiveUpdate=async revisions=>{
 if(revisions.library){const lib=await fetch('/library/library.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Library update failed');return r.json();});
  st.lib=lib;st.items=new Map(lib.items.map(i=>[i.id,i]));st.libraryVer=Date.now();spriteImg.clear();alphaMask.clear();shadowImgs.clear();
  const repaired=repairLegacyFenceRuns(st.sprites,st.items);if(repaired.changed){snapshot();st.sprites=repaired.items;save();toast('Straightened '+repaired.changed+' chain-link fence pieces. Undo restores the previous placement.');}
  if(!lib.categories.includes(st.cat)&&!['All','Presets'].includes(st.cat))st.cat='All';buildPalette();stats();inspector();}
 if(revisions.presets)await loadPresets();
 if(revisions.map){const man=await fetch('/map/manifest.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Map update failed');return r.json();});adoptMap(man);if(man.groundPlan){st.bakedGround=man.groundPlan;st.planDirty=!groundMatches(st.plan,man.groundPlan);}st.ver=Date.now();tiles.clear();st.miniImg=new Image();st.miniImg.onload=req;st.miniImg.src='/map/preview.webp?v='+st.ver;}
 req();
};
function setSave(t,c=''){const e=$('#saveState');e.textContent=t;e.className='save '+c;}
// ---------------------------------------------------------------- modes and tools
function setMode(m){if(st.mode==='walk'&&m!=='walk')walkExit();if(m==='walk'&&st.mode==='walk')return;if(m!=='spots'){spot.sel=null;spot.owner=null;spot.ownerList=null;}if(m!=='lamps')st.selGlow=null;
 if(m==='paving'){st.lotSurf='paving';st.lotEdge='none';setLotTool('rect',false);m='lots';}if(m==='streetlights'){pickBrush('world:streetlamp');$('#bSpacing').value=8;$('#bJitter').value=0;$('#bVar').value=0;$('#bRandFlip').checked=false;return;}
 st.mode=m;if(m!=='select')st.sel.clear();for(const b of $$('#tools button'))b.classList.toggle('on',b.dataset.mode===m);
 view.style.cursor=m==='pan'?'grab':m==='select'?'default':m==='walk'?'default':'crosshair';if(m==='walk')walkEnter();spotsPanel();inspector();if(['roads','lamps','paving','lots'].includes(m))st.show.plan=true,$('#tPlan').checked=true;groundPanel();req();}
function setLotTool(tool,refresh=true){st.lotTool=tool;if(tool!=='select'){st.selLot=null;st.selPave=null;st.paintLot=null;}if(tool==='brush'&&st.lotSurf==='paving'){st.lotSurf='slab';st.lotEdge='none';}if(refresh){groundPanel();req();}}
function updateTask(){
 const selected=st.mode==='select'?st.sprites.filter(o=>st.sel.has(o.uid)):[],ground=st.mode==='lots'?selGround():null;
 const creating=st.mode==='paint'||st.mode==='lots'&&st.lotTool!=='select';
 let title='',hint='';
 if(st.mode==='lots'){
  if(st.lotTool==='select'){title=ground?'Editing: '+(surfaces[st.selPave!=null?'paving':ground.surface]?.name||'ground item'):'Edit existing lots & paths';hint=ground?'Only the yellow outlined item changes. Drag to move; use the panel to adjust it.':'Click an item to select it, or choose Draw new in the panel.';}
  else{const continuing=st.lotTool==='brush'&&st.paintLot&&st.plan.lots.includes(st.paintLot);title=(continuing?'Continuing shape: ':'Creating: ')+(surfaces[st.lotSurf||'asphalt']?.name||'lot');hint=st.lotTool==='brush'?'Drag to paint. Shift erases from this shape. Finish & edit when done.':'Drag diagonally and release to create a rectangle.';}
 }else if(st.mode==='paint'){title=st.brush?'Placing new: '+(st.brush.preset?.name||st.items.get(st.brush.id)?.name):'Place new objects';hint=st.brush?'Click the map to add a copy. Select / edit lets you change placed objects.':'Choose a picture from the object library on the left.';}
 else if(st.mode==='select'){title=selected.length?'Editing: '+(selected.length===1?st.items.get(selected[0].id).name:selected.length+' objects'):'Select & edit objects';hint=selected.length?'Drag to move. Settings apply to your selection. Escape clears it.':'Click an object to edit it. Choose a library picture to place a new object.';}
 else if(st.mode==='pan'){title='Move around the town';hint='Drag to move the view. Scroll to zoom. You can also hold Space in any tool.';}
 else if(st.mode==='roads'){const removing=st.roadTool==='remove'||st.shiftHeld;title=removing?'Removing roads':'Building new roads';hint=removing?'Click or drag over road cells to remove them. Red marks show removals until Rebuild ground.':'Click or drag across cells to build a road. Join at least two cells. Hold Shift to remove.';}
 else if(st.mode==='walk'){title='Walking as the kid · game view';hint='WASD or arrows to walk (Shift runs, Alt walks through objects, click jumps there), C changes kid, Esc or T stops.';}
 else if(st.mode==='spots'){title=spot.sel?'Editing a light spot':'Placing light spots';hint=spot.sel?'Drag to move it; the panel sets radius, strength and kind. Shift-click or Delete removes it.':'Click the map to add a light. Click a spot to edit it; Shift-click removes it.';}
 else if(st.mode==='lamps'&&st.glowTool==='edit'){title=st.selGlow?'Editing a glow':'Edit glows';hint=st.selGlow?'Drag to move it; the panel sets strength, size, colour and direction. Del removes it.':'Click a glow marker to select it.';}
 else{title=st.groundErase||st.shiftHeld?'Erase light glow':'Paint light glow';hint='Click or drag on the map. Hold Shift to erase. Rebuild ground to see the finished light.';}
 const task=$('#taskBar');task.dataset.intent=creating?'creating':st.mode==='select'||st.mode==='lots'?'editing':'navigation';
 if(st.mode==='roads')task.dataset.intent=st.roadTool==='remove'||st.shiftHeld?'removing':'creating';
 if($('#taskTitle').textContent!==title)$('#taskTitle').textContent=title;
 if($('#taskHint').textContent!==hint)$('#taskHint').textContent=hint;
 const status=$('#groundStatus'),busy=$('#bakeBtn').disabled;
 const message=st.bakeError?'Ground update failed - your edits are still saved':busy?'Updating ground…':st.planSavePending?'Saving ground edits…':st.planDirty?'Ground edits saved · update to see textures':'Ground up to date';
 if(status.textContent!==message)status.textContent=message;status.classList.toggle('pending',!!st.planDirty);
 for(const button of $$('.update-ground'))button.disabled=busy;
}
function groundNotice(){return '<div class="ground-notice"><b>Outline first, finished surface after updating</b><p>Your edits save automatically. Use <b>Rebuild ground</b> to render the textures; this takes a few minutes.</p><button class="update-ground">Rebuild ground</button></div>';}
function wireVisualChoices(root,surfaceId,edgeId){for(const b of root.querySelectorAll('[data-surface]'))b.onclick=()=>{const el=$('#'+surfaceId);if(el){el.value=b.dataset.surface;el.dispatchEvent(new Event('change'));}};for(const b of root.querySelectorAll('[data-edge]'))b.onclick=()=>{const el=$('#'+edgeId);if(el){el.value=b.dataset.edge;el.dispatchEvent(new Event('change'));}};}
function groundPanel(){const p=$('#groundPanel'),b=$('#groundBody');const m=st.mode;if(!['roads','lamps','paving','lots'].includes(m)){p.hidden=true;return;}p.hidden=false;
 if(m==='roads'){
  $('#groundTitle').textContent='Build & remove roads';st.roadTool??='add';const remove=st.roadTool==='remove';
  b.innerHTML=`<div class="road-tools" role="group" aria-label="Road action"><label class="tool-card ${!remove?'on':''}"><input type="radio" name="roadTool" value="add" ${!remove?'checked':''}><span><b>Build road</b><small>Click or drag to add cells</small></span></label><label class="tool-card ${remove?'on danger':''}"><input type="radio" name="roadTool" value="remove" ${remove?'checked':''}><span><b>Remove road</b><small>Click or drag to erase cells</small></span></label></div>
  <div class="intent ${remove?'removing':'creating'}"><span>${remove?'REMOVING EXISTING ROADS':'BUILDING NEW ROADS'}</span><b>${remove?'Erase the road cells':'Draw a connected route'}</b><p>${remove?'Drag across the road you want to remove. Red crosses mark the cells that will become grass.':'Click a cell, then drag along the grid. Corners, intersections and sidewalks join automatically.'}</p></div>
  <div class="road-example"><img src="/app/examples/${remove?'road-remove':'road-build'}.svg" alt="${remove?'Road cells crossed out, then replaced by grass':'Drag across adjacent grid cells to draw a connected road'}"></div>
  <ol class="tool-steps"><li>Choose <b>${remove?'Remove road':'Build road'}</b>.</li><li>Click or drag across the map's grid cells.</li><li>Press <b>Rebuild ground</b> to ${remove?'replace removed roads with grass':'see the finished road'}.</li></ol>
  <p class="muted">Each cell is 20 m. A road needs at least two connected cells. Undo restores a whole drag. Hold Shift to remove temporarily.</p><p class="road-count">${st.plan.roads.length} road cells in your plan</p>`;
  for(const r of $$('input[name=roadTool]'))r.onchange=()=>{st.roadTool=r.value;groundPanel();req();};
 }
 if(m==='lamps'||m==='paving'){
  $('#groundTitle').textContent=m==='lamps'?'Reflections (no lamp posts)':'Pavement patches';
  b.innerHTML=`<p>${m==='lamps'?'Paint light onto the existing road and pavement. No foreign sidewalk pixels or upright posts.':'Paint beige paving slabs on the ground. Drag to join patches; each patch remains removable.'}</p><label><input id="groundErase" type="checkbox"> Erase painted ${m==='lamps'?'reflections':'patches'}</label><p class="muted">Shift also erases. Undo works. Press Rebuild ground to update the painted surface.</p>${m==='lamps'?'<p><label><input id="lightSnap" type="checkbox"> Snap to curb</label></p><p>Strength <input id="lightStrength" type="number" min="0.1" max="2" step="0.1"></p><p>Pool size <input id="lightSize" type="number" min="0.5" max="2" step="0.1"></p>':'<p>Width (m) <input id="paveW" type="number" min="1" max="20" step="0.5"></p><p>Depth (m) <input id="paveH" type="number" min="1" max="20" step="0.5"></p>'}`;
  $('#groundErase').checked=!!st.groundErase;$('#groundErase').onchange=e=>st.groundErase=e.target.checked;
  for(const [id,key,value,min,max] of m==='lamps'?[['lightStrength','lightStrength',1,.1,2],['lightSize','lightSize',1,.5,2]]:[['paveW','paveW',4,1,20],['paveH','paveH',2,1,20]]){const el=$('#'+id);el.value=st[key]??value;el.onchange=()=>{st[key]=Math.max(min,Math.min(max,+el.value||value));el.value=st[key];req();};}
  if(m==='lamps'){$('#lightSnap').checked=st.lightSnap!==false;$('#lightSnap').onchange=e=>st.lightSnap=e.target.checked;}
 }
 if(m==='lamps'){
  const road=m==='roads';b.insertAdjacentHTML('afterbegin',`<div class="intent creating"><span>${road?'EDIT ROAD CELLS':'PAINT OR ERASE GLOW'}</span><b>${road?'Build connected streets':'Light up the ground'}</b></div><div class="selected-preview"><img src="/app/examples/${road?'road':'glow'}.webp" alt="${road?'Finished road with sidewalks':'Warm light reflected on asphalt'}"><span>Finished ground example</span></div>`);
  b.insertAdjacentHTML('beforeend',groundNotice());
  if(m==='lamps'){b.insertAdjacentHTML('beforeend','<div id="glowEditor"></div>');st.glowPanelFor=undefined;glowEditor();}
 }
 if(m==='roads')b.insertAdjacentHTML('beforeend',groundNotice());
 if(m==='lots'){
  $('#groundTitle').textContent='Lots & paths';st.lotTool??='select';st.lotShape??='c';st.lotSize??=3;
  const editing=st.lotTool==='select',surf=st.lotSurf||'asphalt',patch=surf==='paving',active=st.lotTool==='brush'&&st.paintLot&&st.plan.lots.includes(st.paintLot);
  b.innerHTML=`<div class="lotTool" role="group" aria-label="Choose an action">
   <label class="tool-card ${editing?'on':''}"><input type="radio" name="lotTool" value="select" ${editing?'checked':''}><span><b>Edit existing</b><small>Pick, move or resize</small></span></label>
   <label class="tool-card ${st.lotTool==='rect'?'on':''}"><input type="radio" name="lotTool" value="rect" ${st.lotTool==='rect'?'checked':''}><span><b>Draw new</b><small>Drag a rectangle</small></span></label>
   <label class="tool-card ${st.lotTool==='brush'?'on':''}"><input type="radio" name="lotTool" value="brush" ${st.lotTool==='brush'?'checked':''}><span><b>Paint a shape</b><small>Draw freely with a brush</small></span></label>
  </div>${editing?`<div id="lotSelOpts">${lotSelPanel()}</div>`:`
  <div class="intent creating"><span>${active?'CONTINUING THIS SHAPE':'CREATING A NEW ITEM'}</span><b>${surfaces[surf].name}</b><p>${active?'Each stroke grows this same shape. Choose New shape to start another.':'These settings apply to the next item you draw.'}</p></div>
  <h4>1. Choose a surface</h4>${surfaceChoices(surf,'lotSurf')}
  <p class="muted">${surfaces[surf].hint}</p>
  <h4>2. Choose a border</h4>${edgeChoices(st.lotEdge||(patch?'none':'ring'),'lotEdge',patch,surf)}
  <h4>3. ${st.lotTool==='brush'?'Paint on the map':'Drag on the map'}</h4>
  <div class="how-to">${gesture(st.lotTool)}<p>${st.lotTool==='brush'?'Click and drag to paint. Hold Shift to erase from this shape.':'Press and drag diagonally, then release. Your new item will be selected for editing.'}</p></div>
  ${st.lotTool==='brush'?`<div id="lotBrushOpts" class="lotBrush">
   <p><b>Brush shape</b><label><input type="radio" name="lotShape" value="c"> Circle</label><label><input type="radio" name="lotShape" value="q"> Square</label></p>
   <label class="field-label" for="lotSize">Brush width <span id="lotSizeV"></span><input id="lotSize" type="range" min="0.5" max="10" step="0.25"></label>
   <p><button data-size="1.5">Small</button><button data-size="3">Medium</button><button data-size="6">Large</button></p>
   <div class="btns"><button id="lotNewShape">New shape</button>${active?'<button id="finishShape" class="primary">Finish & edit shape</button>':''}</div></div>`:''}`}
  ${groundNotice()}`;
  for(const r of $$('input[name=lotTool]'))r.onchange=()=>setLotTool(r.value);
  if(editing)wireLotSel();
  else{
   $('#lotSurf').onchange=e=>{st.lotSurf=e.target.value;st.paintLot=null;st.selLot=null;st.selPave=null;if(st.lotSurf==='paving'){st.lotEdge='none';st.lotTool='rect';}else if(['dirt','field'].includes(st.lotSurf))st.lotEdge='none';groundPanel();req();};
   $('#lotEdge').onchange=e=>{st.lotEdge=e.target.value;st.paintLot=null;st.selLot=null;st.selPave=null;groundPanel();req();};
   wireVisualChoices(b,'lotSurf','lotEdge');
   for(const r of $$('input[name=lotShape]')){r.checked=r.value===st.lotShape;r.onchange=()=>{st.lotShape=r.value;req();};}
   const sz=$('#lotSize');if(sz){sz.value=st.lotSize;const size=()=>{sz.value=st.lotSize;$('#lotSizeV').textContent=(st.lotSize*2).toFixed(1)+' m';req();};size();sz.oninput=()=>{st.lotSize=+sz.value;size();};for(const btn of $$('#lotBrushOpts [data-size]'))btn.onclick=()=>{st.lotSize=+btn.dataset.size;size();};$('#lotNewShape').onclick=()=>{setLotTool('brush');toast('Next stroke starts a new shape');};if($('#finishShape'))$('#finishShape').onclick=()=>{st.lotTool='select';st.paintLot=null;groundPanel();req();};}
  }
 }
 for(const button of b.querySelectorAll('.update-ground'))button.onclick=()=>$('#bakeBtn').click();
 updateTask();
}
// ---------------------------------------------------------------- sprite geometry & hit testing
function rect(s){const it=st.items.get(s.id),[mx,my]=w2m(s.x,s.y),k=s.scale||1,w=it.w*k,h=it.h*k,left=s.flip?mx-(it.w-it.ax)*k:mx-it.ax*k;return {it,mx,my,left,top:my-it.ay*k,w,h};}
function sorted(){return st.sprites.slice().sort((a,b)=>{const fa=st.items.get(a.id).flat,fb=st.items.get(b.id).flat;if(fa!==fb)return fa?-1:1;const za=a.z||0,zb=b.z||0;if(za!==zb)return za-zb;const ya=a.x+a.y+(a.o||0),yb=b.x+b.y+(b.o||0);return ya-yb||(a.x-a.y)-(b.x-b.y);});}
/** Bring to front / send to back: a layer number that overrides the automatic depth order (within ground pieces or within upright sprites). */
function layerSel(dir){if(!st.sel.size)return;snapshot();const zs=st.sprites.map(s=>s.z||0),top=Math.max(0,...zs),bot=Math.min(0,...zs);for(const s of st.sprites)if(st.sel.has(s.uid)){const z=dir>0?top+1:bot-1;if(z)s.z=z;else delete s.z;}save();inspector();req();}
function layerReset(){if(!st.sel.size)return;snapshot();for(const s of st.sprites)if(st.sel.has(s.uid))delete s.z;save();inspector();req();}
function mask(id){let m=alphaMask.get(id);if(m)return m;const im=spriteImg.get(id);if(!im||!im.complete||!im.naturalWidth)return null;const W=Math.min(160,im.naturalWidth),H=Math.max(1,Math.round(im.naturalHeight*W/im.naturalWidth)),c=new OffscreenCanvas(W,H),x=c.getContext('2d');x.drawImage(im,0,0,W,H);
 m={W,H,a:x.getImageData(0,0,W,H).data};alphaMask.set(id,m);return m;}
function hit(mx,my){const list=sorted().reverse();for(const s of list){const r=rect(s);if(mx<r.left||my<r.top||mx>r.left+r.w||my>r.top+r.h)continue;const m=mask(s.id);if(!m)return s;
 let u=(mx-r.left)/r.w;if(s.flip)u=1-u;const v=(my-r.top)/r.h,a=m.a[(Math.min(m.H-1,Math.floor(v*m.H))*m.W+Math.min(m.W-1,Math.floor(u*m.W)))*4+3];if(a>40||r.it.flat&&a>10)return s;}return null;}
// ---------------------------------------------------------------- drawing
function draw(){if(!need||!st.man){requestAnimationFrame(draw);return;}need=false;
 dpr=window.devicePixelRatio||1;const cw=view.clientWidth,ch=view.clientHeight;if(view.width!==Math.round(cw*dpr)||view.height!==Math.round(ch*dpr)){view.width=Math.round(cw*dpr);view.height=Math.round(ch*dpr);}
 ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#141a17';ctx.fillRect(0,0,view.width,view.height);
 const z=st.cam.z,tx=cw/2-st.cam.x*z,ty=ch/2-st.cam.y*z;ctx.setTransform(z*dpr,0,0,z*dpr,tx*dpr,ty*dpr);ctx.imageSmoothingQuality='high';
 ctx.save();clipGround(ctx,st.plan,w2m);
 // map tiles from the pyramid level that matches the zoom (coarser parent as placeholder)
 const T=st.man.tileSize,maxL=st.man.levels.length-1,L=Math.max(0,Math.min(maxL,Math.floor(Math.log2(1/(z*dpr))+.25)));
 const [x0,y0]=s2m(0,0),[x1,y1]=s2m(cw,ch);
 for(let l=Math.min(maxL,L+2);l>=L;l--){const span=T*2**l,lv=st.man.levels[l];
  for(let y=Math.max(0,Math.floor(y0/span));y<=Math.min(lv.rows-1,Math.floor(y1/span));y++)for(let x=Math.max(0,Math.floor(x0/span));x<=Math.min(lv.cols-1,Math.floor(x1/span));x++){
   const t=tile(l,x,y);if(t.ok)ctx.drawImage(t.img,x*span,y*span,t.img.naturalWidth*2**l,t.img.naturalHeight*2**l);}}
 prune();
 drawGlowPatches(z);
 ctx.restore();
 // grid
 if(st.show.grid||st.mode==='roads'){ctx.lineWidth=1/z;const fine=z>.35&&st.show.grid;
  const cellLine=(X0,Y0,X1,Y1,col)=>{ctx.strokeStyle=col;ctx.beginPath();const a=w2m(X0,Y0),b=w2m(X1,Y1);ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();};
  const G=grid(),gx0=G.cx0*20,gy0=G.cy0*20,gx1=G.cx1*20+20,gy1=G.cy1*20+20;if(fine)for(let v=Math.min(gx0,gy0);v<=Math.max(gx1,gy1);v+=2){if(v>=gx0&&v<=gx1)cellLine(v,gy0,v,gy1,'#ffffff14');if(v>=gy0&&v<=gy1)cellLine(gx0,v,gx1,v,'#ffffff14');}
  for(let v=gx0;v<=gx1;v+=20)cellLine(v,gy0,v,gy1,'#ffd38c55');for(let v=gy0;v<=gy1;v+=20)cellLine(gx0,v,gx1,v,'#ffd38c55');}
 // plan overlay: road cells, lots, lamps
 if(st.show.plan){const cells=new Set(st.plan.roads),G=grid();ctx.lineWidth=2/z;
  for(let cy=G.cy0;cy<=G.cy1;cy++)for(let cx=G.cx0;cx<=G.cx1;cx++){if(!cells.has(`${cx},${cy}`))continue;poly([[cx*20,cy*20],[cx*20+20,cy*20],[cx*20+20,cy*20+20],[cx*20,cy*20+20]],'#f0a44322','#f0a44388');}
  (st.plan.lots||[]).forEach((l,i)=>l.stamps?drawStamps(l,i===st.selLot):poly([[l.x0,l.y0],[l.x1,l.y0],[l.x1,l.y1],[l.x0,l.y1]],i===st.selLot?'#5fd1ff33':'#5fd1ff10',i===st.selLot?'#5fd1ff':'#5fd1ff88'));
  for(const p of st.plan.paving||[])poly([[p.x0,p.y0],[p.x1,p.y0],[p.x1,p.y1],[p.x0,p.y1]],'#e5d5b922','#e5d5b9aa');
  for(const l of st.plan.reflections??st.plan.lamps??[]){const [mx,my]=w2m(l.x,l.y);if(l===st.selGlow||l.angle!=null||l.tint){const a=(l.angle??90)*Math.PI/180,len=34/z;ctx.save();ctx.strokeStyle=l.tint||'#ffcf6e';ctx.lineWidth=(l===st.selGlow?3:2)/z;ctx.beginPath();ctx.moveTo(mx,my);ctx.lineTo(mx+Math.cos(a)*len,my+Math.sin(a)*len);ctx.stroke();if(l===st.selGlow){ctx.strokeStyle='#fff';ctx.lineWidth=2/z;ctx.beginPath();ctx.arc(mx,my,12/z,0,7);ctx.stroke();}ctx.restore();}ctx.fillStyle=l.tint||(l.free?'#9ff':'#ffcf6e');ctx.beginPath();ctx.arc(mx,my,7/z,0,7);ctx.fill();ctx.strokeStyle='#000';ctx.stroke();}
  const removed=(x0,y0,x1,y1)=>{poly([[x0,y0],[x1,y0],[x1,y1],[x0,y1]],'#ef635144','#ff8278');ctx.beginPath();ctx.moveTo(...w2m(x0,y0));ctx.lineTo(...w2m(x1,y1));ctx.moveTo(...w2m(x1,y0));ctx.lineTo(...w2m(x0,y1));ctx.strokeStyle='#ff8278';ctx.lineWidth=2/z;ctx.stroke();};
  for(const key of st.bakedGround?.roads||[])if(!cells.has(key)){const [x,y]=key.split(',').map(Number);removed(x*20,y*20,x*20+20,y*20+20);}
  for(const kind of ['lots','paving']){const ids=new Set((st.plan[kind]||[]).map(o=>o.id));for(const o of st.bakedGround?.[kind]||[])if(o.id&&!ids.has(o.id))removed(o.x0,o.y0,o.x1,o.y1);}
 }
 if(st.mode==='roads'&&st.mouse.in){const [X,Y]=m2w(st.mouse.mx,st.mouse.my),x=Math.floor(X/20)*20,y=Math.floor(Y/20)*20;if(grid().has(x/20,y/20)){const erase=st.drag?.erase??(st.roadTool==='remove'||st.shiftHeld);poly([[x,y],[x+20,y],[x+20,y+20],[x,y+20]],erase?'#ef635144':'#5fd1ff44',erase?'#ff8278':'#5fd1ff');}}
 // sprites, depth sorted (ground decals first)
 const order=sorted();if(st.mode==='walk'&&st.items.has(kidSprite().id)){const kd=kidSprite(),key=kd.x+kd.y;const i=order.findIndex(o=>!st.items.get(o.id).flat&&!(o.z>0)&&o.x+o.y+(o.o||0)>key);order.splice(i<0?order.length:i,0,kd);
  // hidden: an upright object drawn after the kid covers its middle (the game shows the silhouette only then)
  const kr=rect(kd),cx=kr.left+kr.w/2,cy=kr.top+kr.h*.55;walk.hidden=i>=0&&order.slice(i+1).some(o=>{if(st.items.get(o.id).flat)return false;const q=rect(o);return cx>q.left&&cx<q.left+q.w&&cy>q.top&&cy<q.top+q.h&&opaqueAt(o,q,cx,cy);});}let shadowsDone=!st.show.shadows;
 for(const s of order){if(!shadowsDone&&!st.items.get(s.id).flat){shadowsDone=true; // ground decals first, then every base shadow, then upright sprites
   for(const o of order){const it=st.items.get(o.id);if(it.flat||!it.shadow)continue;const q=rect(o);if(q.left>x1||q.top>y1||q.left+q.w<x0||q.top+q.h<y0)continue;shadow(o.x,o.y,it,o.flip,o.scale||1);}}
  const r=rect(s);if(r.left>x1||r.top>y1||r.left+r.w<x0||r.top+r.h<y0)continue;const im=sprite(s.id);if(!im.complete||!im.naturalWidth)continue;
  if(s.flip){ctx.save();ctx.translate(r.mx,0);ctx.scale(-1,1);ctx.drawImage(im,-(r.it.ax*(s.scale||1)),r.top,r.w,r.h);ctx.restore();}else ctx.drawImage(im,r.left,r.top,r.w,r.h);}
 // night: blue moonlight, painted colour back inside every light
 if(nightOn())drawNight(cw,ch,z,tx,ty,x0,y0,x1,y1);
 if(st.mode==='walk'&&walk.hidden)drawKidSilhouette();
 drawSpotMarkers(z);
 // selection
 for(const s of st.sprites){if(st.mode!=='select'||!st.sel.has(s.uid))continue;const r=rect(s);footprint(s.x,s.y,r.it,s.flip,s.scale||1,'#5fd1ff');ctx.strokeStyle='#5fd1ffaa';ctx.setLineDash([6/z,4/z]);ctx.lineWidth=1.5/z;ctx.strokeRect(r.left,r.top,r.w,r.h);ctx.setLineDash([]);}
 // brush ghost
 if(st.mode==='paint'&&st.brush?.preset&&st.mouse.in){const [X,Y]=brushPos();const kk=+$('#bScale').value||1;const fit=st.brush.preset.fit;if(fit){const hw=fit.w*kk/2,hh=fit.h*kk/2,snapped=!!st.snappedBlock;ctx.setLineDash(snapped?[]:[8/z,6/z]);poly([[X-hw,Y-hh],[X+hw,Y-hh],[X+hw,Y+hh],[X-hw,Y+hh]],null,snapped?'#ffd166':'#ffd16699');ctx.setLineDash([]);}
  for(const g of st.brush.preset.ground||[])if(g.kind!=='refl')poly([[X+g.x0*kk,Y+g.y0*kk],[X+g.x1*kk,Y+g.y0*kk],[X+g.x1*kk,Y+g.y1*kk],[X+g.x0*kk,Y+g.y1*kk]],g.surface==='asphalt'?'#1a203099':g.surface==='dirt'?'#5a3e2888':g.surface==='field'?'#46683488':'#c4aa9288',null);ctx.globalAlpha=.72;
  for(const m of sortMembers(st.brush.roll)){const it=st.items.get(m.id),im=sprite(m.id),[mx,my]=w2m(X+m.dx,Y+m.dy),k=m.scale;if(!im.complete||!im.naturalWidth)continue;
   if(!it.flat&&st.show.shadows)shadow(X+m.dx,Y+m.dy,it,m.flip,k);
   if(m.flip){ctx.save();ctx.translate(mx,0);ctx.scale(-1,1);ctx.drawImage(im,-it.ax*k,my-it.ay*k,it.w*k,it.h*k);ctx.restore();}else ctx.drawImage(im,mx-it.ax*k,my-it.ay*k,it.w*k,it.h*k);}
  ctx.globalAlpha=1;const [cx,cy]=w2m(X,Y);ctx.strokeStyle='#f0a443';ctx.lineWidth=2/st.cam.z;ctx.beginPath();ctx.arc(cx,cy,6/st.cam.z,0,7);ctx.stroke();}
 else if(st.mode==='paint'&&st.brush&&st.mouse.in){const it=st.items.get(st.brush.id),[X,Y]=brushPos(),[mx,my]=w2m(X,Y),k=st.brush.scale,w=it.w*k,h=it.h*k,im=sprite(it.id);
  footprint(X,Y,it,st.brush.flip,k,'#f0a443');ctx.globalAlpha=.7;if(im.complete&&im.naturalWidth){if(st.brush.flip){ctx.save();ctx.translate(mx,0);ctx.scale(-1,1);ctx.drawImage(im,-it.ax*k,my-it.ay*k,w,h);ctx.restore();}else ctx.drawImage(im,mx-it.ax*k,my-it.ay*k,w,h);}ctx.globalAlpha=1;}
 // lot being dragged
 if(st.mode==='lots'){const o=st.lotTool==='select'||st.lotTool==='brush'?selGround():null;if(o){const b=groundBox(o);ctx.setLineDash([]);poly([[b.x0,b.y0],[b.x1,b.y0],[b.x1,b.y1],[b.x0,b.y1]],'#ffc66e18','#ffc66e');
  if(!o.stamps&&st.lotTool==='select')for(const [c,X,Y] of handlePts(b)){const [hx,hy]=w2m(X,Y),r=6/st.cam.z;ctx.fillStyle='#ffc66e';ctx.fillRect(hx-r,hy-r,2*r,2*r);ctx.strokeStyle='#000';ctx.lineWidth=1/st.cam.z;ctx.strokeRect(hx-r,hy-r,2*r,2*r);}}
  if(st.lotTool==='select'&&st.mouse.in&&!st.drag){const [X,Y]=m2w(st.mouse.mx,st.mouse.my),g=groundAt(X,Y);if(g&&g.o!==o){const b=groundBox(g.o);poly([[b.x0,b.y0],[b.x1,b.y0],[b.x1,b.y1],[b.x0,b.y1]],null,'#ffc66e77');}}}
 if(st.mode==='lots'&&st.lotTool==='brush'&&st.mouse.in){const [X,Y]=m2w(st.mouse.mx,st.mouse.my);stampPoly({s:st.lotShape,x:X,y:Y,r:st.lotSize},st.mouse.down&&st.drag?.erase||st.shiftHeld?'#ff6b6b33':'#5fd1ff22',st.shiftHeld?'#ff6b6b':'#5fd1ff');}
 if(st.drag?.kind==='lot'){const a=st.drag.a,b=st.drag.b;poly([[a[0],a[1]],[b[0],a[1]],[b[0],b[1]],[a[0],b[1]]],'#5fd1ff22','#5fd1ff');}
 if(st.drag?.kind==='box'){ctx.strokeStyle='#5fd1ff';ctx.lineWidth=1/z;ctx.strokeRect(Math.min(st.drag.m0[0],st.mouse.mx),Math.min(st.drag.m0[1],st.mouse.my),Math.abs(st.mouse.mx-st.drag.m0[0]),Math.abs(st.mouse.my-st.drag.m0[1]));}
 // place labels
 if(st.show.poi)for(const p of st.plan.pois||[]){const [mx,my]=w2m((p.x0+p.x1)/2,(p.y0+p.y1)/2);const [sx,sy]=m2s(mx,my);ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);
  const txt=`${p.n}. ${p.name}`;ctx.font='600 12px system-ui,sans-serif';const w=ctx.measureText(txt).width+12;ctx.fillStyle='#0d1114cc';ctx.strokeStyle='#f0a44399';ctx.lineWidth=1;
  ctx.beginPath();ctx.roundRect(sx-w/2,sy-10,w,20,10);ctx.fill();ctx.stroke();ctx.fillStyle='#ffd38c';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(txt,sx,sy+.5);ctx.restore();}
 for(const peer of st.mode==='walk'?[]:st.peers||[]){if(!peer.cursor)continue;const {x,y}=peer.cursor;ctx.save();ctx.fillStyle='#bf9cff';ctx.strokeStyle='#21152c';ctx.lineWidth=2/z;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+12/z,y+18/z);ctx.lineTo(x+5/z,y+16/z);ctx.closePath();ctx.fill();ctx.stroke();ctx.font=`${12/z}px system-ui`;ctx.fillText(peer.name,x+15/z,y+14/z);ctx.restore();}
 drawMini();hud();requestAnimationFrame(draw);}
function poly(pts,fill,stroke){ctx.beginPath();pts.forEach(([X,Y],i)=>{const [mx,my]=w2m(X,Y);i?ctx.lineTo(mx,my):ctx.moveTo(mx,my);});ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.5/st.cam.z;ctx.stroke();}}
/** The sprite's collision box (base from shadows.mjs, fitted to the drawing); mirroring swaps the ground axes. */
function footprint(X,Y,it,flip,k,col){const b=it.base||{hx:it.fw,hy:it.fh,dx:0,dy:0};let hw=b.hx*k,hh=b.hy*k,ox=(b.dx||0)*k,oy=(b.dy||0)*k;if(flip){[hw,hh]=[hh,hw];[ox,oy]=[oy,ox];}X+=ox;Y+=oy;
 if(b.shape==='ellipse'){const pts=[];for(let i=0;i<24;i++){const t=i/24*6.283;pts.push([X+Math.cos(t)*hw,Y+Math.sin(t)*hh]);}poly(pts,col+'22',col);return;}poly([[X-hw,Y-hh],[X+hw,Y-hh],[X+hw,Y+hh],[X-hw,Y+hh]],col+'22',col);}
function drawMini(){if(!st.miniImg?.complete)return;const W=mini.width,H=mini.height,k=Math.min(W/st.man.width,H/st.man.height),ox=(W-st.man.width*k)/2,oy=(H-st.man.height*k)/2;
 mctx.fillStyle='#0d1114';mctx.fillRect(0,0,W,H);mctx.save();clipGround(mctx,st.plan,(X,Y)=>{const [x,y]=w2m(X,Y);return [ox+x*k,oy+y*k];});mctx.drawImage(st.miniImg,ox,oy,st.man.width*k,st.man.height*k);mctx.restore();
 const [x0,y0]=s2m(0,0),[x1,y1]=s2m(view.clientWidth,view.clientHeight);mctx.strokeStyle='#ffc66e';mctx.lineWidth=1.5;mctx.strokeRect(ox+x0*k,oy+y0*k,(x1-x0)*k,(y1-y0)*k);st.miniK={k,ox,oy};}
function hud(){updateTask();const [X,Y]=m2w(st.mouse.mx,st.mouse.my);$('#coords').textContent=`x ${X.toFixed(1)} m  y ${Y.toFixed(1)} m  cell ${Math.floor(X/20)},${Math.floor(Y/20)}`;$('#zoomInfo').textContent=`zoom ${(st.cam.z*100).toFixed(0)}%`;}
function stats(){const by={};for(const s of st.sprites){const c=st.items.get(s.id).category;by[c]=(by[c]||0)+1;}
 $('#stats').innerHTML=`${st.sprites.length} sprites placed<br>${Object.entries(by).sort((a,b)=>b[1]-a[1]).map(([c,n])=>`${c}: ${n}`).join('<br>')}<br><br>${st.plan.roads.length} road cells · ${(st.plan.lots||[]).length} lots · ${(st.plan.reflections??st.plan.lamps??[]).length} reflections · ${(st.plan.paving||[]).length} pavement patches<br><span class="muted">Ground baked ${new Date(st.ver).toLocaleString()}</span>`;}
// ---------------------------------------------------------------- inspector
function contextPanels(){const m=st.mode,ground=['roads','lamps','lots'].includes(m);const bsec=$('#brushSection'),isec=$('#inspector'),idle=$('#idleSection');
 if(bsec)bsec.hidden=m!=='paint';if(isec)isec.hidden=m!=='select';if(idle)idle.hidden=m==='paint'||ground||m==='select'||st.sel.size>0;}
function inspector(){contextPanels();updateTask();const b=$('#selBody');const sel=st.sprites.filter(s=>st.sel.has(s.uid));
 if(!sel.length){b.className='muted';b.innerHTML='Nothing selected. Click a sprite in Select mode.';return;}b.className='';
 if(sel.length>1){b.innerHTML=`<p><b>${sel.length} sprites</b> selected.</p>
  <div class="row"><label for="iGroupScale">Resize (%)</label><input id="iGroupScale" type="number" min="1" step="1" value="100"></div>
  <label><input id="iGroupSpacing" type="checkbox" ${st.scaleGroupPositions!==false?'checked':''}> Scale spacing around group centre</label>
  <div class="btns"><button id="iGroupSmaller" title="Resize selection to 90%">−10%</button><button id="iGroupBigger" title="Resize selection to 110%">+10%</button><button id="iGroupApply">Apply resize</button></div>
  <p class="muted">Relative sizes are preserved. Uncheck spacing to resize sprites in place. [ / ] also resize the selection.</p>
  <div class="btns"><button id="iFlip">Mirror</button><button id="iDup">Duplicate</button><button id="iDel">Delete</button><button id="iPreset" title="Save these sprites as a reusable preset">Save as preset</button></div>${sel.every(o=>st.items.get(o.id).fence)?'<button id="iAlignFences" title="Align post bases to one grid axis and join the ends">Align fence run to grid</button>':''}${layerBtns()}`;
  $('#iGroupSpacing').onchange=e=>st.scaleGroupPositions=e.target.checked;
  $('#iGroupApply').onclick=()=>{const input=$('#iGroupScale');if(!input.checkValidity())return input.reportValidity();scaleSel(input.valueAsNumber/100);};
  $('#iGroupScale').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('#iGroupApply').click();}};
  $('#iGroupSmaller').onclick=()=>scaleSel(.9);$('#iGroupBigger').onclick=()=>scaleSel(1.1);
 }
 else{const s=sel[0],it=st.items.get(s.id);b.innerHTML=`<img src="${thumbSrc(it)}" alt="Selected object preview"><div><b>${it.name}</b></div><div class="muted" style="margin-bottom:6px">${it.category}</div>
  <div class="row"><span>X (m)</span><input type="number" step="0.25" id="iX" value="${s.x.toFixed(2)}"></div><div class="row"><span>Y (m)</span><input type="number" step="0.25" id="iY" value="${s.y.toFixed(2)}"></div>
  <div class="row"><span>Scale</span><input type="number" step="0.05" min="0.05" max="8" id="iS" value="${(s.scale||1).toFixed(2)}"></div>
  <div class="btns"><button id="iFlip">${s.flip?'Un-mirror':'Mirror'}</button><button id="iDup">Duplicate</button><button id="iBrush">Use as brush</button><button id="iDel">Delete</button></div>${layerBtns(s)}<div class="btns"><button id="iLights" title="Move, resize, recolour, add or remove the lights this object gives off at night">Edit its lights${s.lights?' (custom)':''}</button></div>`;
  fenceFallback(b.querySelector('img'),it);
  for(const [id,k] of [['iX','x'],['iY','y'],['iS','scale']])$('#'+id).onchange=e=>{const v=+e.target.value;if(e.target.value===''||!Number.isFinite(v)||(k==='scale'&&v<=0)){e.target.value=k==='scale'?(s.scale||1).toFixed(2):s[k];toast('Enter a number'+(k==='scale'?' above 0':''));return;}snapshot();s[k]=v;if(k==='scale')rememberSize(s.id,s[k]);save();req();};$('#iBrush').onclick=()=>pickBrush(s.id);}
 const il=$('#iLights');if(il)il.onclick=()=>editOwnLights(sel[0]);$('#iFlip').onclick=()=>flipSel();$('#iDup').onclick=()=>dupSel();$('#iDel').onclick=()=>delSel();const af=$('#iAlignFences');if(af)af.onclick=alignSelectedFences;const sp=$('#iPreset');if(sp)sp.onclick=saveSelPreset;$('#iFwd').onclick=()=>stepLayer(1);$('#iBk').onclick=()=>stepLayer(-1);const ig=$('#iGroup');if(ig)ig.onclick=groupSel;const iu=$('#iUngroup');if(iu)iu.onclick=ungroupSel;$('#iFront').onclick=()=>layerSel(1);$('#iBack').onclick=()=>layerSel(-1);const r=$('#iAuto');if(r)r.onclick=layerReset;}
function alignSelectedFences(){const selected=st.sprites.filter(o=>st.sel.has(o.uid)),fixed=alignFenceRun(selected,st.items);if(!fixed){toast('Select two or more fences facing the same grid axis.');return;}snapshot();const byId=new Map(fixed.map(o=>[o.uid,{...o,fencePlaneVersion:1}]));st.sprites=st.sprites.map(o=>byId.get(o.uid)||o);save();inspector();req();toast('Fence run aligned and joined. The first piece stays in place.');}
function layerBtns(s){const z=s?.z||0,sel=st.sprites.filter(o=>st.sel.has(o.uid)),grouped=sel.some(o=>o.g);return `<div class="btns"><button id="iFwd" title="Forward one (.)">Forward one</button><button id="iBk" title="Back one (,)">Back one</button>${sel.length>1?`<button id="iGroup" title="Ctrl+G">Group</button>`:''}${grouped?`<button id="iUngroup" title="Ctrl+Shift+G">Ungroup</button>`:''}</div><div class="btns"><button id="iFront" title="Draw on top of everything (Home)">Bring to front</button><button id="iBack" title="Draw under everything (End)">Move to back</button>${z?`<button id="iAuto" title="Back to automatic depth order">Auto order</button>`:''}</div>${z?`<div class="muted">Layer ${z>0?'+':''}${z} (overrides depth)</div>`:''}`;}
function flipSel(){if(!['paint','select'].includes(st.mode))return;if(!st.sel.size){if(st.mode==='paint'&&st.brush){st.brush.flip=!st.brush.flip;$('#bFlip').checked=st.brush.flip;req();}return;}snapshot();for(const s of st.sprites)if(st.sel.has(s.uid))s.flip=!s.flip;save();inspector();req();}
function dupSel(){if(!st.sel.size)return;snapshot();const n=[];for(const s of st.sprites)if(st.sel.has(s.uid))n.push({...s,uid:st.uid++,x:s.x+2,y:s.y+2});st.sprites.push(...n);st.sel=new Set(n.map(s=>s.uid));save();stats();inspector();req();}
function delSel(){if(!st.sel.size)return;snapshot();st.sprites=st.sprites.filter(s=>!st.sel.has(s.uid));st.sel.clear();save();stats();inspector();req();}
function scaleSel(f){if(!['paint','select'].includes(st.mode)||!Number.isFinite(f)||f<=0)return;if(!st.sel.size){if(st.mode==='paint'&&st.brush){st.brush.scale=Math.max(.4,Math.min(2.5,st.brush.scale*f));$('#bScale').value=st.brush.scale;$('#bScaleV').textContent=st.brush.scale.toFixed(2);rememberSize(st.brush.preset?'preset:'+st.brush.preset.id:st.brush.id,st.brush.scale);if(st.brush.preset)rerollPreset();req();}return;}
 const selected=st.sprites.filter(s=>st.sel.has(s.uid)),result=scaledSelection(selected,f,{movePositions:selected.length>1&&st.scaleGroupPositions!==false});if(!result){toast(f<1?'Already at the smallest size (5%) for something in the selection.':'Already at the largest size (800%) for something in the selection.');return;}
 for(const o of st.sprites)if(st.sel.has(o.uid))queueMicrotask(()=>rememberSize(o.id,o.scale||1));
 snapshot();for(let i=0;i<selected.length;i++)Object.assign(selected[i],result.items[i]);save();inspector();req();}
// ---------------------------------------------------------------- painting
/** Every 20 m cell that shows on the baked picture (same rule as gridRange in scripts/lib/town-builder-rules.mjs): the
 *  picture is the rectangle around the nx x ny diamond, so roads may be built right up to its edges, corners included. */
let gridCache=null;
function grid(){const nx=st.plan.nx,ny=st.plan.ny,shape=st.plan.groundShape;if(gridCache?.nx===nx&&gridCache.ny===ny&&gridCache.shape===shape)return gridCache;
 if(shape==='isometric')return gridCache={nx,ny,shape,...groundGrid(st.plan)};
 const S=32,M=60,W=(nx+ny)*20*S+2*M,H=(nx+ny)*10*S+2*M+200,OX=ny*20*S+M,OY=M+200;
 const toWorld=(sx,sy)=>{const a=(sx-OX)/S,b=(sy-OY)/(S/2);return [(a+b)/2,(b-a)/2];},inPic=(X,Y)=>{const sx=OX+(X-Y)*S,sy=OY+(X+Y)*S/2;return sx>=0&&sx<=W&&sy>=0&&sy<=H;};
 const cs=[[0,0],[W,0],[0,H],[W,H]].map(([x,y])=>toWorld(x,y)),cx0=Math.floor(Math.min(...cs.map(c=>c[0]))/20),cx1=Math.floor(Math.max(...cs.map(c=>c[0]))/20),cy0=Math.floor(Math.min(...cs.map(c=>c[1]))/20),cy1=Math.floor(Math.max(...cs.map(c=>c[1]))/20),on=new Set();
 for(let cy=cy0;cy<=cy1;cy++)for(let cx=cx0;cx<=cx1;cx++){let hit=false;for(let i=0;i<=4&&!hit;i++)for(let j=0;j<=4&&!hit;j++)hit=inPic(cx*20+i*5,cy*20+j*5);if(hit)on.add(cx+','+cy);}
 return gridCache={nx,ny,shape,cx0,cy0,cx1,cy1,has:(cx,cy)=>on.has(cx+','+cy)};}
/** interior of the road block containing (X,Y): between the sidewalks of the nearest road cells on all four sides */
function blockAt(X,Y){const R=new Set(st.plan.roads),ci=Math.floor(X/20),cj=Math.floor(Y/20);if(R.has(ci+','+cj))return null;
 const scan=(di,dj)=>{for(let n=1;n<=10;n++)if(R.has((ci+di*n)+','+(cj+dj*n)))return n;return null;};const w=scan(-1,0),e=scan(1,0),nn=scan(0,-1),s=scan(0,1);if(!w||!e||!nn||!s)return null;
 const x0=(ci-w)*20+15.3,x1=(ci+e)*20+4.7,y0=(cj-nn)*20+15.3,y1=(cj+s)*20+4.7;return {x0,x1,y0,y1,w:x1-x0,h:y1-y0,cx:(x0+x1)/2,cy:(y0+y1)/2};}
function brushPos(alt){const [X,Y]=m2w(st.mouse.mx,st.mouse.my),f=st.fenceStroke;st.snappedBlock=null;
 const ps=st.mode==='paint'&&!st.brush?.preset&&st.items.get(st.brush?.id)?.paint?.snap;if(ps&&!st.mouse.alt)return [Math.round(X/ps)*ps,Math.round(Y/ps)*ps];// slab joints line up between dabs
 const bp=st.brush?.preset;if(bp?.fit&&st.mode==='paint'&&$('#bSnap').checked&&!st.mouse.alt){const b=blockAt(X,Y),k=+$('#bScale').value||1;if(b&&Math.abs(b.w-bp.fit.w*k)<1.6&&Math.abs(b.h-bp.fit.h*k)<1.6){st.snappedBlock=b;return [b.cx,b.cy];}}if(f&&st.drag?.kind==='paint'){const i=Math.round(((f.axis==='x'?X:Y)-(f.axis==='x'?f.x:f.y))/f.step);return [f.x+(f.axis==='x'?i*f.step:0),f.y+(f.axis==='y'?i*f.step:0)];}if($('#bSnap').checked&&!st.mouse.alt)return [Math.round(X*4)/4,Math.round(Y*4)/4];return [X,Y];}
function placeAt(X,Y,first){const b=st.brush;if(!b)return;if(first)rememberSize(b.id,b.scale);const j=+$('#bJitter').value||0,v=(+$('#bVar').value||0)/100;
 const it=st.items.get(b.id);
 if(it.fence){
  const axis=fenceAxis(it,b.flip),step=it.fence.lengthM*b.scale;
  if(first||!st.fenceStroke||st.fenceStroke.axis!==axis||st.fenceStroke.id!==b.id||st.fenceStroke.step!==step){st.fenceStroke={id:b.id,x:X,y:Y,axis,step,min:0,max:0};
   st.sprites.push({uid:st.uid++,id:b.id,x:X,y:Y,flip:b.flip,scale:b.scale,fencePlaneVersion:1});return true;}
  const f=st.fenceStroke,index=Math.round(((axis==='x'?X:Y)-(axis==='x'?f.x:f.y))/step);
  const add=i=>st.sprites.push({uid:st.uid++,id:b.id,x:f.x+(axis==='x'?i*step:0),y:f.y+(axis==='y'?i*step:0),flip:b.flip,scale:b.scale,fencePlaneVersion:1});
  let added=false;while(f.max<index){add(++f.max);added=true;}while(f.min>index){add(--f.min);added=true;}return added;
 }
 if(j&&!first){X+=(Math.random()*2-1)*j;Y+=(Math.random()*2-1)*j;}
 const flip=$('#bRandFlip').checked?Math.random()<.5:b.flip,scale=+(b.scale*(1+(Math.random()*2-1)*v)).toFixed(3);
 st.sprites.push({uid:st.uid++,id:b.id,x:+X.toFixed(2),y:+Y.toFixed(2),flip,scale,...(st.items.get(b.id).fence?{fencePlaneVersion:1}:{}),...(it.paint?{z:-100}:{})});} // ground paint sits under leaves and litter
// ---------------------------------------------------------------- ground plan editing
function roadStroke(X0,Y0,X1,Y1,drag){
 const dx=X1-X0,dy=Y1-Y0,steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/4));
 for(let n=0;n<=steps;n++){
  const cx=Math.floor((X0+dx*n/steps)/20),cy=Math.floor((Y0+dy*n/steps)/20),key=cx+','+cy;
  if(!grid().has(cx,cy)||drag.visited.has(key))continue;drag.visited.add(key);
  const i=st.plan.roads.indexOf(key);if(drag.erase?i<0:i>=0)continue;
  if(!drag.changed){snapshot();drag.changed=true;}
  if(drag.erase)st.plan.roads.splice(i,1);else st.plan.roads.push(key);
 }
 if(drag.changed){st.planDirty=true;savePlan();stats();req();}
}
function groundPaint(X,Y,erase,first=true){
 if(!grid().has(Math.floor(X/20),Math.floor(Y/20)))return;
 X=Math.round(X*4)/4;Y=Math.round(Y*4)/4;const light=st.mode==='lamps',list=light?(st.plan.reflections??=[]):(st.plan.paving??=[]);
 let i=-1;if(erase){if(light){let d=3;list.forEach((l,k)=>{const v=Math.hypot(l.x-X,l.y-Y);if(v<d){d=v;i=k;}});}else{for(let k=list.length-1;k>=0;k--){const p=list[k];if(X>=p.x0&&X<=p.x1&&Y>=p.y0&&Y<=p.y1){i=k;break;}}}if(i<0)return;}
 if(first)snapshot();
 if(light)queueGlowPreview([erase?[list[i].x,list[i].y,list[i].scale]:[X,Y,st.lightSize??1]]);
 if(erase)list.splice(i,1);
 else if(light)list.push({id:'glow-'+newId(),x:X,y:Y,free:st.lightSnap===false,strength:st.lightStrength??1,scale:st.lightSize??1,...(st.lightTint?{tint:st.lightTint}:{})});
 else{const w=st.paveW??4,h=st.paveH??2;list.push({id:'pave-'+newId()+'-'+list.length,x0:X-w/2,y0:Y-h/2,x1:X+w/2,y1:Y+h/2});}
 st.planDirty=true;savePlan();stats();req();
}
// ---------------------------------------------------------------- input
view.addEventListener('contextmenu',e=>e.preventDefault());
view.addEventListener('pointerdown',e=>{if(!st.ready)return;view.setPointerCapture(e.pointerId);const [mx,my]=s2m(e.offsetX,e.offsetY);st.mouse={...st.mouse,sx:e.offsetX,sy:e.offsetY,mx,my,down:true,alt:e.altKey,in:true};
 const [X,Y]=m2w(mx,my);
 if(e.button===2||e.button===1||st.space||st.mode==='pan'){st.drag={kind:'pan',sx:e.offsetX,sy:e.offsetY,cx:st.cam.x,cy:st.cam.y};view.style.cursor='grabbing';return;}
 if(st.mode==='walk'){[walk.x,walk.y]=freeNear(X,Y);return;}// a click puts the kid on the nearest free ground there
 if(st.mode==='spots'){spotDown(X,Y,e);return;}
 if(st.mode==='paint'){if(e.altKey){const s=hit(mx,my);if(s)pickBrush(s.id);return;}if(!st.brush){toast('Pick a sprite or a preset on the left first');return;}snapshot();const [bx,by]=brushPos();if(st.brush.preset){stampPreset(bx,by);st.drag={kind:'paint',last:[bx,by]};save();stats();req();return;}placeAt(bx,by,true);st.drag={kind:'paint',last:[bx,by]};save();stats();req();return;}
 if(st.mode==='select'){const s=hit(mx,my);
  if(s){const members=s.g&&!e.altKey?st.sprites.filter(o=>o.g===s.g).map(o=>o.uid):[s.uid];if(e.shiftKey){const on=st.sel.has(s.uid);for(const u of members)on?st.sel.delete(u):st.sel.add(u);}else if(!st.sel.has(s.uid)){st.sel=new Set(members);}st.drag={kind:'move',start:[X,Y],moved:false};}
  else{if(!e.shiftKey)st.sel.clear();st.drag={kind:'box',m0:[mx,my]};}inspector();req();return;}
 if(st.mode==='roads'){st.drag={kind:'roadPaint',last:[X,Y],erase:st.roadTool==='remove'||e.shiftKey,visited:new Set(),changed:false};roadStroke(X,Y,X,Y,st.drag);return;}
 if(st.mode==='lamps'&&st.glowTool==='edit'){glowDown(X,Y,mx,my);return;}
 if(st.mode==='lamps'||st.mode==='paving'){snapshot();groundPaint(X,Y,st.groundErase||e.shiftKey,false);st.drag={kind:'groundPaint',last:[X,Y],erase:st.groundErase||e.shiftKey};return;}
 if(st.mode==='lots'&&st.lotTool==='select'){const h=lotHandleAt(mx,my);
  if(h){snapshot();st.drag={kind:'lotResize',corner:h};return;}
  const g=groundAt(X,Y);if(!g){st.selLot=null;st.selPave=null;groundPanel();req();return;}
  if(g.kind==='lot'){st.selLot=g.i;st.selPave=null;}else{st.selPave=g.i;st.selLot=null;}groundPanel();
  st.drag={kind:'lotMove',start:[X,Y],moved:false};req();return;}
 if(st.mode==='lots'&&st.lotTool==='brush'){if(st.lotSurf==='paving'){st.lotSurf='slab';toast('Painted shapes use the Plaza (slabs) surface; set Edge to No border for a plain patch');groundPanel();}
  snapshot();const lot=paintTarget();lotDab(lot,X,Y,e.shiftKey);st.drag={kind:'lotPaint',last:[X,Y],erase:e.shiftKey,lot};req();return;}
 if(st.mode==='lots'){const q=st.lotSurf==='paving'?v=>Math.round(v*4)/4:Math.round;st.drag={kind:'lot',a:[q(X),q(Y)],b:[q(X),q(Y)]};return;}});
view.addEventListener('pointermove',e=>{const [mx,my]=s2m(e.offsetX,e.offsetY);st.mouse={...st.mouse,sx:e.offsetX,sy:e.offsetY,mx,my,alt:e.altKey,in:true};const d=st.drag;
 town.cursor(mx,my,st.mode);
 if(d?.kind==='pan'){st.cam.x=d.cx-(e.offsetX-d.sx)/st.cam.z;st.cam.y=d.cy-(e.offsetY-d.sy)/st.cam.z;}
 else if(d?.kind==='paint'){const [bx,by]=brushPos();if(!st.brush.preset&&st.items.get(st.brush.id).fence){if(placeAt(bx,by,false)){d.last=[bx,by];save();stats();}}else{const sp=+$('#bSpacing').value;if(sp>0&&Math.hypot(bx-d.last[0],by-d.last[1])>=sp){if(st.brush.preset)stampPreset(bx,by);else placeAt(bx,by,false);d.last=[bx,by];save();stats();}}}
 else if(d?.kind==='move'){const [X,Y]=m2w(mx,my);let dx=X-d.start[0],dy=Y-d.start[1];if(!st.mouse.alt){dx=Math.round(dx*4)/4;dy=Math.round(dy*4)/4;}
  if(dx||dy){if(!d.moved){snapshot();d.moved=true;}for(const s of st.sprites)if(st.sel.has(s.uid)){s.x=+(s.x+dx).toFixed(2);s.y=+(s.y+dy).toFixed(2);}d.start=[d.start[0]+dx,d.start[1]+dy];save();inspector();}}
 else if(d?.kind==='roadPaint'){const [X,Y]=m2w(mx,my);roadStroke(...d.last,X,Y,d);d.last=[X,Y];}
 else if(d?.kind==='glowMove'){const [X,Y]=m2w(mx,my),nx=Math.round((d.from[0]+X-d.start[0])*4)/4,ny=Math.round((d.from[1]+Y-d.start[1])*4)/4;if(nx!==d.o.x||ny!==d.o.y){if(!d.moved){snapshot();d.moved=true;}d.o.x=nx;d.o.y=ny;req();}}
 else if(d?.kind==='spotHandle'){const [X,Y]=m2w(mx,my);if(!d.moved){snapshot();d.moved=true;}spotHandleDrag(d,X,Y,e.shiftKey,e.altKey);req();}
 else if(d?.kind==='spot'){const [X,Y]=m2w(mx,my),dx=X-d.start[0],dy=Y-d.start[1];if(Math.hypot(dx,dy)>.05){if(!d.moved){snapshot();d.moved=true;}d.o.x=+(d.o.x+dx).toFixed(2);d.o.y=+(d.o.y+dy).toFixed(2);if(d.o.pts)d.o.pts=d.o.pts.map(([x,y])=>[+(x+dx).toFixed(2),+(y+dy).toFixed(2)]);d.start=[X,Y];req();}}
 else if(d?.kind==='groundPaint'){const [X,Y]=m2w(mx,my),spacing=d.erase?.5:st.mode==='lamps'?8:Math.max(.5,Math.min(st.paveW??4,st.paveH??2)*.65);if(Math.hypot(X-d.last[0],Y-d.last[1])>=spacing){groundPaint(X,Y,d.erase,false);d.last=[X,Y];}}
 else if(d?.kind==='lotMove'){const [X,Y]=m2w(mx,my);let dx=X-d.start[0],dy=Y-d.start[1];if(!st.mouse.alt){dx=Math.round(dx*4)/4;dy=Math.round(dy*4)/4;}
  if(dx||dy){if(!d.moved){snapshot();d.moved=true;}moveGround(selGround(),dx,dy);d.start=[d.start[0]+dx,d.start[1]+dy];}}
 else if(d?.kind==='lotResize'){const [X,Y]=m2w(mx,my),o=selGround();if(o&&!o.stamps){const q=v=>st.mouse.alt?+v.toFixed(2):Math.round(v*4)/4,c=d.corner;
  if(c.includes('w'))o.x0=Math.min(q(X),o.x1-1);if(c.includes('e'))o.x1=Math.max(q(X),o.x0+1);if(c.includes('n'))o.y0=Math.min(q(Y),o.y1-1);if(c.includes('s'))o.y1=Math.max(q(Y),o.y0+1);}}
 else if(d?.kind==='lotPaint'){const [X,Y]=m2w(mx,my),step=Math.max(.25,st.lotSize*.45),dist=Math.hypot(X-d.last[0],Y-d.last[1]);
  if(dist>=step){const n=Math.floor(dist/step);for(let i=1;i<=n;i++)lotDab(d.lot,d.last[0]+(X-d.last[0])*i/n,d.last[1]+(Y-d.last[1])*i/n,d.erase);d.last=[X,Y];}}
 else if(d?.kind==='lot'){const [X,Y]=m2w(mx,my),q=st.lotSurf==='paving'?v=>Math.round(v*4)/4:Math.round;d.b=[q(X),q(Y)];}
 req();});
view.addEventListener('pointerup',e=>{const d=st.drag;st.drag=null;if(d?.kind==='glowMove'&&d.moved){savePlan();queueGlowPreview([[...d.from,d.o.scale],[d.o.x,d.o.y,d.o.scale]]);}if((d?.kind==='spot'||d?.kind==='spotHandle')&&d.moved){saveSpots();spotsPanel();}st.fenceStroke=null;st.mouse.down=false;if(st.mode==='pan'||!d)view.style.cursor=st.mode==='pan'?'grab':view.style.cursor;
 if(d?.kind==='pan')view.style.cursor=st.mode==='pan'?'grab':st.mode==='select'?'default':'crosshair';
 if(d?.kind==='roadPaint'){groundPanel();}
 if(d?.kind==='box'){const [ax,ay]=d.m0,bx=st.mouse.mx,by=st.mouse.my;if(Math.abs(bx-ax)>4/st.cam.z){const x0=Math.min(ax,bx),x1=Math.max(ax,bx),y0=Math.min(ay,by),y1=Math.max(ay,by);
  for(const s of st.sprites){const [mx,my]=w2m(s.x,s.y);if(mx>=x0&&mx<=x1&&my>=y0&&my<=y1)st.sel.add(s.uid);}expandGroups();inspector();}}
 if((d?.kind==='lotMove'&&d.moved)||d?.kind==='lotResize'){st.planDirty=true;savePlan();stats();groundPanel();}
 if(d?.kind==='lotPaint'){const l=d.lot;if(!l.stamps.some(t=>!t.neg)){st.plan.lots.splice(st.plan.lots.indexOf(l),1);st.paintLot=null;st.selLot=null;}else lotBounds(l);st.planDirty=true;savePlan();stats();groundPanel();}
 if(d?.kind==='lot'&&st.lotSurf==='paving'){const [x0,y0]=d.a,[x1,y1]=d.b;if(Math.abs(x1-x0)>=.75&&Math.abs(y1-y0)>=.75){snapshot();(st.plan.paving??=[]).push({id:'pave-'+newId(),x0:Math.min(x0,x1),y0:Math.min(y0,y1),x1:Math.max(x0,x1),y1:Math.max(y0,y1),...(st.lotEdge==='none'?{border:'none'}:{})});st.selPave=st.plan.paving.length-1;st.selLot=null;st.lotTool='select';st.planDirty=true;savePlan();stats();groundPanel();}else toast('Drag a larger footpath: at least 0.75 m wide and deep.');}
 else if(d?.kind==='lot'){const [x0,y0]=d.a,[x1,y1]=d.b;if(Math.abs(x1-x0)>=4&&Math.abs(y1-y0)>=4){snapshot();const surf=st.lotSurf||'asphalt';
  st.plan.lots=st.plan.lots||[];st.plan.lots.push({id:'lot-'+newId(),x0:Math.min(x0,x1),y0:Math.min(y0,y1),x1:Math.max(x0,x1),y1:Math.max(y0,y1),surface:surf,auto:surf==='asphalt'||surf==='slab',border:st.lotEdge==='none'||st.lotEdge==='curb'?st.lotEdge:undefined});
  st.selLot=st.plan.lots.length-1;st.selPave=null;st.lotTool='select';st.planDirty=true;savePlan();stats();groundPanel();}else toast('Drag a larger area: lots must be at least 4 m wide and deep.');}
 req();});
view.addEventListener('pointerleave',()=>{st.mouse.in=false;req();});
view.addEventListener('wheel',e=>{e.preventDefault();const [mx,my]=s2m(e.offsetX,e.offsetY),f=Math.exp(-e.deltaY*.0015),z=Math.max(.04,Math.min(4,st.cam.z*f));st.cam.z=z;
 st.cam.x=mx-(e.offsetX-view.clientWidth/2)/z;st.cam.y=my-(e.offsetY-view.clientHeight/2)/z;req();},{passive:false});
mini.addEventListener('pointerdown',e=>{const go=ev=>{if(!st.miniK)return;const {k,ox,oy}=st.miniK;st.cam.x=(ev.offsetX-ox)/k;st.cam.y=(ev.offsetY-oy)/k;req();};go(e);mini.setPointerCapture(e.pointerId);mini.onpointermove=ev=>{if(ev.buttons)go(ev);};});
window.addEventListener('keydown',e=>{if(!st.ready||e.target.matches('input,select,textarea'))return;if(st.mode==='walk'&&walkKey(e,true))return;
 if(st.mode==='lamps'&&st.glowTool==='edit'){if((e.ctrlKey||e.metaKey)&&['c','v','d'].includes(e.key.toLowerCase())){e.preventDefault();glowClip(e.key.toLowerCase());return;}
  if(st.selGlow&&(e.key==='Delete'||e.key==='Backspace')){e.preventDefault();glowDelete();return;}}
 if(st.mode==='spots'&&(e.ctrlKey||e.metaKey)&&['c','v','d'].includes(e.key.toLowerCase())){e.preventDefault();spotClipKey(e.key.toLowerCase());return;}
 if(st.mode==='spots'&&spot.sel&&(e.key==='Delete'||e.key==='Backspace')){e.preventDefault();document.activeElement?.blur?.();snapshot();setSpots(spots().filter(x=>x!==spot.sel));spot.sel=null;saveSpots();spotsPanel();req();return;}if(e.key==='n'&&!e.ctrlKey&&!e.metaKey&&!e.altKey){nightPreview=!nightPreview;try{localStorage.setItem('mf-night-preview',nightPreview?'1':'0');}catch{}const cb=$('#nPreview');if(cb)cb.checked=nightPreview;req();return;}const k=e.key.toLowerCase();
 if(e.key==='Shift'){st.shiftHeld=true;req();}
 if(e.key===' '){st.space=true;view.style.cursor='grab';e.preventDefault();return;}
 if((e.ctrlKey||e.metaKey)&&k==='z'){e.preventDefault();e.shiftKey?redo():undo();return;}if((e.ctrlKey||e.metaKey)&&k==='y'){e.preventDefault();redo();return;}
 if((e.ctrlKey||e.metaKey)&&k==='d'){e.preventDefault();if(st.mode==='lots'&&st.lotTool==='select')$('#gDup')?.click();else if(st.mode==='select')dupSel();return;}
 if((e.ctrlKey||e.metaKey)&&k==='c'){e.preventDefault();copySel();return;}
 if((e.ctrlKey||e.metaKey)&&k==='v'){e.preventDefault();pasteAtCursor();return;}
 if((e.ctrlKey||e.metaKey)&&k==='g'){e.preventDefault();e.shiftKey?ungroupSel():groupSel();return;}
 if(e.key==='.'||e.key==='>'||e.key==='PageUp'){e.preventDefault();stepLayer(1);return;}if(e.key===','||e.key==='<'||e.key==='PageDown'){e.preventDefault();stepLayer(-1);return;}
 if(e.key==='+'){scaleSel(1.1);return;}if(e.key==='_'){scaleSel(1/1.1);return;}
 if(k==='v')setMode('select');else if(k==='b')setMode('paint');else if(k==='h')setMode('pan');else if(k==='r')setMode('roads');else if(k==='l')setMode('lamps');else if(k==='k')setMode('lots');else if(k==='u')setMode('paving');else if(k==='j')setMode('streetlights');else if(k==='t'&&!e.ctrlKey)setMode('walk');else if(k==='y'&&!e.ctrlKey&&!e.metaKey)setMode('spots');
 else if(e.key==='}'){e.preventDefault();scaleSel(1.25);}else if(e.key==='{'){e.preventDefault();scaleSel(1/1.25);}else if(e.key==='Home'){e.preventDefault();layerSel(1);}else if(e.key==='End'){e.preventDefault();layerSel(-1);}else if(k==='f')flipSel();else if(st.mode==='lots'&&st.lotTool==='brush'&&(k==='['||k===']'||k==='-'||k==='=')){st.lotSize=Math.max(.5,Math.min(10,st.lotSize*(k===']'||k==='='?1.15:1/1.15)));groundPanel();req();}
 else if(k==='['||k==='-')scaleSel(1/1.1);else if(k===']'||k==='=')scaleSel(1.1);
 else if(k==='delete'||k==='backspace'){if(st.mode==='lots'&&st.lotTool==='select'&&st.selPave!=null){delPave();}else if(st.mode==='lots'&&st.lotTool==='select'&&st.selLot!=null){snapshot();st.plan.lots.splice(st.selLot,1);st.selLot=null;st.paintLot=null;st.planDirty=true;savePlan();stats();groundPanel();req();}else if(st.mode==='select')delSel();}
 else if(k==='escape'){st.sel.clear();st.selLot=null;st.selPave=null;st.paintLot=null;if(st.mode==='paint')setMode('select');if(st.mode==='lots')setLotTool('select');inspector();req();}
 else if(k==='g'){st.show.grid=!st.show.grid;$('#tGrid').checked=st.show.grid;req();}else if(k==='p'){st.show.poi=!st.show.poi;$('#tPoi').checked=st.show.poi;req();}else if(k==='o'){st.show.plan=!st.show.plan;$('#tPlan').checked=st.show.plan;req();}
 else if(k==='?'){$('#help').hidden=false;}else if(k==='s'&&!e.ctrlKey){st.show.shadows=!st.show.shadows;$('#tShadow').checked=st.show.shadows;req();}
 else if(e.key.startsWith('Arrow')&&st.mode==='lots'&&st.lotTool==='select'&&selGround()){e.preventDefault();const d=e.shiftKey?2:.25,[dx,dy]={ArrowUp:[0,-d],ArrowDown:[0,d],ArrowLeft:[-d,0],ArrowRight:[d,0]}[e.key];snapshot();moveGround(selGround(),dx,dy);st.planDirty=true;savePlan();groundPanel();}
 else if(e.key.startsWith('Arrow')&&st.sel.size){e.preventDefault();const d=e.shiftKey?2:.25,[dx,dy]={ArrowUp:[0,-d],ArrowDown:[0,d],ArrowLeft:[-d,0],ArrowRight:[d,0]}[e.key];snapshot();for(const s of st.sprites)if(st.sel.has(s.uid)){s.x+=dx;s.y+=dy;}save();inspector();req();}});
window.addEventListener('keyup',e=>{if(st.mode==='walk')walkKey(e,false);if(e.key==='Shift'){st.shiftHeld=false;req();}if(e.key===' '){st.space=false;view.style.cursor=st.mode==='pan'?'grab':st.mode==='select'?'default':'crosshair';}});
window.addEventListener('resize',req);window.addEventListener('blur',()=>walk.keys.clear());
// ---------------------------------------------------------------- top bar
for(const b of $$('#tools button'))b.onclick=()=>setMode(b.dataset.mode);
$('#tGrid').onchange=e=>{st.show.grid=e.target.checked;req();};$('#tPoi').onchange=e=>{st.show.poi=e.target.checked;req();};$('#tPlan').onchange=e=>{st.show.plan=e.target.checked;req();};$('#tShadow').onchange=e=>{st.show.shadows=e.target.checked;req();};
$('#undo').onclick=undo;$('#redo').onclick=redo;$('#helpBtn').onclick=()=>$('#help').hidden=false;$('#helpClose').onclick=()=>$('#help').hidden=true;
$('#search').oninput=e=>{st.filter=e.target.value;buildPalette();};
$('#bScale').oninput=e=>{$('#bScaleV').textContent=(+e.target.value).toFixed(2);if(st.brush){st.brush.scale=+e.target.value;rememberSize(st.brush.preset?'preset:'+st.brush.preset.id:st.brush.id,st.brush.scale);if(st.brush.preset)rerollPreset();}req();};$('#bFlip').onchange=e=>{if(st.brush)st.brush.flip=e.target.checked;req();};
function toast(html,ms=4000){const t=$('#toast');t.innerHTML=html;t.style.display='block';clearTimeout(t._t);if(ms)t._t=setTimeout(()=>t.style.display='none',ms);}
$('#exportBtn').onclick=async()=>{const b=$('#exportBtn');b.disabled=true;toast('Exporting: composing every sprite over the full-resolution map… (about a minute)',0);
 try{clearTimeout(saveT);await town.save('layout');st.saved=true;setSave('saved','ok');const r=await fetch('/api/export',{method:'POST'});const j=await r.json();if(!r.ok)throw Error(j.error);
  toast(`Exported ${j.sprites} sprites. <a href="${j.half}" target="_blank">Open the half-size picture</a><br><span class="muted">Full-resolution tiles: ${j.dir}</span>`,0);}catch(e){toast('Export failed: '+e.message);}b.disabled=false;};
$('#bakeBtn').onclick=async()=>{if($('#bakeBtn').disabled)return;$('#bakeBtn').disabled=true;st.bakeError=null;req();
 const version=planSaveVersion;
 try{clearTimeout(planT);await town.save('plan');if(version===planSaveVersion)st.planSavePending=false;st.planSaveError=false;
 const r=await fetch('/api/bake',{method:'POST'});if(!r.ok)throw Error((await r.json()).error);st.bakeFrom=version;$('#bakeBtn').classList.remove('attention');pollBake();}catch(e){$('#bakeBtn').disabled=false;req();st.bakeError=e.message;toast('Ground update failed: '+e.message,0);}};
// The bake runs in its own process; the server can restart mid-bake (code edits, node --watch). Keep asking for up to
// two minutes before giving up, so a restart is not reported as a failed rebuild.
async function pollBake(misses=0){try{
 let r;try{r=await fetch('/api/bake',{cache:'no-store'});if(!r.ok)throw Error('status '+r.status);}
 catch(e){if(misses<48){toast('Rebuilding ground... (reconnecting to the builder)',0);setTimeout(()=>pollBake(misses+1),2500);return;}throw Error('Lost contact with the builder for two minutes. The rebuild may still finish: reload to check.');}const b=await r.json(),log=b.log||[],head=log.find(l=>l.startsWith('{"W"'));let total=0;try{total=JSON.parse(head).tiles;}catch{}
 const last=[...log].reverse().find(l=>/tiles,/.test(l)),n=last?+last.split(' ')[0]:0;
 if(b.running){toast(`Rebuilding ground... ${n}${total?' / '+total:''} tiles. Removed roads and lots will become grass.`,0);setTimeout(()=>pollBake(0),2500);return;}
 $('#bakeBtn').disabled=false;
 if(b.code===0){let man;for(let i=0;;i++){try{man=await (await fetch('/map/manifest.json',{cache:'no-store'})).json();break;}catch(e){if(i>=20)throw e;await new Promise(r=>setTimeout(r,1500));}}const later=man.groundPlan?!groundMatches(st.plan,man.groundPlan):st.bakeFrom!=null&&planSaveVersion!==st.bakeFrom;
  st.bakeFrom=null;st.bakeError=null;st.glowPatches=[];st.bakedGround=man.groundPlan||structuredClone(groundState(st.plan));st.planDirty=later;$('#bakeBtn').classList.toggle('attention',later);adoptMap(man);st.ver=Date.parse(man.bakedAt)||Date.now();tiles.clear();st.miniImg.src='/map/preview.webp?v='+st.ver;stats();toast(later?'Rebuild finished. Newer edits are saved but need another Rebuild ground.':'Ground rebuilt. Deleted roads, lots, paving and light glow have been removed.');
 }else{st.bakeError=log.slice(-2).join(' ');st.planDirty=true;toast('Ground rebuild failed. Your edits are saved; the previous ground is still displayed.<br>'+st.bakeError,0);}
 req();
 }catch(e){$('#bakeBtn').disabled=false;st.bakeError=e.message;req();toast('Ground rebuild could not finish: '+e.message,0);}}
load().then(()=>requestAnimationFrame(draw)).catch(e=>{toast('Could not load: '+e.message,0);console.error(e);});

// ---------------------------------------------------------------- presets (stamps)
async function loadPresets(){try{const r=await fetch('/api/presets',{cache:'no-store'});if(!r.ok)throw Error('preset library '+r.status);const j=await r.json();st.presets=j.presets||[];st.presetVer=Date.now();if(st.brush?.preset){const updated=st.presets.find(p=>p.id===st.brush.preset.id);if(updated){st.brush.preset=updated;rerollPreset();}}buildPalette();}catch(e){st.presets=[];console.warn(e);}}
function buildPresetPalette(g){g.innerHTML='';const q=st.filter.toLowerCase();
 for(const grp of [...new Set(st.presets.map(p=>p.group))]){const list=st.presets.filter(p=>p.group===grp&&(!q||(p.name+' '+p.desc).toLowerCase().includes(q)));if(!list.length)continue;
  const h=document.createElement('div');h.className='pgroup';h.textContent=grp;g.append(h);
  for(const p of list){const d=document.createElement('div');d.className='tile'+(st.brush?.preset?.id===p.id?' on':'');d.title=`${p.name}\n${p.desc||''}\n${p.count} members · about ${Math.round((p.spanM||2)*2)} m across`;
   d.innerHTML=`<img loading="lazy" src="/${p.thumb||'library/'+st.items.get(p.members[0].pick[0])?.thumb}?v=${st.presetVer}" alt=""><span>${p.name}</span>`;d.onclick=()=>pickPreset(p.id);g.append(d);}}}
function pickPreset(id){const p=st.presets.find(x=>x.id===id),sc=lastSize['preset:'+id]||1;setBrushScaleUI(sc);st.brush={preset:p,id:null,scale:sc,flip:false};rerollPreset();
 $('#brushThumb').src=p.thumb?'/'+p.thumb:'/library/'+st.items.get(p.members[0].pick[0]).thumb;$('#brushName').textContent=p.name;$('#brushMeta').innerHTML=`${p.desc||''}<br>Fixed layout — every stamp is identical. Scale resizes the whole area.${p.fit?`<br>Made for a ${p.fit.w} × ${p.fit.h} m road block: it snaps to the centre of a block that size (hold Alt to place it freely).`:''}`;
 if(!+$('#bSpacing').value)$('#bSpacing').value=Math.max(4,Math.round((p.spanM||3)*1.6));setMode('paint');buildPalette();}
function rollPreset(p){return fixedPresetRoll(p,+$('#bScale').value||1).filter(m=>st.items.has(m.id));}
function rerollPreset(){if(st.brush?.preset){st.brush.roll=rollPreset(st.brush.preset);req();}}
function sortMembers(list){return list.slice().sort((a,b)=>{const fa=st.items.get(a.id).flat,fb=st.items.get(b.id).flat;if(fa!==fb)return fa?-1:1;return (a.dx+a.dy)-(b.dx+b.dy);});}
function stampPreset(X,Y){rememberSize('preset:'+st.brush.preset.id,+$('#bScale').value||1);stampGround(st.brush.preset,X,Y);const g=st.brush.roll.length>1?'g'+newId()+Math.floor(Math.random()*1e4):undefined;for(const m of st.brush.roll){const o={uid:st.uid++,id:m.id,x:X+m.dx,y:Y+m.dy,flip:m.flip,scale:m.scale};if(m.z!=null)o.z=m.z;if(m.o!=null)o.o=m.o;if(st.items.get(m.id).fence)o.fencePlaneVersion=1;if(g)o.g=g;st.sprites.push(o);}}
async function saveSelPreset(){const sel=st.sprites.filter(s=>st.sel.has(s.uid));if(sel.length<2){toast('Select two or more sprites first');return;}
 const name=prompt('Name for this preset:','My arrangement');if(!name)return;
 const cx=sel.reduce((a,s)=>a+s.x,0)/sel.length,cy=sel.reduce((a,s)=>a+s.y,0)/sel.length;
 const members=sel.map(s=>({dx:s.x-cx,dy:s.y-cy,pick:[s.id],flip:!!s.flip,scale:[s.scale||1,s.scale||1],jitter:0,chance:1,...(s.z!=null?{z:s.z}:{}),...(s.o!=null?{o:s.o}:{})}));
 const p={id:'user-'+newId(),name,group:'My presets',desc:`Fixed arrangement of ${sel.length} sprites`,members,fixed:true,turn:false,mirror:false,count:members.length,spanM:Math.max(...members.map(m=>Math.hypot(m.dx,m.dy)))};
 const r=await fetch('/api/presets',{method:'POST',body:JSON.stringify(p)});const j=await r.json();if(!r.ok){toast('Could not save preset: '+j.error);return;}
 await loadPresets();st.cat='Presets';buildPalette();toast(`Saved preset “${name}” under My presets.`);}
// ---------------------------------------------------------------- base shadow: one pre-blurred ellipse image, scaled under each upright sprite (one extra draw)
const shadowImg=(()=>{const c=document.createElement('canvas');c.width=128;c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(64,64,0,64,64,64);
 g.addColorStop(0,'rgba(6,8,12,.5)');g.addColorStop(.5,'rgba(6,8,12,.32)');g.addColorStop(.82,'rgba(6,8,12,.08)');g.addColorStop(1,'rgba(6,8,12,0)');x.setTransform(1,0,0,.5,0,0);x.fillStyle=g;x.fillRect(0,0,128,128);return c;})();
const shadowImgs=new Map();
/** The sprite's own base shadow (library/shadows/*.webp, made by shadows.mjs): its footprint, trunk or pole base, feathered.
 *  Mirroring the sprite mirrors the shadow, which swaps its ground axes exactly like the footprint. */
function shadow(X,Y,it,flip,k){const sh=it.shadow;if(!sh)return;let im=shadowImgs.get(it.id);if(!im){im=new Image();im.onload=req;im.src='/library/'+sh.file+'?v='+(st.libraryVer||st.ver)+'-'+sh.v;shadowImgs.set(it.id,im);}if(!im.complete||!im.naturalWidth)return;
 const [mx,my]=w2m(X,Y),cy=my+(sh.dy||0)*k,w=sh.w*k,h=sh.h*k;
 if(flip){ctx.save();ctx.translate(mx,0);ctx.scale(-1,1);ctx.drawImage(im,-sh.ax*k,cy-sh.ay*k,w,h);ctx.restore();}else ctx.drawImage(im,mx-sh.ax*k,cy-sh.ay*k,w,h);}
function groupSel(){if(st.sel.size<2){toast('Select two or more sprites to group');return;}snapshot();const g='g'+newId();for(const o of st.sprites)if(st.sel.has(o.uid))o.g=g;save();inspector();toast('Grouped '+st.sel.size+' sprites. Click any of them to pick up the group; Alt-click for one.');}
function ungroupSel(){if(!st.sel.size)return;snapshot();for(const o of st.sprites)if(st.sel.has(o.uid))delete o.g;save();inspector();}
function expandGroups(){const gs=new Set(st.sprites.filter(o=>st.sel.has(o.uid)&&o.g).map(o=>o.g));if(gs.size)for(const o of st.sprites)if(gs.has(o.g))st.sel.add(o.uid);}
/** Forward / back one: past the next sprite in draw order that overlaps the selection (same ground/upright class). */
function stepLayer(dir){if(!st.sel.size)return;const order=sorted(),sels=order.filter(o=>st.sel.has(o.uid)),flat=!!st.items.get(sels[0].id).flat,rects=sels.map(rect);
 const ov=(a,b)=>!(a.left>b.left+b.w||b.left>a.left+a.w||a.top>b.top+b.h||b.top>a.top+a.h);const idx=order.map((o,i)=>st.sel.has(o.uid)?i:-1).filter(i=>i>=0),start=dir>0?Math.max(...idx):Math.min(...idx);
 let nb=null;for(let i=start+dir;i>=0&&i<order.length;i+=dir){const o=order[i];if(st.sel.has(o.uid)||!!st.items.get(o.id).flat!==flat)continue;if(rects.some(a=>ov(a,rect(o)))){nb=o;break;}}
 if(!nb){toast(dir>0?'Already in front of everything it overlaps':'Already behind everything it overlaps');return;}
 // Slot in right after (or before) that neighbour in depth order: a tiny depth offset 'o', same layer as the neighbour.
 const key=o=>o.x+o.y+(o.o||0),nk=key(nb),same=order.filter(o=>!st.sel.has(o.uid)&&!!st.items.get(o.id).flat===flat&&(o.z||0)===(nb.z||0)).map(key).sort((a,b)=>a-b);
 const nbr=dir>0?same.find(v=>v>nk+1e-7):[...same].reverse().find(v=>v<nk-1e-7),target=nbr===undefined?nk+dir*.01:(nk+nbr)/2;
 snapshot();for(const o of sels){if(nb.z)o.z=nb.z;else delete o.z;const off=+(target-(o.x+o.y)).toFixed(5);if(Math.abs(off)<1e-6)delete o.o;else o.o=off;}save();inspector();req();}
function delPave(){if(st.selPave==null||!st.plan.paving?.[st.selPave])return;snapshot();st.plan.paving.splice(st.selPave,1);st.selPave=null;st.planDirty=true;savePlan();stats();groundPanel();req();}

// ---------------------------------------------------------------- lot paint brush (circle / isometric square stamps)
function lotBounds(l){const pos=l.stamps.filter(t=>!t.neg);if(!pos.length)return;l.x0=+Math.min(...pos.map(t=>t.x-t.r)).toFixed(2);l.x1=+Math.max(...pos.map(t=>t.x+t.r)).toFixed(2);l.y0=+Math.min(...pos.map(t=>t.y-t.r)).toFixed(2);l.y1=+Math.max(...pos.map(t=>t.y+t.r)).toFixed(2);}
/** Keep painting into the selected painted lot of the same surface; otherwise start a new one. */
function paintTarget(){const lots=st.plan.lots??=[];let l=st.paintLot&&lots.includes(st.paintLot)?st.paintLot:null;
 if(!l||l.surface!==(st.lotSurf||'asphalt')){l={id:'lot-paint-'+newId(),surface:st.lotSurf||'asphalt',stamps:[],x0:0,y0:0,x1:0,y1:0};
  if(st.lotEdge==='none'||st.lotEdge==='curb')l.border=st.lotEdge;lots.push(l);}
 st.paintLot=l;st.selLot=lots.indexOf(l);st.selPave=null;return l;}
function lotDab(l,X,Y,erase){const t={s:st.lotShape,x:+X.toFixed(2),y:+Y.toFixed(2),r:+st.lotSize.toFixed(2)};if(erase)t.neg=true;
 // skip a dab fully inside the previous one of the same kind (keeps files small on slow strokes)
 const last=l.stamps[l.stamps.length-1];if(last&&!!last.neg===!!erase&&last.s===t.s&&Math.hypot(last.x-t.x,last.y-t.y)<t.r*.2&&Math.abs(last.r-t.r)<.01)return;
 l.stamps.push(t);lotBounds(l);st.planDirty=true;}
function stampPoly(t,fill,stroke){const pts=[];if(t.s==='q')pts.push([t.x-t.r,t.y-t.r],[t.x+t.r,t.y-t.r],[t.x+t.r,t.y+t.r],[t.x-t.r,t.y+t.r]);else for(let i=0;i<28;i++){const a=i/28*Math.PI*2;pts.push([t.x+Math.cos(a)*t.r,t.y+Math.sin(a)*t.r]);}poly(pts,fill,stroke);}
function drawStamps(l,sel){for(const t of l.stamps)stampPoly(t,t.neg?'#ff6b6b22':sel?'#5fd1ff33':'#5fd1ff14',null);if(sel){ctx.setLineDash([6/st.cam.z,4/st.cam.z]);poly([[l.x0,l.y0],[l.x1,l.y0],[l.x1,l.y1],[l.x0,l.y1]],null,'#5fd1ff');ctx.setLineDash([]);}}

/** Ctrl+C copies the selection; Ctrl+V pastes the copy centred on the mouse, as often as you like (relative layout,
 *  facing, size and layer kept; groups come back as new groups). The copy is a snapshot, so later edits don't change it. */
let clipboard=null;
function copySel(){if(!st.sel.size){toast('Select something first, then Ctrl+C copies it');return;}clipboard=st.sprites.filter(o=>st.sel.has(o.uid)).map(o=>({...o}));toast(`Copied ${clipboard.length} item${clipboard.length>1?'s':''}. Ctrl+V pastes at the mouse.`);}
function pasteAtCursor(){if(!clipboard?.length){toast('Nothing copied yet: select something and press Ctrl+C');return;}setMode('select');snapshot();
 const src=clipboard,cx=src.reduce((a,o)=>a+o.x,0)/src.length,cy=src.reduce((a,o)=>a+o.y,0)/src.length;
 let [X,Y]=st.mouse.in?m2w(st.mouse.mx,st.mouse.my):[cx+2,cy+2];if(!st.mouse.alt){X=Math.round(X*4)/4;Y=Math.round(Y*4)/4;}
 const remap=new Map(),n=src.map(o=>{const c={...o,uid:st.uid++,x:+(o.x-cx+X).toFixed(2),y:+(o.y-cy+Y).toFixed(2)};if(o.g){if(!remap.has(o.g))remap.set(o.g,'g'+newId()+remap.size);c.g=remap.get(o.g);}return c;});
 st.sprites.push(...n);st.sel=new Set(n.map(o=>o.uid));save();stats();inspector();req();}

// ---------------------------------------------------------------- Lots & paving: select / move / resize ground shapes
function selGround(){if(st.selPave!=null)return st.plan.paving?.[st.selPave]||null;if(st.selLot!=null)return st.plan.lots?.[st.selLot]||null;return null;}
function groundBox(o){return {x0:Math.min(o.x0,o.x1),x1:Math.max(o.x0,o.x1),y0:Math.min(o.y0,o.y1),y1:Math.max(o.y0,o.y1)};}
function inStamp(t,X,Y){return t.s==='q'?Math.abs(X-t.x)<=t.r&&Math.abs(Y-t.y)<=t.r:Math.hypot(X-t.x,Y-t.y)<=t.r;}
function insideGround(o,X,Y){if(o.stamps){let inside=false;for(const t of o.stamps)if(inStamp(t,X,Y))inside=!t.neg;return inside;}const b=groundBox(o);return X>=b.x0&&X<=b.x1&&Y>=b.y0&&Y<=b.y1;}
/** Topmost/smallest ground shape under a point: pavement patches first (they sit on top), then lots. */
function groundAt(X,Y){let best=null;const area=o=>{const b=groundBox(o);return (b.x1-b.x0)*(b.y1-b.y0);};
 (st.plan.paving||[]).forEach((o,i)=>{if(insideGround(o,X,Y)&&(!best||best.kind!=='pave'||area(o)<area(best.o)))best={kind:'pave',i,o};});if(best)return best;
 (st.plan.lots||[]).forEach((o,i)=>{if(insideGround(o,X,Y)&&(!best||area(o)<area(best.o)))best={kind:'lot',i,o};});return best;}
function handlePts(b){return [['nw',b.x0,b.y0],['ne',b.x1,b.y0],['se',b.x1,b.y1],['sw',b.x0,b.y1],['n',(b.x0+b.x1)/2,b.y0],['s',(b.x0+b.x1)/2,b.y1],['w',b.x0,(b.y0+b.y1)/2],['e',b.x1,(b.y0+b.y1)/2]];}
function lotHandleAt(mx,my){const o=selGround();if(!o||o.stamps)return null;for(const [c,X,Y] of handlePts(groundBox(o))){const [hx,hy]=w2m(X,Y);if(Math.abs(mx-hx)<=9/st.cam.z&&Math.abs(my-hy)<=9/st.cam.z)return c;}return null;}
function moveGround(o,dx,dy){if(!o)return;o.x0=+(o.x0+dx).toFixed(2);o.x1=+(o.x1+dx).toFixed(2);o.y0=+(o.y0+dy).toFixed(2);o.y1=+(o.y1+dy).toFixed(2);
 for(const t of o.stamps||[]){t.x=+(t.x+dx).toFixed(2);t.y=+(t.y+dy).toFixed(2);}
 for(const b of o.bays||[]){const d=b.side==='N'||b.side==='S'?dx:dy;b.from=+(b.from+d).toFixed(2);b.to=+(b.to+d).toFixed(2);}
 for(const op of o.openings||[]){const d=op.side==='N'||op.side==='S'?dx:dy;op.a0=+(op.a0+d).toFixed(2);op.a1=+(op.a1+d).toFixed(2);}req();}
const SURF={asphalt:'Car park (asphalt)',slab:'Plaza (paving slabs)',dirt:'Yard (dirt)',field:'Sports field'};
function lotSelPanel(){const o=selGround();
 if(!o)return `<div class="intent editing"><span>EDIT EXISTING</span><b>Choose an item on the map</b><p>Click a lot or footpath to see its settings here.</p></div><div class="how-to">${gesture('select')}<p>Click to select. Drag to move. Drag the yellow handles to resize.</p></div><button id="startNewLot" class="primary">Draw a new item</button>`;
 const b=groundBox(o),patch=st.selPave!=null,surf=patch?'paving':o.surface,kind=surfaces[surf]?.name||surf;
 const edge=o.border==='none'?'none':patch||o.border==='curb'?'curb':'ring';
 return `<div class="intent editing"><span>EDITING SELECTED ITEM</span><b>${kind}${o.stamps?' &middot; painted shape':''}</b><p>${(b.x1-b.x0).toFixed(1)} &times; ${(b.y1-b.y0).toFixed(1)} m &middot; Yellow outline on the map</p></div>
  <p class="scope-note">Changes below apply only to this selected item.</p>
  ${!o.stamps?`<div class="dimension-fields"><label for="gWidth">Width (m)<input id="gWidth" type="number" min="${patch ? .75 : 4}" step="0.25" value="${+(b.x1-b.x0).toFixed(2)}"></label><label for="gDepth">Depth (m)<input id="gDepth" type="number" min="${patch ? .75 : 4}" step="0.25" value="${+(b.y1-b.y0).toFixed(2)}"></label></div>`:''}
  <div class="btns"><button id="gDup">Duplicate</button><button id="gDel" class="danger">Delete item</button>${o.stamps?'<button id="gPaint">Continue painting</button>':''}</div>
  ${patch?'':`<h4>Surface</h4>${surfaceChoices(surf,'gSurf')}`}
  <h4>Border</h4>${edgeChoices(edge,'gEdge',patch,surf)}
  <p class="muted">Drag to move${o.stamps?'':'; yellow handles resize'}. Arrow keys move 0.25 m. Undo restores your changes.</p>
  <button id="startNewLot" class="primary wide">Draw another item</button>`;
}
function wireLotSel(){const next=$('#startNewLot');if(next)next.onclick=()=>setLotTool('rect');const o=selGround();if(!o||st.lotTool!=='select')return;const set=fn=>{snapshot();fn();st.planDirty=true;savePlan();stats();groundPanel();req();};
 const gs=$('#gSurf');if(gs)gs.onchange=()=>set(()=>{o.surface=gs.value;o.auto=!o.stamps&&['asphalt','slab'].includes(o.surface);if(o.surface==='dirt'||o.surface==='field')o.border='none';});
 const ge=$('#gEdge');if(ge)ge.onchange=()=>set(()=>{const v=ge.value;if(st.selPave!=null){if(v==='none')o.border='none';else delete o.border;}else{if(v==='ring')delete o.border;else o.border=v;}});
 $('#gDel').onclick=()=>{if(st.selPave!=null)delPave();else if(st.selLot!=null){set(()=>{st.plan.lots.splice(st.selLot,1);st.selLot=null;st.paintLot=null;});}};
 $('#gDup').onclick=()=>set(()=>{const c=JSON.parse(JSON.stringify(o));c.id=(st.selPave!=null?'pave-':'lot-')+newId();moveGround(c,4,4);if(st.selPave!=null){st.plan.paving.push(c);st.selPave=st.plan.paving.length-1;}else{st.plan.lots.push(c);st.selLot=st.plan.lots.length-1;}});
 wireVisualChoices($('#lotSelOpts'),'gSurf','gEdge');
 for(const [id,axis] of [['gWidth','x'],['gDepth','y']]){const input=$('#'+id);if(input)input.onchange=()=>{if(!input.checkValidity()){input.reportValidity();input.value=+(o[axis+'1']-o[axis+'0']).toFixed(2);return;}set(()=>o[axis+'1']=+(o[axis+'0']+input.valueAsNumber).toFixed(2));};}
 const paint=$('#gPaint');if(paint)paint.onclick=()=>{st.lotTool='brush';st.lotSurf=o.surface;st.lotEdge=o.border||'ring';st.paintLot=o;groundPanel();req();};
}

/** Presets with ground (car parks, plazas, yards, fields, pavement patches): copy it into the plan at the stamp point. */
function stampGround(p,X,Y){const gr=p?.ground;if(!gr?.length)return;const k=+$('#bScale').value||1,T=(v,o)=>+(o+v*k).toFixed(2),id=newId();
 gr.forEach((g,i)=>{const c=JSON.parse(JSON.stringify(g)),kind=c.kind;delete c.kind;delete c.use;delete c.look;delete c.section;
  if(kind==='refl'){(st.plan.reflections??=[]).push({id:'glow-'+newId(),x:T(c.x,X),y:T(c.y,Y),free:!!c.free,strength:c.strength??1,scale:c.scale??1});return;}
  c.x0=T(c.x0,X);c.x1=T(c.x1,X);c.y0=T(c.y0,Y);c.y1=T(c.y1,Y);
  for(const b of c.bays||[]){const o=b.side==='N'||b.side==='S'?X:Y;b.from=T(b.from,o);b.to=T(b.to,o);if(k!==1)b.depth*=k;}
  for(const op of c.openings||[]){const o=op.side==='N'||op.side==='S'?X:Y;op.a0=T(op.a0,o);op.a1=T(op.a1,o);}
  c.id=(kind==='pave'?'pave-':'lot-')+p.id+'-'+id+'-'+i;(kind==='pave'?(st.plan.paving??=[]):(st.plan.lots??=[])).push(c);});
 st.planDirty=true;savePlan();$('#bakeBtn').classList.add('attention');toast(p.name+' placed. Press <b>Rebuild ground</b> to paint its car park / paving.');}
