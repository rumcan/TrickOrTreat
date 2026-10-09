// ===== Asset registry =====
// Every graphic in the game is registered here with an exact spec (size, frames, anchor, AI prompt).
// At boot we read /assets/manifest.json. Any key listed there is loaded from /assets/<file> (WEBP preferred)
// and REPLACES the procedural fallback. Everything else is drawn procedurally into canvases.

export type Img = HTMLCanvasElement | HTMLImageElement;

export type AssetCategory = 'tile' | 'overlay' | 'prop' | 'sheet' | 'icon' | 'fx';

export interface AssetSpec {
  key: string;
  file: string; // relative to /assets/
  category: AssetCategory;
  w: number;
  h: number;
  frameW?: number;
  frameH?: number;
  frames?: number;
  rows?: string[];
  /** pixel inside the image that sits on the world anchor (footprint centre on the ground) */
  anchor?: [number, number];
  footprint?: [number, number];
  desc: string;
  prompt: string;
}

interface Entry {
  spec: AssetSpec;
  img: Img;
  overridden: boolean;
}

const registry = new Map<string, Entry>();
const overrides = new Map<string, HTMLImageElement>();

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = src;
  });
}

export async function loadOverrides() {
  try {
    const base = (import.meta as unknown as { env: { BASE_URL: string } }).env.BASE_URL || './';
    const r = await fetch(`${base}assets/manifest.json`, { cache: 'no-cache' });
    if (!r.ok) return;
    const m = (await r.json()) as { overrides?: Record<string, string> };
    const entries = Object.entries(m.overrides || {});
    await Promise.all(
      entries.map(async ([key, file]) => {
        try {
          overrides.set(key, await loadImage(`${base}assets/${file}`));
        } catch {
          console.warn('[assets] failed override', key, file);
        }
      })
    );
  } catch {
    /* running from file:// or no manifest -> procedural only */
  }
}

/** get (or create) an asset. gen() draws the procedural fallback. */
export function asset(spec: AssetSpec, gen: () => HTMLCanvasElement): Img {
  const e = registry.get(spec.key);
  if (e) return e.img;
  const ov = overrides.get(spec.key);
  const img = ov ?? gen();
  registry.set(spec.key, { spec, img, overridden: !!ov });
  return img;
}

export function allAssets() {
  return [...registry.values()];
}

export function assetToWebp(img: Img, quality = 0.92) {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  c.getContext('2d')!.drawImage(img, 0, 0);
  return c.toDataURL('image/webp', quality);
}

export function downloadAsset(key: string) {
  const e = registry.get(key);
  if (!e) return;
  const a = document.createElement('a');
  a.href = assetToWebp(e.img);
  a.download = e.spec.file.split('/').pop() || key + '.webp';
  a.click();
}

export function manifestTemplate() {
  const o: Record<string, string> = {};
  for (const e of registry.values()) o[e.spec.key] = e.spec.file;
  return JSON.stringify({ overrides: o }, null, 2);
}
