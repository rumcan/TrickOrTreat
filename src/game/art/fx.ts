import { makeCanvas, radialGlow, ellipse, circle } from './draw';
import { asset, Img } from '../assets';

const ICON_STYLE = 'Side-view toy weapon icon, transparent background, pointing RIGHT, chunky hand-painted pixel art with 2px dark outline, grip/hand pivot at pixel (16,20), 64x32 px.';
const OL = '#120c10';

function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string, r = 2) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = c;
  ctx.fill();
  ctx.strokeStyle = OL;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

const ICONS: Record<string, { desc: string; draw: (ctx: CanvasRenderingContext2D) => void }> = {
  pea: { desc: 'Pea Shooter - green toy pistol', draw: (c) => { box(c, 12, 18, 7, 11, '#2f7a2a'); box(c, 10, 11, 30, 9, '#4fb848', 3); box(c, 38, 13, 18, 5, '#2f7a2a'); circle(c, 56, 15.5, 2.5, '#9dff7a'); c.fillStyle = 'rgba(255,255,255,0.3)'; c.fillRect(12, 12, 24, 2); } },
  nerf: { desc: 'Foam Blaster - orange/blue dart SMG', draw: (c) => { box(c, 14, 18, 7, 12, '#ffcf3a'); box(c, 26, 18, 9, 10, '#2f6ad8'); box(c, 8, 9, 40, 11, '#ff7a1e', 4); box(c, 46, 12, 14, 6, '#2f6ad8'); c.fillStyle = '#ffcf3a'; c.fillRect(14, 11, 26, 3); box(c, 4, 12, 6, 6, '#2f6ad8'); } },
  shotgun: { desc: 'Candy Corn Shotgun - double barrel, candy-corn striped', draw: (c) => { box(c, 6, 16, 14, 10, '#6a3a1e', 3); box(c, 18, 10, 42, 5, '#f2f0e6'); box(c, 18, 15, 42, 5, '#ffb52a'); c.fillStyle = '#ff7a1e'; c.fillRect(30, 11, 8, 8); c.fillRect(46, 11, 6, 8); box(c, 20, 19, 10, 5, '#3a2210'); } },
  roman: { desc: 'Roman Candle - red striped firework tube with fizzing tip', draw: (c) => { box(c, 8, 12, 46, 9, '#c8241e', 4); c.fillStyle = '#ffe14a'; for (let x = 14; x < 50; x += 8) c.fillRect(x, 12, 3, 9); box(c, 14, 19, 6, 9, '#6a3a1e'); circle(c, 57, 16, 5, 'rgba(255,200,80,0.6)'); circle(c, 57, 16, 2.5, '#fff6c0'); } },
  soaker: { desc: 'Super Soaker - big neon water blaster with tank', draw: (c) => { box(c, 14, 3, 20, 10, '#ffcf3a', 5); box(c, 8, 12, 44, 9, '#4fd84a', 4); box(c, 50, 14, 10, 5, '#ff7a1e'); box(c, 14, 19, 7, 11, '#7a3fb0'); box(c, 30, 19, 12, 5, '#7a3fb0'); c.fillStyle = 'rgba(80,180,255,0.7)'; c.fillRect(17, 6, 14, 5); } },
  balloon: { desc: 'Static Balloon Launcher - pump launcher with charged balloons', draw: (c) => { box(c, 8, 13, 36, 8, '#8a8f99', 3); box(c, 14, 19, 7, 10, '#333'); circle(c, 50, 13, 8, '#4fb3ff'); c.strokeStyle = OL; c.lineWidth = 1.5; c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = 1; c.beginPath(); c.moveTo(46, 10); c.lineTo(50, 14); c.lineTo(47, 16); c.lineTo(52, 20); c.stroke(); } },
  rocket: { desc: 'Bottle Rocket Launcher - cardboard tube with rocket', draw: (c) => { box(c, 6, 10, 44, 12, '#8a6a42', 3); c.fillStyle = '#5a4428'; c.fillRect(10, 10, 3, 12); c.fillRect(40, 10, 3, 12); box(c, 48, 12, 10, 8, '#d83a2a', 4); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(58, 12); c.lineTo(63, 16); c.lineTo(58, 20); c.fill(); box(c, 18, 21, 7, 9, '#3a2a1a'); } },
  laser: { desc: 'Ghost-Buster Flashlight - chrome flashlight that fires light beams', draw: (c) => { box(c, 8, 12, 34, 9, '#9aa3ad', 3); box(c, 40, 9, 14, 15, '#c8d0d8', 3); circle(c, 55, 16.5, 7, 'rgba(220,240,255,0.5)'); c.fillStyle = '#eaf6ff'; c.fillRect(53, 10, 3, 13); box(c, 14, 19, 6, 9, '#444'); c.fillStyle = '#e33'; c.fillRect(24, 10, 4, 3); } },
  slingshot: { desc: 'Wrist Slingshot - wooden Y with rubber band', draw: (c) => { c.strokeStyle = OL; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(16, 28); c.lineTo(28, 16); c.moveTo(28, 16); c.lineTo(44, 6); c.moveTo(28, 16); c.lineTo(46, 24); c.stroke(); c.strokeStyle = '#a0682e'; c.lineWidth = 3.5; c.stroke(); c.strokeStyle = '#e04a4a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(44, 6); c.lineTo(54, 15); c.lineTo(46, 24); c.stroke(); circle(c, 54, 15, 3, '#ccc'); } },
};

export function weaponIcon(id: string): Img {
  const d = ICONS[id];
  return asset({ key: `icon_${id}`, file: `icons/icon_${id}.png`, category: 'icon', w: 64, h: 32, anchor: [16, 20], desc: d.desc, prompt: `${ICON_STYLE} ${d.desc}.` }, () => {
    const { c, ctx } = makeCanvas(64, 32);
    d.draw(ctx);
    return c;
  });
}

const PICK: Record<string, { desc: string; draw: (ctx: CanvasRenderingContext2D) => void }> = {
  xp1: { desc: 'Small wrapped candy (XP)', draw: (c) => wrapped(c, '#4fb3ff', 6) },
  xp2: { desc: 'Medium wrapped candy (XP)', draw: (c) => wrapped(c, '#7dff5a', 7.5) },
  xp3: { desc: 'Big gold candy (XP)', draw: (c) => wrapped(c, '#ffcf3a', 9) },
  coin: { desc: 'Gold coin', draw: (c) => { ellipse(c, 16, 16, 8, 8, '#8a6a10'); ellipse(c, 15, 15, 7, 7, '#ffd23a'); ellipse(c, 14, 14, 3, 4, '#fff2a0'); c.fillStyle = '#b8901a'; c.font = 'bold 8px sans-serif'; c.fillText('¢', 13, 19); } },
  heal: { desc: 'Full-size chocolate bar (heal)', draw: (c) => { c.save(); c.translate(16, 16); c.rotate(-0.3); box(c, -11, -6, 22, 12, '#5a2e14', 2); c.fillStyle = '#e8352a'; c.fillRect(-11, -6, 9, 12); c.fillStyle = '#fff'; c.fillRect(-9, -2, 5, 2); c.restore(); } },
  chest: { desc: 'Treat bag loot chest (paper sack with jack-o-lantern face)', draw: (c) => { c.beginPath(); c.moveTo(5, 30); c.lineTo(27, 30); c.lineTo(25, 6); c.lineTo(7, 6); c.closePath(); c.fillStyle = '#c99a5a'; c.fill(); c.strokeStyle = OL; c.lineWidth = 1.5; c.stroke(); c.fillStyle = '#a87a3a'; c.fillRect(7, 6, 18, 4); c.fillStyle = '#1a0f08'; c.beginPath(); c.moveTo(10, 15); c.lineTo(14, 19); c.lineTo(9, 19); c.fill(); c.beginPath(); c.moveTo(22, 15); c.lineTo(18, 19); c.lineTo(23, 19); c.fill(); c.fillRect(10, 22, 12, 3); } },
};

function wrapped(c: CanvasRenderingContext2D, col: string, s: number) {
  c.fillStyle = col;
  c.strokeStyle = OL;
  c.lineWidth = 1.2;
  c.beginPath(); c.moveTo(16 - s, 16); c.lineTo(16 - s * 1.9, 16 - s * 0.6); c.lineTo(16 - s * 1.9, 16 + s * 0.6); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(16 + s, 16); c.lineTo(16 + s * 1.9, 16 - s * 0.6); c.lineTo(16 + s * 1.9, 16 + s * 0.6); c.closePath(); c.fill(); c.stroke();
  ellipse(c, 16, 16, s, s * 0.75, col);
  c.beginPath(); c.ellipse(16, 16, s, s * 0.75, 0, 0, Math.PI * 2); c.stroke();
  ellipse(c, 14, 14, s * 0.4, s * 0.25, 'rgba(255,255,255,0.7)');
}

export function pickupIcon(kind: string): Img {
  const d = PICK[kind];
  return asset({ key: `pickup_${kind}`, file: `icons/pickup_${kind}.png`, category: 'icon', w: 32, h: 32, anchor: [16, 28], desc: d.desc, prompt: `${ICON_STYLE.replace('64x32 px', '32x32 px').replace('pointing RIGHT, ', '')} ${d.desc}.` }, () => {
    const { c, ctx } = makeCanvas(32, 32);
    d.draw(ctx);
    return c;
  });
}

const glowCache = new Map<string, HTMLCanvasElement>();
export function glow(color: string, size = 64) {
  const k = color + size;
  let g = glowCache.get(k);
  if (!g) {
    g = radialGlow(size, color, 1);
    glowCache.set(k, g);
  }
  return g;
}

/** soft white light mask used by the lighting pass */
let lightMask: HTMLCanvasElement | null = null;
export function lightSprite() {
  if (!lightMask) {
    const { c, ctx } = makeCanvas(256, 256);
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    // solid core: inside a light's radius the night is fully cut away, only the rim fades back to dark
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.55, 'rgba(255,255,255,1)');
    g.addColorStop(0.8, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    lightMask = c;
  }
  return lightMask;
}

export const WEAPON_ICON_IDS = Object.keys(ICONS);
export const PICKUP_IDS = Object.keys(PICK);
