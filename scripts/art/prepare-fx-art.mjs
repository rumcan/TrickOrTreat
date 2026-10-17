import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// Demolition effects. The masters in art/new/fx are 4x2 grids of eight frames painted on black; the game wants one
// row of eight 256x256 frames with the black keyed out (dark smoke stays dark, only the backdrop goes).
// Output: public/assets/fx/<key>.webp plus its entry in public/assets/manifest.json.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = path.join(root, 'public/assets/fx');
const COLS = 4, ROWS = 2, CELL = 256;
const SHEETS = { fx_explosion: 'explosion.png', fx_fire: 'fire.png' };

export async function prepareFxArt() {
  await fs.mkdir(output, { recursive: true });
  const manifestFile = path.join(root, 'public/assets/manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestFile, 'utf8'));
  for (const [key, name] of Object.entries(SHEETS)) {
    const { data, info } = await sharp(path.join(root, 'art/new/fx', name)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const rgba = Buffer.alloc(info.width * info.height * 4);
    for (let i = 0, o = 0; i < data.length; i += 3, o += 4) {
      const max = Math.max(data[i], data[i + 1], data[i + 2]);
      rgba[o] = data[i]; rgba[o + 1] = data[i + 1]; rgba[o + 2] = data[i + 2];
      rgba[o + 3] = Math.max(0, Math.min(255, Math.round((max - 20) * (255 / 44)))); // backdrop and its faint grid lines: gone
    }
    const keyed = await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
    const cw = Math.floor(info.width / COLS), ch = Math.floor(info.height / ROWS), frames = [];
    for (let f = 0; f < COLS * ROWS; f++) {
      const cell = await sharp(keyed).extract({ left: (f % COLS) * cw, top: Math.floor(f / COLS) * ch, width: cw, height: ch })
        .resize(CELL, CELL, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
      frames.push({ input: cell, left: f * CELL, top: 0 });
    }
    await sharp({ create: { width: CELL * COLS * ROWS, height: CELL, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite(frames).webp({ quality: 84, alphaQuality: 90, effort: 6 }).toFile(path.join(output, `${key}.webp`));
    manifest.overrides[key] = { file: `fx/${key}.webp`, scale: 2 };
  }
  await fs.writeFile(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Prepared ${Object.keys(SHEETS).length} effect sheets (8 frames of ${CELL}px each).`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await prepareFxArt();
