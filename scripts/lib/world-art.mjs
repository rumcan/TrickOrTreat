import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';

export const digest = (data) => createHash('sha256').update(data).digest('hex');

export function inside(root, filename) {
  const resolved = path.resolve(root, filename);
  const relative = path.relative(root, resolved);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Path must be inside ${root}: ${filename}`);
  }
  return resolved;
}

export async function readJson(filename) {
  return JSON.parse(await fs.readFile(filename, 'utf8'));
}

export async function writeJson(filename, value) {
  await fs.mkdir(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
    await fs.rename(temporary, filename);
  } finally { await fs.unlink(temporary).catch((error) => { if (error.code !== 'ENOENT') throw error; }); }
}

export function checkSpec(spec) {
  if (!/^[a-z][a-z0-9_]*$/.test(spec.key)) throw new Error('Invalid asset key');
  if (!['prop', 'tile', 'overlay', 'sheet', 'icon'].includes(spec.category)) throw new Error(`${spec.key} is not a registered art category`);
  if (![spec.w, spec.h].every((n) => Number.isInteger(n) && n > 0)) throw new Error(`${spec.key}: invalid canvas`);
  if (spec.category === 'prop' && (!spec.anchor || spec.anchor.some((n, i) => !Number.isFinite(n) || n < 0 || n >= [spec.w, spec.h][i]))) {
    throw new Error(`${spec.key}: invalid footprint anchor`);
  }
}

export function promptFor(spec, style, scale = 4, generationGrid) {
  checkSpec(spec);
  // Preserve asset semantics, including colors and sign text, while replacing the old medium.
  let subject = spec.prompt.replace(/hand-painted pixel[- ]art/gi, 'hand-painted').replace(/crisp dark outline/gi, 'clean painted edges').replace(/with 2px dark outline/gi, 'with clean painted edges');
  if (generationGrid) subject = subject.replace(/Grid:.*?Feet anchor/s, 'Feet anchor');
  const canvasW = generationGrid ? generationGrid[0] * spec.frameW : spec.w;
  const canvasH = generationGrid ? generationGrid[1] * spec.frameH : spec.h;
  const lines = [
    'Use case: stylized-concept',
    `Asset type: production ${spec.category} sprite for Trick or Treat: Last Kid Standing`,
    'Input images: Image 1 = STYLE reference only. Image 2 = procedural LAYOUT guide only.',
    'Primary request: Generate ONE asset. Match Image 1\'s world artwork and preserve Image 2\'s camera, canvas margins, silhouette scale, ground contact, footprint and orientation.',
    `Subject: ${subject}`,
    `Atlas entry: ${spec.key}. ${spec.desc ?? ''}`,
    `Style/medium: ${style.style}`,
    `Color palette: ${style.palette}`,
    `Lighting/mood: ${style.lighting}`,
    `Projection: ${style.projection}`,
    `Canvas: native ${canvasW}x${canvasH}; render ${canvasW * scale}x${canvasH * scale} (${scale}x). If a different resolution is necessary, preserve the EXACT canvas proportions and all relative positions. Do not auto-crop or recenter.`,
    'Background: genuine alpha transparency; preserve fine edges. No painted transparency pattern.',
  ];
  if (spec.anchor) lines.push(`Anchor: ${spec.category === 'sheet' ? 'feet within EVERY frame' : spec.category === 'icon' ? 'grip or pickup pivot' : 'footprint center'} at native (${spec.anchor.join(',')}), rendered (${spec.anchor.map((x) => x * scale).join(',')}). All contact positions stay fixed to the layout guide.`);
  if (spec.footprint) lines.push(`Footprint: exactly ${spec.footprint.join('x')} world tiles. Preserve the building height, door/window locations and local light positions from the layout guide.`);
  if (spec.category === 'tile') lines.push('Terrain: fill the entire 2:1 diamond right to all four edges, transparent outside. Flat surface with no side walls. Matching opposite edges for seamless repeats; no directional lighting gradients, isolated large objects or strong focal features. Keep variants compatible.');
  if (/^tile_field_[0-2]$/.test(spec.key)) lines.push(spec.key === 'tile_field_2' ? 'This field variant has a white yard line on the NE edge.' : 'This field variant is unmarked turf; do not paint a yard line.');
  if (spec.category === 'overlay') lines.push('Overlay: only the described decal/edge detail; leave the rest transparent, including the underlying terrain. Match the layout guide exactly. NE connects (w/2,0) to (w,h/2); SE connects (w,h/2) to (w/2,h); SW connects (w/2,h) to (0,h/2); NW connects (0,h/2) to (w/2,0).');
  if (spec.category === 'sheet') {
    const cols = generationGrid?.[0] ?? spec.w / spec.frameW, rows = generationGrid?.[1] ?? spec.h / spec.frameH;
    lines.push(`SPRITE SHEET: EXACTLY ${cols} columns and ${rows} rows of equal ${spec.frameW * scale}x${spec.frameH * scale} pixel cells. No grid lines, labels, frames or borders. Each pose remains inside its own cell with feet at the same local anchor, no overlapping neighbours. Every occupied cell depicts the SAME character, body size, face, clothing and lighting. Preserve frame-by-frame pose movement in Image 2. Transparent gutters and empty cells stay empty. No weapon held unless part of the atlas design; runtime draws equipped weapons.`);
    if (generationGrid) lines.push(`This is ONE ${spec.rowFrames?.[0] ?? spec.frames} frame animation rearranged into ${cols}x${rows} for generation. Read frames left-to-right, then top-to-bottom. The importer repacks it to the engine's original horizontal strip. Draw every frame; do not invent a different animation row.`);
    else lines.push(`Animation rows top to bottom: ${spec.rows.join(' | ')}. Occupied cells per row: ${spec.rowFrames.join('/')}. For 4-frame idle rows, last two cells are EMPTY; walking rows use all six. Front rows face camera; back rows show the character's BACK, not another front pose. Same facial identity throughout.`);
  }
  if (spec.category === 'icon') lines.push('ICON: preserve the atlas layout and pivot, clear silhouette at native icon size. Weapon sprites point RIGHT in side view; pickups stay centered. No decorative panel, no labels, no character holding the object.');
  const avoid = spec.category === 'sheet' ? style.avoid.replace('characters, ', '') : style.avoid;
  lines.push(`Avoid: ${avoid}`, `Output: ${spec.category === 'sheet' ? 'one complete animation sheet of the requested character' : 'one isolated asset, not a sheet of unrelated assets'}. No finished scene. Atlas geometry has priority over scene composition.`);
  return lines.join('\n') + '\n';
}

