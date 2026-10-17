import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// The "Reach 15K Essence to unlock premium" badge shown under the Full game panel on the title screen.
// Master: art/new/badge.png (untouched). Shipped: public/images/ui/badge_15k.webp, trimmed, 640px wide.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export async function prepareBadgeArt() {
  const trimmed = await sharp(path.join(root, 'art/new/badge.png')).trim({ threshold: 8 }).png().toBuffer();
  const out = await sharp(trimmed).resize(640).webp({ quality: 88, alphaQuality: 92, effort: 6 }).toFile(path.join(root, 'public/images/ui/badge_15k.webp'));
  console.log(`Prepared the 15K Essence badge at ${out.width}x${out.height}; master preserved.`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await prepareBadgeArt();
