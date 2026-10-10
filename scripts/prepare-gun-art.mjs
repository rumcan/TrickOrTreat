import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// Card paintings for the guns (level-up and doorstep cards, weapon cards, the vending reel, the full-game showcase).
// Masters live in art/new/guns/<id>.png (1536x1024) and stay untouched; the game ships 960x544 WebP, the same
// 240:136 frame as the treat cards. In-world gun sprites are separate (public/assets, icon_<id>).
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'art/new/guns'), output = path.join(root, 'public/images/guns');
export const GUN_ART_W = 960, GUN_ART_H = 544;

/** bounds of the gun itself: opaque pixels of a cut-out, or everything brighter than the night-blue backdrop */
async function subjectBounds(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const cutout = (await sharp(file).stats()).isOpaque === false;
  let top = info.height, bottom = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * 4;
    const subject = cutout ? data[i + 3] > 40 : 0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2] > 78;
    if (subject) { if (y < top) top = y; if (y > bottom) bottom = y; }
  }
  return { cutout, top, bottom, width: info.width, height: info.height };
}

export async function prepareGunArt() {
  await fs.mkdir(output, { recursive: true });
  const files = (await fs.readdir(source)).filter(f => f.endsWith('.png')).sort();
  for (const name of files) {
    const file = path.join(source, name), id = path.basename(name, '.png');
    const b = await subjectBounds(file);
    // full width, a 240:136 window centred on the gun so nothing tall (slingshot, acorn hopper) is clipped
    const cropH = Math.round(b.width * GUN_ART_H / GUN_ART_W);
    if (b.bottom - b.top > cropH) throw new Error(`${name}: gun is taller than the card frame`);
    const cropTop = Math.max(0, Math.min(b.height - cropH, Math.round((b.top + b.bottom) / 2 - cropH / 2)));
    let image = sharp(file).extract({ left: 0, top: cropTop, width: b.width, height: cropH }).resize(GUN_ART_W, GUN_ART_H);
    if (b.cutout) {
      // a transparent master gets the same backdrop as the painted ones: night-blue vignette plus its own soft glow
      const gun = await image.png().toBuffer();
      const backdrop = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${GUN_ART_W}" height="${GUN_ART_H}"><defs><radialGradient id="g" cx="50%" cy="50%" r="62%"><stop offset="0" stop-color="#152b52"/><stop offset=".55" stop-color="#0a1630"/><stop offset="1" stop-color="#03060e"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`);
      const glow = await sharp(gun).blur(34).ensureAlpha(0.55).png().toBuffer();
      image = sharp(backdrop).composite([{ input: glow, blend: 'screen' }, { input: gun }]);
    }
    await image.webp({ quality: 82, effort: 6 }).toFile(path.join(output, `${id}.webp`));
  }
  console.log(`Prepared ${files.length} gun card paintings at ${GUN_ART_W}x${GUN_ART_H}; masters preserved.`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await prepareGunArt();
