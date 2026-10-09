import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// Only touch reproducible build output. Keep production masters and provenance intact.
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetRoot = path.join(project, 'dist', 'assets');
const manifestPath = path.join(assetRoot, 'manifest.json');
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
const referenced = new Set();
let resized = 0, omitted = 0;
function assetPath(file) {
  const resolved = path.resolve(assetRoot, file);
  if (!resolved.startsWith(assetRoot + path.sep)) throw new Error(`Unsafe build asset: ${file}`);
  return resolved;
}
for (const value of Object.values(manifest.overrides)) {
  const files = typeof value === 'string' ? [value] : [value.file, ...(value.rows || []).flat(), ...(Array.isArray(value.frames) ? value.frames.filter(f => typeof f === 'string') : [])].filter(Boolean);
  for (const file of files) referenced.add(assetPath(file));
  if (typeof value !== 'object' || !value.file?.startsWith('generated/world/') || !value.scale || value.scale <= manifest.maxScale || value.rows) continue;
  const target = assetPath(value.file), ratio = manifest.maxScale / value.scale;
  const source = await fs.readFile(target), metadata = await sharp(source).metadata();
  const width = metadata.width * ratio, height = metadata.height * ratio;
  if (!Number.isInteger(width) || !Number.isInteger(height)) throw new Error(`Non-integral production grid: ${value.file}`);
  await sharp(source).resize(width, height, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toFile(target);
  value.scale = manifest.maxScale;
  if (value.anchor) value.anchor = value.anchor.map(v => v * ratio);
  resized++;
}
async function omitUnreferenced(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const target = assetPath(path.relative(assetRoot, path.join(directory, entry.name)));
    if (entry.isSymbolicLink()) throw new Error(`Unexpected link in build: ${target}`);
    if (entry.isDirectory()) await omitUnreferenced(target);
    else if (!referenced.has(target)) { await fs.unlink(target); omitted++; }
  }
}
await omitUnreferenced(assetPath('generated'));
await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Release assets: ${resized} images packed to runtime maxScale; ${omitted} unreferenced masters/sidecars omitted from dist only.`);
