import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { cutIconSheet } from './lib/icon-sheet.mjs';

// Talent tree artwork: one painted icon per talent, cut from the sheet art/new/tallets_icon1.png, and the night-sky
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
/** the stars beyond the capstones use the retro icons of art/new/tallets_icon2.png that no treat uses (null = a treat's, or unused) */
export const TALENT_ICON_GRID_2 = [
  ['rewind', null, null, 'brick', 'pager'],
  ['floppy', 'boombox', null, null, null],
  [null, 'cube', null, 'flash', null],
  ['lava', null, null, 'slinky', 'pet'],
  [null, 'shades', 'rockstar', null, null],
];
const SIZE = 160, clear = { r: 0, g: 0, b: 0, alpha: 0 };

export async function prepareTalentArt() {
  await fs.mkdir(output, { recursive: true });
  let made = 0;
  for (const [sheet, grid] of [['tallets_icon1.png', TALENT_ICON_GRID], ['tallets_icon2.png', TALENT_ICON_GRID_2]]) {
    const cuts = await cutIconSheet(path.join(root, 'art/new', sheet), grid.length, grid[0].length);
    for (let r = 0; r < grid.length; r++) for (let c = 0; c < grid[r].length; c++) {
      if (!grid[r][c]) continue;
      const icon = await sharp(cuts[r][c]).resize(SIZE - 8, SIZE - 8, { fit: 'contain', background: clear })
        .extend({ top: 4, bottom: 4, left: 4, right: 4, background: clear }).webp({ quality: 88, alphaQuality: 95, effort: 6 }).toBuffer();
      await fs.writeFile(path.join(output, `${grid[r][c]}.webp`), icon);
      made++;
    }
  }
  await sharp(path.join(root, 'art/new/tallent_back.png')).webp({ quality: 74, effort: 6 }).toFile(path.join(output, 'back.webp'));
  console.log(`Prepared ${made} talent icons at ${SIZE}px and the talent tree backdrop; masters preserved.`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await prepareTalentArt();
