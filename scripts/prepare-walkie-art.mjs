import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// The tutorial's walkie-talkie (Professor Fizz talks through it, see src/ui/Walkie.tsx).
// Master: art/new/walkie.png, generated with
//   rundot generate image --remove-background --aspect-ratio 1:1 --prompt "<the prompt in art/new/walkie.png.json>"
// Shipped: public/images/ui/walkie.webp, trimmed to the object, 240px tall.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export async function prepareWalkieArt() {
  const trimmed = await sharp(path.join(root, 'art/new/walkie.png')).trim({ threshold: 8 }).png().toBuffer();
  const out = await sharp(trimmed).resize({ height: 240 }).webp({ quality: 88, alphaQuality: 92, effort: 6 }).toFile(path.join(root, 'public/images/ui/walkie.webp'));
  console.log(`Prepared the walkie-talkie at ${out.width}x${out.height}; master preserved.`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await prepareWalkieArt();
