import { TW, HW, HH, MAP_W, MAP_H, isoX, isoY, screenToWorld, clamp, RARITY, ELEM } from './config';
import { Game, Enemy, Turret } from './engine';
import { getTurretSheet, GYM_DECK_Z, TURRET_DIRS } from './art/props';
import { PropInst } from './map';
import { heroSheet, enemySheet, blitFrame, Sheet, ENEMY_TYPES, HEROES } from './art/characters';
import { AIM, HeroAim, heroAim, aimDir } from './art/hero-aim';
import { weaponIcon, pickupIcon, glow, lightSprite, explosionSheet, flameSheet, FX_FRAMES } from './art/fx';
import { tinted, makeCanvas, rawCanvas } from './art/draw';
import { G } from './art/tiles';
import { Img } from './assets';
import { weaponStats, COSTUME_BY_ID, HERO_INFO } from './data';
import { settings } from './settings';
import { AFFIX_INFO } from './enemy-affixes';

interface Item {
  key: number; x: number; y: number; big?: PropInst; prop?: PropInst;
  bx0: number; by0: number; bx1: number; by1: number;
  draw: () => void;
}

const Z = 40; // px per world height unit
// Held guns are half the inventory icon size. Anchor their (16,20) grip at
// the kid's waist, rather than centering the whole icon near their head.
const HELD_GUN_W = 32;
const HELD_GUN_H = 16;
const HELD_GUN_GRIP_X = 8;
const HELD_GUN_GRIP_Y = 10;
const KID_WAIST_HEIGHT = 30;
const AIM_GUN_SCALE = 1.25;

/** first opaque row of a sprite (fraction of its height), measured once: generated PNGs often carry empty headroom */
const opaqueTop = new WeakMap<object, number>();
function spriteTop(img: Img): number {
  let t = opaqueTop.get(img);
  if (t === undefined) {
    t = 0;
    const w = img.width, h = img.height;
    if (w > 0 && h > 0) {
      const c = rawCanvas(w, h), ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, w, h).data;
      let y = 0;
      outer: for (; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 40) break outer;
      t = y / h;
      c.width = c.height = 0;
    }
    opaqueTop.set(img, t);
  }
  return t;
}

