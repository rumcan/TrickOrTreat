import fs from 'node:fs/promises';
import sharp from 'sharp';
import {chromium} from 'playwright-core';
const root='art/town/static',command=process.argv[2];
await fs.mkdir(root+'/guides',{recursive:true});await fs.mkdir(root+'/generated',{recursive:true});
if(command==='prepare'){
 const b=await chromium.launch({channel:'msedge'});
 try{
  const p=await b.newPage();await p.goto(process.env.TOWN_URL||'http://127.0.0.1:5192/');
  const specs=await p.evaluate(async()=>{
   const {STATIC_ART,staticGeometry,staticGuide}=await import('/src/game/art/town-static.ts');
   return STATIC_ART.map(a=>({...staticGeometry(a.id),png:staticGuide(a.id).toDataURL().split(',')[1]}));
  });
  for(const s of specs)await sharp(Buffer.from(s.png,'base64')).resize(1024,1024,{fit:'contain',background:'#00000000'}).png().toFile(root+'/guides/'+s.a.id+'.png');
  await fs.writeFile(root+'/specs.json',JSON.stringify(specs.map(({png,...s})=>s),null,2));
  console.log('Prepared '+specs.length+' exact vector guides.');
 }finally{await b.close();}
}else if(command==='pack'){
 const specs=JSON.parse(await fs.readFile(root+'/specs.json','utf8')),results=[];
 await fs.mkdir('public/assets/town-static',{recursive:true});
 for(const s of specs){
  const source=root+'/generated/'+s.a.id+'.png';
  const meta=await sharp(source).metadata();if(!meta.hasAlpha)throw Error(s.a.id+' has no alpha');
  const input=await sharp(source).resize(1024,1024).ensureAlpha().png().toBuffer();
  const ratio=1024/Math.max(s.w,s.h),width=Math.round(s.w*ratio),height=Math.round(s.h*ratio),left=Math.round((1024-width)/2),top=Math.round((1024-height)/2);
  let packed=await sharp(input).extract({left,top,width,height}).resize(s.w*2,s.h*2).png().toBuffer();
  // Keep guide geometry; only uniformly undo letterboxing. Building ground
  // corner correction is a translation, never a skew or independent scaling.
  let correction=[0,0];
  if(s.a.kind==='building'){
   const raw=await sharp(packed).ensureAlpha().raw().toBuffer(),pw=s.w*2,ph=s.h*2;
   let bottom=-1;for(let y=ph-1;y>=0&&bottom<0;y--)for(let x=0;x<pw;x++)if(raw[(y*pw+x)*4+3]>128){bottom=y;break;}
   if(bottom<0)throw Error('Empty '+s.a.id);
   let sum=0,n=0;for(let y=Math.max(0,bottom-2);y<=bottom;y++)for(let x=0;x<pw;x++)if(raw[(y*pw+x)*4+3]>128){sum+=x;n++;}
   const dx=Math.round((s.ax+(s.a.fw-s.a.fh)*32)*2-sum/n),dy=Math.round((s.ay+(s.a.fw+s.a.fh)*16)*2-bottom);
   if(Math.abs(dx)>70||Math.abs(dy)>70)throw Error('Ground alignment needs regeneration '+s.a.id+' '+[dx,dy]);
   const temp=await sharp({create:{width:pw+160,height:ph+160,channels:4,background:'#00000000'}}).composite([{input:packed,left:80+dx,top:80+dy}]).png().toBuffer();
   packed=await sharp(temp).extract({left:80,top:80,width:pw,height:ph}).png().toBuffer();correction=[dx,dy];
  }
  const file='public/assets/town-static/'+s.a.id+'.png';await sharp(packed).png({compressionLevel:9}).toFile(file);
  results.push({id:s.a.id,file,w:s.w*2,h:s.h*2,anchor:[s.ax*2,s.ay*2],correction,alpha:true});
 }
 await fs.writeFile(root+'/packing.json',JSON.stringify(results,null,2));console.log('Packed '+results.length+' static-town sprites.');
}else throw Error('Use prepare or pack');
