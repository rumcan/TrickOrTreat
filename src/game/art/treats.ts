// ===== Treat card art =====
// The treats are what the kids IMAGINE they've got: 80s/90s movie and cartoon power-ups. Every treat gets a small
// retro card illustration (synthwave sunset, neon skyline, VHS static, starfield, moonlit woods or fire, with a
// bold neon motif in front). Registered in the Atlas with a prompt, so the image generator can replace each one.
import { makeCanvas } from './draw';
import { asset, Img } from '../assets';

export const TREAT_ART_W = 240, TREAT_ART_H = 136;
type Bg = 'sunset' | 'neon' | 'vhs' | 'space' | 'woods' | 'fire';
interface ArtSpec { bg: Bg; motif: string; c: string; c2?: string; prompt: string }

/** id → background, motif, neon colours and the image-generator prompt (the homage, without trademarks) */
const SPECS: Record<string, ArtSpec> = {
  sugar: { bg: 'neon', motif: 'dpad', c: '#21d0ff', c2: '#ff2ea6', prompt: 'a glowing arcade d-pad with UP UP DOWN DOWN arrows lighting in sequence, cheat-code energy' },
  king: { bg: 'space', motif: 'sword', c: '#ffe14a', c2: '#b44dff', prompt: 'a broad barbarian sword raised to the sky crackling with lightning, a fantasy-cartoon power moment' },
  sour: { bg: 'fire', motif: 'tiger', c: '#ffb43c', prompt: 'a fierce tiger eye and a red boxing glove, underdog boxing-movie montage energy' },
  jaw: { bg: 'sunset', motif: 'crane', c: '#ff7a1a', prompt: 'a karate kid silhouette in a one-legged crane kick pose on a wooden post against a beach sunset' },
  bag: { bg: 'vhs', motif: 'pack', c: '#7cff64', c2: '#ffb43c', prompt: 'a bulky homemade nuclear-accelerator backpack with a wand and glowing tubes, ghost-hunter style' },
  sticky: { bg: 'sunset', motif: 'mullet', c: '#ff7ad9', c2: '#c8ccd8', prompt: 'a heroic mullet haircut silhouette with a roll of duct tape and a paperclip, resourceful 80s TV agent' },
  shoes: { bg: 'neon', motif: 'sneaker', c: '#21d0ff', c2: '#ff2ea6', prompt: 'a futuristic self-lacing high-top sneaker with glowing laces, 2015-as-seen-from-1989' },
  pad: { bg: 'vhs', motif: 'visor', c: '#c8ccd8', c2: '#21d0ff', prompt: 'a chrome cyborg police helmet with a glowing visor slit, armour plating' },
  lasagna: { bg: 'sunset', motif: 'eggs', c: '#fff3c4', c2: '#ffb43c', prompt: 'a tall glass of raw eggs at dawn before a run up the museum steps, boxing training breakfast' },
  magnet: { bg: 'space', motif: 'ufo', c: '#7cff64', c2: '#c8ccd8', prompt: 'a classic flying saucer beaming candy up in a cone of green light' },
  cane: { bg: 'space', motif: 'saber', c: '#21d0ff', prompt: 'a glowing laser sword ignited in the dark, space-opera hero' },
  bouncy: { bg: 'neon', motif: 'pinball', c: '#ff2ea6', c2: '#ffe14a', prompt: 'a silver pinball bouncing off neon bumpers, arcade wizard' },
  bubble: { bg: 'neon', motif: 'joysticks', c: '#ff2ea6', c2: '#21d0ff', prompt: 'two arcade joysticks side by side, PLAYER 2 INSERT COIN, co-op' },
  fireball: { bg: 'fire', motif: 'eyes', c: '#ffb43c', prompt: 'a pair of eyes glowing with fire, a psychic girl starting fires with a stare' },
  pop: { bg: 'vhs', motif: 'robot', c: '#7fd8ff', c2: '#ffe14a', prompt: 'a cute tank-tread robot head throwing sparks after a lightning strike, malfunction' },
  gummy: { bg: 'vhs', motif: 'slime', c: '#7cff64', prompt: 'a big splash of glowing green slime dripping down, getting slimed' },
  pepper: { bg: 'fire', motif: 'flamethrower', c: '#ff7a1a', prompt: 'a chunky sci-fi marine flamethrower spitting fire in a dark alien hive' },
  sweater: { bg: 'space', motif: 'bolt', c: '#ffe14a', c2: '#7fd8ff', prompt: 'a lightning bolt striking a town clock tower at exactly 10:04, 1.21 jigawatts' },
  taffy: { bg: 'woods', motif: 'canister', c: '#7cff64', prompt: 'a dented canister leaking glowing green ooze in a sewer, mutagen' },
  fangs: { bg: 'woods', motif: 'fangs', c: '#ff4d6d', c2: '#fff3c4', prompt: 'a grinning pair of vampire fangs under a boardwalk moon, teen vampire gang' },
  trick: { bg: 'sunset', motif: 'lunchbox', c: '#ff4d6d', c2: '#ffe14a', prompt: 'a metal school lunchbox with a thermos, packed by mom, 80s cartoon print' },
  energy: { bg: 'vhs', motif: 'vhs', c: '#ff7ad9', prompt: 'a VHS tape with a fast-forward ▶▶ symbol, training montage' },
  orbit: { bg: 'space', motif: 'glaive', c: '#ffe14a', c2: '#ff7a1a', prompt: 'a five-bladed throwing star glaive spinning through space, fantasy quest' },
  buddy: { bg: 'woods', motif: 'ghost', c: '#dfe8ff', c2: '#7cff64', prompt: 'a small friendly cartoon ghost waving, glowing softly' },
  glass: { bg: 'woods', motif: 'katanas', c: '#c8ccd8', c2: '#21d0ff', prompt: 'two crossed katanas with lightning between them on a misty highland hill, there can be only one' },
  clover: { bg: 'sunset', motif: 'map', c: '#ffe14a', c2: '#ff7a1a', prompt: 'a weathered pirate treasure map with an X and a skull, kids adventure' },
  firesneak: { bg: 'neon', motif: 'trails', c: '#ff7a1a', c2: '#21d0ff', prompt: 'twin fire trails burning on asphalt left by a time machine car at 88 mph' },
  helmet: { bg: 'woods', motif: 'shell', c: '#5fd84a', c2: '#ffb43c', prompt: 'a green turtle shell with a coloured bandana, sewer heroes' },
  piggy: { bg: 'neon', motif: 'briefcase', c: '#ffe14a', c2: '#7cff64', prompt: 'an open briefcase overflowing with cash, Wall Street greed' },
  homework: { bg: 'sunset', motif: 'wax', c: '#fff3c4', c2: '#ffb43c', prompt: 'a hand with a sponge making circles on a shiny car, wax on wax off' },
  bang: { bg: 'fire', motif: 'boom', c: '#ffe14a', prompt: 'a skyscraper floor exploding at Christmas, action-movie explosion' },
  jackpot: { bg: 'neon', motif: 'cabinet', c: '#21d0ff', c2: '#ff2ea6', prompt: 'a glowing arcade cabinet with a HIGH SCORE table' },
  bluff: { bg: 'sunset', motif: 'aviators', c: '#ffb43c', c2: '#ff7a1a', prompt: 'mirrored aviator sunglasses reflecting a fighter jet, danger zone' },
  lucky6: { bg: 'fire', motif: 'revolver', c: '#c8ccd8', c2: '#ffb43c', prompt: 'a big six-shot revolver cylinder, feeling lucky' },
  fullbag: { bg: 'vhs', motif: 'trap', c: '#ffe14a', c2: '#7cff64', prompt: 'a smoking ghost trap with its light blinking FULL' },
  skate: { bg: 'neon', motif: 'hoverboard', c: '#ff2ea6', c2: '#21d0ff', prompt: 'a pink hoverboard floating above the street' },
  statue: { bg: 'fire', motif: 'cyborgeye', c: '#ff2a2a', prompt: 'a chrome endoskeleton skull with one glowing red eye, unstoppable' },
  bedtime: { bg: 'woods', motif: 'claw', c: '#c8ccd8', c2: '#ff4d6d', prompt: 'a bladed glove clawing out of a dream, a striped sweater, nightmare at bedtime' },
  owl: { bg: 'woods', motif: 'thermal', c: '#ff7a1a', c2: '#ffe14a', prompt: 'a jungle scene in thermal-vision colours with a hunter’s three red laser dots' },
  cursed: { bg: 'woods', motif: 'gremlin', c: '#7cff64', c2: '#ff4d6d', prompt: 'big ears and glowing eyes peeking out at a clock striking midnight, never feed after midnight' },
  walkie: { bg: 'woods', motif: 'walkie', c: '#2ec4b0', c2: '#ffb43c', prompt: 'a chunky kids walkie-talkie crackling at night, never say die' },
  firstaid: { bg: 'woods', motif: 'firstaid', c: '#ff4d6d', c2: '#fff3c4', prompt: 'a scout first-aid kit by the railway tracks at dusk, four friends on a long walk' },
  friendship: { bg: 'sunset', motif: 'bracelets', c: '#ff7ad9', c2: '#2ec4b0', prompt: 'two woven friendship bracelets, a BMX gang pact' },
};
export const TREAT_ART_IDS = Object.keys(SPECS);

