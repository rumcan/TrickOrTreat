/** Quality correction of the art prototype. No runtime/gameplay changes. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import {ROAD,PORTS,kind,mod,project,unproject,tilesFor,socket} from '../../lib/road-autotile.mjs';
import {QUALITY,field,pavingUV,relight,sourceOver,variantFor,lightFrame,leafUV} from '../../lib/road-autotile-quality.mjs';
import {ROOT} from '../../lib/town-paths.mjs';
const out=path.join(ROOT,'output/road-autotile-v2'),old=path.resolve(out,'../road-autotile-v1');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const mode=process.argv[2],S=QUALITY.supersample,W=ROAD.width*S,H=ROAD.height*S;
const suffixes=['','-lines','-light','-sidewalk-leaves','-gutter-leaves'];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const frames=Array.from({length:16},(_,m)=>lightFrame(m)),openPorts=Array.from({length:16},(_,m)=>PORTS.filter(p=>m&p.bit)),topology=Array.from({length:16},(_,m)=>kind(m));
if(mode==='bake'){
 const asphalt=await load(path.join(out,'native/asphalt-detail.png'),512),concrete=await load(path.join(out,'native/concrete-slabs.png'),512);
 const grain=await raw(await sharp(path.join(out,'native/concrete-slabs.png')).extract({left:62,top:62,width:505,height:505}).resize(128,128).ensureAlpha().raw().toBuffer({resolveWithObject:true}));
 const master=await load(path.join(old,'native/material-master.png'));
 // Average a clean curb-only cross section, not an entire photographed sidewalk.
 const curb=[];for(let i=0;i<20;i++){const c=[0,0,0];for(let y=1150;y<1175;y++){const v=sample(master,675+i,y);for(let k=0;k<3;k++)c[k]+=v[k]/25;}curb.push(c);}
 const lightField=await makeLightField();
 const leafAtlas=await makeLeaves();
 await fs.writeFile(path.join(out,'sources/leaf-sprites.json'),JSON.stringify(leafAtlas.map(l=>({cell:l.cell,bounds:l.bounds,sourcePixels:l.sourcePixels,filter:'premultiplied Lanczos, disconnected alpha speckles removed',width:l.width,height:l.height})),null,2));
 const materials={asphalt,concrete,grain,curb,lightField};
 const assets=[];
 for(let mask=0;mask<16;mask++){
  const buffers=suffixes.map(()=>Buffer.alloc(W*H*4));
  const [base,lines,light]=buffers;
  for(let py=0;py<H;py++)for(let px=0;px<W;px++){
   const {x,y}=unproject((px+.5)/S,(py+.5)/S);
   // Leave a sampling halo at cell edges. Half-open ownership is applied AFTER
   // downsampling, so touching tile alphas never double-feather into green cracks.
   if(x<-.08||y<-.08||x>16.08||y>16.08)continue;
   const v=field(mask,x,y);if(v.type==='grass')continue;
   const o=(py*W+px)*4,c=material(mask,x,y,v,materials);
   put(base,o,c,255);
   const a=lineAlpha(mask,x,y,v,c);
   const ink=[189,144,57];if(a>0)put(lines,o,ink,Math.round(a*255));
   const litBase=a>0?sourceOver(c,ink,a):c;
   const energy=illumination(mask,x,y,v,materials);
   if(energy>.001)put(light,o,relight(litBase,energy,v.type),255);
  }
  const placements=placeLeaves(mask,leafAtlas,buffers[3],buffers[4]);
  for(let i=0;i<buffers.length;i++){
   const {data}=await sharp(buffers[i],{raw:{width:W,height:H,channels:4}}).resize(ROAD.width,ROAD.height,{kernel:'lanczos3'}).raw().toBuffer({resolveWithObject:true});
   for(let py=0;py<ROAD.height;py++)for(let px=0;px<ROAD.width;px++){
    const p=unproject(px+.5,py+.5),o=(py*ROAD.width+px)*4;
    if(p.x<0||p.y<0||p.x>=16||p.y>=16){data.fill(0,o,o+4);continue;}
    // Paving always fully covers shared sockets; only OUTSIDE paving is AA.
    const v=field(mask,p.x,p.y);
    if(i===0&&socket(mask,p.x,p.y)&&v.roadDistance<ROAD.sidewalkM-.06)data[o+3]=255;
   }
   await sharp(data,{raw:{width:ROAD.width,height:ROAD.height,channels:4}}).png().toFile(path.join(out,'tiles',`road-${mask}${suffixes[i]}.png`));
  }
  const name='road-'+mask;
  assets.push({mask,kind:kind(mask),ports:PORTS.filter(p=>mask&p.bit).map(p=>p.name),file:name+'.png',lines:name+'-lines.png',light:name+'-light.png',sidewalkLeaves:name+'-sidewalk-leaves.png',gutterLeaves:name+'-gutter-leaves.png',width:ROAD.width,height:ROAD.height,leaves:placements,sha:sha(await fs.readFile(path.join(out,'tiles',name+'.png')))});
  console.log(`Baked ${mask}: ${kind(mask)}; ${placements.sidewalk.length} sidewalk / ${placements.gutter.length} gutter leaves`);
 }
 const sources=[];
 for(const id of ['asphalt-detail','concrete-slabs','individual-leaves','warm-reflection']){
  const f=path.join(out,'native',id+'.png'),b=await fs.readFile(f),receipt=JSON.parse(await fs.readFile(path.join(out,'native',id+'.json'),'utf8'));
  if(sha(b)!==receipt.sha)throw Error('Changed native master '+id);
  sources.push({id,width:receipt.width,height:receipt.height,sha:receipt.sha});
 }
 await fs.writeFile(path.join(out,'atlas.json'),JSON.stringify({version:2,road:ROAD,quality:QUALITY,sources,assets,materials:'Native detailed raster asphalt/concrete, ground-space UVs; painted curb-only profile. Exact geometry controls masks, not painted vector surfaces.',illumination:'Pavement-free painted reflection converted to scalar light in a fixed ground frame anchored at a real curb. Shades current material/markings; never copies photographed pavement RGB.',leaves:'Individual cleaned top-down PNG leaves; one ground rotation and one 2:1 projection. No ribbon warping.',gameplayChanged:false,visualApproval:'pending user review'},null,2));
}else if(mode==='demo'){
 const cells=new Set();for(let i=0;i<=6;i++)cells.add(`${i},3`);for(let j=0;j<=6;j++)cells.add(`3,${j}`);
 for(let i=1;i<=5;i++){cells.add(`${i},1`);cells.add(`${i},5`);}for(let j=1;j<=5;j++){cells.add(`1,${j}`);cells.add(`5,${j}`);}
 const tiles=tilesFor(cells),w=7168,h=3584,layers=[];
 for(const t of tiles){const left=3072+(t.x-t.y)*512,top=(t.x+t.y)*256,v=variantFor(t.x,t.y,t.mask);
  for(const s of ['', '-lines',...(v.light?['-light']:[]),...(v.leaves?['-sidewalk-leaves','-gutter-leaves']:[])])layers.push({input:path.join(out,'tiles',`road-${t.mask}${s}.png`),left,top});
 }
 const transparent=await sharp({create:{width:w,height:h,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(layers).png().toBuffer();
 await fs.writeFile(path.join(out,'road-network-transparent.png'),transparent);
 await sharp(transparent).flatten({background:'#334535'}).png().toFile(path.join(out,'road-builder-proof.png'));
 await sharp(transparent).flatten({background:'#334535'}).resize({width:2800}).webp({quality:96}).toFile(path.join(out,'road-builder-preview.webp'));
 await fs.writeFile(path.join(out,'demo-plan.json'),JSON.stringify({cells:[...cells],tiles,width:w,height:h,sourceTileWidth:1024,upscaled:false,variants:'stable coordinate hash, independent of sorted draw index',background:'neutral preview backing, not a grass asset'},null,2));
 await closeups();console.log('Wrote full proof and native close-up comparisons');
}else if(mode==='editor'){
 const atlas=JSON.parse(await fs.readFile(path.join(out,'atlas.json'),'utf8')),images={};
 for(const a of atlas.assets)for(const f of [a.file,a.lines,a.light,a.sidewalkLeaves,a.gutterLeaves])images[f]='data:image/png;base64,'+(await fs.readFile(path.join(out,'tiles',f))).toString('base64');
 const plan=JSON.parse(await fs.readFile(path.join(out,'demo-plan.json'),'utf8'));
 const template=await fs.readFile(path.join(import.meta.dirname,'road-autotile-quality-review.html'),'utf8');
 await fs.writeFile(path.join(out,'review/road-builder.html'),template.replace('/*ASSETS*/',JSON.stringify({atlas,images,plan})));
 console.log(path.join(out,'review/road-builder.html'));
}else throw Error('bake | demo | editor');

