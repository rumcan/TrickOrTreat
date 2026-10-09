import { TW, HW, HH, makeRng } from '../config';
import { makeCanvas, rawCanvas, projector, poly, isoBox, faceQuad, shade, rgba, ellipse, circle, Proj } from './draw';
import { propAsset, sheetAsset, Img } from '../assets';
import type { Sheet } from './characters';

export interface PropLight { x: number; y: number; r: number; color: string; i: number }
export interface PropSprite {
  img: Img;
  /** anchor (footprint centre) and drawn size, in game pixels */
  ax: number;
  ay: number;
  w: number;
  h: number;
  /** footprint in tiles */
  fw: number;
  fh: number;
  lights: PropLight[];
}

/** buildings get their own folder in /assets so they're easy to find and replace */
const BUILDINGS = new Set(['crypt', 'candy_stand', 'school', 'arcade', 'diner', 'video', 'watertower', 'church', 'drivein_screen', 'snack_bar', 'video_rental', 'primary_school', 'barn', 'gazebo']);

const STYLE =
  'Isometric 2:1 (Diablo II / Commandos camera) hand-painted pixel-art game sprite on a transparent background, Halloween night in 1990s American suburbia, cold blue moonlight from the upper-left, warm orange practical lights, crisp dark outline, no ground/background, no cast shadow (engine draws shadows).';

const cache = new Map<string, PropSprite>();
function cached(key: string, make: () => PropSprite) {
  let s = cache.get(key);
  if (!s) {
    s = make();
    cache.set(key, s);
  }
  return s;
}

function flipCanvas(src: Img) {
  const c = rawCanvas(src.width, src.height);
  const ctx = c.getContext('2d')!;
  ctx.translate(src.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  return c;
}

// =============== HOUSES ===============
const HOUSES = [
  { fw: 4, fh: 3, wall: '#5e4f7e', trim: '#e6dfcc', roof: '#2b2635', door: '#7a1d24', st: 1 },
  { fw: 4, fh: 3, wall: '#3f6b6a', trim: '#efe8d6', roof: '#2a2f33', door: '#2c2a26', st: 2 },
  { fw: 3, fh: 3, wall: '#a07c3e', trim: '#f0e6cc', roof: '#3a2a26', door: '#2e4a2a', st: 2 },
  { fw: 4, fh: 3, wall: '#7a443d', trim: '#e9dcc4', roof: '#25232b', door: '#1f2a3d', st: 1 },
  { fw: 3, fh: 3, wall: '#57626e', trim: '#ddd8cc', roof: '#2d2b34', door: '#8a5a1e', st: 1 },
  { fw: 4, fh: 3, wall: '#6f7650', trim: '#ece4cf', roof: '#33282a', door: '#5a1f3a', st: 2 },
];
export const HOUSE_COUNT = HOUSES.length;
export function houseDims(v: number) {
  const h = HOUSES[v % HOUSES.length];
  return { fw: h.fw, fh: h.fh };
}

function siding(ctx: CanvasRenderingContext2D, P: Proj, face: 'L' | 'R', plane: number, u0: number, u1: number, z0: number, z1: number, col: string) {
  ctx.strokeStyle = col;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let z = z0 + 6; z < z1; z += 7) {
    const q = faceQuad(P, face, plane, u0, u1, z, z);
    ctx.moveTo(q[0][0], q[0][1]);
    ctx.lineTo(q[1][0], q[1][1]);
  }
  ctx.stroke();
}

function windowOn(ctx: CanvasRenderingContext2D, P: Proj, face: 'L' | 'R', plane: number, u: number, z: number, w: number, h: number, lit: boolean, trim: string, shutter: string) {
  const u0 = u - w / 2, u1 = u + w / 2;
  // shutters
  poly(ctx, faceQuad(P, face, plane, u0 - 0.14, u0 - 0.02, z, z + h), shutter, 'rgba(0,0,0,0.5)');
  poly(ctx, faceQuad(P, face, plane, u1 + 0.02, u1 + 0.14, z, z + h), shutter, 'rgba(0,0,0,0.5)');
  poly(ctx, faceQuad(P, face, plane, u0 - 0.03, u1 + 0.03, z - 3, z + h + 3), trim, 'rgba(0,0,0,0.5)');
  const g = faceQuad(P, face, plane, u0, u1, z, z + h);
  if (lit) {
    const gr = ctx.createLinearGradient(g[0][0], g[0][1], g[3][0], g[3][1]);
    gr.addColorStop(0, '#ffb43c');
    gr.addColorStop(1, '#ffe08a');
    poly(ctx, g, gr);
  } else {
    const gr = ctx.createLinearGradient(g[0][0], g[0][1], g[2][0], g[2][1]);
    gr.addColorStop(0, '#17203a');
    gr.addColorStop(0.6, '#2c3d66');
    gr.addColorStop(1, '#141a2c');
    poly(ctx, g, gr);
  }
  // mullions
  ctx.strokeStyle = trim;
  ctx.lineWidth = 2;
  const mid = faceQuad(P, face, plane, u, u, z, z + h);
  const hz = faceQuad(P, face, plane, u0, u1, z + h / 2, z + h / 2);
  ctx.beginPath();
  ctx.moveTo(mid[0][0], mid[0][1]); ctx.lineTo(mid[2][0], mid[2][1]);
  ctx.moveTo(hz[0][0], hz[0][1]); ctx.lineTo(hz[1][0], hz[1][1]);
  ctx.stroke();
  // sill
  poly(ctx, faceQuad(P, face, plane, u0 - 0.06, u1 + 0.06, z - 5, z - 2), shade(trim, -0.1));
}

function smallPumpkin(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ellipse(ctx, x, y + s * 0.2, s * 1.1, s * 0.4, 'rgba(0,0,0,0.35)');
  for (let i = -2; i <= 2; i++) ellipse(ctx, x + i * s * 0.32, y - s * 0.5, s * 0.45, s * 0.62, i % 2 ? '#d9661c' : '#ee7a22');
  ctx.fillStyle = '#ffe07a';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.5, y - s * 0.7); ctx.lineTo(x - s * 0.25, y - s * 0.45); ctx.lineTo(x - s * 0.6, y - s * 0.45); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + s * 0.5, y - s * 0.7); ctx.lineTo(x + s * 0.25, y - s * 0.45); ctx.lineTo(x + s * 0.6, y - s * 0.45); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - s * 0.55, y - s * 0.3); ctx.quadraticCurveTo(x, y, x + s * 0.55, y - s * 0.3); ctx.quadraticCurveTo(x, y - s * 0.12, x - s * 0.55, y - s * 0.3); ctx.fill();
  ctx.fillStyle = '#4a5a22';
  ctx.fillRect(x - 1.5, y - s * 1.2, 3, s * 0.3);
}

function genHouse(v: number) {
  const H = HOUSES[v];
  const r = makeRng(900 + v * 31);
  const { fw, fh } = H;
  const wallH = H.st === 2 ? 148 : 92;
  const roofH = 70;
  const pad = 30;
  const W = (fw + fh) * HW + pad * 2;
  const Hh = (fw + fh) * HH + wallH + roofH + pad * 2 + 30;
  const { c, ctx } = makeCanvas(W, Hh);
  const ox = fh * HW + pad, oy = wallH + roofH + pad + 30;
  const P = projector(ox, oy);
  const wallL = H.wall, wallR = shade(H.wall, -0.38);
  const lights: PropLight[] = [];

  // foundation
  isoBox(ctx, P, -0.02, -0.02, fw + 0.02, fh + 0.02, 0, 10, '#555', '#5b5652', '#3b3734');
  // right face (x = fw)
  const rq = faceQuad(P, 'R', fw, 0, fh, 10, wallH);
  const rg = ctx.createLinearGradient(rq[0][0], rq[0][1], rq[1][0], rq[1][1]);
  rg.addColorStop(0, wallR); rg.addColorStop(1, shade(H.wall, -0.5));
  poly(ctx, rq, rg, 'rgba(0,0,0,0.6)');
  siding(ctx, P, 'R', fw, 0, fh, 10, wallH, 'rgba(0,0,0,0.22)');
  // left face (y = fh)
  const lq = faceQuad(P, 'L', fh, 0, fw, 10, wallH);
  const lg = ctx.createLinearGradient(lq[0][0], lq[3][1], lq[0][0], lq[0][1]);
  lg.addColorStop(0, shade(wallL, 0.08)); lg.addColorStop(1, shade(wallL, -0.15));
  poly(ctx, lq, lg, 'rgba(0,0,0,0.6)');
  siding(ctx, P, 'L', fh, 0, fw, 10, wallH, 'rgba(0,0,0,0.18)');
  // corner trim
  poly(ctx, [P(fw, fh, 10), P(fw - 0.06, fh, 10), P(fw - 0.06, fh, wallH), P(fw, fh, wallH)], H.trim);
  poly(ctx, [P(0, fh, 10), P(0.06, fh, 10), P(0.06, fh, wallH), P(0, fh, wallH)], H.trim);
  const shutter = shade(H.wall, -0.55);

  // door + porch on left face
  const doorU = fw >= 4 ? 1.35 : fw / 2;
  // porch slab
  isoBox(ctx, P, doorU - 0.55, fh, doorU + 0.55, fh + 0.45, 0, 7, '#8a847c', '#6e6962', '#57534d');
  isoBox(ctx, P, doorU - 0.4, fh + 0.45, doorU + 0.4, fh + 0.62, 0, 3, '#7c766f', '#615c56', '#4c4843');
  poly(ctx, faceQuad(P, 'L', fh, doorU - 0.26, doorU + 0.26, 10, 70), H.trim, 'rgba(0,0,0,0.6)');
  poly(ctx, faceQuad(P, 'L', fh, doorU - 0.21, doorU + 0.21, 10, 66), H.door, 'rgba(0,0,0,0.6)');
  poly(ctx, faceQuad(P, 'L', fh, doorU - 0.15, doorU + 0.15, 46, 60), '#ffcf6a');
  const kn = P(doorU + 0.13, fh, 36);
  circle(ctx, kn[0], kn[1], 1.6, '#e8c24a');
  // porch lamp
  const lp = P(doorU + 0.36, fh, 62);
  circle(ctx, lp[0], lp[1], 7, rgba('#ffd27a', 0.25));
  circle(ctx, lp[0], lp[1], 3.2, '#fff1b8');
  lights.push({ x: doorU, y: fh + 0.6, r: 3.2, color: '#ffbe5c', i: 0.9 });
  // porch pumpkins
  const pp = P(doorU - 0.45, fh + 0.3, 7);
  smallPumpkin(ctx, pp[0], pp[1], 8);
  const pp2 = P(doorU + 0.45, fh + 0.32, 7);
  smallPumpkin(ctx, pp2[0], pp2[1], 6);

  // windows left face
  const winH = 34;
  for (let s = 0; s < H.st; s++) {
    const z = 30 + s * 58;
    for (let u = 0.55; u < fw - 0.3; u += 1.05) {
      if (s === 0 && Math.abs(u - doorU) < 0.65) continue;
      const lit = r() < 0.6;
      windowOn(ctx, P, 'L', fh, u, z, 0.44, winH, lit, H.trim, shutter);
      if (lit) lights.push({ x: u, y: fh + 0.5, r: 2.0, color: '#ffb347', i: 0.45 });
    }
    for (let u = 0.8; u < fh - 0.3; u += 1.4) {
      const lit = r() < 0.5;
      windowOn(ctx, P, 'R', fw, u, z, 0.42, winH, lit, shade(H.trim, -0.35), shade(shutter, -0.3));
      if (lit) lights.push({ x: fw + 0.5, y: u, r: 1.8, color: '#ffb347', i: 0.35 });
    }
  }
  // cobweb on front corner
  const cw = P(fw, fh, wallH - 2);
  ctx.strokeStyle = 'rgba(230,230,240,0.55)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let a = 0; a < 5; a++) {
    const ang = Math.PI * 0.55 + (a / 4) * Math.PI * 0.4;
    ctx.moveTo(cw[0], cw[1]);
    ctx.lineTo(cw[0] + Math.cos(ang) * 26, cw[1] + Math.sin(ang) * 26);
  }
  for (let k = 1; k <= 3; k++) {
    ctx.moveTo(cw[0] + Math.cos(Math.PI * 0.55) * k * 8, cw[1] + Math.sin(Math.PI * 0.55) * k * 8);
    ctx.arc(cw[0], cw[1], k * 8, Math.PI * 0.55, Math.PI * 0.95);
  }
  ctx.stroke();

  // ===== roof (gable, ridge along x) =====
  const o = 0.2;
  const top = wallH + roofH;
  const roofC = H.roof;
  // back plane
  poly(ctx, [P(-o, -o, wallH), P(fw + o, -o, wallH), P(fw + o, fh / 2, top), P(-o, fh / 2, top)], shade(roofC, -0.2), 'rgba(0,0,0,0.6)');
  // chimney
  const chx = fw * 0.72;
  isoBox(ctx, P, chx, fh * 0.18, chx + 0.42, fh * 0.18 + 0.42, wallH + 20, top + 26, '#8a3e2e', '#7a3426', '#5a251b');
  isoBox(ctx, P, chx - 0.04, fh * 0.18 - 0.04, chx + 0.46, fh * 0.18 + 0.46, top + 26, top + 32, '#6a6a6a', '#555', '#444');
  // gable end (x = fw)
  poly(ctx, [P(fw, 0, wallH), P(fw, fh, wallH), P(fw, fh / 2, top - 6)], shade(H.wall, -0.45), 'rgba(0,0,0,0.6)');
  const at = P(fw, fh / 2, wallH + roofH * 0.42);
  ellipse(ctx, at[0], at[1], 6, 9, H.trim);
  ellipse(ctx, at[0], at[1], 4, 7, r() < 0.5 ? '#ffcb62' : '#1d2640');
  // front plane
  const fp: [number, number][] = [P(-o, fh / 2, top), P(fw + o, fh / 2, top), P(fw + o, fh + o, wallH), P(-o, fh + o, wallH)];
  const fg = ctx.createLinearGradient(fp[0][0], fp[0][1], fp[3][0], fp[3][1]);
  fg.addColorStop(0, shade(roofC, 0.28));
  fg.addColorStop(1, shade(roofC, -0.05));
  poly(ctx, fp, fg, 'rgba(0,0,0,0.7)');
  // shingles
  const rows = 9;
  for (let k = 1; k < rows; k++) {
    const t = k / rows;
    const yy = fh / 2 + (fh / 2 + o) * t;
    const zz = top - roofH * t;
    const a = P(-o, yy, zz), b = P(fw + o, yy, zz);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    // staggered tab marks
    const steps = Math.floor((fw + 2 * o) / 0.16);
    ctx.beginPath();
    for (let s = 0; s < steps; s++) {
      const xx = -o + s * 0.16 + (k % 2) * 0.08;
      const p1 = P(xx, yy, zz);
      const tt = (k - 1) / rows;
      const p2 = P(xx, fh / 2 + (fh / 2 + o) * tt, top - roofH * tt);
      ctx.moveTo(p1[0], p1[1]);
      ctx.lineTo(p2[0], p2[1]);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.stroke();
  }
  // ridge cap + moon highlight
  const ra = P(-o, fh / 2, top), rb = P(fw + o, fh / 2, top);
  ctx.strokeStyle = 'rgba(190,210,255,0.55)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(ra[0], ra[1]); ctx.lineTo(rb[0], rb[1]); ctx.stroke();
  // barge boards at x=fw+o end
  ctx.strokeStyle = H.trim;
  ctx.lineWidth = 3;
  const e1 = P(fw + o, -o, wallH), e3 = P(fw + o, fh + o, wallH);
  ctx.beginPath(); ctx.moveTo(e1[0], e1[1]); ctx.lineTo(rb[0], rb[1]); ctx.lineTo(e3[0], e3[1]); ctx.stroke();
  // fascia along front eave
  poly(ctx, [P(-o, fh + o, wallH), P(fw + o, fh + o, wallH), P(fw + o, fh + o, wallH - 6), P(-o, fh + o, wallH - 6)], H.trim, 'rgba(0,0,0,0.5)');
  // string lights
  const cols = ['#ff8a1e', '#b44dff', '#7dff5a', '#ff8a1e'];
  for (let i = 0, x = -o + 0.1; x < fw + o; x += 0.22, i++) {
    const sag = Math.sin((x * Math.PI) / 0.66) * 3;
    const p = P(x, fh + o, wallH - 9 - Math.abs(sag));
    circle(ctx, p[0], p[1], 5, rgba(cols[i % 4], 0.25));
    circle(ctx, p[0], p[1], 2, cols[i % 4]);
  }
  // bat silhouettes on roof
  for (let i = 0; i < 2; i++) {
    const p = P(fw * (0.25 + i * 0.35), fh / 2 + 0.5, top - 14);
    ctx.fillStyle = '#0d0b12';
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    ctx.quadraticCurveTo(p[0] - 6, p[1] - 6, p[0] - 12, p[1] - 2);
    ctx.quadraticCurveTo(p[0] - 7, p[1] - 1, p[0], p[1] + 3);
    ctx.quadraticCurveTo(p[0] + 7, p[1] - 1, p[0] + 12, p[1] - 2);
    ctx.quadraticCurveTo(p[0] + 6, p[1] - 6, p[0], p[1]);
    ctx.fill();
  }
  const [ax, ay] = P(fw / 2, fh / 2, 0);
  return { c, ax, ay, fw, fh, lights };
}

