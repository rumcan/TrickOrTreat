import { makeCanvas, radialGlow, ellipse, circle } from './draw';
import { asset, sheetAsset, Img } from '../assets';

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

for (const [id, desc, color] of [
  ['gloom', 'Gloom Drum: purple homemade toy blaster with a round spectral drum magazine', '#87618e'],
  ['marshmallow', 'Marshmallow Mortar: cream cardboard tube launcher with a fluffy marshmallow at its mouth', '#dccaa8'],
  ['bubblegum', 'Bubblegum Rail: pink toy railgun with a transparent bubblegum energy reservoir', '#b65f85'],
  ['acorn', 'Acorn Repeater: wooden toy repeater with an acorn hopper and green barrel', '#829150'],
]) ICONS[id] = { desc, draw: c => { box(c, 12, 18, 8, 11, '#503929'); box(c, 8, 9, 38, 13, color, 4); box(c, 44, 13, 15, 6, '#473c45'); circle(c, 30, 20, 8, color); } };

Object.assign(ICONS, {
  stream: { desc: 'Spectre Stream - black and brass particle thrower wand with a crackling orange tip', draw: (c) => { box(c, 13, 18, 7, 11, '#2a2a30'); box(c, 8, 11, 30, 9, '#34343c', 3); c.fillStyle = '#c9a04a'; for (let x = 24; x < 46; x += 5) c.fillRect(x, 12, 2, 7); box(c, 36, 13, 16, 5, '#8a6a2a'); circle(c, 56, 15.5, 5, 'rgba(255,154,58,0.6)'); circle(c, 56, 15.5, 2.5, '#fff0c8'); } },
  disc: { desc: 'Grid Disc - glowing cyan light disc in a black throwing grip', draw: (c) => { box(c, 12, 16, 8, 12, '#1c2430'); circle(c, 36, 15, 13, '#0a2a3a'); c.strokeStyle = OL; c.lineWidth = 1.5; c.stroke(); c.strokeStyle = '#21d0ff'; c.lineWidth = 2.5; c.beginPath(); c.arc(36, 15, 10, 0, Math.PI * 2); c.stroke(); c.lineWidth = 1; c.beginPath(); c.arc(36, 15, 5, 0, Math.PI * 2); c.stroke(); circle(c, 36, 15, 2, '#d8f8ff'); } },
  sabre: { desc: 'Thunder Sabre - heroic sword with a golden winged crossguard and a lightning blade', draw: (c) => { box(c, 6, 14, 12, 5, '#5a3418'); box(c, 16, 8, 5, 17, '#ffcf3a', 2); circle(c, 18.5, 16.5, 2.2, '#e8352a'); c.beginPath(); c.moveTo(21, 12); c.lineTo(56, 13); c.lineTo(62, 16.5); c.lineTo(56, 20); c.lineTo(21, 21); c.closePath(); c.fillStyle = '#eef4ff'; c.fill(); c.strokeStyle = OL; c.lineWidth = 1.5; c.stroke(); c.strokeStyle = '#ffe14a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(24, 17); c.lineTo(33, 14); c.lineTo(40, 19); c.lineTo(50, 15); c.stroke(); } },
  glaive: { desc: 'Star Glaive - five-bladed golden throwing star', draw: (c) => { box(c, 10, 15, 14, 5, '#5a3418'); c.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 5 : 14, a = (k / 10) * Math.PI * 2 - Math.PI / 2; c.lineTo(40 + Math.cos(a) * r, 16 + Math.sin(a) * r); } c.closePath(); c.fillStyle = '#f1d8a0'; c.fill(); c.strokeStyle = OL; c.lineWidth = 1.5; c.stroke(); circle(c, 40, 16, 3, '#e8352a'); } },
  swarm: { desc: 'Micro-Missile Pod - boxy olive shoulder pod with a grid of launch tubes', draw: (c) => { box(c, 16, 20, 7, 10, '#2a2e22'); box(c, 8, 6, 40, 16, '#6a7a42', 3); box(c, 46, 6, 12, 16, '#4a5630', 2); for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { circle(c, 50 + x * 5, 11 + y * 6, 2, '#1a1a14'); circle(c, 50 + x * 5, 11 + y * 6, 1, '#e8352a'); } c.fillStyle = '#ffcf3a'; c.fillRect(12, 9, 10, 2); } },
  singularity: { desc: 'Event Horizon - gunmetal cannon holding a small black hole in bone-white claws', draw: (c) => { box(c, 14, 19, 7, 10, '#26222e'); box(c, 6, 10, 34, 11, '#3a3644', 3); circle(c, 48, 15.5, 9, 'rgba(180,77,255,0.55)'); circle(c, 48, 15.5, 5.5, '#08040c'); c.strokeStyle = '#e8e2d0'; c.lineWidth = 2; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(38, 15.5 + s * 5); c.quadraticCurveTo(46, 15.5 + s * 13, 57, 15.5 + s * 5); c.stroke(); } } },
  annihilator: { desc: 'Annihilator - huge steel shoulder rocket cannon with hazard stripes', draw: (c) => { box(c, 20, 21, 7, 9, '#2a2a2a'); box(c, 2, 7, 52, 14, '#6a7078', 3); box(c, 52, 5, 10, 18, '#4a4e56', 2); c.fillStyle = '#ffcf3a'; for (let x = 8; x < 22; x += 6) { c.beginPath(); c.moveTo(x, 8); c.lineTo(x + 3, 8); c.lineTo(x, 20); c.lineTo(x - 3, 20); c.fill(); } circle(c, 36, 20, 6, '#3a3e46'); circle(c, 36, 20, 2.5, '#ff5a14'); circle(c, 60, 14, 3, '#ff8a1e'); } },
  incinerator: { desc: "Dragon's Breath - industrial flamethrower with twin tanks and a pilot flame", draw: (c) => { box(c, 6, 3, 9, 14, '#c8241e', 4); box(c, 15, 3, 9, 14, '#d8582a', 4); box(c, 16, 19, 7, 10, '#2a2a2a'); box(c, 8, 12, 36, 8, '#5a5e66', 3); box(c, 42, 13, 16, 6, '#2e2a28'); circle(c, 60, 16, 3.5, 'rgba(90,170,255,0.8)'); circle(c, 60, 16, 1.5, '#e8f6ff'); } },
  lance: { desc: 'Phase Lance - long bone-white alien rifle with a split barrel and a green bolt', draw: (c) => { box(c, 12, 18, 6, 10, '#3a4a30'); box(c, 4, 12, 26, 7, '#e8e2d0', 3); box(c, 28, 10, 32, 3, '#e8e2d0', 1); box(c, 28, 18, 32, 3, '#e8e2d0', 1); circle(c, 44, 15.5, 4, 'rgba(124,255,100,0.6)'); c.fillStyle = '#c8ffb8'; c.fillRect(34, 14.5, 22, 2); } },
  cryo: { desc: 'Cryo Ray - chrome and ice-blue freeze ray with a coolant canister', draw: (c) => { box(c, 14, 19, 7, 10, '#3a4656'); box(c, 8, 11, 32, 9, '#c8d6e2', 4); box(c, 20, 3, 12, 9, '#5ac8ff', 4); c.fillStyle = 'rgba(255,255,255,0.6)'; c.fillRect(22, 5, 3, 5); box(c, 38, 13, 16, 5, '#8fa6ba'); c.fillStyle = '#d8f6ff'; for (let x = 40; x < 54; x += 4) c.fillRect(x, 9, 2, 4); circle(c, 57, 15.5, 4, 'rgba(159,232,255,0.7)'); } },
} satisfies Record<string, { desc: string; draw: (ctx: CanvasRenderingContext2D) => void }>);

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

