/**
 * Slice finished variation sheets into Town Builder sprites.
 *
 *   node scripts/town-variations/slice.mjs [--out <campaign>] [--only <job key,...>] [--dry-run]
 *
 * For every generated production sheet that has not been sliced yet:
 *  1. cut each cell, trim it to its alpha bounds and keep the trimmed cell in art/town-variations/ (tracked);
 *  2. register it in output/town-builder/library/library.json, next to the sprite it varies;
 *  3. move the whole sheet (and its sidecar) to <campaign>/sliced/<provider>/ (gitignored, kept for provenance).
 * The owner's layout.json is never touched; the library is backed up before it is rewritten.
 */
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {ROOT,DEFAULT_OUT,readJson,writeJson} from './plan.mjs';
import {options} from './runner.mjs';

const LIBRARY = path.join(ROOT,'output/town-builder/library');
const ART_DIR = path.join(ROOT,'art/town-variations');
const VEHICLE_VIEWS = ['side view','front view','rear view','corner view'];

// Alpha bounds inside one cell of the sheet; null when the cell is empty.
async function trimmedCell(file,cell) {
  const {data,info}=await sharp(file).extract(cell).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let x0=info.width,y0=info.height,x1=-1,y1=-1;
  for(let y=0;y<info.height;y++) for(let x=0;x<info.width;x++)
    if(data[(y*info.width+x)*4+3]>24) {x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
  if(x1<x0) return null;
  const left=Math.max(0,x0-3),top=Math.max(0,y0-3);
  return {left:cell.left+left,top:cell.top+top,width:Math.min(info.width,x1+4)-left,height:Math.min(info.height,y1+4)-top,
    clipped:x0<2||y0<2||x1>info.width-3||y1>info.height-3};
}

function cellsOf(sidecar,width,height,count) {
  if(sidecar?.cells?.length) return sidecar.cells.map(c=>({left:Math.round(c.left),top:Math.round(c.top),width:Math.round(c.width),height:Math.round(c.height)}));
  if(count===1) return [{left:0,top:0,width,height}];
  return [0,1,2,3].map(i=>({left:i%2*width/2,top:Math.floor(i/2)*height/2,width:width/2,height:height/2}));
}

export async function sliceCampaign({out=DEFAULT_OUT,only,dryRun=false,library:LIB=LIBRARY,art:ART=ART_DIR}={}) {
  const manifest=await readJson(path.join(out,'manifest.json'));
  const libraryFile=path.join(LIB,'library.json'),library=await readJson(libraryFile);
  const done=[];
  for(const provider of ['run','codex']) {
    const states=path.join(out,'states',provider);
    if(!existsSync(states)) continue;
    for(const name of (await fs.readdir(states)).filter(n=>n.endsWith('.json'))) {
      const state=await readJson(path.join(states,name));
      if(state.status!=='generated'||state.phase!=='production'||state.sliced) continue;
      if(only&&!only.split(',').includes(state.key)) continue;
      const asset=manifest.assets.find(a=>a.id===state.assetId);
      const sheet=path.join(out,'sheets',provider,state.key+'.png');
      if(!asset||!existsSync(sheet)) {console.warn(`skip ${state.key}: ${asset?'sheet missing':'unknown asset'}`);continue;}
      const sidecarFile=sheet.replace(/\.png$/,'.json');
      const sidecar=existsSync(sidecarFile)?await readJson(sidecarFile):null;
      const meta=await sharp(sheet).metadata();
      const original=library.items.find(i=>i.id===asset.id);
      const flat=original?.flat ?? asset.kind==='decal';
      const cells=[];
      for(const cell of cellsOf(sidecar,meta.width,meta.height,asset.slots.length)) cells.push(await trimmedCell(sheet,cell));
      const widest=Math.max(...cells.filter(Boolean).map(c=>c.width));
      // One scale per sheet keeps the size differences the prompt asked for. The widest cell matches the
      // original sprite's library width (or the footprint's projected width for brand-new subjects).
      const targetWidth=original?.w ?? (asset.fw+asset.fh)*64;
      const scale=targetWidth/widest;
      const folder=path.join(ART,asset.id.replace(/[^a-z0-9_-]+/gi,'-'));
      const items=[];
      for(const [i,c] of cells.entries()) {
        if(!c) {console.warn(`${state.key}: cell ${i+1} is empty, skipped`);continue;}
        const id=`variation:${state.key}:${i+1}`,safe=`variation_${state.key}_${i+1}`;
        const w=c.width*scale,h=c.height*scale,k=c.width/widest;
        const label=asset.kind==='vehicle'?VEHICLE_VIEWS[i]:`variation ${i+1}`;
        const item={id,name:`${asset.name} — ${label}`,category:asset.category,file:`sprites/${safe}.webp`,thumb:`thumbs/${safe}.webp`,
          w,h,ax:w/2,ay:flat?h/2:h-w/4,
          fw:Math.max(.25,Math.round((original?.fw ?? asset.fw)*k*4)/4),fh:Math.max(.25,Math.round((original?.fh ?? asset.fh)*k*4)/4),flat,
          source:path.relative(ROOT,path.join(folder,`${state.key}-${i+1}.webp`)).replace(/\\/g,'/'),
          tags:['variation',`variation-of:${asset.id}`,provider,...(c.clipped?['touches-cell-edge']:[]),asset.description||asset.name]};
        items.push({item,crop:c});
      }
      done.push({key:state.key,provider,asset:asset.id,cells:items.length,clipped:items.filter(x=>x.crop.clipped).length});
      if(dryRun) continue;
      await fs.mkdir(folder,{recursive:true});
      for(const {item,crop} of items) {
        const cut=sharp(sheet).extract(crop);
        await cut.clone().webp({lossless:true}).toFile(path.join(ROOT,item.source));
        await cut.clone().resize(Math.round(item.w*2),Math.round(item.h*2),{kernel:'lanczos3'}).webp({quality:94,alphaQuality:100}).toFile(path.join(LIB,item.file));
        await cut.clone().resize(112,112,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).webp({quality:88,alphaQuality:100}).toFile(path.join(LIB,item.thumb));
        library.items=library.items.filter(i=>i.id!==item.id);
        // Sit next to the sprite it varies, so the palette groups them.
        const at=library.items.findLastIndex(i=>i.id===asset.id||i.tags?.includes(`variation-of:${asset.id}`));
        library.items.splice(at<0?library.items.length:at+1,0,item);
      }
      const archive=path.join(out,'sliced',provider);
      await fs.mkdir(archive,{recursive:true});
      await fs.rename(sheet,path.join(archive,path.basename(sheet)));
      if(sidecar) await fs.rename(sidecarFile,path.join(archive,path.basename(sidecarFile)));
      await writeJson(path.join(states,name),{...state,file:path.join(archive,path.basename(sheet)),
        sliced:{at:new Date().toISOString(),items:items.map(x=>x.item.id)}});
    }
  }
  if(!dryRun&&done.length) {
    await fs.mkdir(path.join(LIB,'backups'),{recursive:true});
    await fs.copyFile(libraryFile,path.join(LIB,'backups',`library-before-variations-${Date.now()}.json`));
    library.categories=[...new Set(library.items.map(i=>i.category))];
    await writeJson(libraryFile,library);
  }
  return done;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const opts=options(['slice',...process.argv.slice(2)]);
  const done=await sliceCampaign({out:opts.out?path.resolve(opts.out):DEFAULT_OUT,only:opts.only,dryRun:!!opts['dry-run']});
  console.log(JSON.stringify({sliced:done,total:done.reduce((n,d)=>n+d.cells,0)},null,1));
}
