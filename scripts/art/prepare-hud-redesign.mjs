import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

// Pixel rectangles from the HUD sprite sheet supplied with the redesign.
// Keep the painted frame edges intact; CSS border-image scales their centres.
const source = 'art/redesign/hud-sheet.png';
const out = 'public/images/redesign';
await mkdir(out, { recursive: true });
const crops = {
  'hud-slot-orange': [8, 0, 199, 76],
  'hud-slot-active': [204, 0, 199, 78],
  'hud-slot-green': [8, 77, 199, 72],
  'hud-slot-blue': [8, 149, 199, 73],
  'hud-slot-purple': [8, 221, 199, 72],
  'hud-slot-gray': [571, 5, 134, 67],
  'hud-card-orange': [10, 295, 134, 212],
  'hud-card-green': [146, 295, 135, 212],
  'hud-card-blue': [283, 295, 132, 212],
  'hud-card-purple': [417, 295, 131, 212],
  'hud-card-gray': [550, 295, 128, 212],
  'hud-card-gold': [681, 295, 129, 212],
  'hud-banner': [810, 279, 630, 98],
  'hud-toast': [814, 378, 228, 129],
  'hud-portrait': [9, 510, 71, 78],
  'hud-button': [957, 15, 51, 53],
  'hud-rail-green': [85, 512, 79, 77],
  'hud-rail-blue': [166, 512, 78, 77],
  'hud-rail-purple': [246, 512, 76, 77],
  'hud-rail-gray': [324, 512, 72, 77],
  'hud-rail-gold': [399, 512, 77, 77],
  'hud-skull': [777, 873, 51, 51],
  'hud-coin': [833, 873, 49, 51],
};
for (const [name, [left, top, width, height]] of Object.entries(crops)) {
  await sharp(source).extract({ left, top, width, height }).webp({ lossless: true }).toFile(`${out}/${name}.webp`);
}
console.log(`Extracted ${Object.keys(crops).length} HUD assets from ${source}.`);