export async function pngPixels(input) {
  const meta = await sharp(input).metadata();
  if (meta.format !== 'png' || (meta.pages ?? 1) !== 1) throw new Error('Expected a static PNG');
  if (!meta.hasAlpha) throw new Error('PNG needs genuine alpha transparency');
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width, minY = info.height, maxX = -1, maxY = -1, transparent = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const a = data[(y * info.width + x) * 4 + 3];
    if (a < 16) transparent++;
    if (a > 16) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  }
  if (maxX < 0) throw new Error('PNG has no visible artwork');
  if (transparent < info.width * info.height * 0.01) throw new Error('PNG is effectively opaque; regenerate with a transparent background');
  return { meta, data, info, bounds: [minX, minY, maxX, maxY] };
}

/** Only deterministic resampling/packing: no background removal or generated painting. */
export async function packPng(input, spec, scale, sourceAnchor, generationGrid, alignGrid = false, trimTile = false, clearUnused = false) {
  checkSpec(spec);
  if (!Number.isInteger(scale) || scale < 1 || scale > 4) throw new Error('Scale must be an integer from 1 to 4');
  const source = await pngPixels(input);
  if (spec.category === 'sheet' && generationGrid) {
    const [cols, rows] = generationGrid;
    const expectedRatio = (cols * spec.frameW) / (rows * spec.frameH);
    if (!alignGrid && Math.abs((source.info.width / source.info.height) / expectedRatio - 1) > 0.01) throw new Error('Animation generation grid has incorrect canvas proportions');
    const fw = spec.frameW * scale, fh = spec.frameH * scale;
    if (alignGrid) {
      const cells = [];
      let minY = Infinity, baseline = 0, horizontalRadius = 0;
      for (let f = 0; f < spec.rowFrames[0]; f++) {
        const left = Math.round((f % cols) * source.info.width / cols), top = Math.round(Math.floor(f / cols) * source.info.height / rows);
        const width = Math.round(((f % cols) + 1) * source.info.width / cols) - left;
        const height = Math.round((Math.floor(f / cols) + 1) * source.info.height / rows) - top;
        const bytes = await sharp(input).extract({ left, top, width, height }).png().toBuffer();
        const { bounds } = await pngPixels(bytes);
        minY = Math.min(minY, bounds[1]); baseline = Math.max(baseline, bounds[3] + 1);
        horizontalRadius = Math.max(horizontalRadius, width / 2 - bounds[0], bounds[2] + 1 - width / 2);
        cells.push({ bytes, width, height, bounds });
      }
      const k = Math.min((spec.anchor[1] - 4) * scale / (baseline - minY), (fw / 2 - 2 * scale) / horizontalRadius);
      const layers = [];
      for (let f = 0; f < cells.length; f++) {
        const cell = cells[f], [x0, y0, x1, y1] = cell.bounds;
        const cropped = await sharp(cell.bytes).extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }).resize(Math.max(1, Math.round((x1 - x0 + 1) * k)), Math.max(1, Math.round((y1 - y0 + 1) * k))).png().toBuffer();
        const x = Math.round(spec.anchor[0] * scale + (x0 - cell.width / 2) * k), y = Math.round(spec.anchor[1] * scale + (y0 - baseline) * k);
        if (x < 0 || y < 0) throw new Error('Aligned animation would clip');
        layers.push({ input: cropped, left: f * fw + x, top: y });
      }
      const packed = await sharp({ create: { width: spec.w * scale, height: spec.h * scale, channels: 4, background: '#00000000' } }).composite(layers).png().toBuffer();
      return { packed, sourceSize: [source.info.width, source.info.height], outputSize: [spec.w * scale, spec.h * scale], sourceAnchor: null, bounds: source.bounds, gridAlignment: 'uniform frame packing, shared feet baseline' };
    }
    const normalized = await sharp(input).resize(cols * fw, rows * fh).png().toBuffer();
    const layers = [];
    for (let f = 0; f < spec.rowFrames[0]; f++) layers.push({ input: await sharp(normalized).extract({ left: (f % cols) * fw, top: Math.floor(f / cols) * fh, width: fw, height: fh }).png().toBuffer(), left: f * fw, top: 0 });
    const packed = await sharp({ create: { width: spec.w * scale, height: spec.h * scale, channels: 4, background: '#00000000' } }).composite(layers).png().toBuffer();
    return { packed, sourceSize: [source.info.width, source.info.height], outputSize: [spec.w * scale, spec.h * scale], sourceAnchor: null, bounds: source.bounds };
  }
  const width = spec.w * scale, height = spec.h * scale;
  const { width: sw, height: sh } = source.info;
  const ratioError = Math.abs((sw / sh) / (spec.w / spec.h) - 1);
  const canAlignAnchor = ['prop', 'icon'].includes(spec.category) && spec.anchor;
  if (ratioError > 0.01 && !(trimTile && spec.category === 'tile') && (!sourceAnchor || !canAlignAnchor)) {
    throw new Error(`Canvas proportions differ from ${spec.w}x${spec.h}. Regenerate using the layout guide${canAlignAnchor ? ' or specify --source-anchor X,Y to align a different canvas' : ''}.`);
  }
  if (sourceAnchor && (sourceAnchor.length !== 2 || sourceAnchor.some((n, i) => !Number.isFinite(n) || n < 0 || n >= [sw, sh][i]))) throw new Error('Source anchor must be inside the source image');
  let packed;
  if (sourceAnchor) {
    const k = Math.min(width / sw, height / sh);
    const rw = Math.round(sw * k), rh = Math.round(sh * k);
    const left = Math.round(spec.anchor[0] * scale - sourceAnchor[0] * (rw / sw));
    const top = Math.round(spec.anchor[1] * scale - sourceAnchor[1] * (rh / sh));
    const [x0, y0, x1, y1] = source.bounds;
    if (x0 * rw / sw + left < 0 || y0 * rh / sh + top < 0 || (x1 + 1) * rw / sw + left > width || (y1 + 1) * rh / sh + top > height) throw new Error('Anchor alignment would clip artwork; adjust source canvas/anchor');
    const resized = await sharp(input).resize(rw, rh).png().toBuffer();
    // Crop transparent padding only, so sharp can composite at nonnegative coordinates.
    const cropX = Math.max(0, -left), cropY = Math.max(0, -top);
    const cropped = await sharp(resized).extract({ left: cropX, top: cropY, width: Math.min(rw - cropX, width - Math.max(0, left)), height: Math.min(rh - cropY, height - Math.max(0, top)) }).toBuffer();
    packed = await sharp({ create: { width, height, channels: 4, background: '#00000000' } }).composite([{ input: cropped, left: Math.max(0, left), top: Math.max(0, top) }]).png().toBuffer();
  } else {
    let layoutInput = input;
    if (trimTile && spec.category === 'tile') {
      const [x0, y0, x1, y1] = source.bounds;
      layoutInput = await sharp(input).extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }).png().toBuffer();
    }
    packed = await sharp(layoutInput).resize(width, height, { fit: 'fill' }).png().toBuffer();
  }
  // The source layout has already been checked; enforce the terrain diamond boundary.
  if (spec.category === 'tile') {
    const mask = Buffer.from(`<svg width="${width}" height="${height}"><polygon points="${width / 2},0 ${width},${height / 2} ${width / 2},${height} 0,${height / 2}" fill="white"/></svg>`);
    packed = await sharp(packed).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  }
  if (spec.category === 'sheet' && clearUnused) {
    const columns = spec.w / spec.frameW, fw = spec.frameW * scale, fh = spec.frameH * scale;
    const rectangles = spec.rowFrames.map((count, r) => count < columns ? `<rect x="${count * fw}" y="${r * fh}" width="${(columns - count) * fw}" height="${fh}" fill="white"/>` : '').join('');
    const mask = Buffer.from(`<svg width="${width}" height="${height}">${rectangles}</svg>`);
    packed = await sharp(packed).composite([{ input: mask, blend: 'dest-out' }]).png().toBuffer();
  }
  await pngPixels(packed);
  return { packed, sourceSize: [sw, sh], outputSize: [width, height], sourceAnchor: sourceAnchor ?? null, bounds: source.bounds, ...(trimTile ? { tileTrim: source.bounds } : {}) };
}