export class Renderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  light: HTMLCanvasElement;
  lctx: CanvasRenderingContext2D;
  hero: Sheet;
  heroSil: HTMLCanvasElement;
  heroFlash: HTMLCanvasElement;
  en: Record<string, { s: Sheet; white: HTMLCanvasElement; green: HTMLCanvasElement; ice?: HTMLCanvasElement }> = {};
  /** burnt-out versions of wrecked cars and houses, made the first time each sprite is wrecked */
  private charred = new WeakMap<object, HTMLCanvasElement>();
  minimap: HTMLCanvasElement | null = null;
  vignette: HTMLCanvasElement | null = null;
  leaves: { x: number; y: number; vx: number; vy: number; r: number; c: string }[] = [];
  dpr = 1;
  t = 0;
  heroIdx: number;
  costume: string | null = null;
  /** which of the 8 aiming directions the kid currently faces (see art/hero-aim.ts) */
  private aimDir = 2;
  private lastX = 0; private lastY = 0; private moveX = 0; private moveY = 1;
  private scratch = makeCanvas(4, 4);

  constructor(canvas: HTMLCanvasElement, heroIdx: number) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    const l = makeCanvas(4, 4);
    this.light = l.c;
    this.lctx = l.ctx;
    this.heroIdx = heroIdx;
    this.hero = heroSheet(heroIdx);
    this.heroSil = tinted(this.hero.img, '#7fd8ff', 1);
    this.heroFlash = tinted(this.hero.img, '#ff3030', 1);
    heroAim(HEROES[heroIdx].id); // start loading the aiming sheet
    for (const t of ENEMY_TYPES) {
      const s = enemySheet(t);
      this.en[t] = { s, white: tinted(s.img, '#ffffff'), green: tinted(s.img, '#8dff5a') };
    }
    for (let i = 0; i < 26; i++) this.leaves.push({ x: Math.random(), y: Math.random(), vx: 0.02 + Math.random() * 0.03, vy: 0.03 + Math.random() * 0.04, r: Math.random() * 6, c: ['#c8561e', '#e08a2a', '#a8321c', '#d9b13b'][i % 4] });
  }

  private buildMinimap(g: Game) {
    const s = 3;
    const { c, ctx } = makeCanvas((MAP_W + MAP_H) * s, ((MAP_W + MAP_H) * s) / 2);
    const col: Record<number, string> = { [G.GRASS]: '#2c4626', [G.ROAD]: '#2a2a31', [G.SIDEWALK]: '#77787b', [G.DIRT]: '#3d2c22', [G.GRAVEL]: '#4a4744', [G.DARKGRASS]: '#1f3324', [G.DRIVEWAY]: '#6a6b6e', [G.FLAGSTONE]: '#3a5a32', [G.FIELD]: '#2f5a2a' };
    const P = (x: number, y: number): [number, number] => [(x - y) * s + MAP_H * s, ((x + y) * s) / 2];
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++) {
        ctx.fillStyle = col[g.map.ground[y * MAP_W + x]] || '#000';
        const [a, b] = P(x, y);
        ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(a + s, b + s / 2); ctx.lineTo(a, b + s); ctx.lineTo(a - s, b + s / 2); ctx.fill();
      }
    for (const p of g.map.props) {
      if ((!p.big && p.kind !== 'tree') || p.kind === 'shop') continue;
      ctx.fillStyle = p.kind === 'house' ? '#8a6fae' : p.kind === 'shop' ? '#ff9a2a' : p.kind === 'tree' ? '#14251a' : '#888';
      const pts = [P(p.x0, p.y0), P(p.x0 + p.fw, p.y0), P(p.x0 + p.fw, p.y0 + p.fh), P(p.x0, p.y0 + p.fh)];
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const q of pts) ctx.lineTo(q[0], q[1]); ctx.fill();
    }
    this.minimap = c;
  }

  private buildVignette(w: number, h: number) {
    const { c, ctx } = makeCanvas(w, h);
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,8,0.75)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    this.vignette = c;
  }

  render(g: Game, dt: number) {
    this.t += dt;
    const cv = this.canvas, ctx = this.ctx;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    const vw = cv.clientWidth, vh = cv.clientHeight;
    // also size our own layers on the first frame: a restarted run reuses a canvas that is already the right size,
    // and a 4x4 light layer stretched over the screen was the "no flashlight, dark blob" bug on the second game
    if (cv.width !== Math.floor(vw * dpr) || cv.height !== Math.floor(vh * dpr) || this.light.width !== Math.ceil(Math.floor(vw * dpr) / 2) || !this.vignette) {
      cv.width = Math.floor(vw * dpr);
      cv.height = Math.floor(vh * dpr);
      this.light.width = Math.ceil(cv.width / 2);
      this.light.height = Math.ceil(cv.height / 2);
      this.buildVignette(cv.width, cv.height);
    }
    if (!this.minimap) this.buildMinimap(g);
    if (g.p.costume !== this.costume) {
      this.costume = g.p.costume;
      this.hero = heroSheet(this.heroIdx, this.costume);
      this.heroSil = tinted(this.hero.img, '#7fd8ff', 1);
      this.heroFlash = tinted(this.hero.img, '#ff3030', 1);
    }
    const mobile = cv.parentElement?.classList.contains('touch-game');
    const zoom = mobile ? clamp(Math.min(vw / 1400, vh / 850), 0.42, 0.85) : clamp(Math.min(vw / 1500, vh / 860), 0.62, 1.35);
    const p = g.p;
    const touchViewport = cv.parentElement?.classList.contains('touch-game');
    const hudTop = cv.parentElement?.querySelector<HTMLElement>('.hm-topbar')?.offsetHeight || (vw < 640 ? (touchViewport ? 76 : 48) : 56);
    const controlsOffset = touchViewport ? (vw < 640 ? Math.min(60, vh * 0.08) : 20) : 0;
    const tx = isoX(p.x, p.y), ty = isoY(p.x, p.y) - 40 + controlsOffset / zoom;
    if (g.vw === 1) { g.camX = tx; g.camY = ty; }
    g.camX += (tx - g.camX) * Math.min(1, dt * 8);
    g.camY += (ty - g.camY) * Math.min(1, dt * 8);
    g.zoom = zoom; g.vw = vw; g.vh = vh;
    g.viewR = Math.max(vw / 2 / zoom / 90.5, vh / 2 / zoom / 45.25) + 1;
    const shk = g.shake * settings.shake;
    const shx = (Math.random() - 0.5) * shk, shy = (Math.random() - 0.5) * shk;
    const camX = g.camX + shx, camY = g.camY + shy;
    const toS = (wx: number, wy: number): [number, number] => [(wx - camX) * zoom + vw / 2, (wy - camY) * zoom + vh / 2];

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05060c';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.imageSmoothingEnabled = true;
    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * (vw / 2 - camX * zoom), dpr * (vh / 2 - camY * zoom));

    // view bounds in world px
    const vx0 = camX - vw / 2 / zoom - 140, vx1 = camX + vw / 2 / zoom + 140;
    const vy0 = camY - vh / 2 / zoom - 300, vy1 = camY + vh / 2 / zoom + 140;
    const inView = (x0: number, y0: number, x1: number, y1: number) => x1 > vx0 && x0 < vx1 && y1 > vy0 && y0 < vy1;

    // ===== ground =====
    const corners = [screenToWorld(vx0, vy0), screenToWorld(vx1, vy0), screenToWorld(vx0, vy1), screenToWorld(vx1, vy1)];
    const minX = clamp(Math.floor(Math.min(...corners.map((c) => c.x))), 0, MAP_W - 1), maxX = clamp(Math.ceil(Math.max(...corners.map((c) => c.x))), 0, MAP_W - 1);
    const minY = clamp(Math.floor(Math.min(...corners.map((c) => c.y))), 0, MAP_H - 1), maxY = clamp(Math.ceil(Math.max(...corners.map((c) => c.y))), 0, MAP_H - 1);
    const m = g.map;
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++) {
        const sx = isoX(x, y), sy = isoY(x, y);
        if (sx + HW < vx0 || sx - HW > vx1 || sy + TW < vy0 || sy > vy1) continue;
        const i = y * MAP_W + x;
        ctx.drawImage(m.tiles[i], sx - HW, sy);
        const ov = m.overlays[i];
        for (let k = 0; k < ov.length; k++) ctx.drawImage(ov[k], sx - HW, sy);
      }

    // decals
    for (const d of g.decals) {
      if (d.gore && settings.gore === 'off') continue;
      const sx = isoX(d.x, d.y), sy = isoY(d.x, d.y);
      if (!inView(sx - d.r * HW * 2, sy - d.r * HH * 2, sx + d.r * HW * 2, sy + d.r * HH * 2)) continue;
      ctx.save();
      ctx.globalAlpha = Math.min(1, d.life / 5);
      ctx.translate(sx, sy);
      ctx.scale(1, 0.5);
      ctx.rotate(d.rot);
      ctx.fillStyle = d.gore ? settings.gore === 'red' ? 'rgba(97,17,28,0.7)' : 'rgba(37,76,25,0.7)' : d.color;
      ctx.beginPath();
      const R = d.r * HW * 1.4;
      const vertices = d.gore ? 16 : 8;
      for (let k = 0; k < vertices; k++) {
        const a = (k / vertices) * Math.PI * 2, rr = R * (0.5 + (Math.sin(k * 19.3 + d.rot * 7) + 1) * 0.2);
        if (k === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.fill();
      if (d.gore) {
        // Organic satellite droplets, without textures, allocations or bright glows.
        for (let k = 0; k < 3; k++) {
          const angle = k * 2.1 + d.rot, radius = R * (0.08 + k * 0.035);
          ctx.beginPath(); ctx.ellipse(Math.cos(angle) * R * 1.1, Math.sin(angle) * R, radius, radius * 0.7, angle, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.restore();
    }

    // shadows
    ctx.fillStyle = 'rgba(4,4,18,0.38)';
    const visProps: PropInst[] = [];
    for (const pr of m.props) {
      if (pr.removed) continue;
      const ax = isoX(pr.x0 + pr.fw / 2, pr.y0 + pr.fh / 2), ay = isoY(pr.x0 + pr.fw / 2, pr.y0 + pr.fh / 2);
      if (!inView(ax - pr.sp.ax, ay - pr.sp.ay, ax - pr.sp.ax + pr.sp.w, ay - pr.sp.ay + pr.sp.h)) continue;
      visProps.push(pr);
      if (pr.big) {
        const s = 1.1 * pr.shadow, x0 = pr.x0, y0 = pr.y0, x1 = x0 + pr.fw, y1 = y0 + pr.fh;
        const pts: [number, number][] = [[x0, y0], [x1, y0], [x1 + s, y0 + s * 0.15], [x1 + s, y1 + s * 0.15], [x0 + s, y1 + s * 0.15], [x0, y1]];
        // the shadow fades with its building, so an x-rayed house doesn't leave a dark slab behind
        const fa = pr.fade ?? 1;
        if (fa < 0.999) ctx.globalAlpha = fa;
        ctx.beginPath();
        pts.forEach(([a, b], k) => (k ? ctx.lineTo(isoX(a, b), isoY(a, b)) : ctx.moveTo(isoX(a, b), isoY(a, b))));
        ctx.fill();
        if (fa < 0.999) ctx.globalAlpha = 1;
      } else if (pr.shadow > 0) {
        ctx.beginPath();
        ctx.ellipse(ax + 6, ay + 2, pr.shadow * HW, pr.shadow * HH, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // ground zones
    for (const z of g.zones) {
      const sx = isoX(z.x, z.y), sy = isoY(z.x, z.y);
      if (z.kind === 'fire') {
        ctx.save();
        ctx.globalAlpha = Math.min(1, (z.life - z.t) * 2) * 0.55;
        ctx.drawImage(glow('#ff5a1a', 128), sx - z.r * HW * 1.5, sy - z.r * HH * 1.5, z.r * TW * 1.5, z.r * TW * 0.75);
        ctx.restore();
      } else if (z.kind === 'warn') {
        ctx.strokeStyle = `rgba(255,60,60,${0.8 - z.t})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(sx, sy, z.r * HW * 1.4, z.r * HH * 1.4, 0, 0, Math.PI * 2); ctx.stroke();
      } else if (z.kind === 'vortex') {
        const k = Math.min(1, z.t * 4) * (z.done ? 0 : 1);
        const gr = ctx.createRadialGradient(sx, sy, 0, sx, sy, z.r * HW * 1.4);
        gr.addColorStop(0, `rgba(4,0,10,${0.95 * k})`); gr.addColorStop(0.3, `rgba(20,4,40,${0.7 * k})`); gr.addColorStop(1, 'rgba(20,4,40,0)');
        ctx.save(); ctx.translate(sx, sy); ctx.scale(1, 0.5); ctx.translate(-sx, -sy);
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(sx, sy, z.r * HW * 1.4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.fillStyle = 'rgba(4,4,18,0.38)';
      } else if (z.kind === 'tornado') {
        ctx.fillStyle = 'rgba(240,240,230,0.12)';
        ctx.beginPath(); ctx.ellipse(sx, sy, z.r * HW * 1.4, z.r * HH * 1.4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(4,4,18,0.38)';
      }
    }
    // entity shadows
    ctx.fillStyle = 'rgba(4,4,18,0.45)';
    const sh = (x: number, y: number, r: number) => {
      ctx.beginPath(); ctx.ellipse(isoX(x, y), isoY(x, y), r * HW * 1.3, r * HH * 1.3, 0, 0, Math.PI * 2); ctx.fill();
    };
    if (g.mounted < 0) sh(p.x, p.y, p.r);
    for (const e of g.enemies) if (!e.dead && inView(isoX(e.x, e.y) - 60, isoY(e.x, e.y) - 60, isoX(e.x, e.y) + 60, isoY(e.x, e.y) + 20)) sh(e.x, e.y, e.def.fly ? e.r * 0.6 : e.r);

    // ===== sorted pass =====
    const items: Item[] = [];
    const bigs: Item[] = [];
    let playerItem: Item | null = null;
    for (const pr of visProps) {
      const cx = pr.x0 + pr.fw / 2, cy = pr.y0 + pr.fh / 2;
      const ax = isoX(cx, cy), ay = isoY(cx, cy);
      const sp = pr.sp;
      const tur = pr.kind === 'junglegym' ? g.turrets.find((t) => t.gym === pr) : undefined;
      const it: Item = {
        key: cx + cy, x: cx, y: cy, prop: pr, bx0: ax - sp.ax, by0: ay - sp.ay, bx1: ax - sp.ax + sp.w, by1: ay - sp.ay + sp.h,
        draw: () => {
          const a = pr.fade ?? 1;
          if (a < 0.999) ctx.globalAlpha = a;
          if (pr.wreck) this.drawWreck(pr, ax, ay);
          else ctx.drawImage(sp.img, ax - sp.ax, ay - sp.ay, sp.w, sp.h);
          if (a < 0.999) ctx.globalAlpha = 1;
          if (pr.burnT || pr.boomT !== undefined) this.drawBurning(pr, ax, ay);
          if (tur) this.drawTurret(g, tur);
        },
      };
      if (pr.big) { it.big = pr; bigs.push(it); } else items.push(it);
    }
    // player
    {
      const sx = isoX(p.x, p.y), sy = isoY(p.x, p.y);
      playerItem = { key: p.x + p.y, x: p.x, y: p.y, bx0: sx - 56, by0: sy - 96, bx1: sx + 56, by1: sy + 22, draw: () => this.drawPlayer(g, sx, sy) };
      // up on a jungle gym the kid is drawn with the cannon, on the deck
      if (g.mounted < 0) items.push(playerItem);
    }
    if (g.friends.length) for (const friend of g.friends) {
      const pos = g.state === 'intro' ? g.introPosition(friend.hero) : friend;
      const sx = isoX(pos.x, pos.y), sy = isoY(pos.x, pos.y);
      if (!inView(sx - 32, sy - 110, sx + 32, sy + 20)) continue;
      const sheet = heroSheet(friend.hero);
      const down = g.state !== 'intro' && (friend.status !== 'rescued' || friend.hp <= 0);
      items.push({ key: pos.x + pos.y, x: pos.x, y: pos.y, bx0: sx - 56, by0: sy - 100, bx1: sx + 56, by1: sy + 22,
        draw: () => {
          ctx.save(); ctx.translate(sx, sy);
          ctx.fillStyle = friend.status === 'rescued' ? 'rgba(65,210,180,0.25)' : 'rgba(155,75,190,0.25)';
          ctx.beginPath(); ctx.ellipse(0, 0, 22, 10, 0, 0, Math.PI * 2); ctx.fill();
          ctx.save();
          if (down) { ctx.translate(-12, -10); ctx.rotate(-Math.PI / 2); ctx.globalAlpha = 0.8; }
          const aiming = !down && g.state !== 'intro' ? heroAim(HEROES[friend.hero].id) : null;
          if (aiming) {
            // on their feet: arms out toward whatever they are shooting at (or walking toward), gun in hand
            const fx = friend.faceX ?? (friend.flip ? -1 : 1), fy = friend.faceY ?? (friend.back ? -1 : 1);
            const dir = aimDir(Math.atan2(isoY(fx, fy), isoX(fx, fy)));
            this.drawAimKid(aiming, 0, 0, dir, !!friend.moving, friend.anim, friend.weapon.def.id, 0, false);
          } else {
            if (friend.flip) ctx.scale(-1, 1);
            const drawFriendGun = () => {
              if (!down && g.state !== 'intro') ctx.drawImage(weaponIcon(friend.weapon.def.id), -HELD_GUN_GRIP_X, -KID_WAIST_HEIGHT - HELD_GUN_GRIP_Y, HELD_GUN_W, HELD_GUN_H);
            };
            if (friend.back) drawFriendGun();
            blitFrame(ctx, sheet, sheet.img, down || g.state === 'intro' ? 0 : friend.back ? 3 : 1, Math.floor(friend.anim), 0, 0);
            if (!friend.back) drawFriendGun();
          }
          ctx.restore();
          ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#f2e6c9';
          ctx.strokeStyle = '#100c12'; ctx.lineWidth = 3;
          const fallen = friend.status === 'rescued' && friend.hp <= 0 && g.state !== 'intro';
          const label = `${HERO_INFO[friend.hero].name}${down && !fallen ? ' · needs help' : ''}`;
          ctx.strokeText(label, 0, fallen ? -40 : -95); ctx.fillText(label, 0, fallen ? -40 : -95);
          if (fallen) {
            // a sign above a fallen friend: what to press and how long is left
            const left = Math.max(0, Math.ceil((g.stats.mateUp || g.friendDownTime) - (friend.downT ?? 0))), bob = Math.sin(this.t * 5) * 3;
            const text = `${touchViewport ? 'TAP INTERACT' : 'E'} · REVIVE · ${left}s`;
            ctx.font = '700 16px "Barlow Condensed", system-ui, sans-serif';
            const w = ctx.measureText(text).width + 20;
            ctx.fillStyle = left <= 10 ? '#d33838' : '#fb8016'; ctx.strokeStyle = '#06090b'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.roundRect(-w / 2, -82 + bob, w, 26, 4); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-6, -56 + bob); ctx.lineTo(6, -56 + bob); ctx.lineTo(0, -48 + bob); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#1d1d1b'; ctx.textBaseline = 'middle'; ctx.fillText(text, 0, -67 + bob); ctx.textBaseline = 'alphabetic';
          }
          if (friend.status === 'rescued' && g.state !== 'intro' && !fallen) { ctx.fillStyle = '#211a25'; ctx.fillRect(-20, -87, 40, 4); ctx.fillStyle = '#66d2b7'; ctx.fillRect(-20, -87, 40 * friend.hp / friend.maxHp, 4); }
          ctx.restore();
        } });
    }
    for (const e of g.enemies) {
      if (e.dead) continue;
      const sx = isoX(e.x, e.y), sy = isoY(e.x, e.y);
      const es = this.en[e.type].s;
      const sc = e.elite && !e.def.elite ? 1.25 : 1;
      if (!inView(sx - es.ax * sc, sy - es.ay * sc, sx + es.ax * sc, sy + 10)) continue;
      items.push({ key: e.x + e.y, x: e.x, y: e.y, bx0: sx - es.ax * sc, by0: sy - es.ay * sc, bx1: sx + es.ax * sc, by1: sy, draw: () => this.drawEnemy(e, sx, sy, sc) });
    }
    for (const k of g.pickups) {
      const sx = isoX(k.x, k.y), sy = isoY(k.x, k.y);
      if (!inView(sx - 30, sy - 150, sx + 30, sy + 10)) continue;
      items.push({
        key: k.x + k.y, x: k.x, y: k.y, bx0: sx - 16, by0: sy - 40, bx1: sx + 16, by1: sy,
        draw: () => {
          const bob = Math.sin(this.t * 4 + k.x * 3) * 3;
          const z = k.z * Z;
          if (k.kind === 'weapon' && k.weapon) {
            const r = RARITY[k.weapon.rarity];
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const gr = ctx.createLinearGradient(0, sy - 150, 0, sy);
            gr.addColorStop(0, 'rgba(0,0,0,0)');
            gr.addColorStop(1, r.glow);
            ctx.globalAlpha = 0.35 + Math.sin(this.t * 3) * 0.1;
            ctx.fillStyle = gr;
            ctx.fillRect(sx - 7, sy - 150, 14, 150);
            ctx.drawImage(glow(r.glow, 64), sx - 30, sy - 15, 60, 30);
            ctx.restore();
            ctx.save();
            ctx.translate(sx, sy - 22 - z + bob);
            ctx.rotate(Math.sin(this.t * 1.5) * 0.15);
            ctx.drawImage(weaponIcon(k.weapon.def.id), -32, -16);
            ctx.restore();
          } else if (k.kind === 'costume' && k.costume) {
            const cd = COSTUME_BY_ID[k.costume];
            const rarity = RARITY[cd.rarity];
            const cs = heroSheet(this.heroIdx, k.costume);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.45 + Math.sin(this.t * 3) * 0.1;
            ctx.drawImage(glow(rarity.color, 64), sx - 34, sy - 18, 68, 36);
            const gr = ctx.createLinearGradient(0, sy - 130, 0, sy);
            gr.addColorStop(0, 'rgba(0,0,0,0)');
            gr.addColorStop(1, rarity.color);
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = gr;
            ctx.fillRect(sx - 9, sy - 130, 18, 130);
            ctx.restore();
            // floating, slowly spinning costume "mannequin"
            const spin = Math.cos(this.t * 1.6);
            const row = spin < 0 ? 2 : 0;
            ctx.save();
            ctx.translate(sx, sy - 10 - z + bob);
            ctx.scale(Math.max(0.15, Math.abs(spin)) * 0.75, 0.75);
            ctx.globalAlpha = 0.92;
            blitFrame(ctx, cs, cs.img, row, 0, 0, 0);
            ctx.restore();
            ctx.font = '900 11px system-ui';
            ctx.textAlign = 'center';
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(0,0,0,0.8)';
            ctx.strokeText(`${cd.icon} ${cd.name}`, sx, sy + 14);
            ctx.fillStyle = cd.color;
            ctx.fillText(`${cd.icon} ${cd.name}`, sx, sy + 14);
          } else if (k.kind === 'chest') {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.5;
            ctx.drawImage(glow('#ffcf3a', 64), sx - 34, sy - 22, 68, 40);
            ctx.restore();
            ctx.drawImage(pickupIcon('chest'), sx - 24, sy - 46 - z, 48, 48);
          } else {
            ctx.drawImage(pickupIcon(k.kind), sx - 12, sy - 22 - z + (k.mag ? 0 : bob * 0.5), 24, 24);
          }
        },
      });
    }
    for (const b of g.bullets) {
      const sx = isoX(b.x, b.y), sy = isoY(b.x, b.y);
      items.push({ key: b.x + b.y, x: b.x, y: b.y, bx0: sx - 6, by0: sy - 30, bx1: sx + 6, by1: sy, draw: () => this.drawBullet(b, sx, sy) });
    }
    if (g.stats.familiar > 0) {
      const f = g.familiar, sx = isoX(f.x, f.y), sy = isoY(f.x, f.y);
      items.push({ key: f.x + f.y, x: f.x, y: f.y, bx0: sx - 20, by0: sy - 80, bx1: sx + 20, by1: sy, draw: () => {
        const gs = this.en.ghost.s;
        ctx.save(); ctx.globalAlpha = 0.75; ctx.translate(sx, sy - 30 + Math.sin(this.t * 3) * 5); ctx.scale(0.6, 0.6);
        blitFrame(ctx, gs, gs.img, 0, Math.floor(this.t * 6), 0, 0);
        ctx.restore();
      } });
    }
    items.sort((a, b) => a.key - b.key);
    bigs.sort((a, b) => a.big!.x0 + a.big!.fw + a.big!.y0 + a.big!.fh - (b.big!.x0 + b.big!.fw + b.big!.y0 + b.big!.fh));
    const overlap = (a: Item, b: Item) => a.bx1 > b.bx0 && a.bx0 < b.bx1 && a.by1 > b.by0 && a.by0 < b.by1;
    const behind = (a: Item, B: PropInst) => {
      if (a.big) {
        const A = a.big;
        if (A.x0 + A.fw <= B.x0 || A.y0 + A.fh <= B.y0) return true;
        return false;
      }
      return a.x < B.x0 + B.fw && a.y < B.y0 + B.fh;
    };
    let order = items;
    for (const B of bigs) {
      const bp = B.big!;
      let pos = 0;
      for (let i = 0; i < order.length; i++) if (overlap(order[i], B) && behind(order[i], bp)) pos = i + 1;
      const before: Item[] = [], moved: Item[] = [];
      for (let i = 0; i < pos; i++) {
        const it = order[i];
        if (overlap(it, B) && !behind(it, bp)) moved.push(it);
        else before.push(it);
      }
      order = before.concat([B], moved, order.slice(pos));
    }
    // fading of occluders in front of the player (the "mask" effect)
    // A building only fades when the kid's body is actually inside its silhouette (footprint + walls as a hexagon),
    // not merely inside its sprite's bounding box: standing beside a house must not dim it.
    const psx = isoX(p.x, p.y), psy = isoY(p.x, p.y);
    const covers = (it: Item, pr: PropInst) => {
      const x0 = pr.x0, y0 = pr.y0, x1 = x0 + pr.fw, y1 = y0 + pr.fh;
      const lift = isoY(x0, y0) - (it.by0 + spriteTop(pr.sp.img) * pr.sp.h); // wall height: back corner up to the roof
      const hx = [isoX(x0, y1), isoX(x1, y1), isoX(x1, y0), isoX(x1, y0), isoX(x0, y0), isoX(x0, y1)];
      const hy = [isoY(x0, y1), isoY(x1, y1), isoY(x1, y0), isoY(x1, y0) - lift, isoY(x0, y0) - lift, isoY(x0, y1) - lift];
      // clearly inside: at least 10px from every edge, so brushing past a corner doesn't flicker the house
      const inside = (px: number, py: number) => {
        for (let k = 0; k < 6; k++) {
          const j = (k + 1) % 6, ex = hx[j] - hx[k], ey = hy[j] - hy[k];
          if (ex * (py - hy[k]) - ey * (px - hx[k]) > -10 * Math.hypot(ex, ey)) return false;
        }
        return true;
      };
      return inside(psx, psy - 40) || inside(psx, psy - 70);
    };
    let occluded = false;
    const fadeStep = Math.min(1, dt * 10);
    const fadeIt = (it: Item) => {
      const pr = it.prop;
      if (!pr) return;
      const tall = pr.big || pr.kind === 'tree' || pr.kind === 'lamp' || pr.kind === 'vending';
      if (!tall) return;
      let hide = false;
      if (g.mounted < 0 && overlap(it, playerItem)) {
        if (pr.big) hide = behind(playerItem, pr) && covers(it, pr);
        else hide = playerItem.key < it.key - 0.2 && playerItem.by0 < it.by1 - 40;
      }
      if (hide) occluded = true;
      const target = hide ? (pr.big ? 0.32 : 0.55) : 1;
      pr.fade = (pr.fade ?? 1) + (target - (pr.fade ?? 1)) * fadeStep;
    };
    for (const it of bigs) fadeIt(it);
    for (const it of items) fadeIt(it);
    for (const it of order) it.draw();

    // orbit blades & lobs
    if (g.stats.orbit > 0) {
      for (let i = 0; i < g.stats.orbit; i++) {
        const a = g.orbitAng + (i / g.stats.orbit) * Math.PI * 2;
        const ox = p.x + Math.cos(a) * 1.5, oy = p.y + Math.sin(a) * 1.5;
        const sx = isoX(ox, oy), sy = isoY(ox, oy) - 26;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(this.t * 10);
        this.candyCorn(ctx, 9);
        ctx.restore();
      }
    }
    for (const l of g.lobs) {
      const t = l.t / l.dur;
      const x = l.x0 + (l.x1 - l.x0) * t, y = l.y0 + (l.y1 - l.y0) * t;
      const h = Math.sin(t * Math.PI) * 120 + 30;
      const sx = isoX(x, y), sy = isoY(x, y) - h;
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(t * 10);
      for (let k = -2; k <= 2; k++) { ctx.fillStyle = k % 2 ? '#d45f17' : '#ee7a22'; ctx.beginPath(); ctx.ellipse(k * 3, 0, 5, 9, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#ffe36a'; ctx.fillRect(-4, -2, 3, 3); ctx.fillRect(2, -2, 3, 3);
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,120,40,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(isoX(l.x1, l.y1), isoY(l.x1, l.y1), 2.2 * HW * 1.3, 2.2 * HH * 1.3, 0, 0, Math.PI * 2); ctx.stroke();
    }
    // tornado body
    for (const z of g.zones) {
      if (z.kind !== 'tornado') continue;
      const sx = isoX(z.x, z.y), sy = isoY(z.x, z.y);
      ctx.save();
      ctx.globalAlpha = Math.min(1, (z.life - z.t) * 2) * 0.8;
      for (let k = 0; k < 7; k++) {
        const w = (z.r * HW * 0.5) * (0.4 + k * 0.15), y = sy - k * 22;
        ctx.strokeStyle = k % 2 ? '#f4f4ee' : '#d8d8d0';
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.ellipse(sx + Math.sin(this.t * 8 + k) * 6, y, w, w * 0.3, 0, this.t * 6 + k, this.t * 6 + k + 4.5); ctx.stroke();
      }
      ctx.restore();
    }

    // fog puffs (world space, drift)
    ctx.save();
    ctx.globalAlpha = 0.07;
    for (let i = 0; i < 12; i++) {
      const fx = ((i * 977 + this.t * 18) % 2400) - 1200 + camX, fy = ((i * 613) % 1400) - 700 + camY + Math.sin(this.t * 0.3 + i) * 30;
      ctx.drawImage(glow('#b8c8ff', 128), fx - 300, fy - 100, 600, 200);
    }
    ctx.restore();

    // ===== lighting =====
    this.drawLighting(g, toS, zoom, vw, vh, camX, camY);

    // ===== additive & unlit pass (world space) =====
    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * (vw / 2 - camX * zoom), dpr * (vh / 2 - camY * zoom));
    ctx.globalCompositeOperation = 'lighter';
    for (const L of m.lights) {
      const sx = isoX(L.x, L.y), sy = isoY(L.x, L.y);
      if (!inView(sx - 300, sy - 200, sx + 300, sy + 200)) continue;
      ctx.globalAlpha = 0.16 * L.i;
      const rx = L.r * HW * 1.4, ry = L.r * HH * 1.4;
      ctx.drawImage(glow(L.color, 128), sx - rx, sy - ry, rx * 2, ry * 2);
    }
    // loot beams: guns on the ground shine in their rarity colour through the night (taller + wider with rarity)
    for (const k of g.pickups) {
      if (k.kind !== 'weapon' || !k.weapon) continue;
      const sx = isoX(k.x, k.y), sy = isoY(k.x, k.y), r = k.weapon.rarity, col = RARITY[r].glow;
      const H = 70 + r * 38, W2 = 4 + r * 2.5;
      if (!inView(sx - 40, sy - H, sx + 40, sy + 20)) continue;
      const pulse = 0.75 + Math.sin(this.t * 3 + k.x) * 0.25;
      ctx.globalAlpha = (r ? 0.55 : 0.28) * pulse;
      const gr = ctx.createLinearGradient(0, sy - H, 0, sy);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.7, col); gr.addColorStop(1, '#ffffff');
      ctx.fillStyle = gr;
      ctx.fillRect(sx - W2, sy - H, W2 * 2, H);
      ctx.globalAlpha = (r ? 0.75 : 0.4) * pulse;
      ctx.drawImage(glow(col, 64), sx - 34 - r * 4, sy - 16 - r * 2, 68 + r * 8, 32 + r * 4);
      if (r >= 3) for (let i = 0; i < 2 + r; i++) {
        const a = this.t * (1.2 + i * 0.3) + i * 2.1, h = ((this.t * 40 + i * 37) % H);
        ctx.globalAlpha = 0.9 * (1 - h / H);
        ctx.fillStyle = col;
        ctx.fillRect(sx + Math.cos(a) * (W2 + 6) - 1.5, sy - h, 3, 3);
      }
    }
    ctx.globalAlpha = 1;
    for (const b of g.bullets) {
      const sx = isoX(b.x, b.y), sy = isoY(b.x, b.y) - 24;
      const s = b.kind === 'void' ? 70 : b.kind === 'rocket' || b.kind === 'fire' || b.kind === 'balloon' || b.kind === 'shell' || b.kind === 'flame' || b.kind === 'disc' || b.kind === 'glaive' ? 46 : 26;
      ctx.globalAlpha = 0.7;
      ctx.drawImage(glow(b.color, 64), sx - s / 2, sy - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
    for (const e of g.enemies) {
      if (e.burnT > 0) {
        const sx = isoX(e.x, e.y), sy = isoY(e.x, e.y) - 30;
        ctx.globalAlpha = 0.5 + Math.sin(this.t * 20 + e.id) * 0.2;
        ctx.drawImage(glow('#ff6a1a', 64), sx - 30, sy - 40, 60, 70);
      }
      if ((e.frozenT ?? 0) > 0 || (e.chill ?? 0) > 0.15) {
        const sx = isoX(e.x, e.y), sy = isoY(e.x, e.y) - 30;
        ctx.globalAlpha = e.frozenT ? 0.7 : (e.chill ?? 0) * 0.5;
        ctx.drawImage(glow('#9fe8ff', 64), sx - 34, sy - 44, 68, 78);
      }
      if (e.elite) {
        const sx = isoX(e.x, e.y), sy = isoY(e.x, e.y);
        ctx.globalAlpha = 0.4;
        ctx.drawImage(glow(e.def.boss ? '#ff8a1e' : '#ff2a2a', 64), sx - 60 * e.r * 2, sy - 30 * e.r * 2, 120 * e.r * 2, 60 * e.r * 2);
      }
      if (e.affix) {
        ctx.globalAlpha = 0.65; ctx.strokeStyle = AFFIX_INFO[e.affix].color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(isoX(e.x, e.y), isoY(e.x, e.y), e.r * 65 + 10, e.r * 30 + 5, 0, 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    // enemy bullets (bright & readable)
    for (const b of g.ebullets) {
      const sx = isoX(b.x, b.y), sy = isoY(b.x, b.y) - 22;
      ctx.drawImage(glow(b.color, 64), sx - 22, sy - 22, 44, 44);
    }
    // particles
    for (const q of g.particles) {
      const sx = isoX(q.x, q.y), sy = isoY(q.x, q.y) - q.z * Z;
      const a = q.life / q.max;
      if (q.kind === 'glow') {
        ctx.globalAlpha = a;
        ctx.drawImage(glow(q.color, 32), sx - q.size, sy - q.size, q.size * 2, q.size * 2);
      }
    }
    // beams
    for (const b of g.beams) {
      const a = b.life / b.max;
      const x0 = isoX(b.x0, b.y0), y0 = isoY(b.x0, b.y0) - 26, x1 = isoX(b.x1, b.y1), y1 = isoY(b.x1, b.y1) - 26;
      ctx.globalAlpha = a;
      ctx.strokeStyle = b.color;
      ctx.lineCap = 'round';
      if (b.zig) {
        for (let pass = 0; pass < 2; pass++) {
          ctx.lineWidth = pass ? 1.5 : b.w * 2.5;
          ctx.strokeStyle = pass ? '#ffffff' : b.color;
          ctx.beginPath(); ctx.moveTo(x0, y0);
          const n = 6;
          for (let k = 1; k < n; k++) {
            const t = k / n;
            ctx.lineTo(x0 + (x1 - x0) * t + (Math.random() - 0.5) * 18, y0 + (y1 - y0) * t + (Math.random() - 0.5) * 18);
          }
          ctx.lineTo(x1, y1); ctx.stroke();
        }
      } else {
        ctx.lineWidth = b.w * 3 * a;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = b.w * 0.8;
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    // booms
    for (const z of g.zones) {
      const sx = isoX(z.x, z.y), sy = isoY(z.x, z.y);
      const t = z.t / z.life;
      if (z.kind === 'boom' && z.sprite) {
        // smoke has to cover, not add: this one frame is drawn normally
        const boom = explosionSheet(), f = Math.min(FX_FRAMES - 1, Math.floor(t * FX_FRAMES)), size = z.r * TW * 1.2;
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.drawImage(boom.img, f * boom.cell, 0, boom.cell, boom.cell, sx - size / 2, sy - 18 - size / 2, size, size);
        ctx.globalCompositeOperation = 'lighter';
        if (t < 0.35) { ctx.globalAlpha = (0.35 - t) * 2.4; ctx.drawImage(glow('#ffb347', 128), sx - size * 0.6, sy - 18 - size * 0.6, size * 1.2, size * 1.2); }
      } else if (z.kind === 'fire') {
        // burning ground: a flame standing on it
        const fire = flameSheet(), f = Math.floor(this.t * 12 + z.x * 5 + z.y * 3) % FX_FRAMES, size = z.r * 96;
        ctx.globalAlpha = Math.min(1, (z.life - z.t) * 2, z.t * 5 + 0.2) * 0.85;
        ctx.drawImage(fire.img, f * fire.cell, 0, fire.cell, fire.cell, sx - size / 2, sy - size * 0.84, size, size);
      } else if (z.kind === 'boom') {
        ctx.globalAlpha = 1 - t;
        const R = z.r * (0.4 + t * 0.8);
        ctx.drawImage(glow(z.color || '#ffb347', 128), sx - R * HW * 1.8, sy - R * HH * 1.8 - 20, R * TW * 1.8, R * TW * 1.1);
        ctx.strokeStyle = z.color || '#ffb347';
        ctx.lineWidth = 4 * (1 - t);
        ctx.beginPath(); ctx.ellipse(sx, sy, R * HW * 1.45, R * HH * 1.45, 0, 0, Math.PI * 2); ctx.stroke();
      } else if (z.kind === 'flash' && z.ang !== undefined) {
        ctx.globalAlpha = (1 - t) * 0.8;
        const a = z.ang, half = z.arc ?? 0.65;
        const rim = (k: number, r: number): [number, number] => { const aa = a + (k / 8) * half; return [isoX(z.x + Math.cos(aa) * r, z.y + Math.sin(aa) * r), isoY(z.x + Math.cos(aa) * r, z.y + Math.sin(aa) * r) - 30]; };
        ctx.fillStyle = z.color ?? '#ffffff';
        ctx.beginPath();
        ctx.moveTo(sx, sy - 30);
        for (let k = -8; k <= 8; k++) ctx.lineTo(...rim(k, z.r));
        ctx.closePath();
        if (z.color) ctx.globalAlpha = (1 - t) * 0.35;
        ctx.fill();
        if (z.color) {
          // a swung blade: the bright edge sweeps across the arc
          const sweep = Math.round(-8 + Math.min(1, t * 1.6) * 16);
          ctx.globalAlpha = 1 - t; ctx.lineCap = 'round';
          for (const [w, col] of [[9, z.color], [3, '#ffffff']] as const) {
            ctx.strokeStyle = col; ctx.lineWidth = w;
            ctx.beginPath();
            for (let k = Math.max(-8, sweep - 7); k <= sweep; k++) ctx.lineTo(...rim(k, z.r * 0.96));
            ctx.stroke();
          }
        }
      } else if (z.kind === 'trail') {
        const x1 = isoX(z.x1 ?? z.x, z.y1 ?? z.y), y1 = isoY(z.x1 ?? z.x, z.y1 ?? z.y) - 12;
        const fade = Math.min(1, (z.life - z.t) * 2), flick = 0.75 + Math.sin(this.t * 22 + z.x * 7) * 0.25;
        ctx.lineCap = 'round';
        ctx.globalAlpha = fade * 0.55 * flick; ctx.strokeStyle = z.color ?? '#21d0ff'; ctx.lineWidth = 10;
        ctx.beginPath(); ctx.moveTo(sx, sy - 12); ctx.lineTo(x1, y1); ctx.stroke();
        ctx.globalAlpha = fade * 0.9; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
        ctx.stroke();
      } else if (z.kind === 'vortex' && !z.done) {
        const col = z.color ?? '#b44dff', pull = 1 - t * 0.35;
        ctx.lineCap = 'round';
        for (let arm = 0; arm < 5; arm++) {
          ctx.globalAlpha = 0.75; ctx.strokeStyle = arm % 2 ? '#ffffff' : col; ctx.lineWidth = arm % 2 ? 1.5 : 4;
          ctx.beginPath();
          for (let k = 0; k <= 14; k++) {
            const u = k / 14, rr = z.r * pull * (1 - u * 0.92), aa = arm * 1.2566 + this.t * 5 + u * 4.2;
            const X = isoX(z.x + Math.cos(aa) * rr, z.y + Math.sin(aa) * rr), Y = isoY(z.x + Math.cos(aa) * rr, z.y + Math.sin(aa) * rr) - 22 * u;
            if (k) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
          }
          ctx.stroke();
        }
        ctx.globalAlpha = 0.5 + t * 0.5;
        const R = (26 + t * 26) * (1 + Math.sin(this.t * 30) * 0.08 * t);
        ctx.drawImage(glow(col, 128), sx - R * 1.6, sy - 22 - R * 1.6, R * 3.2, R * 3.2);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    for (const z of g.zones) if (z.kind === 'vortex' && !z.done) {
      const t = z.t / z.life, R = 10 + t * 12;
      ctx.fillStyle = '#05010a'; ctx.beginPath(); ctx.arc(isoX(z.x, z.y), isoY(z.x, z.y) - 22, R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = z.color ?? '#b44dff'; ctx.lineWidth = 2.5; ctx.stroke();
    }
    // enemy bullet cores
    for (const b of g.ebullets) {
      const sx = isoX(b.x, b.y), sy = isoY(b.x, b.y) - 22;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(sx, sy, b.r * 24, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = b.color; ctx.lineWidth = 3; ctx.stroke();
    }
    // square particles (lit-ish)
    for (const q of g.particles) {
      if (q.kind !== 'sq' && q.kind !== 'gore') continue;
      if (q.kind === 'gore' && settings.gore === 'off') continue;
      const sx = isoX(q.x, q.y), sy = isoY(q.x, q.y) - q.z * Z;
      ctx.globalAlpha = Math.min(1, (q.life / q.max) * 2);
      ctx.fillStyle = q.kind === 'gore' ? settings.gore === 'red' ? '#b12b3a' : '#6db543' : q.color;
      if (q.kind === 'gore') {
        ctx.beginPath(); ctx.ellipse(sx, sy, q.size * 0.65, q.size * 0.4, q.vx, 0, Math.PI * 2); ctx.fill();
      } else ctx.fillRect(sx - q.size / 2, sy - q.size / 2, q.size, q.size);
    }
    ctx.globalAlpha = 1;

    // x-ray silhouette when the kid is behind a house / tree
    if (occluded) {
      const sx = isoX(p.x, p.y), sy = isoY(p.x, p.y);
      ctx.globalAlpha = 0.55;
      this.drawOcclusionSilhouette(g, sx, sy);
      ctx.globalAlpha = 1;
    }

    // elite HP bars + status icons
    for (const e of g.enemies) {
      if (e.def.boss) continue;
      const sx = isoX(e.x, e.y), sy = isoY(e.x, e.y);
      if (e.hp < e.maxHp || e.maxShield > 0 || e.affix) {
        const w = e.elite ? 60 : 30, h = e.elite ? 6 : 4;
        const top = sy - this.en[e.type].s.ay * (e.elite && !e.def.elite ? 1.25 : 1) - 6;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(sx - w / 2 - 1, top - 1, w + 2, h + 2);
        ctx.fillStyle = e.elite ? '#ff3b3b' : '#e84a4a';
        ctx.fillRect(sx - w / 2, top, (w * Math.max(0, e.hp)) / e.maxHp, h);
        if (e.affix) {
          ctx.font = '600 10px system-ui'; ctx.textAlign = 'center'; ctx.strokeStyle = '#081018'; ctx.lineWidth = 3;
          ctx.fillStyle = AFFIX_INFO[e.affix].color;
          const labelY = top - (e.maxShield > 0 ? 29 : 13);
          ctx.strokeText(AFFIX_INFO[e.affix].name, sx, labelY); ctx.fillText(AFFIX_INFO[e.affix].name, sx, labelY);
        }
        if (e.maxShield > 0) {
          ctx.fillStyle = '#162d38'; ctx.fillRect(sx - w / 2, top - 7, w, 4);
          ctx.fillStyle = '#76ddff'; ctx.fillRect(sx - w / 2, top - 7, w * clamp(e.shield / e.maxShield, 0, 1), 4);
          ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center';
          ctx.strokeStyle = '#081018'; ctx.lineWidth = 3;
          ctx.strokeText('LIEUTENANT', sx, top - 13); ctx.fillText('LIEUTENANT', sx, top - 13);
        }
        let ix = sx - w / 2;
        const statusY = top + h + 3; // Leave the shield line above HP unobstructed.
        if (e.burnT > 0) { ctx.fillStyle = ELEM.fire.color; ctx.fillRect(ix, statusY, 5, 4); ix += 7; }
        if (e.ectoT > 0) { ctx.fillStyle = ELEM.ecto.color; ctx.fillRect(ix, statusY, 5, 4); ix += 7; }
        if ((e.frozenT ?? 0) > 0 || (e.chill ?? 0) > 0.15) { ctx.fillStyle = '#9fe8ff'; ctx.fillRect(ix, statusY, 5, 4); ix += 7; }
        if (e.stunT > 0 && !e.frozenT) { ctx.fillStyle = '#ffe14a'; ctx.fillRect(ix, statusY, 5, 4); }
      }
    }

    // locked district gate markers
    for (const gate of m.gates) {
      if (gate.opened) continue;
      const sx = isoX(gate.x, gate.y), sy = isoY(gate.x, gate.y);
      if (!inView(sx - 60, sy - 180, sx + 60, sy + 20)) continue;
      const remain = Math.max(0, gate.openAt - g.time);
      const mm = Math.floor(remain / 60), ss = Math.floor(remain % 60);
      ctx.save();
      ctx.globalAlpha = 0.5 + Math.sin(this.t * 3) * 0.15;
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(glow('#E63946', 64), sx - 40, sy - 16, 80, 32);
      ctx.restore();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '24px system-ui';
      ctx.fillText('🔒', sx, sy - 120 + Math.sin(this.t * 2.5) * 4);
      ctx.font = '900 13px system-ui';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeText(`${mm}:${String(ss).padStart(2, '0')}`, sx, sy - 96);
      ctx.fillStyle = '#FFC453';
      ctx.fillText(`${mm}:${String(ss).padStart(2, '0')}`, sx, sy - 96);
    }

    // trick-or-treat door markers (unvisited houses)
    for (const h of m.houses) {
      if (h.visited) continue;
      const sx = isoX(h.door.x, h.door.y), sy = isoY(h.door.x, h.door.y);
      if (!inView(sx - 40, sy - 160, sx + 40, sy + 20)) continue;
      const bob = Math.sin(this.t * 3 + h.door.x) * 5;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35 + Math.sin(this.t * 4 + h.door.y) * 0.1;
      ctx.drawImage(glow('#ffb347', 64), sx - 30, sy - 14, 60, 28);
      ctx.restore();
      if (!(g.tot && g.tot.house === h)) {
        ctx.font = '22px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🍬', sx, sy - 110 + bob);
        ctx.fillStyle = 'rgba(255,207,106,0.9)';
        ctx.font = '11px Anton, Impact, sans-serif';
        ctx.fillText('TRICK OR TREAT', sx, sy - 92 + bob);
      }
    }

    // trick-or-treat progress ring (vulnerable!)
    if (g.tot) {
      const sx = isoX(p.x, p.y), sy = isoY(p.x, p.y);
      const prog = g.tot.t / g.tot.dur;
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath(); ctx.ellipse(sx, sy, 46, 23, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#ffb347';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(sx, sy, 46, 23, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog); ctx.stroke();
      // danger pulse
      ctx.strokeStyle = `rgba(255,60,60,${0.35 + Math.sin(this.t * 10) * 0.25})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(sx, sy, 56 + Math.sin(this.t * 10) * 3, 28, 0, 0, Math.PI * 2); ctx.stroke();
    }

    // speech bubbles
    for (const b of g.bubbles) {
      const sx = isoX(b.x, b.y), sy = isoY(b.x, b.y) - b.lift;
      const age = b.max - b.life;
      const pop = age < 0.15 ? 0.6 + (age / 0.15) * 0.4 : 1;
      const a = Math.min(1, b.life * 4);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(sx, sy);
      ctx.scale(pop, pop);
      ctx.font = `700 ${b.who === 'trick' ? 17 : 15}px "Barlow Condensed", system-ui, sans-serif`;
      const words = b.text.split(' ');
      const lines: string[] = [];
      let cur = '';
      for (const w of words) {
        const t2 = cur ? cur + ' ' + w : w;
        if (ctx.measureText(t2).width > 170 && cur) { lines.push(cur); cur = w; } else cur = t2;
      }
      if (cur) lines.push(cur);
      const lh = 16, pw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 22, ph = lines.length * lh + 14;
      // kit bubbles: the kid talks in cream, grown-ups behind doors in dark plates
      const bg = b.who === 'kid' ? '#f5e5bf' : b.who === 'trick' ? '#2a0d14' : '#15161a';
      const fg = b.who === 'kid' ? '#1a1020' : b.who === 'trick' ? '#ff5a5a' : '#f2e6c9';
      const tailX = b.who === 'kid' ? 0 : -pw * 0.25;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.roundRect(-pw / 2 + 3, -ph + 3, pw, ph, 10); ctx.fill();
      ctx.fillStyle = bg;
      ctx.strokeStyle = b.who === 'trick' ? '#ff3b3b' : b.who === 'kid' ? '#1a1020' : '#8a8f8c';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(-pw / 2, -ph, pw, ph, 10);
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(tailX - 7, -1.5); ctx.lineTo(tailX + 2, 12); ctx.lineTo(tailX + 8, -1.5);
      ctx.fill();
      ctx.beginPath(); ctx.moveTo(tailX - 7, 0); ctx.lineTo(tailX + 2, 12); ctx.lineTo(tailX + 8, 0); ctx.stroke();
      ctx.fillStyle = fg;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      lines.forEach((l, i) => ctx.fillText(l, 0, -ph + 7 + lh / 2 + i * lh));
      ctx.restore();
    }

    // interaction marker
    if (g.interact && g.mounted < 0) {
      const r = g.interact.ref as { x?: number; y?: number; x0?: number; y0?: number; fw?: number; fh?: number };
      let wx = 0, wy = 0;
      const door = (g.interact.ref as { door?: { x: number; y: number } }).door;
      if (door) { wx = door.x; wy = door.y; }
      else if (r.x !== undefined && r.y !== undefined) { wx = r.x; wy = r.y; }
      else if (r.x0 !== undefined) { wx = r.x0 + (r.fw || 1) / 2; wy = r.y0! + (r.fh || 1) / 2; }
      const sx = isoX(wx, wy), sy = isoY(wx, wy) - 70 + Math.sin(this.t * 5) * 4;
      // cream keycap from the kit
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath(); ctx.roundRect(sx - 13, sy - 11, 28, 28, 5); ctx.fill();
      ctx.fillStyle = '#fef5d8';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(sx - 14, sy - 14, 28, 28, 5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#2a221a';
      ctx.font = '700 18px "Barlow Condensed", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('E', sx, sy + 1);
    }

    // floating texts
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of g.texts) {
      if (t.kind === 'dmg' && !settings.dmgText) continue;
      const sx = isoX(t.x, t.y), sy = isoY(t.x, t.y) - t.z * Z - 30;
      const a = Math.min(1, t.life * 3);
      const pop = t.kind === 'reason' ? 1 : t.life > 0.65 ? 1 + (t.life - 0.65) * 3 : 1;
      ctx.globalAlpha = a * (t.kind === 'reason' ? 0.72 : 1);
      ctx.font = t.kind === 'reason' ? '500 10px system-ui' : `${Math.round(t.size * pop * 1.08)}px Anton, Impact, sans-serif`;
      ctx.lineWidth = t.kind === 'reason' ? 2 : 3.5;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeText(t.text, sx, sy);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, sx, sy);
    }
    ctx.globalAlpha = 1;

    // ===== screen space =====
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // offscreen indicators
    const ind = (wx: number, wy: number, color: string, label: string) => {
      const [sx, sy] = toS(isoX(wx, wy), isoY(wx, wy));
      if (sx > 40 && sx < vw - 40 && sy > 40 && sy < vh - 40) return;
      const cx = vw / 2, cy = vh / 2;
      const a = Math.atan2(sy - cy, sx - cx);
      const ex = clamp(cx + Math.cos(a) * vw, 40, vw - 40), ey = clamp(cy + Math.sin(a) * vh, 60, vh - 60);
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(a);
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-6, -10); ctx.lineTo(-6, 10); ctx.fill();
      ctx.restore();
      ctx.fillStyle = color;
      ctx.font = 'bold 12px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(label, clamp(ex - Math.cos(a) * 22, 95, vw - 95), clamp(ey - Math.sin(a) * 22, 90, vh - 110));
    };
    const tutorial = g.tutorialHouse;
    if (tutorial && !g.treatGuideComplete && !tutorial.visited && !g.tot && g.state === 'play' && !g.bigMap) {
      const [sx, sy] = toS(isoX(tutorial.door.x, tutorial.door.y), isoY(tutorial.door.x, tutorial.door.y));
      {
        const miniWidth = Math.min(230, vw * 0.22), miniBottom = hudTop + 3 + 16 + miniWidth / 2 + 6;
        const underMap = sx > vw - miniWidth - 110 && sy < miniBottom + 100;
        const onScreen = !underMap && sx >= 85 && sx <= vw - 85 && sy >= 170 && sy <= vh - 115;
        const angle = Math.atan2(sy - vh / 2, sx - vw / 2);
        let ax = onScreen ? sx : clamp(vw / 2 + Math.cos(angle) * vw, 90, vw - 90);
        let ay = onScreen ? sy - 18 : clamp(vh / 2 + Math.sin(angle) * vh, 190, vh - 150);
        if (ax > vw - miniWidth - 110 && ay < miniBottom + 100) {
          if (miniBottom + 100 <= vh - 150) ay = miniBottom + 100;
          else ax = Math.max(90, vw - miniWidth - 112);
        }
        const bob = Math.sin(this.t * 3) * 4;
        ctx.save(); ctx.translate(ax, ay + bob);
        ctx.save(); if (!onScreen) ctx.rotate(angle - Math.PI / 2);
        ctx.shadowColor = '#52e984'; ctx.shadowBlur = 14;
        const green = ctx.createLinearGradient(0, -52, 0, 0); green.addColorStop(0, '#c8ffd7'); green.addColorStop(1, '#45da79');
        ctx.fillStyle = green; ctx.strokeStyle = '#143d27'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-7, -50); ctx.lineTo(7, -50); ctx.lineTo(7, -23); ctx.lineTo(18, -23); ctx.lineTo(0, 0); ctx.lineTo(-18, -23); ctx.lineTo(-7, -23); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore(); ctx.fillStyle = '#0c211bef'; ctx.strokeStyle = '#63d991'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(-78, -84, 156, 26, 8); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#e4ffeb'; ctx.font = '700 12px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(Math.hypot(tutorial.door.x - p.x, tutorial.door.y - p.y) < 1.1 ? (touchViewport ? 'TAP INTERACT' : 'RING THE BELL · E') : 'FIRST TREATS', 0, -71);
        ctx.restore();
      }
    }
    if (g.campaign && g.state !== 'intro') {
      // One readable objective arrow: prefer a kid whose district is already open.
      const missing = g.friends.filter(f => f.status !== 'rescued');
      missing.sort((a, b) => Number(a.status === 'locked') - Number(b.status === 'locked') || Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
      const friend = missing[0];
      if (friend) {
        const gate = m.gates[friend.gate];
        const target = friend.status === 'locked' && gate && !gate.opened ? gate : friend;
        const name = HERO_INFO[friend.hero].name;
        ind(target.x, target.y, '#85f1ef', friend.status === 'locked' && gate && !gate.opened ? `${name} · gate ${Math.max(0, Math.ceil(gate.openAt - g.time))}s` : `Rescue ${name}`);
      }
      // Draw rescue beacons after scenery so roofs/trees cannot hide the objective.
      for (const friend of missing) {
        const [sx, sy] = toS(isoX(friend.x, friend.y), isoY(friend.x, friend.y));
        if (sx < 0 || sx > vw || sy < 0 || sy > vh) continue;
        ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center'; ctx.lineWidth = 4;
        ctx.strokeStyle = '#07151c'; ctx.fillStyle = '#85f1ef';
        const label = `+ ${HERO_INFO[friend.hero].name} · rescue`;
        ctx.strokeText(label, sx, sy - 65); ctx.fillText(label, sx, sy - 65);
      }
    }
    for (const friend of g.friends) if (friend.status === 'rescued' && friend.hp <= 0) ind(friend.x, friend.y, '#ff6a8a', `Revive ${HERO_INFO[friend.hero].name} · ${Math.max(0, Math.ceil((g.stats.mateUp || g.friendDownTime) - (friend.downT ?? 0)))}s`);
    // where to shop: the stand always, the candy machines for a minute after they move
    if (g.state === 'play' && !g.bigMap) for (const shop of m.shops) {
      const stand = shop.prop.kind !== 'vending';
      if (stand || g.time - g.shopsMovedAt < 60) ind(shop.x, shop.y, '#ff9a2a', stand ? 'Shop' : 'Candy machine');
    }
    if (g.boss) ind(g.boss.x, g.boss.y, '#ff4a1a', '👑');

    // falling leaves
    for (const l of this.leaves) {
      l.x += l.vx * dt * 0.5 + Math.sin(this.t + l.r) * 0.0005;
      l.y += l.vy * dt * 0.5;
      if (l.y > 1.05) { l.y = -0.05; l.x = Math.random(); }
      if (l.x > 1.05) l.x = -0.05;
      ctx.save();
      ctx.translate(l.x * vw, l.y * vh);
      ctx.rotate(this.t * 2 + l.r);
      ctx.fillStyle = l.c;
      ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.ellipse(0, 0, 5, 2.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // vignette + hurt
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.vignette) ctx.drawImage(this.vignette, 0, 0);
    if (p.hurtT > 0 || p.hp < g.stats.maxHp * 0.25) {
      const a = p.hurtT > 0 ? p.hurtT * 1.6 : 0.18 + Math.sin(this.t * 5) * 0.08;
      const gr = ctx.createRadialGradient(cv.width / 2, cv.height / 2, cv.height * 0.3, cv.width / 2, cv.height / 2, cv.height * 0.8);
      gr.addColorStop(0, 'rgba(255,0,0,0)');
      gr.addColorStop(1, `rgba(200,0,20,${a})`);
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, cv.width, cv.height);
    }

    // minimap (kit: dark plate, gold frame). M / Tab blows it up into a full map.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.minimap) {
      const big = g.bigMap;
      const mw = big ? Math.min(vw * 0.72, vh * 1.5) : Math.min(230, vw * 0.22), sc = mw / this.minimap.width, mh = this.minimap.height * sc;
      // Follow the real HUD height, including touch layout and safe-area padding.
      const top = hudTop + 3;
      const mx = big ? (vw - mw) / 2 : vw - mw - 16, my = big ? (vh - mh) / 2 : top + 16;
      const k = big ? 2 : 1;
      if (big) {
        ctx.fillStyle = 'rgba(5,6,10,0.6)';
        ctx.fillRect(0, 0, vw, vh);
      }
      // HexMatch minimap frame: 4px ink border + 1px orange outline
      ctx.fillStyle = '#172022';
      ctx.fillRect(mx - 6, my - 6, mw + 12, mh + 12);
      ctx.fillStyle = '#0d1418';
      ctx.fillRect(mx - 2, my - 2, mw + 4, mh + 4);
      ctx.strokeStyle = '#ec9633'; ctx.lineWidth = 1;
      ctx.strokeRect(mx - 6.5, my - 6.5, mw + 13, mh + 13);
      ctx.drawImage(this.minimap, mx, my, mw, mh);
      const s = 3 * sc;
      const MP = (x: number, y: number): [number, number] => [mx + ((x - y) * s + MAP_H * s), my + ((x + y) * s) / 2];
      ctx.fillStyle = '#ff4a4a';
      for (const e of g.enemies) { const [a, b] = MP(e.x, e.y); const z = (e.elite ? 4 : 2) * k; ctx.fillRect(a - z / 2, b - z / 2, z, z); }
      // Loot on the ground is not marked: the map shows where to go, not every bag and gun.
      for (const shp of m.shops) {
        // the Candy Lady's stand: an orange awning; candy machines: a small orange block
        const [a, b] = MP(shp.x, shp.y), stand = shp.prop.kind !== 'vending', r = (stand ? 5 : 3) * k;
        ctx.fillStyle = '#ff9a2a'; ctx.strokeStyle = '#1a0d02'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (stand) { ctx.moveTo(a - r, b); ctx.lineTo(a, b - r); ctx.lineTo(a + r, b); ctx.lineTo(a + r * 0.7, b + r * 0.8); ctx.lineTo(a - r * 0.7, b + r * 0.8); ctx.closePath(); }
        else ctx.rect(a - r, b - r, r * 2, r * 2);
        ctx.fill(); ctx.stroke();
        if (big) {
          ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
          ctx.lineWidth = 3; ctx.strokeText(stand ? 'Shop' : 'Candy machine', a, b - r - 2);
          ctx.fillStyle = '#ffd9a8'; ctx.fillText(stand ? 'Shop' : 'Candy machine', a, b - r - 2);
        }
      }
      ctx.fillStyle = '#fff1b8';
      ctx.globalAlpha = 0.6 + Math.sin(this.t * 4) * 0.4;
      for (const h of m.houses) {
        if (h.visited) continue;
        const [a, b] = MP(h.door.x, h.door.y);
        ctx.beginPath(); ctx.moveTo(a, b - 4 * k); ctx.lineTo(a + 3 * k, b); ctx.lineTo(a, b + 4 * k); ctx.lineTo(a - 3 * k, b); ctx.fill();
      }
      ctx.globalAlpha = 1;
      // Rescue locations stay visible even while their district gate is locked.
      if (g.campaign) for (const friend of g.friends) {
        if (friend.status === 'rescued') continue;
        const [a, b] = MP(friend.x, friend.y);
        ctx.fillStyle = '#6ef4ff'; ctx.strokeStyle = '#07141a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(a, b, 5 * k, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#07141a'; ctx.fillRect(a - 3 * k, b - k, 6 * k, 2 * k); ctx.fillRect(a - k, b - 3 * k, 2 * k, 6 * k);
        if (big) {
          ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
          ctx.strokeStyle = '#07141a'; ctx.lineWidth = 3; ctx.strokeText(HERO_INFO[friend.hero].name, a, b - 8 * k);
          ctx.fillStyle = '#ffffff'; ctx.fillText(HERO_INFO[friend.hero].name, a, b - 8 * k);
        }
      }
      // a fallen friend: a pulsing beacon, so they can be found before their 30 seconds run out
      for (const friend of g.friends) {
        if (friend.status !== 'rescued' || friend.hp > 0) continue;
        const [a, b] = MP(friend.x, friend.y), pulse = (this.t * 1.6) % 1;
        ctx.strokeStyle = `rgba(255,106,138,${1 - pulse})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(a, b, (5 + pulse * 12) * k, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#ff6a8a'; ctx.strokeStyle = '#1a070c';
        ctx.beginPath(); ctx.arc(a, b, 5 * k, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#1a070c'; ctx.fillRect(a - 3 * k, b - k, 6 * k, 2 * k); ctx.fillRect(a - k, b - 3 * k, 2 * k, 6 * k);
        if (big) {
          const label = `${HERO_INFO[friend.hero].name} · ${Math.max(0, Math.ceil((g.stats.mateUp || g.friendDownTime) - (friend.downT ?? 0)))}s`;
          ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
          ctx.strokeStyle = '#1a070c'; ctx.lineWidth = 3; ctx.strokeText(label, a, b - 8 * k);
          ctx.fillStyle = '#ffd0da'; ctx.fillText(label, a, b - 8 * k);
        }
      }
      if (g.boss) { const [a, b] = MP(g.boss.x, g.boss.y); ctx.fillStyle = '#ff8a1e'; ctx.beginPath(); ctx.arc(a, b, 5 * k, 0, Math.PI * 2); ctx.fill(); }
      const [pa, pb] = MP(p.x, p.y);
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(pa, pb, 3.5 * k, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke();
      if (big) {
        ctx.font = '700 13px "Barlow Condensed", system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#f08a2c';
        ctx.fillText('M A P L E   F A L L S', mx - 6, my - 34);
        ctx.font = '32px Anton, Impact, sans-serif';
        ctx.fillStyle = '#fff0da';
        ctx.fillText('TONIGHT\'S STREETS', mx - 6, my - 14);
        ctx.fillStyle = '#ed7414';
        ctx.fillRect(mx + 268, my - 24, 61, 4);
        ctx.font = '700 13px "Barlow Condensed", system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillStyle = '#c9bda6';
        if (!touchViewport) ctx.fillText('M  ·  CLOSE MAP', mx + mw + 6, my - 14); // touch gets a real button (Hud)
      }
    }

    // crosshair
    if (g.input.mouseActive) {
      const x = g.input.mx, y = g.input.my;
      ctx.strokeStyle = g.input.mdown ? '#ffcf6a' : 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.moveTo(x - 15, y); ctx.lineTo(x - 5, y); ctx.moveTo(x + 5, y); ctx.lineTo(x + 15, y);
      ctx.moveTo(x, y - 15); ctx.lineTo(x, y - 5); ctx.moveTo(x, y + 5); ctx.lineTo(x, y + 15);
      ctx.stroke();
    }
  }

  private drawLighting(g: Game, toS: (x: number, y: number) => [number, number], zoom: number, vw: number, vh: number, camX: number, camY: number) {
    const L = this.lctx, lc = this.light;
    const k = (lc.width / vw);
    L.setTransform(1, 0, 0, 1, 0, 0);
    L.globalCompositeOperation = 'source-over';
    L.fillStyle = `rgba(5,7,24,${(0.78 * (1 - settings.bright * 0.45)).toFixed(3)})`;
    L.fillRect(0, 0, lc.width, lc.height);
    L.globalCompositeOperation = 'destination-out';
    const spr = lightSprite();
    const light = (wx: number, wy: number, r: number, i: number, lift = 0) => {
      const [sx, sy] = toS(isoX(wx, wy), isoY(wx, wy) - lift);
      const rx = r * HW * 1.42 * zoom * k, ry = r * HH * 1.42 * zoom * k;
      const x = sx * k, y = sy * k;
      if (x + rx < 0 || y + ry < 0 || x - rx > lc.width || y - ry > lc.height) return;
      L.globalAlpha = Math.min(1, i);
      L.drawImage(spr, x - rx, y - ry, rx * 2, ry * 2);
    };
    const p = g.p;
    for (const s of g.map.lights) {
      const fl = s.flicker ? 0.85 + Math.sin(this.t * 13 + s.x * 7) * 0.08 + Math.sin(this.t * 31 + s.y) * 0.05 : 1;
      // street lamps, porch lights and lit windows clear the dark (almost) completely, dim ones just a bit less
      light(s.x, s.y, s.r, (0.6 + s.i * 0.45) * fl);
    }
    light(p.x, p.y, 3.4, 1, 20);
    // flashlight cone
    {
      const [sx, sy] = toS(isoX(p.x, p.y), isoY(p.x, p.y) - 30);
      const a = Math.atan2(isoY(p.aimX, p.aimY), isoX(p.aimX, p.aimY));
      const R = 8.5 * HW * zoom * k;
      const x = sx * k, y = sy * k;
      const gr = L.createRadialGradient(x, y, 0, x, y, R);
      gr.addColorStop(0, 'rgba(255,255,255,0.9)');
      gr.addColorStop(0.6, 'rgba(255,255,255,0.5)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      L.globalAlpha = 0.85;
      L.fillStyle = gr;
      L.beginPath();
      L.moveTo(x, y);
      L.arc(x, y, R, a - 0.42, a + 0.42);
      L.closePath();
      L.fill();
    }
    for (const b of g.bullets) if (b.kind === 'fire' || b.kind === 'rocket' || b.kind === 'balloon' || b.kind === 'water' || b.kind === 'disc' || b.kind === 'void' || b.kind === 'shell' || b.kind === 'flame' || b.kind === 'missile' || b.kind === 'glaive') light(b.x, b.y, b.kind === 'void' ? 2 : 1.2, 0.6);
    for (const pr of g.map.props) if (pr.burnT || pr.boomT !== undefined) light(pr.x0 + pr.fw / 2, pr.y0 + pr.fh / 2, Math.max(pr.fw, pr.fh) * (pr.boomT !== undefined ? 2.2 : 1.3) + 1, pr.boomT !== undefined ? 1 : 0.5 + Math.min(0.4, pr.burnT ?? 0));
    for (const z of g.zones) {
      if (z.kind === 'boom') light(z.x, z.y, z.r * 2.2, 1 - z.t / z.life);
      else if (z.kind === 'fire') light(z.x, z.y, z.r * 1.6, 0.7);
      else if (z.kind === 'flash') light(z.x, z.y, z.r, 1 - z.t / z.life);
      else if (z.kind === 'tornado') light(z.x, z.y, z.r * 1.4, 0.4);
      else if (z.kind === 'vortex') light(z.x, z.y, z.r * 0.9, 0.7);
      else if (z.kind === 'trail') { const k = Math.min(1, (z.life - z.t) * 2) * 0.5; light(z.x, z.y, 0.9, k); light(z.x1 ?? z.x, z.y1 ?? z.y, 0.9, k); }
    }
    for (const b of g.ebullets) light(b.x, b.y, 0.9, 0.7);
    for (const e of g.enemies) {
      if (e.burnT > 0) light(e.x, e.y, 1.3, 0.6);
      if (e.def.boss) light(e.x, e.y, 4, 0.9);
      else if (e.type === 'ghost') light(e.x, e.y, 1.0, 0.35);
    }
    for (const q of g.particles) if (q.kind === 'glow' && q.size > 10) light(q.x, q.y, 1.0, (q.life / q.max) * 0.6);
    for (const k2 of g.pickups) if (k2.kind === 'weapon' || k2.kind === 'chest') light(k2.x, k2.y, 1.3 + (k2.weapon?.rarity ?? 0) * 0.25, 0.65 + (k2.weapon?.rarity ?? 0) * 0.07);
    L.globalAlpha = 1;
    L.globalCompositeOperation = 'source-over';
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(lc, 0, 0, this.canvas.width, this.canvas.height);
    void camX; void camY; void vh;
  }

  private drawHeroFrame(img: Img, g: Game, sx: number, sy: number) {
    const p = g.p, ctx = this.ctx;
    const row = p.back ? (p.moving ? 3 : 2) : p.moving ? 1 : 0;
    ctx.save();
    ctx.translate(sx, sy);
    if (p.flip) ctx.scale(-1, 1);
    blitFrame(ctx, this.hero, img, row, Math.floor(p.anim), 0, 0);
    ctx.restore();
  }

  /** Visibility behind scenery must match the same pose used for the visible kid. */
  private drawOcclusionSilhouette(g: Game, sx: number, sy: number) {
    const aim = heroAim(g.p.costume ? `${HEROES[this.heroIdx].id}_${g.p.costume}` : HEROES[this.heroIdx].id);
    if (aim) {
      this.drawAimKid(aim, sx, sy, this.aimDir, g.p.moving, g.p.anim, null, 0, false, '#7fd8ff');
    } else this.drawHeroFrame(this.heroSil, g, sx, sy);
  }

  /** one frame of an aiming sheet tinted flat (hurt flash, dash afterimage) without keeping tinted copies of the sheet */
  private tintedAimFrame(aim: HeroAim, dir: number, col: number, color: string) {
    const { c, ctx } = this.scratch, size = AIM.frame * AIM.scale;
    if (c.width !== size) c.width = c.height = size;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(aim.img, col * size, dir * size, size, size, 0, 0, size, size);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, size, size);
    return c;
  }
  /**
   * A kid from an aiming sheet with their gun in hand. The arms point along direction `dir` and the gun's grip sits
   * where the hands meet. Layers: the kid, then the gun, then the forearms and hands again, so the hands are ON the
   * gun. Aimed away from the camera the gun is beyond the whole body, so it goes first.
   */
  private drawAimKid(aim: HeroAim, sx: number, sy: number, dir: number, moving: boolean, anim: number, gun: string | null, recoil: number, reloading: boolean, tint?: string) {
    const ctx = this.ctx, size = AIM.frame * AIM.scale;
    const col = moving ? 1 + (Math.floor(anim) % AIM.walk) : 0;
    const hand = aim.hands[dir]?.[col] ?? [0, -KID_WAIST_HEIGHT];
    const layer = (column: number) => ctx.drawImage(aim.img, column * size, dir * size, size, size, sx - AIM.ax, sy - AIM.ay, AIM.frame, AIM.frame);
    if (tint) { ctx.drawImage(this.tintedAimFrame(aim, dir, col, tint), sx - AIM.ax, sy - AIM.ay, AIM.frame, AIM.frame); return; }
    const drawGun = () => {
      if (!gun) return;
      const a = dir * Math.PI / 4;
      ctx.save();
      ctx.translate(sx + hand[0], sy + hand[1]);
      ctx.rotate(a);
      if (Math.cos(a) < -0.01) ctx.scale(1, -1);
      ctx.translate(-recoil * 3, 0);
      if (reloading) ctx.rotate(Math.sin(this.t * 14) * 0.25 - 0.4);
      // held out at arm's length it reads a touch larger than the old waist-height gun
      ctx.drawImage(weaponIcon(gun), -HELD_GUN_GRIP_X * AIM_GUN_SCALE, -HELD_GUN_GRIP_Y * AIM_GUN_SCALE, HELD_GUN_W * AIM_GUN_SCALE, HELD_GUN_H * AIM_GUN_SCALE);
      ctx.restore();
    };
    if (dir >= 5) { drawGun(); layer(col); return; } // aiming up-screen
    layer(col);
    drawGun();
    if (gun) layer(AIM.cols + col); // forearms and hands over the gun
  }

  private drawPlayer(g: Game, sx: number, sy: number) {
    const p = g.p, ctx = this.ctx;
    const blink = p.invuln > 0 && p.dashT <= 0 && Math.floor(this.t * 20) % 2 === 0;
    const w = g.weapon;
    // a kid in their own costume has an aiming sheet too; any other look falls back to the painted sprite
    const aim = heroAim(p.costume ? `${HEROES[this.heroIdx].id}_${p.costume}` : HEROES[this.heroIdx].id);
    if (aim) {
      // face where the gun points; with nothing to shoot at, where the feet are going
      if (Math.hypot(p.x - this.lastX, p.y - this.lastY) > 1e-4) { this.moveX = p.x - this.lastX; this.moveY = p.y - this.lastY; }
      this.lastX = p.x; this.lastY = p.y;
      const fx = p.aiming || !p.moving ? p.aimX : this.moveX, fy = p.aiming || !p.moving ? p.aimY : this.moveY;
      const angle = Math.atan2(isoY(fx, fy), isoX(fx, fy));
      // a little stickiness, so an aim hovering between two directions does not flicker
      let off = angle - this.aimDir * Math.PI / 4;
      off = Math.atan2(Math.sin(off), Math.cos(off));
      if (Math.abs(off) > 0.5) this.aimDir = aimDir(angle);
      const gun = w && g.mounted < 0 ? w.def.id : null, reloading = !!w && w.reloadT > 0;
      if (p.dashT > 0) {
        ctx.globalAlpha = 0.35;
        this.drawAimKid(aim, sx - isoX(p.dashX, p.dashY) * 0.3, sy - isoY(p.dashX, p.dashY) * 0.3, this.aimDir, p.moving, p.anim, null, 0, false, '#7fd8ff');
        ctx.globalAlpha = 1;
      }
      if (blink) ctx.globalAlpha = 0.5;
      this.drawAimKid(aim, sx, sy, this.aimDir, p.moving, p.anim, gun, p.recoil, reloading);
      if (p.hurtT > 0) {
        ctx.globalAlpha = Math.min(1, p.hurtT * 2);
        this.drawAimKid(aim, sx, sy, this.aimDir, p.moving, p.anim, null, 0, false, '#ff3030');
      }
      ctx.globalAlpha = 1;
      this.drawReloadRing(g, sx, sy);
      return;
    }
    const drawWeapon = () => {
      if (!w || g.mounted >= 0) return;
      const a = Math.atan2(isoY(p.aimX, p.aimY), isoX(p.aimX, p.aimY));
      ctx.save();
      ctx.translate(sx + Math.cos(a) * 4, sy - KID_WAIST_HEIGHT + Math.sin(a) * 2);
      ctx.rotate(a);
      if (Math.cos(a) < 0) ctx.scale(1, -1);
      ctx.translate(-p.recoil * 3, 0);
      if (w.reloadT > 0) ctx.rotate(Math.sin(this.t * 14) * 0.25 - 0.4);
      ctx.drawImage(weaponIcon(w.def.id), -HELD_GUN_GRIP_X, -HELD_GUN_GRIP_Y, HELD_GUN_W, HELD_GUN_H);
      ctx.restore();
    };
    if (p.dashT > 0) {
      ctx.globalAlpha = 0.35;
      this.drawHeroFrame(this.heroSil, g, sx - isoX(p.dashX, p.dashY) * 0.3, sy - isoY(p.dashX, p.dashY) * 0.3);
      ctx.globalAlpha = 1;
    }
    if (p.back) drawWeapon();
    if (blink) ctx.globalAlpha = 0.5;
    this.drawHeroFrame(this.hero.img, g, sx, sy);
    if (p.hurtT > 0) {
      ctx.globalAlpha = p.hurtT * 2;
      this.drawHeroFrame(this.heroFlash, g, sx, sy);
    }
    ctx.globalAlpha = 1;
    if (!p.back) drawWeapon();
    this.drawReloadRing(g, sx, sy);
  }

  private drawReloadRing(g: Game, sx: number, sy: number) {
    const ctx = this.ctx, w = g.weapon;
    if (w && w.reloadT > 0) {
      const total = weaponStats(w, g.stats).reload;
      const prog = clamp(1 - w.reloadT / total, 0, 1);
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(sx, sy - 112, 10, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#ffcf6a';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(sx, sy - 112, 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog); ctx.stroke();
    }
  }

  private drawEnemy(e: Enemy, sx: number, sy: number, sc: number) {
    const ctx = this.ctx;
    const E = this.en[e.type], s = E.s;
    const f = Math.floor(e.anim);
    ctx.save();
    let rise = 0;
    if (e.spawnT > 0) {
      rise = (e.spawnT / 0.4) * s.ay * 0.8;
      ctx.beginPath();
      ctx.rect(sx - 200, sy - 400, 400, 400 + 4);
      ctx.clip();
    }
    ctx.translate(sx, sy + rise);
    if (e.def.fly) ctx.translate(0, -26 + Math.sin(e.anim) * 3);
    ctx.scale(e.flip ? -sc : sc, sc);
    if (e.type === 'ghost') ctx.globalAlpha = 0.82;
    blitFrame(ctx, s, s.img, 0, f, 0, 0);
    if (e.ectoT > 0) {
      ctx.globalAlpha = 0.35;
      blitFrame(ctx, s, E.green, 0, f, 0, 0);
    }
    if ((e.frozenT ?? 0) > 0 || (e.chill ?? 0) > 0.15) {
      ctx.globalAlpha = e.frozenT ? 0.7 : (e.chill ?? 0) * 0.45;
      blitFrame(ctx, s, (E.ice ??= tinted(s.img, '#8fdcff')), 0, f, 0, 0);
    }
    if (e.hit > 0) {
      ctx.globalAlpha = Math.min(1, e.hit * 10);
      blitFrame(ctx, s, E.white, 0, f, 0, 0);
    }
    ctx.restore();
    if (e.stunT > 0 && !e.frozenT) {
      for (let k = 0; k < 3; k++) {
        const a = this.t * 5 + (k * Math.PI * 2) / 3;
        ctx.fillStyle = '#ffe14a';
        ctx.fillRect(sx + Math.cos(a) * 12 - 2, sy - s.ay * sc - 4 + Math.sin(a) * 4, 4, 4);
      }
    }
  }

  /** a burnt-out car, or what is left standing of a house: charred, and for a house the roof and upper walls are gone */
  private drawWreck(pr: PropInst, ax: number, ay: number) {
    const ctx = this.ctx, sp = pr.sp;
    let img = this.charred.get(sp.img);
    if (!img) {
      img = rawCanvas(sp.img.width, sp.img.height);
      const c = img.getContext('2d')!;
      c.drawImage(sp.img, 0, 0);
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = 'rgba(14,9,8,0.76)'; c.fillRect(0, 0, img.width, img.height);
      this.charred.set(sp.img, img);
    }
    const x = ax - sp.ax, y = ay - sp.ay;
    if (pr.kind !== 'house') { ctx.drawImage(img, x, y, sp.w, sp.h); return; }
    // keep the lower walls, with a broken edge that is the same every frame for this house
    const keep = y + sp.h * 0.46, n = 12;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y + sp.h); ctx.lineTo(x, keep);
    for (let k = 1; k <= n; k++) {
      const jag = Math.sin(k * 12.9898 + pr.x0 * 3.7 + pr.y0 * 1.3) * 43758.5453;
      ctx.lineTo(x + (k / n) * sp.w, keep + ((jag - Math.floor(jag)) - 0.5) * sp.h * 0.22);
    }
    ctx.lineTo(x + sp.w, y + sp.h); ctx.closePath(); ctx.clip();
    ctx.drawImage(img, x, y, sp.w, sp.h);
    ctx.restore();
  }
  /** flames on a burning car or house, and the fireball in the second it goes up */
  private drawBurning(pr: PropInst, ax: number, ay: number) {
    const ctx = this.ctx, sp = pr.sp, house = pr.kind === 'house';
    ctx.save();
    if (pr.burnT) {
      const fire = flameSheet(), n = house ? 5 : 2, size = house ? 120 : 84;
      ctx.globalAlpha = Math.min(1, pr.burnT * 0.6);
      for (let k = 0; k < n; k++) {
        const u = n > 1 ? k / (n - 1) : 0.5, f = Math.floor(this.t * 12 + k * 3 + pr.x0) % FX_FRAMES;
        const fx = ax - sp.ax + sp.w * (0.2 + u * 0.6), fy = ay - sp.ay + sp.h * (house ? (pr.wreck ? 0.72 : 0.5) + (k % 2) * 0.1 : 0.62);
        ctx.drawImage(fire.img, f * fire.cell, 0, fire.cell, fire.cell, fx - size / 2, fy - size * 0.86, size, size);
      }
    }
    ctx.restore();
  }

  private candyCorn(ctx: CanvasRenderingContext2D, s: number) {
    ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.8, s); ctx.lineTo(-s * 0.8, s); ctx.closePath();
    ctx.fillStyle = '#ffb52a'; ctx.fill();
    ctx.strokeStyle = '#140c12'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#f2f0e6';
    ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.3, -s * 0.25); ctx.lineTo(-s * 0.3, -s * 0.25); ctx.fill();
    ctx.fillStyle = '#ff6a1a';
    ctx.fillRect(-s * 0.6, s * 0.4, s * 1.2, s * 0.6);
  }

  /** a Candy Cannon on its jungle-gym deck (+ the kid manning it) */
  private drawTurret(g: Game, t: Turret) {
    const ctx = this.ctx, sheet = getTurretSheet();
    const sx = isoX(t.x, t.y), sy = isoY(t.x, t.y) - GYM_DECK_Z;
    const a = Math.atan2(t.aimX + t.aimY, t.aimX - t.aimY); // aim on the screen, before the 2:1 squash
    const f = (((Math.round((a / (Math.PI * 2)) * TURRET_DIRS)) % TURRET_DIRS) + TURRET_DIRS) % TURRET_DIRS;
    const ca = Math.cos(a), sa = Math.sin(a) * 0.55;
    const manned = g.mounted >= 0 && g.turrets[g.mounted] === t;
    const kid = () => this.drawPlayer(g, sx - ca * 30 - sa * 22, sy - sa * 30 + 4); // behind the grips, a little to the side so both read
    if (manned && sa > 0) kid(); // barrel toward the camera: the kid stands behind it
    blitFrame(ctx, sheet, sheet.img, 0, f, sx - ca * t.recoil * 3, sy - sa * t.recoil * 3);
    if (t.heat > 0.45) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, (t.heat - 0.45) * 1.8) * (t.over > 0 ? 0.6 + Math.sin(this.t * 20) * 0.3 : 0.7);
      ctx.drawImage(glow('#ff4a1a', 64), sx + ca * 26 - 22, sy - 22 + sa * 26 - 22, 44, 44);
      ctx.restore();
    }
    if (manned && sa <= 0) kid();
  }

  private drawBullet(b: Game['bullets'][number], sx: number, sy: number) {
    const ctx = this.ctx;
    const y = sy - 24 - (b.z ?? 0);
    const a = Math.atan2(isoY(b.vx, b.vy), isoX(b.vx, b.vy));
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(sx, sy, 4, 2, 0, 0, Math.PI * 2); ctx.fill();
    switch (b.kind) {
      case 'pea':
        ctx.fillStyle = '#5fd84a'; ctx.beginPath(); ctx.arc(sx, y, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#d8ffc0'; ctx.beginPath(); ctx.arc(sx - 1.5, y - 1.5, 1.8, 0, Math.PI * 2); ctx.fill();
        break;
      case 'dart':
        ctx.save(); ctx.translate(sx, y); ctx.rotate(a);
        ctx.fillStyle = '#2f6ad8'; ctx.fillRect(-8, -2.5, 12, 5);
        ctx.fillStyle = '#ff7a1e'; ctx.beginPath(); ctx.arc(5, 0, 3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        break;
      case 'corn':
        ctx.save(); ctx.translate(sx, y); ctx.rotate(a + Math.PI / 2); this.candyCorn(ctx, 6); ctx.restore();
        break;
      case 'fire':
        ctx.fillStyle = '#ffcf3a'; ctx.beginPath(); ctx.arc(sx, y, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff6d0'; ctx.beginPath(); ctx.arc(sx, y, 3, 0, Math.PI * 2); ctx.fill();
        break;
      case 'water':
        ctx.fillStyle = b.color; ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.ellipse(sx, y, 6, 4, a, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(sx - 2, y - 2, 2, 2);
        break;
      case 'balloon':
        ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(sx, y + 9); ctx.quadraticCurveTo(sx + 4, y + 16, sx, y + 20); ctx.stroke();
        ctx.fillStyle = '#4fb3ff'; ctx.beginPath(); ctx.ellipse(sx, y, 8, 10, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#140c12'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.ellipse(sx - 3, y - 4, 2, 3, 0.4, 0, Math.PI * 2); ctx.fill();
        break;
      case 'rocket':
        ctx.save(); ctx.translate(sx, y); ctx.rotate(a);
        ctx.fillStyle = '#d83a2a'; ctx.fillRect(-9, -3.5, 14, 7);
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(5, -3.5); ctx.lineTo(11, 0); ctx.lineTo(5, 3.5); ctx.fill();
        ctx.fillStyle = '#ffcf3a'; ctx.beginPath(); ctx.moveTo(-9, -3); ctx.lineTo(-16 - Math.random() * 6, 0); ctx.lineTo(-9, 3); ctx.fill();
        ctx.restore();
        break;
      case 'stone':
        ctx.fillStyle = '#9a948a'; ctx.beginPath(); ctx.arc(sx, y, 5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#140c12'; ctx.lineWidth = 1.5; ctx.stroke();
        break;
      case 'hex': {
        ctx.save(); ctx.translate(sx, y - 6); ctx.rotate(b.spin);
        ctx.fillStyle = '#e6b8ff';
        ctx.beginPath();
        for (let k = 0; k < 10; k++) {
          const r = k % 2 ? 3 : 8, a2 = (k / 10) * Math.PI * 2;
          if (k === 0) ctx.moveTo(Math.cos(a2) * r, Math.sin(a2) * r); else ctx.lineTo(Math.cos(a2) * r, Math.sin(a2) * r);
        }
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#6a1fb0'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.restore();
        break;
      }
      case 'candy':
        // wrapped sweet from the Candy Cannon
        ctx.save(); ctx.translate(sx, y); ctx.rotate(a);
        ctx.fillStyle = b.color;
        ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(-12, -5); ctx.lineTo(-12, 5); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(12, -5); ctx.lineTo(12, 5); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.ellipse(0, 0, 7.5, 5.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#140c12'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.fillRect(-3, -3, 4, 2);
        ctx.restore();
        break;
      case 'disc':
        // a flat ring of light, seen from above at the game's angle
        ctx.save(); ctx.translate(sx, y); ctx.scale(1, 0.55);
        ctx.fillStyle = '#062230'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = b.color; ctx.lineWidth = 3.5; ctx.stroke();
        ctx.strokeStyle = '#eaffff'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 0, 10, b.spin, b.spin + 2.2); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        break;
      case 'glaive':
        ctx.save(); ctx.translate(sx, y); ctx.scale(1.7, 1.05); ctx.rotate(b.spin * 1.6);
        ctx.beginPath();
        for (let k = 0; k < 5; k++) {
          const a2 = (k / 5) * Math.PI * 2;
          ctx.lineTo(Math.cos(a2) * 15, Math.sin(a2) * 15);
          ctx.quadraticCurveTo(Math.cos(a2 + 0.5) * 9, Math.sin(a2 + 0.5) * 9, Math.cos(a2 + 0.63) * 4.5, Math.sin(a2 + 0.63) * 4.5);
        }
        ctx.closePath();
        ctx.fillStyle = b.color; ctx.fill();
        ctx.strokeStyle = '#3a2408'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = '#e8352a'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        break;
      case 'missile':
        ctx.save(); ctx.translate(sx, y); ctx.rotate(a); ctx.scale(1.6, 1.6);
        ctx.fillStyle = '#ffcf3a'; ctx.beginPath(); ctx.moveTo(-6, -2); ctx.lineTo(-11 - Math.random() * 5, 0); ctx.lineTo(-6, 2); ctx.fill();
        ctx.fillStyle = '#e9ecef'; ctx.fillRect(-6, -2.2, 9, 4.4);
        ctx.strokeStyle = '#140c12'; ctx.lineWidth = 0.8; ctx.strokeRect(-6, -2.2, 9, 4.4);
        ctx.fillStyle = '#e8352a'; ctx.beginPath(); ctx.moveTo(3, -2.2); ctx.lineTo(7, 0); ctx.lineTo(3, 2.2); ctx.fill();
        ctx.restore();
        break;
      case 'shell':
        ctx.save(); ctx.translate(sx, y); ctx.rotate(a);
        ctx.fillStyle = '#ffcf3a'; ctx.beginPath(); ctx.moveTo(-12, -4.5); ctx.lineTo(-22 - Math.random() * 10, 0); ctx.lineTo(-12, 4.5); ctx.fill();
        ctx.fillStyle = '#fff6d0'; ctx.beginPath(); ctx.moveTo(-12, -2); ctx.lineTo(-17 - Math.random() * 4, 0); ctx.lineTo(-12, 2); ctx.fill();
        ctx.fillStyle = '#4a4e56'; ctx.fillRect(-12, -5, 18, 10);
        ctx.strokeStyle = '#140c12'; ctx.lineWidth = 1.5; ctx.strokeRect(-12, -5, 18, 10);
        ctx.fillStyle = '#ffcf3a'; ctx.fillRect(-6, -5, 3, 10);
        ctx.fillStyle = '#ff5a14'; ctx.beginPath(); ctx.moveTo(6, -5); ctx.quadraticCurveTo(16, 0, 6, 5); ctx.fill(); ctx.stroke();
        ctx.restore();
        break;
      case 'void': {
        // a collapsing star: a black ball with a hot purple rim and two orbiting sparks
        ctx.fillStyle = '#05010a'; ctx.beginPath(); ctx.arc(sx, y, 8, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = b.color; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.fillStyle = '#f0d8ff';
        for (let k = 0; k < 2; k++) { const a2 = b.spin * 2 + k * Math.PI; ctx.fillRect(sx + Math.cos(a2) * 12 - 1.5, y + Math.sin(a2) * 6 - 1.5, 3, 3); }
        break;
      }
      case 'flame': {
        // a gout of fire: it starts tight and white-hot and billows as it flies
        const age = clamp(1 - b.life / (b.max ?? 0.3), 0, 1), R = 10 + age * 20, fire = flameSheet();
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.95 - age * 0.3;
        ctx.drawImage(glow(age > 0.7 ? '#e8421a' : '#ff8a1e', 64), sx - R * 1.6, y - R * 1.6, R * 3.2, R * 3.2);
        // a lick of painted flame in each gout, leaning the way it flies
        ctx.translate(sx, y); ctx.rotate(a + Math.PI / 2);
        ctx.drawImage(fire.img, (Math.floor(b.spin * 0.8) % FX_FRAMES) * fire.cell, 0, fire.cell, fire.cell, -R * 1.5, -R * 2.2, R * 3, R * 3);
        ctx.globalAlpha = 0.9 * (1 - age);
        ctx.drawImage(glow('#fff0b0', 32), -R * 0.6, -R * 0.6, R * 1.2, R * 1.2);
        ctx.restore();
        break;
      }
      case 'bone':
        ctx.save(); ctx.translate(sx, y); ctx.rotate(b.spin);
        ctx.strokeStyle = '#eee8d8'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(5, 0); ctx.stroke();
        ctx.fillStyle = '#eee8d8';
        for (const s of [-5, 5]) { ctx.beginPath(); ctx.arc(s, -1.5, 2, 0, Math.PI * 2); ctx.arc(s, 1.5, 2, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
        break;
      default:
        break;
    }
  }
}
