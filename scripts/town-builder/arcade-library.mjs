/** Reuse the corrected, packed arcade art without changing its projection or ground contacts. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {ROOT} from '../lib/town-scene.mjs';

export const arcadeCategory=s=>s.category==='overlay'?'Arcade floor decals':s.key.includes('_clutter_')?'Arcade decor':'Arcade furniture';
const names={cabinet:'Arcade cabinet — Star Raid',cabinet_retro:'Arcade cabinet — retro',cabinet_racer:'Arcade cabinet — racer',cabinet_back:'Arcade cabinet — back',cabinet_back_alt:'Arcade cabinet — alternate back',pinball:'Pinball machine',pinball_back:'Pinball machine — back',skeeball:'Skee-ball lanes',airhockey:'Air hockey',foosball:'Foosball table',prizes:'Prize counter',pizza:'Pizza concession counter',booth:'Restaurant booth',stage:'Animatronic stage',photo:'Photo booth',tokens:'Token machine',party:'Birthday party table',exit_mat:'Exit floor mat',bigfoot:'Bigfoot costume display',robot:'Robot memorabilia display',poster:'Movie poster display',jukebox:'Jukebox',gumball:'Gumball machine',vhs:'VHS display',plant:'Arcade planter',popcorn:'Spilled popcorn',soda:'Spilled soda',pizza_box:'Discarded pizza box',tickets:'Scattered tickets',snack_pile:'Snack litter pile',party_pile:'Party litter pile',paper_pile:'Paper litter pile',arcade_junk:'Arcade junk pile'};

export async function arcadeSources(worktree=ROOT){
 const specs=JSON.parse(await fs.readFile(path.join(worktree,'art/arcade/v2/specs.json'),'utf8'));
 const manifest=JSON.parse(await fs.readFile(path.join(worktree,'public/assets/manifest.json'),'utf8'));
 const result=[];
 for(const s of specs){
  // The carpet is an overhead material, not a projected placeable sprite. The chair was rejected by the owner.
  if(s.category==='tile'||s.key==='arcade_v2_clutter_chair')continue;
  assert.ok(s.key.startsWith('arcade_v2_'),'Only corrected arcade sprites may be imported');
  const override=manifest.overrides[s.key];
  assert.ok(override&&typeof override==='object'&&override.file,`Missing packed arcade override: ${s.key}`);
  const file=path.resolve(worktree,'public/assets',override.file);
  assert.ok(!path.relative(path.join(worktree,'public/assets'),file).startsWith('..'),'Asset must stay under public/assets');
  const meta=await sharp(file).metadata(),scale=override.scale??1;
  assert.ok(meta.hasAlpha&&scale>0,`Invalid transparent arcade sprite: ${s.key}`);
  assert.ok(Math.abs(meta.width/scale-s.w)<.01&&Math.abs(meta.height/scale-s.h)<.01,`Packed frame size differs from game spec: ${s.key}`);
  const [ax,ay]=override.anchor?override.anchor.map(v=>v/scale):(s.anchor??[s.w/2,s.h/2]);
  assert.ok([ax,ay,s.w,s.h].every(Number.isFinite),'Finite frame and anchor required');
  const kind=s.key.replace(/^arcade_v2_(clutter_)?/,'').replace(/_\d.*$/,'');
  const name=kind==='wall'?`Arcade wall — ${s.footprint.join(' × ')}`:names[kind]??s.desc;
  result.push({id:'arcade:'+s.key,name,category:arcadeCategory(s),input:file,sourceScale:scale,w:s.w,h:s.h,ax,ay,fw:s.footprint?.[0]??1,fh:s.footprint?.[1]??1,flat:s.category==='overlay',tags:['arcade','1980s','1990s','2:1',kind]});
 }
 assert.equal(new Set(result.map(s=>s.id)).size,result.length,'Unique arcade IDs required');
 return result;
}

export async function packArcadeSprites({libDir=path.join(ROOT,'output/town-builder/library'),worktree=ROOT,root=ROOT}={}){
 await fs.mkdir(path.join(libDir,'sprites'),{recursive:true});await fs.mkdir(path.join(libDir,'thumbs'),{recursive:true});
 const items=[];
 for(const s of await arcadeSources(worktree)){
  const safe=s.id.replace(/[^a-z0-9_-]+/gi,'_'),sprite='sprites/'+safe+'.webp',thumb='thumbs/'+safe+'.webp';
  // Preserve the whole in-game frame. At the existing 2x scale, copy the original WebP byte for byte.
  if(s.sourceScale===2&&s.input.endsWith('.webp'))await fs.copyFile(s.input,path.join(libDir,sprite));
  else await sharp(s.input).resize(Math.round(s.w*2),Math.round(s.h*2),{kernel:'lanczos3'}).webp({quality:94,alphaQuality:100}).toFile(path.join(libDir,sprite));
  await sharp(s.input).resize(112,112,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).webp({quality:88,alphaQuality:100}).toFile(path.join(libDir,thumb));
  const {input,sourceScale,...item}=s;
  items.push({...item,file:sprite,thumb,source:path.relative(root,input).replace(/\\/g,'/')});
 }
 return items;
}

// Incremental registration leaves all unrelated sprites and the saved map untouched.
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const libDir=path.join(ROOT,'output/town-builder/library'),target=path.join(libDir,'library.json');
 const original=await fs.readFile(target,'utf8'),lib=JSON.parse(original),added=await packArcadeSprites({libDir});
 const byId=new Map(lib.items.map(i=>[i.id,i]));for(const i of added)byId.set(i.id,i);
 lib.items=[...byId.values()];lib.categories=[...new Set(lib.items.map(i=>i.category))];
 const backup=path.join(libDir,'backups','library-before-arcade-'+Date.now()+'.json');await fs.mkdir(path.dirname(backup),{recursive:true});await fs.writeFile(backup,original);
 const pending=target+'.arcade-pending';await fs.writeFile(pending,JSON.stringify(lib,null,1));await fs.rename(pending,target);
 console.log(JSON.stringify({registered:added.length,total:lib.items.length,categories:[...new Set(added.map(i=>i.category))],backup}));
}
