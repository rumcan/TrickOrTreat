import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {ROOT,artDir} from '../../lib/town-paths.mjs';
const master=path.join(artDir('road-sections'));
const delivery=path.join(ROOT,'output/road-sections');
await fs.mkdir(path.join(master,'generated'),{recursive:true});
await fs.mkdir(delivery,{recursive:true});
const [command,id,source,prompt,input]=process.argv.slice(2);
if(command==='deliver') {
  const receipts=(await fs.readdir(path.join(master,'generated'))).filter(f=>f.endsWith('.json'));
  for(const f of receipts) {
    const receipt=JSON.parse(await fs.readFile(path.join(master,'generated',f),'utf8'));
    const dir=receipt.visuallyAccepted?delivery:path.join(delivery,'drafts');
    await fs.mkdir(dir,{recursive:true});
    for(const ext of ['png','json']) await fs.copyFile(path.join(master,'generated',receipt.id+'.'+ext),path.join(dir,receipt.id+'.'+ext));
  }
  await fs.copyFile(path.join(master,'prompts.json'),path.join(delivery,'prompts.json'));
  console.log(delivery);
} else if(command==='ingest') {
  if(!/^[a-z0-9-]+$/.test(id)) throw Error('Invalid id');
  const target=path.join(master,'generated',id+'.png');
  await fs.copyFile(source,target,1);
  const m=await sharp(target).metadata();
  const {data,info}=await sharp(target).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let clear=0; for(let i=3;i<data.length;i+=4) if(data[i]===0) clear++;
  const receipt={id,width:m.width,height:m.height,hasAlpha:m.hasAlpha,transparentFraction:clear/(info.width*info.height),source,input,prompt,tool:'built-in image_gen',visuallyAccepted:false};
  await fs.writeFile(path.join(master,'generated',id+'.json'),JSON.stringify(receipt,null,2));
  await fs.copyFile(target,path.join(delivery,id+'.png'),1);
  await fs.copyFile(path.join(master,'generated',id+'.json'),path.join(delivery,id+'.json'),1);
  console.log(JSON.stringify({...receipt,prompt:undefined}));
} else if(command==='preview-one') {
  const sourcePath=path.join(master,'generated',id+'.png');
  const metadata=await sharp(sourcePath).metadata();
  const target=path.join(delivery,id+'-alpha-preview.jpg');
  await sharp({create:{width:metadata.width,height:metadata.height,channels:3,background:'#496078'}}).composite([{input:sourcePath}]).jpeg({quality:95}).toFile(target);
  console.log(target);
} else if(command==='prompt') {
  const receiptPath=path.join(master,'generated',id+'.json');
  const receipt=JSON.parse(await fs.readFile(receiptPath,'utf8'));
  receipt.prompt=source;
  await fs.writeFile(receiptPath,JSON.stringify(receipt,null,2));
  await fs.copyFile(receiptPath,path.join(delivery,id+'.json'));
} else if(command==='review') {
  const receiptPath=path.join(master,'generated',id+'.json');
  const receipt=JSON.parse(await fs.readFile(receiptPath,'utf8'));
  receipt.visuallyAccepted=source==='accept';
  receipt.reviewNotes=prompt;
  await fs.writeFile(receiptPath,JSON.stringify(receipt,null,2));
  await fs.copyFile(receiptPath,path.join(delivery,id+'.json'));
  if(!receipt.visuallyAccepted) {
    await fs.mkdir(path.join(delivery,'drafts'),{recursive:true});
    for(const ext of ['png','json']) await fs.rename(path.join(delivery,id+'.'+ext),path.join(delivery,'drafts',id+'.'+ext));
  }
  console.log(JSON.stringify({id,visuallyAccepted:receipt.visuallyAccepted}));
} else if(command==='check') {
  const receipts=(await fs.readdir(path.join(master,'generated'))).filter(f=>f.endsWith('.json'));
  const checked=[];
  for(const f of receipts) {
    const receipt=JSON.parse(await fs.readFile(path.join(master,'generated',f),'utf8'));
    if(!receipt.visuallyAccepted) continue;
    const name=receipt.id+'.png';
    const native=await fs.readFile(path.join(master,'generated',name));
    const exported=await fs.readFile(path.join(delivery,name));
    const metadata=await sharp(native).metadata();
    assert(metadata.hasAlpha,name+' must have genuine alpha');
    assert(receipt.transparentFraction>0.2 && receipt.transparentFraction<0.95,name+' must contain substantial transparent area and paving');
    assert(metadata.width>=1500,name+' must remain native resolution');
    assert(receipt.prompt && receipt.input,name+' requires exact prompt and source provenance');
    const hash=b=>createHash('sha256').update(b).digest('hex');
    assert.equal(hash(native),hash(exported),name+' export must be lossless');
    checked.push({id:receipt.id,width:metadata.width,height:metadata.height,transparentFraction:receipt.transparentFraction});
  }
  assert.equal(checked.length,7,'Expected seven accepted paving units');
  await fs.writeFile(path.join(delivery,'validation.json'),JSON.stringify({passed:true,checked},null,2));
  console.log(JSON.stringify({passed:true,checked}));
} else if(command==='contact') {
  const candidates=(await fs.readdir(path.join(master,'generated'))).filter(f=>f.endsWith('.png')).sort();
  const files=[];
  for(const file of candidates) {
    const receipt=JSON.parse(await fs.readFile(path.join(master,'generated',file.replace('.png','.json')),'utf8'));
    if(receipt.visuallyAccepted) files.push(file);
  }
  const layers=[]; const w=540,h=340;
  for(let i=0;i<files.length;i++) {
    const input=await sharp(path.join(master,'generated',files[i])).resize(w-24,h-50,{fit:'inside'}).png().toBuffer();
    layers.push({input,left:(i%2)*w+12,top:Math.floor(i/2)*h+35});
    layers.push({input:Buffer.from(`<svg width="540" height="28"><text x="12" y="21" fill="#ffffff" font-family="sans-serif" font-size="19">${files[i]}</text></svg>`),left:(i%2)*w,top:Math.floor(i/2)*h});
  }
  const out=path.join(delivery,'road-sections-preview.jpg');
  await sharp({create:{width:w*2,height:h*Math.ceil(files.length/2),channels:3,background:'#24303a'}}).composite(layers).jpeg({quality:92}).toFile(out);
  console.log(out);
}
