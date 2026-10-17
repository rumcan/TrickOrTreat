import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import {ROOT} from '../../lib/town-paths.mjs';
const root=path.join(ROOT,'output/road-autotile-v2');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const [mode,id,source]=process.argv.slice(2);
if(mode==='ingest'){
 if(!['asphalt-detail','concrete-slabs','individual-leaves','warm-reflection'].includes(id))throw Error('Unknown art id');
 await fs.mkdir(path.join(root,'native'),{recursive:true});
 const file=path.join(root,'native',id+'.png');
 try{await fs.access(file);throw Error('Native file exists; preserve it');}catch(e){if(e.code!=='ENOENT')throw e;}
 const m=await sharp(source).metadata();if(['individual-leaves','warm-reflection'].includes(id)&&!m.hasAlpha)throw Error('Decal needs genuine alpha');
 await fs.copyFile(source,file);
 const job=JSON.parse(await fs.readFile(path.join(root,'jobs',id+'.json'),'utf8'));
 for(const f of job.refs){job.referenceHashes??=[];job.referenceHashes.push({path:f,sha:sha(await fs.readFile(f))});}
 await fs.writeFile(path.join(root,'native',id+'.json'),JSON.stringify({...job,nativeSource:source,width:m.width,height:m.height,hasAlpha:m.hasAlpha,sha:sha(await fs.readFile(file)),tool:'built-in imagegen',review:'pending'},null,2));
 console.log(JSON.stringify({id,file,width:m.width,height:m.height,hasAlpha:m.hasAlpha}));
}else if(mode==='prepare'){
 for(const d of ['native','jobs','tiles','review','sources'])await fs.mkdir(path.join(root,d),{recursive:true});
}else throw Error('prepare | ingest <id> <nativePNG>');