export async function validatePacked(input, spec, scale) {
  const { info, data } = await pngPixels(input);
  if (info.width !== spec.w * scale || info.height !== spec.h * scale) throw new Error(`${spec.key}: incorrect packed dimensions`);
  if (spec.category === 'sheet') {
    const fw = spec.frameW * scale, fh = spec.frameH * scale, columns = spec.w / spec.frameW;
    for (let r = 0; r < spec.rows.length; r++) for (let c = 0; c < columns; c++) {
      let visible = 0;
      for (let y = r * fh; y < (r + 1) * fh; y++) for (let x = c * fw; x < (c + 1) * fw; x++) if (data[(y * info.width + x) * 4 + 3] > 32) visible++;
      if (c < spec.rowFrames[r] && visible < fw * fh * 0.01) throw new Error(`${spec.key}: missing animation frame ${r},${c}`);
      if (c >= spec.rowFrames[r] && visible > fw * fh * 0.01) throw new Error(`${spec.key}: expected empty animation cell ${r},${c}`);
    }
  }
  if (spec.category === 'tile') {
    const { width: w, height: h } = info;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const distance = Math.abs((x + 0.5 - w / 2) / (w / 2)) + Math.abs((y + 0.5 - h / 2) / (h / 2));
      const alpha = data[(y * w + x) * 4 + 3];
      if (distance > 1.04 && alpha > 16) throw new Error(`${spec.key}: pixels outside diamond`);
      if (distance < 0.95 && alpha < 240) throw new Error(`${spec.key}: holes or translucent terrain inside diamond`);
    }
  }
}