const OL = '#0b0710';

function background(ctx: CanvasRenderingContext2D, bg: Bg, W: number, H: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  const pal: Record<Bg, string[]> = {
    sunset: ['#1a0b2e', '#6a1b5a', '#ff6a3d'], neon: ['#06061a', '#1d0b3a', '#3a0f5c'], vhs: ['#0b1a1f', '#10303a', '#0b1a1f'],
    space: ['#05030f', '#160a2e', '#2a0f45'], woods: ['#060c14', '#0d1d2a', '#14283a'], fire: ['#1a0505', '#5a1208', '#c2410c'],
  };
  pal[bg].forEach((c, i) => sky.addColorStop(i / 2, c));
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  if (bg === 'sunset' || bg === 'neon') {
    // striped sun + perspective grid
    const sy = H * 0.62;
    if (bg === 'sunset') {
      const sg = ctx.createLinearGradient(0, sy - 46, 0, sy);
      sg.addColorStop(0, '#ffe14a'); sg.addColorStop(1, '#ff2ea6');
      ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(W / 2, sy, 46, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#6a1b5a';
      for (let k = 0; k < 5; k++) ctx.fillRect(W / 2 - 50, sy - 6 - k * 8, 100, 2 + k * 0.6);
    } else {
      // skyline
      ctx.fillStyle = '#0a0620';
      for (let i = 0; i < 12; i++) { const w = 14 + ((i * 37) % 16), h = 24 + ((i * 53) % 40); ctx.fillRect(i * 21 - 4, sy - h, w, h); }
      ctx.fillStyle = '#ff2ea6';
      for (let i = 0; i < 30; i++) ctx.fillRect((i * 47) % W, sy - 10 - ((i * 29) % 50), 2, 2);
    }
    ctx.fillStyle = bg === 'sunset' ? '#2a0b3a' : '#0d0420';
    ctx.fillRect(0, sy, W, H - sy);
    ctx.strokeStyle = bg === 'sunset' ? '#ff2ea6' : '#21d0ff'; ctx.lineWidth = 1; ctx.globalAlpha = 0.6;
    for (let i = 0; i < 7; i++) { const y = sy + Math.pow(i / 6, 1.8) * (H - sy); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    for (let i = -8; i <= 8; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + i * 6, sy); ctx.lineTo(W / 2 + i * 40, H); ctx.stroke(); }
    ctx.globalAlpha = 1;
  } else if (bg === 'space') {
    for (let i = 0; i < 70; i++) { ctx.fillStyle = i % 7 ? '#c9b8ff' : '#ffe14a'; const s = i % 9 ? 1 : 2; ctx.fillRect((i * 97) % W, (i * 61) % H, s, s); }
    const pg = ctx.createRadialGradient(W * 0.82, H * 0.2, 2, W * 0.82, H * 0.2, 30);
    pg.addColorStop(0, '#b44dff'); pg.addColorStop(1, 'rgba(180,77,255,0)');
    ctx.fillStyle = pg; ctx.fillRect(0, 0, W, H);
  } else if (bg === 'woods') {
    ctx.fillStyle = '#f2ead0'; ctx.beginPath(); ctx.arc(W * 0.8, H * 0.24, 15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(242,234,208,0.15)'; ctx.beginPath(); ctx.arc(W * 0.8, H * 0.24, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#050a10';
    for (let i = 0; i < 14; i++) { const x = i * 19 - 6, h = 34 + ((i * 41) % 30); ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x + 10, H - h); ctx.lineTo(x + 20, H); ctx.fill(); }
  } else if (bg === 'fire') {
    for (let i = 0; i < 18; i++) {
      const x = (i * 53) % W, h = 20 + ((i * 31) % 40);
      const fg = ctx.createLinearGradient(0, H - h, 0, H);
      fg.addColorStop(0, 'rgba(255,180,60,0)'); fg.addColorStop(1, 'rgba(255,120,30,0.5)');
      ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(x - 12, H); ctx.quadraticCurveTo(x, H - h * 1.4, x + 12, H); ctx.fill();
    }
  } else {
    // VHS static
    for (let i = 0; i < 900; i++) { ctx.fillStyle = `rgba(200,240,255,${((i * 13) % 10) / 90})`; ctx.fillRect((i * 151) % W, (i * 37) % H, 2, 1); }
    ctx.fillStyle = 'rgba(33,208,255,0.12)'; ctx.fillRect(0, H * 0.55, W, 6);
  }
  // scanlines over everything
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
}

/** neon outline + glow helpers */
function neon(ctx: CanvasRenderingContext2D, color: string, blur = 12) { ctx.shadowColor = color; ctx.shadowBlur = blur; }
function plain(ctx: CanvasRenderingContext2D) { ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; }
function shape(ctx: CanvasRenderingContext2D, fill: string, draw: () => void, glow?: string, lw = 3) {
  ctx.beginPath(); draw();
  if (glow) neon(ctx, glow, 14);
  ctx.fillStyle = fill; ctx.fill(); plain(ctx);
  ctx.strokeStyle = OL; ctx.lineWidth = lw; ctx.stroke();
}
function bolt(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  neon(ctx, color, 10); ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 6 * s, y + 14 * s); ctx.lineTo(x - 1 * s, y + 14 * s); ctx.lineTo(x - 5 * s, y + 28 * s); ctx.lineTo(x + 7 * s, y + 10 * s); ctx.lineTo(x + 2 * s, y + 10 * s); ctx.lineTo(x + 6 * s, y); ctx.closePath(); ctx.fill(); plain(ctx);
}

