import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// The end-screen "YOU DIED" plate. The master (art/new/youdied.png) has white and black margins around the red neon
// frame: crop to the frame itself. The master stays untouched.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export async function prepareBannerArt() {
  const source = path.join(root, 'art/new/youdied.png');
  const { data, info } = await sharp(source).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
  // the frame is the outermost saturated red: a full row or column of it, not a stray red pixel of the artwork
  const red = (x, y) => { const i = (y * info.width + x) * 3; return data[i] > 170 && data[i + 1] < 70 && data[i + 2] < 70; };
  for (let y = 0; y < info.height; y++) { let n = 0; for (let x = 0; x < info.width; x++) if (red(x, y)) n++; if (n > info.width * 0.5) { if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  for (let x = 0; x < info.width; x++) { let n = 0; for (let y = 0; y < info.height; y++) if (red(x, y)) n++; if (n > info.height * 0.3) { if (x < x0) x0 = x; if (x > x1) x1 = x; } }
  if (x1 <= x0 || y1 <= y0) throw new Error('Could not find the red frame in youdied.png');
  const glow = 6; // keep the frame's soft outer glow
  const left = Math.max(0, x0 - glow), top = Math.max(0, y0 - glow);
  const width = Math.min(info.width, x1 + glow + 1) - left, height = Math.min(info.height, y1 + glow + 1) - top;
  await sharp(source).extract({ left, top, width, height }).resize({ width: 1240, withoutEnlargement: true }).webp({ quality: 84, effort: 6 }).toFile(path.join(root, 'public/images/ui/youdied.webp'));
  console.log(`Prepared the YOU DIED plate: frame ${width}x${height} cut from ${info.width}x${info.height}; master preserved.`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await prepareBannerArt();
