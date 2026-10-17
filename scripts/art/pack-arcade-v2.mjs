import fs from 'node:fs/promises';
import sharp from 'sharp';
const specs=JSON.parse(await fs.readFile('art/arcade/v2/specs.json','utf8'));
const manifest=JSON.parse(await fs.readFile('public/assets/manifest.json','utf8'));
await fs.mkdir('public/assets/arcade/v2',{recursive:true});
const report=[];
for(const spec of specs){
 const input=`art/arcade/v2/generated/${spec.key}.png`;
 await fs.access(input);
 const metadata=await sharp(input).metadata();if(!metadata.hasAlpha)throw Error(`${spec.key}: no alpha`);
 if(metadata.width!==metadata.height)throw Error(`${spec.key}: generator changed the square guide's aspect ratio`);
 // Resize the ENTIRE guide frame uniformly. Never stretch an object's opaque bbox.
 const whole=await sharp(input).resize(1024,1024).png().toBuffer();
 const guide=await sharp(`art/arcade/v2/guides/${spec.key}.png`).ensureAlpha().raw().toBuffer();
 const actual=await sharp(whole).ensureAlpha().raw().toBuffer();let intersection=0,union=0,outside=0,opaque=0;
 for(let i=3;i<guide.length;i+=4){const a=guide[i]>32,b=actual[i]>32;if(a||b)union++;if(a&&b)intersection++;if(b){opaque++;const p=(i-3)/4,x=p%1024,y=Math.floor(p/1024),g=spec.guide;if(x<g.left||x>=g.left+g.width||y<g.top||y>=g.top+g.height)outside++;}}
 const iou=intersection/Math.max(1,union),overflow=outside/Math.max(1,opaque);
 // Reject large framing drift instead of distorting the bitmap to hide it.
 if(overflow>.035)throw Error(`${spec.key}: ${(overflow*100).toFixed(1)}% outside its guide viewport`);
 const g=spec.guide;
 const sprite=await sharp(whole).extract({left:g.left,top:g.top,width:g.width,height:g.height}).resize(spec.pixelWidth,spec.pixelHeight).webp({quality:90}).toBuffer();
 const file=`arcade/v2/${spec.key}.webp`;await fs.writeFile(`public/assets/${file}`,sprite);
 manifest.overrides[spec.key]={file,scale:2,...(spec.anchor?{anchor:spec.anchor.map(v=>v*2)}:{})};
 report.push({key:spec.key,iou,overflow,width:spec.pixelWidth,height:spec.pixelHeight});
}
// Rejected v1 textures are not loaded by the corrected arcade.
for(const key of Object.keys(manifest.overrides))if(key.startsWith('arcade_')&&!key.startsWith('arcade_v2_')&&!key.startsWith('arcade_staff_'))delete manifest.overrides[key];
await fs.writeFile('public/assets/manifest.json',JSON.stringify(manifest,null,2)+'\n');
await fs.writeFile('art/arcade/v2/alignment-report.json',JSON.stringify(report,null,2)+'\n');
console.log(`Packed ${report.length}/${specs.length} individually guided sprites without opaque-bounds stretching.`);
