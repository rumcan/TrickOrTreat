import { TW, TH, makeRng } from '../config';
import { makeCanvas, rawCanvas, shade, rgba } from './draw';
import { asset, Img } from '../assets';
import { tilePoint, curbPoint, curbCoordinates } from './street-geometry';

export enum G {
  GRASS = 0,
  ROAD = 1,
  SIDEWALK = 2,
  DIRT = 3,
  GRAVEL = 4,
  DARKGRASS = 5,
  DRIVEWAY = 6,
  FLAGSTONE = 7,
  FIELD = 8,
}

function genField(v: number) {
  const { c, ctx } = makeCanvas(TW, TH);
  const r = makeRng(5000 + v);
  ctx.save();
  clipTile(ctx);
  ctx.fillStyle = v === 1 ? '#33693a' : '#2c5d33';
  ctx.fillRect(0, 0, TW, TH);
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = r() < 0.5 ? 'rgba(20,60,26,0.5)' : 'rgba(120,190,120,0.08)';
    ctx.fillRect(r() * TW, r() * TH, 1, 2);
  }
  if (v === 2) {
    // yard line along the NE edge
    ctx.strokeStyle = 'rgba(244,240,226,0.85)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(TW * 0.5, TH * 0.04);
    ctx.lineTo(TW * 0.96, TH * 0.5);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(TW * 0.5, TH * 0.1);
    ctx.lineTo(TW * 0.9, TH * 0.5);
    ctx.stroke();
  }
  ctx.restore();
  return c;
}

const STYLE =
  'Seamless isometric 2:1 diamond ground tile, 128x64 px, transparent outside the diamond, top-down 3/4 Diablo II / Commandos style hand-painted pixel art, Halloween night lit by cold blue moonlight, no shadows cast by objects, edges must tile seamlessly with copies of itself.';

function clipTile(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(TW / 2, -1);
  ctx.lineTo(TW + 1, TH / 2);
  ctx.lineTo(TW / 2, TH + 1);
  ctx.lineTo(-1, TH / 2);
  ctx.closePath();
  ctx.clip();
}

function speckle(ctx: CanvasRenderingContext2D, r: () => number, n: number, cols: string[], w = 1, h = 1) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = cols[Math.floor(r() * cols.length)];
    ctx.fillRect(Math.floor(r() * TW), Math.floor(r() * TH), w, h);
  }
}

function blobs(ctx: CanvasRenderingContext2D, r: () => number, n: number, cols: string[], rx: number, ry: number) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = cols[Math.floor(r() * cols.length)];
    ctx.beginPath();
    ctx.ellipse(r() * TW, r() * TH, rx * (0.5 + r()), ry * (0.5 + r()), 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function leaves(ctx: CanvasRenderingContext2D, r: () => number, n: number) {
  const cols = ['#c8561e', '#e08a2a', '#a8321c', '#d9b13b', '#7a3a1a'];
  for (let i = 0; i < n; i++) {
    ctx.save();
    ctx.translate(r() * TW, r() * TH);
    ctx.rotate(r() * Math.PI);
    ctx.fillStyle = cols[Math.floor(r() * cols.length)];
    ctx.beginPath();
    ctx.ellipse(0, 0, 3 + r() * 2, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-2, 0, 4, 0.6);
    ctx.restore();
  }
}

function genGrass(seed: number, base: string, leafCount: number) {
  const { c, ctx } = makeCanvas(TW, TH);
  const r = makeRng(seed);
  ctx.save();
  clipTile(ctx);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, TW, TH);
  blobs(ctx, r, 16, [rgba('#000000', 0.08), rgba('#9fd18a', 0.05), rgba('#203a1c', 0.25)], 12, 6);
  for (let i = 0; i < 420; i++) {
    const x = r() * TW, y = r() * TH;
    const k = r();
    ctx.fillStyle = k < 0.45 ? shade(base, -0.28) : k < 0.85 ? shade(base, 0.14) : shade(base, 0.32);
    ctx.fillRect(Math.floor(x), Math.floor(y), 1, 2 + Math.floor(r() * 3));
  }
  leaves(ctx, r, leafCount);
  ctx.restore();
  return c;
}

