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
/** masters painted facing left: mirrored so every gun points right */
const FLIP = new Set(['lance']);
/**
 * Cut-out masters also become the in-world sprite (256x128, the hand at pixel 64,80). The value is where the hand holds
 * the gun, as a fraction of the gun's own bounding box.
 */
const GRIP = {
  stream: [0.17, 0.78], disc: [0.2, 0.55], sabre: [0.1, 0.5], glaive: [0.32, 0.5], swarm: [0.3, 0.88], singularity: [0.2, 0.8],
  annihilator: [0.24, 0.85], incinerator: [0.26, 0.56], lance: [0.3, 0.78], cryo: [0.2, 0.85],
};
const ICON_W = 256, ICON_H = 128, HAND = [64, 80];
const master = async (file, id) => (FLIP.has(id) ? sharp(await sharp(file).flop().png().toBuffer()) : sharp(file));

async function gunIcon(file, id) {
  const [gx, gy] = GRIP[id];
  const cut = await (await master(file, id)).trim({ threshold: 1 }).png().toBuffer();
  const { width, height } = await sharp(cut).metadata();
  // as big as fits around the hand: 4px margins, and never wider than the longest painted toy gun
  const k = Math.min((HAND[0] - 4) / (gx * width), (ICON_W - HAND[0] - 4) / ((1 - gx) * width), (HAND[1] - 4) / (gy * height), (ICON_H - HAND[1] - 4) / ((1 - gy) * height), 216 / width);
  const w = Math.max(1, Math.round(width * k)), h = Math.max(1, Math.round(height * k));
  const icon = await sharp(cut).resize(w, h, { fit: 'fill' }).png().toBuffer();
  await fs.mkdir(path.join(root, 'public/assets/guns'), { recursive: true });
  await sharp({ create: { width: ICON_W, height: ICON_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: icon, left: Math.round(HAND[0] - gx * w), top: Math.round(HAND[1] - gy * h) }])
    .webp({ quality: 90, alphaQuality: 95, effort: 6 }).toFile(path.join(root, `public/assets/guns/icon_${id}.webp`));
}

/** bounds of the gun itself: opaque pixels of a cut-out, or everything brighter than the night-blue backdrop */
async function subjectBounds(file, id) {
  const { data, info } = await (await master(file, id)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
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
  const files = (await fs.readdir(source)).filter(f => f.endsWith('.png')).sort(), icons = [];
  for (const name of files) {
    const file = path.join(source, name), id = path.basename(name, '.png');
    const b = await subjectBounds(file, id);
    let image;
    if (b.cutout) {
      // a transparent master is fitted whole into the frame and gets the backdrop of the painted ones: night-blue vignette plus its own soft glow
      const cut = await (await master(file, id)).trim({ threshold: 1 }).resize(GUN_ART_W - 110, GUN_ART_H - 70, { fit: 'inside' }).png().toBuffer();
      const gun = await sharp({ create: { width: GUN_ART_W, height: GUN_ART_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: cut }]).png().toBuffer();
      const backdrop = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${GUN_ART_W}" height="${GUN_ART_H}"><defs><radialGradient id="g" cx="50%" cy="50%" r="62%"><stop offset="0" stop-color="#152b52"/><stop offset=".55" stop-color="#0a1630"/><stop offset="1" stop-color="#03060e"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`);
      const glow = await sharp(gun).blur(34).ensureAlpha(0.55).png().toBuffer();
      image = sharp(backdrop).composite([{ input: glow, blend: 'screen' }, { input: gun }]);
    } else {
      // full width, a 240:136 window centred on the gun so nothing tall (slingshot, acorn hopper) is clipped
      const cropH = Math.round(b.width * GUN_ART_H / GUN_ART_W);
      if (b.bottom - b.top > cropH) throw new Error(`${name}: gun is taller than the card frame`);
      const cropTop = Math.max(0, Math.min(b.height - cropH, Math.round((b.top + b.bottom) / 2 - cropH / 2)));
      image = (await master(file, id)).extract({ left: 0, top: cropTop, width: b.width, height: cropH }).resize(GUN_ART_W, GUN_ART_H);
    }
    await image.webp({ quality: 82, effort: 6 }).toFile(path.join(output, `${id}.webp`));
    if (GRIP[id]) { await gunIcon(file, id); icons.push(id); }
  }
  const manifestFile = path.join(root, 'public/assets/manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestFile, 'utf8'));
  for (const id of icons) manifest.overrides[`icon_${id}`] = { file: `guns/icon_${id}.webp`, scale: 4, anchor: HAND };
  await fs.writeFile(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Prepared ${files.length} gun card paintings at ${GUN_ART_W}x${GUN_ART_H} and ${icons.length} in-world gun sprites; masters preserved.`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await prepareGunArt();
