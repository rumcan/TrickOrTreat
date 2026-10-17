import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';

const root='art/nightmare';
const specs=JSON.parse(await fs.readFile(root+'/specs.json','utf8'));
const report=JSON.parse(await fs.readFile(root+'/report.json','utf8'));
const manifest=JSON.parse(await fs.readFile('public/assets/manifest.json','utf8'));
assert.equal(specs.length,21);
assert.equal(report.length,61);
await fs.mkdir(root+'/checks',{recursive:true});
const atlasTiles=[],spriteTiles=[];
let index=0;
for(const [i,family]of specs.entries()){
  const label=Buffer.from(`<svg width="384" height="28"><text x="8" y="20" fill="white" font-family="sans-serif" font-size="17">${family.id}</text></svg>`);
  atlasTiles.push({input:await sharp(root+'/generated/'+family.id+'.png').resize(384,384).flatten({background:'#10131a'}).composite([{input:label,left:0,top:0}]).png().toBuffer(),left:i%7*384,top:Math.floor(i/7)*384});
  for(const s of family.sprites){
    const entry=manifest.overrides['enemy_'+s.id],r=report.find(r=>r.id===s.id);
    assert.ok(entry&&r,s.id+': missing registered PNG');
    assert.equal(entry.frames,4);
    assert.deepEqual(entry.anchor,s.anchor.map(a=>a*entry.scale));
    assert.ok(Number.isFinite(r.uniformScale)&&r.uniformScale>0);
    const path='public/assets/'+entry.file,metadata=await sharp(path).metadata();
    const fw=s.fw*entry.scale,fh=s.fh*entry.scale;
    assert.equal(metadata.width,fw*4);
    assert.equal(metadata.height,fh);
    assert.ok(metadata.hasAlpha);
    const hashes=new Set();
    for(let f=0;f<4;f++){
      const raw=await sharp(path).extract({left:f*fw,top:0,width:fw,height:fh}).ensureAlpha().raw().toBuffer();
      hashes.add(createHash('sha256').update(raw).digest('hex'));
      let opaque=0,maxY=-1;
      for(let y=0;y<fh;y++)for(let x=0;x<fw;x++){
        const a=raw[(y*fw+x)*4+3];
        if(a>64){opaque++;maxY=Math.max(maxY,y);assert.ok(x>1&&x<fw-2&&y>1&&y<fh-2,s.id+': clipped pose '+f);}
      }
      assert.ok(opaque>200,s.id+': empty pose '+f);
      assert.ok(Math.abs(maxY-entry.anchor[1]+1)<=2,s.id+': floating ground anchor '+f);
    }
    assert.equal(hashes.size,4,s.id+': duplicate animation poses');
    const label=Buffer.from(`<svg width="256" height="28"><text x="6" y="20" fill="white" font-family="sans-serif" font-size="14">${s.id}</text></svg>`);
    const image=await sharp(path).extract({left:0,top:0,width:fw,height:fh}).resize(236,218,{fit:'contain',background:'#10131a'}).flatten({background:'#10131a'}).png().toBuffer();
    spriteTiles.push({input:await sharp({create:{width:256,height:256,channels:3,background:'#10131a'}}).composite([{input:image,left:10,top:32},{input:label,left:0,top:0}]).png().toBuffer(),left:index%7*256,top:Math.floor(index/7)*256});
    index++;
  }
}
await sharp({create:{width:2688,height:1152,channels:3,background:'#10131a'}}).composite(atlasTiles).png().toFile(root+'/checks/atlas-contact.png');
await sharp({create:{width:1792,height:2304,channels:3,background:'#10131a'}}).composite(spriteTiles).png().toFile(root+'/checks/sprite-contact.png');
console.log('61 registered PNG sheets / 244 distinct poses: alpha, padding, dimensions, stable anchors and uniform scaling PASS. Contact sheets saved for visual review.');
