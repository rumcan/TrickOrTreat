#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
import { digest, inside, readJson, writeJson, checkSpec, promptFor, packPng, validatePacked, pngPixels } from './lib/world-art.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const work = path.join(root, 'art/world');
const queuePath = path.join(work, 'queue.json');
const manifestPath = path.join(root, 'public/assets/manifest.json');
const command = process.argv[2] ?? 'help';
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  if (i < 0) return fallback;
  if (!process.argv[i + 1] || process.argv[i + 1].startsWith('--')) throw new Error(`${name} needs a value`);
  return process.argv[i + 1];
};
const flag = (name) => process.argv.includes(name);
const exists = async (name) => fs.access(name).then(() => true, () => false);

async function queue() {
  const q = await readJson(queuePath).catch(() => { throw new Error('Run npm run art:world:prepare first'); });
  const style = await readJson(path.join(work, 'style.json'));
  const referenceHash = digest(await fs.readFile(inside(root, style.reference)));
  if (q.styleHash !== digest(JSON.stringify(style)) || q.referenceHash !== referenceHash) throw new Error('Style reference/config changed; prepare the queue again');
  return q;
}
function jobFor(q, key = arg('--key')) {
  const job = q.jobs.find((x) => x.key === key);
  if (!job) throw new Error(`Unknown world asset: ${key ?? '(provide --key)'}`);
  checkSpec(job.spec);
  return job;
}

