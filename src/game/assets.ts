// ===== Asset registry =====
// Every graphic in the game is registered here with an exact spec (size, frames, anchor, AI prompt).
// At boot we read /assets/manifest.json. Any key listed there is loaded from /assets/<file> (PNG, APNG or WEBP)
// and REPLACES the procedural fallback. Everything else is drawn procedurally into canvases.
//
// Files may be drawn at any resolution: the scale is detected from the image size, and big images are
// resampled ONCE at load to at most `maxScale`× the game size, so the frame loop only ever blits.

import { decodeApng, isPng } from './apng';
import { rawCanvas, withArtScale } from './art/draw';

export type Img = HTMLCanvasElement | HTMLImageElement | ImageBitmap;

export type AssetCategory = 'tile' | 'overlay' | 'prop' | 'sheet' | 'icon' | 'fx';

export interface AssetSpec {
  key: string;
  file: string; // suggested path inside /assets/
  category: AssetCategory;
  w: number;
  h: number;
  frameW?: number;
  frameH?: number;
  frames?: number;
  rows?: string[];
  /** frames used per row (defaults to `frames` for every row) */
  rowFrames?: number[];
  /** pixel inside the image that sits on the world anchor (footprint centre on the ground) */
  anchor?: [number, number];
  footprint?: [number, number];
  desc: string;
  prompt: string;
}

export interface Entry {
  spec: AssetSpec;
  img: Img;
  /** image pixels per game pixel: 1 for procedural art, up to maxScale for hi-res files */
  scale: number;
  /** drawn size and anchor in game pixels (a file may use a different canvas than the spec) */
  w: number;
  h: number;
  anchor: [number, number];
  /** frames per row (sheets) */
  rowFrames: number[];
  /** the file that replaced the procedural art */
  file?: string;
  /** re-draws the procedural version (the exporter runs it under withArtScale) */
  gen: () => HTMLCanvasElement;
}

// ---------- manifest ----------
type Source = string | string[];
export interface ManifestOpts {
  /** a sheet / strip / image / APNG */
  file?: string;
  /** frame count (all rows) or per row; or a list of single-frame files for a one-row sheet */
  frames?: number | number[] | string[];
  /** one source per sheet row: a strip, an APNG, or a list of single-frame files */
  rows?: Source[];
  /** image pixels per game pixel (default: detected from the image size) */
  scale?: number;
  /** anchor in the file's pixels (inside one frame for sheets) when it differs from the spec */
  anchor?: [number, number];
}
type FileImg = Img | Img[]; // Img[] = frames of an APNG
interface Raw { label: string; opts: ManifestOpts; image?: Img; rows?: FileImg[] }

const registry = new Map<string, Entry>();
const raws = new Map<string, Raw>();
const urls = new WeakMap<object, string>();
let maxScale = 2;

const base = () => (import.meta as unknown as { env: { BASE_URL: string } }).env.BASE_URL || './';

async function loadFile(file: string): Promise<FileImg> {
  const url = `${base()}assets/${file}`;
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  const blob = await r.blob();
  // dev servers answer a missing file with index.html (200), so check what actually came back
  if (/^(text|application\/(json|javascript))/.test(blob.type)) throw new Error(`not found: ${url}`);
  const buf = await blob.arrayBuffer();
  if (isPng(new Uint8Array(buf, 0, Math.min(8, buf.byteLength)))) {
    const frames = await decodeApng(buf);
    if (frames) return frames;
  }
  const bmp = await createImageBitmap(blob);
  urls.set(bmp, URL.createObjectURL(blob));
  return bmp;
}

