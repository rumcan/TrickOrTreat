import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import {ROAD,PORTS,project,unproject,surface,socket,kind,mod,tilesFor} from '../../lib/road-autotile.mjs';
import {ROOT} from '../../lib/town-paths.mjs';
const out=path.join(ROOT,'output/road-autotile-v1');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const d of ['', 'sources','jobs','native','tiles','decals','review'])await fs.mkdir(path.join(out,d),{recursive:true});
const [mode,id,source]=process.argv.slice(2);
if(mode==='init'){
 const reference=path.join(ROOT,'output/town-empty-v1/tiles/crossroads.png'),target=path.join(out,'sources/reference.png');
 await fs.copyFile(reference,target,fs.constants.COPYFILE_EXCL);
 const prompt=`Use case: precise-object-edit\nAsset type: master painted paving materials for a modular isometric road builder.\nImage 1 is the EDIT TARGET and the exact approved STYLE master. Preserve its composition, camera, road widths, curb shapes, paving slab sizes, navy asphalt aggregate, fine cracks, warm grey concrete, lighting and amber road reflections.\nChange ONLY these details: remove ALL yellow painted road markings; remove ALL fallen leaves lying on asphalt, curbs or concrete sidewalks, including small orange gutter leaves. Reconstruct the SAME fine asphalt/concrete texture beneath them. Keep all grass and leaves ON GRASS unchanged. Do not redesign the roads, recolour or brighten them. Do not smooth the gritty surface into vector art.\nThis is an image cleanup, NOT a new scene, tile design or alternate style. Return one square image at the same framing. No text, UI, grid, new objects, poles, trees or buildings.`;
 const job={id:'material-master',prompt,refs:[target],referenceHashes:[{path:target,sha:hash(await fs.readFile(target))}],tool:'built-in imagegen'};
 await fs.writeFile(path.join(out,'jobs/material-master.json'),JSON.stringify(job,null,2));
 await sharp(target).extract({left:630,top:100,width:500,height:450}).png().toFile(path.join(out,'review/source-straight-crop.png'));
 console.log(JSON.stringify(job));
}else if(mode==='ingest'){
 const job=JSON.parse(await fs.readFile(path.join(out,'jobs',id+'.json'),'utf8'));
 const dest=path.join(out,'native',id+'.png');await fs.copyFile(source,dest,fs.constants.COPYFILE_EXCL);
 const m=await sharp(dest).metadata();
 await fs.writeFile(path.join(out,'native',id+'.json'),JSON.stringify({...job,nativeSource:source,width:m.width,height:m.height,hasAlpha:m.hasAlpha,sha:hash(await fs.readFile(dest)),review:'pending'},null,2));
 console.log(JSON.stringify({id,width:m.width,height:m.height,hasAlpha:m.hasAlpha}));
}else if(mode==='templates'){
 const img=await load(path.join(out,'native/material-master.png'));
 if(img.width!==1254||img.height!==1254)throw Error('Unexpected material source size; calibrate rather than silently resize');
 // Exact reference's lower unlit connector: cross-road X, along-road Y.
 const profile={left:540,top:1134,width:178,height:108,periodM:2};
 await sharp(path.join(out,'native/material-master.png')).extract({left:profile.left,top:profile.top,width:profile.width,height:profile.height}).png().toFile(path.join(out,'sources/painted-profile.png'));
 await fs.writeFile(path.join(out,'sources/profile.json'),JSON.stringify({source:'native/material-master.png',sha:hash(await fs.readFile(path.join(out,'native/material-master.png'))),...profile,method:'Bilinear sampling of painted source pixels, not synthetic asphalt or vector concrete',road:ROAD},null,2));
 for(const [name,mask]of [['straight',10],['curve',3],['tee',11],['cross',15],['end',1]]){
  const rgb=Buffer.alloc(1254*1254*3);
  for(let py=0;py<1254;py++)for(let px=0;px<1254;px++){
   const {x,y}=unproject(px-ROAD.sourceLeft+.5,py-ROAD.sourceTop+.5),v=surface(mask,x,y),o=(py*1254+px)*3;
   const c=v.type==='grass'?sample(img,50+mod(px,128),40+mod(py,128)):paint(img,profile,x,y,v,socket(mask,x,y));
   rgb[o]=c[0];rgb[o+1]=c[1];rgb[o+2]=c[2];
  }
  const input=path.join(out,'sources',name+'-guide.png');await sharp(rgb,{raw:{width:1254,height:1254,channels:3}}).png().toFile(input);
  const prompt=`Use case: precise-object-edit\nAsset type: ONE grass-backed modular isometric road ${name} tile.\nImage 1: EDIT TARGET, assembled entirely from the approved painted raster material master, with exact connector positions and widths. Image 2: authoritative asphalt/sidewalk STYLE master only; do NOT copy its whole road loop.\nPrimary request: polish the central ${name} road section while preserving its geometry and material identity. Keep this EXACT navy-charcoal asphalt texture and these EXACT warm concrete slabs, thin black curb/gutter edging and slab spacing. Do not switch to another drawing style, greener concrete, smoother road or heavier cracks. All road arms retain their positions, tangent, widths and scale; preserve the road and pavement near every image-edge connector. Geometry is intentional: 2:1 orthographic ground slopes +0.5 and -0.5, not a square diamond or perspective. Leave grass around the road for this first artwork stage.\nSurface layers: NO road markings, NO fallen leaves on asphalt or sidewalks, NO objects, trees, poles or fixtures. Keep one small restrained warm amber specular pool on asphalt in the CENTRE ONLY, away from connector ends; not a long orange flood or several lights. Do not add shadows from unseen poles.\nCamera: heading45 degrees, downward pitch30 degrees, roll0. Ground tile is16m square; two-lane asphalt6.5m, sidewalk1.8m each side. Source framing:1254px square, ground-tile diamond corners at(627,371),(1139,627),(627,883),(115,627). This is a close-up module framing, not the previous80m town framing. Road arms go to the midpoints of the appropriate diamond edges; never add extra arms. Keep all connectors and concrete seam phase from Image1.\nSetting:1985-1992 small-town America, Halloween early-evening dusk; same cool navy ambient and warm grey sidewalk colours as Image2. No border, tile grid, text, labels, raised floating platform or panorama. Return only this ONE square tile.`;
  const refs=[input,path.join(out,'native/material-master.png')],referenceHashes=[];for(const f of refs)referenceHashes.push({path:f,sha:hash(await fs.readFile(f))});
  await fs.writeFile(path.join(out,'jobs',name+'.json'),JSON.stringify({id:name,mask,prompt,refs,referenceHashes,profile,road:ROAD,tool:'built-in imagegen'},null,2));
 }
 console.log(JSON.stringify({templates:5,profile,output:out}));
}else if(mode==='cutout-jobs'){
 for(const name of ['straight','curve','tee','cross','end']){
  const target=path.join(out,name==='curve'||name==='end'?'sources':'native',name+(name==='curve'||name==='end'?'-guide':'')+'.png');
  const prompt=`Use case: background-extraction\nImage1 is the EDIT TARGET. Remove ONLY ALL grass and grass leaves from this road artwork. Return the existing asphalt, concrete sidewalks and thin dark curbs on a GENUINELY TRANSPARENT background. Preserve their exact pixel positions, size, framing, widths, geometry, slab joints, colour, texture and lighting. No restyling, no zoom, no extending the road, no adding grass or new paving. Remove outside/background shadows, no opaque black background or fake checkerboard. Keep the square1254 framing; do not tightly crop or centre the object. Keep all paving exactly where it already is. This is a cutout, not a new road design.`;
  const job={id:name+'-cutout',prompt,refs:[target],referenceHashes:[{path:target,sha:hash(await fs.readFile(target))}],tool:'built-in imagegen',sourceGeometry:name==='curve'||name==='end'?'fixed raster guide; freeform attempt rejected':'generated grass-backed artwork'};
  await fs.writeFile(path.join(out,'jobs',job.id+'.json'),JSON.stringify(job,null,2));
 }
 for(const category of ['sidewalk','gutter']){
  const ref=path.join(out,'sources/reference.png');
  const prompt=`Use case: background-extraction\nAsset type: transparent fallen-leaf decal, ${category} layer for modular isometric town roads.\nImage1 is the STYLE reference. Extract/recreate ONLY the tiny autumn maple/oak leaves from this image, with the same russet/orange/muted yellow palette, painterly detail, lighting and small size. NO road, NO sidewalk, NO curb, NO grass, NO soil, NO white or black backdrop. Actual alpha transparency.\nComposition: ONE scattered leaf patch inside a long narrow diagonal band that slopes DOWN RIGHT at26.565 degrees, like the reference roads. ${category==='sidewalk'?'Sparse individual leaves, around60-100 small leaves, airy gaps and a few little overlapping groups, sized to sit ON concrete sidewalks.':'A denser irregular broken drift of around150-250 small leaves collected ALONG the edge of an asphalt gutter, concentrated along one side of the band, tapering at its ends and fading sparsely away from the gutter.'}\nLeaves individually about5-12 pixels on a1254-square source canvas, not enormous flower shapes. Band extends from around(180,420) to(1074,867), about70px wide. Keep plenty of genuine transparent space. No large leaf piles, no tree branches, no flowers, no glowing neon leaves, no labels, no cast rectangular shadow. Camera orthographic2:1, same early-evening1985-1992 Halloween setting. Return ONLY one decal image.`;
  const job={id:'leaves-'+category,prompt,refs:[ref],referenceHashes:[{path:ref,sha:hash(await fs.readFile(ref))}],tool:'built-in imagegen'};
  await fs.writeFile(path.join(out,'jobs',job.id+'.json'),JSON.stringify(job,null,2));
 }
 console.log(JSON.stringify({cutouts:5,decals:2}));
}else throw Error('init | ingest <id> <native> | templates | cutout-jobs');

async function load(file){const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});return {...info,data};}
function sample(img,x,y){x=Math.max(0,Math.min(img.width-1.001,x));y=Math.max(0,Math.min(img.height-1.001,y));const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,out=[];for(let k=0;k<3;k++){const a=(iy*img.width+ix)*4+k,b=a+4,c=a+img.width*4,d=c+4;out.push(Math.round((img.data[a]*(1-fx)+img.data[b]*fx)*(1-fy)+(img.data[c]*(1-fx)+img.data[d]*fx)*fy));}return out;}
function paint(img,p,x,y,v,s){
 const half=ROAD.asphaltM/2+ROAD.sidewalkM,along=s?s.along:v.s;
 const signed=s?s.signed:Math.sign(v.signed||1)*v.distance,rawCross=Math.max(0,Math.min(1,(signed+half)/(2*half)));
 const phase=mod(along,p.periodM)/p.periodM;
 return sample(img,p.left+rawCross*(p.width-1),p.top+phase*(p.height-1));
}