// ---- demolition effects: 8-frame strips, drawn additively (black is transparent) ----
export const FX_FRAMES = 8, FX_SIZE = 128;
export interface FxSheet { img: Img; /** image pixels per frame */ cell: number }
const fxSheets: Record<string, FxSheet> = {};
function fxSheet(key: string, desc: string, draw: (ctx: CanvasRenderingContext2D, f: number) => void): FxSheet {
  return (fxSheets[key] ??= (() => {
    const e = sheetAsset({ key, file: `fx/${key}.webp`, category: 'sheet', w: FX_SIZE * FX_FRAMES, h: FX_SIZE, frameW: FX_SIZE, frameH: FX_SIZE, frames: FX_FRAMES, rows: ['play'], anchor: [FX_SIZE / 2, FX_SIZE / 2], desc, prompt: `${desc}. 8 frames left to right on pure black, each frame ${FX_SIZE}x${FX_SIZE} px.` }, () => {
      const { c, ctx } = makeCanvas(FX_SIZE * FX_FRAMES, FX_SIZE);
      for (let f = 0; f < FX_FRAMES; f++) { ctx.save(); ctx.translate(f * FX_SIZE, 0); ctx.beginPath(); ctx.rect(0, 0, FX_SIZE, FX_SIZE); ctx.clip(); draw(ctx, f); ctx.restore(); }
      return c;
    });
    return { img: e.img, cell: FX_SIZE * e.scale };
  })());
}
const blob = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, col: string, a: number) => { ctx.globalAlpha = a; ctx.drawImage(radialGlow(64, col, 1), x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1; };
/** a fireball that swells, breaks up and leaves smoke */
export const explosionSheet = () => fxSheet('fx_explosion', 'Explosion animation: flash, growing fireball, break-up, smoke', (ctx, f) => {
  const t = f / (FX_FRAMES - 1), R = 14 + 46 * Math.sin(Math.min(1, t * 1.5) * Math.PI / 2), heat = Math.max(0, 1 - t * 1.35);
  for (let k = 0; k < 9; k++) {
    const a = k * 2.4 + f * 0.35, d = R * (0.15 + 0.55 * ((k * 37) % 10) / 10) * (0.6 + t);
    blob(ctx, 64 + Math.cos(a) * d, 64 + Math.sin(a) * d * 0.9 - t * 10, R * (0.75 - k * 0.04), k % 3 ? '#ff7a1a' : '#ffd23a', heat * 0.9);
    blob(ctx, 64 + Math.cos(a + 1) * d * 1.1, 58 + Math.sin(a + 1) * d - t * 22, R * 0.6, '#5a4a44', Math.min(1, t * 1.6) * (1 - t) * 1.4);
  }
  blob(ctx, 64, 64, R * 0.9, '#fff6d0', Math.max(0, 1 - t * 2.4));
});
/** a flame that flickers on the spot: base at the bottom centre of the frame */
export const flameSheet = () => fxSheet('fx_fire', 'Looping flame, base at the bottom centre', (ctx, f) => {
  for (let k = 0; k < 7; k++) {
    const up = k / 6, sway = Math.sin(f * 0.8 + k * 1.3) * (4 + up * 9);
    blob(ctx, 64 + sway, 112 - up * 78, 30 - up * 17 + Math.sin(f * 1.7 + k) * 3, up < 0.35 ? '#ffd23a' : up < 0.7 ? '#ff8a1e' : '#e8421a', 0.85 - up * 0.3);
  }
  blob(ctx, 64, 108, 20, '#fff6d0', 0.7);
});

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

export const TREAT_ICON_IDS = ['walkie', 'firstaid', 'friendship'];
export function treatIcon(id: string): Img {
  const descriptions: Record<string, string> = { walkie: 'A worn teal toy walkie-talkie with a short antenna and amber indicator', firstaid: 'A small cream pocket first-aid pouch with a muted red cloth cross', friendship: 'Two handmade woven friendship bracelets, dusty pink and teal, looped together' };
  return asset({ key: `treat_${id}`, file: `icons/treat_${id}.png`, category: 'icon', w: 48, h: 48, anchor: [24, 24], desc: descriptions[id], prompt: `Single hand-painted Halloween ARPG inventory icon, transparent background, no lettering, no cast shadow. ${descriptions[id]}. Centered inside 48x48 pixels with a clear readable silhouette and 4px safe margins.` }, () => {
    const { c, ctx } = makeCanvas(48, 48);
    if (id === 'walkie') { box(ctx, 13, 15, 22, 28, '#397b78', 4); box(ctx, 15, 4, 4, 14, '#30313c'); }
    else if (id === 'firstaid') { box(ctx, 6, 13, 36, 28, '#e2ceb0', 5); ctx.fillStyle = '#ad514e'; ctx.fillRect(20, 19, 8, 16); ctx.fillRect(16, 23, 16, 8); }
    else { ctx.strokeStyle = '#ad7b9c'; ctx.lineWidth = 7; ctx.beginPath(); ctx.ellipse(19, 24, 12, 15, 0.2, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = '#548c85'; ctx.beginPath(); ctx.ellipse(30, 24, 10, 13, -0.2, 0, Math.PI * 2); ctx.stroke(); }
    return c;
  });
}
export const WEAPON_ICON_IDS = Object.keys(ICONS);
export const PICKUP_IDS = Object.keys(PICK);
