import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { cutIconSheet } from '../lib/icon-sheet.mjs';

// Card art (960x544, the treat-card frame at 4x) for treats added after the generated set:
//  · the pocket-size common treats use the retro icons of art/new/tallets_icon2.png on a dark neon backdrop
//  · the extreme full-game treats use full paintings in art/new/treats/<id>.png
// Output: public/assets/treats/<id>.webp plus a `treatart_<id>` entry in public/assets/manifest.json.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = path.join(root, 'public/assets/treats');
const W = 960, H = 544;
/** tallets_icon2.png, row by row; null = not used by a treat (yet) */
const SHEET = [
  [null, 'mixtape', 'batteries', null, null],
  [null, null, 'token', 'masher', 'skates'],
  ['griptape', null, 'yoyo', null, 'cartoons'],
  [null, 'denim', null, null, null], // the sneaker is left out: it carries a real brand's logo
  ['lunchmoney', null, null, 'slurp', 'longshot'],
];
const GLOW = { longshot: '#b44dff', mixtape: '#ff4d6d', batteries: '#ffb43c', token: '#b44dff', masher: '#21d0ff', skates: '#ff2ea6', yoyo: '#ff4d6d', cartoons: '#7fd8ff', denim: '#4f8aff', griptape: '#ffe14a', lunchmoney: '#ffb43c', slurp: '#2ec4b0' };

export async function prepareTreatArt() {
  await fs.mkdir(output, { recursive: true });
  const made = [];
  const cuts = await cutIconSheet(path.join(root, 'art/new/tallets_icon2.png'), 5, 5);
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
    const id = SHEET[r][c];
    if (!id) continue;
    const icon = await sharp(cuts[r][c]).resize(W - 260, H - 110, { fit: 'inside' }).png().toBuffer();
    const meta = await sharp(icon).metadata(), left = Math.round((W - meta.width) / 2), top = Math.round((H - meta.height) / 2);
    const backdrop = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs>
      <radialGradient id="g" cx="50%" cy="52%" r="62%"><stop offset="0" stop-color="${GLOW[id]}" stop-opacity=".55"/><stop offset=".45" stop-color="#1a1230"/><stop offset="1" stop-color="#07060d"/></radialGradient>
      <pattern id="s" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#000" opacity=".22"/></pattern></defs>
      <rect width="100%" height="100%" fill="#07060d"/><rect width="100%" height="100%" fill="url(#g)"/><rect width="100%" height="100%" fill="url(#s)"/></svg>`);
    const halo = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: icon, left, top }]).blur(26).png().toBuffer();
    await sharp(backdrop).composite([{ input: halo, blend: 'screen' }, { input: icon, left, top }]).webp({ quality: 86, effort: 6 }).toFile(path.join(output, `${id}.webp`));
    made.push(id);
  }
  const paintings = path.join(root, 'art/new/treats');
  for (const file of (await fs.readdir(paintings).catch(() => [])).filter(f => f.endsWith('.png')).sort()) {
    const id = path.basename(file, '.png');
    await sharp(path.join(paintings, file)).resize(W, H, { fit: 'cover', position: 'centre' }).webp({ quality: 84, effort: 6 }).toFile(path.join(output, `${id}.webp`));
    made.push(id);
  }
  const manifestFile = path.join(root, 'public/assets/manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestFile, 'utf8'));
  for (const id of made) manifest.overrides[`treatart_${id}`] = { file: `treats/${id}.webp`, scale: 4, anchor: [W / 2, H / 2] };
  await fs.writeFile(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Prepared ${made.length} treat cards: ${made.join(', ')}`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await prepareTreatArt();
