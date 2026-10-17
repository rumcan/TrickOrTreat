// Publish a completed map by switching a small pointer, without renaming an open
// directory on Windows. Old maps stay available until the new one is complete.
import fs from 'node:fs/promises';
import path from 'node:path';
export async function mapDirectory(data,fallback=data){
 for(const root of [...new Set([data,fallback])]){
  try{const current=JSON.parse(await fs.readFile(path.join(root,'map-current.json'),'utf8'));
   if(!/^map-(version|staging)-[a-z0-9T.-]+$/i.test(current.directory))throw Error('Invalid map directory');
   const dir=path.join(root,current.directory);await fs.access(path.join(dir,'manifest.json'));return dir;
  }catch(e){if(e.code!=='ENOENT')throw e;}
  try{await fs.access(path.join(root,'map/manifest.json'));return path.join(root,'map');}catch(e){if(e.code!=='ENOENT')throw e;}
 }
 return path.join(fallback,'map');
}
export async function publishMap(data,completed){
 const dir=path.resolve(completed),relative=path.relative(path.resolve(data),dir);
 if(!/^map-(version|staging)-[a-z0-9T.-]+$/i.test(relative))throw Error('Completed map must be a version directory inside the data folder');
 const manifest=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8'));
 for(const level of manifest.levels)for(let y=0;y<level.rows;y++)for(let x=0;x<level.cols;x++)await fs.access(path.join(dir,'tiles',String(level.level),`${x}_${y}.webp`));
 await fs.access(path.join(dir,'preview.webp'));
 const previous=await mapDirectory(data),file=path.join(data,'map-current.json'),temp=file+'.tmp';
 await fs.writeFile(temp,JSON.stringify({directory:relative,bakedAt:manifest.bakedAt,previous:path.basename(previous)}));
 for(let attempt=0;;attempt++)try{await fs.rename(temp,file);break;}catch(e){if(!['EPERM','EACCES','EBUSY'].includes(e.code)||attempt>=20)throw e;await new Promise(resolve=>setTimeout(resolve,100));}
 return {directory:dir,previous};
}
/** After a publish, delete older bakes: keep only the current map and the previous one (for going back).
 *  Removes map/, map-before-* and any map-version-/map-staging- folder older than the current one; a newer folder
 *  (a bake still in progress) is never touched. Returns the names removed. */
export async function pruneMaps(data){
 const current=JSON.parse(await fs.readFile(path.join(data,'map-current.json'),'utf8')),keep=new Set([current.directory,current.previous]);
 const stamp=name=>name.replace(/^map-(version|staging)-/,''),removed=[];
 for(const e of await fs.readdir(data,{withFileTypes:true})){
  if(!e.isDirectory()||keep.has(e.name))continue;
  const old=e.name==='map'||/^map-before-/.test(e.name)||(/^map-(version|staging)-/.test(e.name)&&stamp(e.name)<stamp(current.directory));
  if(!old)continue;
  await fs.rm(path.join(data,e.name),{recursive:true,force:true,maxRetries:5});removed.push(e.name);
 }
 return removed;
}
