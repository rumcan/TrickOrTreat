import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// Talent tree artwork: one painted icon per talent, cut from the 6x5 sheet art/new/tallets_icon1.png, and the night-sky
// backdrop art/new/tallent_back.png. Masters stay untouched; the game ships small WebP files in public/images/talents.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'public/images/talents');
/** sheet order, row by row; "root" is the pumpkin at the centre of the tree */
export const TALENT_ICON_GRID = [
  ['root', 'bestfriends', 'sharpshot', 'heavy', 'prankster', 'hot'],
  ['grin', 'lucky', 'trigger', 'sharp', 'master', 'guardians'],
  ['fieldmedic', 'second', 'hardhat', 'recover', 'pads', 'stitched'],
  ['thick', 'studygroup', 'paperroute', 'pockets', 'dash', 'find'],
  ['seeker', 'shoes', 'sweet', 'allowance', 'reroll', 'legend'],
];
const SIZE = 160;

export async function prepareTalentArt() {
  await fs.mkdir(output, { recursive: true });
  const sheet = path.join(root, 'art/new/tallets_icon1.png');
  // The icons are hand-placed, not on an even grid: find each one by its own outline. Opaque pixels are grouped into
  // connected blobs on a half-size mask.
  const { data, info } = await sharp(sheet).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
  const S = 2, w = Math.floor(info.width / S), h = Math.floor(info.height / S), BRIDGE = 0; // each icon is already one connected piece; neighbours sit only a few pixels apart
  const solid = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[y * S * info.width + x * S] > 40) solid[y * w + x] = 1;
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (solid[y * w + x]) {
    for (let dy = -BRIDGE; dy <= BRIDGE; dy++) for (let dx = -BRIDGE; dx <= BRIDGE; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h) mask[ny * w + nx] = 1;
    }
  }
  const seen = new Uint8Array(w * h), label = new Uint8Array(w * h), blobs = [];
  for (let start = 0; start < w * h; start++) {
    if (!mask[start] || seen[start]) continue;
    const queue = [start]; seen[start] = 1;
    let x0 = w, y0 = h, x1 = 0, y1 = 0, area = 0;
    for (let i = 0; i < queue.length; i++) {
      const c = queue[i], x = c % w, y = (c / w) | 0;
      if (solid[c]) { area++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      for (const n of [c - 1, c + 1, c - w, c + w]) if (n >= 0 && n < w * h && mask[n] && !seen[n] && Math.abs((n % w) - x) <= 1) { seen[n] = 1; queue.push(n); }
    }
    if (area <= 400) continue;
    blobs.push({ id: blobs.length + 1, x0: x0 * S, y0: y0 * S, x1: (x1 + 1) * S, y1: (y1 + 1) * S, cx: (x0 + x1) * S / 2, cy: (y0 + y1) * S / 2 });
    for (const c of queue) label[c] = blobs.length;
  }
  if (blobs.length !== 30) throw new Error(`Expected 30 icons on the sheet, found ${blobs.length}`);
  blobs.sort((p, q) => p.cy - q.cy);
  for (let r = 0; r < 5; r++) {
    const row = blobs.slice(r * 6, r * 6 + 6).sort((p, q) => p.cx - q.cx);
    for (let c = 0; c < 6; c++) {
      const b = row[c], pad = 2;
      const left = Math.max(0, b.x0 - pad), top = Math.max(0, b.y0 - pad);
      const cw = Math.min(info.width, b.x1 + pad) - left, ch = Math.min(info.height, b.y1 + pad) - top;
      // a neighbour's edge often pokes into this icon's rectangle: keep only pixels that belong to this icon (or to its
      // own soft edge), by the nearest labelled blob
      const rgba = await sharp(sheet).extract({ left, top, width: cw, height: ch }).ensureAlpha().raw().toBuffer();
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
        const mx = Math.min(w - 1, ((left + x) / S) | 0), my = Math.min(h - 1, ((top + y) / S) | 0);
        let own = label[my * w + mx] === b.id, other = label[my * w + mx] !== 0 && !own;
        for (let r = 1; r <= 4 && !own && !other; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          const nx = mx + dx, ny = my + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const l = label[ny * w + nx];
          if (l === b.id) own = true; else if (l) other = true;
        }
        if (!own) rgba[(y * cw + x) * 4 + 3] = 0;
      }
      const cut = await sharp(rgba, { raw: { width: cw, height: ch, channels: 4 } }).png().toBuffer();
      const icon = await sharp(cut).resize(SIZE - 8, SIZE - 8, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .extend({ top: 4, bottom: 4, left: 4, right: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 88, alphaQuality: 95, effort: 6 }).toBuffer();
      await fs.writeFile(path.join(output, `${TALENT_ICON_GRID[r][c]}.webp`), icon);
    }
  }
  await sharp(path.join(root, 'art/new/tallent_back.png')).webp({ quality: 74, effort: 6 }).toFile(path.join(output, 'back.webp'));
  console.log(`Prepared 30 talent icons at ${SIZE}px and the talent tree backdrop; masters preserved.`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await prepareTalentArt();
