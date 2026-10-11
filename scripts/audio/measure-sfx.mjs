import fs from 'node:fs';
import { chromium } from 'playwright-core';

// How loud is each generated sound, and when does it start? The generator returns recordings at any level, some of
// them silent. Run against a dev server:  node scripts/audio/measure-sfx.mjs [http://127.0.0.1:5173/]
// Prints one line per public/audio/sfx/{top,gun}-*.mp3 and exits 1 when a recording is too quiet to use.
const url = process.argv[2] || 'http://127.0.0.1:5173/';
const files = fs.readdirSync('public/audio/sfx').filter(f => f.endsWith('.mp3') && (f.startsWith('gun-') || f.startsWith('top-')));
const browser = await chromium.launch({ channel: 'msedge' });
try {
  const page = await browser.newPage();
  await page.goto(url);
  const out = await page.evaluate(async (files) => {
    const ctx = new OfflineAudioContext(1, 44100, 44100), res = [];
    for (const f of files) {
      const buf = await ctx.decodeAudioData(await (await fetch(`audio/sfx/${f}?t=${Date.now()}`)).arrayBuffer());
      const d = buf.getChannelData(0); let peak = 0;
      for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
      let first = 0, last = 0;
      for (let i = 0; i < d.length; i++) if (Math.abs(d[i]) > peak * 0.12) { if (!first) first = i; last = i; }
      res.push({ f, seconds: +buf.duration.toFixed(2), peak: +peak.toFixed(3), starts: +(first / buf.sampleRate).toFixed(2), ends: +(last / buf.sampleRate).toFixed(2) });
    }
    return res;
  }, files);
  let bad = 0;
  for (const r of out) { const quiet = r.peak < 0.05; if (quiet) bad++; console.log(`${r.f.padEnd(24)} ${String(r.seconds).padEnd(5)}s peak ${String(r.peak).padEnd(6)} sound ${r.starts}-${r.ends}s${quiet ? '   <-- TOO QUIET' : ''}`); }
  console.log(`${out.length} recordings, ${bad} too quiet`);
  process.exitCode = bad ? 1 : 0;
} finally { await browser.close(); }
