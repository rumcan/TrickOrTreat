import fs from 'node:fs/promises';
import sharp from 'sharp';
import {chromium} from 'playwright-core';
const root='art/nightmare',cmd=process.argv[2];await fs.mkdir(root,{recursive:true});
// Generators may vary row spacing. Find transparent gutters, then use ONE uniform
// scale per character's four poses (never stretch every opaque box independently).
function rowCuts(data,width,height,rows){
 const gaps=[];let start=-1;
 for(let y=0;y<height;y++){
  let n=0;for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>64)n++;
  if(n<8&&start<0)start=y;
  // A narrow but genuinely transparent gutter is sufficient: Blackdome's comb
  // guards leave three clear pixels below the troopers, rather than ten.
  if(n>=8&&start>=0){if(y-start>=2&&start>height*.12&&y<height*.93)gaps.push({y:Math.round((start+y)/2),length:y-start});start=-1;}
 }
 const selected=gaps.sort((a,b)=>b.length-a.length).slice(0,rows-1).sort((a,b)=>a.y-b.y);
 if(selected.length!==rows-1)throw Error('No clean sprite-row gutters; inspect/regenerate this atlas rather than clipping it');
 return [0,...selected.map(g=>g.y),height];
}
function contentRect(data,width,x0,y0,x1,y1){
 let left=x1,top=y1,right=x0,bottom=y0,count=0;
 for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(data[(y*width+x)*4+3]>64){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);count++;}
 if(count<300)throw Error('Empty animation pose');
 return {left,top,width:right-left+1,height:bottom-top+1};
}
if(cmd==='export'){
 const browser=await chromium.launch({channel:'msedge'});let families,records;
 try{
  const page=await browser.newPage();await page.goto(process.env.TOT_ARCADE_URL||'http://127.0.0.1:5190/');
  ({families,records}=await page.evaluate(async()=>{
   const {NEW_BOSS_FAMILIES,FINAL_MONSTER}=await import('/src/game/boss-roster.ts');
   const {nightmareSheet,NIGHTMARE_MONSTERS}=await import('/src/game/art/nightmare-monsters.ts');
   const {allAssets}=await import('/src/game/assets.ts'),{withArtScale}=await import('/src/game/art/draw.ts');
   NIGHTMARE_MONSTERS.forEach(m=>nightmareSheet(m.id));
   return {families:[...NEW_BOSS_FAMILIES.map(f=>({id:f.id,members:[f.id,f.id+'_a',f.id+'_b'],looks:[f.look,...f.minions.map(m=>m.look)]})),{id:FINAL_MONSTER.id,members:[FINAL_MONSTER.id],looks:[FINAL_MONSTER.look]}],records:allAssets().filter(a=>NIGHTMARE_MONSTERS.some(m=>a.spec.key==='enemy_'+m.id)).map(a=>({spec:a.spec,png:withArtScale(2,()=>a.gen()).toDataURL().split(',')[1]}))};
  }));
 }finally{await browser.close();}
 await fs.mkdir(root+'/guides',{recursive:true});await fs.mkdir(root+'/generated',{recursive:true});
 for(const family of families){
  const pieces=[];family.sprites=[];
  for(const [row,id]of family.members.entries()){
   const r=records.find(r=>r.spec.key==='enemy_'+id),s=r.spec,source=Buffer.from(r.png,'base64');
   const cell=family.members.length===1?768:384,ch=family.members.length===1?768:512;
   const k=Math.min((cell-44)/s.frameW,(ch-100)/s.frameH),width=Math.round(s.frameW*k),height=Math.round(s.frameH*k);
   const left=Math.round(cell/2-s.anchor[0]*k),top=Math.round(ch-62-s.anchor[1]*k);
   family.sprites.push({id,fw:s.frameW,fh:s.frameH,anchor:s.anchor,cell,ch,left,top,width,height,row});
   for(let f=0;f<4;f++){
    const x=family.members.length===1?(f%2)*cell:f*cell,y=family.members.length===1?Math.floor(f/2)*ch:row*ch;
    pieces.push({input:await sharp(source).extract({left:f*s.frameW*2,top:0,width:s.frameW*2,height:s.frameH*2}).resize(width,height).png().toBuffer(),left:x+left,top:y+top});
   }
  }
  await sharp({create:{width:1536,height:1536,channels:4,background:'#00000000'}}).composite(pieces).png().toFile(root+'/guides/'+family.id+'.png');
 }
 await fs.writeFile(root+'/specs.json',JSON.stringify(families,null,2)+'\n');
 const manifest=JSON.parse(await fs.readFile('public/assets/manifest.json','utf8')),style=[];
 for(const [i,key]of ['enemy_hex','enemy_alpha','enemy_king','enemy_zombie'].entries()){
  const p='public/assets/'+manifest.overrides[key].file,meta=await sharp(p).metadata(),cols=6;
  const frame=await sharp(p).extract({left:0,top:0,width:Math.floor(meta.width/cols),height:meta.height}).resize(384,384,{fit:'contain',background:'#00000000'}).png().toBuffer();style.push({input:frame,left:(i%2)*384,top:Math.floor(i/2)*384});
 }
 await sharp({create:{width:768,height:768,channels:4,background:'#00000000'}}).composite(style).png().toFile(root+'/style-reference.png');
 console.log(`Exported ${families.length} anchored animation guides for ${records.length} original monsters.`);
}else if(cmd==='pack'){
 const specs=JSON.parse(await fs.readFile(root+'/specs.json','utf8')),manifest=JSON.parse(await fs.readFile('public/assets/manifest.json','utf8')),report=[];
 await fs.mkdir('public/assets/monsters/nightmare',{recursive:true});
 for(const family of specs.filter(f=>!process.argv[3]||process.argv[3].split(',').includes(f.id))){
  const path=root+'/generated/'+family.id+'.png';await fs.access(path);const metadata=await sharp(path).metadata();if(!metadata.hasAlpha)throw Error(family.id+': missing transparent alpha');
  const source=await sharp(path).resize(1536,1536).png().toBuffer();
  const raw=await sharp(source).ensureAlpha().raw().toBuffer(),solo=family.members.length===1;
  const cuts=rowCuts(raw,1536,1536,solo?2:3);
  for(const s of family.sprites){
   const scale=solo?1:2,pieces=[],rects=[];
   for(let f=0;f<4;f++){
    const row=solo?Math.floor(f/2):s.row,col=solo?f%2:f,cell=solo?768:384;
    rects.push(contentRect(raw,1536,col*cell,cuts[row],(col+1)*cell,cuts[row+1]));
   }
   const k=Math.min((s.fw-12)*scale/Math.max(...rects.map(r=>r.width)),(s.anchor[1]-8)*scale/Math.max(...rects.map(r=>r.height)));
   for(let f=0;f<4;f++){
    const r=rects[f],w=Math.max(1,Math.round(r.width*k)),h=Math.max(1,Math.round(r.height*k));
    const frame=await sharp(source).extract(r).resize(w,h).png().toBuffer();
    pieces.push({input:frame,left:f*s.fw*scale+Math.round(s.anchor[0]*scale-w/2),top:Math.round(s.anchor[1]*scale-h)});
   }
   const file='monsters/nightmare/enemy_'+s.id+'.png';await sharp({create:{width:s.fw*scale*4,height:s.fh*scale,channels:4,background:'#00000000'}}).composite(pieces).png({compressionLevel:9}).toFile('public/assets/'+file);
   manifest.overrides['enemy_'+s.id]={file,scale,frames:4,anchor:s.anchor.map(a=>a*scale)};report.push({id:s.id,frames:4,width:s.fw*scale*4,height:s.fh*scale,scale,cuts,uniformScale:k});
  }
 }
 await fs.writeFile('public/assets/manifest.json',JSON.stringify(manifest,null,2)+'\n');await fs.writeFile(root+'/report.json',JSON.stringify(report,null,2)+'\n');console.log(`Packed ${report.length} alpha PNG animation sheets with uniform per-character scale and stable ground anchors.`);
}else throw Error('Use export or pack');