export function getHouse(v: number, flip: boolean): PropSprite {
  const base = cached('house' + v, () => {
    const g = genHouse(v);
    const e = propAsset(
      {
        key: `house_${v}`, file: `buildings/house_${v}.png`, category: 'prop', w: g.c.width, h: g.c.height,
        anchor: [Math.round(g.ax), Math.round(g.ay)], footprint: [g.fw, g.fh],
        desc: `${HOUSES[v].st === 2 ? 'Two' : 'One'}-storey suburban house, footprint ${g.fw}x${g.fh} tiles, gable roof ridge along world X, front door + porch on the visible lower-left face`,
        prompt: `${STYLE} A ${HOUSES[v].st === 2 ? 'two' : 'one'}-storey wooden-siding suburban house (wall colour ${HOUSES[v].wall}), gable roof, footprint exactly ${g.fw} tiles (along lower-right axis) by ${g.fh} tiles, decorated for Halloween: string lights, cobwebs, carved pumpkins on porch, warm lit windows. Footprint centre must sit on pixel (${Math.round(g.ax)},${Math.round(g.ay)}).`,
      },
      () => genHouse(v).c,
      g.c
    );
    return { img: e.img, ax: e.anchor[0], ay: e.anchor[1], w: e.w, h: e.h, fw: g.fw, fh: g.fh, lights: g.lights };
  });
  if (!flip) return base;
  return cached('houseF' + v, () => mirrored(base));
}

/** a prop mirrored left-right: the footprint swaps axes */
function mirrored(base: PropSprite): PropSprite {
  return {
    img: flipCanvas(base.img),
    ax: base.w - base.ax,
    ay: base.ay,
    w: base.w,
    h: base.h,
    fw: base.fh,
    fh: base.fw,
    lights: base.lights.map((l) => ({ ...l, x: l.y, y: l.x })),
  };
}

// =============== SMALL PROP HELPERS ===============
function small(W: number, Hh: number, draw: (ctx: CanvasRenderingContext2D, P: Proj, ax: number, ay: number) => void) {
  const { c, ctx } = makeCanvas(W, Hh);
  const ax = W / 2, ay = Hh - 36;
  const P = projector(ax, ay - HH); // world (0,0) of the tile -> footprint centre at (0.5,0.5)
  draw(ctx, P, ax, ay);
  return { c, ax, ay };
}

function reg(key: string, desc: string, prompt: string, fw: number, fh: number, make: () => { c: HTMLCanvasElement; ax: number; ay: number }, lights: PropLight[] = []): PropSprite {
  return cached(key, () => {
    const m = make();
    const e = propAsset(
      { key, file: `${BUILDINGS.has(key) ? 'buildings' : 'props'}/${key}.png`, category: 'prop', w: m.c.width, h: m.c.height, anchor: [m.ax, m.ay], footprint: [fw, fh], desc, prompt: `${STYLE} ${prompt} Footprint ${fw}x${fh} tile(s); footprint centre on pixel (${m.ax},${m.ay}).` },
      () => make().c,
      m.c
    );
    return { img: e.img, ax: e.anchor[0], ay: e.anchor[1], w: e.w, h: e.h, fw, fh, lights };
  });
}

function blobCluster(ctx: CanvasRenderingContext2D, r: () => number, cx: number, cy: number, w: number, h: number, n: number, cols: string[], rad: number) {
  const pts: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r());
    pts.push([cx + Math.cos(a) * d * w, cy + Math.sin(a) * d * h, rad * (0.7 + r() * 0.5)]);
  }
  pts.sort((a, b) => a[1] - b[1]);
  for (const [x, y, rr] of pts) {
    circle(ctx, x + 2, y + 3, rr, 'rgba(0,0,0,0.35)');
    circle(ctx, x, y, rr, cols[0]);
    circle(ctx, x - rr * 0.25, y - rr * 0.25, rr * 0.7, cols[1]);
    circle(ctx, x - rr * 0.4, y - rr * 0.45, rr * 0.35, cols[2]);
  }
}

export function getTree(kind: 'oak' | 'dead' | 'pine', v = 0): PropSprite {
  const key = `tree_${kind}_${v}`;
  if (kind === 'oak') {
    return reg(key, 'Autumn oak tree with orange/red canopy', 'A round autumn oak tree, thick dark trunk, dense orange-red-yellow leaf canopy ~150px wide.', 1, 1, () =>
      small(180, 250, (ctx, _P, ax, ay) => {
        const r = makeRng(300 + v);
        ctx.fillStyle = '#2e1f17';
        ctx.beginPath();
        ctx.moveTo(ax - 9, ay); ctx.quadraticCurveTo(ax - 5, ay - 40, ax - 12, ay - 80);
        ctx.lineTo(ax + 10, ay - 80); ctx.quadraticCurveTo(ax + 5, ay - 40, ax + 9, ay);
        ctx.fill();
        ctx.fillStyle = '#4a3326';
        ctx.fillRect(ax - 6, ay - 70, 4, 66);
        const pal = v % 2 ? ['#7a2a14', '#b8461c', '#e0802e'] : ['#7a4a10', '#c27a1c', '#ecb23a'];
        blobCluster(ctx, r, ax, ay - 125, 58, 42, 26, pal, 26);
        blobCluster(ctx, r, ax - 8, ay - 140, 36, 26, 10, [pal[1], pal[2], '#ffd27a'], 18);
      })
    );
  }
  if (kind === 'pine') {
    return reg(key, 'Dark pine tree', 'A tall dark blue-green pine tree, layered conical branches, moonlit left edges.', 1, 1, () =>
      small(150, 270, (ctx, _P, ax, ay) => {
        ctx.fillStyle = '#2a1d16';
        ctx.fillRect(ax - 6, ay - 34, 12, 34);
        for (let i = 0; i < 5; i++) {
          const y = ay - 30 - i * 38, w = 62 - i * 10;
          ctx.fillStyle = '#132a24';
          ctx.beginPath(); ctx.moveTo(ax - w, y); ctx.lineTo(ax, y - 70); ctx.lineTo(ax + w, y); ctx.quadraticCurveTo(ax, y + 12, ax - w, y); ctx.fill();
          ctx.fillStyle = '#21443a';
          ctx.beginPath(); ctx.moveTo(ax - w, y); ctx.lineTo(ax, y - 70); ctx.lineTo(ax - 4, y + 6); ctx.fill();
          ctx.fillStyle = 'rgba(170,200,255,0.18)';
          ctx.beginPath(); ctx.moveTo(ax - w, y); ctx.lineTo(ax, y - 70); ctx.lineTo(ax - w * 0.6, y - 2); ctx.fill();
        }
      })
    );
  }
  return reg(key, 'Gnarled dead tree', 'A spooky leafless gnarled dead tree with twisting branches, almost black bark.', 1, 1, () =>
    small(200, 260, (ctx, _P, ax, ay) => {
      const r = makeRng(700 + v);
      const branch = (x: number, y: number, a: number, len: number, w: number, d: number) => {
        const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
        ctx.strokeStyle = '#1b1411';
        ctx.lineWidth = w;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + Math.cos(a + 0.4) * len * 0.5, y + Math.sin(a + 0.4) * len * 0.5, x2, y2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(150,170,220,0.25)';
        ctx.lineWidth = Math.max(1, w * 0.3);
        ctx.beginPath(); ctx.moveTo(x - w * 0.3, y); ctx.lineTo(x2 - w * 0.3, y2); ctx.stroke();
        if (d > 0) {
          const n = 2 + (r() < 0.4 ? 1 : 0);
          for (let i = 0; i < n; i++) branch(x2, y2, a + (r() - 0.5) * 1.4, len * (0.6 + r() * 0.2), w * 0.62, d - 1);
        }
      };
      branch(ax, ay, -Math.PI / 2, 70, 14, 4);
    })
  );
}

export function getBush(v = 0) {
  return reg(`bush_${v}`, 'Round garden shrub', 'A round dark-green garden shrub about 80px wide, 50px tall.', 1, 1, () =>
    small(128, 110, (ctx, _P, ax, ay) => {
      const r = makeRng(40 + v);
      blobCluster(ctx, r, ax, ay - 22, 30, 14, 14, ['#1b3a20', '#2c5a2e', '#4b7d3e'], 14);
    })
  );
}

export function getHedge() {
  return reg('hedge', 'Square trimmed hedge block (tiles together)', 'A trimmed boxwood hedge block filling the tile, 44px tall, leafy texture, tiles seamlessly with neighbours.', 1, 1, () =>
    small(128, 130, (ctx, P) => {
      const r = makeRng(5);
      isoBox(ctx, P, 0.04, 0.04, 0.96, 0.96, 0, 44, '#2f5a2c', '#244a24', '#183618');
      for (let i = 0; i < 160; i++) {
        const x = 0.05 + r() * 0.9, y = 0.05 + r() * 0.9;
        const p = P(x, y, 44);
        circle(ctx, p[0], p[1], 1.6, r() < 0.5 ? '#3f7438' : '#1f4220');
      }
      for (let i = 0; i < 120; i++) {
        const u = r() * 0.92 + 0.04, z = r() * 42;
        const pl = P(u, 0.96, z);
        circle(ctx, pl[0], pl[1], 1.4, r() < 0.5 ? '#31602c' : '#1a3a1a');
        const pr = P(0.96, u, z);
        circle(ctx, pr[0], pr[1], 1.4, r() < 0.5 ? '#21421f' : '#122812');
      }
    })
  );
}

export function getFence(kind: 'picket' | 'iron', axis: 'x' | 'y') {
  const key = `fence_${kind}_${axis}`;
  return reg(key, `${kind === 'picket' ? 'White picket' : 'Wrought-iron cemetery'} fence segment running along world ${axis.toUpperCase()} through the tile centre`, kind === 'picket' ? 'A weathered white wooden picket fence segment, 30px tall, two rails, pointed pickets.' : 'A black wrought-iron fence segment with spear-tip bars, 48px tall.', 1, 1, () =>
    small(128, 140, (ctx, P0) => {
      const P = axis === 'x' ? P0 : (x: number, y: number, z = 0) => P0(y, x, z);
      if (kind === 'picket') {
        for (const z of [9, 21]) poly(ctx, [P(0, 0.5, z), P(1, 0.5, z), P(1, 0.5, z + 3), P(0, 0.5, z + 3)], '#a9a293');
        for (let x = 0.05; x < 1; x += 0.1) {
          const a = P(x - 0.03, 0.5, 0), b = P(x + 0.03, 0.5, 0), tb = P(x + 0.03, 0.5, 28), tp = P(x, 0.5, 33), ta = P(x - 0.03, 0.5, 28);
          poly(ctx, [a, b, tb, tp, ta], axis === 'x' ? '#d8d1c0' : '#b9b2a2', 'rgba(0,0,0,0.55)');
        }
      } else {
        for (const z of [8, 38]) poly(ctx, [P(0, 0.5, z), P(1, 0.5, z), P(1, 0.5, z + 2.5), P(0, 0.5, z + 2.5)], '#15141a');
        for (let x = 0.04; x < 1; x += 0.08) {
          const a = P(x, 0.5, 0), b = P(x, 0.5, 46);
          ctx.strokeStyle = '#0f0e13';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
          ctx.fillStyle = '#2a2833';
          ctx.beginPath(); ctx.moveTo(b[0] - 2.5, b[1] + 1); ctx.lineTo(b[0], b[1] - 6); ctx.lineTo(b[0] + 2.5, b[1] + 1); ctx.fill();
          ctx.strokeStyle = 'rgba(160,180,230,0.35)';
          ctx.lineWidth = 0.7;
          ctx.beginPath(); ctx.moveTo(a[0] - 0.8, a[1]); ctx.lineTo(b[0] - 0.8, b[1]); ctx.stroke();
        }
      }
    })
  );
}

