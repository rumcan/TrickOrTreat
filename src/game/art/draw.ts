import { TW, TH, HW, HH } from '../config';

export function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  const ctx = c.getContext('2d')!;
  return { c, ctx };
}

export function hexToRgb(hex: string) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
export function shade(hex: string, amt: number) {
  const { r, g, b } = hexToRgb(hex);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
export function rgba(hex: string, a: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** diamond path for a tile drawn with its top corner at (ox, oy) */
export function diamondPath(ctx: CanvasRenderingContext2D, ox = HW, oy = 0, w = TW, h = TH) {
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  ctx.lineTo(ox + w / 2, oy + h / 2);
  ctx.lineTo(ox, oy + h);
  ctx.lineTo(ox - w / 2, oy + h / 2);
  ctx.closePath();
}

/** Local iso projector: origin (ox,oy) is world (0,0,0) in pixels */
export function projector(ox: number, oy: number) {
  return (x: number, y: number, z = 0): [number, number] => [ox + (x - y) * HW, oy + (x + y) * HH - z];
}
export type Proj = ReturnType<typeof projector>;

export function poly(ctx: CanvasRenderingContext2D, pts: [number, number][], fill?: string | CanvasGradient, stroke?: string, lw = 1) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

/** Draw an iso box (top, +y face "left", +x face "right") */
export function isoBox(
  ctx: CanvasRenderingContext2D,
  P: Proj,
  x0: number, y0: number, x1: number, y1: number, z0: number, z1: number,
  top: string, left: string, right: string, outline = 'rgba(0,0,0,0.35)'
) {
  poly(ctx, [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)], left, outline);
  poly(ctx, [P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)], right, outline);
  poly(ctx, [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], top, outline);
}

/** quad lying on a face. face 'L' = plane y=Y, face 'R' = plane x=X; u along the face, z vertical */
export function faceQuad(P: Proj, face: 'L' | 'R', plane: number, u0: number, u1: number, z0: number, z1: number): [number, number][] {
  if (face === 'L') return [P(u0, plane, z0), P(u1, plane, z0), P(u1, plane, z1), P(u0, plane, z1)];
  return [P(plane, u0, z0), P(plane, u1, z0), P(plane, u1, z1), P(plane, u0, z1)];
}

export function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function radialGlow(size: number, color: string, inner = 1) {
  const { c, ctx } = makeCanvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, rgba(color, inner));
  g.addColorStop(0.35, rgba(color, inner * 0.45));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

/** solid-colour silhouette of a canvas (for hit flashes and x-ray outlines) */
export function tinted(src: HTMLCanvasElement | HTMLImageElement, color: string, alpha = 1) {
  const { c, ctx } = makeCanvas(src.width, src.height);
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

export const TILE_DIM = { w: TW, h: TH };
