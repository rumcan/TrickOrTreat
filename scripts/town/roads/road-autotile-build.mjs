import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import {ROAD,PORTS,project,unproject,surface,socket,kind,mod,tilesFor} from '../../lib/road-autotile.mjs';
import {ROOT} from '../../lib/town-paths.mjs';
const out=path.join(ROOT,'output/road-autotile-v1'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const mode=process.argv[2];
const profile=JSON.parse(await fs.readFile(path.join(out,'sources/profile.json'),'utf8'));
const source=await load(path.join(out,profile.source));
if(sha(await fs.readFile(path.join(out,profile.source)))!==profile.sha)throw Error('Material master changed');
if(mode==='bake'){
 try{await fs.copyFile(path.join(out,'road-builder-proof.png'),path.join(out,'review/road-light-before.png'),fs.constants.COPYFILE_EXCL);}catch(e){if(e.code!=='ENOENT'&&e.code!=='EEXIST')throw e;}
 const specular=await load(path.join(out,'native/straight-cutout.png'));
 const leafSources={sidewalk:await leafSource(path.join(out,'native/leaves-sidewalk.png')),gutter:await leafSource(path.join(out,'native/leaves-gutter.png'))};
 if(!specular.hasAlpha)throw Error('Need real alpha cutout before baking accents');
 const assets=[];
 for(let mask=0;mask<16;mask++){
  const base=Buffer.alloc(ROAD.width*ROAD.height*4),lines=Buffer.alloc(base.length),light=Buffer.alloc(base.length),sideLeaves=Buffer.alloc(base.length),gutterLeaves=Buffer.alloc(base.length);
  for(let py=0;py<ROAD.height;py++)for(let px=0;px<ROAD.width;px++){
   const {x,y}=unproject(px+.5,py+.5);if(x<0||y<0||x>=16||y>=16)continue;
   const v=surface(mask,x,y),s=socket(mask,x,y);if(v.type==='grass')continue;
   const o=(py*ROAD.width+px)*4,colour=material(x,y,v,s);for(let k=0;k<3;k++)base[o+k]=colour[k];base[o+3]=255;
   for(const [category,buffer,centre,spread]of [['sidewalk',sideLeaves,4.12,1.55],['gutter',gutterLeaves,3.08,.65]]){
    if(category==='sidewalk'?v.type!=='sidewalk':v.type!=='asphalt'||v.distance<2.7)continue;
    const leaf=leafSources[category],along=s?s.along:v.s,offset=(v.distance-centre)/spread,cross=leaf.spread*offset;
    if(Math.abs(offset)<.7){const lx=leaf.minX+mod(along,16)/16*(leaf.maxX-leaf.minX),ly=leaf.slope*lx+leaf.intercept+cross,rgba=sample(leaf.img,lx,ly);for(let k=0;k<4;k++)buffer[o+k]=rgba[k];}
   }
   // Only line markings are drawn: semi-transparent paint, world-length dash phase.
   if(mask&&v.type==='asphalt'&&v.distance<.065&&(kind(mask)==='straight'||kind(mask)==='curve'||v.s>3)&&mod(v.s,3)<1.25){lines[o]=231;lines[o+1]=173;lines[o+2]=56;lines[o+3]=165;}
   // A single cropped AI-painted reflection. It is a separate optional layer,
   // bounded to ONE local pool, never a procedural/vector gradient road material.
   if(!s&&kind(mask)!=='end'&&kind(mask)!=='isolated'){
    // Preserve the whole lamp reflection INCLUDING its lit curb and pavement.
    // Previous extraction clipped it to asphalt within 3m of the cell centre,
    // which discarded the brightest curb glint and multiplied the tail opacity.
    let u=x,w=y;
    if(mask===5){u=y;w=16-x;}
    if(kind(mask)==='curve'){u=v.s-(1+7*Math.PI/2+1)/2+8;w=8+v.signed;}
    const radius=Math.hypot((u-6.2)/4.5,(w-6)/3.2);
    if(radius<1.2){const p=project(u,w),rgba=sample(specular,p.x+ROAD.sourceLeft,p.y+ROAD.sourceTop);
     const warmth=Math.max(0,Math.min(1,(rgba[0]-rgba[2]-30)/90));
     const feather=Math.max(0,Math.min(1,(1.2-radius)/.2));
     if(rgba[3]>180&&warmth>0){for(let k=0;k<3;k++)light[o+k]=rgba[k];light[o+3]=Math.round(255*warmth*feather);}
    }
   }
  }
  const name='road-'+mask;for(const [suffix,data]of [['',base],['-lines',lines],['-light',light],['-sidewalk-leaves',sideLeaves],['-gutter-leaves',gutterLeaves]])await sharp(data,{raw:{width:ROAD.width,height:ROAD.height,channels:4}}).png().toFile(path.join(out,'tiles',name+suffix+'.png'));
  assets.push({mask,kind:kind(mask),ports:PORTS.filter(p=>mask&p.bit).map(p=>p.name),file:name+'.png',lines:name+'-lines.png',light:name+'-light.png',sidewalkLeaves:name+'-sidewalk-leaves.png',gutterLeaves:name+'-gutter-leaves.png',width:ROAD.width,height:ROAD.height,sha:sha(await fs.readFile(path.join(out,'tiles',name+'.png')))});
 }
 await fs.writeFile(path.join(out,'atlas.json'),JSON.stringify({version:1,road:ROAD,source:profile,assets,materials:'Shared AI-cleaned painted reference pixels, UV-mapped in ground space. No vector asphalt or concrete.',accentSource:'native/straight-cutout.png',gameplayChanged:false},null,2));
 for(const category of ['sidewalk','gutter'])await fs.copyFile(path.join(out,'native/leaves-'+category+'.png'),path.join(out,'decals/leaves-'+category+'.png'));
 console.log(JSON.stringify({tiles:assets.length,layers:80,sourceNative:source.width+'x'+source.height}));
}else if(mode==='demo'){
 const cells=new Set();for(let i=0;i<=6;i++)cells.add(`${i},3`);for(let j=0;j<=6;j++)cells.add(`3,${j}`);
 for(let i=1;i<=5;i++){cells.add(`${i},1`);cells.add(`${i},5`);}for(let j=1;j<=5;j++){cells.add(`1,${j}`);cells.add(`5,${j}`);}
 const tiles=tilesFor(cells),w=7168,h=3584,layers=[];
 for(const [i,t]of tiles.entries()){
  const left=3072+(t.x-t.y)*512,top=(t.x+t.y)*256;
  layers.push({input:path.join(out,'tiles','road-'+t.mask+'.png'),left,top});
  layers.push({input:path.join(out,'tiles','road-'+t.mask+'-lines.png'),left,top});
  if(i%6===0)layers.push({input:path.join(out,'tiles','road-'+t.mask+'-light.png'),left,top});
  if(i%3!==1){layers.push({input:path.join(out,'tiles','road-'+t.mask+'-sidewalk-leaves.png'),left,top});layers.push({input:path.join(out,'tiles','road-'+t.mask+'-gutter-leaves.png'),left,top});}
 }
 const transparent=await sharp({create:{width:w,height:h,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(layers).png().toBuffer();
 await fs.writeFile(path.join(out,'road-network-transparent.png'),transparent);
 // Neutral preview backing is not part of the exported road art.
 await sharp(transparent).flatten({background:'#334535'}).png().toFile(path.join(out,'road-builder-proof.png'));
 await sharp(transparent).flatten({background:'#334535'}).resize({width:2800,withoutEnlargement:true}).webp({quality:95}).toFile(path.join(out,'road-builder-preview.webp'));
 await fs.writeFile(path.join(out,'demo-plan.json'),JSON.stringify({cells:[...cells],tiles,width:w,height:h,sourceTileWidth:1024,upscaled:false,lightsEvery:6,background:'neutral review backing, not a grass asset'},null,2));
 console.log(JSON.stringify({width:w,height:h,cells:tiles.length}));
}else if(mode==='editor'){
 const atlas=JSON.parse(await fs.readFile(path.join(out,'atlas.json'),'utf8')),images={};
 for(const a of atlas.assets)for(const f of [a.file,a.lines,a.light,a.sidewalkLeaves,a.gutterLeaves])images[f]='data:image/png;base64,'+(await fs.readFile(path.join(out,'tiles',f))).toString('base64');
 const plan=JSON.parse(await fs.readFile(path.join(out,'demo-plan.json'),'utf8'));
 const template=await fs.readFile(path.join(import.meta.dirname,'road-autotile-review.html'),'utf8');
 await fs.writeFile(path.join(out,'review/road-builder.html'),template.replace('/*ASSETS*/',JSON.stringify({atlas,images,plan})));
 console.log(path.join(out,'review/road-builder.html'));
}else if(mode==='check'){
 const atlas=JSON.parse(await fs.readFile(path.join(out,'atlas.json'),'utf8')),loaded=[];for(const a of atlas.assets){const f=path.join(out,'tiles',a.file),b=await fs.readFile(f),m=await sharp(b).metadata();if(sha(b)!==a.sha||m.width!==1024||m.height!==512||!m.hasAlpha)throw Error('Asset failed '+a.file);loaded[a.mask]=await load(f);}
 let samples=0;for(const p of PORTS){const relevant=atlas.assets.filter(a=>a.mask&p.bit),reference=loaded[relevant[0].mask];
  for(let along=.05;along<.8;along+=.12)for(let cross=-4.9;cross<=4.9;cross+=.13){
   const wx=p.name==='N'||p.name==='S'?8+cross:p.name==='W'?along:16-along,wy=p.name==='W'||p.name==='E'?8+cross:p.name==='N'?along:16-along,pt=project(wx,wy),ix=Math.floor(pt.x),iy=Math.floor(pt.y),o=(iy*1024+ix)*4;
   for(const a of relevant){const img=loaded[a.mask];for(let k=0;k<4;k++)if(img.data[o+k]!==reference.data[o+k])throw Error(`Socket mismatch ${p.name} mask${a.mask} at ${wx},${wy}`);samples++;}
  }
 }
 await fs.writeFile(path.join(out,'validation.json'),JSON.stringify({pass:true,tiles:16,pixelSocketComparisons:samples,alpha:true,isometricRatio:'2:1',sourceHash:profile.sha,geometryOnly:false,visualApproval:'pending native connected proof review',note:'These are shared raster socket checks, not a guarantee of global visual fidelity.'},null,2));
 console.log(JSON.stringify({pass:true,tiles:16,pixelSocketComparisons:samples}));
}else throw Error('bake | demo | editor | check');
async function load(file){const m=await sharp(file).metadata(),{data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});return {...info,hasAlpha:m.hasAlpha,data};}
function sample(img,x,y){x=Math.max(0,Math.min(img.width-1.001,x));y=Math.max(0,Math.min(img.height-1.001,y));const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,out=[];for(let k=0;k<4;k++){const a=(iy*img.width+ix)*4+k,b=a+4,c=a+img.width*4,d=c+4;out.push(Math.round((img.data[a]*(1-fx)+img.data[b]*fx)*(1-fy)+(img.data[c]*(1-fx)+img.data[d]*fx)*fy));}return out;}
function material(x,y,v,s){
 const half=ROAD.asphaltM/2+ROAD.sidewalkM,along=s?s.along:v.s,signed=s?s.signed:Math.sign(v.signed||1)*v.distance;
 const phase=mod(along,profile.periodM)/profile.periodM,cross=Math.max(0,Math.min(1,(signed+half)/(2*half)));
 const edge=sample(source,profile.left+cross*(profile.width-1),profile.top+phase*(profile.height-1));
 if(v.type!=='asphalt')return edge;
 // Shared, isotropic painted aggregate in ground coordinates, NOT a screen grid
 // and NOT a stretched curb profile wrapped around junctions. Preserve the
 // source's darker gutter skin only in the last .25m next to the curb.
 const aggregate=periodicAsphalt(x,y),edgeMix=Math.max(0,Math.min(1,(v.distance-3)/.25));
 return aggregate.map((c,k)=>Math.round(c*(1-edgeMix)+edge[k]*edgeMix));
}
function periodicAsphalt(x,y){
 const p={left:581,top:1095,width:92,height:152},sx=14,sy=24,px=p.width-sx,py=p.height-sy,u=mod(x,4)/4*px,v=mod(y,4)/4*py,wx=u<sx?1-u/sx:0,wy=v<sy?1-v/sy:0;
 const a=sample(source,p.left+u,p.top+v),b=sample(source,p.left+u+px,p.top+v),c=sample(source,p.left+u,p.top+v+py),d=sample(source,p.left+u+px,p.top+v+py);
 return a.map((_,k)=>(a[k]*(1-wx)+b[k]*wx)*(1-wy)+(c[k]*(1-wx)+d[k]*wx)*wy);
}
async function leafSource(file){
 const img=await load(file);if(!img.hasAlpha)throw Error('Leaf image lacks genuine alpha: '+file);
 let n=0,sx=0,sy=0,sxx=0,sxy=0,minX=img.width,maxX=0,spread=0,clear=0;
 for(let y=0;y<img.height;y++)for(let x=0;x<img.width;x++){const a=img.data[(y*img.width+x)*4+3];if(!a)clear++;if(a<80)continue;const w=a/255;n+=w;sx+=x*w;sy+=y*w;sxx+=x*x*w;sxy+=x*y*w;minX=Math.min(minX,x);maxX=Math.max(maxX,x);}
 if(!n||clear/img.width/img.height<.35)throw Error('Invalid leaf cutout');const slope=(sxy-sx*sy/n)/(sxx-sx*sx/n),intercept=(sy-slope*sx)/n;
 for(let y=0;y<img.height;y++)for(let x=0;x<img.width;x++){const a=img.data[(y*img.width+x)*4+3];if(a>=80)spread=Math.max(spread,Math.abs(y-slope*x-intercept));}
 return {img,minX,maxX,slope,intercept,spread:spread*2};
}
