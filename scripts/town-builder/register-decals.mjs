/** Add the RUN-generated ground decals (leaf drifts, litter, puddles, cracks...) to the town builder library.
 *  node scripts/town-builder/register-decals.mjs
 *  Sources: output/terrain-materials/leaf-drifts/drift-*.png and output/terrain-materials/ground-decals/*.png (transparent).
 *  Each is trimmed to its alpha, flattened to the 2:1 ground (the art is already drawn in the game's view) and stored at
 *  2x game scale as a flat decal (drawn under everything, no shadow). Re-running replaces the same ids. */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {ROOT} from '../lib/town-scene.mjs';
const LIB=path.join(ROOT,'output/town-builder/library'),TM=path.join(ROOT,'output/terrain-materials');
const NAMES={'drift-1':['Leaf drift — wind-swept curb',260],'drift-2':['Leaf pile — raked',200],'drift-3':['Leaf scatter — red maples',230],'drift-4':['Leaf scatter — oak & acorns',230],
 'drift-5':['Leaf trail — golden birch',230],'drift-6':['Leaf mat — wet & flattened',230],'drift-7':['Leaf swirl',200],'drift-8':['Leaf drift — corner wedge',220],
 'litter-fastfood':['Litter — fast food',150],'litter-candy':['Litter — candy wrappers',150],'litter-newspaper':['Litter — wet newspaper',160],'rubbish-bags':['Rubbish — split bags',170],
 'rubbish-cardboard':['Rubbish — cardboard heap',170],'puddle-large':['Puddle — large',230],'puddle-small':['Puddles — small',190],'oil-stain-big':['Oil stain — big',180],
 'cracks-asphalt':['Asphalt cracks',240],'cracks-pothole':['Pothole',150],'wheel-tracks-mud':['Muddy tyre tracks',260],'bare-grass-patch':['Bare trampled patch',230],
 'soil-damp':['Damp soil patch',200],'gravel-spill':['Gravel spill',170],'twigs-branches':['Fallen twigs & branch',190],'pinecones-needles':['Pine needles & cones',190],
 'chalk-hopscotch':['Chalk hopscotch',200],'manhole-drain':['Manhole & drain',150]};
const lib=JSON.parse(await fs.readFile(path.join(LIB,'library.json'),'utf8'));
const files=[];for(const dir of ['leaf-drifts','ground-decals']){try{for(const f of await fs.readdir(path.join(TM,dir)))if(/\.png$/.test(f)&&!/^ref-|sheet/.test(f))files.push(path.join(TM,dir,f));}catch{}}
let added=0;
for(const file of files){const key=path.basename(file,'.png'),meta=NAMES[key];if(!meta)continue;
 const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 // drop near-white halo pixels left by background removal, then trim
 for(let i=0;i<info.width*info.height;i++){const o=i*4,mn=Math.min(data[o],data[o+1],data[o+2]);if(mn>225&&data[o+3]<250)data[o+3]=0;}
 const trimmed=await sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).trim({threshold:1}).png().toBuffer({resolveWithObject:true});
 const w=meta[1],h=Math.round(w*trimmed.info.height/trimmed.info.width),id='gen:'+key,safe='gen_'+key.replace(/[^a-z0-9_-]/gi,'_');
 await sharp(trimmed.data).resize(w*2,h*2,{kernel:'lanczos3'}).webp({quality:90,alphaQuality:100}).toFile(path.join(LIB,'sprites',safe+'.webp'));
 await sharp(trimmed.data).resize(112,112,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).webp({quality:85}).toFile(path.join(LIB,'thumbs',safe+'.webp'));
 const item={id,name:meta[0],category:'Decals & ground',file:'sprites/'+safe+'.webp',thumb:'thumbs/'+safe+'.webp',w,h,ax:w/2,ay:h/2,fw:1,fh:1,flat:true,source:path.relative(ROOT,file).replace(/\\/g,'/'),tags:['generated','RUN']};
 const i=lib.items.findIndex(x=>x.id===id);if(i>=0)lib.items[i]=item;else lib.items.push(item);added++;}
const SLABBY=new Set(["gen:bare-grass-patch","gen:chalk-hopscotch","gen:cracks-asphalt","gen:cracks-pothole","gen:manhole-drain","gen:puddle-large","gen:puddle-small","gen:wheel-tracks-mud","gen:oil-stain-big","gen:soil-damp"]);for(const i of lib.items)if(SLABBY.has(i.id)){i.hidden=true;i.hiddenReason='slab/tile edge, not a flat decal';}
lib.categories=[...new Set(lib.items.map(i=>i.category))];
const out=path.join(LIB,'library.json');await fs.writeFile(out+'.pending',JSON.stringify(lib,null,1));await fs.rename(out+'.pending',out);
console.log('registered',added,'decals');
