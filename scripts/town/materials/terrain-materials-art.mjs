import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT,artDir} from '../../lib/town-paths.mjs';

const master=path.join(artDir('terrain-materials'));
const out=path.join(ROOT,'output/terrain-materials');
await fs.mkdir(path.join(master,'generated'),{recursive:true});
await fs.mkdir(out,{recursive:true});
const [command,id,source,prompt,reference]=process.argv.slice(2);
const hash=b=>createHash('sha256').update(b).digest('hex');
async function raw(file) {return sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});}
async function tilingStats(file) {
  const {data,info}=await raw(file); const {width:w,height:h}=info;
  let xEdge=0,yEdge=0,xInside=0,yInside=0,xCount=0,yCount=0;
  for(let y=0;y<h;y++) for(let c=0;c<3;c++) xEdge+=Math.abs(data[(y*w)*4+c]-data[(y*w+w-1)*4+c]);
  for(let x=0;x<w;x++) for(let c=0;c<3;c++) yEdge+=Math.abs(data[x*4+c]-data[((h-1)*w+x)*4+c]);
  for(let y=0;y<h;y+=4) for(let x=1;x<w;x+=4) for(let c=0;c<3;c++) {xInside+=Math.abs(data[(y*w+x)*4+c]-data[(y*w+x-1)*4+c]);xCount++;}
  for(let y=1;y<h;y+=4) for(let x=0;x<w;x+=4) for(let c=0;c<3;c++) {yInside+=Math.abs(data[(y*w+x)*4+c]-data[((y-1)*w+x)*4+c]);yCount++;}
  return {horizontalJoinMean:xEdge/(h*3),verticalJoinMean:yEdge/(w*3),horizontalNeighborMean:xInside/xCount,verticalNeighborMean:yInside/yCount};
}
if(command==='ingest') {
  assert(/^[a-z0-9-]+$/.test(id));
  const target=path.join(master,'generated',id+'.png');
  await fs.copyFile(source,target,1);
  const metadata=await sharp(target).metadata();
  const {data,info}=await raw(target);
  let zero=0,partial=0,solid=0; for(let i=3;i<data.length;i+=4){if(data[i]===0)zero++;else if(data[i]===255)solid++;else partial++;}
  const pixels=info.width*info.height;
  const receipt={id,width:metadata.width,height:metadata.height,hasAlpha:metadata.hasAlpha,transparentFraction:zero/pixels,featheredFraction:partial/pixels,opaqueFraction:solid/pixels,prompt,reference,source,tool:'built-in image_gen',visuallyAccepted:false};
  if(id.endsWith('base')) receipt.tiling=await tilingStats(target);
  await fs.writeFile(path.join(master,'generated',id+'.json'),JSON.stringify(receipt,null,2));
  for(const ext of ['png','json'])await fs.copyFile(path.join(master,'generated',id+'.'+ext),path.join(out,id+'.'+ext),1);
  console.log(JSON.stringify({...receipt,prompt:undefined}));
} else if(command==='preview-one') {
  const file=path.join(master,'generated',id+'.png'),m=await sharp(file).metadata();
  const target=path.join(out,id+'-alpha-preview.jpg');
  await sharp({create:{width:m.width,height:m.height,channels:3,background:'#3f4854'}}).composite([{input:file}]).jpeg({quality:95}).toFile(target);
  console.log(target);
} else if(command==='offset') {
  const file=path.join(master,'generated',id+'.png');
  const m=await sharp(file).metadata(),hx=Math.floor(m.width/2),hy=Math.floor(m.height/2);
  assert(m.width%2===0 && m.height%2===0,'Even dimensions required for exact half-offset');
  const layers=[];
  for(let y=0;y<2;y++)for(let x=0;x<2;x++)layers.push({input:await sharp(file).extract({left:(1-x)*hx,top:(1-y)*hy,width:hx,height:hy}).png().toBuffer(),left:x*hx,top:y*hy});
  await fs.mkdir(path.join(master,'guides'),{recursive:true});
  const target=path.join(master,'guides',id+'-offset.png');
  await sharp({create:{width:m.width,height:m.height,channels:3,background:'#000000'}}).composite(layers).png().toFile(target);
  console.log(target);
} else if(command==='review') {
  const target=path.join(master,'generated',id+'.json');
  const receipt=JSON.parse(await fs.readFile(target,'utf8'));
  receipt.visuallyAccepted=source==='accept';receipt.reviewNotes=prompt;
  await fs.writeFile(target,JSON.stringify(receipt,null,2));
  await fs.copyFile(target,path.join(out,id+'.json'));
} else if(command==='repeat') {
  const input=path.join(master,'generated',id+'.png');
  const tile=await sharp(input).resize(640,640,{fit:'fill'}).png().toBuffer();
  const layers=[];for(let y=0;y<3;y++)for(let x=0;x<3;x++)layers.push({input:tile,left:x*640,top:y*640});
  const target=path.join(out,id+'-repeat-preview.jpg');
  await sharp({create:{width:1920,height:1920,channels:3,background:'#111111'}}).composite(layers).jpeg({quality:94}).toFile(target);
  console.log(target);
} else if(command==='contact') {
  const files=(await fs.readdir(path.join(master,'generated'))).filter(f=>/^decal-\d\d-.*\.png$/.test(f)).sort();
  const layers=[];const w=440,h=360;
  for(let i=0;i<files.length;i++){
    const buffer=await sharp(path.join(master,'generated',files[i])).resize(w-24,h-48,{fit:'inside'}).png().toBuffer();
    layers.push({input:buffer,left:i%2*w+12,top:Math.floor(i/2)*h+36});
    layers.push({input:Buffer.from(`<svg width="440" height="28"><text x="12" y="20" fill="white" font-family="sans-serif" font-size="17">${files[i]}</text></svg>`),left:i%2*w,top:Math.floor(i/2)*h});
  }
  const target=path.join(out,'decals-preview.jpg');
  await sharp({create:{width:w*2,height:h*Math.ceil(files.length/2),channels:3,background:'#324338'}}).composite(layers).jpeg({quality:93}).toFile(target);
  console.log(target);
} else if(command==='demo') {
  const w=2048,h=1536,t=768;
  async function tiled(file) {
    const tile=await sharp(file).resize(t,t).png().toBuffer();const layers=[];
    // Extend then crop so edge tiles aren't clipped by the compositor.
    for(let y=0;y<3;y++)for(let x=0;x<3;x++)layers.push({input:tile,left:x*t,top:y*t});
    return sharp({create:{width:t*3,height:t*3,channels:4,background:'#00000000'}}).composite(layers).extract({left:0,top:0,width:w,height:h}).png().toBuffer();
  }
  const selection=JSON.parse(await fs.readFile(path.join(master,'selected.json'),'utf8'));
  const grass=await tiled(path.join(master,'generated',selection.grass+'.png'));
  const soil=await tiled(path.join(master,'generated',selection.soil+'.png'));
  const outline='M -160 1050 C 330 1350 410 730 860 860 C 1260 970 1140 1230 1550 1080 C 1870 930 1900 790 2210 810 L 2220 1160 C 1780 1120 1590 1600 1170 1370 C 750 1130 440 1590 -160 1420 Z';
  const maskSVG=Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><path d="${outline}" fill="white"/></svg>`);
  const mask=await sharp(maskSVG).blur(32).png().toBuffer();
  const soilLayer=await sharp(soil).composite([{input:mask,blend:'dest-in'}]).png().toBuffer();
  const decals=(await fs.readdir(path.join(master,'generated'))).filter(f=>/^decal-\d\d-.*\.png$/.test(f)).sort();
  const spots=[[80,70],[420,130],[980,80],[1530,160],[170,550],[660,400],[1270,450],[1570,640],[380,960],[1000,1040]];
  const layers=[{input:soilLayer,left:0,top:0}];
  for(let i=0;i<decals.length;i++){
    const input=await sharp(path.join(master,'generated',decals[i])).resize(520,420,{fit:'inside'}).png().toBuffer();
    layers.push({input,left:Math.min(spots[i][0],w-520),top:Math.min(spots[i][1],h-420)});
  }
  await sharp(grass).composite(layers).png().toFile(path.join(out,'terrain-blend-demo.png'));
  const soilUri='data:image/png;base64,'+(await fs.readFile(path.join(master,'generated',selection.soil+'.png'))).toString('base64');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><pattern id="soil" patternUnits="userSpaceOnUse" width="${t}" height="${t}"><image href="${soilUri}" width="${t}" height="${t}"/></pattern><filter id="feather" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="32"/></filter><mask id="ground-edge"><path d="${outline}" fill="white" filter="url(#feather)"/></mask></defs><rect width="${w}" height="${h}" fill="url(#soil)" mask="url(#ground-edge)"/></svg>`;
  await fs.writeFile(path.join(out,'soil-feathered-vector.svg'),svg);
  await sharp(soilLayer).toFile(path.join(out,'soil-feathered-overlay.png'));
  console.log(path.join(out,'terrain-blend-demo.png'));
} else if(command==='check') {
  const names=(await fs.readdir(path.join(master,'generated'))).filter(f=>f.endsWith('.json'));
  const accepted=[];
  for(const f of names){
    const r=JSON.parse(await fs.readFile(path.join(master,'generated',f),'utf8'));if(!r.visuallyAccepted)continue;
    const name=r.id+'.png',file=path.join(master,'generated',name);
    assert.equal(hash(await fs.readFile(file)),hash(await fs.readFile(path.join(out,name))),name+' export mismatch');
    if(r.id.startsWith('decal-')){
      assert(r.hasAlpha,name+' needs alpha');assert(r.transparentFraction>0.15,name+' needs transparent padding');
      const {data,info}=await raw(file);let soft=0,borderMax=0;
      for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
        const alpha=data[(y*info.width+x)*4+3];if(alpha>=8 && alpha<=245)soft++;
        if(x===0 || y===0 || x===info.width-1 || y===info.height-1)borderMax=Math.max(borderMax,alpha);
      }
      r.substantialFeatherFraction=soft/(info.width*info.height);r.outerBorderAlphaMax=borderMax;
      assert(r.substantialFeatherFraction>0.01,name+' needs genuinely soft feather transitions, not just alpha=254');
      assert(borderMax<=5,name+' must fade out before the canvas edges');
    }
    else assert(r.transparentFraction===0,name+' base needs edge-to-edge coverage');
    accepted.push({id:r.id,width:r.width,height:r.height,alpha:r.transparentFraction,feather:r.substantialFeatherFraction,borderAlpha:r.outerBorderAlphaMax,tiling:r.tiling});
  }
  assert.equal(accepted.filter(r=>r.id.startsWith('decal-')).length,10);
  assert.equal(accepted.filter(r=>r.id.endsWith('base')).length,2);
  await fs.writeFile(path.join(out,'validation.json'),JSON.stringify({passed:true,accepted},null,2));
  console.log(JSON.stringify({passed:true,accepted}));
}
