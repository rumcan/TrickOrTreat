/** Generate the specs with RUN, slowly: one image at a time, at least GAP seconds apart, waiting out rate limits.
 *    node scripts/town-builder/run-sprites/generate.mjs [id ...] [--gap 90] [--again]
 *  Writes output/town-art/run-v5/ (TOWN_ART)native/<id>.png (+ prompts/, receipts/, log.txt). Existing outputs are
 *  skipped unless --again. Nothing is registered in the library here; review first, then register.mjs. */
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {specs} from './specs.mjs';
import {ROOT,TOWN_ART,artSource,artDir} from '../../lib/town-paths.mjs';
const HERE=path.dirname(fileURLToPath(import.meta.url)),OUT=path.join(artDir('run-v5'));
const GAME='AFjPSjQH9kbcCl57sgO3';
const args=process.argv.slice(2),opt=k=>{const i=args.indexOf('--'+k);return i>=0?args[i+1]:null;},GAP=+(opt('gap')||90)*1000;
const only=args.filter((a,i)=>!a.startsWith('--')&&!(args[i-1]||'').startsWith('--gap'));
for(const d of ['native','prompts','receipts'])await fs.mkdir(path.join(OUT,d),{recursive:true});
const log=async m=>{const line=`${new Date().toISOString()} ${m}`;console.log(line);await fs.appendFile(path.join(OUT,'log.txt'),line+'\n');};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function prompt(s){
 const view=s.flat
  ?`A flat GROUND DECAL painted directly on the ground plane, seen from the game camera: orthographic 2:1 dimetric, world axes slope +0.5 and -0.5 (26.565 degrees), no perspective. It must lie perfectly flat: no raised depth, no side walls, no drop shadow. Footprint about ${s.w} by ${s.d} metres; keep its elongated proportions, do not squash it into a square.`
  :`One standalone object seen from the game camera: orthographic 2:1 dimetric, world axes slope +0.5 and -0.5 (26.565 degrees), heading 45 degrees, pitch 30 degrees, vertical lines stay vertical, no perspective vanishing point. About ${s.w} x ${s.d} m footprint, ${s.h} m tall. Dark contact occlusion where it touches the ground only, no long cast shadow, no ground patch.`;
 return [`Game sprite for a 1988 small-town Halloween night builder game. Subject: ${s.subject}`,view,
  'Style: match the reference images exactly: finely painted textured game artwork, early evening, subdued navy shadows, warm amber streetlight highlights, rich small detail, no thick cartoon outlines, not photorealistic.',
  'Composition: exactly ONE isolated asset, entirely visible, centred with generous empty margin, using most of the canvas. Plain flat neutral mid-grey background, nothing else: no grass, road, pavement, frame, text, labels or watermark.'].join('\n\n');}

function run(cmd,argv){return new Promise(res=>execFile(cmd,argv,{cwd:ROOT,maxBuffer:1<<26,shell:process.platform==='win32',windowsHide:true},(err,stdout,stderr)=>res({code:err?err.code||1:0,out:String(stdout||''),err:String(stderr||'')})));}
const q=a=>process.platform==='win32'?`"${String(a).replace(/"/g,'\\"')}"`:a;

let last=0;
for(const s of specs){
 if(only.length&&!only.includes(s.id))continue;
 const file=path.join(OUT,'native',s.id+'.png');if(existsSync(file)&&!args.includes('--again')){await log(`skip ${s.id} (exists)`);continue;}
 const p=prompt(s);await fs.writeFile(path.join(OUT,'prompts',s.id+'.txt'),p);
 const argv=['generate','image','--game-id',GAME,'--prompt',p,'--aspect-ratio',s.aspect,'--remove-background','--remove-background-model','birefnet','--remove-background-variant','heavy','--json','--out',file];
 for(const r of s.refs)argv.push('--reference-image',artSource(r));
 for(let attempt=1;attempt<=6;attempt++){
  const wait=last+GAP-Date.now();if(wait>0){await log(`waiting ${Math.round(wait/1000)} s before ${s.id}`);await sleep(wait);}
  last=Date.now();await log(`generating ${s.id} (attempt ${attempt})`);
  const r=await run('rundot',argv.map(q));const text=r.out+'\n'+r.err;
  await fs.writeFile(path.join(OUT,'receipts',s.id+'.json'),JSON.stringify({id:s.id,code:r.code,stdout:r.out.slice(-4000),stderr:r.err.slice(-4000),at:new Date().toISOString()},null,1));
  if(r.code===0&&existsSync(file)){await log(`done ${s.id}`);break;}
  const m=text.match(/(?:retry|try again)[^0-9]{0,40}(\d+)\s*s/i)||text.match(/(\d+)\s*seconds/i);
  if(/rate.?limit|too many|429/i.test(text)){const secs=m?+m[1]+15:180;await log(`rate limited on ${s.id}; waiting ${secs} s`);await sleep(secs*1000);continue;}
  await log(`failed ${s.id}: ${text.replace(/\s+/g,' ').slice(0,300)}`);if(attempt>=2)break;await sleep(30000);
 }
}
await log('batch finished');
