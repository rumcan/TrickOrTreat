import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export async function prepareLogo() {
  const source = path.join(root, 'art/new/newlogo.png');
  const output = path.join(root, 'public/images');
  await fs.mkdir(output, { recursive: true });
  // Keep the supplied master untouched; 1240px covers the 620px loading logo at 2x DPR.
  for (const [name, width] of [['newlogo.webp', 1240], ['newlogo_sm.webp', 640]]) {
    await sharp(source).resize({ width, withoutEnlargement: true })
      .webp({ quality: 90, alphaQuality: 100, effort: 6 }).toFile(path.join(output, name));
  }
  console.log('Prepared transparent full and small WebP logos; original PNG preserved.');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await prepareLogo();
