import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';

// One kid from 2D sprite to animated 3D model, using the RUN CLI (each step spends creator credits, ~1,800 per kid):
//   sprite frame -> A-pose reference image -> 3D model -> humanoid rig -> walk clip  =>  art/3d/<id>/walk.glb
// then `node scripts/render-hero-3d.mjs <id>` turns that into the aiming sprite sheet.
//
//   node scripts/make-hero-3d.mjs <hero id> "<look description>" [--model-url <url of an already generated model>]
//
// Run one kid at a time: the service allows only a few jobs at once and answers the rest with "Too Many Requests".
const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [id, look] = process.argv.slice(2);
if (id && !/^(tommy|sam|jess|maya|leo)(_[a-z]+)?$/.test(id)) throw new Error('Invalid character asset id');
const resume = process.argv.indexOf('--model-url') > 0 ? process.argv[process.argv.indexOf('--model-url') + 1] : null;
if (!id || !look) throw new Error('Usage: node scripts/make-hero-3d.mjs <hero id> "<look description>" [--model-url <url>]');
const game = JSON.parse(await fs.readFile(path.join(root, 'game.config.prod.json'), 'utf8')).gameId;
const dir = path.join(root, 'art/3d', id);
await fs.mkdir(dir, { recursive: true });
const rundot = async (...args) => {
  for (let attempt = 1; ; attempt++) {
    try {
      const { stdout, stderr } = await run('rundot', args, { cwd: root, maxBuffer: 1 << 26 });
      return (stdout + stderr).replace(/\r/g, '\n');
    } catch (error) {
      // wait and try again rather than lose the paid steps before this one
      const limited = /rate limited|too many requests/i.test(`${error.stdout ?? ''}${error.stderr ?? ''}`);
      if (!limited || attempt >= 8) throw error;
      await new Promise(resolve => setTimeout(resolve, 45000 + attempt * 15000));
    }
  }
};
const urlIn = text => text.replace(/\n/g, '').match(/Model URL:\s*(https:\/\/\S+?\.glb)/)?.[1];

let model = resume;
if (!model) {
  const existingPose = await fs.readFile(path.join(dir, 'apose.png.json'), 'utf8').then(JSON.parse).catch(() => null);
  let image = existingPose?.imageUrl;
  if (!image) {
  // 1. the first idle frame of the painted sheet is the likeness reference
  const world = path.join(root, 'public/assets/generated/world');
  const sheet = (await fs.readdir(world)).find(f => new RegExp(`^hero_${id}-[0-9a-f]+\\.png$`).test(f));
  if (!sheet) throw new Error(`No painted sheet for ${id}`);
  const meta = await sharp(path.join(world, sheet)).metadata();
  const fw = meta.width / 6, fh = meta.height / 4;
  await sharp(path.join(world, sheet)).extract({ left: 0, top: 0, width: fw, height: fh }).resize(fw * 3, fh * 3, { kernel: 'lanczos3' }).flatten({ background: '#ffffff' }).png().toFile(path.join(dir, 'sprite.png'));

  // 2. a clean A-pose, empty hands: what the 3D generator and the rigger need
  const prompt = `Full-body character reference for 3D modelling of the same kid shown in the reference image: ${look}. Straight-on FRONT view, standing upright in a neutral A-pose with both arms held away from the body at 45 degrees, hands empty and open, feet slightly apart. Same stylised hand-painted cartoon proportions (big head, small body) and colours as the reference. No pumpkin bucket, no props, nothing in the hands. Plain white background, even flat lighting, no shadow on the ground, no text.`;
  await rundot('generate', 'image', '--game-id', game, '--prompt', prompt, '--reference-image', path.join(dir, 'sprite.png'), '--aspect-ratio', '3:4', '--json', '--out', path.join(dir, 'apose.png'));
  image = JSON.parse(await fs.readFile(path.join(dir, 'apose.png.json'), 'utf8')).imageUrl;
  console.log(`${id}: A-pose reference ready`);
  } else console.log(`${id}: reusing existing A-pose reference`);

  // 3. the model
  model = urlIn(await rundot('game', 'generate-3d', '--game-id', game, '--image-url', image, '--quality', 'standard', '--out', path.join(dir, 'model.glb'), '--force'));
  if (!model) throw new Error(`${id}: 3D generation returned no model URL`);
  console.log(`${id}: model ready`);
}

// 4. rig, 5. walk clip
const rigged = await rundot('game', 'rig-3d', '--game-id', game, '--model-url', model, '--out', path.join(dir, 'rigged.glb'), '--force');
const rig = rigged.match(/Rig ID:\s*([0-9a-f-]{36})/)?.[1];
if (!rig) throw new Error(`${id}: rigging failed\n${rigged.slice(-600)}`);
console.log(`${id}: rig ${rig}`);
let clip = '';
for (let attempt = 1; attempt <= 3 && !clip; attempt++) { // the animation service fails now and then; a retry is enough
  try {
    await rundot('game', 'animate-3d', '--game-id', game, '--rig-id', rig, '--animations', 'walk', '--out-dir', dir, '--force');
  } catch (error) {
    if (/AI_POLICY_BUDGET_EXHAUSTED/.test(`${error.stdout ?? ''}${error.stderr ?? ''}`)) {
      console.log(`${id}: RUN policy budget rejected animation; preserved rig for local keyframe rendering`);
      break;
    }
    if (attempt === 3) console.log(`${id}: animation unavailable; preserved rig for local keyframe rendering`);
  }
  clip = (await fs.readdir(dir)).find(f => /walk.*\.glb$/i.test(f) && f !== 'walk.glb') || '';
}
if (!clip) {
  console.log(`${id}: run node scripts/render-hero-3d.mjs ${id} to render the rig with a local walk`);
  process.exit(0);
}
await fs.rename(path.join(dir, clip), path.join(dir, 'walk.glb'));
// Preserve paid model/rig masters for rerendering and recovery.
console.log(`${id}: art/3d/${id}/walk.glb ready`);
