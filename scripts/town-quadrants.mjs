import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

// Raster-only preparation and bookkeeping. Semantic extraction is performed by
// the image generator, not by this script. A generated crop is never auto-approved.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=path.join(root,'art/town/quadrants');
const source=path.join(root,'art/town/static/ground/trace/town-reference.png');
const queueFile=path.join(dir,'queue.json');
const command=process.argv[2]||'status';
const positions=['top left','top right','bottom left','bottom right'];
const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const write=async(file,value)=>{
  const temp=file+'.tmp-'+process.pid;
  await fs.writeFile(temp,JSON.stringify(value,null,2)+'\n');
  await fs.rename(temp,file);
};
const exists=async file=>{try{await fs.access(file);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}};
export function splitBounds(bounds){
  const {left,top,width,height}=bounds,w=Math.floor(width/2),h=Math.floor(height/2);
  return [
    {left,top,width:w,height:h},
    {left:left+w,top,width:width-w,height:h},
    {left,top:top+h,width:w,height:height-h},
    {left:left+w,top:top+h,width:width-w,height:height-h},
  ];
}
const relative=file=>path.relative(root,file).split(path.sep).join('/');
async function receipt(file){
  const bytes=await fs.readFile(file),meta=await sharp(bytes).metadata();
  const stats=await sharp(bytes).stats();
  return {path:relative(file),sha256:createHash('sha256').update(bytes).digest('hex'),
    bytes:bytes.length,width:meta.width,height:meta.height,hasAlpha:!!meta.hasAlpha,
    transparentPixels:meta.hasAlpha&&stats.channels.at(-1).min===0};
}
async function prepare(){
  for(const sub of ['inputs','crops','prompts','generated','receipts'])await fs.mkdir(path.join(dir,sub),{recursive:true});
  const meta=await sharp(source).metadata();
  const old=await exists(queueFile)?await read(queueFile):{jobs:[]};
  const oldById=new Map(old.jobs.map(j=>[j.id,j]));
  const jobs=[];
  async function descend(parent,bounds,depth){
    if(depth===3)return;
    const children=splitBounds(bounds);
    for(let q=0;q<4;q++){
      const id=`${parent}_${q+1}`,b=children[q],leaf=depth===2;
      const crop=path.join(dir,'crops',`${id}.png`);
      await sharp(source).extract(b).png().toFile(crop);
      const prompt=`Use case: precise-object-edit\nInput image 1 is the parent reference. Split this image into 4 equal parts with a line down the center vertical and horizontal and generate a high rez image of the ${positions[q]} part only. The lines are conceptual; do not draw them. Return only that exact quarter, filling the output, highest available resolution. Preserve the parent's crop edges, road crossings, object positions, camera and night lighting. Do not reframe or redesign. Input image 2, if provided, is the exact original reference crop: use it to verify boundary alignment.\n`;
      // Preserve the exact prompt already used for a generated image.
      const promptPath=path.join(dir,'prompts',`${id}.txt`);
      if(!await exists(promptPath))await fs.writeFile(promptPath,prompt);
      jobs.push({id,parent,depth:depth+1,quadrant:q+1,rootBounds:b,
        uv:[b.left/meta.width,b.top/meta.height,b.width/meta.width,b.height/meta.height],
        exactCrop:relative(crop),prompt:relative(path.join(dir,'prompts',`${id}.txt`)),
        status:'pending',registration:'unchecked',...(leaf?{ground:'pending',atlas:'pending'}:{}),...oldById.get(id)});
      await descend(id,b,depth+1);
    }
  }
  await descend('1',{left:0,top:0,width:meta.width,height:meta.height},0);
  const queue={version:1,source:await receipt(source),quadrantOrder:positions,
    note:'Exact source bounds are bookkeeping, not proof that AI output is registered. Never auto-approve.',jobs,studies:old.studies||[]};
  await write(queueFile,queue);
  await report(queue);
}
async function ingest(){
  const [id,input,promptFile]=process.argv.slice(3);
  if(!id||!input||!/^[\w-]+$/.test(id))throw Error('Usage: ingest <safe-id> <generated-PNG> [prompt-file]');
  const queue=await read(queueFile),job=queue.jobs.find(j=>j.id===id);
  const output=path.join(dir,'generated',`${id}.png`);
  if(await exists(output))throw Error('Refusing to overwrite generated master; use a versioned id');
  await fs.copyFile(path.resolve(input),output);
  const info=await receipt(output);
  const artifact={id,...info,generator:'built-in image_gen',inspected:false,registration:'unchecked',
    productionEligible:false,usage:id.includes('atlas')?'study-only':'unregistered-master'};
  if(promptFile)artifact.prompt=await fs.readFile(path.resolve(promptFile),'utf8');
  await write(path.join(dir,'receipts',`${id}.json`),artifact);
  if(job){job.status='generated';job.artifact=info;}
  else queue.studies.push(artifact);
  await write(queueFile,queue);await report(queue);
}
async function report(queue){
  const counts={total:queue.jobs.length,generated:queue.jobs.filter(j=>j.status==='generated').length,
    registered:queue.jobs.filter(j=>j.registration==='approved').length,leaves:queue.jobs.filter(j=>j.depth===3).length,
    atlases:queue.studies.filter(j=>j.id.includes('atlas')).length,
    individualObjects:queue.studies.filter(j=>/^(building|landmark)-/.test(j.id)).length};
  await write(path.join(dir,'status.json'),counts);
  console.log(JSON.stringify(counts));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(command==='prepare')await prepare();
  else if(command==='ingest'){
    // Independent generation batches may complete together. Serialize the
    // read-modify-write transaction so no artifact disappears from the queue.
    const lock=path.join(dir,'.ingest.lock');let acquired=false;
    for(let attempt=0;attempt<100;attempt++){
      try{await fs.mkdir(lock);acquired=true;break;}
      catch(e){if(e.code!=='EEXIST')throw e;await new Promise(r=>setTimeout(r,100));}
    }
    if(!acquired)throw Error('Another ingest is busy; retry instead of overwriting its queue');
    try{await ingest();}finally{await fs.rmdir(lock);}
  }
  else if(command==='status')await report(await read(queueFile));
  else throw Error('Unknown command: '+command);
}
