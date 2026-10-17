/** Texture painter: the ground surfaces (car-park asphalt, plaza slabs, beige pavement, dirt yard, sports field) as
 *  paintable flat decals, rendered by the same ground renderer the bake uses (town-scene.mjs) at 2x game scale.
 *  Soft blobs (2, 4, 8 m) overlap into continuous painted areas; 4 m and 8 m soft squares fill along the grid;
 *  slab "tiles" are hard-edged 5 m squares cut on slab joints, so a row of them joins without a seam.
 *  Slab and pavement dabs are cut centred on a slab joint and carry paint.snap 2.5, so the builder snaps them to the
 *  2.5 m slab grid and joints line up between dabs. Asphalt cuts with painted car-park markings are rejected.
 *    node scripts/town-builder/texture-paint.mjs     -> library category "Ground paint" (map and layout untouched)
 *  Paint with Place objects: pick a dab, set Drag spacing to about half its size (tiles: exactly their size). */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {loadSources,buildScene,renderRect,ROOT} from '../lib/town-scene.mjs';
const LIB=path.join(ROOT,'output/town-builder/library'),ZOOM=2,PX=32*ZOOM;
const SURF=[
 {key:'asphalt',name:'Car-park asphalt',lot:'asphalt'},
 {key:'slabs',name:'Plaza slabs',lot:'slab'},
 {key:'pavement',name:'Beige pavement',pave:true},
 {key:'dirt',name:'Dirt yard',lot:'dirt'},
];
// world area each surface is laid over (one big lot / patch); dab centres are picked inside it
const A=[20,20,140,140];
const S=await loadSources(ZOOM);
const hash=(x,y,s)=>{let h=Math.imul(x*374761393+y*668265263+s*982451653,1274126177);h^=h>>>13;h=Math.imul(h,1274126177);return ((h^h>>>16)>>>0)/4294967296;};
const noise=(a,seed)=>Math.sin(a*3+seed)*.5+Math.sin(a*7+seed*2.1)*.3+Math.sin(a*13+seed*3.7)*.2;
const vnoise=(x,y,s)=>{const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy),h=(a,b)=>hash(a,b,s);return (h(ix,iy)*(1-u)+h(ix+1,iy)*u)*(1-v)+(h(ix,iy+1)*(1-u)+h(ix+1,iy+1)*u)*v;};
const smooth=(e0,e1,x)=>{const t=Math.min(1,Math.max(0,(x-e0)/(e1-e0)));return t*t*(3-2*t);};

function scene(s){const plan={name:'paint',nx:9,ny:9,roads:[],lots:[],paving:[],reflections:[],lines:{double:[],none:[]}};
 if(s.pave)plan.paving.push({id:'p',x0:A[0],y0:A[1],x1:A[2],y1:A[3],border:'none'});
 else plan.lots.push({id:'l',surface:s.lot,x0:A[0],y0:A[1],x1:A[2],y1:A[3],border:'none'});
 return buildScene(plan,S);}