export function getGrave(v: number) {
  return reg(`grave_${v}`, ['Rounded headstone', 'Stone cross grave', 'Small obelisk grave'][v % 3], 'A weathered grey cemetery gravestone with moss, engraved RIP, facing lower-left.', 1, 1, () =>
    small(128, 130, (ctx, P, ax, ay) => {
      // dirt mound
      ellipse(ctx, ax, ay + 6, 26, 10, '#33261d');
      ellipse(ctx, ax, ay + 4, 22, 8, '#3f2f24');
      if (v % 3 === 0) {
        isoBox(ctx, P, 0.28, 0.42, 0.72, 0.56, 0, 34, '#8a8a90', '#76767c', '#55555b');
        const a = P(0.28, 0.56, 34), b = P(0.72, 0.56, 34), m = P(0.5, 0.49, 50);
        ctx.fillStyle = '#76767c';
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(m[0] - 18, m[1] - 4, m[0], m[1]); ctx.quadraticCurveTo(m[0] + 18, m[1] - 4, b[0], b[1]); ctx.fill();
        const t = P(0.5, 0.56, 24);
        ctx.fillStyle = '#3a3a40';
        ctx.font = 'bold 9px monospace';
        ctx.fillText('RIP', t[0] - 9, t[1]);
      } else if (v % 3 === 1) {
        isoBox(ctx, P, 0.44, 0.44, 0.56, 0.56, 0, 50, '#8d8d93', '#77777d', '#57575d');
        isoBox(ctx, P, 0.3, 0.44, 0.7, 0.56, 30, 40, '#8d8d93', '#77777d', '#57575d');
      } else {
        isoBox(ctx, P, 0.32, 0.32, 0.68, 0.68, 0, 10, '#7d7d83', '#69696f', '#4b4b51');
        isoBox(ctx, P, 0.4, 0.4, 0.6, 0.6, 10, 56, '#9a9aa0', '#808086', '#5d5d63');
        const t = P(0.5, 0.5, 66);
        ctx.fillStyle = '#9a9aa0';
        const l = P(0.4, 0.6, 56), rr = P(0.6, 0.6, 56), rb = P(0.6, 0.4, 56);
        ctx.beginPath(); ctx.moveTo(l[0], l[1]); ctx.lineTo(t[0], t[1]); ctx.lineTo(rr[0], rr[1]); ctx.fill();
        ctx.fillStyle = '#6a6a70';
        ctx.beginPath(); ctx.moveTo(rr[0], rr[1]); ctx.lineTo(t[0], t[1]); ctx.lineTo(rb[0], rb[1]); ctx.fill();
      }
      // moss
      const r = makeRng(v + 11);
      for (let i = 0; i < 10; i++) {
        const p = P(0.3 + r() * 0.4, 0.56, r() * 14);
        circle(ctx, p[0], p[1], 1.5, 'rgba(70,110,50,0.8)');
      }
    })
  );
}

export function getCrypt() {
  return reg('crypt', 'Stone mausoleum / crypt, 3x2 tiles, columns and pediment on the lower-left face', 'A gothic stone mausoleum with four columns, triangular pediment, iron door glowing faint green inside, moss and cracks.', 3, 2, () => {
    const fw = 3, fh = 2;
    const W = (fw + fh) * HW + 40, Hh = (fw + fh) * HH + 200;
    const { c, ctx } = makeCanvas(W, Hh);
    const ox = fh * HW + 20, oy = 170;
    const P = projector(ox, oy);
    isoBox(ctx, P, -0.1, -0.1, fw + 0.1, fh + 0.25, 0, 12, '#77777c', '#606065', '#47474c');
    isoBox(ctx, P, 0.2, 0.1, fw - 0.2, fh - 0.3, 12, 110, '#8a8a90', '#6f6f75', '#4d4d53');
    // door
    poly(ctx, faceQuad(P, 'L', fh - 0.3, 1.15, 1.85, 12, 76), '#0d1410');
    poly(ctx, faceQuad(P, 'L', fh - 0.3, 1.2, 1.8, 12, 72), 'rgba(90,255,120,0.18)');
    ctx.strokeStyle = '#2b2f2b';
    ctx.lineWidth = 2;
    for (let u = 1.25; u < 1.8; u += 0.11) {
      const q = faceQuad(P, 'L', fh - 0.3, u, u, 12, 72);
      ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1]); ctx.lineTo(q[2][0], q[2][1]); ctx.stroke();
    }
    // columns
    for (const u of [0.35, 0.95, 2.05, 2.65]) {
      isoBox(ctx, P, u - 0.1, fh - 0.05, u + 0.1, fh + 0.15, 12, 112, '#a3a3a9', '#8d8d93', '#68686e');
    }
    // roof slab + pediment
    isoBox(ctx, P, 0.05, -0.05, fw - 0.05, fh + 0.2, 112, 124, '#9c9ca2', '#838389', '#5f5f65');
    const a = P(0.05, fh + 0.2, 124), b = P(fw - 0.05, fh + 0.2, 124), t = P(fw / 2, fh + 0.2, 170);
    poly(ctx, [a, b, t], '#909096', 'rgba(0,0,0,0.6)');
    const ta = P(0.25, fh + 0.2, 128), tb = P(fw - 0.25, fh + 0.2, 128), tt = P(fw / 2, fh + 0.2, 160);
    poly(ctx, [ta, tb, tt], '#7a7a80');
    const sk = P(fw / 2, fh + 0.2, 140);
    circle(ctx, sk[0], sk[1], 6, '#d9d6cc');
    circle(ctx, sk[0] - 2, sk[1] - 1, 1.5, '#111');
    circle(ctx, sk[0] + 2, sk[1] - 1, 1.5, '#111');
    const r = makeRng(66);
    for (let i = 0; i < 40; i++) {
      const p = P(0.2 + r() * (fw - 0.4), fh - 0.3, 12 + r() * 30);
      circle(ctx, p[0], p[1], 1.5 + r(), 'rgba(60,100,50,0.7)');
    }
    const [ax, ay] = P(fw / 2, fh / 2, 0);
    return { c, ax, ay };
  }, [{ x: 1.5, y: 2.2, r: 2.2, color: '#5aff7a', i: 0.5 }]);
}

export function getPumpkin(v = 0) {
  return reg(`pumpkin_${v}`, 'Carved glowing jack-o-lantern (light source)', 'A carved orange jack-o-lantern with a glowing yellow triangular face, small green stem.', 1, 1, () =>
    small(128, 100, (ctx, _P, ax, ay) => {
      smallPumpkin(ctx, ax - (v ? 10 : 0), ay + 2, v ? 12 : 16);
      if (v) smallPumpkin(ctx, ax + 14, ay + 6, 9);
    }), [{ x: 0.5, y: 0.5, r: 1.6, color: '#ff9a2a', i: 0.8 }]);
}

export function getLamp() {
  return reg('streetlamp', 'Suburban street lamp (strong light source)', 'A tall dark-green cast-iron street lamp ~180px tall with a glowing warm lantern head.', 1, 1, () =>
    small(80, 240, (ctx, _P, ax, ay) => {
      ellipse(ctx, ax, ay, 9, 4, '#1a1f1c');
      ctx.fillStyle = '#1f2a24';
      ctx.fillRect(ax - 6, ay - 14, 12, 14);
      ctx.fillRect(ax - 3, ay - 180, 6, 170);
      ctx.fillStyle = 'rgba(160,190,240,0.3)';
      ctx.fillRect(ax - 3, ay - 180, 2, 170);
      ctx.fillStyle = '#1f2a24';
      ctx.beginPath(); ctx.moveTo(ax - 14, ay - 184); ctx.lineTo(ax + 14, ay - 184); ctx.lineTo(ax + 8, ay - 200); ctx.lineTo(ax - 8, ay - 200); ctx.fill();
      const g = ctx.createRadialGradient(ax, ay - 172, 0, ax, ay - 172, 26);
      g.addColorStop(0, 'rgba(255,240,190,0.9)');
      g.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = g;
      ctx.fillRect(ax - 30, ay - 200, 60, 60);
      ctx.fillStyle = '#fff4c8';
      ctx.fillRect(ax - 9, ay - 184, 18, 16);
      ctx.fillStyle = '#1f2a24';
      ctx.fillRect(ax - 11, ay - 169, 22, 4);
    }), [{ x: 0.5, y: 0.5, r: 4.5, color: '#ffd896', i: 1 }]);
}

export function getMailbox() {
  return reg('mailbox', 'Curbside mailbox on a wooden post', 'A classic rounded US mailbox on a wooden post, red flag raised.', 1, 1, () =>
    small(80, 120, (ctx, P) => {
      isoBox(ctx, P, 0.46, 0.46, 0.54, 0.54, 0, 34, '#5a3e2a', '#4a3020', '#36231a');
      isoBox(ctx, P, 0.36, 0.42, 0.66, 0.58, 34, 48, '#3a4a5e', '#2c3a4c', '#1e2836');
      const p = P(0.6, 0.42, 48);
      ctx.fillStyle = '#d0302a';
      ctx.fillRect(p[0], p[1] - 10, 3, 10);
      ctx.fillRect(p[0], p[1] - 10, 8, 4);
    }));
}

export function getTrash() {
  return reg('trashcan', 'Metal garbage can', 'A dented galvanised metal garbage can with a lid.', 1, 1, () =>
    small(80, 120, (ctx, _P, ax, ay) => {
      ctx.fillStyle = '#5c6066';
      ctx.fillRect(ax - 13, ay - 40, 26, 40);
      ellipse(ctx, ax, ay, 13, 6, '#4a4d52');
      ctx.fillStyle = '#6f747a';
      ctx.fillRect(ax - 13, ay - 40, 9, 40);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      for (let y = ay - 34; y < ay; y += 8) { ctx.beginPath(); ctx.moveTo(ax - 13, y); ctx.lineTo(ax + 13, y); ctx.stroke(); }
      ellipse(ctx, ax, ay - 41, 15, 7, '#7d8288');
      ellipse(ctx, ax, ay - 44, 4, 2, '#4a4d52');
    }));
}

export function getHydrant() {
  return reg('hydrant', 'Red fire hydrant', 'A short red fire hydrant.', 1, 1, () =>
    small(64, 100, (ctx, _P, ax, ay) => {
      ellipse(ctx, ax, ay, 10, 5, '#8a1a16');
      ctx.fillStyle = '#b8231d'; ctx.fillRect(ax - 8, ay - 28, 16, 28);
      ctx.fillStyle = '#d8423a'; ctx.fillRect(ax - 8, ay - 28, 5, 28);
      ctx.fillStyle = '#b8231d'; ctx.fillRect(ax - 13, ay - 18, 26, 6);
      ellipse(ctx, ax, ay - 30, 9, 5, '#cf3a33');
      ellipse(ctx, ax, ay - 34, 4, 3, '#8a1a16');
    }));
}

const CAR_COLS = ['#7a1f2b', '#2b4a7a', '#3d5a3a', '#b9a47a'];
export function getCar(v: number, flip: boolean): PropSprite {
  const base = reg(`car_${v}`, 'Parked 1980s station wagon, footprint 2x1 along world X', `A boxy 1980s American station wagon (paint ${CAR_COLS[v % 4]}), parked, headlights off, footprint 2 tiles long along the lower-right axis.`, 2, 1, () => {
    const fw = 2, fh = 1;
    const W = (fw + fh) * HW + 40, Hh = (fw + fh) * HH + 110;
    const { c, ctx } = makeCanvas(W, Hh);
    const P = projector(fh * HW + 20, 90);
    const col = CAR_COLS[v % 4];
    isoBox(ctx, P, 0.12, 0.2, 1.9, 0.82, 8, 32, shade(col, 0.15), col, shade(col, -0.4));
    // windows cabin
    isoBox(ctx, P, 0.45, 0.26, 1.45, 0.76, 32, 54, shade(col, 0.1), '#1f2c46', '#15203a');
    poly(ctx, faceQuad(P, 'L', 0.76, 0.5, 0.95, 34, 52), 'rgba(170,200,255,0.3)');
    poly(ctx, faceQuad(P, 'L', 0.76, 1.0, 1.4, 34, 52), 'rgba(170,200,255,0.22)');
    // wood panel
    poly(ctx, faceQuad(P, 'L', 0.82, 0.3, 1.75, 14, 26), '#6a4228');
    for (const x of [0.45, 1.55]) {
      const p = P(x, 0.82, 8);
      ellipse(ctx, p[0], p[1], 10, 10, '#0c0c0e');
      ellipse(ctx, p[0], p[1], 4, 4, '#777');
    }
    const hl = P(1.9, 0.35, 22), hl2 = P(1.9, 0.68, 22);
    ellipse(ctx, hl[0], hl[1], 3, 3, '#e8e2c0');
    ellipse(ctx, hl2[0], hl2[1], 3, 3, '#e8e2c0');
    const tl = P(0.12, 0.8, 22);
    ellipse(ctx, tl[0], tl[1], 3, 2, '#c22');
    const [ax, ay] = P(1, 0.5, 0);
    return { c, ax, ay };
  });
  if (!flip) return base;
  return cached('carF' + v, () => mirrored(base));
}

export function getShop() {
  return reg('candy_stand', "Candy Lady's treat stand (shop), 2x2", "A wooden Halloween treat stand with an orange-and-black striped awning, glowing 'TREATS' sign, candy jars on the counter, string lights.", 2, 2, () => {
    const fw = 2, fh = 2;
    const W = (fw + fh) * HW + 40, Hh = (fw + fh) * HH + 190;
    const { c, ctx } = makeCanvas(W, Hh);
    const P = projector(fh * HW + 20, 170);
    // posts
    for (const [x, y] of [[0.2, 0.2], [1.8, 0.2], [0.2, 1.8], [1.8, 1.8]]) isoBox(ctx, P, x - 0.05, y - 0.05, x + 0.05, y + 0.05, 0, 100, '#5a3a22', '#4a2e1a', '#36200f');
    // counter
    isoBox(ctx, P, 0.25, 1.3, 1.75, 1.75, 0, 44, '#8a5a2e', '#6e4422', '#4e2f15');
    poly(ctx, faceQuad(P, 'L', 1.75, 0.3, 1.7, 14, 34), '#2a1a12');
    ctx.fillStyle = '#ff9a2a';
    ctx.font = 'bold 13px sans-serif';
    const tp = P(0.55, 1.75, 30);
    ctx.save();
    ctx.translate(tp[0], tp[1]);
    ctx.transform(1, 0.5, 0, 1, 0, 0);
    ctx.fillText('TREATS', 0, 0);
    ctx.restore();
    // jars
    for (let i = 0; i < 4; i++) {
      const p = P(0.45 + i * 0.35, 1.5, 44);
      ctx.fillStyle = 'rgba(200,230,255,0.35)';
      ctx.fillRect(p[0] - 6, p[1] - 16, 12, 16);
      const cc = ['#ff4d6d', '#ffd23a', '#7dff5a', '#b44dff'][i];
      for (let k = 0; k < 6; k++) circle(ctx, p[0] - 3 + (k % 3) * 3, p[1] - 3 - Math.floor(k / 3) * 4, 2, cc);
      ctx.fillStyle = '#ddd';
      ctx.fillRect(p[0] - 6, p[1] - 18, 12, 3);
    }
    // awning striped
    const z0 = 100, z1 = 128;
    for (let i = 0; i < 8; i++) {
      const u0 = i * 0.25, u1 = u0 + 0.25;
      poly(ctx, [P(u0, 0, z1), P(u1, 0, z1), P(u1, 2.15, z0), P(u0, 2.15, z0)], i % 2 ? '#1b1520' : '#ef7a1e', 'rgba(0,0,0,0.4)');
    }
    for (let i = 0; i < 8; i++) {
      const v0 = i * 0.27;
      poly(ctx, [P(2.0, v0, z1 - (v0 / 2.15) * 28), P(2.0, v0 + 0.27, z1 - ((v0 + 0.27) / 2.15) * 28), P(2.0, v0 + 0.27, z0 - 14 - ((v0 + 0.27) / 2.15) * 0), P(2.0, v0, z0 - 14)], i % 2 ? '#130f18' : '#b85a12');
    }
    for (let x = 0.1; x < 2; x += 0.2) {
      const p = P(x, 2.15, z0 - 4);
      circle(ctx, p[0], p[1], 5, 'rgba(255,170,60,0.3)');
      circle(ctx, p[0], p[1], 2, x * 10 % 4 < 2 ? '#ffb347' : '#b44dff');
    }
    // sign
    const sp = P(1, 0.2, 150);
    ctx.fillStyle = '#1a1020';
    ctx.fillRect(sp[0] - 40, sp[1] - 16, 80, 26);
    ctx.strokeStyle = '#ff9a2a';
    ctx.lineWidth = 2;
    ctx.strokeRect(sp[0] - 40, sp[1] - 16, 80, 26);
    ctx.fillStyle = '#ffcf6a';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🍬 SHOP', sp[0], sp[1] + 3);
    const [ax, ay] = P(1, 1, 0);
    return { c, ax, ay };
  }, [{ x: 1, y: 2.3, r: 4, color: '#ffa040', i: 1 }]);
}

