import { MAP_W, MAP_H, CR, CW, CH, makeRng } from './config';
import { G, TILE_VARIANTS, getTile, getCurb, getFringe, getRoadLine, getCrosswalk } from './art/tiles';
import {
  PropSprite, getHouse, HOUSE_COUNT, houseDims, getTree, getBush, getHedge, getFence, getGrave, getCrypt, getPumpkin, getLamp,
  getMailbox, getTrash, getHydrant, getCar, getShop, getVending, getHayScarecrow,
  getSchool, getArcade, getDiner, getVideoStore, getWaterTower, getGate, getBleachers, getGoalPosts, getScoreboard,
} from './art/props';
import { Img } from './assets';

export interface PropInst {
  id: number;
  sp: PropSprite;
  x0: number; y0: number; fw: number; fh: number;
  big: boolean; // multi-tile -> uses footprint occlusion test
  kind: string;
  shadow: number; // ellipse radius in tiles (small props) or height factor (big)
  interact?: 'shop';
  fade?: number; // runtime alpha
  removed?: boolean;
}
export interface Gate {
  id: number;
  propIds: number[];
  cells: [number, number][];
  openAt: number;
  name: string;
  dir: 'n' | 'e' | 's' | 'w';
  x: number; y: number;
  opened: boolean;
}
export interface LightSrc { x: number; y: number; r: number; color: string; i: number; flicker: number }
export interface HouseInst {
  prop: PropInst;
  door: { x: number; y: number };
  light: LightSrc | null;
  visited: boolean;
  trick: boolean;
  owner: string;
}

export interface GameMap {
  ground: Uint8Array;
  tiles: Img[];
  overlays: Img[][];
  coll: Uint8Array; // 0 free, 1 low (blocks walking), 2 high (blocks walking + bullets)
  props: PropInst[];
  lights: LightSrc[];
  shops: { x: number; y: number; prop: PropInst }[];
  houses: HouseInst[];
  gates: Gate[];
  start: { x: number; y: number };
}

const OWNERS = ['Mrs. Henderson', 'Mr. Kowalski', 'Old Man Jenkins', 'The Nguyens', 'Ms. Petrova', 'Grandma Rose', 'Coach Miller', 'Dr. Alvarez', 'The Johnsons', 'Mrs. Okafor', 'Mr. Bellamy', 'Aunt Dottie'];

const ROADS = [22, 23, 46, 47, 70, 71];
const isRoadLine = (v: number) => ROADS.includes(v);


