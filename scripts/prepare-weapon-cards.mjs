import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const masterRoot = path.join(root, 'art/weapon-cards/masters');
const output = path.join(root, 'public/images/weapon-cards');
export const gunIds = ['pea', 'nerf', 'shotgun', 'roman', 'soaker', 'balloon', 'rocket', 'laser', 'slingshot', 'gloom', 'marshmallow', 'bubblegum', 'acorn'];

export async function prepareWeaponCards() {
  await fs.mkdir(output, { recursive: true });
  let bytes = 0;
  for (const id of gunIds) {
    const source = path.join(masterRoot, `${id}-v1.png`);
    const meta = await sharp(source).metadata();
    if (!meta.width || !meta.height || meta.width < 1024 || meta.height < 768) throw new Error(`${id}: missing high-resolution master`);
    for (const width of [480, 960]) {
      const file = path.join(output, `${id}-v1-${width}.webp`);
      await sharp(source).resize({ width, withoutEnlargement: true }).webp({ quality: 86, effort: 6 }).toFile(file);
      bytes += (await fs.stat(file)).size;
    }
  }
  console.log(`Prepared ${gunIds.length} high-resolution weapon cards at 480/960px; ${(bytes / 1024 / 1024).toFixed(2)} MB total runtime artwork.`);
  const tiles = await Promise.all(gunIds.map(async (id, i) => ({
    input: await sharp(path.join(output, `${id}-v1-480.webp`)).resize(360, 240).toBuffer(),
    left: i % 4 * 360, top: Math.floor(i / 4) * 240,
  })));
  await sharp({create:{width:1440,height:960,channels:3,background:'#070b13'}}).composite(tiles)
    .jpeg({quality:90}).toFile(path.join(root, 'art/weapon-cards/contact-sheet.jpg'));
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) await prepareWeaponCards();
