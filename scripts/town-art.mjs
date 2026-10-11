import fs from 'node:fs/promises';
import sharp from 'sharp';
import {chromium} from 'playwright-core';
const root='art/town',command=process.argv[2];
const selected=JSON.parse(await fs.readFile(root+'/source-selection.json','utf8').catch(()=>'{}'));
const sourceFor=id=>root+'/generated/'+(selected[id]||id+'.png');
await fs.mkdir(root+'/guides',{recursive:true});await fs.mkdir(root+'/generated',{recursive:true});await fs.mkdir(root+'/checks',{recursive:true});
if(command==='prepare'){
 if(await fs.access(root+'/baseline.json').then(()=>true,()=>false))throw Error('Baseline already exists. Preserve the pre-redesign snapshot; use the layout review test for current-map exports.');
 const browser=await chromium.launch({channel:'msedge'});
 try{
  const page=await browser.newPage();await page.goto('http://127.0.0.1:5192/');
  await page.getByRole('button',{name:'Go trick-or-treating'}).waitFor({timeout:120000});
  const result=await page.evaluate(async()=>{
   const {TOWN_ASSETS}=await import('/src/game/town-assets.ts');
   const {townGeometry,drawTownGuide}=await import('/src/game/art/town.ts');
   const {withArtScale}=await import('/src/game/art/draw.ts');
   const {TOWN_SITES,TOWN_CORRIDORS}=await import('/src/game/town-plan.ts');
   const {allAssets}=await import('/src/game/assets.ts');
   const {buildMap}=await import('/src/game/map.ts');
   const layouts=[false,true].map(expanded=>{const m=buildMap(1337,expanded);return {expanded,start:m.start,gates:m.gates.map(g=>({x:g.x,y:g.y,name:g.name,opens:g.openAt})),hideouts:m.hideouts,roads:Array.from(m.ground).reduce((a,g,i)=>{if(g===1)a.push([i%94,Math.floor(i/94)]);return a;},[]),props:m.props.map(p=>({kind:p.kind,x:p.x0,y:p.y0,w:p.fw,h:p.fh})),doors:m.houses.map(h=>({owner:h.owner,x:h.door.x,y:h.door.y,kind:h.prop.kind})),shops:m.shops.map(s=>({x:s.x,y:s.y})),ground:Array.from(m.ground)};});
   return {layouts,sites:TOWN_SITES,corridors:TOWN_CORRIDORS,inventory:allAssets().filter(a=>['prop','tile','overlay'].includes(a.spec.category)).map(a=>({key:a.spec.key,file:a.file||a.spec.file,footprint:a.spec.footprint,desc:a.spec.desc})),specs:TOWN_ASSETS.map(a=>{const g=townGeometry(a.id);return {...a,...g,a:undefined,png:withArtScale(2,()=>drawTownGuide(a.id)).toDataURL().split(',')[1]};})};
  });
  await fs.writeFile(root+'/baseline.json',JSON.stringify({layouts:result.layouts,inventory:result.inventory},null,2)+'\n');
  const specs=[];
  for(const s of result.specs){const {png,...spec}=s;await sharp(Buffer.from(png,'base64')).resize(1024,1024,{fit:'contain',background:'#00000000'}).png().toFile(root+'/guides/'+s.id+'.png');specs.push(spec);}
  await fs.writeFile(root+'/specs.json',JSON.stringify(specs,null,2)+'\n');
  const areas=[['Farm / rural fringe',3,3,18,18],['School / civic',24,3,21,18],['Primary / playground',49,3,41,18],['Historic cemetery',3,24,18,21],['Maple neighbourhood',24,24,21,21],['Starcade / residences',49,24,41,21],['Willow / church',3,49,18,41],['Main St / downtown',24,49,45,20],['Moonlight Court',72,49,18,20],['Lantern / video',24,73,21,17],['Drive-in / fringe',49,73,41,17]];
  const blocks=areas.map(([name,x,y,w,h],i)=>'<g><rect x="'+x*10+'" y="'+(y*10+40)+'" width="'+w*10+'" height="'+h*10+'" fill="'+['#354c41','#3d4c65','#4d4e42'][i%3]+'"/><text x="'+(x*10+8)+'" y="'+(y*10+58)+'" fill="#e8dfcb" font-size="13">'+name+'</text></g>').join('');
  const streets=[22,46,70].map(v=>'<rect x="'+v*10+'" y="70" width="20" height="870" fill="#78818b"/><rect x="30" y="'+(v*10+40)+'" width="870" height="20" fill="#78818b"/>').join('');
  const lanes=result.corridors.map(c=>'<rect x="'+c.x*10+'" y="'+(c.y*10+40)+'" width="'+c.w*10+'" height="'+c.h*10+'" fill="'+(c.type==='service'?'#bf985f':'#b6ac8e')+'" opacity=".7"/>').join('');
  const sites=result.sites.map(p=>{const s=specs.find(s=>s.id===p.asset);return '<g><rect x="'+p.x*10+'" y="'+(p.y*10+40)+'" width="'+s.fw*10+'" height="'+s.fh*10+'" fill="#e58446" stroke="#ffe9b1"/><text x="'+(p.x*10+3)+'" y="'+(p.y*10+51)+'" fill="#fff" font-size="9">'+p.asset+'</text></g>';}).join('');
  const plan='<svg xmlns="http://www.w3.org/2000/svg" width="940" height="1010"><rect width="940" height="1010" fill="#152329"/><text x="16" y="28" fill="#ffbf75" font-size="22">Maple Falls — master plan (not implemented)</text>'+blocks+streets+lanes+sites+'<text x="16" y="982" fill="white" font-size="14">Orange: new venues · tan: reserved paths · ochre: service alleys · grey: through roads</text><text x="16" y="1002" fill="#d3d8de" font-size="13">Preserve district gates. Relocate conflicting old scenery before assembly. Coordinates = tiles × 10.</text></svg>';
  await fs.writeFile(root+'/master-plan.svg',plan);await sharp(Buffer.from(plan)).png().toFile(root+'/checks/master-plan.png');
  for(const m of result.layouts){
   const colors=['#294636','#303747','#8d9291','#705e43','#675f51','#192e2c','#596270','#665d4f','#3f6042'];
   const cells=m.ground.map((g,i)=>'<rect x="'+(i%94*10)+'" y="'+(Math.floor(i/94)*10)+'" width="10" height="10" fill="'+colors[g]+'"/>').join('');
   const props=m.props.map(p=>'<rect x="'+p.x*10+'" y="'+p.y*10+'" width="'+Math.max(3,p.w*10)+'" height="'+Math.max(3,p.h*10)+'" fill="'+(p.kind==='house'?'#c0aa86':p.w>2?'#cc8556':'#385b48')+'" stroke="#101722" stroke-width="1"/>').join('');
   const doors=m.doors.map(d=>'<circle cx="'+d.x*10+'" cy="'+d.y*10+'" r="3" fill="#ffe4a1"/>').join('');
   const svg='<svg xmlns="http://www.w3.org/2000/svg" width="940" height="980"><rect width="940" height="980" fill="#101722"/><g transform="translate(0 40)">'+cells+props+doors+'</g><text x="12" y="28" fill="white" font-size="22">Current Maple Falls — '+(m.expanded?'full':'free')+' town</text></svg>';
   await fs.writeFile(root+'/baseline-'+(m.expanded?'full':'free')+'.svg',svg);await sharp(Buffer.from(svg)).png().toFile(root+'/checks/baseline-'+(m.expanded?'full':'free')+'.png');
  }
  console.log('Baseline exported for both towns: '+result.inventory.length+' reusable world assets; '+specs.length+' exact isometric guides.');
 }finally{await browser.close();}
}else if(command==='pack'){
 const specs=JSON.parse(await fs.readFile(root+'/specs.json','utf8')),report=[];
 await fs.mkdir('public/assets/town',{recursive:true});
 for(const s of specs.filter(s=>!process.argv[3]||process.argv[3].split(',').includes(s.id))){
  const path=sourceFor(s.id);
  if(!await fs.access(path).then(()=>true,()=>false)){console.log(s.id+': still queued');continue;}
  const meta=await sharp(path).metadata();if(!meta.hasAlpha)throw Error(s.id+': no transparent alpha');
  const source=await sharp(path).resize(1024,1024).ensureAlpha().png().toBuffer();
  const k=1024/Math.max(s.w,s.h),width=Math.round(s.w*k),height=Math.round(s.h*k),left=Math.round((1024-width)/2),top=Math.round((1024-height)/2);
  const raw=await sharp(source).ensureAlpha().raw().toBuffer();let count=0,outside=0,bg=0;
  for(let y=0;y<1024;y++)for(let x=0;x<1024;x++)if(raw[(y*1024+x)*4+3]>64){
   count++;if(x<left||x>=left+width||y<top||y>=top+height)outside++;
   if(x<3||x>1020||y<3||y>1020)bg++;
  }
  if(count<400)throw Error(s.id+': empty art');
  if(outside/count>.001||bg>16){report.push({id:s.id,status:'needs-framing-review',outside:outside/count,borderPixels:bg});console.log(s.id+': framing review required');continue;}
  const file='town/'+s.id+'-v1.png';
  // Undo the guide's letterboxing with one uniform transform; never squeeze a building to fit.
  let packed=await sharp(source).extract({left,top,width,height}).resize(s.w*2,s.h*2).ensureAlpha().png().toBuffer();
  let groundCorrection=[0,0];
  if(s.kind==='building'){
   // A rectangular building's lowest opaque ground point is its front footprint
   // corner. Align that measured point, not the roof or a guessed sprite centre.
   const d=await sharp(packed).raw().toBuffer(),pw=s.w*2,ph=s.h*2;
   let bottom=-1;
   for(let y=ph-1;y>=0&&bottom<0;y--)for(let x=0;x<pw;x++)if(d[(y*pw+x)*4+3]>64){bottom=y;break;}
   let sum=0,n=0;for(let y=bottom-1;y<=bottom;y++)for(let x=0;x<pw;x++)if(d[(y*pw+x)*4+3]>64){sum+=x;n++;}
   const px=sum/n,dx=Math.round((s.ax+(s.fw-s.fh)*32)*2-px),dy=Math.round((s.ay+(s.fw+s.fh)*16)*2-bottom);
   if(Math.abs(dx)>48||Math.abs(dy)>48){report.push({id:s.id,status:'needs-ground-review',correction:[dx,dy]});console.log(s.id+': ground pivot review required');continue;}
   const temp=await sharp({create:{width:pw+128,height:ph+128,channels:4,background:'#00000000'}}).composite([{input:packed,left:64+dx,top:64+dy}]).png().toBuffer();
   packed=await sharp(temp).extract({left:64,top:64,width:pw,height:ph}).png().toBuffer();groundCorrection=[dx,dy];
  }
  await sharp(packed).png({compressionLevel:9}).toFile('public/assets/'+file);
  const label=Buffer.from('<svg width="600" height="28"><text x="8" y="20" fill="white" font-family="sans-serif" font-size="17">'+s.id+' — vector guide / painted sprite</text></svg>');
  const guide=await sharp(root+'/guides/'+s.id+'.png').resize(300,300).flatten({background:'#17212c'}).png().toBuffer();
  const paint=await sharp(source).resize(300,300).flatten({background:'#17212c'}).png().toBuffer();
  await sharp({create:{width:600,height:330,channels:3,background:'#17212c'}}).composite([{input:guide,left:0,top:30},{input:paint,left:300,top:30},{input:label,left:0,top:0}]).png().toFile(root+'/checks/'+s.id+'.png');
  report.push({id:s.id,status:'packed',file,scale:2,anchor:[s.ax*2,s.ay*2],w:s.w*2,h:s.h*2,groundCorrection,outside:outside/count,sourceWidth:meta.width,sourceHeight:meta.height});
 }
 const old=JSON.parse(await fs.readFile(root+'/packing-report.json','utf8').catch(()=> '[]'));
 const merged=[...old.filter(r=>!report.some(n=>n.id===r.id)),...report];
 await fs.writeFile(root+'/packing-report.json',JSON.stringify(merged,null,2)+'\n');
 console.log(report.filter(r=>r.status==='packed').length+' assets packed; '+report.filter(r=>r.status!=='packed').length+' need visual/framing review. No runtime overrides activated.');
}else if(command==='contact'){
 const specs=JSON.parse(await fs.readFile(root+'/specs.json','utf8'));
 for(const [name,list,cols]of [['buildings',specs.filter(s=>s.kind==='building'),3],['furniture',specs.filter(s=>s.kind==='prop'||s.kind==='foliage'),4],['decals',specs.filter(s=>s.kind==='decal'),5]]){
  const layers=[];
  for(const [i,s]of list.entries()){
   const path=sourceFor(s.id);if(!await fs.access(path).then(()=>true,()=>false))continue;
   const label=Buffer.from('<svg width="384" height="25"><text x="8" y="20" fill="white" font-family="sans-serif" font-size="17">'+s.id+'</text></svg>');
   layers.push({input:await sharp(path).resize(384,384).flatten({background:'#121f2b'}).composite([{input:label,left:0,top:0}]).png().toBuffer(),left:i%cols*384,top:Math.floor(i/cols)*384});
  }
  await sharp({create:{width:cols*384,height:Math.ceil(list.length/cols)*384,channels:3,background:'#121f2b'}}).composite(layers).png().toFile(root+'/checks/'+name+'-contact.png');
 }
 console.log('Three labelled source-art contact sheets saved for visual inspection.');
}else throw Error('Use prepare, pack or contact');