function genAsphalt(seed: number) {
  const { c, ctx } = makeCanvas(TW, TH);
  const r = makeRng(seed);
  ctx.save();
  clipTile(ctx);
  ctx.fillStyle = '#2a2a31';
  ctx.fillRect(0, 0, TW, TH);
  blobs(ctx, r, 10, ['rgba(0,0,0,0.12)', 'rgba(120,120,150,0.05)'], 16, 8);
  speckle(ctx, r, 600, ['#33333b', '#24242a', '#3d3d47', '#1d1d22']);
  if (r() < 0.5) {
    // crack
    ctx.strokeStyle = 'rgba(10,10,12,0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    let x = r() * TW, y = r() * TH;
    ctx.moveTo(x, y);
    for (let i = 0; i < 6; i++) {
      x += (r() - 0.3) * 14;
      y += (r() - 0.5) * 8;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  if (r() < 0.3) blobs(ctx, r, 1, ['rgba(10,10,20,0.35)'], 10, 5); // oil stain
  ctx.restore();
  return c;
}

function genConcrete(seed: number, base: string, joints: boolean) {
  const { c, ctx } = makeCanvas(TW, TH);
  const r = makeRng(seed);
  ctx.save();
  clipTile(ctx);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, TW, TH);
  blobs(ctx, r, 10, [rgba('#000000', 0.06), rgba('#ffffff', 0.03)], 14, 7);
  speckle(ctx, r, 500, [shade(base, -0.12), shade(base, 0.08), shade(base, -0.22)]);
  if (joints) {
    ctx.strokeStyle = shade(base, -0.35);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    // split into 2x2 slabs
    ctx.moveTo(TW * 0.75, TH * 0.25);
    ctx.lineTo(TW * 0.25, TH * 0.75);
    ctx.moveTo(TW * 0.25, TH * 0.25);
    ctx.lineTo(TW * 0.75, TH * 0.75);
    ctx.stroke();
    // highlight
    ctx.strokeStyle = rgba('#ffffff', 0.08);
    ctx.beginPath();
    ctx.moveTo(TW * 0.75 + 1, TH * 0.25 + 1);
    ctx.lineTo(TW * 0.25 + 1, TH * 0.75 + 1);
    ctx.stroke();
  }
  if (r() < 0.35) {
    ctx.strokeStyle = shade(base, -0.4);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    let x = 30 + r() * 60, y = 15 + r() * 30;
    ctx.moveTo(x, y);
    for (let i = 0; i < 4; i++) {
      x += (r() - 0.5) * 12;
      y += (r() - 0.2) * 6;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  leaves(ctx, r, Math.floor(r() * 3));
  ctx.restore();
  return c;
}

function genDirt(seed: number) {
  const { c, ctx } = makeCanvas(TW, TH);
  const r = makeRng(seed);
  ctx.save();
  clipTile(ctx);
  ctx.fillStyle = '#3d2c22';
  ctx.fillRect(0, 0, TW, TH);
  blobs(ctx, r, 18, ['rgba(0,0,0,0.15)', 'rgba(120,80,50,0.12)'], 12, 6);
  speckle(ctx, r, 300, ['#4a3529', '#2e2019', '#5a4232']);
  for (let i = 0; i < 14; i++) {
    const x = r() * TW, y = r() * TH;
    ctx.fillStyle = '#6b6058';
    ctx.beginPath();
    ctx.ellipse(x, y, 1.5 + r() * 1.5, 1 + r(), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(x - 1, y - 1, 1, 1);
  }
  leaves(ctx, r, 4);
  ctx.restore();
  return c;
}

function genGravel(seed: number) {
  const { c, ctx } = makeCanvas(TW, TH);
  const r = makeRng(seed);
  ctx.save();
  clipTile(ctx);
  ctx.fillStyle = '#4a4744';
  ctx.fillRect(0, 0, TW, TH);
  for (let i = 0; i < 420; i++) {
    const x = r() * TW, y = r() * TH;
    const s = r();
    ctx.fillStyle = s < 0.3 ? '#5d5955' : s < 0.6 ? '#3a3734' : s < 0.85 ? '#6e6a64' : '#2a2826';
    ctx.beginPath();
    ctx.ellipse(x, y, 1 + r() * 1.6, 0.7 + r() * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  leaves(ctx, r, 3);
  ctx.restore();
  return c;
}

function genFlagstone(seed: number) {
  const { c, ctx } = makeCanvas(TW, TH);
  const r = makeRng(seed);
  const g = genGrass(seed + 99, '#2a4325', 2);
  ctx.drawImage(g, 0, 0);
  ctx.save();
  clipTile(ctx);
  const stones = [
    [44, 22], [78, 20], [64, 34], [40, 42], [86, 42], [62, 50],
  ];
  for (const [sx, sy] of stones) {
    const rx = 11 + r() * 4, ry = 5.5 + r() * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(sx + 1, sy + 1.5, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7b7670';
    ctx.beginPath();
    ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,200,255,0.12)';
    ctx.beginPath();
    ctx.ellipse(sx - 2, sy - 1.5, rx * 0.6, ry * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    speckle(ctx, r, 6, ['#5c5853'], 1, 1);
  }
  ctx.restore();
  return c;
}

const TILE_DESC: Record<G, { name: string; desc: string; variants: number; gen: (seed: number) => HTMLCanvasElement }> = {
  [G.GRASS]: { name: 'grass', desc: 'Short dark lawn grass at night, a few fallen autumn leaves (orange/red/yellow)', variants: 4, gen: (s) => genGrass(s, '#2c4626', s % 4 === 3 ? 14 : 3) },
  [G.ROAD]: { name: 'road', desc: 'Plain UNMARKED old suburban asphalt road, dark grey fine grain, occasional hairline crack. No painted lines, lane markings, stripes, curbs, road edges or crosswalks; these are separate engine overlays', variants: 3, gen: (s) => genAsphalt(s) },
  [G.SIDEWALK]: { name: 'sidewalk', desc: 'Concrete sidewalk, tile split into 2x2 slabs by expansion joints parallel to the diamond edges', variants: 3, gen: (s) => genConcrete(s, '#77787b', true) },
  [G.DIRT]: { name: 'dirt', desc: 'Garden soil / flower bed dirt with small pebbles', variants: 2, gen: (s) => genDirt(s) },
  [G.GRAVEL]: { name: 'gravel', desc: 'Cemetery gravel path, small grey/brown stones', variants: 2, gen: (s) => genGravel(s) },
  [G.DARKGRASS]: { name: 'darkgrass', desc: 'Overgrown dark cemetery / woods grass, darker and bluer than lawn', variants: 3, gen: (s) => genGrass(s, '#1f3324', 6) },
  [G.DRIVEWAY]: { name: 'driveway', desc: 'Lighter poured-concrete driveway, no slab joints, subtle tire stains', variants: 2, gen: (s) => genConcrete(s, '#6a6b6e', false) },
  [G.FLAGSTONE]: { name: 'flagstone', desc: 'Front-yard stepping stones path: grey flat oval flagstones set in lawn grass', variants: 2, gen: (s) => genFlagstone(s) },
  [G.FIELD]: { name: 'field', desc: 'Mown football-field turf, variant 2 has a white yard line on the NE edge', variants: 3, gen: (s) => genField(s % 3) },
};

export const TILE_VARIANTS = (g: G) => TILE_DESC[g].variants;

export function getTile(g: G, v: number): Img {
  const d = TILE_DESC[g];
  const vv = v % d.variants;
  const material = asset(
    {
      key: `tile_${d.name}_${vv}`,
      file: `tiles/tile_${d.name}_${vv}.png`,
      category: 'tile',
      w: TW,
      h: TH,
      desc: d.desc + ` (variant ${vv + 1}/${d.variants})`,
      prompt: `${STYLE} Content: ${d.desc}.`,
    },
    () => d.gen(1000 * (g + 1) + vv * 17 + 3)
  );
  return g === G.SIDEWALK ? alignedSidewalk(material) : material;
}

// Keep the generated painted materials, but never use their approximate slab/curb
// geometry as the map grid. These small canvases are built once, not per frame.
const sidewalkCache = new WeakMap<object, HTMLCanvasElement>();
const curbCache = new WeakMap<object, HTMLCanvasElement>();

function alignedSidewalk(material: Img) {
  const cached = sidewalkCache.get(material);
  if (cached) return cached;
  const c = rawCanvas(TW, TH), ctx = c.getContext('2d')!;
  const P = (u: number, v: number) => tilePoint(u, v, TW, TH);
  // Sample the interior of each painted slab, excluding the baked-in crooked
  // joints. Project it into four exact half-tile slabs, then draw shared joints.
  for (const u of [0, 0.5]) for (const v of [0, 0.5]) {
    const corners = [P(u, v), P(u + 0.5, v), P(u + 0.5, v + 0.5), P(u, v + 0.5)];
    ctx.save(); ctx.beginPath(); corners.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.clip();
    const scale = 0.5 / 0.34, source = P(u + 0.08, v + 0.08), dest = P(u, v);
    ctx.translate(dest[0] - source[0] * scale, dest[1] - source[1] * scale);
    ctx.scale(scale, scale); ctx.drawImage(material, 0, 0, TW, TH); ctx.restore();
  }
  ctx.save(); clipTile(ctx); ctx.lineWidth = 0.8; ctx.strokeStyle = '#222c39';
  ctx.beginPath();
  for (const t of [0, 0.5, 1]) {
    ctx.moveTo(...P(t, 0)); ctx.lineTo(...P(t, 1));
    ctx.moveTo(...P(0, t)); ctx.lineTo(...P(1, t));
  }
  ctx.stroke(); ctx.restore(); sidewalkCache.set(material, c); return c;
}

function alignedCurb(material: Img, edge: number) {
  const cached = curbCache.get(material);
  if (cached) return cached;
  const source = rawCanvas(TW, TH), sx = source.getContext('2d')!;
  sx.drawImage(material, 0, 0, TW, TH);
  const pixels = sx.getImageData(0, 0, TW, TH).data;
  const columns: number[][] = Array.from({ length: TW }, () => []);
  for (let x = 0; x < TW; x++) for (let y = 0; y < TH; y++) if (pixels[(y * TW + x) * 4 + 3] >= 128) columns[x].push(y);
  const occupied = columns.map((rows, x) => rows.length ? x : -1).filter(x => x >= 0);
  if (!occupied.length) return genCurb(edge);
  const lo = occupied[0], hi = occupied[occupied.length - 1];
  const c = rawCanvas(TW, TH), ctx = c.getContext('2d')!, out = ctx.createImageData(TW, TH), width = 0.12;
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
    const u = (x + 0.5) / TW + (y + 0.5) / TH - 0.5, v = (y + 0.5) / TH - (x + 0.5) / TW + 0.5;
    const [along, inset] = curbCoordinates(edge, u, v);
    if (u < 0 || u > 1 || v < 0 || v > 1 || inset < 0 || inset > width) continue;
    const progress = edge === 1 || edge === 2 ? 1 - along : along;
    let column = Math.round(lo + progress * (hi - lo));
    if (!columns[column].length) column = occupied.reduce((best, next) => Math.abs(next - column) < Math.abs(best - column) ? next : best, lo);
    const rows = columns[column], row = rows[Math.min(rows.length - 1, Math.floor(inset / width * rows.length))];
    const from = (row * TW + column) * 4, to = (y * TW + x) * 4;
    out.data.set(pixels.subarray(from, from + 3), to); out.data[to + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  ctx.save(); clipTile(ctx);
  for (const [inset, color] of [[0, '#adb2bc'], [width, '#18212c']] as const) {
    ctx.strokeStyle = color; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(...tilePoint(...curbPoint(edge, 0, inset), TW, TH)); ctx.lineTo(...tilePoint(...curbPoint(edge, 1, inset), TW, TH)); ctx.stroke();
  }
  ctx.restore(); curbCache.set(material, c); return c;
}

// ===== Edge overlays (drawn on top of base tiles) =====
// edges: 0=NE (neighbour y-1), 1=SE (x+1), 2=SW (y+1), 3=NW (x-1)
const EDGE_PTS: [number, number, number, number][] = [
  [TW / 2, 0, TW, TH / 2],
  [TW, TH / 2, TW / 2, TH],
  [TW / 2, TH, 0, TH / 2],
  [0, TH / 2, TW / 2, 0],
];
const EDGE_NAMES = ['ne', 'se', 'sw', 'nw'];
const CX = TW / 2, CY = TH / 2;

function inner(x: number, y: number, f: number): [number, number] {
  return [CX + (x - CX) * (1 - f), CY + (y - CY) * (1 - f)];
}

function genCurb(e: number) {
  const { c, ctx } = makeCanvas(TW, TH);
  const [ax, ay, bx, by] = EDGE_PTS[e];
  const a2 = tilePoint(...curbPoint(e, 0, 0.12), TW, TH), b2 = tilePoint(...curbPoint(e, 1, 0.12), TW, TH);
  const a3 = tilePoint(...curbPoint(e, 0, 0.045), TW, TH), b3 = tilePoint(...curbPoint(e, 1, 0.045), TW, TH);
  ctx.beginPath();
  ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(b2[0], b2[1]); ctx.lineTo(a2[0], a2[1]); ctx.closePath();
  ctx.fillStyle = '#9a9b9e';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(b3[0], b3[1]); ctx.lineTo(a3[0], a3[1]); ctx.closePath();
  ctx.fillStyle = e === 1 || e === 2 ? '#56575b' : '#b3b4b8';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath(); ctx.moveTo(a2[0], a2[1]); ctx.lineTo(b2[0], b2[1]); ctx.stroke();
  return c;
}

function genGrassFringe(e: number) {
  const { c, ctx } = makeCanvas(TW, TH);
  const r = makeRng(77 + e);
  const [ax, ay, bx, by] = EDGE_PTS[e];
  for (let i = 0; i < 70; i++) {
    const t = r();
    const x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
    const [ix, iy] = inner(x, y, 0.05 + r() * 0.1);
    ctx.strokeStyle = r() < 0.5 ? '#355a2c' : '#25401f';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(ix + (r() - 0.5) * 2, iy - 2 - r() * 2);
    ctx.stroke();
  }
  return c;
}

function genRoadLine(e: number) {
  const { c, ctx } = makeCanvas(TW, TH);
  const [ax, ay, bx, by] = EDGE_PTS[e];
  const a = inner(ax, ay, 0.03), b = inner(bx, by, 0.03);
  ctx.strokeStyle = '#d9b43a';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([16, 12]);
  ctx.lineDashOffset = -4;
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,240,180,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();
  return c;
}

/** crosswalk stripes: axis 'x' = stripes for a road running along x */
function genCrosswalk(axis: 'x' | 'y') {
  const { c, ctx } = makeCanvas(TW, TH);
  ctx.save();
  clipTile(ctx);
  ctx.fillStyle = 'rgba(225,225,215,0.82)';
  for (let i = 0; i < 4; i++) {
    const t0 = 0.08 + i * 0.24, t1 = t0 + 0.12;
    // stripes run perpendicular to the road direction
    const P = (u: number, v: number): [number, number] =>
      axis === 'x' ? [TW / 2 + (u - v) * TW / 2, (u + v) * TH / 2] : [TW / 2 + (v - u) * TW / 2, (u + v) * TH / 2];
    const pts = [P(t0, 0.1), P(t1, 0.1), P(t1, 0.9), P(t0, 0.9)];
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  return c;
}

const OVL_STYLE = 'Isometric 2:1 tile OVERLAY 128x64 px, fully transparent PNG/WEBP except the described detail, same art style as ground tiles.';

export function getCurb(e: number) {
  const material = asset(
    { key: `ovl_curb_${EDGE_NAMES[e]}`, file: `overlays/ovl_curb_${EDGE_NAMES[e]}.png`, category: 'overlay', w: TW, h: TH, desc: `Concrete curb strip along the ${EDGE_NAMES[e].toUpperCase()} edge of a sidewalk tile (road is on that side)`, prompt: `${OVL_STYLE} A raised light-grey concrete curb running exactly along the ${EDGE_NAMES[e].toUpperCase()} diamond edge, ~9px wide.` },
    () => genCurb(e)
  );
  return alignedCurb(material, e);
}
export function getFringe(e: number) {
  return asset(
    { key: `ovl_grass_${EDGE_NAMES[e]}`, file: `overlays/ovl_grass_${EDGE_NAMES[e]}.png`, category: 'overlay', w: TW, h: TH, desc: `Grass blades overhanging onto a hard tile from the ${EDGE_NAMES[e].toUpperCase()} edge`, prompt: `${OVL_STYLE} Tufts of dark lawn grass spilling over the ${EDGE_NAMES[e].toUpperCase()} diamond edge.` },
    () => genGrassFringe(e)
  );
}
export function getRoadLine(e: number) {
  return asset(
    { key: `ovl_roadline_${EDGE_NAMES[e]}`, file: `overlays/ovl_roadline_${EDGE_NAMES[e]}.png`, category: 'overlay', w: TW, h: TH, desc: `Dashed yellow road centre line on the ${EDGE_NAMES[e].toUpperCase()} edge`, prompt: `${OVL_STYLE} Worn dashed yellow road centre line along the ${EDGE_NAMES[e].toUpperCase()} diamond edge.` },
    () => genRoadLine(e)
  );
}
export function getCrosswalk(axis: 'x' | 'y') {
  return asset(
    { key: `ovl_crosswalk_${axis}`, file: `overlays/ovl_crosswalk_${axis}.png`, category: 'overlay', w: TW, h: TH, desc: `Zebra crosswalk stripes for a road running along the world ${axis.toUpperCase()} axis`, prompt: `${OVL_STYLE} Four worn white zebra crossing stripes, iso-projected.` },
    () => genCrosswalk(axis)
  );
}
