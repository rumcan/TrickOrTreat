import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';
const specs=JSON.parse(await fs.readFile('art/town/specs.json','utf8'));
const report=JSON.parse(await fs.readFile('art/town/packing-report.json','utf8'));
const prompts=JSON.parse(await fs.readFile('art/town/prompts.json','utf8')).assets;
assert.equal(specs.length,35);assert.equal(prompts.length,35);
const selected=specs.filter(s=>!process.argv[2]||process.argv[2].split(',').includes(s.id));
assert.ok(selected.length>0);
for(const s of selected){
 const r=report.find(r=>r.id===s.id);assert.equal(r?.status,'packed',s.id+': must be packed and reviewed');
 const p=prompts.find(p=>p.id===s.id);assert.ok(p.prompt.length>300&&p.references.length===2);
 const path='public/assets/'+r.file,metadata=await sharp(path).metadata();
 assert.ok(metadata.hasAlpha,s.id+': missing transparent alpha');
 assert.equal(metadata.width,s.w*2);assert.equal(metadata.height,s.h*2);
 assert.deepEqual(r.anchor,[s.ax*2,s.ay*2]);
 const d=await sharp(path).ensureAlpha().raw().toBuffer(),w=metadata.width,h=metadata.height;
 let opaque=0,border=0,bottom=-1;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(d[(y*w+x)*4+3]>64){opaque++;bottom=Math.max(bottom,y);if(x<2||x>=w-2||y<2||y>=h-2)border++;}
 assert.ok(opaque>200,s.id+': empty sprite');assert.equal(border,0,s.id+': cropped body or opaque backdrop');
 if(s.kind==='building')assert.ok(Math.abs(bottom-(s.ay+(s.fw+s.fh)*16)*2)<=1,s.id+': wrong ground corner');
}
console.log(selected.length+'/35 vector-guided assets: source prompts, alpha, canvas sizes, margins and building ground corners PASS. Visual acceptance is still a separate checklist step.');
