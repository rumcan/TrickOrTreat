import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// The bright layer of the sound effects (src/game/sound/top-layer.json), made with RUN's `rundot generate sfx`.
// Each one is layered over the original deep recording of the same name when the game plays it.
//   node scripts/audio/generate-sfx-top.mjs [id ...]
// Output: public/audio/sfx/top-<id>.mp3 (and a .json beside each with the prompt it was made from).
// A sound whose prompt and length have not changed is skipped. RUN rate-limits generation: each call waits and retries.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const GAME = 'AFjPSjQH9kbcCl57sgO3';
const only = process.argv.slice(2);
const layer = JSON.parse(await fs.readFile(path.join(root, 'src/game/sound/top-layer.json'), 'utf8'));
// the effect layers (top-<id>.mp3) and one quiet shot per gun (gun-<id>.mp3); name a gun as gun-<id> on the command line
const sounds = [...layer.sounds.map((s) => ({ ...s, file: `top-${s.id}` })), ...layer.guns.map((s) => ({ ...s, file: `gun-${s.id}` }))];
const out = path.join(root, 'public/audio/sfx');

const run = (args) => new Promise((resolve) => execFile('rundot', args, { shell: true, maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => resolve({ error, text: `${stdout}\n${stderr}` })));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const quote = (s) => `"${s.replace(/"/g, '\\"')}"`;

for (const { file: name, prompt, duration } of sounds) {
  const id = name;
  if (only.length && !only.includes(name) && !only.includes(name.replace(/^top-/, ''))) continue;
  const file = path.join(out, `${name}.mp3`), note = `${file}.json`;
  const made = await fs.readFile(note, 'utf8').then(JSON.parse).catch(() => null);
  if (made?.prompt === prompt && made?.durationSec === duration && await fs.stat(file).then(() => true, () => false)) { console.log(`${id}: up to date`); continue; }
  for (let attempt = 1, form = 0; ; attempt++) {
    // The CLI reads numbers in the machine's own format: where that uses a decimal comma, "0.5" is refused and "0,5"
    // is right. Try the comma form after a refusal, and no length at all as the last resort.
    const length = form === 0 ? String(duration) : form === 1 ? String(duration).replace('.', ',') : null;
    const r = await run(['generate', 'sfx', '--game-id', GAME, '--description', quote(prompt), ...(length ? ['--duration', length] : []), '--out', quote(file), '--json']);
    if (/Cannot parse argument/.test(r.text) && form < 2) { form++; continue; }
    const wait = /retry in (\d+) seconds/i.exec(r.text);
    if (wait && attempt < 10) { console.log(`${id}: rate limited, waiting ${wait[1]}s`); await sleep((Number(wait[1]) + 3) * 1000); continue; }
    if (r.error || !(await fs.stat(file).then((s) => s.size > 1500, () => false))) { console.error(`${id}: FAILED\n${r.text.slice(-500)}`); process.exitCode = 1; break; }
    await fs.writeFile(note, JSON.stringify({ prompt, type: 'sfx', durationSec: duration, layer: name.startsWith('gun-') ? 'gun' : 'top', tool: 'rundot generate sfx' }, null, 2) + '\n');
    console.log(`${id}: ok`);
    break;
  }
  await sleep(4000);
}