/** one dab: shape 'blob' (radius r, ragged soft edge), 'square' (half size h, soft edge) or 'tile' (half size h, hard edge) */
async function dab(sc,s,shape,size,variant,attempt=0){
 const half=size/2,seed=variant*17+size+attempt*101;
 // centre: random inside the surface, on the 2.5 m slab grid for tiles so the joints sit on the edges
 let cx=40+hash(variant+attempt*31,size,1)*60,cy=40+hash(variant+attempt*31,size,2)*60;if(shape==='tile'){cx=Math.round(cx/2.5)*2.5+half%2.5;cy=Math.round(cy/2.5)*2.5+half%2.5;}
 else if(s.key!=='asphalt'&&s.key!=='dirt'){cx=Math.round(cx/2.5)*2.5;cy=Math.round(cy/2.5)*2.5;}
 const ext=half+.2,pts=[[-ext,-ext],[ext,-ext],[-ext,ext],[ext,ext]].map(([dx,dy])=>sc.toScreen(cx+dx,cy+dy));
 const L=Math.floor(Math.min(...pts.map(p=>p[0]))),T=Math.floor(Math.min(...pts.map(p=>p[1]))),W=Math.ceil(Math.max(...pts.map(p=>p[0])))-L,H=Math.ceil(Math.max(...pts.map(p=>p[1])))-T;
 const buf=renderRect(sc,L,T,W,H);
 if(s.key==='asphalt'){let busy=0,n=0,sum=0;const lum=[];for(let i=0;i<W*H;i++){const o=i*4;if(buf[o+3]<200)continue;const l=.3*buf[o]+.59*buf[o+1]+.11*buf[o+2];lum.push(l);sum+=l;n++;}
  const mean=sum/Math.max(1,n);for(const l of lum)if(l>mean+38||l<mean-26)busy++;const score=busy/Math.max(1,n);
  // painted markings and tar seams stand out from the mean: try 12 spots, keep the calmest
  if(attempt<11){const other=await dab(sc,s,shape,size,variant,attempt+1);if(other.score<=score)return other;}
  return {...(await finish()),score};}
 return finish();
 async function finish(){
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){let acc=0;
  for(const [ox,oy] of [[.25,.25],[.75,.25],[.25,.75],[.75,.75]]){const [X,Y]=sc.toWorld(L+x+ox,T+y+oy),dx=X-cx,dy=Y-cy;let a;
   const grain=vnoise(X*2.2,Y*2.2,seed)*.7+vnoise(X*6,Y*6,seed+5)*.3-.5;
   if(shape==='blob'){const r=Math.hypot(dx,dy),ang=Math.atan2(dy,dx),edge=half*(1+.14*noise(ang,seed)),f=Math.max(.6,half*.6);a=smooth(edge,edge-f,r+grain*f*.7);}
   else if(shape==='square'){const f=Math.max(.5,half*.35),m=Math.max(Math.abs(dx),Math.abs(dy))+.06*noise(Math.atan2(dy,dx)*2,seed)*half;a=smooth(half,half-f,m+grain*f*.6);}
   else a=Math.max(Math.abs(dx),Math.abs(dy))<=half?1:0;
   acc+=a;}
  const o=(y*W+x)*4;buf[o+3]=Math.round(buf[o+3]*acc/4);}
 return {img:await sharp(buf,{raw:{width:W,height:H,channels:4}}).png().toBuffer(),W,H,score:0};}
}

await fs.mkdir(path.join(LIB,'backups'),{recursive:true});
const target=path.join(LIB,'library.json'),lib=JSON.parse(await fs.readFile(target,'utf8'));
await fs.copyFile(target,path.join(LIB,'backups','library-before-texture-paint-'+Date.now()+'.json'));
const items=[];
for(const s of SURF){const sc=scene(s);
 const plan=[['blob',2,1],['blob',2,2],['blob',2,3],['blob',4,1],['blob',4,2],['blob',4,3],['blob',4,4],['blob',8,1],['blob',8,2],['blob',8,3],['square',4,1],['square',4,2],['square',8,1]];
 if(s.key==='slabs')plan.push(['tile',5,1],['tile',5,2],['tile',2.5,1]);
 for(const [shape,size,v] of plan){
  const {img,W,H}=await dab(sc,s,shape,size,v),id=`paint:${s.key}-${shape}-${String(size).replace('.','_')}m-${v}`,safe=id.replace(':','_');
  await sharp(img).webp({quality:92,alphaQuality:100}).toFile(path.join(LIB,'sprites',safe+'.webp'));
  await sharp(img).resize(112,112,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).webp({quality:88,alphaQuality:100}).toFile(path.join(LIB,'thumbs',safe+'.webp'));
  const w=W/ZOOM,h=H/ZOOM,label={blob:'soft dab',square:'soft square',tile:'tile'}[shape];
  items.push({id,name:`${s.name} — ${label} ${size} m${shape==='blob'?' #'+v:''}`,category:'Ground paint',file:'sprites/'+safe+'.webp',thumb:'thumbs/'+safe+'.webp',
   w:+w.toFixed(2),h:+h.toFixed(2),ax:+(w/2).toFixed(2),ay:+(h/2).toFixed(2),fw:size/2,fh:size/2,flat:true,paint:{surface:s.key,shape,size,spacing:shape==='tile'?size:s.key==='slabs'||s.key==='pavement'?2.5*Math.max(1,Math.round(size*.5/2.5)):+(size*.5).toFixed(2),...(s.key==='slabs'||s.key==='pavement'?{snap:2.5}:{})},
   source:'rendered by scripts/town-builder/texture-paint.mjs from the ground renderer',tags:['ground paint','texture',s.key]});
  console.log(id,W+'x'+H);}
}
lib.items=lib.items.filter(i=>!i.id.startsWith('paint:')).concat(items);
lib.categories=[...new Set(lib.items.map(i=>i.category))];
const pending=target+'.pending';await fs.writeFile(pending,JSON.stringify(lib,null,1));await fs.rename(pending,target);
console.log(items.length,'ground paint dabs; library',lib.items.length,'items; map unchanged');