function motif(ctx: CanvasRenderingContext2D, m: string, c: string, c2: string, W: number, H: number) {
  const cx = W / 2, cy = H / 2 + 4;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  switch (m) {
    case 'dpad': {
      shape(ctx, '#1a1426', () => { ctx.rect(cx - 14, cy - 42, 28, 84); ctx.rect(cx - 42, cy - 14, 84, 28); }, c);
      const arrow = (dx: number, dy: number, on: boolean) => { ctx.save(); ctx.translate(cx + dx * 28, cy + dy * 28); ctx.rotate(Math.atan2(dy, dx)); if (on) neon(ctx, c2, 12); ctx.fillStyle = on ? c2 : '#4a3d5e'; ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-6, -8); ctx.lineTo(-6, 8); ctx.fill(); plain(ctx); ctx.restore(); };
      arrow(0, -1, true); arrow(0, 1, true); arrow(-1, 0, false); arrow(1, 0, false);
      break;
    }
    case 'sword':
      bolt(ctx, cx - 44, 10, 1.4, c2); bolt(ctx, cx + 52, 14, 1.2, c2);
      shape(ctx, '#e8ecf4', () => { ctx.moveTo(cx, 8); ctx.lineTo(cx + 9, 26); ctx.lineTo(cx + 7, 86); ctx.lineTo(cx - 7, 86); ctx.lineTo(cx - 9, 26); ctx.closePath(); }, c);
      shape(ctx, c, () => { ctx.rect(cx - 30, 86, 60, 9); });
      shape(ctx, '#7a4a20', () => { ctx.rect(cx - 6, 95, 12, 26); });
      shape(ctx, c, () => { ctx.arc(cx, 124, 7, 0, Math.PI * 2); });
      break;
    case 'tiger':
      shape(ctx, '#ffb43c', () => { ctx.ellipse(cx - 34, cy - 6, 40, 24, 0, 0, Math.PI * 2); }, c);
      shape(ctx, '#1a0a05', () => { ctx.ellipse(cx - 34, cy - 6, 8, 20, 0, 0, Math.PI * 2); });
      ctx.strokeStyle = OL; ctx.lineWidth = 4; for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx - 34 + k * 30, cy - 34); ctx.lineTo(cx - 34 + k * 18, cy - 24); ctx.stroke(); }
      shape(ctx, '#d62a2a', () => { ctx.ellipse(cx + 46, cy + 8, 30, 34, -0.3, 0, Math.PI * 2); }, '#ff4d6d');
      shape(ctx, '#f4f0e2', () => { ctx.rect(cx + 30, cy + 34, 30, 14); });
      break;
    case 'crane':
      shape(ctx, '#3a2010', () => { ctx.rect(cx - 6, cy + 18, 12, 60); });
      ctx.strokeStyle = OL; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.moveTo(cx, cy + 18); ctx.lineTo(cx, cy - 22); ctx.moveTo(cx, cy - 6); ctx.lineTo(cx - 34, cy - 30); ctx.moveTo(cx, cy - 6); ctx.lineTo(cx + 34, cy - 30); ctx.moveTo(cx, cy + 4); ctx.lineTo(cx + 26, cy - 4); ctx.lineTo(cx + 18, cy + 14); ctx.stroke();
      ctx.fillStyle = OL; ctx.beginPath(); ctx.arc(cx, cy - 32, 10, 0, Math.PI * 2); ctx.fill();
      neon(ctx, c, 8); ctx.fillStyle = c; ctx.fillRect(cx - 11, cy - 36, 22, 3); plain(ctx);
      break;
    case 'pack':
      shape(ctx, '#3a3f48', () => { ctx.roundRect(cx - 30, cy - 40, 60, 80, 6); }, c);
      shape(ctx, '#1a1d22', () => { ctx.rect(cx - 22, cy - 30, 44, 22); });
      for (let i = 0; i < 4; i++) { neon(ctx, i % 2 ? c2 : c, 10); ctx.fillStyle = i % 2 ? c2 : c; ctx.fillRect(cx - 18 + i * 10, cy - 24, 6, 10); } plain(ctx);
      ctx.strokeStyle = '#c8ccd8'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx + 28, cy + 20); ctx.quadraticCurveTo(cx + 60, cy + 30, cx + 66, cy - 6); ctx.stroke();
      shape(ctx, '#5a5f6a', () => { ctx.rect(cx + 58, cy - 34, 14, 30); });
      neon(ctx, c, 16); ctx.fillStyle = c; ctx.fillRect(cx + 62, cy - 52, 6, 18); plain(ctx);
      break;
    case 'mullet':
      shape(ctx, '#3a2414', () => { ctx.moveTo(cx - 30, cy - 10); ctx.quadraticCurveTo(cx - 32, cy - 46, cx, cy - 46); ctx.quadraticCurveTo(cx + 34, cy - 46, cx + 30, cy - 6); ctx.quadraticCurveTo(cx + 36, cy + 30, cx + 18, cy + 46); ctx.lineTo(cx + 4, cy + 20); ctx.closePath(); }, c);
      shape(ctx, '#e0a878', () => { ctx.ellipse(cx - 4, cy - 4, 22, 28, 0, 0, Math.PI * 2); });
      shape(ctx, '#3a2414', () => { ctx.moveTo(cx - 26, cy - 14); ctx.quadraticCurveTo(cx - 6, cy - 40, cx + 22, cy - 16); ctx.quadraticCurveTo(cx, cy - 26, cx - 26, cy - 14); });
      shape(ctx, '#9aa0ac', () => { ctx.arc(cx - 58, cy + 22, 18, 0, Math.PI * 2); ctx.arc(cx - 58, cy + 22, 8, 0, Math.PI * 2, true); }, c2);
      ctx.strokeStyle = c2; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx + 50, cy - 20); ctx.lineTo(cx + 70, cy - 20); ctx.arc(cx + 70, cy - 14, 6, -Math.PI / 2, Math.PI / 2); ctx.lineTo(cx + 54, cy - 8); ctx.stroke();
      break;
    case 'sneaker':
      shape(ctx, '#e8ecf4', () => { ctx.moveTo(cx - 54, cy + 30); ctx.lineTo(cx - 50, cy - 28); ctx.lineTo(cx - 14, cy - 34); ctx.lineTo(cx - 6, cy); ctx.quadraticCurveTo(cx + 40, cy + 2, cx + 58, cy + 22); ctx.lineTo(cx + 58, cy + 34); ctx.lineTo(cx - 54, cy + 34); ctx.closePath(); }, c);
      shape(ctx, '#2a2d34', () => { ctx.rect(cx - 56, cy + 30, 116, 10); });
      for (let i = 0; i < 4; i++) { neon(ctx, i % 2 ? c2 : c, 10); ctx.strokeStyle = i % 2 ? c2 : c; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx - 40 + i * 9, cy - 22 + i * 6); ctx.lineTo(cx - 20 + i * 9, cy - 24 + i * 6); ctx.stroke(); } plain(ctx);
      neon(ctx, c, 14); ctx.fillStyle = c; ctx.fillRect(cx - 54, cy + 40, 116, 3); plain(ctx);
      break;
    case 'visor':
      shape(ctx, '#9aa0ac', () => { ctx.moveTo(cx - 44, cy + 40); ctx.quadraticCurveTo(cx - 50, cy - 44, cx, cy - 46); ctx.quadraticCurveTo(cx + 50, cy - 44, cx + 44, cy + 40); ctx.closePath(); }, c);
      shape(ctx, '#2a2d34', () => { ctx.rect(cx - 40, cy - 12, 80, 18); });
      neon(ctx, c2, 18); ctx.fillStyle = c2; ctx.fillRect(cx - 34, cy - 6, 68, 5); plain(ctx);
      shape(ctx, '#e0a878', () => { ctx.rect(cx - 20, cy + 14, 40, 26); });
      break;
    case 'eggs':
      shape(ctx, 'rgba(220,235,255,0.35)', () => { ctx.moveTo(cx - 24, cy - 44); ctx.lineTo(cx + 24, cy - 44); ctx.lineTo(cx + 18, cy + 44); ctx.lineTo(cx - 18, cy + 44); ctx.closePath(); }, '#ffffff');
      for (let i = 0; i < 5; i++) shape(ctx, c2, () => { ctx.arc(cx - 10 + (i % 3) * 10, cy + 30 - Math.floor(i / 2) * 16, 7, 0, Math.PI * 2); }, c2, 2);
      for (let i = 0; i < 2; i++) shape(ctx, c, () => { ctx.ellipse(cx + 50 + i * 16, cy + 36, 9, 12, 0, 0, Math.PI * 2); });
      break;
    case 'ufo':
      ctx.fillStyle = 'rgba(124,255,100,0.25)'; ctx.beginPath(); ctx.moveTo(cx - 18, cy - 12); ctx.lineTo(cx + 18, cy - 12); ctx.lineTo(cx + 54, H); ctx.lineTo(cx - 54, H); ctx.fill();
      shape(ctx, '#c8ccd8', () => { ctx.ellipse(cx, cy - 18, 60, 16, 0, 0, Math.PI * 2); }, c);
      shape(ctx, 'rgba(124,255,200,0.6)', () => { ctx.ellipse(cx, cy - 30, 24, 16, 0, Math.PI, 0); });
      for (let i = 0; i < 5; i++) { neon(ctx, c, 8); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cx - 40 + i * 20, cy - 16, 3, 0, Math.PI * 2); ctx.fill(); } plain(ctx);
      for (let i = 0; i < 3; i++) shape(ctx, ['#ff4d6d', '#ffe14a', '#21d0ff'][i], () => { ctx.arc(cx - 16 + i * 16, cy + 20 + i * 12, 6, 0, Math.PI * 2); }, undefined, 2);
      break;
    case 'saber':
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.6);
      neon(ctx, c, 26); ctx.fillStyle = '#ffffff'; ctx.fillRect(-4, -78, 8, 96); plain(ctx);
      ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.strokeRect(-4, -78, 8, 96);
      shape(ctx, '#9aa0ac', () => { ctx.rect(-7, 18, 14, 34); }); shape(ctx, '#1a1d22', () => { ctx.rect(-8, 28, 16, 6); });
      ctx.restore();
      break;
    case 'pinball':
      for (const [x, y, col] of [[cx - 50, cy - 20, c], [cx + 46, cy - 26, c2], [cx + 6, cy + 30, c]] as [number, number, string][]) shape(ctx, '#1a1426', () => { ctx.arc(x, y, 18, 0, Math.PI * 2); }, col);
      neon(ctx, '#ffffff', 16); const bg = ctx.createRadialGradient(cx - 6, cy - 10, 2, cx, cy - 4, 18); bg.addColorStop(0, '#ffffff'); bg.addColorStop(1, '#8a90a0');
      ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(cx, cy - 4, 16, 0, Math.PI * 2); ctx.fill(); plain(ctx);
      ctx.strokeStyle = c; ctx.setLineDash([4, 5]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - 32, cy - 14); ctx.lineTo(cx - 14, cy - 6); ctx.moveTo(cx + 16, cy - 10); ctx.lineTo(cx + 30, cy - 20); ctx.stroke(); ctx.setLineDash([]);
      break;
    case 'joysticks':
      for (const [dx, col] of [[-40, c], [40, c2]] as [number, string][]) {
        shape(ctx, '#1a1426', () => { ctx.rect(cx + dx - 30, cy + 18, 60, 24); }, col);
        ctx.strokeStyle = '#c8ccd8'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(cx + dx, cy + 20); ctx.lineTo(cx + dx + (dx < 0 ? -8 : 8), cy - 18); ctx.stroke();
        shape(ctx, col, () => { ctx.arc(cx + dx + (dx < 0 ? -8 : 8), cy - 24, 13, 0, Math.PI * 2); }, col);
      }
      break;
    case 'eyes':
      for (const dx of [-30, 30]) {
        shape(ctx, '#fff3c4', () => { ctx.ellipse(cx + dx, cy, 24, 14, 0, 0, Math.PI * 2); }, c);
        neon(ctx, '#ff4d2a', 16); ctx.fillStyle = '#ff7a1a'; ctx.beginPath(); ctx.arc(cx + dx, cy, 9, 0, Math.PI * 2); ctx.fill(); plain(ctx);
        ctx.fillStyle = OL; ctx.beginPath(); ctx.arc(cx + dx, cy, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,140,40,0.6)'; ctx.beginPath(); ctx.moveTo(cx + dx - 14, cy - 12); ctx.quadraticCurveTo(cx + dx, cy - 50, cx + dx + 14, cy - 12); ctx.fill();
      }
      break;
    case 'robot':
      shape(ctx, '#9aa0ac', () => { ctx.rect(cx - 36, cy - 14, 72, 24); }, c);
      for (const dx of [-18, 18]) { shape(ctx, '#2a2d34', () => { ctx.arc(cx + dx, cy - 2, 13, 0, Math.PI * 2); }); neon(ctx, c, 12); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cx + dx, cy - 2, 5, 0, Math.PI * 2); ctx.fill(); plain(ctx); }
      shape(ctx, '#5a5f6a', () => { ctx.rect(cx - 6, cy + 10, 12, 28); });
      bolt(ctx, cx + 54, cy - 46, 1.1, c2); bolt(ctx, cx - 60, cy - 40, 0.9, c2);
      break;
    case 'slime':
      neon(ctx, c, 20); ctx.fillStyle = c; ctx.beginPath();
      ctx.moveTo(cx - 70, cy - 30); for (let i = 0; i <= 10; i++) { const x = cx - 70 + i * 14; ctx.quadraticCurveTo(x + 7, cy - 44 + (i % 2) * 16, x + 14, cy - 30); }
      ctx.lineTo(cx + 70, cy - 10);
      for (let i = 10; i >= 0; i--) { const x = cx - 70 + i * 14, d = (i * 37) % 30; ctx.lineTo(x + 7, cy - 10 + d); ctx.lineTo(x, cy - 10); }
      ctx.closePath(); ctx.fill(); plain(ctx); ctx.strokeStyle = OL; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.ellipse(cx - 30, cy - 32, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
      break;
    case 'flamethrower':
      shape(ctx, '#3a3f48', () => { ctx.rect(cx - 70, cy, 70, 18); ctx.rect(cx - 50, cy + 18, 14, 22); });
      shape(ctx, '#5a5f6a', () => { ctx.rect(cx - 10, cy + 3, 24, 12); });
      neon(ctx, c, 24);
      for (let i = 0; i < 3; i++) { ctx.fillStyle = ['#ffe14a', '#ffb43c', '#ff5a1a'][i]; ctx.beginPath(); ctx.moveTo(cx + 14, cy + 9); ctx.quadraticCurveTo(cx + 50, cy - 30 + i * 12, cx + 100 - i * 14, cy + 4); ctx.quadraticCurveTo(cx + 50, cy + 40 - i * 10, cx + 14, cy + 9); ctx.fill(); }
      plain(ctx);
      break;
    case 'bolt':
      shape(ctx, '#3a2a40', () => { ctx.rect(cx - 30, cy - 10, 60, 70); ctx.moveTo(cx - 36, cy - 10); ctx.lineTo(cx, cy - 34); ctx.lineTo(cx + 36, cy - 10); });
      shape(ctx, '#fff3c4', () => { ctx.arc(cx, cy + 16, 16, 0, Math.PI * 2); }, c2);
      ctx.strokeStyle = OL; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, cy + 16); ctx.lineTo(cx, cy + 4); ctx.moveTo(cx, cy + 16); ctx.lineTo(cx + 3, cy + 10); ctx.stroke();
      bolt(ctx, cx + 8, 0, 1.6, c);
      break;
    case 'canister':
      shape(ctx, '#5a5f6a', () => { ctx.roundRect(cx - 26, cy - 40, 52, 80, 8); }, c);
      neon(ctx, c, 18); ctx.fillStyle = c; ctx.fillRect(cx - 26, cy - 6, 52, 14); ctx.beginPath(); ctx.moveTo(cx + 20, cy + 40); ctx.quadraticCurveTo(cx + 46, cy + 46, cx + 70, cy + 40); ctx.lineTo(cx + 70, cy + 46); ctx.lineTo(cx + 20, cy + 46); ctx.fill(); plain(ctx);
      ctx.fillStyle = OL; ctx.font = '900 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('☢', cx, cy - 16);
      break;
    case 'fangs':
      shape(ctx, '#5a0f1a', () => { ctx.ellipse(cx, cy, 64, 30, 0, 0, Math.PI); ctx.lineTo(cx - 64, cy); }, c);
      shape(ctx, c2, () => { for (let i = -3; i <= 3; i++) { if (Math.abs(i) === 2) continue; const x = cx + i * 14; ctx.moveTo(x - 6, cy); ctx.lineTo(x, cy + (Math.abs(i) === 1 ? 10 : 8)); ctx.lineTo(x + 6, cy); } ctx.moveTo(cx - 34, cy); ctx.lineTo(cx - 28, cy + 30); ctx.lineTo(cx - 22, cy); ctx.moveTo(cx + 22, cy); ctx.lineTo(cx + 28, cy + 30); ctx.lineTo(cx + 34, cy); }, undefined, 2);
      neon(ctx, c, 10); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cx + 28, cy + 36, 3, 0, Math.PI * 2); ctx.fill(); plain(ctx);
      break;
    case 'lunchbox':
      shape(ctx, c, () => { ctx.roundRect(cx - 50, cy - 26, 80, 60, 6); }, c);
      shape(ctx, '#1a1426', () => { ctx.rect(cx - 42, cy - 18, 64, 34); });
      bolt(ctx, cx - 8, cy - 16, 0.9, c2);
      ctx.strokeStyle = OL; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(cx - 10, cy - 30, 14, Math.PI, 0); ctx.stroke();
      shape(ctx, '#c8ccd8', () => { ctx.roundRect(cx + 38, cy - 34, 22, 68, 6); }, c2);
      break;
    case 'vhs':
      shape(ctx, '#1a1d22', () => { ctx.rect(cx - 70, cy - 36, 140, 72); }, c);
      shape(ctx, '#f4f0e2', () => { ctx.rect(cx - 60, cy - 28, 120, 22); });
      for (const dx of [-30, 30]) shape(ctx, '#3a3f48', () => { ctx.arc(cx + dx, cy + 14, 14, 0, Math.PI * 2); });
      neon(ctx, c, 14); ctx.fillStyle = c;
      for (const dx of [-18, 0]) { ctx.beginPath(); ctx.moveTo(cx + dx - 8, cy - 26); ctx.lineTo(cx + dx + 10, cy - 17); ctx.lineTo(cx + dx - 8, cy - 8); ctx.fill(); }
      plain(ctx);
      break;
    case 'glaive':
      ctx.save(); ctx.translate(cx, cy);
      for (let i = 0; i < 5; i++) { ctx.rotate((Math.PI * 2) / 5); shape(ctx, '#e8ecf4', () => { ctx.moveTo(0, -12); ctx.lineTo(10, -20); ctx.lineTo(4, -56); ctx.lineTo(-6, -18); ctx.closePath(); }, c, 2); }
      shape(ctx, c2, () => { ctx.arc(0, 0, 14, 0, Math.PI * 2); }, c2);
      ctx.restore();
      break;
    case 'ghost':
      shape(ctx, c, () => { ctx.moveTo(cx - 30, cy + 40); ctx.lineTo(cx - 30, cy - 10); ctx.quadraticCurveTo(cx - 30, cy - 46, cx, cy - 46); ctx.quadraticCurveTo(cx + 30, cy - 46, cx + 30, cy - 10); ctx.lineTo(cx + 30, cy + 40); for (let i = 0; i < 4; i++) ctx.quadraticCurveTo(cx + 22 - i * 15, cy + 30, cx + 15 - i * 15, cy + 40); }, c2);
      ctx.fillStyle = OL; for (const dx of [-11, 11]) { ctx.beginPath(); ctx.ellipse(cx + dx, cy - 14, 5, 8, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.beginPath(); ctx.arc(cx, cy + 4, 7, 0, Math.PI); ctx.fill();
      shape(ctx, c, () => { ctx.ellipse(cx + 42, cy - 18, 8, 14, 0.6, 0, Math.PI * 2); });
      break;
    case 'katanas':
      bolt(ctx, cx, 6, 1.1, c2);
      for (const k of [-1, 1]) {
        ctx.save(); ctx.translate(cx, cy + 6); ctx.rotate(k * 0.7);
        neon(ctx, c2, 12); ctx.fillStyle = '#e8ecf4'; ctx.beginPath(); ctx.moveTo(-3, -70); ctx.quadraticCurveTo(6, -40, 4, 30); ctx.lineTo(-4, 30); ctx.closePath(); ctx.fill(); plain(ctx);
        ctx.strokeStyle = OL; ctx.lineWidth = 2; ctx.stroke();
        shape(ctx, '#1a1d22', () => { ctx.rect(-5, 30, 10, 28); }); shape(ctx, c, () => { ctx.ellipse(0, 30, 12, 4, 0, 0, Math.PI * 2); });
        ctx.restore();
      }
      break;
    case 'map':
      shape(ctx, '#e8d0a0', () => { ctx.moveTo(cx - 64, cy - 36); ctx.lineTo(cx + 60, cy - 40); ctx.lineTo(cx + 66, cy + 34); ctx.lineTo(cx - 60, cy + 40); ctx.closePath(); }, c);
      ctx.strokeStyle = '#8a5a2a'; ctx.setLineDash([5, 5]); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(cx - 44, cy + 22); ctx.quadraticCurveTo(cx - 10, cy - 30, cx + 30, cy + 4); ctx.stroke(); ctx.setLineDash([]);
      neon(ctx, c2, 10); ctx.strokeStyle = '#d62a2a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(cx + 22, cy - 4); ctx.lineTo(cx + 38, cy + 12); ctx.moveTo(cx + 38, cy - 4); ctx.lineTo(cx + 22, cy + 12); ctx.stroke(); plain(ctx);
      ctx.fillStyle = '#3a2414'; ctx.font = '900 18px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('☠', cx - 40, cy - 6);
      break;
    case 'trails':
      for (const dy of [-10, 14]) { neon(ctx, c, 18); const fg = ctx.createLinearGradient(0, 0, W, 0); fg.addColorStop(0, 'rgba(255,90,26,0)'); fg.addColorStop(1, '#ffe14a'); ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(0, cy + dy + 12); ctx.lineTo(W - 30, cy + dy); ctx.lineTo(W - 30, cy + dy + 8); ctx.lineTo(0, cy + dy + 22); ctx.fill(); }
      plain(ctx);
      neon(ctx, c2, 16); ctx.fillStyle = c2; ctx.font = '900 30px "Barlow Condensed", sans-serif'; ctx.textAlign = 'right'; ctx.fillText('88', W - 18, 38); plain(ctx);
      break;
    case 'shell':
      shape(ctx, c, () => { ctx.ellipse(cx, cy + 6, 58, 42, 0, 0, Math.PI * 2); }, c);
      ctx.strokeStyle = '#2c6a1a'; ctx.lineWidth = 3;
      ctx.beginPath(); for (const [x, y] of [[0, -16], [-30, 2], [30, 2], [-16, 26], [16, 26]]) { ctx.moveTo(cx + x + 12, cy + y + 6); ctx.arc(cx + x, cy + y + 6, 12, 0, Math.PI * 2); } ctx.stroke();
      shape(ctx, c2, () => { ctx.rect(cx - 58, cy - 40, 116, 12); });
      ctx.strokeStyle = c2; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(cx + 58, cy - 34); ctx.quadraticCurveTo(cx + 80, cy - 30, cx + 84, cy - 10); ctx.stroke();
      break;
    case 'briefcase':
      shape(ctx, '#5a3a20', () => { ctx.rect(cx - 56, cy - 10, 112, 52); }, c);
      shape(ctx, '#3a2414', () => { ctx.moveTo(cx - 56, cy - 10); ctx.lineTo(cx - 48, cy - 40); ctx.lineTo(cx + 48, cy - 40); ctx.lineTo(cx + 56, cy - 10); ctx.closePath(); });
      for (let i = 0; i < 7; i++) shape(ctx, '#5fd84a', () => { ctx.rect(cx - 48 + i * 13, cy - 26 - (i % 3) * 6, 30, 16); }, c2, 2);
      neon(ctx, c, 12); ctx.fillStyle = c; ctx.font = '900 22px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('$', cx, cy + 26); plain(ctx);
      break;
    case 'wax':
      neon(ctx, c2, 10); ctx.strokeStyle = c; ctx.lineWidth = 4;
      for (const [x, r] of [[cx - 40, 26], [cx + 40, 26]] as [number, number][]) { ctx.beginPath(); ctx.arc(x, cy, r, 0.3, Math.PI * 1.85); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + r, cy - 10); ctx.lineTo(x + r + 6, cy); ctx.lineTo(x + r - 6, cy + 2); ctx.stroke(); }
      plain(ctx);
      shape(ctx, '#e0a878', () => { ctx.roundRect(cx - 18, cy - 20, 36, 40, 10); });
      shape(ctx, '#ffe14a', () => { ctx.roundRect(cx - 14, cy - 8, 28, 18, 5); });
      break;
    case 'boom':
      shape(ctx, '#1a1426', () => { ctx.rect(cx - 40, cy - 46, 80, 100); });
      for (let r = 0; r < 6; r++) for (let k = 0; k < 4; k++) { ctx.fillStyle = (r + k) % 3 ? '#3a3050' : '#ffd27a'; ctx.fillRect(cx - 32 + k * 18, cy - 38 + r * 15, 10, 8); }
      neon(ctx, c, 30); ctx.fillStyle = '#ffb43c'; ctx.beginPath();
      for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2, rr = i % 2 ? 26 : 50; ctx.lineTo(cx + 20 + Math.cos(a) * rr, cy - 8 + Math.sin(a) * rr * 0.7); }
      ctx.closePath(); ctx.fill(); plain(ctx);
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cx + 20, cy - 8, 16, 0, Math.PI * 2); ctx.fill();
      break;
    case 'cabinet':
      shape(ctx, '#1a1426', () => { ctx.moveTo(cx - 34, cy + 60); ctx.lineTo(cx - 34, cy - 50); ctx.lineTo(cx + 34, cy - 50); ctx.lineTo(cx + 34, cy + 60); }, c);
      neon(ctx, c, 14); ctx.fillStyle = '#0a2030'; ctx.fillRect(cx - 26, cy - 34, 52, 40); plain(ctx);
      ctx.fillStyle = c2; ctx.font = '900 9px monospace'; ctx.textAlign = 'center';
      ['HI SCORE', '1 KID 99999', '2 KID 98765'].forEach((t, i) => ctx.fillText(t, cx, cy - 20 + i * 12));
      neon(ctx, c2, 12); ctx.fillStyle = c2; ctx.fillRect(cx - 34, cy - 50, 68, 10); plain(ctx);
      break;
    case 'aviators':
      for (const dx of [-30, 30]) {
        const g = ctx.createLinearGradient(0, cy - 20, 0, cy + 24); g.addColorStop(0, c); g.addColorStop(1, c2);
        shape(ctx, g as unknown as string, () => { ctx.moveTo(cx + dx - 26, cy - 16); ctx.lineTo(cx + dx + 26, cy - 16); ctx.quadraticCurveTo(cx + dx + 26, cy + 24, cx + dx, cy + 26); ctx.quadraticCurveTo(cx + dx - 26, cy + 24, cx + dx - 26, cy - 16); }, c);
      }
      ctx.strokeStyle = '#c8ccd8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx - 4, cy - 14); ctx.quadraticCurveTo(cx, cy - 20, cx + 4, cy - 14); ctx.stroke();
      ctx.fillStyle = OL; ctx.beginPath(); ctx.moveTo(cx - 40, cy); ctx.lineTo(cx - 24, cy - 4); ctx.lineTo(cx - 30, cy + 4); ctx.fill();
      break;
    case 'revolver':
      shape(ctx, '#9aa0ac', () => { ctx.arc(cx, cy, 44, 0, Math.PI * 2); }, c2);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 - Math.PI / 2; shape(ctx, i === 0 ? '#ffb43c' : OL, () => { ctx.arc(cx + Math.cos(a) * 26, cy + Math.sin(a) * 26, 10, 0, Math.PI * 2); }, i === 0 ? c2 : undefined, 2); }
      shape(ctx, '#5a5f6a', () => { ctx.arc(cx, cy, 8, 0, Math.PI * 2); });
      break;
    case 'trap':
      shape(ctx, '#3a3f48', () => { ctx.rect(cx - 44, cy - 6, 88, 34); }, c);
      shape(ctx, '#5a5f6a', () => { ctx.moveTo(cx - 44, cy - 6); ctx.lineTo(cx - 30, cy - 26); ctx.lineTo(cx + 30, cy - 26); ctx.lineTo(cx + 44, cy - 6); ctx.closePath(); });
      neon(ctx, c, 16); ctx.fillStyle = c; ctx.fillRect(cx + 20, cy + 4, 14, 8); plain(ctx);
      ctx.fillStyle = 'rgba(124,255,100,0.3)'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(cx - 20 + i * 18, cy - 40 - i * 10, 12, 18, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.strokeStyle = '#c8ccd8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx - 44, cy + 18); ctx.quadraticCurveTo(cx - 70, cy + 30, cx - 74, cy + 50); ctx.stroke();
      break;
    case 'hoverboard':
      neon(ctx, c2, 20); ctx.fillStyle = 'rgba(33,208,255,0.3)'; ctx.beginPath(); ctx.ellipse(cx, cy + 40, 60, 8, 0, 0, Math.PI * 2); ctx.fill(); plain(ctx);
      shape(ctx, c, () => { ctx.roundRect(cx - 70, cy - 4, 140, 22, 11); }, c);
      shape(ctx, '#ffe14a', () => { ctx.rect(cx - 40, cy + 2, 80, 6); });
      ctx.fillStyle = OL; ctx.font = '900 10px "Barlow Condensed", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('HOVER', cx, cy + 16);
      break;
    case 'cyborgeye':
      shape(ctx, '#9aa0ac', () => { ctx.moveTo(cx - 40, cy - 6); ctx.quadraticCurveTo(cx - 44, cy - 50, cx, cy - 50); ctx.quadraticCurveTo(cx + 44, cy - 50, cx + 40, cy - 6); ctx.lineTo(cx + 26, cy + 40); ctx.lineTo(cx - 26, cy + 40); ctx.closePath(); });
      shape(ctx, OL, () => { ctx.ellipse(cx - 16, cy - 10, 12, 9, 0, 0, Math.PI * 2); ctx.ellipse(cx + 16, cy - 10, 12, 9, 0, 0, Math.PI * 2); });
      neon(ctx, c, 24); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cx + 16, cy - 10, 5, 0, Math.PI * 2); ctx.fill(); plain(ctx);
      ctx.strokeStyle = OL; ctx.lineWidth = 2; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 8, cy + 26); ctx.lineTo(cx + i * 8, cy + 40); ctx.stroke(); }
      break;
    case 'claw':
      shape(ctx, '#7a3a20', () => { ctx.roundRect(cx - 30, cy + 6, 50, 40, 8); });
      for (let i = 0; i < 4; i++) {
        neon(ctx, c, 10); ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(cx - 26 + i * 13, cy + 8); ctx.quadraticCurveTo(cx - 28 + i * 16, cy - 30, cx - 10 + i * 18, cy - 54); ctx.lineTo(cx - 18 + i * 14, cy + 8); ctx.fill(); plain(ctx);
      }
      for (let r = 0; r < 4; r++) { ctx.fillStyle = r % 2 ? c2 : '#2a5a2a'; ctx.fillRect(cx - 34, cy + 46 + r * 6, 58, 6); }
      break;
    case 'thermal': {
      const tg = ctx.createRadialGradient(cx, cy, 6, cx, cy, 60); tg.addColorStop(0, '#ffffff'); tg.addColorStop(0.3, '#ffe14a'); tg.addColorStop(0.6, '#ff2a2a'); tg.addColorStop(1, '#2a0a5a');
      ctx.fillStyle = tg; ctx.beginPath(); ctx.ellipse(cx, cy - 4, 26, 30, 0, 0, Math.PI * 2); ctx.ellipse(cx, cy + 38, 36, 22, 0, Math.PI, 0); ctx.fill();
      neon(ctx, '#ff2a2a', 12); ctx.fillStyle = '#ff2a2a';
      for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + (i - 1) * 0.5; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 10, cy - 4 + Math.sin(a) * 10 + 10, 3.5, 0, Math.PI * 2); ctx.fill(); }
      plain(ctx);
      break;
    }
    case 'gremlin':
      shape(ctx, '#1a1426', () => { ctx.arc(cx + 44, cy - 16, 30, 0, Math.PI * 2); }, c2);
      shape(ctx, '#f4f0e2', () => { ctx.arc(cx + 44, cy - 16, 24, 0, Math.PI * 2); });
      ctx.strokeStyle = OL; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx + 44, cy - 16); ctx.lineTo(cx + 44, cy - 34); ctx.moveTo(cx + 44, cy - 16); ctx.lineTo(cx + 46, cy - 34); ctx.stroke();
      shape(ctx, '#3a5a2a', () => { ctx.moveTo(cx - 70, cy + 4); ctx.quadraticCurveTo(cx - 44, cy - 34, cx - 30, cy + 4); ctx.moveTo(cx - 10, cy + 4); ctx.quadraticCurveTo(cx + 4, cy - 34, cx + 30, cy + 4); }, c);
      for (const dx of [-36, -4]) { neon(ctx, c2, 14); ctx.fillStyle = '#ffe14a'; ctx.beginPath(); ctx.ellipse(cx + dx, cy + 18, 9, 7, 0, 0, Math.PI * 2); ctx.fill(); plain(ctx); ctx.fillStyle = OL; ctx.beginPath(); ctx.ellipse(cx + dx, cy + 18, 2.5, 6, 0, 0, Math.PI * 2); ctx.fill(); }
      break;
    case 'walkie':
      shape(ctx, c, () => { ctx.roundRect(cx - 22, cy - 30, 44, 76, 6); }, c);
      shape(ctx, '#1a1d22', () => { ctx.rect(cx - 6, cy - 66, 6, 36); });
      shape(ctx, '#1a1d22', () => { ctx.rect(cx - 14, cy - 18, 28, 24); });
      ctx.strokeStyle = '#3a3f48'; ctx.lineWidth = 2; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(cx - 10, cy - 12 + i * 5); ctx.lineTo(cx + 10, cy - 12 + i * 5); ctx.stroke(); }
      neon(ctx, c2, 12); ctx.fillStyle = c2; ctx.beginPath(); ctx.arc(cx + 10, cy + 20, 4, 0, Math.PI * 2); ctx.fill(); plain(ctx);
      ctx.strokeStyle = c2; ctx.lineWidth = 2; for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.arc(cx - 3, cy - 66, k * 9, -Math.PI * 0.9, -Math.PI * 0.1); ctx.stroke(); }
      break;
    case 'firstaid':
      shape(ctx, c2, () => { ctx.roundRect(cx - 44, cy - 24, 88, 60, 8); }, c);
      ctx.fillStyle = c; ctx.fillRect(cx - 8, cy - 14, 16, 40); ctx.fillRect(cx - 20, cy - 2, 40, 16);
      shape(ctx, '#3a2414', () => { ctx.rect(cx - 16, cy - 34, 32, 10); });
      ctx.strokeStyle = '#6a5a4a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, H - 6); ctx.lineTo(W, H - 22); ctx.moveTo(0, H - 1); ctx.lineTo(W, H - 14); ctx.stroke();
      break;
    case 'bracelets':
      for (const [dx, col, a] of [[-18, c, 0.3], [18, c2, -0.3]] as [number, string, number][]) {
        neon(ctx, col, 12); ctx.strokeStyle = col; ctx.lineWidth = 10; ctx.beginPath(); ctx.ellipse(cx + dx, cy, 30, 38, a, 0, Math.PI * 2); ctx.stroke(); plain(ctx);
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.ellipse(cx + dx, cy, 30, 38, a, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      }
      break;
  }
  plain(ctx);
}

