// ===== Core projection + world constants =====
// World units are TILES. 1 tile = 128x64 px isometric diamond (2:1 dimetric, Diablo/Commandos style)
export const TW = 128;
export const TH = 64;
export const HW = TW / 2;
export const HH = TH / 2;
export const MAP_W = 94;
export const MAP_H = 94;
/** collision cells per tile (2 => each cell is half a tile) */
export const CR = 4;
export const CW = MAP_W * CR;
export const CH = MAP_H * CR;

export const isoX = (x: number, y: number) => (x - y) * HW;
export const isoY = (x: number, y: number) => (x + y) * HH;

export function screenToWorld(sx: number, sy: number) {
  const a = sx / HW;
  const b = sy / HH;
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

/** convert a screen-space direction into a normalized world direction */
export function screenDirToWorld(dx: number, dy: number) {
  const a = dx / HW;
  const b = dy / HH;
  let x = (a + b) / 2;
  let y = (b - a) / 2;
  const l = Math.hypot(x, y) || 1;
  x /= l;
  y /= l;
  return { x, y };
}

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const randi = (a: number, b: number) => Math.floor(rand(a, b + 1));
export const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** deterministic RNG (mulberry32) for art + map generation */
export function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const RARITY = [
  { name: 'Common', color: '#d8d8d8', glow: '#ffffff' },
  { name: 'Uncommon', color: '#5fe37a', glow: '#5fe37a' },
  { name: 'Rare', color: '#4fb3ff', glow: '#4fb3ff' },
  { name: 'Epic', color: '#c46bff', glow: '#c46bff' },
  { name: 'Legendary', color: '#ffa53a', glow: '#ffb347' },
];

export const ELEM = {
  fire: { name: 'Burn', color: '#ff7a1a' },
  shock: { name: 'Shock', color: '#7fd8ff' },
  ecto: { name: 'Ecto', color: '#8dff5a' },
} as const;
export type Elem = keyof typeof ELEM;
