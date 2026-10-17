/** Publish a local, alpha-aware asset review gallery without touching the town layout. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {ROOT,artDir} from '../lib/town-scene.mjs';
const out=path.join(ROOT,'output/town-builder/expansion-review'),art=path.join(artDir('expansion-1988'));
await fs.mkdir(out,{recursive:true});
const lib=JSON.parse(await fs.readFile(path.join(ROOT,'output/town-builder/library/library.json'),'utf8'));
const report=JSON.parse(await fs.readFile(path.join(art,'manifest.json'),'utf8'));
const items=lib.items.filter(i=>i.id.startsWith('expansion:')),esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const cards=items.map(i=>{
 const id=i.id.slice(10),m=i.physicalMetres;
 return '<article data-search="'+esc(i.name+' '+i.category)+'"><img loading="lazy" src="'+esc(i.fence?'/fence-render/'+encodeURIComponent(i.id)+'.png?r=2&':'/library/'+i.file+'?')+'v='+Date.now()+'" alt="'+esc(i.name)+'"><h2>'+esc(i.name)+'</h2><p>'+esc(i.category)+' · '+m.width+' × '+m.depth+' m</p><p>'+(i.flat?'Walkable ground decal':'Upright sprite · dark base shadow')+'</p><a href="'+esc(i.fence?'/fence-render/'+encodeURIComponent(i.id)+'.png':'/town-art/native/'+id+'.png')+'" download>Full-resolution PNG</a></article>';
}).join('');
await fs.writeFile(path.join(out,'index.html'),'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Maple Falls — new sprite gallery</title><style>body{margin:0;background:#111c19;color:#dbc497;font:16px system-ui}header{padding:24px;position:sticky;top:0;background:#111c19;z-index:1;border-bottom:1px solid #345448}a{color:#f7b64c}h1{font-size:24px;margin:0 0 8px}header p{margin:0 0 12px}input{width:min(600px,90%);padding:10px;background:#22382e;color:#fff;border:1px solid #527661}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;padding:20px}article{background:#20352c;border:1px solid #3b5040;padding:14px;border-radius:6px}article img{width:100%;height:270px;object-fit:contain;background:repeating-conic-gradient(#263b30 0 25%,#293f34 0 50%) 0/24px 24px}h2{font-size:16px;margin-bottom:6px}article p{font-size:13px;color:#a6ba9c;margin:5px 0}article a{display:block;margin-top:12px;font-size:13px}[hidden]{display:none}</style><header><h1>Maple Falls — '+items.length+' new sprites</h1><p>Local builder assets. Native PNGs preserved; buildings generated individually. <a href="/">Back to builder</a></p><input id="search" placeholder="Filter by name or category"></header><main>'+cards+'</main><script>document.querySelector("#search").oninput=e=>{const q=e.target.value.toLowerCase();for(const a of document.querySelectorAll("article"))a.hidden=!a.dataset.search.toLowerCase().includes(q);};</script></html>');
const progress=report.assets.map(a=>'- ['+(items.some(i=>i.id==='expansion:'+a.id)?'x':' ')+'] '+a.name+' — '+a.status).join('\n');
await fs.writeFile(path.join(art,'PROGRESS.md'),'# Sprite batch progress\n\n'+items.length+' registered of '+report.assets.length+' planned. Manifest is authoritative. Receipt filenames retain generation history, not approval state.\n\n'+progress+'\n');
console.log(JSON.stringify({registered:items.length,planned:report.assets.length,gallery:'http://127.0.0.1:5190/sprite-review/'}));