export function getVending() {
  return reg('vending', 'Candy vending machine (shop)', 'A tall glowing orange candy vending machine with a lit glass front full of candy rows and the word CANDY.', 1, 1, () =>
    small(110, 200, (ctx, P) => {
      isoBox(ctx, P, 0.2, 0.3, 0.8, 0.72, 0, 100, '#d8661a', '#c4551a', '#7a320c');
      const g = faceQuad(P, 'L', 0.72, 0.26, 0.62, 30, 92);
      poly(ctx, g, '#d8f0ff');
      const r = makeRng(9);
      for (let row = 0; row < 5; row++) for (let k = 0; k < 4; k++) {
        const p = P(0.3 + k * 0.08, 0.72, 36 + row * 12);
        ctx.fillStyle = ['#ff4d6d', '#ffd23a', '#7dff5a', '#b44dff', '#4fb3ff'][Math.floor(r() * 5)];
        ctx.fillRect(p[0] - 2, p[1] - 4, 4, 5);
      }
      poly(ctx, faceQuad(P, 'L', 0.72, 0.66, 0.76, 50, 80), '#222');
      const t = P(0.45, 0.72, 18);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px sans-serif';
      ctx.save(); ctx.translate(t[0] - 14, t[1]); ctx.transform(1, 0.5, 0, 1, 0, 0); ctx.fillText('CANDY', 0, 0); ctx.restore();
    }), [{ x: 0.5, y: 1.0, r: 2.4, color: '#bfe6ff', i: 0.8 }]);
}

export function getHayScarecrow() {
  return reg('scarecrow', 'Hay bale with scarecrow', 'A straw hay bale with a ragged scarecrow on a pole wearing a witch hat.', 1, 1, () =>
    small(128, 200, (ctx, P, ax, ay) => {
      isoBox(ctx, P, 0.2, 0.3, 0.8, 0.75, 0, 24, '#d8b25a', '#c19a42', '#8a6a24');
      ctx.fillStyle = '#4a3020';
      ctx.fillRect(ax - 2, ay - 120, 4, 100);
      ctx.fillRect(ax - 30, ay - 92, 60, 4);
      ctx.fillStyle = '#6a3a5a';
      ctx.beginPath(); ctx.moveTo(ax - 16, ay - 96); ctx.lineTo(ax + 16, ay - 96); ctx.lineTo(ax + 12, ay - 50); ctx.lineTo(ax - 12, ay - 50); ctx.fill();
      ctx.fillStyle = '#c99a3a';
      for (const s of [-1, 1]) ctx.fillRect(ax + s * 30 - 3, ay - 92, 6, 10);
      circle(ctx, ax, ay - 108, 12, '#d9b26a');
      ctx.fillStyle = '#1a1018';
      ctx.fillRect(ax - 5, ay - 111, 3, 3); ctx.fillRect(ax + 2, ay - 111, 3, 3);
      ctx.beginPath(); ctx.moveTo(ax - 18, ay - 116); ctx.lineTo(ax + 18, ay - 116); ctx.lineTo(ax + 4, ay - 150); ctx.fill();
    }));
}