async function raw(result){return {...result.info,data:result.data};}
async function load(file,width){let q=sharp(file);if(width)q=q.resize(width,width,{kernel:'lanczos3'});return raw(await q.ensureAlpha().raw().toBuffer({resolveWithObject:true}));}
function sample(img,x,y){x=clamp(x,0,img.width-1.001);y=clamp(y,0,img.height-1.001);const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,a=(iy*img.width+ix)*4,b=a+4,c=a+img.width*4,d=c+4;
 return [0,1,2,3].map(k=>(img.data[a+k]*(1-fx)+img.data[b+k]*fx)*(1-fy)+(img.data[c+k]*(1-fx)+img.data[d+k]*fx)*fy);
}
function periodic(img,x,y,metres){return sample(img,mod(x,metres)/metres*(img.width-1),mod(y,metres)/metres*(img.height-1));}
function put(b,o,c,a){for(let k=0;k<3;k++)b[o+k]=clamp(Math.round(c[k]),0,255);b[o+3]=a;}
function material(mask,x,y,v,m){
 const d=v.roadDistance;
 if(d<-.14)return periodic(m.asphalt,x,y,4).slice(0,3).map(c=>c*.88);
 if(d<.17){const t=clamp((d+.14)/.31,0,1)*(m.curb.length-1),i=Math.floor(t),f=t-i;return m.curb[i].map((c,k)=>c*(1-f)+m.curb[Math.min(i+1,m.curb.length-1)][k]*f);}
 const uv=pavingUV(mask,x,y,v),g=periodic(m.grain,x,y,1).slice(0,3);
 // Only the seam/bevel PIXELS of the painted slabs follow curb-relative UVs.
 // Fine concrete grain remains in world space: never enlarged/stretched fans.
 const a=mod(uv.along,1),b=mod(uv.cross,1),jointA=Math.min(a,1-a),jointB=Math.min(b,1-b);
 const profileA=periodic(m.concrete,a,.45,2),profileB=periodic(m.concrete,.45,b,2);
 const weightA=clamp(1-jointA/.09,0,1),weightB=clamp(1-jointB/.09,0,1);
 return g.map((c,k)=>(c*(1-weightA)*(1-weightB)+profileA[k]*weightA*(1-weightB)+profileB[k]*weightB)*[1,.92,.91][k]);
}
function lineAlpha(mask,x,y,v,c){
 if(!mask||v.type!=='asphalt'||v.distance>.072)return 0;
 const k=topology[mask];if(k!=='straight'&&k!=='curve'&&v.s>4.5)return 0;
 let phase=Math.abs(v.tx)>.5?x:y;
 if(k==='curve'){
  if(v.part==='arc')phase=2+v.theta*6+(mod(14-2-6*Math.PI/2,4))*clamp((v.theta-.2)/1.15,0,1);
  else phase=Math.abs(v.tx)>.5?x:y;
 }
 if(mod(phase,4)>1.65)return 0;
 return .64*clamp((.072-v.distance)/.016,0,1)*clamp((c[0]+c[1]+c[2])/145,.6,1.08);
}
async function makeLightField(){
 const img=await raw(await sharp(path.join(out,'native/warm-reflection.png')).resize({width:384,kernel:'lanczos3'}).ensureAlpha().raw().toBuffer({resolveWithObject:true}));
 const data=Buffer.alloc(img.data.length);
 for(let i=0;i<data.length;i+=4){const e=clamp((img.data[i]*.3+img.data[i+1]*.7)/255*(img.data[i+3]/255)*1.5,0,1);put(data,i,[e*255,e*255,e*255],255);}
 await sharp(data,{raw:{width:img.width,height:img.height,channels:4}}).png().toFile(path.join(out,'sources/reflection-intensity.png'));
 return {...img,data};
}
function illumination(mask,x,y,v,m){
 const f=frames[mask];if(!f)return 0;
 const dx=x-f.x,dy=y-f.y,u=(dx*f.tx+dy*f.ty)/2.8+.5,t=.2+(dx*f.nx+dy*f.ny+3.25)/4.4;
 if(u<=0||u>=1||t<=0||t>=1)return 0;
 let collarFade=1;
 for(const p of openPorts[mask]){const edge=p.name==='N'?y:p.name==='S'?16-y:p.name==='W'?x:16-x;collarFade=Math.min(collarFade,clamp((edge-2)/.6,0,1));}
 const e=sample(m.lightField,u*(m.lightField.width-1),t*(m.lightField.height-1))[0]/255,aggregate=periodic(m.asphalt,x,y,4),roughness=clamp((aggregate[0]+aggregate[1]+aggregate[2])/180,.8,1.2);
 return e*collarFade*roughness;
}
async function makeLeaves(){
 const native=await load(path.join(out,'native/individual-leaves.png')),leaves=[];
 for(let row=0;row<4;row++)for(let col=0;col<4;col++){
  const left=Math.round(col*native.width/4),top=Math.round(row*native.height/4),right=Math.round((col+1)*native.width/4),bottom=Math.round((row+1)*native.height/4),w=right-left,h=bottom-top;
  const visited=new Uint8Array(w*h),components=[];
  for(let i=0;i<w*h;i++){
   const x=i%w,y=Math.floor(i/w);if(visited[i]||native.data[((top+y)*native.width+left+x)*4+3]<48)continue;
   const queue=[i],pixels=[];visited[i]=1;
   for(let n=0;n<queue.length;n++){const j=queue[n];pixels.push(j);const xx=j%w,yy=Math.floor(j/w);
    for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=xx+dx,ny=yy+dy,k=ny*w+nx;if(nx<0||ny<0||nx>=w||ny>=h||visited[k])continue;if(native.data[((top+ny)*native.width+left+nx)*4+3]>=48){visited[k]=1;queue.push(k);}}
   }components.push(pixels);
  }
  components.sort((a,b)=>b.length-a.length);const main=components[0];if(!main||main.length<2000)throw Error('Missing individual leaf '+row+','+col);
  let minX=w,minY=h,maxX=0,maxY=0;for(const i of main){minX=Math.min(minX,i%w);maxX=Math.max(maxX,i%w);minY=Math.min(minY,Math.floor(i/w));maxY=Math.max(maxY,Math.floor(i/w));}
  const bw=maxX-minX+5,bh=maxY-minY+5,b=Buffer.alloc(bw*bh*4),membership=new Uint8Array(w*h);for(const i of main)membership[i]=1;
  // Retain a one-pixel feather around the connected leaf, discard stray red dust.
  for(let yy=minY-1;yy<=maxY+1;yy++)for(let xx=minX-1;xx<=maxX+1;xx++){
   if(xx<0||yy<0||xx>=w||yy>=h)continue;let keep=false;
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const qx=xx+dx,qy=yy+dy;if(qx>=0&&qy>=0&&qx<w&&qy<h&&membership[qy*w+qx])keep=true;}
   if(keep){const o=((yy-minY+2)*bw+xx-minX+2)*4,i=((top+yy)*native.width+left+xx)*4;for(let k=0;k<4;k++)b[o+k]=native.data[i+k];}
  }
  const {data,info}=await sharp(b,{raw:{width:bw,height:bh,channels:4}}).resize(48,48,{fit:'inside',kernel:'lanczos3'}).raw().toBuffer({resolveWithObject:true});
  leaves.push({...info,data,cell:[col,row],sourcePixels:main.length,bounds:{left:left+minX,top:top+minY,width:bw,height:bh}});
 }
 return leaves;
}
function placeLeaves(mask,atlas,side,gutter){
 let seed=mask*701+419;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const placements={sidewalk:[],gutter:[]};
 for(const [category,buffer,count]of [['sidewalk',side,155],['gutter',gutter,210]]){
  for(let tries=0;tries<16000&&placements[category].length<count;tries++){
   const x=rand()*16,y=rand()*16,v=field(mask,x,y);
   if(socket(mask,x,y))continue;
   if(category==='sidewalk'?(v.type!=='sidewalk'||v.roadDistance<.2||v.roadDistance>1.65):(v.type!=='asphalt'||v.roadDistance<-.48||v.roadDistance>-.17))continue;
   if(Math.sin(x*.82+y*1.36+mask)*.4+.55<rand()*.65)continue;
   const leaf=atlas[Math.floor(rand()*atlas.length)],length=.12+rand()*.13,angle=rand()*Math.PI*2;
   stamp(buffer,leaf,x,y,length,angle,mask,category);
   placements[category].push({x,y,lengthM:length,angle,cell:leaf.cell});
  }
 }
 return placements;
}
function stamp(buffer,leaf,x,y,length,angle,mask,category){
 const p=project(x,y),cx=p.x*S,cy=p.y*S,r=length*ROAD.pxPerAxisM*S*1.6,aspect=leaf.height/leaf.width;
 for(let py=Math.max(0,Math.floor(cy-r));py<Math.min(H,Math.ceil(cy+r));py++)for(let px=Math.max(0,Math.floor(cx-r));px<Math.min(W,Math.ceil(cx+r));px++){
  const q=unproject((px+.5)/S,(py+.5)/S),{u:lx,v:ly}=leafUV(q.x-x,q.y-y,length,aspect,angle);
  if(lx<=0||ly<=0||lx>=1||ly>=1)continue;
  const v=field(mask,q.x,q.y);if(category==='sidewalk'?(v.type!=='sidewalk'):(v.type!=='asphalt'||v.roadDistance<-.65))continue;
  const rgba=sample(leaf,lx*(leaf.width-1),ly*(leaf.height-1)),o=(py*W+px)*4,a=rgba[3]/255;if(a<.015)continue;
  const destA=buffer[o+3]/255,total=a+destA*(1-a);
  for(let k=0;k<3;k++)buffer[o+k]=Math.round((rgba[k]*.85*a+buffer[o+k]*destA*(1-a))/total);
  buffer[o+3]=Math.round(total*255);
 }
}
async function tileComposite(root,mask,{lights=true,leaves=true}={}){
 const parts=['-lines',...(lights?['-light']:[]),...(leaves?['-sidewalk-leaves','-gutter-leaves']:[])].map(s=>({input:path.join(root,'tiles',`road-${mask}${s}.png`)}));
 return sharp(path.join(root,'tiles',`road-${mask}.png`)).composite(parts).flatten({background:'#334535'}).png().toBuffer();
}
async function closeups(){
 const masks=[10,3,15,1],rows=[],captions=['Straight: fine aggregate, paint and separate leaves','Curve: slab fans and smooth curb','Intersection: rounded returns, current-pixel lighting','Dead end: continuous paving, anti-aliased edges'];
 for(const [i,mask]of masks.entries()){
  const before=await tileComposite(old,mask),after=await tileComposite(out,mask);
  const label=Buffer.from(`<svg width="2048" height="54"><rect width="2048" height="54" fill="#111d20"/><text x="20" y="34" fill="#fff" font-family="sans-serif" font-size="23">Before</text><text x="1044" y="34" fill="#fff" font-family="sans-serif" font-size="23">After — ${captions[i]}</text></svg>`);
  rows.push({input:label,left:0,top:i*566},{input:before,left:0,top:i*566+54},{input:after,left:1024,top:i*566+54});
 }
 await sharp({create:{width:2048,height:2264,channels:4,background:'#334535'}}).composite(rows).png().toFile(path.join(out,'review/before-after-native.png'));
 for(const mask of masks)await fs.writeFile(path.join(out,'review',`native-${kind(mask)}.png`),await tileComposite(out,mask));
 const dressed=[],bare=[];
 for(let mask=0;mask<16;mask++){
  const painted=await tileComposite(out,mask),clean=await tileComposite(out,mask,{lights:false,leaves:false}),left=(mask%4)*1024,top=Math.floor(mask/4)*546;
  const label=Buffer.from(`<svg width="1024" height="34"><rect width="1024" height="34" fill="#111d20"/><text x="16" y="24" fill="#fff" font-family="sans-serif" font-size="18">Mask ${mask} · ${kind(mask)} · ${PORTS.filter(p=>mask&p.bit).map(p=>p.name).join('/')||'no ports'}</text></svg>`);
  dressed.push({input:label,left,top},{input:painted,left,top:top+34});bare.push({input:label,left,top},{input:clean,left,top:top+34});
  await fs.writeFile(path.join(out,'review',`native-mask-${mask}.png`),painted);
 }
 for(const [file,layers]of [['all-topologies.png',dressed],['bare-topologies.png',bare]])await sharp({create:{width:4096,height:2184,channels:4,background:'#334535'}}).composite(layers).png().toFile(path.join(out,'review',file));
}