async function loadRaw(key: string, entry: string | ManifestOpts): Promise<Raw> {
  const opts: ManifestOpts = typeof entry === 'string' ? { file: entry } : entry;
  const raw: Raw = { label: '', opts };
  const many = async (list: string[]) => (await Promise.all(list.map(loadFile))).flat();
  if (opts.rows) {
    raw.rows = await Promise.all(opts.rows.map((s) => (Array.isArray(s) ? many(s) : loadFile(s))));
    raw.label = opts.rows.flat().join(', ');
  } else if (Array.isArray(opts.frames) && typeof opts.frames[0] === 'string') {
    raw.rows = [await many(opts.frames as string[])];
    raw.label = (opts.frames as string[]).join(', ');
  } else if (opts.file) {
    const f = await loadFile(opts.file);
    if (Array.isArray(f)) raw.rows = [f];
    else raw.image = f;
    raw.label = opts.file;
  } else throw new Error(`manifest entry "${key}" has no file`);
  return raw;
}

let loading: Promise<void> | null = null;
/** idempotent: React StrictMode runs the boot effect twice in development */
export function loadOverrides() {
  return (loading ??= fetchOverrides());
}
async function fetchOverrides() {
  try {
    const r = await fetch(`${base()}assets/manifest.json`, { cache: 'no-cache' });
    if (!r.ok) return;
    const m = (await r.json()) as { maxScale?: number; overrides?: Record<string, string | ManifestOpts> };
    if (m.maxScale) maxScale = Math.max(1, Math.min(4, Math.round(m.maxScale)));
    await Promise.all(
      Object.entries(m.overrides || {}).map(async ([key, e]) => {
        try {
          raws.set(key, await loadRaw(key, e));
        } catch (err) {
          console.warn('[assets] override failed, using procedural art:', key, err);
        }
      })
    );
  } catch {
    /* running from file:// or no manifest -> procedural only */
  }
}

// ---------- resampling ----------
type Src = CanvasImageSource & { width: number; height: number };
interface Frame { src: Src; sx: number; sy: number; sw: number; sh: number; sc: number }

const targetScale = (sc: number, hi: boolean) => (hi ? Math.max(1, Math.min(maxScale, Math.round(sc))) : 1);

/** halve an image until the remaining reduction is ≥ 0.5 so the final draw doesn't alias */
const halved = new Map<Src, Src>();
function shrink(src: Src, k: number): Src {
  let s = src, f = 1;
  while (k * f < 0.5) {
    let h = halved.get(s);
    if (!h) {
      const c = rawCanvas(s.width / 2, s.height / 2);
      const x = c.getContext('2d')!;
      x.imageSmoothingQuality = 'high';
      x.drawImage(s, 0, 0, c.width, c.height);
      halved.set(s, c);
      h = c;
    }
    s = h;
    f *= 2;
  }
  return s;
}
function drawScaled(ctx: CanvasRenderingContext2D, fr: Frame, k: number, dx: number, dy: number) {
  const src = shrink(fr.src, k);
  const q = src.width / fr.src.width; // exact ratio after rounding
  ctx.drawImage(src, fr.sx * q, fr.sy * q, fr.sw * q, fr.sh * q, dx, dy, fr.sw * k, fr.sh * k);
}

function splitStrip(img: Img, fw: number, fh: number, rowsInImg: number, opts: ManifestOpts): Frame[][] {
  const sc = opts.scale ?? img.height / (fh * rowsInImg);
  const cw = fw * sc, ch = img.height / rowsInImg;
  const cols = Math.max(1, Math.round(img.width / cw));
  return Array.from({ length: rowsInImg }, (_, r) => Array.from({ length: cols }, (_, c) => ({ src: img, sx: c * cw, sy: r * ch, sw: cw, sh: ch, sc })));
}
const asFrames = (list: Img[], fh: number, opts: ManifestOpts): Frame[] => list.map((im) => ({ src: im, sx: 0, sy: 0, sw: im.width, sh: im.height, sc: opts.scale ?? im.height / fh }));

function counts(opt: ManifestOpts['frames'], R: number): number[] | null {
  if (typeof opt === 'number') return Array(R).fill(opt);
  if (Array.isArray(opt) && typeof opt[0] === 'number') return Array.from({ length: R }, (_, r) => (opt as number[])[r] ?? (opt as number[])[0]);
  return null;
}

