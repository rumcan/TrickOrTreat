import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { prepareLogo } from './prepare-logo.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'art', 'new');
const output = path.join(root, 'public');
const thumbnailOnly = process.argv.includes('--thumbnail-only');
const posterArgument = process.argv.indexOf('--poster');
const requestedPoster = posterArgument >= 0 ? process.argv[posterArgument + 1] : null;
if (posterArgument >= 0 && (!requestedPoster || path.basename(requestedPoster) !== requestedPoster)) {
  throw new Error('--poster must name a file directly inside art/new.');
}
if (!thumbnailOnly) {
  await fs.mkdir(path.join(output, 'images'), { recursive: true });
  await fs.copyFile(path.join(source, 'newlogo.png'), path.join(output, 'images', 'newlogo.png'));
  await prepareLogo();
  for (const name of ['splash', 'splash_portrait']) {
    await sharp(path.join(source, `${name}.png`)).webp({ quality: 90 }).toFile(path.join(output, 'images', `${name}.webp`));
  }
  await fs.mkdir(path.join(output, 'images', 'ui'), { recursive: true });
  for (const [file, hero] of [['portrait_red_boy.png', 'tommy'], ['portrait_orange_boy.png', 'sam'], ['portrait_purple_girl.png', 'jess'], ['portrait_yellow_girl.png', 'maya'], ['portrait_blue_boy.png', 'leo']]) {
    await sharp(path.join(source, file)).resize({ width: 768, withoutEnlargement: true }).webp({ quality: 90 }).toFile(path.join(output, 'images', 'ui', `portrait_${hero}.webp`));
    await sharp(path.join(source, file)).resize(256, 256, { fit: 'cover', position: 'north' }).webp({ quality: 90 }).toFile(path.join(output, 'images', 'ui', `face_${hero}.webp`));
  }
}
const poster = requestedPoster || await fs.access(path.join(source, 'thumb_posterpng.png')).then(() => 'thumb_posterpng.png', () => 'thumb_poster.png');
const metadata = await sharp(path.join(source, poster)).metadata();
if (metadata.width !== metadata.height) throw new Error('The supplied RUN poster must be square; refusing to crop it silently.');
const backups = path.join(root, 'art', 'reference', 'previous-thumbnails');
await fs.mkdir(backups, { recursive: true });
for (const file of ['thumbnail.jpg', 'thumbnail.png']) {
  await fs.copyFile(path.join(output, file), path.join(backups, file), fs.constants.COPYFILE_EXCL).catch(error => {
    if (error.code !== 'EEXIST' && error.code !== 'ENOENT') throw error;
  });
}
await sharp(path.join(source, poster)).resize(512, 512).jpeg({ quality: 92 }).toFile(path.join(output, 'thumbnail.jpg'));
await sharp(path.join(source, poster)).resize(512, 512).png().toFile(path.join(output, 'thumbnail.png'));
console.log(`Prepared ${thumbnailOnly ? 'RUN thumbnail' : 'splash art, all five updated portraits and RUN thumbnail'} from ${poster}; originals and previous thumbnails preserved.`);
