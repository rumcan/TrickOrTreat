import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// The walkie-talkie tutorial's voice-over: one recording per line of src/game/tutorial-lines.json, made with RUN's
// text-to-speech (`rundot generate tts`) in the saved voice of Professor Fizz, an original character.
//   node scripts/audio/generate-tutorial-voice.mjs <voice-id> [line-id ...]
// Output: public/audio/voice/tutorial-<id>.mp3 (and a .json beside each with the text it was made from).
// Lines that already have a recording of the same text are skipped. RUN rate-limits generation, so each call waits
// and retries.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const GAME = 'AFjPSjQH9kbcCl57sgO3';
const [voice, ...only] = process.argv.slice(2);
if (!voice) { console.error('usage: generate-tutorial-voice.mjs <voice-id> [line-id ...]'); process.exit(1); }
const { lines } = JSON.parse(await fs.readFile(path.join(root, 'src/game/tutorial-lines.json'), 'utf8'));
const out = path.join(root, 'public/audio/voice');
await fs.mkdir(out, { recursive: true });

const run = (args) => new Promise((resolve) => execFile('rundot', args, { shell: true, maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => resolve({ error, text: `${stdout}\n${stderr}` })));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const quote = (s) => `"${s.replace(/"/g, '\\"')}"`;

for (const [id, text] of Object.entries(lines)) {
  if (only.length && !only.includes(id)) continue;
  const file = path.join(out, `tutorial-${id}.mp3`), note = `${file}.json`;
  const made = await fs.readFile(note, 'utf8').then(JSON.parse).catch(() => null);
  if (made?.text === text && made?.voice === voice && await fs.stat(file).then(() => true, () => false)) { console.log(`${id}: up to date`); continue; }
  for (let attempt = 1; ; attempt++) {
    const r = await run(['generate', 'tts', '--game-id', GAME, '--voice-id', voice, '--text', quote(text), '--out', quote(file), '--json']);
    const wait = /retry in (\d+) seconds/i.exec(r.text);
    if (wait && attempt < 8) { console.log(`${id}: rate limited, waiting ${wait[1]}s`); await sleep((Number(wait[1]) + 3) * 1000); continue; }
    if (r.error || !(await fs.stat(file).then((s) => s.size > 2000, () => false))) { console.error(`${id}: FAILED\n${r.text.slice(-600)}`); process.exitCode = 1; break; }
    await fs.writeFile(note, JSON.stringify({ text, voice, speaker: 'Professor Fizz', tool: 'rundot generate tts' }, null, 2) + '\n');
    console.log(`${id}: ok`);
    break;
  }
  await sleep(4000);
}
