import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {artDir} from '../lib/town-scene.mjs';
import {expansion} from './expansion-specs.mjs';
const dir=path.join(artDir('expansion-1988'));await fs.mkdir(path.join(dir,'guides'),{recursive:true});await fs.mkdir(path.join(dir,'prompts'),{recursive:true});await fs.mkdir(path.join(dir,'native'),{recursive:true});
for(const a of expansion){
 const W=1536,H=1536,ppm=Math.min(1200/(a.w+a.d),1150/((a.w+a.d)/2+a.h*Math.sqrt(1.5))),zpm=ppm*Math.sqrt(1.5);
 const cx=W/2,cy=(H+a.h*zpm)/2;
 const P=(x,y,z=0)=>[cx+(x-y)*ppm,cy+(x+y)*ppm/2-z*zpm],pts=p=>p.map(x=>x.join(',')).join(' ');
 const g=[P(-a.w/2,-a.d/2),P(a.w/2,-a.d/2),P(a.w/2,a.d/2),P(-a.w/2,a.d/2)],t=[P(-a.w/2,-a.d/2,a.h),P(a.w/2,-a.d/2,a.h),P(a.w/2,a.d/2,a.h),P(-a.w/2,a.d/2,a.h)];
 let body=`<polygon points="${pts(g)}" fill="#4c645d" stroke="#8ae0bc" stroke-width="3"/>`;
 if(!a.flat)body+=`<polygon points="${pts([g[1],g[2],t[2],t[1]])}" fill="#586b79" stroke="#a3bfd0" stroke-width="3"/><polygon points="${pts([g[2],g[3],t[3],t[2]])}" fill="#687f90" stroke="#a3bfd0" stroke-width="3"/><polygon points="${pts(t)}" fill="#899eaa" stroke="#a3bfd0" stroke-width="3"/>`;
 if(a.id.startsWith('picket-')||a.id.startsWith('chainlink-')||a.id.startsWith('fence-')||a.id.startsWith('gate-')){
  const alongX=a.w>a.d,L=alongX?a.w:a.d;
  const Q=(u,z)=>alongX?P(u,0,z):P(0,u,z),line=(u,z,v,Z,width=5)=>`<line x1="${Q(u,z)[0]}" y1="${Q(u,z)[1]}" x2="${Q(v,Z)[0]}" y2="${Q(v,Z)[1]}" stroke="#b6c9d6" stroke-width="${width}"/>`;
  body=line(-L/2,0,L/2,0,2)+line(-L/2,.2*a.h,L/2,.2*a.h,13)+line(-L/2,.8*a.h,L/2,.8*a.h,13);
  if(a.id.startsWith('fence-privacy-'))body='<polygon points="'+pts([Q(-L/2,.05),Q(L/2,.05),Q(L/2,a.h*.95),Q(-L/2,a.h*.95)])+'" fill="#899eaa"/>'+body;
  const n=a.id.startsWith('picket-')?11:2;
  for(let i=0;i<n;i++)body+=line(-L/2+i*L/(n-1),0,-L/2+i*L/(n-1),a.h,i===0||i===n-1?25:19);
 }
 await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#202931"/>${body}<circle cx="${cx}" cy="${cy}" r="5" fill="#ffb65d"/></svg>`)).png().toFile(path.join(dir,'guides',a.id+'.png'));
 const prompt=`Use case: stylized-concept\nAsset type: one production PNG town-builder sprite, not a sprite sheet.\nInput images: image 1 is the exact 2:1 projection and massing guide; image 2 is an existing cottage sprite for camera/material consistency; image 3 is the original Halloween game style reference. Guide is NOT final artwork.\nPrimary request: ${a.subject}\nPerspective: orthographic 2:1 dimetric. World axes slope +0.5 and -0.5 (26.565 degrees); vertical posts and walls remain vertical; heading 45 degrees, downward pitch 30 degrees, no perspective vanishing point, no roll. Match guide ground edges and existing game sprite camera, do not invent a different camera height.\nStyle: finely painted textured game artwork, 1980s American small town at Halloween early evening; subdued navy shadows, warm amber highlights; no cartoony thick outlines, no photorealistic studio product render. ${a.flat?'Paint the individual material fragments directly on the ground plane, no raised depth or drop shadow.':'Dark contact occlusion at the feet only; no long cast shadow, no terrain patch.'}\nComposition: exactly ONE isolated asset; all of it visible with 8% transparent padding; very high detail, use most of the canvas. ${a.flat?'Preserve the elongated ground-plane footprint, no compression into a square.':''}\nBackground: genuinely transparent alpha including fine gaps. No labels, guides, grid, frame, checkerboard baked pixels, watermark, grass, roads, surrounding scenery, people or modern post-1990 objects. Keep building art alone at full resolution; do not add small prop sheets alongside it.`;
 await fs.writeFile(path.join(dir,'prompts',a.id+'.txt'),prompt);
}
// Keep recorded progress when refining a guide; never reset already registered assets.
let previous={assets:[]};try{previous=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify({projection:'2:1 orthographic; +/-26.565 ground axes',assets:expansion.map(a=>({...previous.assets.find(p=>p.id===a.id),...a,status:previous.assets.find(p=>p.id===a.id)?.status||'planned'}))},null,2));
console.log(JSON.stringify({planned:expansion.length,dir}));