const cache = new Map<string, Img>();
/** the card illustration for a treat (TREAT_ART_W × TREAT_ART_H), overridable via public/assets/treats/<id>.png */
export function treatArt(id: string): Img {
  let img = cache.get(id);
  if (img) return img;
  const sp = SPECS[id] ?? { bg: 'vhs' as Bg, motif: 'vhs', c: '#f08a2c', prompt: 'a mystery VHS tape' };
  img = asset(
    {
      key: `treatart_${id}`, file: `treats/${id}.png`, category: 'icon', w: TREAT_ART_W, h: TREAT_ART_H, anchor: [TREAT_ART_W / 2, TREAT_ART_H / 2],
      desc: `Treat card art: ${sp.prompt}`,
      prompt: `Small 80s/90s pop-culture trading-card illustration, ${TREAT_ART_W}x${TREAT_ART_H}, hand-painted retro style with neon glow and subtle VHS scanlines, no text, no logos, no real characters or trademarks: ${sp.prompt}. Bold centred subject readable at thumbnail size.`,
    },
    () => {
      const { c, ctx } = makeCanvas(TREAT_ART_W, TREAT_ART_H);
      background(ctx, sp.bg, TREAT_ART_W, TREAT_ART_H);
      motif(ctx, sp.motif, sp.c, sp.c2 ?? sp.c, TREAT_ART_W, TREAT_ART_H);
      return c;
    }
  );
  cache.set(id, img);
  return img;
}
