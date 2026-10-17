/** Paintable blob shadows for the town builder: soft dark pools to paint under trees, porches, cars or anywhere the
 *  ground should sit in shade. node scripts/town-builder/register-shadows.mjs
 *  Drawn here (no source art): a 2:1 ground ellipse whose alpha falls off smoothly, stored at 2x like every library
 *  sprite as a flat decal, so it is drawn under everything, baked into the ground by Rebuild ground and exported to
 *  the game with the rest of it. Paint them with Place objects (B): drag spacing, scatter and size variety stack them
 *  into any shape; Mirror (F) turns the long one the other way. Re-running replaces the same ids. */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {ROOT} from '../lib/town-scene.mjs';
const LIB=path.join(ROOT,'output/town-builder/library'),CAT='Shadows';
const smooth=(e0,e1,x)=>{const t=Math.min(1,Math.max(0,(x-e0)/(e1-e0)));return t*t*(3-2*t);};
/** light through leaves: a fixed scatter of soft round gaps (seeded, so re-running gives the same picture) */
function gaps(W,H,count){let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647,out=[];
 for(let k=0;k<count;k++){const a=rnd()*Math.PI*2,r=Math.sqrt(rnd())*.85;out.push({x:W/2+Math.cos(a)*r*W/2,y:H/2+Math.sin(a)*r*H/2,r:(22+rnd()*40)*W/560,k:.45+rnd()*.5});}return out;}
function lit(gs,x,y){let l=0;for(const g of gs){const d=Math.hypot(x-g.x,(y-g.y)*2)/g.r;if(d<1)l=Math.max(l,g.k*(1-smooth(.2,1,d)));}return l;}
// id, name, size in library px (1x; a metre is about 45 px across the 2:1 ground), peak darkness, where the fade starts, extra
const SHADOWS=[
 ['round-soft','Shadow — soft round',160,80,.5,.15,null],
 ['round-dark','Shadow — dark contact (under objects)',110,55,.72,.45,null],
 ['long-soft','Shadow — long soft (Mirror turns it)',260,130,.48,.2,{along:true}],
 ['wide-faint','Shadow — wide faint',300,150,.3,.05,null],
 ['canopy','Shadow — dappled tree canopy',280,140,.55,.25,{dapple:true}],
];
const lib=JSON.parse(await fs.readFile(path.join(LIB,'library.json'),'utf8'));let n=0;
for(const [key,name,w,h,peak,start,extra] of SHADOWS){
 const W=w*2,H=h*2,data=Buffer.alloc(W*H*4),gs=extra?.dapple?gaps(W,H,38):null;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  let u=(x+.5)/W*2-1,v=(y+.5)/H*2-1;
  if(extra?.along){// an ellipse along one ground axis: on the 2:1 view that runs down-right; squash across it
   const a=(u+v)/Math.SQRT2,b=(v-u)/Math.SQRT2;u=a*1.05;v=b*1.7;}
  const d=Math.hypot(u,v);let a=peak*(1-smooth(start,1,d));
  if(gs)a*=1-lit(gs,x,y);
  const o=(y*W+x)*4;data[o]=8;data[o+1]=10;data[o+2]=22;data[o+3]=Math.round(Math.min(1,Math.max(0,a))*255);}
 const safe='shadow_'+key,id='shadow:'+key,img=sharp(data,{raw:{width:W,height:H,channels:4}});
 await img.clone().webp({quality:92,alphaQuality:100}).toFile(path.join(LIB,'sprites',safe+'.webp'));
 // the thumbnail shows the shade on a light ground so it is visible in the palette
 const thumb=await sharp({create:{width:W,height:H,channels:4,background:{r:120,g:132,b:110,alpha:1}}}).composite([{input:await img.clone().png().toBuffer()}]).png().toBuffer();
 await sharp(thumb).resize(112,112,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).webp({quality:85}).toFile(path.join(LIB,'thumbs',safe+'.webp'));
 const item={id,name,category:CAT,file:'sprites/'+safe+'.webp',thumb:'thumbs/'+safe+'.webp',w,h,ax:w/2,ay:h/2,fw:1,fh:1,flat:true,
  source:'scripts/town-builder/register-shadows.mjs',tags:['shadow','shade','blob','paintable']};
 const i=lib.items.findIndex(x=>x.id===id);if(i>=0)lib.items[i]=item;else lib.items.push(item);n++;}
if(!lib.categories.includes(CAT))lib.categories.push(CAT);
const out=path.join(LIB,'library.json');await fs.writeFile(out+'.pending',JSON.stringify(lib,null,1));await fs.rename(out+'.pending',out);
console.log(n,'blob shadows registered in',CAT);
