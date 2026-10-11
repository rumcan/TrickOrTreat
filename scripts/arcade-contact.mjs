import sharp from 'sharp';
import fs from 'node:fs/promises';
const specs=JSON.parse(await fs.readFile('art/arcade/specs.json','utf8')).filter(s=>s.category==='prop'&&!s.key.includes('wall'));
const cells=[];
for(let i=0;i<specs.length;i++){
 const s=specs[i], img=await sharp(`art/arcade/vector/${s.key}.png`).resize(450,400,{fit:'inside'}).png().toBuffer();
 const info=await sharp(img).metadata();cells.push({input:img,left:(i%4)*512+Math.round((512-info.width)/2),top:Math.floor(i/4)*512+Math.round((512-info.height)/2)});
}
await sharp({create:{width:2048,height:1536,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(cells).png().toFile('art/arcade/vector-atlas.png');
