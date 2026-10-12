import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=path.join(root,'art/town/quadrants');
const inventory=path.join(dir,'objects.json');

export async function inspectObject(file){
  const image=sharp(file),meta=await image.metadata();
  if(!meta.hasAlpha)throw Error('Object has no alpha channel: '+file);
  const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let left=info.width,top=info.height,right=-1,bottom=-1,opaque=0,clear=0;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
    const alpha=data[(y*info.width+x)*4+3];
    if(alpha===0)clear++;
    // Ignore faint glow when measuring native solid-object resolution.
    if(alpha>=128){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);opaque++;}
  }
  if(!clear||!opaque)throw Error('Object must have both transparent and visible pixels: '+file);
  const bounds={left,top,width:right-left+1,height:bottom-top+1};
  const longest=Math.max(bounds.width,bounds.height);
  return {width:meta.width,height:meta.height,solidBounds:bounds,
    nativeLongestEdge:longest,transparentFraction:clear/(info.width*info.height),
    resolutionPass:longest>=1000,
    edgeClipped:left===0||top===0||right===info.width-1||bottom===info.height-1};
}

async function run(){
  const plan=JSON.parse(await fs.readFile(inventory,'utf8'));
  const output=path.join(dir,'individual');await fs.mkdir(output,{recursive:true});
  for(const object of plan.objects){
    const file=path.join(dir,'generated',(object.master||object.id)+'.png');
    try{await fs.access(file);}catch(e){if(e.code==='ENOENT')continue;throw e;}
    const check=await inspectObject(file);object.check=check;
    object.status=object.visualIssues?.length?'needs-revision':check.resolutionPass&&!check.edgeClipped?'resolution-checked':'needs-review';
    // Native-sized PNG master stays untouched. WebP is only a preview derivative.
    const preview=path.join(output,object.id+'.webp');
    await sharp(file).webp({quality:94,alphaQuality:100}).toFile(preview);
    object.preview=path.relative(root,preview).split(path.sep).join('/');
  }
  const temp=inventory+'.tmp-'+process.pid;
  await fs.writeFile(temp,JSON.stringify(plan,null,2)+'\n');
  await fs.rename(temp,inventory);
  console.log(JSON.stringify({total:plan.objects.length,generated:plan.objects.filter(o=>o.check).length,
    resolutionChecked:plan.objects.filter(o=>o.status==='resolution-checked').length,
    note:'Resolution checks are not visual or placement approval.'}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await run();