export function buildMap(seed = 1337): GameMap {
  const rnd = makeRng(seed);
  const N = MAP_W * MAP_H;
  const ground = new Uint8Array(N).fill(G.GRASS);
  const occ = new Uint8Array(N);
  const coll = new Uint8Array(CW * CH);
  const props: PropInst[] = [];
  const lights: LightSrc[] = [];
  const shops: GameMap['shops'] = [];
  const houses: HouseInst[] = [];
  let pid = 1;
  const idx = (x: number, y: number) => y * MAP_W + x;
  const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;

  // ---- base ground ----
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      if (isRoadLine(x) || isRoadLine(y)) ground[idx(x, y)] = G.ROAD;
      else if (x < 3 || y < 3 || x > 90 || y > 90) ground[idx(x, y)] = G.DARKGRASS;
    }
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      if (ground[idx(x, y)] === G.ROAD) continue;
      let nearRoad = false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inMap(x + dx, y + dy) && ground[idx(x + dx, y + dy)] === G.ROAD) nearRoad = true;
      if (nearRoad) ground[idx(x, y)] = G.SIDEWALK;
    }

  // ---- collision helpers ----
  const markRect = (x0: number, y0: number, x1: number, y1: number, v: number) => {
    const cx0 = Math.max(0, Math.floor(x0 * CR)), cy0 = Math.max(0, Math.floor(y0 * CR));
    const cx1 = Math.min(CW, Math.ceil(x1 * CR)), cy1 = Math.min(CH, Math.ceil(y1 * CR));
    for (let cy = cy0; cy < cy1; cy++) for (let cx = cx0; cx < cx1; cx++) coll[cy * CW + cx] = Math.max(coll[cy * CW + cx], v);
  };
  const free = (x: number, y: number, w = 1, h = 1, allowHard = false) => {
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) {
        if (!inMap(xx, yy) || occ[idx(xx, yy)]) return false;
        const g = ground[idx(xx, yy)];
        if (!allowHard && (g === G.ROAD || g === G.SIDEWALK)) return false;
        if (g === G.ROAD) return false;
      }
    return true;
  };
  const occupy = (x: number, y: number, w: number, h: number) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (inMap(xx, yy)) occ[idx(xx, yy)] = 1;
  };
  const addLights = (sp: PropSprite, x0: number, y0: number) => {
    for (const l of sp.lights) lights.push({ x: x0 + l.x, y: y0 + l.y, r: l.r, color: l.color, i: l.i, flicker: l.color === '#ff9a2a' || l.color === '#ffbe5c' ? 1 : 0 });
  };
  const addBig = (sp: PropSprite, x0: number, y0: number, kind: string, shadow = 1) => {
    const p: PropInst = { id: pid++, sp, x0, y0, fw: sp.fw, fh: sp.fh, big: true, kind, shadow };
    props.push(p);
    occupy(x0, y0, sp.fw, sp.fh);
    markRect(x0 + 0.02, y0 + 0.02, x0 + sp.fw - 0.02, y0 + sp.fh - 0.02, 2);
    addLights(sp, x0, y0);
    return p;
  };
  type SmallKind = 'tree' | 'bush' | 'hedge' | 'fencex' | 'fencey' | 'grave' | 'pumpkin' | 'lamp' | 'mailbox' | 'trash' | 'hydrant' | 'vending' | 'scarecrow';
  const addSmall = (sp: PropSprite, x: number, y: number, kind: SmallKind, allowHard = false, force = false) => {
    if (!force && !free(x, y, 1, 1, allowHard)) return null;
    const shadowR: Record<SmallKind, number> = { tree: 0.55, bush: 0.4, hedge: 0, fencex: 0, fencey: 0, grave: 0.25, pumpkin: 0.2, lamp: 0.15, mailbox: 0.15, trash: 0.18, hydrant: 0.13, vending: 0.35, scarecrow: 0.3 };
    const p: PropInst = { id: pid++, sp, x0: x, y0: y, fw: 1, fh: 1, big: false, kind, shadow: shadowR[kind] };
    props.push(p);
    occupy(x, y, 1, 1);
    const c = 0.5;
    switch (kind) {
      case 'tree': markRect(x + c - 0.2, y + c - 0.2, x + c + 0.2, y + c + 0.2, 2); break;
      case 'bush': markRect(x + c - 0.3, y + c - 0.3, x + c + 0.3, y + c + 0.3, 1); break;
      case 'hedge': markRect(x, y, x + 1, y + 1, 1); break;
      case 'fencex': markRect(x, y + 0.3, x + 1, y + 0.7, 1); break;
      case 'fencey': markRect(x + 0.3, y, x + 0.7, y + 1, 1); break;
      case 'grave': markRect(x + 0.25, y + 0.3, x + 0.75, y + 0.7, 1); break;
      case 'vending': markRect(x + 0.2, y + 0.3, x + 0.8, y + 0.75, 2); break;
      case 'lamp': markRect(x + 0.4, y + 0.4, x + 0.6, y + 0.6, 2); break;
      default: markRect(x + 0.35, y + 0.35, x + 0.65, y + 0.65, 1);
    }
    addLights(sp, x, y);
    return p;
  };

  // ---- house lots ----
  const houseBlock = (bx: number, by: number, withShop: boolean) => {
    for (let ly = 0; ly < 2; ly++)
      for (let lx = 0; lx < 2; lx++) {
        const ox = bx + lx * 6, oy = by + ly * 6;
        if (withShop && lx === 0 && ly === 1) {
          // candy stand lot
          for (let y = oy; y < oy + 6; y++) for (let x = ox; x < ox + 6; x++) if (rnd() < 0.5) ground[idx(x, y)] = G.DIRT;
          const shopP = addBig(getShop(), ox + 2, oy + 2, 'shop', 0.8);
          shopP.interact = 'shop';
          shops.push({ x: ox + 3, y: oy + 4.4, prop: shopP });
          addSmall(getPumpkin(0), ox + 1, oy + 4, 'pumpkin');
          addSmall(getPumpkin(1), ox + 4, oy + 4, 'pumpkin');
          addSmall(getHayScarecrow(), ox + 1, oy + 1, 'scarecrow');
          addSmall(getPumpkin(1), ox + 4, oy + 1, 'pumpkin');
          addSmall(getTree('oak', 1), ox + 5, oy, 'tree');
          continue;
        }
        const v = Math.floor(rnd() * HOUSE_COUNT);
        const flip = rnd() < 0.35;
        const d = houseDims(v);
        const fw = flip ? d.fh : d.fw, fh = flip ? d.fw : d.fh;
        const hx = ox + 1, hy = oy + 1;
        const house = getHouse(v, flip);
        const lightStart = lights.length;
        const hp = addBig(house, hx, hy, 'house', 1);
        const pl = house.lights[0];
        const door = { x: hx + pl.x, y: hy + pl.y };
        occupy(Math.floor(door.x), Math.floor(door.y), 1, 1);
        houses.push({ prop: hp, door, light: lights[lightStart] || null, visited: false, trick: false, owner: OWNERS[houses.length % OWNERS.length] });
        // flower bed along front + path
        if (!flip) {
          const doorX = hx + (fw >= 4 ? 1 : 1);
          for (let x = hx; x < hx + fw; x++) if (x !== doorX && free(x, hy + fh)) ground[idx(x, hy + fh)] = G.DIRT;
          for (let y = hy + fh; y < oy + 6; y++) if (ground[idx(doorX, y)] === G.GRASS) ground[idx(doorX, y)] = G.FLAGSTONE;
          occupy(doorX, hy + fh, 1, 1);
          for (let x = hx; x < hx + fw; x++) if (x !== doorX && rnd() < 0.45) addSmall(getBush(Math.floor(rnd() * 3)), x, hy + fh, 'bush');
          if (ly === 1) addSmall(getMailbox(), doorX + 1, oy + 5, 'mailbox');
          if (rnd() < 0.8) addSmall(getPumpkin(Math.floor(rnd() * 2)), doorX - 1 < hx ? doorX + 1 : doorX - 1, oy + 5, 'pumpkin');
        } else {
          for (let y = hy; y < hy + fh; y++) if (y !== hy + 1 && rnd() < 0.5) addSmall(getBush(Math.floor(rnd() * 3)), hx + fw, y, 'bush');
        }
        // driveway + car on lower lots
        if (ly === 1 && rnd() < 0.65) {
          const dx = ox + 5;
          for (let y = oy; y < oy + 6; y++) ground[idx(dx, y)] = G.DRIVEWAY;
          addBig(getCar(Math.floor(rnd() * 4), true), dx, oy + 2, 'car', 0.5);
          occupy(dx, oy, 1, 6);
        }
        // yard decorations
        const deco = 3 + Math.floor(rnd() * 3);
        for (let i = 0; i < deco; i++) {
          const x = ox + Math.floor(rnd() * 6), y = oy + Math.floor(rnd() * 6);
          const k = rnd();
          if (k < 0.3) addSmall(getTree(rnd() < 0.6 ? 'oak' : 'dead', Math.floor(rnd() * 3)), x, y, 'tree');
          else if (k < 0.45) addSmall(getPumpkin(Math.floor(rnd() * 2)), x, y, 'pumpkin');
          else if (k < 0.6) addSmall(getGrave(Math.floor(rnd() * 3)), x, y, 'grave');
          else if (k < 0.7) addSmall(getTrash(), x, y, 'trash');
          else if (k < 0.78) addSmall(getHayScarecrow(), x, y, 'scarecrow');
          else addSmall(getBush(Math.floor(rnd() * 3)), x, y, 'bush');
        }
        // back fence between upper and lower lots (with a gap)
        if (ly === 0) {
          const gap = ox + 1 + Math.floor(rnd() * 4);
          for (let x = ox; x < ox + 6; x++) if (x !== gap && x !== gap + 1) addSmall(getFence('picket', 'x'), x, oy + 5, 'fencex');
        }
        // side hedge between left/right lots
        if (lx === 0 && rnd() < 0.7) {
          const g0 = oy + Math.floor(rnd() * 4);
          for (let y = oy; y < oy + 6; y++) if (y < g0 || y > g0 + 1) addSmall(rnd() < 0.5 ? getHedge() : getFence('picket', 'y'), ox + 5, y, rnd() < 0.5 ? 'hedge' : 'fencey');
        }
      }
  };

  const cemetery = (bx: number, by: number) => {
    for (let y = by; y < by + 12; y++) for (let x = bx; x < bx + 12; x++) ground[idx(x, y)] = G.DARKGRASS;
    const px = bx + 5, py = by + 5;
    for (let i = 0; i < 12; i++) {
      ground[idx(px, by + i)] = G.GRAVEL; ground[idx(px + 1, by + i)] = G.GRAVEL;
      ground[idx(bx + i, py)] = G.GRAVEL; ground[idx(bx + i, py + 1)] = G.GRAVEL;
    }
    for (let i = 0; i < 12; i++) {
      const gate = i === 5 || i === 6;
      if (!gate) {
        addSmall(getFence('iron', 'x'), bx + i, by, 'fencex');
        addSmall(getFence('iron', 'x'), bx + i, by + 11, 'fencex');
        if (i > 0 && i < 11) {
          addSmall(getFence('iron', 'y'), bx, by + i, 'fencey');
          addSmall(getFence('iron', 'y'), bx + 11, by + i, 'fencey');
        }
      } else {
        occupy(bx + i, by, 1, 1); occupy(bx + i, by + 11, 1, 1); occupy(bx, by + i, 1, 1); occupy(bx + 11, by + i, 1, 1);
      }
    }
    for (let i = 0; i < 12; i++) { occupy(px, by + i, 2, 1); occupy(bx + i, py, 1, 2); }
    addBig(getCrypt(), bx + 7, by + 2, 'crypt', 1.2);
    for (let y = by + 1; y < by + 11; y += 2)
      for (let x = bx + 1; x < bx + 11; x += 2) {
        if (rnd() < 0.82) addSmall(getGrave(Math.floor(rnd() * 3)), x + (rnd() < 0.5 ? 1 : 0), y, 'grave');
      }
    for (let i = 0; i < 5; i++) addSmall(getTree('dead', Math.floor(rnd() * 3)), bx + 1 + Math.floor(rnd() * 10), by + 1 + Math.floor(rnd() * 10), 'tree');
    addSmall(getPumpkin(1), px - 1, py - 1, 'pumpkin', false, false);
    addSmall(getPumpkin(0), px + 2, py + 2, 'pumpkin', false, false);
  };

  // ================= DISTRICTS =================
  // CENTER — home suburb (always open)
  houseBlock(26, 26, true);
  for (let i = 0; i < 6; i++) addSmall(getTree('oak', i % 3), 25 + Math.floor(rnd() * 20), 40 + Math.floor(rnd() * 5), 'tree');

  // NORTH — Maple Falls Elementary + football field
  {
    addBig(getSchool(), 29, 5, 'school', 1.2);
    for (let y = 11; y <= 20; y++) for (let x = 26; x <= 43; x++) ground[idx(x, y)] = G.FIELD;
    addSmall(getBleachers(), 30, 10, 'hedge', false, true);
    addSmall(getBleachers(), 34, 10, 'hedge', false, true);
    addSmall(getGoalPosts(), 26, 15, 'hydrant', false, true);
    addSmall(getGoalPosts(), 43, 15, 'hydrant', false, true);
    addSmall(getScoreboard(), 44, 11, 'lamp', false, true);
    for (const [lx, ly] of [[25, 6], [44, 6], [25, 16], [44, 16]]) addSmall(getLamp(), lx, ly, 'lamp', true, true);
    for (let i = 0; i < 5; i++) addSmall(getTree('oak', i % 3), 46 + Math.floor(rnd() * 3), 5 + Math.floor(rnd() * 15), 'tree');
    for (let i = 0; i < 4; i++) addSmall(getBush(i % 3), 27 + i * 5, 21, 'bush', false, true);
  }

  // EAST — the Starcade + parking lot
  {
    addBig(getArcade(), 50, 26, 'arcade', 1);
    for (let y = 26; y <= 31; y++) for (let x = 56; x <= 66; x++) ground[idx(x, y)] = G.DRIVEWAY;
    addBig(getCar(1, true), 57, 27, 'car', 0.5);
    addBig(getCar(3, true), 61, 28, 'car', 0.5);
    addBig(getCar(0, true), 64, 27, 'car', 0.5);
    const v = addSmall(getVending(), 55, 30, 'vending', true, true);
    if (v) { v.interact = 'shop'; shops.push({ x: 55.5, y: 31.2, prop: v }); }
    addSmall(getLamp(), 56, 25, 'lamp', true, true);
    addSmall(getLamp(), 66, 25, 'lamp', true, true);
    houseBlock(56, 33, false);
    for (let i = 0; i < 4; i++) addSmall(getPumpkin(i % 2), 50 + Math.floor(rnd() * 4), 30 + Math.floor(rnd() * 2), 'pumpkin', false, true);
  }

  // SOUTH — downtown: Mel's Diner + video store + park
  {
    addBig(getDiner(), 27, 50, 'diner', 1);
    addBig(getVideoStore(), 33, 50, 'video', 1);
    const v = addSmall(getVending(), 32, 54, 'vending', true, true);
    if (v) { v.interact = 'shop'; shops.push({ x: 32.5, y: 55.2, prop: v }); }
    for (let i = 0; i < 6; i++) addSmall(getTree('oak', i % 3), 39 + Math.floor(rnd() * 5), 50 + Math.floor(rnd() * 6), 'tree');
    for (let i = 0; i < 3; i++) addSmall(getPumpkin(i % 2), 40 + i * 2, 56, 'pumpkin', false, true);
    addSmall(getHayScarecrow(), 43, 52, 'scarecrow', false, true);
    houseBlock(26, 57, false);
    for (const [lx, ly] of [[26, 49], [37, 49], [26, 56], [44, 55]]) addSmall(getLamp(), lx, ly, 'lamp', true, true);
  }

  // WEST — old cemetery + water tower
  {
    cemetery(4, 27);
    addBig(getWaterTower(), 8, 41, 'tower', 1);
    for (let i = 0; i < 6; i++) addSmall(getTree('pine', i % 3), 16 + Math.floor(rnd() * 4), 27 + Math.floor(rnd() * 16), 'tree');
  }

  // NW — pumpkin farm
  {
    for (let y = 6; y <= 18; y += 2) for (let x = 5; x <= 18; x++) ground[idx(x, y)] = G.DIRT;
    for (let y = 6; y <= 18; y += 2) for (let x = 5; x <= 18; x++) if (rnd() < 0.22) addSmall(getPumpkin(Math.floor(rnd() * 2)), x, y, 'pumpkin', false, true);
    addSmall(getHayScarecrow(), 11, 9, 'scarecrow', false, true);
    addSmall(getHayScarecrow(), 15, 15, 'scarecrow', false, true);
    for (let i = 0; i < 5; i++) addSmall(getTree('dead', i % 3), 4 + Math.floor(rnd() * 16), 4 + Math.floor(rnd() * 3), 'tree');
  }
  // Corner quadrants stay sealed wilderness (decorative depth beyond the walls)

  // ---- street lamps along the centre grid ----
  for (const r of [22, 46, 70]) {
    for (const k of [26, 32, 38, 42, 52, 58, 64]) {
      if (inMap(k, r + 2) && ground[idx(k, r + 2)] === G.SIDEWALK) addSmall(getLamp(), k, r + 2, 'lamp', true);
      if (inMap(r + 2, k) && ground[idx(r + 2, k)] === G.SIDEWALK) addSmall(getLamp(), r + 2, k, 'lamp', true);
    }
  }
  for (let i = 0; i < 16; i++) {
    const x = 24 + Math.floor(rnd() * 46), y = 24 + Math.floor(rnd() * 46);
    if (inMap(x, y) && ground[idx(x, y)] === G.SIDEWALK && !occ[idx(x, y)]) addSmall(rnd() < 0.5 ? getHydrant() : getTrash(), x, y, rnd() < 0.5 ? 'hydrant' : 'trash', true);
  }

  // ================= GATED DISTRICT WALLS =================
  // Hedge blockade lines seal each outer district behind a single gate.
  const gates: Gate[] = [];
  const hedgeWall = (axis: 'x' | 'y', line: number, line2: number, gapA: number, gapB: number) => {
    for (let t = 3; t <= 90; t++) {
      if (t === gapA || t === gapB) continue;
      const x = axis === 'x' ? t : line, y = axis === 'x' ? line : t;
      const x2 = axis === 'x' ? t : line2, y2 = axis === 'x' ? line2 : t;
      for (const [hx, hy] of [[x, y], [x2, y2]]) {
        if (!inMap(hx, hy) || occ[idx(hx, hy)]) continue;
        const p: PropInst = { id: pid++, sp: getHedge(), x0: hx, y0: hy, fw: 1, fh: 1, big: false, kind: 'hedge', shadow: 0 };
        props.push(p);
        occupy(hx, hy, 1, 1);
        markRect(hx, hy, hx + 1, hy + 1, 1);
      }
    }
  };
  const addGate = (x: number, y: number, openAt: number, name: string, dir: Gate['dir']) => {
    const p = addBig(getGate(), x, y, 'gate', 0.3);
    const cells: [number, number][] = [];
    for (let cy = Math.floor(y * CR); cy < Math.floor((y + 2) * CR); cy++)
      for (let cx = Math.floor(x * CR); cx < Math.floor((x + 2) * CR); cx++) cells.push([cx, cy]);
    gates.push({ id: p.id, propIds: [p.id], cells, openAt, name, dir, x: x + 1, y: y + 1, opened: false });
  };
  hedgeWall('x', 22, 23, 34, 35);
  addGate(34, 22, 60, 'THE SCHOOL YARD', 'n');
  hedgeWall('y', 46, 47, 34, 35);
  addGate(46, 34, 120, 'THE STARCADE', 'e');
  hedgeWall('x', 70, 71, 34, 35);
  addGate(34, 70, 180, 'DOWNTOWN', 's');
  hedgeWall('y', 22, 23, 34, 35);
  addGate(22, 34, 240, 'THE OLD CEMETERY', 'w');

  // ---- woods (outer ring) ----
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      if (ground[idx(x, y)] !== G.DARKGRASS) continue;
      const edge = x <= 1 || y <= 1 || x >= MAP_W - 2 || y >= MAP_H - 2;
      const k = rnd();
      if (k < (edge ? 0.7 : 0.28)) addSmall(getTree(rnd() < 0.55 ? 'pine' : 'dead', Math.floor(rnd() * 3)), x, y, 'tree');
      else if (k < 0.34) addSmall(getBush(Math.floor(rnd() * 3)), x, y, 'bush');
    }
  // map boundary
  markRect(0, 0, MAP_W, 0.6, 2);
  markRect(0, MAP_H - 0.6, MAP_W, MAP_H, 2);
  markRect(0, 0, 0.6, MAP_H, 2);
  markRect(MAP_W - 0.6, 0, MAP_W, MAP_H, 2);

  // ---- tiles & overlays ----
  const tiles: Img[] = new Array(N);
  const overlays: Img[][] = new Array(N);
  const nb = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const isGreen = (g: number) => g === G.GRASS || g === G.DARKGRASS || g === G.FLAGSTONE || g === G.FIELD;
  const vr = makeRng(seed + 5);
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const g = ground[idx(x, y)] as G;
      const v = g === G.FIELD ? ((y - 11) % 5 === 0 ? 2 : (x + y) & 1) : Math.floor(vr() * TILE_VARIANTS(g) * 10);
      tiles[idx(x, y)] = getTile(g, v);
      const ov: Img[] = [];
      if (g === G.SIDEWALK || g === G.DRIVEWAY || g === G.GRAVEL || g === G.DIRT) {
        for (let e = 0; e < 4; e++) {
          const nx = x + nb[e][0], ny = y + nb[e][1];
          if (!inMap(nx, ny)) continue;
          const ng = ground[idx(nx, ny)];
          if (g === G.SIDEWALK && ng === G.ROAD) ov.push(getCurb(e));
          else if (isGreen(ng)) ov.push(getFringe(e));
        }
      }
      if (g === G.ROAD) {
        const rx = isRoadLine(x), ry = isRoadLine(y);
        if (ry && !rx) {
          const cross = ROADS.some((c) => x === c - 1 || x === c + 2);
          if (cross) ov.push(getCrosswalk('x'));
          else if (ROADS.includes(y)) ov.push(getRoadLine(2));
        } else if (rx && !ry) {
          const cross = ROADS.some((c) => y === c - 1 || y === c + 2);
          if (cross) ov.push(getCrosswalk('y'));
          else if (ROADS.includes(x)) ov.push(getRoadLine(1));
        }
      }
      overlays[idx(x, y)] = ov;
    }

  // a couple of houses are "tricks" (monster homeowner)
  const order = houses.map((_, i) => i).sort(() => rnd() - 0.5);
  for (let i = 0; i < Math.max(1, Math.floor(houses.length / 6)); i++) houses[order[i]].trick = true;
  houses.forEach((h, i) => (h.owner = OWNERS[(i * 5 + Math.floor(rnd() * 12)) % OWNERS.length]));

  return { ground, tiles, overlays, coll, props, lights, shops, houses, gates, start: { x: 35, y: 36 } };
}

// ---- collision queries ----
export function cellAt(m: GameMap, x: number, y: number) {
  const cx = Math.floor(x * CR), cy = Math.floor(y * CR);
  if (cx < 0 || cy < 0 || cx >= CW || cy >= CH) return 2;
  return m.coll[cy * CW + cx];
}
export function blockedCircle(m: GameMap, x: number, y: number, r: number) {
  return cellAt(m, x - r, y - r) > 0 || cellAt(m, x + r, y - r) > 0 || cellAt(m, x - r, y + r) > 0 || cellAt(m, x + r, y + r) > 0 || cellAt(m, x, y) > 0;
}
export function lineOfSight(m: GameMap, x0: number, y0: number, x1: number, y1: number) {
  const d = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.ceil(d * CR);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (cellAt(m, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t) === 2) return false;
  }
  return true;
}