async function prepare() {
  const scale = Number(arg('--scale', '4'));
  if (!Number.isInteger(scale) || scale < 1 || scale > 4) throw new Error('--scale must be 1, 2, 3 or 4');
  const style = await readJson(path.join(work, 'style.json'));
  const referenceHash = digest(await fs.readFile(inside(root, style.reference)));
  if (!flag('--offline')) {
    const result = spawnSync(process.execPath, [path.join(root, 'scripts/regen-art-dump.mjs'), ...(flag('--all') ? [] : ['--world']), '--scale', String(scale), '--url', arg('--url', 'http://127.0.0.1:5173/'), '--out', 'art/world/atlas.json'], { cwd: root, stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error('Atlas export failed; start npm run dev or use --offline after a successful export');
  }
  const atlas = await readJson(path.join(work, 'atlas.json'));
  let prior = { jobs: [] };
  if (await exists(queuePath)) prior = await readJson(queuePath);
  const styleHash = digest(JSON.stringify(style));
  const jobs = [];
  const requested = arg('--keys')?.split(',');
  for (const entry of atlas.filter((s) => flag('--all') || style.scope.includes(s.category))) {
    const { render, renderScale, ...spec } = entry;
    checkSpec(spec);
    if (requested && !requested.includes(spec.key)) {
      const saved = prior.jobs.find(j => j.key === spec.key);
      if (saved && prior.styleHash === styleHash && prior.referenceHash === referenceHash && saved.outputScale === scale && JSON.stringify(saved.spec) === JSON.stringify(spec)) { jobs.push(saved); continue; }
      if (saved) throw new Error(`Unselected ${spec.key} has changed specifications; include it in --keys`);
    }
    const template = `art/world/layout/${spec.key}.png`;
    const promptFile = `art/world/prompts/${spec.key}.txt`;
    await fs.mkdir(path.dirname(inside(root, template)), { recursive: true });
    let templateBytes = Buffer.from(render, 'base64');
    let generationGrid;
    if (spec.category === 'sheet' && spec.rows.length === 1) {
      const count = spec.rowFrames[0], cols = count === 4 ? 2 : 3;
      generationGrid = [cols, Math.ceil(count / cols)];
      const fw = spec.frameW * renderScale, fh = spec.frameH * renderScale, layers = [];
      for (let f = 0; f < count; f++) layers.push({ input: await sharp(templateBytes).extract({ left: f * fw, top: 0, width: fw, height: fh }).png().toBuffer(), left: (f % cols) * fw, top: Math.floor(f / cols) * fh });
      templateBytes = await sharp({ create: { width: cols * fw, height: generationGrid[1] * fh, channels: 4, background: '#00000000' } }).composite(layers).png().toBuffer();
    }
    await fs.writeFile(inside(root, template), templateBytes);
    const prompt = promptFor(spec, style, scale, generationGrid);
    await fs.mkdir(path.dirname(inside(root, promptFile)), { recursive: true });
    await fs.writeFile(inside(root, promptFile), prompt);
    const fingerprint = digest(JSON.stringify({ spec, styleHash, referenceHash, scale, templateHash: digest(Buffer.from(render, 'base64')) }));
    const old = prior.jobs.find((j) => j.key === spec.key && j.fingerprint === fingerprint);
    jobs.push({ key: spec.key, spec, fingerprint, promptFile, references: [style.reference, template], outputScale: scale, layoutScale: renderScale ?? 1, ...(generationGrid ? { generationGrid } : {}), status: old?.status ?? 'pending', ...(old?.execution ? { execution: old.execution } : {}), ...(old?.generatedFile ? { generatedFile: old.generatedFile } : {}), ...(old?.result ? { result: old.result } : {}) });
  }
  jobs.sort((a, b) => {
    const priority = (j) => { const n = style.priority.indexOf(j.key); return n < 0 ? style.priority.length : n; };
    return priority(a) - priority(b) || a.key.localeCompare(b.key);
  });
  await writeJson(queuePath, { version: 1, generatedAt: new Date().toISOString(), generator: 'built-in image_gen (agent executed)', styleHash, referenceHash, jobs });
  console.log(`Prepared ${jobs.length} world assets; queue: art/world/queue.json`);
  console.log('Run npm run art:world -- next to display the next prompt and reference paths.');
}

async function stage(key = arg('--key'), input = arg('--input')) {
  const q = await queue(), job = jobFor(q, key);
  if (!input) throw new Error('Provide --input PATH to a generated PNG');
  const raw = await fs.readFile(path.resolve(root, input));
  const anchor = arg('--source-anchor')?.split(',').map(Number);
  const packed = await packPng(raw, job.spec, job.outputScale, anchor, job.generationGrid, flag('--align-grid'), flag('--trim-tile'), flag('--clear-unused'));
  await validatePacked(packed.packed, job.spec, job.outputScale);
  const id = digest(packed.packed).slice(0, 16);
  const rawFile = `art/world/raw/${job.key}-${digest(raw).slice(0, 16)}.png`;
  const stagedFile = `art/world/staged/${job.key}-${id}.png`;
  for (const [filename, buffer] of [[rawFile, raw], [stagedFile, packed.packed]]) {
    await fs.mkdir(path.dirname(inside(root, filename)), { recursive: true });
    if (!(await exists(inside(root, filename)))) await fs.writeFile(inside(root, filename), buffer);
  }
  const actualPromptFile = arg('--prompt-file', job.execution?.promptFile ?? job.promptFile);
  const actualPrompt = await fs.readFile(inside(root, actualPromptFile));
  const savedPromptFile = `${rawFile}.prompt.txt`;
  await fs.writeFile(inside(root, savedPromptFile), actualPrompt);
  job.status = 'staged';
  job.result = { id, rawFile, stagedFile, savedPromptFile, generator: 'built-in image_gen', sourceHash: digest(raw), packedHash: digest(packed.packed), promptHash: digest(actualPrompt), referenceHash: q.referenceHash, styleHash: q.styleHash, sourceSize: packed.sourceSize, outputSize: packed.outputSize, sourceAnchor: packed.sourceAnchor, ...(packed.gridAlignment ? { gridAlignment: packed.gridAlignment } : {}), ...(packed.tileTrim ? { tileTrim: packed.tileTrim } : {}), importedAt: new Date().toISOString(), fingerprint: job.fingerprint };
  await writeJson(`${inside(root, stagedFile)}.json`, job.result);
  await writeJson(queuePath, q);
  await preview(job);
  console.log(`Staged ${job.key}: ${stagedFile}. Review art/world/checks/${job.key}.png, then activate.`);
}

async function preview(job) {
  const [w, h] = [job.spec.w, job.spec.h];
  const guide = inside(root, job.references[1]);
  const generated = inside(root, job.result.stagedFile);
  const guidePreview = job.generationGrid ? (await packPng(await fs.readFile(guide), job.spec, 1, undefined, job.generationGrid)).packed : await sharp(guide).resize(w, h).toBuffer();
  const ax = job.spec.anchor?.[0] ?? w / 2, ay = job.spec.anchor?.[1] ?? h / 2;
  const bg = Buffer.from(`<svg width="${w * 2}" height="${h}"><defs><pattern id="c" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="#1a2130"/><path d="M0 0h8v8H0z M8 8h8v8H8z" fill="#273043"/></pattern></defs><rect width="100%" height="100%" fill="url(#c)"/></svg>`);
  const mark = Buffer.from(`<svg width="${w * 2}" height="${h}"><g stroke="#ff40cc" stroke-width="1" fill="none"><path d="M${ax - 8} ${ay}h16 M${ax} ${ay - 8}v16 M${w + ax - 8} ${ay}h16 M${w + ax} ${ay - 8}v16"/></g></svg>`);
  const canvas = await sharp(bg).composite([{ input: guidePreview, left: 0, top: 0 }, { input: await sharp(generated).resize(w, h).toBuffer(), left: w, top: 0 }, { input: mark }]).png().toBuffer();
  const filename = path.join(work, 'checks', `${job.key}.png`);
  await fs.mkdir(path.dirname(filename), { recursive: true });
  await fs.writeFile(filename, canvas);
  if (job.spec.category === 'tile') {
    // Nine contiguous diamonds expose repeat seams at native game resolution.
    const tile = await sharp(generated).resize(w, h).toBuffer();
    const layers = [];
    for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) layers.push({ input: tile, left: (x - y + 2) * w / 2, top: (x + y) * h / 2 });
    await sharp({ create: { width: 3 * w, height: 3 * h, channels: 4, background: '#182332' } }).composite(layers).png().toFile(path.join(work, 'checks', `${job.key}-repeat.png`));
  }
}

async function activate(key = arg('--key')) {
  const q = await queue(), job = jobFor(q, key);
  if (job.status !== 'staged' || !job.result) throw new Error('Import and review the asset before activating');
  const png = await fs.readFile(inside(root, job.result.stagedFile));
  if (digest(png) !== job.result.packedHash || job.result.fingerprint !== job.fingerprint) throw new Error('Staged asset or specifications changed; import again');
  await validatePacked(png, job.spec, job.outputScale);
  const manifest = await readJson(manifestPath);
  manifest.overrides ??= {};
  const file = `generated/world/${job.key}-${job.result.id}.png`;
  const destination = inside(path.join(root, 'public/assets'), file);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  if (await exists(destination)) {
    if (digest(await fs.readFile(destination)) !== job.result.packedHash) throw new Error('Existing generated filename has different contents');
  } else await fs.writeFile(destination, png);
  const previous = manifest.overrides[job.key] ?? null;
  const override = { file, scale: job.outputScale, ...(job.spec.anchor ? { anchor: job.spec.anchor.map((x) => x * job.outputScale) } : {}) };
  const activationFile = `art/world/activations/${job.key}-${Date.now()}.json`;
  await writeJson(inside(root, activationFile), { key: job.key, previous, override, result: job.result, activatedAt: new Date().toISOString() });
  manifest.overrides[job.key] = override;
  await writeJson(manifestPath, manifest);
  job.status = 'active';
  job.result.activationFile = activationFile;
  job.result.gameFile = file;
  await writeJson(`${destination}.json`, { key: job.key, spec: job.spec, ...job.result, prompt: await fs.readFile(inside(root, job.result.savedPromptFile), 'utf8'), references: job.references, styleReferenceHash: q.referenceHash });
  await writeJson(queuePath, q);
  console.log(`Activated ${job.key}: public/assets/${file}. Reload the game. Previous override saved in ${activationFile}.`);
}

async function restore() {
  const q = await queue(), job = jobFor(q);
  if (job.status !== 'active') throw new Error('Asset is not active in this queue');
  const activation = await readJson(inside(root, job.result.activationFile));
  const manifest = await readJson(manifestPath);
  if (JSON.stringify(manifest.overrides[job.key]) !== JSON.stringify(activation.override)) throw new Error('Manifest entry changed since activation; restore manually to preserve newer edits');
  if (activation.previous === null) delete manifest.overrides[job.key];
  else manifest.overrides[job.key] = activation.previous;
  await writeJson(manifestPath, manifest);
  job.status = 'staged';
  await writeJson(queuePath, q);
  console.log(`Restored previous ${job.key} override; versioned artwork kept.`);
}

async function validate() {
  const q = await queue(), manifest = await readJson(manifestPath);
  let checked = 0, failed = 0;
  for (const job of q.jobs.filter((j) => j.result)) {
    try {
      const png = await fs.readFile(inside(root, job.result.stagedFile));
      if (digest(png) !== job.result.packedHash || job.fingerprint !== job.result.fingerprint) throw new Error('hash/spec mismatch');
      await validatePacked(png, job.spec, job.outputScale);
      if (job.status === 'active') {
        const actual = manifest.overrides[job.key];
        const expected = (await readJson(inside(root, job.result.activationFile))).override;
        if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('manifest entry differs from activation');
        if (digest(await fs.readFile(inside(path.join(root, 'public/assets'), job.result.gameFile))) !== job.result.packedHash) throw new Error('game PNG hash mismatch');
      }
      checked++;
    } catch (error) { failed++; console.error(`${job.key}: ${error.message}`); }
  }
  console.log(`Validated ${checked} packed assets; ${q.jobs.filter((j) => !j.result).length} pending; ${failed} failed.`);
  if (failed) process.exitCode = 1;
  if (flag('--browser') && !failed) {
    const { chromium } = await import('playwright-core');
    const browser = await chromium.launch({ channel: 'msedge' });
    try {
      const page = await browser.newPage({ viewport: { width: 1680, height: 945 } });
      const assetWarnings = [];
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      page.on('console', (message) => { if (message.text().includes('[assets] override failed')) assetWarnings.push(message.text()); });
      const url = new URL(arg('--url', 'http://127.0.0.1:5173/'));
      url.searchParams.set('export', '');
      await page.goto(url.href);
      await page.waitForFunction(() => window.__totRegen, null, { timeout: 120000 });
      const active = q.jobs.filter((j) => j.status === 'active');
      const entries = await page.evaluate(async (keys) => {
        const { allAssets } = await import('/src/game/assets.ts');
        return allAssets().filter((e) => keys.includes(e.spec.key)).map((e) => ({ key: e.spec.key, file: e.file, w: e.w, h: e.h, anchor: e.anchor, scale: e.scale, rowFrames: e.rowFrames }));
      }, active.map((j) => j.key));
      for (const job of active) {
        const e = entries.find((a) => a.key === job.key);
        if (!e || e.file !== job.result.gameFile || e.w !== job.spec.w || e.h !== job.spec.h || (job.spec.anchor && e.anchor.some((x, i) => x !== job.spec.anchor[i]))) throw new Error(`${job.key}: runtime dimensions/anchor/override differ from atlas`);
        if (job.spec.category === 'sheet' && JSON.stringify(e.rowFrames) !== JSON.stringify(job.spec.rowFrames)) throw new Error(`${job.key}: runtime animation counts differ from atlas`);
      }
      if (assetWarnings.length) throw new Error(assetWarnings.join('\n'));
      console.log(`Browser verified ${active.length} active overrides through the game loader.`);
      if (flag('--scene')) {
        await page.getByRole('button', { name: 'Go trick-or-treating', exact: true }).click();
        await page.waitForFunction(() => window.__tot?.game.time > 2, null, { timeout: 30000 });
        const screenshot = path.join(work, 'checks/gameplay.png');
        await fs.mkdir(path.dirname(screenshot), { recursive: true });
        await page.screenshot({ path: screenshot });
        console.log(`Gameplay rendered: ${path.relative(root, screenshot)}`);
      }
      if (pageErrors.length) throw new Error(pageErrors.join('\n'));
    } finally { await browser.close(); }
  }
}

async function main() {
  if (command === 'measure') {
    const q = await queue(), job = jobFor(q);
    const input = arg('--input', job.generatedFile ?? job.result?.rawFile);
    const { info, data, bounds } = await pngPixels(await fs.readFile(path.resolve(root, input)));
    let coreHoles = 0, edgeHoles = 0;
    const examples = [];
    if (job.spec.category === 'tile') for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      const d = Math.abs((x + 0.5 - info.width / 2) / (info.width / 2)) + Math.abs((y + 0.5 - info.height / 2) / (info.height / 2));
      if (d < 0.95 && data[(y * info.width + x) * 4 + 3] < 240) {
        if (d < 0.8) coreHoles++; else edgeHoles++;
        if (examples.length < 8) examples.push([x, y, data[(y * info.width + x) * 4 + 3]]);
      }
    }
    console.log(JSON.stringify({ key: job.key, size: [info.width, info.height], bounds, spec: job.spec, coreHoles, edgeHoles, examples }));
    return;
  }
  if (command === 'activate-batch') {
    for (const key of (arg('--keys') ?? '').split(',').filter(Boolean)) await activate(key);
    return;
  }
  if (command === 'receive') {
    const encoded = arg('--records-base64');
    const records = JSON.parse(encoded ? Buffer.from(encoded, 'base64').toString('utf8') : arg('--records', '[]'));
    for (const { key, input } of records) {
      const q = await queue(), job = jobFor(q, key);
      const raw = await fs.readFile(path.resolve(root, input));
      if (job.status === 'active' && job.result?.sourceHash === digest(raw)) { console.log(`Already active: ${key}`); continue; }
      const filename = `art/world/raw/${job.key}-${digest(raw).slice(0, 16)}.png`;
      await fs.mkdir(path.dirname(inside(root, filename)), { recursive: true });
      if (!(await exists(inside(root, filename)))) await fs.writeFile(inside(root, filename), raw);
      job.generatedFile = filename;
      job.status = 'generated';
      await writeJson(queuePath, q);
      try { await stage(key, filename); } catch (error) { console.error(`IMPORT_FAILED ${key}: ${error.message}`); }
    }
    return;
  }
  if (command === 'contact') {
    const q = await queue();
    const keys = arg('--keys')?.split(',');
    const selected = q.jobs.filter((j) => (!keys || keys.includes(j.key)) && (j.generatedFile || j.result)).slice(0, 16);
    if (!selected.length) throw new Error('No generated art to preview');
    const cellW = 420, cellH = 460, cols = Math.min(3, selected.length), rows = Math.ceil(selected.length / cols);
    const layers = [];
    for (let i = 0; i < selected.length; i++) {
      const job = selected[i];
      const source = job.spec.category === 'sheet' ? (job.generatedFile ?? job.result.rawFile) : (job.result?.stagedFile ?? job.generatedFile);
      const thumbnail = await sharp(inside(root, source)).resize(cellW - 24, cellH - 52, { fit: 'contain', background: '#00000000' }).png().toBuffer();
      layers.push({ input: thumbnail, left: (i % cols) * cellW + 12, top: Math.floor(i / cols) * cellH + 38 });
    }
    const names = selected.map((j, i) => `<text x="${(i % cols) * cellW + 12}" y="${Math.floor(i / cols) * cellH + 25}" fill="#ffd080" font-family="sans-serif" font-size="18">${j.key} (${j.status})</text>`).join('');
    const bg = Buffer.from(`<svg width="${cols * cellW}" height="${rows * cellH}"><defs><pattern id="c" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="#182232"/><path d="M0 0h10v10H0z M10 10h10v10H10z" fill="#223044"/></pattern></defs><rect width="100%" height="100%" fill="url(#c)"/>${names}</svg>`);
    const file = path.join(work, 'checks', 'current-batch.png');
    await fs.mkdir(path.dirname(file), { recursive: true });
    await sharp(bg).composite(layers).png().toFile(file);
    console.log(file);
    return;
  }
  if (command === 'batch') {
    const q = await queue();
    const limit = Number(arg('--limit', '4'));
    const keys = arg('--keys')?.split(',');
    const candidates = q.jobs.filter((j) => j.status === 'pending' && (keys || !j.execution) && (!keys || keys.includes(j.key)) && (!arg('--category') || j.spec.category === arg('--category'))).slice(0, limit);
    const payloads = [];
    for (const job of candidates) {
      const references = [...job.references];
      let prompt = await fs.readFile(inside(root, job.promptFile), 'utf8');
      if (job.spec.category === 'tile') prompt += '\nSOLID TERRAIN: the diamond interior is one fully opaque surface. Render opaque soil/lawn under every blade and pebble, with absolutely no alpha gaps between details. Extend the solid diamond to all four canvas midpoints with zero surrounding padding. Alpha is only outside the diamond.\n';
      const match = /^hero_(tommy|sam|jess|maya|leo)_/.exec(job.key);
      if (match) {
        const base = q.jobs.find((j) => j.key === `hero_${match[1]}`);
        if (base?.result) {
          references.push(base.status === 'active' ? `public/assets/${base.result.gameFile}` : base.result.stagedFile);
          prompt += '\nImage 3 is CHARACTER IDENTITY reference: preserve this kid\'s face, hair, skin, body proportions and painted rendering. Change only the specified Halloween costume. Follow Image 2 for costume silhouette and animation layout.\n';
        }
      }
      const promptFile = `art/world/prompts/${job.key}.generation.txt`;
      await fs.writeFile(inside(root, promptFile), prompt);
      job.execution = { references, promptFile };
      payloads.push({ key: job.key, prompt, transparent_background: true, referenced_image_paths: references.map((f) => inside(root, f)) });
    }
    await writeJson(queuePath, q);
    console.log(JSON.stringify(payloads));
    return;
  }
  if (command === 'capture') {
    const q = await queue(), job = jobFor(q);
    const input = arg('--input');
    if (!input) throw new Error('Provide --input for the generator output');
    const raw = await fs.readFile(path.resolve(root, input));
    const filename = `art/world/raw/${job.key}-${digest(raw).slice(0, 16)}.png`;
    await fs.mkdir(path.dirname(inside(root, filename)), { recursive: true });
    if (!(await exists(inside(root, filename)))) await fs.writeFile(inside(root, filename), raw);
    job.generatedFile = filename;
    job.status = 'generated';
    await writeJson(queuePath, q);
    console.log(filename);
    return;
  }
  if (command === 'generated') {
    const q = await queue();
    console.log(JSON.stringify(q.jobs.filter((j) => j.status === 'generated').map((j) => ({ key: j.key, input: j.generatedFile }))));
    return;
  }
  if (command === 'prepare') return prepare();
  if (command === 'import') return stage();
  if (command === 'activate') return activate();
  if (command === 'restore') return restore();
  if (command === 'validate') return validate();
  if (command === 'next' || command === 'prompt') {
    const q = await queue();
    const job = command === 'next' ? q.jobs.find((j) => j.status === 'pending') : jobFor(q);
    if (!job) return console.log('All queued assets have been imported.');
    console.log(JSON.stringify({ key: job.key, status: job.status, transparent_background: true, referenced_image_paths: job.references.map((f) => inside(root, f)), prompt: await fs.readFile(inside(root, job.promptFile), 'utf8'), import: `npm run art:world -- import --key ${job.key} --input <generated.png>` }, null, 2));
    return;
  }
  if (command === 'status') {
    const q = await queue();
    const summary = {};
    for (const j of q.jobs) { summary[j.spec.category] ??= { pending: 0, generated: 0, staged: 0, active: 0 }; summary[j.spec.category][j.status]++; }
    console.table(summary);
    return;
  }
  if (command !== 'help') throw new Error(`Unknown command: ${command}`);
  console.log('World artwork pipeline (built-in image generator, no API key):\n  prepare [--url URL] [--scale 4] [--offline]\n  next | prompt --key KEY | status\n  import --key KEY --input PNG [--source-anchor X,Y] [--prompt-file PATH]\n  activate --key KEY | restore --key KEY | validate [--browser] [--url URL]\nSee art/world/README.md for the generation and review workflow.');
}
async function run() {
  const mutating = ['prepare', 'batch', 'receive', 'capture', 'import', 'activate', 'activate-batch', 'restore'].includes(command);
  let lock;
  const lockFile = path.join(work, '.pipeline.lock');
  if (mutating) {
    await fs.mkdir(work, { recursive: true });
    const started = Date.now();
    for (;;) {
      try { lock = await fs.open(lockFile, 'wx'); break; }
      catch (error) {
        if (error.code !== 'EEXIST') throw error;
        if (Date.now() - started > 60000) throw new Error('Another artwork command is still writing the queue');
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  }
  try { await main(); } finally { if (lock) { await lock.close(); await fs.unlink(lockFile); } }
}
run().catch((error) => { console.error(error.message); process.exitCode = 1; });
