import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await fs.readFile(path.join(root, 'src/game/sound/manifest.json'), 'utf8'));
const cli = process.env.RUNDOT_CLI ?? (process.platform === 'win32' ? path.join(process.env.LOCALAPPDATA, 'Programs/Rundot/rundot.exe') : 'rundot');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cli, args, { cwd: root, windowsHide: true, env: { ...process.env, DOTNET_SYSTEM_GLOBALIZATION_INVARIANT: '1' } });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; process.stdout.write(chunk); });
    child.stderr.on('data', (chunk) => { output += chunk; process.stderr.write(chunk); });
    child.on('error', reject); child.on('exit', (code) => resolve({ code, output }));
  });
}
let failed = 0;
for (const sound of manifest.sfx) {
  const out = path.join(root, 'public/audio/sfx', `${sound.id}.mp3`);
  if (await fs.stat(out).then((s) => s.size > 100, () => false)) { console.log(`Kept ${sound.id}`); continue; }
  await fs.mkdir(path.dirname(out), { recursive: true });
  let complete = false;
  for (let attempt = 0; attempt < 5; attempt++) {
    console.log(`Generating ${sound.id} (${sound.duration}s)`);
    const result = await run(['generate', 'sfx', '--game-id', 'AFjPSjQH9kbcCl57sgO3', '--description', sound.prompt, '--duration', String(sound.duration), '--out', out, '--json']);
    if (result.code === 0 && await fs.stat(out).then((s) => s.size > 100, () => false)) { complete = true; break; }
    const retry = /retry in (\d+) seconds?/i.exec(result.output);
    if (!retry) break;
    let remaining = (Number(retry[1]) + 2) * 1000;
    while (remaining > 0) { console.log(`Rate limit: ${Math.ceil(remaining / 1000)} seconds remaining`); const interval = Math.min(remaining, 30000); await delay(interval); remaining -= interval; }
  }
  if (!complete) { failed++; console.error(`Sound failed: ${sound.id}`); }
}
console.log(`${manifest.sfx.length - failed}/${manifest.sfx.length} sounds available`);
if (failed) process.exitCode = 1;