function resolveSheet(spec: AssetSpec, raw: Raw): Pick<Entry, 'img' | 'scale' | 'rowFrames'> {
  const fw = spec.frameW!, fh = spec.frameH!, R = spec.rows!.length;
  const def = spec.rowFrames ?? Array(R).fill(spec.frames!);
  const want = counts(raw.opts.frames, R);
  let rows: Frame[][];
  if (raw.image) {
    rows = splitStrip(raw.image, fw, fh, R, raw.opts);
    const cols = rows[0].length;
    const n = want ?? (cols === spec.frames ? def : Array(R).fill(cols));
    rows = rows.map((row, r) => row.slice(0, Math.max(1, Math.min(cols, n[r]))));
    // same grid at a usable scale: draw straight from the file, no copy
    const sc = rows[0][0].sc;
    if (!raw.opts.anchor && sc === targetScale(sc, true)) return { img: raw.image, scale: sc, rowFrames: rows.map((x) => x.length) };
  } else {
    const srcRows = raw.rows!.map((s) => (Array.isArray(s) ? asFrames(s, fh, raw.opts) : splitStrip(s, fw, fh, 1, raw.opts)[0]));
    if (srcRows.length === 1 && R > 1) {
      // one animation for a multi-row sheet: split it in row order (e.g. 4+6+4+6 frames for a kid)
      const all = srcRows[0];
      let n = want ?? def;
      if (n.reduce((a, b) => a + b, 0) !== all.length) {
        console.warn(`[assets] ${spec.key}: ${all.length} frames don't match rows ${n.join('+')}, splitting evenly`);
        n = Array(R).fill(Math.max(1, Math.floor(all.length / R)));
      }
      let i = 0;
      rows = n.map((k) => all.slice(i, (i += k)));
    } else rows = Array.from({ length: R }, (_, r) => (srcRows[r] ?? srcRows[srcRows.length - 1]).slice(0, want?.[r] ?? Infinity));
    rows = rows.map((r) => (r.length ? r : [rows.find((x) => x.length)![0]]));
  }
  // repack into the engine's grid at the target scale, frame anchors aligned to the spec anchor
  const s = targetScale(rows[0][0].sc, true);
  const cw = fw * s, ch = fh * s;
  const cols = Math.max(...rows.map((r) => r.length));
  const c = rawCanvas(cols * cw, R * ch);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  const [ax, ay] = spec.anchor!;
  rows.forEach((row, r) =>
    row.forEach((fr, i) => {
      const k = s / fr.sc;
      // default: the spec anchor at the same relative spot of the source frame (centred feet)
      const [sax, say] = raw.opts.anchor ?? [(ax / fw) * fr.sw, (ay / fh) * fr.sh];
      ctx.save();
      ctx.beginPath();
      ctx.rect(i * cw, r * ch, cw, ch);
      ctx.clip();
      drawScaled(ctx, fr, k, i * cw + ax * s - sax * k, r * ch + ay * s - say * k);
      ctx.restore();
    })
  );
  return { img: c, scale: s, rowFrames: rows.map((r) => r.length) };
}

