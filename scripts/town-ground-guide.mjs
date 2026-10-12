import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';

// Ground-only geometry guides for painting the town's ground as large tiles ("no buildings, no cars, just roads").
// The streets of src/game/town-static-plan.ts are drawn as smooth curves (rounded corners) in the game's exact 2:1
// projection, over flat colours for every other surface. A guide is the SHAPE input for image generation, exactly
// like the vector guides of the sprites: the painter adds texture and light, never moves a kerb.
//   node scripts/town-ground-guide.mjs            -> the whole town at 1/4 scale, plus the named chunks below
// Output: art/town/static/ground/guides/<name>.png and <name>.json (world rect, scale, origin).
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'art/town/static/ground/guides');
const url=process.env.TOWN_URL||'http://127.0.0.1:5192/';
/** world rectangles (tiles) to cut as chunks, and the scale of each guide (1 = the game's own 128px tiles) */
const CHUNKS=[
 {name:'whole-town',rect:[0,0,94,94],scale:.25},
 {name:'park-corner',rect:[60,42,30,30],scale:.5},
];
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge'});
try{
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);
 await page.getByRole('button',{name:'Go trick-or-treating',exact:true}).waitFor({timeout:120000});
 for(const chunk of CHUNKS){
  const result=await page.evaluate(async({rect,scale})=>{
   const source=await(await fetch('/src/game/town-static.ts')).text();
   const artURL=source.match(/from\s*["']([^"']*\/art\/town-static\.ts[^"']*)["']/)?.[1]||'/src/game/art/town-static.ts';
   const {loadStaticTownArt}=await import(artURL);await loadStaticTownArt();
   const {buildStaticTown}=await import('/src/game/town-static.ts');
   const {STATIC_STREETS}=await import('/src/game/town-static-plan.ts');
   const {G}=await import('/src/game/art/tiles.ts');
   const {HW,HH,MAP_W,MAP_H}=await import('/src/game/config.ts');
   const {map}=buildStaticTown();
   const [rx,ry,rw,rh]=rect;
   // screen box of the world rectangle
   const corners=[[rx,ry],[rx+rw,ry],[rx+rw,ry+rh],[rx,ry+rh]].map(([x,y])=>[(x-y)*HW,(x+y)*HH]);
   const left=Math.min(...corners.map(c=>c[0])),top=Math.min(...corners.map(c=>c[1]));
   const width=Math.ceil((Math.max(...corners.map(c=>c[0]))-left)*scale),height=Math.ceil((Math.max(...corners.map(c=>c[1]))-top)*scale);
   const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
   const ctx=canvas.getContext('2d');
   ctx.fillStyle='#0d1016';ctx.fillRect(0,0,width,height); // outside the town
   // from here on everything is drawn in WORLD tiles: the transform is the game's projection
   ctx.setTransform(HW*scale,HH*scale,-HW*scale,HH*scale,-left*scale,-top*scale);
   ctx.beginPath();ctx.rect(rx,ry,rw,rh);ctx.clip();
   const FLAT={[G.GRASS]:'#2f5a2a',[G.DARKGRASS]:'#234a2a',[G.DIRT]:'#5a4030',[G.GRAVEL]:'#6b6259',[G.FIELD]:'#3f7a36',[G.DRIVEWAY]:'#7d7f84',[G.FLAGSTONE]:'#9a8f7a'};
   const at=(x,y)=>x<0||y<0||x>=MAP_W||y>=MAP_H?G.GRASS:map.ground[y*MAP_W+x];
   const nearRoad=(x,y)=>[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]].some(([a,b])=>at(x+a,y+b)===G.ROAD);
   ctx.fillStyle=FLAT[G.GRASS];ctx.fillRect(0,0,MAP_W,MAP_H);
   for(let y=0;y<MAP_H;y++)for(let x=0;x<MAP_W;x++){
    let g=at(x,y);
    // the grid's roads and the pavements that hug them are replaced by the smooth streets below
    if(g===G.ROAD||(g===G.SIDEWALK&&nearRoad(x,y)))g=G.GRASS;
    if(g===G.GRASS)continue;
    ctx.fillStyle=g===G.SIDEWALK?'#a3a5a8':FLAT[g]??FLAT[G.GRASS];
    ctx.fillRect(x-.02,y-.02,1.04,1.04);
   }
   // the pond
   ctx.fillStyle='#274753';ctx.beginPath();ctx.ellipse(79,44,4,3,0,0,Math.PI*2);ctx.fill();
   // streets: one smooth path per street, corners rounded with a radius that grows with the street's width
   const trace=(points,shift)=>{
    ctx.beginPath();
    const p=points.map(([x,y])=>[x+shift,y+shift]);
    ctx.moveTo(p[0][0],p[0][1]);
    for(let i=1;i<p.length-1;i++)ctx.arcTo(p[i][0],p[i][1],p[i+1][0],p[i+1][1],Math.min(3.2,.45*Math.min(Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]),Math.hypot(p[i+1][0]-p[i][0],p[i+1][1]-p[i][1]))));
    ctx.lineTo(p.at(-1)[0],p.at(-1)[1]);
   };
   ctx.lineJoin='round';ctx.lineCap='round';
   for(const pass of ['pavement','road','line'])for(const street of STATIC_STREETS){
    const shift=street.width%2===1?.5:0;
    trace(street.points,shift);
    if(pass==='pavement'){ctx.strokeStyle='#a3a5a8';ctx.lineWidth=street.width+1.7;ctx.setLineDash([]);}
    else if(pass==='road'){ctx.strokeStyle='#2b2c33';ctx.lineWidth=street.width;ctx.setLineDash([]);}
    else{ctx.strokeStyle='#d9b648';ctx.lineWidth=.1;ctx.setLineDash([.8,.9]);ctx.lineCap='butt';}
    ctx.stroke();ctx.lineCap='round';
   }
   ctx.setLineDash([]);
   return {data:canvas.toDataURL('image/png'),width,height,origin:[left,top]};
  },chunk);
  await fs.writeFile(path.join(out,chunk.name+'.png'),Buffer.from(result.data.split(',')[1],'base64'));
  await fs.writeFile(path.join(out,chunk.name+'.json'),JSON.stringify({name:chunk.name,worldRect:chunk.rect,scale:chunk.scale,width:result.width,height:result.height,origin:result.origin,note:'Ground-only geometry guide: smooth streets from town-static-plan.ts over flat surface colours. No buildings, cars or trees.'},null,2)+'\n');
  console.log(`${chunk.name}: ${result.width}x${result.height}`);
 }
 if(errors.length)throw Error(errors.join('\n'));
}finally{await browser.close();}
