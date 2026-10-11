import fs from 'node:fs/promises';
import sharp from 'sharp';
import {chromium} from 'playwright-core';
const root='art/town',command=process.argv[2];
await fs.mkdir(root+'/guides',{recursive:true});await fs.mkdir(root+'/generated',{recursive:true});await fs.mkdir(root+'/checks',{recursive:true});
if(command==='prepare'){
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
}else throw Error('Use prepare');