function resolveImage(spec: AssetSpec, raw: Raw, hi: boolean): Pick<Entry, 'img' | 'scale' | 'w' | 'h' | 'anchor'> {
  const r0 = raw.rows?.[0];
  const im = raw.image ?? (Array.isArray(r0) ? r0[0] : r0!); // an animated file for a still image: frame 0
  const fr: Frame = { src: im, sx: 0, sy: 0, sw: im.width, sh: im.height, sc: raw.opts.scale ?? im.width / spec.w };
  const a0 = spec.anchor ?? [0, 0];
  const anchor: [number, number] = raw.opts.anchor
    ? [raw.opts.anchor[0] / fr.sc, raw.opts.anchor[1] / fr.sc]
    : [((a0[0] / spec.w) * im.width) / fr.sc, ((a0[1] / spec.h) * im.height) / fr.sc];
  if (!hi) {
    // tiles, overlays, icons are blitted at natural size: always exactly the spec size
    if (im.width === spec.w && im.height === spec.h) return { img: im, scale: 1, w: spec.w, h: spec.h, anchor: a0 };
    const c = rawCanvas(spec.w, spec.h);
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    drawScaled(ctx, { ...fr, sc: im.width / spec.w }, spec.w / im.width, 0, 0);
    return { img: c, scale: 1, w: spec.w, h: spec.h, anchor: a0 };
  }
  const s = targetScale(fr.sc, true);
  if (s === fr.sc) return { img: im, scale: s, w: im.width / s, h: im.height / s, anchor };
  const k = s / fr.sc;
  const c = rawCanvas(im.width * k, im.height * k);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  drawScaled(ctx, fr, k, 0, 0);
  return { img: c, scale: s, w: c.width / s, h: c.height / s, anchor };
}

// ---------- registration ----------
function register(spec: AssetSpec, gen: () => HTMLCanvasElement, first?: HTMLCanvasElement): Entry {
  const e = registry.get(spec.key);
  if (e) return e;
  const raw = raws.get(spec.key);
  const rowFrames = spec.rowFrames ?? (spec.rows ? Array(spec.rows.length).fill(spec.frames ?? 1) : [1]);
  let entry: Entry = { spec, img: null as unknown as Img, scale: 1, w: spec.w, h: spec.h, anchor: spec.anchor ?? [0, 0], rowFrames, gen };
  if (raw) {
    try {
      if (spec.category === 'sheet') entry = { ...entry, ...resolveSheet(spec, raw) };
      else entry = { ...entry, ...resolveImage(spec, raw, spec.category === 'prop') };
      entry.file = raw.label;
    } catch (err) {
      console.warn('[assets] could not use', spec.key, err);
    }
    raws.delete(spec.key);
    halved.clear();
  }
  if (!entry.img) entry.img = first ?? gen();
  registry.set(spec.key, entry);
  return entry;
}

/** tiles, overlays, icons: an image at exactly the spec size */
export function asset(spec: AssetSpec, gen: () => HTMLCanvasElement): Img {
  return register(spec, gen).img;
}
/** sprite sheets: frame cells are (frameW, frameH) × entry.scale pixels */
export function sheetAsset(spec: AssetSpec, gen: () => HTMLCanvasElement): Entry {
  return register(spec, gen);
}
/** props & buildings: drawn at entry.w × entry.h game pixels with entry.anchor on the footprint centre */
export function propAsset(spec: AssetSpec, gen: () => HTMLCanvasElement, first?: HTMLCanvasElement): Entry {
  return register(spec, gen, first);
}

export function allAssets() {
  return [...registry.values()];
}

/** an <img>-usable URL for any registered image (files keep their own blob URL) */
export function imgUrl(img: Img) {
  let u = urls.get(img);
  if (!u) {
    if (img instanceof HTMLImageElement) u = img.src;
    else if (img instanceof HTMLCanvasElement) u = img.toDataURL();
    else {
      const c = rawCanvas(img.width, img.height);
      c.getContext('2d')!.drawImage(img, 0, 0);
      u = c.toDataURL();
    }
    urls.set(img, u);
  }
  return u;
}

function download(c: HTMLCanvasElement, name: string) {
  c.toBlob((b) => {
    if (!b) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, 'image/png');
}

/** download the procedural art for a key as PNG, rendered at `scale`× */
export function downloadAsset(key: string, scale = 1) {
  const e = registry.get(key);
  if (!e) return;
  const name = (e.spec.file.split('/').pop() || key).replace(/\.\w+$/, '') + (scale > 1 ? `@${scale}x` : '') + '.png';
  download(withArtScale(scale, e.gen), name);
}

export function manifestTemplate() {
  const o: Record<string, string> = {};
  for (const e of registry.values()) o[e.spec.key] = e.spec.file;
  return JSON.stringify({ maxScale, overrides: o }, null, 2);
}