// =============== LANDMARKS (unlockable districts) ===============
function signText(ctx: CanvasRenderingContext2D, P: Proj, face: 'L' | 'R', plane: number, u: number, z: number, text: string, color: string, size = 10) {
  const p = face === 'L' ? P(u, plane, z) : P(plane, u, z);
  ctx.save();
  ctx.translate(p[0], p[1]);
  ctx.transform(1, face === 'L' ? 0.5 : -0.5, 0, 1, 0, 0); // follow the wall: +Y faces run down-right, +X faces up-right
  ctx.fillStyle = color;
  ctx.font = `900 ${size}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

export function getSchool() {
  return reg('school', 'Brick elementary school, 6x4 tiles, clock pediment, double doors, glowing windows', 'A two-storey red-brick American elementary school with a white clock pediment, tall multi-pane windows, concrete steps and double doors on the lower-left face, a small flag pole.', 6, 4, () => {
    const fw = 6, fh = 4;
    const W = (fw + fh) * HW + 60, Hh = (fw + fh) * HH + 260;
    const { c, ctx } = makeCanvas(W, Hh);
    const P = projector(fh * HW + 30, 230);
    const brick = '#7a4636', brickD = '#5c3327';
    isoBox(ctx, P, -0.05, -0.05, fw + 0.05, fh + 0.05, 0, 12, '#8a857c', '#6e6960', '#55504a');
    isoBox(ctx, P, 0, 0, fw, fh, 12, 150, brick, brickD, shade(brickD, -0.35));
    // brick courses
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1;
    for (let z = 18; z < 150; z += 7) {
      const a = P(0, fh, z), b = P(fw, fh, z);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      const c1 = P(fw, 0, z), c2 = P(fw, fh, z);
      ctx.beginPath(); ctx.moveTo(c2[0], c2[1]); ctx.lineTo(c1[0], c1[1]); ctx.stroke();
    }
    // windows 2 rows both faces
    for (let s = 0; s < 2; s++) {
      const z = 34 + s * 56;
      for (let u = 0.5; u < fw - 0.2; u += 0.95) {
        if (Math.abs(u - fw / 2) < 0.6 && s === 0) continue;
        const lit = ((u * 7 + s) | 0) % 3 !== 0;
        windowOn(ctx, P, 'L', fh, u, z, 0.4, 38, lit, '#e6dfcc', '#4a2a1e');
      }
      for (let u = 0.6; u < fh - 0.2; u += 1.1) windowOn(ctx, P, 'R', fw, u, z, 0.38, 38, ((u * 5 + s) | 0) % 3 !== 1, '#c9c2b0', '#3c2118');
    }
    // doors + steps
    const du = fw / 2;
    isoBox(ctx, P, du - 0.8, fh, du + 0.8, fh + 0.6, 0, 8, '#8a857c', '#6e6960', '#55504a');
    isoBox(ctx, P, du - 0.6, fh + 0.6, du + 0.6, fh + 0.8, 0, 4, '#7c766f', '#615c56', '#4c4843');
    poly(ctx, faceQuad(P, 'L', fh, du - 0.5, du + 0.5, 12, 78), '#e6dfcc', 'rgba(0,0,0,0.6)');
    poly(ctx, faceQuad(P, 'L', fh, du - 0.44, du - 0.03, 12, 74), '#2e4a6a');
    poly(ctx, faceQuad(P, 'L', fh, du + 0.03, du + 0.44, 12, 74), '#2e4a6a');
    // clock pediment
    isoBox(ctx, P, du - 1.1, -0.02, du + 1.1, 0.5, 150, 168, '#e6dfcc', '#c9c2b0', '#a8a190');
    isoBox(ctx, P, du - 0.9, 0, du + 0.9, 0.4, 168, 206, '#e6dfcc', '#c9c2b0', '#a8a190');
    const cp = P(du, 0.4, 188);
    ctx.beginPath(); ctx.arc(cp[0], cp[1], 9, 0, Math.PI * 2); ctx.fillStyle = '#f4f0e2'; ctx.fill(); ctx.strokeStyle = '#1a1020'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cp[0], cp[1]); ctx.lineTo(cp[0], cp[1] - 6); ctx.moveTo(cp[0], cp[1]); ctx.lineTo(cp[0] + 4, cp[1] + 1); ctx.stroke();
    poly(ctx, [P(du - 1.0, 0.4, 206), P(du + 1.0, 0.4, 206), P(du, 0.4, 226)], '#b0340c', 'rgba(0,0,0,0.6)');
    signText(ctx, P, 'L', fh + 0.02, du, 82, 'MAPLE FALLS ELEMENTARY', '#f4e8d5', 10); // between the door and the upper windows
    // flag pole
    const fp = P(fw - 0.4, fh + 0.7, 0);
    ctx.strokeStyle = '#c8ccd8'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(fp[0], fp[1]); ctx.lineTo(fp[0], fp[1] - 120); ctx.stroke();
    ctx.fillStyle = '#b0340c';
    ctx.beginPath(); ctx.moveTo(fp[0], fp[1] - 120); ctx.lineTo(fp[0] + 22, fp[1] - 114); ctx.lineTo(fp[0], fp[1] - 108); ctx.fill();
    const [ax, ay] = P(fw / 2, fh / 2, 0);
    return { c, ax, ay };
  }, [{ x: 3, y: 4.8, r: 2.6, color: '#ffd896', i: 0.8 }]);
}

export function getArcade() {
  return reg('arcade', "Neon 80s video arcade, 4x3, glowing ARCADE sign", 'A dark 80s arcade building with a huge glowing neon ARCADE sign in cyan and magenta, marquee bulbs, tinted windows leaking pink and blue light, black facade.', 4, 3, () => {
    const fw = 4, fh = 3;
    const W = (fw + fh) * HW + 60, Hh = (fw + fh) * HH + 230;
    const { c, ctx } = makeCanvas(W, Hh);
    const P = projector(fh * HW + 30, 200);
    isoBox(ctx, P, 0, 0, fw, fh, 0, 120, '#1b1626', '#141020', '#0c0a14');
    // glowing windows
    for (let u = 0.4; u < fw - 0.2; u += 0.8) {
      const g = faceQuad(P, 'L', fh, u - 0.3, u + 0.3, 14, 62);
      const col = (u * 10 | 0) % 2 ? '#ff2ea6' : '#21d0ff';
      poly(ctx, g, col);
      poly(ctx, g, 'rgba(255,255,255,0.15)');
    }
    poly(ctx, faceQuad(P, 'R', fw, 0.4, 1.2, 14, 62), '#7a2eff');
    poly(ctx, faceQuad(P, 'R', fw, 1.6, 2.5, 14, 62), '#21d0ff');
    // door
    poly(ctx, faceQuad(P, 'L', fh, fw / 2 - 0.35, fw / 2 + 0.35, 0, 60), '#0a0812');
    poly(ctx, faceQuad(P, 'L', fh, fw / 2 - 0.28, fw / 2 + 0.28, 4, 56), 'rgba(33,208,255,0.5)');
    // neon sign
    const s0 = P(0.2, fh, 92), s1 = P(fw - 0.2, fh, 92), s2 = P(fw - 0.2, fh, 116), s3 = P(0.2, fh, 116);
    poly(ctx, [s3, s2, s1, s0], '#0a0812', '#21d0ff', 2);
    signText(ctx, P, 'L', fh, fw / 2, 110, '★ ARCADE ★', '#21d0ff', 16);
    signText(ctx, P, 'L', fh, fw / 2, 110, '★ ARCADE ★', 'rgba(255,46,166,0.55)', 16);
    // marquee bulbs
    for (let u = 0.15; u < fw; u += 0.22) {
      const p = P(u, fh, 86);
      circle(ctx, p[0], p[1], 4, 'rgba(255,210,80,0.35)');
      circle(ctx, p[0], p[1], 1.8, '#ffd23a');
    }
    // joystick decal on right face
    const jp = P(fw, 1.5, 84);
    ctx.strokeStyle = '#ff2ea6'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(jp[0], jp[1]); ctx.lineTo(jp[0], jp[1] - 10); ctx.stroke();
    circle(ctx, jp[0], jp[1] - 12, 3.5, '#ff2ea6');
    const [ax, ay] = P(fw / 2, fh / 2, 0);
    return { c, ax, ay };
  }, [
    { x: 2, y: 3.3, r: 3.2, color: '#21d0ff', i: 0.9 },
    { x: 2, y: 3.3, r: 2.2, color: '#ff2ea6', i: 0.6 },
  ]);
}

export function getDiner() {
  return reg('diner', "Chrome 50s diner, 4x3, neon DINER sign", 'A retro chrome-and-red American diner with a rounded roof band, huge warm-lit windows, a vertical neon DINER sign and checkerboard trim.', 4, 3, () => {
    const fw = 4, fh = 3;
    const W = (fw + fh) * HW + 60, Hh = (fw + fh) * HH + 200;
    const { c, ctx } = makeCanvas(W, Hh);
    const P = projector(fh * HW + 30, 170);
    isoBox(ctx, P, 0, 0, fw, fh, 0, 84, '#c23b34', '#8f2a24', '#5f1c17');
    // chrome band
    isoBox(ctx, P, -0.04, -0.04, fw + 0.04, fh + 0.04, 58, 70, '#dfe4ea', '#b8bfc8', '#8a9098');
    isoBox(ctx, P, -0.06, -0.06, fw + 0.06, fh + 0.06, 84, 96, '#c23b34', '#8f2a24', '#5f1c17');
    // big windows
    for (let u = 0.3; u < fw - 0.1; u += 1.2) {
      const g = faceQuad(P, 'L', fh, u - 0.42, u + 0.42, 14, 56);
      const gr = ctx.createLinearGradient(g[0][0], g[0][1], g[2][0], g[2][1]);
      gr.addColorStop(0, '#ffd896'); gr.addColorStop(1, '#f2a23c');
      poly(ctx, g, gr, '#e6dfcc', 2);
      // counter stools silhouettes
      const m = faceQuad(P, 'L', fh, u - 0.1, u + 0.1, 14, 34);
      poly(ctx, m, 'rgba(40,20,10,0.5)');
    }
    for (let u = 0.5; u < fh - 0.1; u += 1.2) poly(ctx, faceQuad(P, 'R', fw, u - 0.4, u + 0.4, 14, 56), '#f2c06a', '#c9c2b0', 2);
    // checker trim
    for (let u = 0; u < fw; u += 0.25) {
      const dark = (u * 4 | 0) % 2 === 0;
      poly(ctx, faceQuad(P, 'L', fh, u, u + 0.25, 70, 84), dark ? '#111' : '#f4f0e2');
    }
    // neon sign vertical
    const np = P(0.2, fh, 100);
    ctx.fillStyle = '#0a0812';
    ctx.fillRect(np[0] - 8, np[1] - 58, 18, 58);
    ctx.strokeStyle = '#ff2ea6'; ctx.lineWidth = 1.5; ctx.strokeRect(np[0] - 8, np[1] - 58, 18, 58);
    ctx.fillStyle = '#ff5ab8';
    ctx.font = '900 11px sans-serif';
    'DINER'.split('').forEach((ch, i) => ctx.fillText(ch, np[0] - 4, np[1] - 46 + i * 11));
    const [ax, ay] = P(fw / 2, fh / 2, 0);
    return { c, ax, ay };
  }, [{ x: 2, y: 3.4, r: 3.4, color: '#ffd896', i: 1 }]);
}

export function getVideoStore() {
  return reg('video', '80s video rental store, 3x3, purple VIDEO neon', 'A small 80s video rental store with a purple neon VIDEO sign, glowing poster lightboxes and blue-tinted windows.', 3, 3, () => {
    const fw = 3, fh = 3;
    const W = (fw + fh) * HW + 50, Hh = (fw + fh) * HH + 190;
    const { c, ctx } = makeCanvas(W, Hh);
    const P = projector(fh * HW + 25, 160);
    isoBox(ctx, P, 0, 0, fw, fh, 0, 92, '#2a2438', '#201a2c', '#141020');
    isoBox(ctx, P, -0.05, -0.05, fw + 0.05, fh + 0.05, 92, 104, '#3a3050', '#2c2440', '#1c1730');
    poly(ctx, faceQuad(P, 'L', fh, 0.3, fw - 0.3, 12, 60), '#1a2a4a', '#e6dfcc', 2);
    poly(ctx, faceQuad(P, 'L', fh, 0.3, fw - 0.3, 12, 60), 'rgba(80,140,255,0.25)');
    // poster boxes
    for (const u of [0.5, 1.2]) {
      const g = faceQuad(P, 'L', fh, u, u + 0.5, 16, 52);
      poly(ctx, g, (u < 1 ? '#ff8a1e' : '#21d0ff'), '#111', 2);
    }
    poly(ctx, faceQuad(P, 'L', fh, fw / 2 - 0.3, fw / 2 + 0.3, 0, 58), '#0a0812');
    signText(ctx, P, 'L', fh, fw / 2, 80, 'VIDEO', '#b44dff', 15);
    signText(ctx, P, 'L', fh, fw / 2, 80, 'VIDEO', 'rgba(255,255,255,0.35)', 15);
    const [ax, ay] = P(fw / 2, fh / 2, 0);
    return { c, ax, ay };
  }, [{ x: 1.5, y: 3.2, r: 2.4, color: '#b44dff', i: 0.8 }]);
}

export function getWaterTower() {
  return reg('watertower', 'Wooden water tower reading MAPLE FALLS, 2x2', 'A tall wooden-legged water tower with a banded steel tank painted MAPLE FALLS, ladder and railing, moonlit.', 2, 2, () => {
    const fw = 2, fh = 2;
    const W = (fw + fh) * HW + 60, Hh = 380;
    const { c, ctx } = makeCanvas(W, Hh);
    const P = projector(fh * HW + 30, 254); // legs reach y≈370: keep them inside the 380px canvas
    // legs
    for (const [x, y] of [[0.2, 0.2], [1.8, 0.2], [0.2, 1.8], [1.8, 1.8]]) {
      const a = P(x, y, 0), b = P(0.5 + x * 0.5, 0.5 + y * 0.5, 170);
      ctx.strokeStyle = '#0d0a10'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      ctx.strokeStyle = '#3a2a20'; ctx.lineWidth = 4; ctx.stroke();
    }
    // cross braces
    ctx.strokeStyle = '#241a14'; ctx.lineWidth = 2.5;
    for (const z of [60, 110]) {
      const a = P(0.3, 0.3, z), b = P(1.7, 1.7, z), cc = P(1.7, 0.3, z), d = P(0.3, 1.7, z);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.moveTo(cc[0], cc[1]); ctx.lineTo(d[0], d[1]); ctx.stroke();
    }
    // tank
    isoBox(ctx, P, 0.15, 0.15, 1.85, 1.85, 170, 250, '#5a5f6a', '#464b55', '#30343c');
    ctx.strokeStyle = '#20232a'; ctx.lineWidth = 2;
    for (const z of [185, 210, 235]) {
      const a = P(0.15, 1.85, z), b = P(1.85, 1.85, z);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      const c1 = P(1.85, 0.15, z), c2 = P(1.85, 1.85, z);
      ctx.beginPath(); ctx.moveTo(c2[0], c2[1]); ctx.lineTo(c1[0], c1[1]); ctx.stroke();
    }
    signText(ctx, P, 'L', 1.85, 1, 228, 'MAPLE', '#f4e8d5', 13);
    signText(ctx, P, 'L', 1.85, 1, 212, 'FALLS', '#f4e8d5', 13);
    // roof cone + railing
    const t = P(1, 1, 292);
    poly(ctx, [P(0.1, 1.9, 250), P(1.9, 1.9, 250), t], '#3a3040', 'rgba(0,0,0,0.6)');
    poly(ctx, [P(0.1, 0.1, 250), P(1.9, 0.1, 250), t], '#2c2434', 'rgba(0,0,0,0.6)');
    const [ax, ay] = P(1, 1, 0);
    return { c, ax, ay };
  });
}

export function getGate() {
  return reg('gate', 'ROAD CLOSED barricade blocking a 2x2 road section', 'A row of striped orange-and-white sawhorse barricades with a ROAD CLOSED sign and a locked chain, blocking the street.', 2, 2, () => {
    const fw = 2, fh = 2;
    const W = (fw + fh) * HW + 30, Hh = (fw + fh) * HH + 90;
    const { c, ctx } = makeCanvas(W, Hh);
    const P = projector(fh * HW + 15, 70);
    for (const u of [0.3, 1.0, 1.7]) {
      // sawhorse
      const a = P(u - 0.22, 0.9, 0), b = P(u - 0.22, 1.1, 26), cc = P(u + 0.22, 1.1, 26), d = P(u + 0.22, 0.9, 0);
      poly(ctx, [a, b, cc, d], '#f4e8d5', '#111', 1.5);
      for (let k = 0; k < 3; k++) {
        const u0 = u - 0.22 + k * 0.15;
        poly(ctx, faceQuad(P, 'L', 1.1, u0, u0 + 0.14, 14, 26), '#f9781b');
      }
      ctx.strokeStyle = '#5a3a20'; ctx.lineWidth = 3;
      const l1 = P(u - 0.2, 1.0, 26), l2 = P(u - 0.28, 1.0, 0);
      ctx.beginPath(); ctx.moveTo(l1[0], l1[1]); ctx.lineTo(l2[0], l2[1]); ctx.stroke();
      const r1 = P(u + 0.2, 1.0, 26), r2 = P(u + 0.28, 1.0, 0);
      ctx.beginPath(); ctx.moveTo(r1[0], r1[1]); ctx.lineTo(r2[0], r2[1]); ctx.stroke();
    }
    // sign
    const sp = P(1, 1, 52);
    ctx.fillStyle = '#f4e8d5';
    ctx.fillRect(sp[0] - 26, sp[1] - 14, 52, 22);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.strokeRect(sp[0] - 26, sp[1] - 14, 52, 22);
    ctx.fillStyle = '#c23b34';
    ctx.font = '900 9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('ROAD CLOSED', sp[0], sp[1] - 3);
    ctx.fillText('— TONIGHT —', sp[0], sp[1] + 6);
    ctx.strokeStyle = '#8a9098'; ctx.lineWidth = 1;
    const ch = P(1, 1, 38);
    ctx.beginPath(); ctx.moveTo(ch[0] - 30, ch[1]); ctx.quadraticCurveTo(ch[0], ch[1] + 8, ch[0] + 30, ch[1]); ctx.stroke();
    const [ax, ay] = P(1, 1, 0);
    return { c, ax, ay };
  });
}

export function getBleachers() {
  return reg('bleachers', 'Aluminum bleachers, 3x1', 'Four rows of silver aluminum bleacher benches on a frame.', 3, 1, () => {
    const fw = 3, fh = 1;
    const W = (fw + fh) * HW + 20, Hh = (fw + fh) * HH + 80;
    const { c, ctx } = makeCanvas(W, Hh);
    const P = projector(fh * HW + 10, 60);
    for (let r = 0; r < 4; r++) {
      const z = 8 + r * 11, y0 = 0.75 - r * 0.16;
      isoBox(ctx, P, 0.05, y0, fw - 0.05, y0 + 0.14, 0, z, '#c8ccd8', '#9aa0ac', '#6e7480');
    }
    const [ax, ay] = P(fw / 2, fh / 2, 0);
    return { c, ax, ay };
  });
}

export function getGoalPosts() {
  return reg('goalposts', 'Yellow football goalpost', 'A tall yellow H-style football goalpost.', 1, 1, () => {
    const { c, ctx } = makeCanvas(90, 210);
    const cx = 45;
    ctx.strokeStyle = '#111'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(cx, 205); ctx.lineTo(cx, 90); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 26, 90); ctx.lineTo(cx + 26, 90); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 26, 90); ctx.lineTo(cx - 26, 20); ctx.moveTo(cx + 26, 90); ctx.lineTo(cx + 26, 20); ctx.stroke();
    ctx.strokeStyle = '#ffcf3a'; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(cx, 205); ctx.lineTo(cx, 90); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 26, 90); ctx.lineTo(cx + 26, 90); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 26, 90); ctx.lineTo(cx - 26, 20); ctx.moveTo(cx + 26, 90); ctx.lineTo(cx + 26, 20); ctx.stroke();
    return { c, ax: 45, ay: 205 };
  });
}

export function getScoreboard() {
  return reg('scoreboard', 'Football scoreboard on poles', 'A dark green football scoreboard on two poles reading HOME 13 GUEST 07.', 1, 1, () => {
    const { c, ctx } = makeCanvas(110, 150);
    ctx.strokeStyle = '#5a6070'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(35, 145); ctx.lineTo(35, 60); ctx.moveTo(75, 145); ctx.lineTo(75, 60); ctx.stroke();
    ctx.fillStyle = '#143024';
    ctx.fillRect(12, 12, 86, 52);
    ctx.strokeStyle = '#0c1a12'; ctx.lineWidth = 3; ctx.strokeRect(12, 12, 86, 52);
    ctx.fillStyle = '#ffcf3a'; ctx.font = '900 10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('HOME  13', 55, 32);
    ctx.fillText('GUEST 07', 55, 52);
    return { c, ax: 55, ay: 145 };
  });
}

export const PROP_TW = TW;

// =============== NEW LANDMARKS: church, drive-in, video rental, primary school + playground, farm ===============
/** a tall arched window (stained glass when `glass` is given) */
function archWindow(ctx: CanvasRenderingContext2D, P: Proj, face: 'L' | 'R', plane: number, u: number, z: number, w: number, h: number, glass: string[]) {
  const q = faceQuad(P, face, plane, u - w / 2, u + w / 2, z, z + h);
  const top = face === 'L' ? P(u, plane, z + h + w * 22) : P(plane, u, z + h + w * 22);
  ctx.beginPath();
  ctx.moveTo(q[0][0], q[0][1]); ctx.lineTo(q[1][0], q[1][1]); ctx.lineTo(q[2][0], q[2][1]);
  ctx.quadraticCurveTo(top[0] + (q[2][0] - q[3][0]) * 0.1, top[1], q[3][0], q[3][1]);
  ctx.closePath();
  const g = ctx.createLinearGradient(q[0][0], q[0][1], top[0], top[1]);
  glass.forEach((c, i) => g.addColorStop(i / Math.max(1, glass.length - 1), c));
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = '#1a1420'; ctx.lineWidth = 2; ctx.stroke();
  // leading
  ctx.strokeStyle = 'rgba(20,14,24,0.7)'; ctx.lineWidth = 1;
  const m = faceQuad(P, face, plane, u, u, z, z + h);
  ctx.beginPath(); ctx.moveTo(m[0][0], m[0][1]); ctx.lineTo(m[2][0], m[2][1]);
  for (let k = 1; k < 3; k++) { const hz = faceQuad(P, face, plane, u - w / 2, u + w / 2, z + (h * k) / 3, z + (h * k) / 3); ctx.moveTo(hz[0][0], hz[0][1]); ctx.lineTo(hz[1][0], hz[1][1]); }
  ctx.stroke();
}

export function getChurch() {
  return reg('church', "White clapboard chapel with steeple, 5x4", "A white clapboard New-England chapel, steep dark gable roof, tall square bell tower and spire with a small cross over the front double doors, glowing stained-glass arched windows (purple, amber, teal), a little sign board ST. HALLOW'S, cobwebs and a jack-o'-lantern on the steps.", 5, 4, () => {
    const fw = 5, fh = 4, wallH = 112, roofH = 86;
    const W = (fw + fh) * HW + 80, Hh = (fw + fh) * HH + 470;
    const { c, ctx } = makeCanvas(W, Hh);
    const P = projector(fh * HW + 40, 440);
    const wall = '#d9d4c6', wallD = '#9a968c';
    isoBox(ctx, P, -0.04, -0.04, fw + 0.04, fh + 0.04, 0, 10, '#7a756c', '#625e57', '#4a4742');
    isoBox(ctx, P, 0, 0, fw, fh, 10, wallH, wall, shade(wall, -0.08), wallD);
    siding(ctx, P, 'R', fw, 0, fh, 10, wallH, 'rgba(0,0,0,0.16)');
    siding(ctx, P, 'L', fh, 0, fw, 10, wallH, 'rgba(0,0,0,0.12)');
    const glass = ['#3a2a6a', '#b44dff', '#ffb43c', '#2ec4b0'];
    for (const u of [0.7, 2.0, 3.3]) archWindow(ctx, P, 'R', fw, u, 30, 0.42, 52, glass);
    for (const u of [0.7, fw - 0.7]) archWindow(ctx, P, 'L', fh, u, 30, 0.42, 52, ['#2a2050', '#ff8a1e', '#ffd27a']);
    // roof: ridge along y, visible plane faces +x
    const o = 0.18, top = wallH + roofH;
    poly(ctx, [P(fw / 2, -o, top), P(fw / 2, fh + o, top), P(-o, fh + o, wallH), P(-o, -o, wallH)], '#211d28', 'rgba(0,0,0,0.6)');
    const rp: [number, number][] = [P(fw / 2, -o, top), P(fw / 2, fh + o, top), P(fw + o, fh + o, wallH), P(fw + o, -o, wallH)];
    const rg = ctx.createLinearGradient(rp[0][0], rp[0][1], rp[2][0], rp[2][1]);
    rg.addColorStop(0, '#4a4458'); rg.addColorStop(1, '#2a2632');
    poly(ctx, rp, rg, 'rgba(0,0,0,0.7)');
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1;
    for (let k = 1; k < 8; k++) { const t = k / 8, xx = fw / 2 + (fw / 2 + o) * t, zz = top - roofH * t; const a = P(xx, -o, zz), b = P(xx, fh + o, zz); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    // front gable
    poly(ctx, [P(-o, fh, wallH), P(fw + o, fh, wallH), P(fw / 2, fh, top + 4)], shade(wall, -0.04), 'rgba(0,0,0,0.6)');
    ctx.strokeStyle = '#f4f0e2'; ctx.lineWidth = 3;
    const g1 = P(-o, fh + o, wallH), g2 = P(fw / 2, fh + o, top), g3 = P(fw + o, fh + o, wallH);
    ctx.beginPath(); ctx.moveTo(g1[0], g1[1]); ctx.lineTo(g2[0], g2[1]); ctx.lineTo(g3[0], g3[1]); ctx.stroke();
    const rose = P(fw / 2, fh, wallH + 34);
    circle(ctx, rose[0], rose[1], 13, '#1a1420'); circle(ctx, rose[0], rose[1], 10, '#b44dff'); circle(ctx, rose[0], rose[1], 5, '#ffd27a');
    // bell tower over the door
    const tx0 = fw / 2 - 0.62, tx1 = fw / 2 + 0.62, ty0 = fh - 0.9, ty1 = fh + 0.25;
    isoBox(ctx, P, tx0, ty0, tx1, ty1, 0, top + 30, '#e2ddd0', shade(wall, -0.02), wallD);
    siding(ctx, P, 'L', ty1, tx0, tx1, 10, top + 30, 'rgba(0,0,0,0.12)');
    // belfry
    isoBox(ctx, P, tx0 + 0.06, ty0 + 0.06, tx1 - 0.06, ty1 - 0.06, top + 30, top + 84, '#e8e4d8', '#cfcabd', '#a7a296');
    poly(ctx, faceQuad(P, 'L', ty1 - 0.06, fw / 2 - 0.32, fw / 2 + 0.32, top + 38, top + 74), '#141018');
    poly(ctx, faceQuad(P, 'R', tx1 - 0.06, ty0 + 0.3, ty1 - 0.3, top + 38, top + 74), '#0e0b12');
    const bell = P(fw / 2, ty1 - 0.2, top + 52);
    ellipse(ctx, bell[0], bell[1], 7, 9, '#c9a24a');
    isoBox(ctx, P, tx0, ty0, tx1, ty1, top + 84, top + 92, '#f4f0e2', '#d8d3c6', '#b0ab9e');
    // spire
    const sp = P(fw / 2, (ty0 + ty1) / 2, top + 210);
    poly(ctx, [P(tx0, ty1, top + 92), P(tx1, ty1, top + 92), sp], '#3a3446', 'rgba(0,0,0,0.6)');
    poly(ctx, [P(tx1, ty1, top + 92), P(tx1, ty0, top + 92), sp], '#26222e', 'rgba(0,0,0,0.6)');
    ctx.strokeStyle = '#d8c690'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(sp[0], sp[1]); ctx.lineTo(sp[0], sp[1] - 22); ctx.moveTo(sp[0] - 8, sp[1] - 14); ctx.lineTo(sp[0] + 8, sp[1] - 14); ctx.stroke();
    // doors + steps
    isoBox(ctx, P, tx0 - 0.15, ty1, tx1 + 0.15, ty1 + 0.45, 0, 8, '#8a847c', '#6e6962', '#57534d');
    poly(ctx, faceQuad(P, 'L', ty1, fw / 2 - 0.42, fw / 2 + 0.42, 10, 74), '#f4f0e2', 'rgba(0,0,0,0.6)');
    poly(ctx, faceQuad(P, 'L', ty1, fw / 2 - 0.36, fw / 2 - 0.02, 10, 68), '#6a1a22');
    poly(ctx, faceQuad(P, 'L', ty1, fw / 2 + 0.02, fw / 2 + 0.36, 10, 68), '#6a1a22');
    const lamp = P(fw / 2 + 0.52, ty1, 70);
    circle(ctx, lamp[0], lamp[1], 8, rgba('#ffd27a', 0.3)); circle(ctx, lamp[0], lamp[1], 3.2, '#fff1b8');
    signText(ctx, P, 'L', ty1 + 0.01, fw / 2, 86, "ST. HALLOW'S", '#2a2030', 9);
    const pk = P(fw / 2 - 0.7, ty1 + 0.3, 8);
    smallPumpkin(ctx, pk[0], pk[1], 8);
    const [ax, ay] = P(fw / 2, fh / 2, 0);
    return { c, ax, ay };
  }, [
    { x: 2.5, y: 4.7, r: 3, color: '#ffd27a', i: 0.9 },
    { x: 5.4, y: 2, r: 2.6, color: '#b44dff', i: 0.6 },
    { x: 0.7, y: 4.5, r: 1.8, color: '#ffb43c', i: 0.45 },
  ]);
}

export function getDriveInScreen() {
  return reg('drivein_screen', 'Drive-in movie screen, 10x1, glowing monster movie', 'A giant 1950s drive-in movie screen on a wooden scaffold, the screen glowing pale blue-white with a black-and-white creature-feature monster silhouette projected on it, a marquee strip reading MOONLITE along the bottom.', 10, 1, () => {
    const fw = 10, fh = 1;
    const W = (fw + fh) * HW + 40, Hh = (fw + fh) * HH + 330;
    const { c, ctx } = makeCanvas(W, Hh);
    const P = projector(fh * HW + 20, 310);
    // scaffold
    for (let u = 0.4; u < fw; u += 1.3) {
      isoBox(ctx, P, u - 0.07, 0.15, u + 0.07, 0.29, 0, 250, '#3a2a20', '#2c2018', '#1e150f');
      const a = P(u, 0.22, 0), b = P(u + 1.2, 0.22, 120);
      ctx.strokeStyle = '#2c2018'; ctx.lineWidth = 3;
      if (u + 1.2 < fw) { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    }
    isoBox(ctx, P, 0.1, 0.3, fw - 0.1, 0.5, 40, 66, '#2a2430', '#1e1a24', '#141018');
    signText(ctx, P, 'L', 0.51, fw / 2, 58, 'M O O N L I T E   D R I V E - I N', '#ffd23a', 14);
    // screen
    isoBox(ctx, P, 0.05, 0.3, fw - 0.05, 0.5, 66, 262, '#e8ecf4', '#20242c', '#14161c');
    const sq = faceQuad(P, 'L', 0.5, 0.25, fw - 0.25, 74, 254);
    const sg = ctx.createLinearGradient(sq[0][0], sq[3][1], sq[1][0], sq[0][1]);
    sg.addColorStop(0, '#dfe8ff'); sg.addColorStop(0.5, '#bccbe8'); sg.addColorStop(1, '#8e9cbc');
    poly(ctx, sq, sg, '#0c0c10', 3);
    // the feature: a creature looming over a tiny town
    ctx.save();
    ctx.beginPath(); ctx.moveTo(sq[0][0], sq[0][1]); for (const q of sq.slice(1)) ctx.lineTo(q[0], q[1]); ctx.closePath(); ctx.clip();
    const m = P(fw / 2, 0.5, 74);
    ctx.translate(m[0], m[1]); ctx.transform(1, 0.5, 0, 1, 0, 0);
    ctx.fillStyle = '#16141c';
    ctx.beginPath();
    ctx.moveTo(-60, 0); ctx.lineTo(-48, -70); ctx.quadraticCurveTo(-70, -96, -96, -84); ctx.lineTo(-100, -100); ctx.quadraticCurveTo(-64, -120, -36, -100);
    ctx.lineTo(-24, -128); ctx.quadraticCurveTo(0, -158, 24, -128); ctx.lineTo(36, -100); ctx.quadraticCurveTo(64, -120, 100, -100); ctx.lineTo(96, -84);
    ctx.quadraticCurveTo(70, -96, 48, -70); ctx.lineTo(60, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffe07a'; ctx.beginPath(); ctx.arc(-9, -126, 4, 0, 7); ctx.arc(9, -126, 4, 0, 7); ctx.fill();
    ctx.fillStyle = '#2a2a34';
    for (let i = 0; i < 9; i++) { const x = -210 + i * 48, h = 14 + ((i * 37) % 26); ctx.fillRect(x, -h, 30, h); ctx.beginPath(); ctx.moveTo(x - 4, -h); ctx.lineTo(x + 15, -h - 12); ctx.lineTo(x + 34, -h); ctx.fill(); }
    ctx.restore();
    poly(ctx, sq, 'rgba(255,255,255,0.08)');
    const [ax, ay] = P(fw / 2, fh / 2, 0);
    return { c, ax, ay };
  }, [
    { x: 3, y: 2.6, r: 4.5, color: '#cfe0ff', i: 0.55 },
    { x: 7, y: 2.6, r: 4.5, color: '#cfe0ff', i: 0.55 },
  ]);
}

export function getSnackBar() {
  return reg('snack_bar', 'Drive-in snack bar & projection booth, 3x3', "A low cinder-block drive-in snack bar and projection booth, white with red stripes, a glowing SNACKS sign, a giant popcorn bucket on the roof, a lit service window with candy and soda cups.", 3, 3, () => {
    const fw = 3, fh = 3;
    const W = (fw + fh) * HW + 60, Hh = (fw + fh) * HH + 220;
    const { c, ctx } = makeCanvas(W, Hh);
    const P = projector(fh * HW + 30, 200);
    isoBox(ctx, P, 0, 0, fw, fh, 0, 80, '#cfcac0', '#e8e2d6', '#a8a296');
    isoBox(ctx, P, -0.03, -0.03, fw + 0.03, fh + 0.03, 52, 62, '#c23b34', '#c23b34', '#8f2a24');
    isoBox(ctx, P, -0.08, -0.08, fw + 0.08, fh + 0.08, 80, 88, '#5a5560', '#4a4550', '#34303a');
    const win = faceQuad(P, 'L', fh, 0.5, 2.1, 18, 48);
    const wg = ctx.createLinearGradient(win[0][0], win[0][1], win[2][0], win[2][1]);
    wg.addColorStop(0, '#ffd896'); wg.addColorStop(1, '#f2a23c');
    poly(ctx, win, wg, '#111', 2);
    for (let i = 0; i < 6; i++) { const p = P(0.65 + i * 0.25, fh, 22); ctx.fillStyle = ['#ff4d6d', '#ffd23a', '#7dff5a', '#21d0ff'][i % 4]; ctx.fillRect(p[0] - 3, p[1] - 10, 6, 10); }
    poly(ctx, faceQuad(P, 'L', fh, 2.35, 2.8, 0, 58), '#3a2a20', '#111');
    poly(ctx, faceQuad(P, 'R', fw, 1.0, 1.6, 40, 62), '#0c0c10');
    signText(ctx, P, 'L', fh + 0.01, 1.3, 76, 'SNACKS', '#ffd23a', 14);
    // popcorn bucket
    const b = P(1.5, 1.5, 88);
    ctx.fillStyle = '#f4f0e2'; ctx.beginPath(); ctx.moveTo(b[0] - 18, b[1] - 46); ctx.lineTo(b[0] + 18, b[1] - 46); ctx.lineTo(b[0] + 13, b[1]); ctx.lineTo(b[0] - 13, b[1]); ctx.fill();
    ctx.fillStyle = '#c23b34'; for (let k = -1; k <= 1; k++) ctx.fillRect(b[0] + k * 10 - 3, b[1] - 46, 6, 46);
    for (let i = 0; i < 9; i++) circle(ctx, b[0] - 16 + i * 4, b[1] - 48 - (i % 3) * 3, 5, '#fff3c4');
    const [ax, ay] = P(fw / 2, fh / 2, 0);
    return { c, ax, ay };
  }, [{ x: 1.3, y: 3.4, r: 2.8, color: '#ffd896', i: 0.9 }]);
}

export function getSpeakerPost() {
  return reg('speaker_post', 'Drive-in speaker post', 'A short metal drive-in speaker post with two boxy grey speakers hanging off it.', 1, 1, () =>
    small(70, 120, (ctx, _P, ax, ay) => {
      ctx.fillStyle = '#3a3f48'; ctx.fillRect(ax - 2.5, ay - 50, 5, 50);
      for (const s of [-1, 1]) {
        ctx.fillStyle = '#8a909c'; ctx.fillRect(ax + s * 6 - (s < 0 ? 12 : 0), ay - 58, 12, 14);
        ctx.strokeStyle = '#1a1c22'; ctx.lineWidth = 1.5; ctx.strokeRect(ax + s * 6 - (s < 0 ? 12 : 0), ay - 58, 12, 14);
        ctx.fillStyle = '#2a2d34'; for (let k = 0; k < 3; k++) ctx.fillRect(ax + s * 6 - (s < 0 ? 10 : -2), ay - 55 + k * 4, 8, 1.5);
      }
    })
  );
}

export function getMarquee() {
  return reg('drivein_marquee', 'Drive-in roadside marquee sign', "A tall roadside drive-in marquee on two poles: a red arrow sign with chasing bulbs reading MOONLITE and a lightbox reading TONIGHT: CREATURE FEATURE.", 1, 1, () =>
    small(170, 300, (ctx, _P, ax, ay) => {
      ctx.fillStyle = '#2a2d34'; ctx.fillRect(ax - 34, ay - 170, 6, 170); ctx.fillRect(ax + 28, ay - 170, 6, 170);
      ctx.fillStyle = '#f4f0e2'; ctx.fillRect(ax - 62, ay - 172, 124, 44);
      ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.strokeRect(ax - 62, ay - 172, 124, 44);
      ctx.fillStyle = '#111'; ctx.font = '900 11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('TONIGHT:', ax, ay - 156); ctx.fillText('CREATURE FEATURE', ax, ay - 138);
      ctx.fillStyle = '#c23b34';
      ctx.beginPath(); ctx.moveTo(ax - 70, ay - 236); ctx.lineTo(ax + 50, ay - 236); ctx.lineTo(ax + 78, ay - 210); ctx.lineTo(ax + 50, ay - 184); ctx.lineTo(ax - 70, ay - 184); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#111'; ctx.stroke();
      ctx.fillStyle = '#ffd23a'; ctx.font = '900 20px sans-serif'; ctx.fillText('MOONLITE', ax - 2, ay - 202);
      for (let i = 0; i < 12; i++) { circle(ctx, ax - 64 + i * 10, ay - 230, 4, 'rgba(255,210,80,0.35)'); circle(ctx, ax - 64 + i * 10, ay - 230, 1.8, '#ffe07a'); circle(ctx, ax - 64 + i * 10, ay - 190, 1.8, '#ffe07a'); }
    }), [{ x: 0.5, y: 0.9, r: 2.6, color: '#ffd23a', i: 0.8 }]);
}

export function getVideoRental() {
  return reg('video_rental', 'Video rental superstore, 5x3, VIDEO VAULT sign', "A big 80s strip-mall video rental store, blue facade with a yellow ticket-shaped sign reading VIDEO VAULT and a BE KIND · REWIND banner, a huge lit window full of VHS shelves, horror movie posters, a drop-box for returns by the door.", 5, 3, () => {
    const fw = 5, fh = 3;
    const W = (fw + fh) * HW + 60, Hh = (fw + fh) * HH + 230;
    const { c, ctx } = makeCanvas(W, Hh);
    const P = projector(fh * HW + 30, 210);
    isoBox(ctx, P, -0.04, -0.04, fw + 0.04, fh + 0.04, 0, 8, '#8a857c', '#6e6960', '#55504a');
    isoBox(ctx, P, 0, 0, fw, fh, 8, 104, '#2a3f7a', '#24366a', '#172448');
    isoBox(ctx, P, -0.06, -0.06, fw + 0.06, fh + 0.06, 104, 116, '#1d2c58', '#2a3f7a', '#172448');
    // shop window with VHS shelves
    const win = faceQuad(P, 'L', fh, 0.3, 3.3, 16, 66);
    poly(ctx, win, '#1a1530', '#e6dfcc', 2);
    const cols = ['#ff4d6d', '#ffd23a', '#21d0ff', '#7dff5a', '#ff8a1e', '#b44dff', '#f4f0e2'];
    for (let row = 0; row < 3; row++) for (let i = 0; i < 26; i++) {
      const u = 0.38 + i * 0.112;
      const q = faceQuad(P, 'L', fh, u, u + 0.08, 22 + row * 15, 33 + row * 15);
      poly(ctx, q, cols[(i * 3 + row * 5) % cols.length]);
    }
    poly(ctx, win, 'rgba(255,220,150,0.18)');
    // posters
    for (const [u, col] of [[3.55, '#c23b34'], [4.25, '#2ec4b0']] as [number, string][]) {
      poly(ctx, faceQuad(P, 'L', fh, u, u + 0.5, 30, 70), col, '#111', 2);
      poly(ctx, faceQuad(P, 'L', fh, u + 0.12, u + 0.38, 40, 60), '#141018');
    }
    poly(ctx, faceQuad(P, 'L', fh, 3.35, 3.5, 0, 0), '#000');
    // door
    poly(ctx, faceQuad(P, 'L', fh, 3.38, 3.52, 8, 8), '#000');
    // sign
    const s0 = faceQuad(P, 'L', fh + 0.02, 0.6, 4.4, 76, 100);
    poly(ctx, s0, '#ffd23a', '#111', 2);
    signText(ctx, P, 'L', fh + 0.03, 2.5, 81, 'VIDEO VAULT', '#1d2c58', 19);
    signText(ctx, P, 'L', fh + 0.03, 2.5, 69, 'BE KIND · REWIND', '#ffd23a', 9);
    // drop box
    isoBox(ctx, P, 4.55, fh + 0.15, 4.85, fh + 0.45, 0, 34, '#c23b34', '#a32e28', '#7a221d');
    poly(ctx, faceQuad(P, 'L', fh + 0.45, 4.6, 4.8, 24, 28), '#111');
    const [ax, ay] = P(fw / 2, fh / 2, 0);
    return { c, ax, ay };
  }, [
    { x: 1.8, y: 3.6, r: 3.2, color: '#ffd896', i: 0.8 },
    { x: 2.5, y: 3.4, r: 2.4, color: '#ffd23a', i: 0.5 },
  ]);
}

export function getPrimarySchool() {
  return reg('primary_school', 'One-storey primary school with bell cupola, 6x3', "A friendly one-storey 1950s primary school, cream brick with a green trim band, a white bell cupola on the roof, big windows decorated with kids' paper pumpkins and bats, a sign reading HOLLOW CREEK PRIMARY over red double doors.", 6, 3, () => {
    const fw = 6, fh = 3;
    const W = (fw + fh) * HW + 60, Hh = (fw + fh) * HH + 260;
    const { c, ctx } = makeCanvas(W, Hh);
    const P = projector(fh * HW + 30, 240);
    isoBox(ctx, P, -0.05, -0.05, fw + 0.05, fh + 0.05, 0, 10, '#8a857c', '#6e6960', '#55504a');
    isoBox(ctx, P, 0, 0, fw, fh, 10, 100, '#cdb88c', '#d9c69a', '#a8946a');
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1;
    for (let z = 16; z < 100; z += 7) { const a = P(0, fh, z), b = P(fw, fh, z); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); const c1 = P(fw, 0, z), c2 = P(fw, fh, z); ctx.beginPath(); ctx.moveTo(c2[0], c2[1]); ctx.lineTo(c1[0], c1[1]); ctx.stroke(); }
    isoBox(ctx, P, -0.03, -0.03, fw + 0.03, fh + 0.03, 72, 80, '#3f7a4a', '#3f7a4a', '#2c5a34');
    // windows with paper decorations
    for (let u = 0.55; u < fw - 0.3; u += 0.9) {
      if (Math.abs(u - fw / 2) < 0.55) continue;
      const g = faceQuad(P, 'L', fh, u - 0.3, u + 0.3, 24, 64);
      const gr = ctx.createLinearGradient(g[0][0], g[0][1], g[2][0], g[2][1]);
      gr.addColorStop(0, '#ffcf7a'); gr.addColorStop(1, '#ffe8b0');
      poly(ctx, g, gr, '#f4f0e2', 2);
      const m = P(u, fh, 40);
      if ((u * 10 | 0) % 2) { circle(ctx, m[0], m[1] + 2, 6, '#ee7a22'); ctx.fillStyle = '#4a5a22'; ctx.fillRect(m[0] - 1, m[1] - 7, 2, 4); }
      else { ctx.fillStyle = '#1a1420'; ctx.beginPath(); ctx.moveTo(m[0], m[1]); ctx.quadraticCurveTo(m[0] - 5, m[1] - 5, m[0] - 10, m[1] - 1); ctx.quadraticCurveTo(m[0] - 5, m[1], m[0], m[1] + 3); ctx.quadraticCurveTo(m[0] + 5, m[1], m[0] + 10, m[1] - 1); ctx.quadraticCurveTo(m[0] + 5, m[1] - 5, m[0], m[1]); ctx.fill(); }
    }
    for (let u = 0.6; u < fh - 0.2; u += 0.9) poly(ctx, faceQuad(P, 'R', fw, u - 0.28, u + 0.28, 24, 64), '#e8b860', '#c9c2b0', 2);
    // doors
    const du = fw / 2;
    isoBox(ctx, P, du - 0.6, fh, du + 0.6, fh + 0.5, 0, 8, '#8a857c', '#6e6960', '#55504a');
    poly(ctx, faceQuad(P, 'L', fh, du - 0.42, du + 0.42, 10, 70), '#f4f0e2', 'rgba(0,0,0,0.6)');
    poly(ctx, faceQuad(P, 'L', fh, du - 0.36, du - 0.02, 10, 66), '#b0340c');
    poly(ctx, faceQuad(P, 'L', fh, du + 0.02, du + 0.36, 10, 66), '#b0340c');
    signText(ctx, P, 'L', fh + 0.02, du, 92, 'HOLLOW CREEK PRIMARY', '#1d3a22', 11);
    // flat roof + cupola
    isoBox(ctx, P, -0.08, -0.08, fw + 0.08, fh + 0.08, 100, 108, '#4a4550', '#3a3540', '#2a2630');
    isoBox(ctx, P, du - 0.4, fh / 2 - 0.4, du + 0.4, fh / 2 + 0.4, 108, 150, '#f4f0e2', '#e0dbcd', '#b8b3a6');
    poly(ctx, faceQuad(P, 'L', fh / 2 + 0.4, du - 0.2, du + 0.2, 116, 142), '#1a1420');
    const bt = P(du, fh / 2, 186);
    poly(ctx, [P(du - 0.48, fh / 2 + 0.48, 150), P(du + 0.48, fh / 2 + 0.48, 150), bt], '#3f7a4a', 'rgba(0,0,0,0.6)');
    poly(ctx, [P(du + 0.48, fh / 2 + 0.48, 150), P(du + 0.48, fh / 2 - 0.48, 150), bt], '#2c5a34', 'rgba(0,0,0,0.6)');
    const bl = P(du, fh / 2 + 0.4, 126); ellipse(ctx, bl[0], bl[1], 5, 7, '#c9a24a');
    const [ax, ay] = P(fw / 2, fh / 2, 0);
    return { c, ax, ay };
  }, [{ x: 3, y: 3.7, r: 2.8, color: '#ffd896', i: 0.85 }]);
}

/** Jungle-gym "fort" with a deck on top. The deck holds a mountable Candy Cannon (see getTurret). */
export const GYM_DECK_Z = 72;
export function getJungleGym(v: number) {
  const pal = v % 2 ? { bar: '#2a7ad8', deck: '#ff8a1e', slide: '#ffd23a' } : { bar: '#d8342a', deck: '#ffd23a', slide: '#2ec4b0' };
  return reg(`junglegym_${v}`, 'Playground jungle-gym fort, 3x3, deck on top (the Candy Cannon turret mounts on the deck centre)', `A chunky metal playground jungle gym: ${v % 2 ? 'blue' : 'red'} climbing bars, a square ${v % 2 ? 'orange' : 'yellow'} deck about 72px up with railings, monkey bars along one side, a wavy ${v % 2 ? 'yellow' : 'teal'} slide coming down toward the viewer and a ladder. Leave the middle of the deck empty (a turret is drawn there).`, 3, 3, () => {
    const fw = 3, fh = 3, Z = GYM_DECK_Z;
    const W = (fw + fh) * HW + 60, Hh = (fw + fh) * HH + 170;
    const { c, ctx } = makeCanvas(W, Hh);
    const P = projector(fh * HW + 30, 150);
    const bar = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, w = 4, col = pal.bar) => {
      const a = P(x0, y0, z0), b = P(x1, y1, z1);
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#140c12'; ctx.lineWidth = w + 2.5; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(a[0] - 1, a[1]); ctx.lineTo(b[0] - 1, b[1]); ctx.stroke();
    };
    const d0 = 0.7, d1 = 2.3;
    // back posts + climbing lattice (drawn first)
    for (const [x, y] of [[d0, d0], [d1, d0], [d0, d1]]) bar(x, y, 0, x, y, Z + 26);
    for (let z = 16; z < Z; z += 18) { bar(d0, d0, z, d1, d0, z, 3); bar(d0, d0, z, d0, d1, z, 3); }
    // monkey bars out the back-right
    bar(d1, d0, Z + 10, d1 + 0.6, d0 - 0.5, Z + 10, 3); bar(d1 + 0.6, d0 - 0.5, 0, d1 + 0.6, d0 - 0.5, Z + 10);
    // deck
    isoBox(ctx, P, d0, d0, d1, d1, Z - 8, Z, pal.deck, shade(pal.deck, -0.2), shade(pal.deck, -0.4), 'rgba(0,0,0,0.6)');
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1;
    for (let k = 1; k < 6; k++) { const a = P(d0 + (k * (d1 - d0)) / 6, d0, Z), b = P(d0 + (k * (d1 - d0)) / 6, d1, Z); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    // front posts + railings
    bar(d1, d1, 0, d1, d1, Z + 26);
    bar(d0, d1, Z + 22, d1, d1, Z + 22, 3); bar(d1, d0, Z + 22, d1, d1, Z + 22, 3);
    bar(d0, d0, Z + 22, d1, d0, Z + 22, 3); bar(d0, d0, Z + 22, d0, d1, Z + 22, 3);
    // ladder on the right face
    bar(d1 + 0.25, 1.1, 0, d1, 1.1, Z - 4, 3); bar(d1 + 0.25, 1.7, 0, d1, 1.7, Z - 4, 3);
    for (let k = 1; k < 5; k++) { const t = k / 5; bar(d1 + 0.25 * (1 - t), 1.1, Z * t - 4, d1 + 0.25 * (1 - t), 1.7, Z * t - 4, 2.5, '#c8ccd8'); }
    // wavy slide toward the viewer
    const sl: [number, number][] = [];
    for (let k = 0; k <= 10; k++) { const t = k / 10; sl.push(P(1.2, d1 + t * 0.95, Z - 4 - (Z - 8) * t + Math.sin(t * Math.PI * 2) * 4)); }
    for (let k = 10; k >= 0; k--) { const t = k / 10; sl.push(P(1.8, d1 + t * 0.95, Z - 4 - (Z - 8) * t + Math.sin(t * Math.PI * 2) * 4)); }
    poly(ctx, sl, pal.slide, '#140c12', 2);
    // turret mount ring in the deck centre
    const mc = P(1.5, 1.5, Z);
    ellipse(ctx, mc[0], mc[1], 20, 10, '#2a2d34'); ellipse(ctx, mc[0], mc[1] - 2, 15, 7.5, '#4a4f5a');
    const [ax, ay] = P(fw / 2, fh / 2, 0);
    return { c, ax, ay };
  });
}

export function getSwings() {
  return reg('swings', 'Playground swing set, 2x1', 'A metal A-frame playground swing set with two rubber-seat swings on chains, one swinging slightly.', 2, 1, () => {
    const fw = 2, fh = 1;
    const W = (fw + fh) * HW + 40, Hh = (fw + fh) * HH + 150;
    const { c, ctx } = makeCanvas(W, Hh);
    const P = projector(fh * HW + 20, 130);
    const line = (a: [number, number], b: [number, number], w: number, col: string) => { ctx.strokeStyle = '#140c12'; ctx.lineWidth = w + 2; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke(); };
    for (const x of [0.1, 1.9]) { line(P(x, 0.1, 0), P(x, 0.5, 100), 4, '#2ec4b0'); line(P(x, 0.9, 0), P(x, 0.5, 100), 4, '#2ec4b0'); }
    line(P(0.1, 0.5, 100), P(1.9, 0.5, 100), 4, '#2ec4b0');
    for (const [x, sw] of [[0.65, 0], [1.35, 0.25]] as [number, number][]) {
      const s = P(x, 0.5 + sw, 30);
      ctx.strokeStyle = '#a8b0bc'; ctx.lineWidth = 1.2;
      for (const dx of [-0.12, 0.12]) { const t = P(x + dx, 0.5, 100); ctx.beginPath(); ctx.moveTo(t[0], t[1]); ctx.lineTo(s[0] + dx * 60, s[1]); ctx.stroke(); }
      ctx.fillStyle = '#1a1c22'; ctx.fillRect(s[0] - 9, s[1] - 2, 18, 5);
    }
    const [ax, ay] = P(fw / 2, fh / 2, 0);
    return { c, ax, ay };
  });
}

export function getMerryGoRound() {
  return reg('merrygoround', 'Playground merry-go-round, 2x2', 'A low round playground merry-go-round: a flat disc with red/yellow/blue painted segments and curved hand rails.', 2, 2, () => {
    const fw = 2, fh = 2;
    const W = (fw + fh) * HW + 30, Hh = (fw + fh) * HH + 80;
    const { c, ctx } = makeCanvas(W, Hh);
    const P = projector(fh * HW + 15, 60);
    const ctr = P(1, 1, 12);
    ellipse(ctx, ctr[0], ctr[1] + 6, 62, 31, '#2a2d34');
    const cols = ['#d8342a', '#ffd23a', '#2a7ad8', '#2ec4b0'];
    for (let i = 0; i < 8; i++) {
      ctx.beginPath(); ctx.moveTo(ctr[0], ctr[1]); ctx.ellipse(ctr[0], ctr[1], 60, 30, 0, (i / 8) * Math.PI * 2, ((i + 1) / 8) * Math.PI * 2); ctx.closePath();
      ctx.fillStyle = cols[i % 4]; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.stroke();
    }
    ctx.strokeStyle = '#c8ccd8'; ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.4, x = ctr[0] + Math.cos(a) * 44, y = ctr[1] + Math.sin(a) * 22; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo((x + ctr[0]) / 2, (y + ctr[1]) / 2 - 22, ctr[0], ctr[1] - 16); ctx.stroke(); }
    const [ax, ay] = P(fw / 2, fh / 2, 0);
    return { c, ax, ay };
  });
}

export function getSchoolBus(flip: boolean): PropSprite {
  const base = reg('schoolbus', 'Yellow school bus, footprint 4x1 along world X', 'A parked classic yellow American school bus with black stripes, SCHOOL BUS lettering, dark windows, a stop-sign arm folded in.', 4, 1, () => {
    const fw = 4, fh = 1;
    const W = (fw + fh) * HW + 40, Hh = (fw + fh) * HH + 130;
    const { c, ctx } = makeCanvas(W, Hh);
    const P = projector(fh * HW + 20, 110);
    const y = '#f2b21c';
    isoBox(ctx, P, 0.1, 0.12, 3.9, 0.88, 10, 64, shade(y, 0.15), y, shade(y, -0.35));
    isoBox(ctx, P, 3.4, 0.16, 3.95, 0.84, 10, 40, shade(y, 0.1), y, shade(y, -0.35));
    for (let u = 0.3; u < 3.3; u += 0.42) poly(ctx, faceQuad(P, 'L', 0.88, u, u + 0.32, 40, 58), '#1f2c46', '#111');
    for (const z of [22, 34]) poly(ctx, faceQuad(P, 'L', 0.88, 0.1, 3.9, z, z + 2.5), '#1a1a1a');
    signText(ctx, P, 'L', 0.89, 1.8, 30, 'SCHOOL BUS', '#1a1a1a', 10);
    for (const x of [0.7, 3.2]) { const p = P(x, 0.88, 10); ellipse(ctx, p[0], p[1], 11, 11, '#0c0c0e'); ellipse(ctx, p[0], p[1], 4.5, 4.5, '#777'); }
    const sgn = P(1.0, 0.95, 40); circle(ctx, sgn[0], sgn[1], 7, '#c22'); ctx.fillStyle = '#fff'; ctx.font = '900 5px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('STOP', sgn[0], sgn[1] + 2);
    const [ax, ay] = P(fw / 2, fh / 2, 0);
    return { c, ax, ay };
  });
  if (!flip) return base;
  return cached('schoolbusF', () => mirrored(base));
}

export function getBarn() {
  return reg('barn', 'Red farm barn with gambrel roof, 4x3', 'A classic red wooden farm barn with a gambrel (two-slope) roof, white X-braced double doors, a hay loft door with straw poking out, a weather vane.', 4, 3, () => {
    const fw = 4, fh = 3, wallH = 90;
    const W = (fw + fh) * HW + 60, Hh = (fw + fh) * HH + 250;
    const { c, ctx } = makeCanvas(W, Hh);
    const P = projector(fh * HW + 30, 230);
    const red = '#9a2a22';
    isoBox(ctx, P, 0, 0, fw, fh, 0, wallH, red, shade(red, 0.05), shade(red, -0.4));
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
    for (let u = 0.15; u < fw; u += 0.18) { const a = P(u, fh, 0), b = P(u, fh, wallH); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    // gambrel roof, ridge along x, gable end on the right face
    const o = 0.15, z1 = wallH + 44, z2 = wallH + 80;
    poly(ctx, [P(-o, -o, wallH), P(fw + o, -o, wallH), P(fw + o, 0.7, z1), P(fw + o, fh / 2, z2), P(-o, fh / 2, z2), P(-o, 0.7, z1)], '#2a2228', 'rgba(0,0,0,0.6)');
    poly(ctx, [P(fw, 0, wallH), P(fw, fh, wallH), P(fw, fh - 0.7, z1), P(fw, fh / 2, z2), P(fw, 0.7, z1)], shade(red, -0.35), 'rgba(0,0,0,0.6)');
    poly(ctx, faceQuad(P, 'R', fw, fh / 2 - 0.3, fh / 2 + 0.3, wallH + 8, wallH + 44), '#f4f0e2', '#111');
    poly(ctx, faceQuad(P, 'R', fw, fh / 2 - 0.22, fh / 2 + 0.22, wallH + 12, wallH + 40), '#3a2a18');
    poly(ctx, [P(-o, fh / 2, z2), P(fw + o, fh / 2, z2), P(fw + o, fh - 0.7, z1), P(-o, fh - 0.7, z1)], '#7a6a72', 'rgba(0,0,0,0.6)');
    poly(ctx, [P(-o, fh - 0.7, z1), P(fw + o, fh - 0.7, z1), P(fw + o, fh + o, wallH), P(-o, fh + o, wallH)], '#5e5058', 'rgba(0,0,0,0.6)');
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
    for (let k = 1; k < 6; k++) { const yy = fh - 0.7 + (0.7 + o) * (k / 6), zz = z1 - (z1 - wallH) * (k / 6); const a = P(-o, yy, zz), b = P(fw + o, yy, zz); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(190,210,255,0.5)'; ctx.lineWidth = 2;
    { const a = P(-o, fh / 2, z2), b = P(fw + o, fh / 2, z2); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    // doors
    const dq = faceQuad(P, 'L', fh, 1.2, 2.8, 0, 70);
    poly(ctx, dq, '#f4f0e2', '#111', 1.5);
    poly(ctx, faceQuad(P, 'L', fh, 1.28, 2.72, 6, 64), shade(red, -0.1));
    ctx.strokeStyle = '#f4f0e2'; ctx.lineWidth = 3;
    for (const [u0, u1] of [[1.28, 2.0], [2.0, 2.72]]) { const a = P(u0, fh, 6), b = P(u1, fh, 64), cc = P(u0, fh, 64), d = P(u1, fh, 6); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.moveTo(cc[0], cc[1]); ctx.lineTo(d[0], d[1]); ctx.stroke(); }
    const vane = P(fw / 2, fh / 2, z2);
    ctx.strokeStyle = '#1a1420'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(vane[0], vane[1]); ctx.lineTo(vane[0], vane[1] - 26); ctx.moveTo(vane[0] - 10, vane[1] - 20); ctx.lineTo(vane[0] + 10, vane[1] - 20); ctx.stroke();
    const [ax, ay] = P(fw / 2, fh / 2, 0);
    return { c, ax, ay };
  }, [{ x: 2, y: 3.3, r: 2, color: '#ffbe5c', i: 0.6 }]);
}

export function getGazebo() {
  return reg('gazebo', 'White park gazebo, 2x2, lantern inside', 'A small white wooden park gazebo with eight posts, a railing, a dark shingled pointed roof and a glowing paper lantern hanging inside.', 2, 2, () => {
    const fw = 2, fh = 2;
    const W = (fw + fh) * HW + 40, Hh = (fw + fh) * HH + 190;
    const { c, ctx } = makeCanvas(W, Hh);
    const P = projector(fh * HW + 20, 170);
    isoBox(ctx, P, 0.1, 0.1, 1.9, 1.9, 0, 10, '#c8c2b4', '#a8a296', '#8a8478');
    const post = (x: number, y: number) => isoBox(ctx, P, x - 0.05, y - 0.05, x + 0.05, y + 0.05, 10, 92, '#f4f0e2', '#d8d3c6', '#b0ab9e');
    for (const [x, y] of [[0.2, 0.2], [1.8, 0.2], [0.2, 1.8]]) post(x, y);
    const lan = P(1, 1, 64);
    ctx.strokeStyle = '#3a3040'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(lan[0], lan[1] - 24); ctx.lineTo(lan[0], lan[1]); ctx.stroke();
    circle(ctx, lan[0], lan[1] + 6, 16, rgba('#ff9a2a', 0.3)); ellipse(ctx, lan[0], lan[1] + 6, 7, 9, '#ff9a2a');
    post(1.8, 1.8);
    for (const [a, b] of [[[0.2, 1.8], [1.8, 1.8]], [[1.8, 0.2], [1.8, 1.8]]] as [number, number][][]) {
      const p0 = P(a[0], a[1], 40), p1 = P(b[0], b[1], 40);
      ctx.strokeStyle = '#f4f0e2'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke();
    }
    const tp = P(1, 1, 150);
    poly(ctx, [P(0, 2, 92), P(2, 2, 92), tp], '#3a3446', 'rgba(0,0,0,0.6)');
    poly(ctx, [P(2, 2, 92), P(2, 0, 92), tp], '#26222e', 'rgba(0,0,0,0.6)');
    const [ax, ay] = P(fw / 2, fh / 2, 0);
    return { c, ax, ay };
  }, [{ x: 1, y: 1, r: 2.4, color: '#ff9a2a', i: 0.7 }]);
}

export function getBench() {
  return reg('bench', 'Park bench', 'A green wooden park bench with cast-iron legs.', 1, 1, () =>
    small(110, 100, (ctx, P) => {
      isoBox(ctx, P, 0.1, 0.4, 0.9, 0.62, 16, 20, '#3f7a4a', '#2c5a34', '#1d3a22');
      isoBox(ctx, P, 0.1, 0.36, 0.9, 0.42, 20, 36, '#3f7a4a', '#2c5a34', '#1d3a22');
      for (const x of [0.15, 0.85]) isoBox(ctx, P, x - 0.03, 0.42, x + 0.03, 0.6, 0, 16, '#1a1c22', '#1a1c22', '#111');
    })
  );
}

// =============== STATIONARY WEAPON: the Candy Cannon ===============
export const TURRET_DIRS = 16;
/**
 * The mounted gun on top of a jungle gym, one frame per aim direction (frame 0 points screen-right, then clockwise).
 * Drawn around its pivot; the engine places the pivot on the gym deck.
 */
let turretSheet: Sheet | null = null;
export function getTurretSheet(): Sheet {
  if (turretSheet) return turretSheet;
  return (turretSheet = (() => {
    const fw = 190, fh = 150, ax = 95, ay = 100, S = 1.6;
    const draw = (ctx: CanvasRenderingContext2D, cx: number, cy: number, f: number) => {
      ctx.translate(cx, cy); ctx.scale(S, S); ctx.translate(-cx, -cy);
      const a = (f / TURRET_DIRS) * Math.PI * 2;
      const dx = Math.cos(a), dy = Math.sin(a) * 0.55;
      // tripod
      ctx.strokeStyle = '#140c12'; ctx.lineWidth = 5;
      for (const k of [0.6, 2.7, 4.8]) { ctx.beginPath(); ctx.moveTo(cx, cy - 10); ctx.lineTo(cx + Math.cos(k) * 18, cy + Math.sin(k) * 9); ctx.stroke(); }
      ctx.strokeStyle = '#6e7480'; ctx.lineWidth = 3;
      for (const k of [0.6, 2.7, 4.8]) { ctx.beginPath(); ctx.moveTo(cx, cy - 10); ctx.lineTo(cx + Math.cos(k) * 18, cy + Math.sin(k) * 9); ctx.stroke(); }
      const back = dy < 0; // barrel pointing away: draw it behind the body
      const barrel = () => {
        for (const off of [-4, 4]) {
          const ox = -dy * off * 1.6, oy = dx * off * 0.8;
          const x0 = cx + ox, y0 = cy - 22 + oy, x1 = x0 + dx * 40, y1 = y0 + dy * 40;
          ctx.lineCap = 'round';
          ctx.strokeStyle = '#140c12'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
          ctx.strokeStyle = '#f4f0e2'; ctx.lineWidth = 6.5; ctx.stroke();
          ctx.setLineDash([4, 5]); ctx.strokeStyle = '#e0304a'; ctx.stroke(); ctx.setLineDash([]);
          circle(ctx, x1, y1, 4.5, '#140c12'); circle(ctx, x1, y1, 2.6, '#ff8a1e');
        }
      };
      if (back) barrel();
      // body + candy hopper
      ctx.fillStyle = '#140c12'; ctx.beginPath(); ctx.ellipse(cx, cy - 22, 17, 12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7a2eff'; ctx.beginPath(); ctx.ellipse(cx, cy - 22, 15, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.ellipse(cx - 4, cy - 26, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#140c12'; ctx.fillRect(cx - 9, cy - 50, 18, 22);
      ctx.fillStyle = 'rgba(190,230,255,0.75)'; ctx.fillRect(cx - 7, cy - 48, 14, 18);
      for (let i = 0; i < 6; i++) circle(ctx, cx - 4 + (i % 3) * 4, cy - 36 - Math.floor(i / 3) * 5, 2.2, ['#ff4d6d', '#ffd23a', '#7dff5a', '#21d0ff', '#ff8a1e', '#b44dff'][i]);
      // grips toward the gunner (opposite the barrel)
      ctx.strokeStyle = '#140c12'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(cx - dx * 12 - dy * 9, cy - 22 - dy * 12 + dx * 5); ctx.lineTo(cx - dx * 20 - dy * 9, cy - 18 - dy * 20 + dx * 5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - dx * 12 + dy * 9, cy - 22 - dy * 12 - dx * 5); ctx.lineTo(cx - dx * 20 + dy * 9, cy - 18 - dy * 20 - dx * 5); ctx.stroke();
      if (!back) barrel();
    };
    const e = sheetAsset(
      {
        key: 'turret_candycannon', file: 'props/turret_candycannon.png', category: 'sheet', w: fw * TURRET_DIRS, h: fh, frameW: fw, frameH: fh, frames: TURRET_DIRS, rows: ['aim'], rowFrames: [TURRET_DIRS], anchor: [ax, ay],
        desc: `Mounted "Candy Cannon" turret on a tripod, ${TURRET_DIRS} aim directions`,
        prompt: `${STYLE} A chunky toy-like twin-barrel mounted gun on a short tripod: candy-cane striped barrels, a purple round body and a clear hopper full of candy on top, rear grips. One row of ${TURRET_DIRS} frames of ${fw}x${fh}px: frame 0 aims screen-right, then rotate clockwise in ${360 / TURRET_DIRS}-degree steps (frame ${TURRET_DIRS / 4} aims toward the viewer/down). Pivot (tripod centre on the deck) at (${ax},${ay}) in every frame.`,
      },
      () => {
        const { c, ctx } = makeCanvas(fw * TURRET_DIRS, fh);
        for (let f = 0; f < TURRET_DIRS; f++) { ctx.save(); ctx.beginPath(); ctx.rect(f * fw, 0, fw, fh); ctx.clip(); draw(ctx, f * fw + ax, ay, f); ctx.restore(); }
        return c;
      }
    );
    return { img: e.img, fw, fh, scale: e.scale, rows: 1, rowFrames: e.rowFrames, ax, ay };
  })());
}
