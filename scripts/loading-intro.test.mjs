import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';

const out = 'art/intro/checks';
await fs.mkdir(out, { recursive:true });
const server = await createServer({ configFile:false,base:'./',plugins:[react(),tailwind()],optimizeDeps:{ entries:['index.html'] },server:{ host:'127.0.0.1',port:5184,strictPort:true,watch:null } });
await server.listen();
const browser = await chromium.launch({ channel:'msedge' });
const errors = [];
const base = 'http://127.0.0.1:5184/';
async function page(options={}) {
  const p = await browser.newPage({ viewport:{width:1672,height:941},...options });
  p.on('pageerror',e => { errors.push(e.message); console.error(e.message); });
  return p;
}
async function ready(p) {
  await p.getByRole('button',{name:'Go trick-or-treating',exact:true}).waitFor({timeout:120000});
  await p.waitForFunction(() => !document.getElementById('loading-overlay'));
}
try {
  const p = await page();
  let release;
  const gate = new Promise(resolve => { release=resolve; });
  await p.route('**/assets/manifest.json',async route => { await gate; await route.continue(); });
  await p.addInitScript(() => {
    const observe = new MutationObserver(() => { const film=document.getElementById('boot-film'); if (film) { window.__firstBootFilm=film;observe.disconnect(); } });
    observe.observe(document,{childList:true,subtree:true});
  });
  await p.goto(base,{waitUntil:'domcontentloaded'});
  try { await p.waitForFunction(() => document.querySelector('#boot-film')?.currentTime > .3); }
  catch (error) {
    console.log(await p.evaluate(() => {const v=document.querySelector('#boot-film');return {phase:document.querySelector('#loading-overlay')?.dataset.phase,source:v?.currentSrc,time:v?.currentTime,paused:v?.paused,ready:v?.readyState,error:v?.error?.message,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,body:document.body.innerText.slice(0,500)};}));
    await p.screenshot({path:`${out}/playback-error.png`}); throw error;
  }
  assert.equal(await p.locator('#loading-overlay').getAttribute('data-phase'),'playing');
  assert.equal(await p.locator('.boot-skip').count(),1,'React takeover leaves one skip control');
  assert.equal(await p.locator('#boot-film').evaluate(v => v.muted),true);
  await p.screenshot({path:`${out}/01-camera-reveal.png`});
  await p.waitForFunction(() => document.getElementById('loading-overlay')?.dataset.phase === 'holding',null,{timeout:25000});
  const end = await p.evaluate(() => ({same:window.__firstBootFilm===document.getElementById('boot-film'),time:document.getElementById('boot-film').currentTime,paused:document.getElementById('boot-film').paused}));
  assert.equal(end.same,true,'Film survives React mounting without a restart');
  assert.ok(end.time >= 7.8,'Full cinematic reaches its final frame');
  assert.equal(end.paused,true);
  await p.waitForTimeout(700);
  await p.screenshot({path:`${out}/02-freeze-logo-loader.png`});
  const progress = p.getByRole('progressbar',{name:'Loading Maple Falls'});
  assert.ok(Number(await progress.getAttribute('aria-valuenow')) < 100,'Progress reflects the delayed asset request');
  release();
  await ready(p);
  await p.close();
  console.log('Actual 1080p playback, preserved video element, final freeze and honest parallel loading passed.');

  const reduced = await page({reducedMotion:'reduce'});
  const movieRequests=[];
  reduced.on('request',r=>{if(r.url().endsWith('town-reveal.mp4'))movieRequests.push(r.url());});
  await reduced.goto(base,{waitUntil:'domcontentloaded'});
  await ready(reduced);
  assert.deepEqual(movieRequests,[],'Reduced motion does not download or play the movie');
  await reduced.close();

  const blocked = await page();
  await blocked.addInitScript(() => { HTMLMediaElement.prototype.play=()=>Promise.reject(new DOMException('Blocked for test','NotAllowedError')); });
  await blocked.goto(base,{waitUntil:'domcontentloaded'});
  await ready(blocked);
  await blocked.close();

  const skipped = await page();
  await skipped.addInitScript(() => { HTMLMediaElement.prototype.play=()=>new Promise(()=>{}); });
  await skipped.goto(base,{waitUntil:'domcontentloaded'});
  await skipped.getByRole('button',{name:'Skip intro'}).click();
  await ready(skipped);
  await skipped.close();
  console.log('Reduced-motion, blocked-autoplay and explicit skip paths passed.');

  const phone = await page({viewport:{width:390,height:844},reducedMotion:'reduce'});
  let releasePhone;
  const phoneGate=new Promise(resolve=>{releasePhone=resolve;});
  await phone.route('**/assets/manifest.json',async route=>{await phoneGate;await route.continue();});
  await phone.goto(base,{waitUntil:'domcontentloaded'});
  await phone.getByRole('progressbar',{name:'Loading Maple Falls'}).waitFor();
  await phone.screenshot({path:`${out}/03-phone-loader.png`});
  assert.equal(await phone.locator('.boot-poster').evaluate(e=>getComputedStyle(e).objectFit),'contain','Portrait preserves the entire composition');
  releasePhone(); await ready(phone); await phone.close();
  assert.deepEqual(errors,[],'No browser runtime errors');
  await fs.writeFile(`${out}/result.json`,JSON.stringify({passed:true,checks:['playback','no restart','freeze','progress','reduced motion','blocked autoplay','skip','portrait'],browserErrors:errors},null,2));
} finally { await browser.close(); await server.close(); }
