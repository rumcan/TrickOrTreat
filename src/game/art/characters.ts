import { makeCanvas, ellipse } from './draw';
import { asset, Img } from '../assets';

export interface Sheet {
  img: Img;
  fw: number;
  fh: number;
  frames: number;
  rows: number;
  ax: number; // anchor (feet) inside frame
  ay: number;
}

const STYLE =
  'Sprite sheet, transparent background, isometric 3/4 top-down ARPG view (Diablo II scale: character ~90px tall), chunky readable hand-painted pixel art with 2px dark outline, Halloween night palette. Frames laid out left-to-right in a strict grid, character feet on the anchor pixel of every frame, no drop shadow (engine draws it).';

const OL = '#140c12';

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string, ol = true) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (ol) {
    ctx.strokeStyle = OL;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}
function ci(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, ol = true) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (ol) {
    ctx.strokeStyle = OL;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}
function limb(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number, col: string) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = OL;
  ctx.lineWidth = w + 3;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.strokeStyle = col;
  ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}

function buildSheet(
  key: string, desc: string, prompt: string, fw: number, fh: number, frames: number, rowNames: string[], ax: number, ay: number,
  draw: (ctx: CanvasRenderingContext2D, cx: number, fy: number, f: number, row: number) => void
): Sheet {
  const rows = rowNames.length;
  const img = asset(
    {
      key, file: `sprites/${key}.webp`, category: 'sheet', w: fw * frames, h: fh * rows, frameW: fw, frameH: fh, frames, rows: rowNames, anchor: [ax, ay], desc,
      prompt: `${STYLE} ${prompt} Grid: ${frames} columns x ${rows} rows of ${fw}x${fh}px frames. Rows: ${rowNames.join(' | ')}. Feet anchor at (${ax},${ay}) in each frame.`,
    },
    () => {
      const { c, ctx } = makeCanvas(fw * frames, fh * rows);
      for (let r = 0; r < rows; r++)
        for (let f = 0; f < frames; f++) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(f * fw, r * fh, fw, fh);
          ctx.clip();
          draw(ctx, f * fw + ax, r * fh + ay, f, r);
          ctx.restore();
        }
      return c;
    }
  );
  return { img, fw, fh, frames, rows, ax, ay };
}

// ================= HEROES =================
export interface HeroPal {
  top: string; topD: string; pants: string; hair: string; skin: string; shoe: string; hat?: string; glasses?: boolean; ponytail?: boolean; cap?: string;
}

// ================= COSTUME LAYERS =================
interface K { cx: number; by: number; fy: number; hy: number; back: boolean; sw: number; as: number; ph: number }
interface CostumeArt {
  pal?: Partial<HeroPal>;
  hideHead?: boolean;
  noHat?: boolean;
  behind?: (ctx: CanvasRenderingContext2D, k: K) => void; // before legs/torso
  body?: (ctx: CanvasRenderingContext2D, k: K) => void; // after torso, before arms
  head?: (ctx: CanvasRenderingContext2D, k: K) => void; // after head
  over?: (ctx: CanvasRenderingContext2D, k: K) => void; // last
}

function cape(ctx: CanvasRenderingContext2D, k: K, outer: string, inner: string, len = 0) {
  const { cx, by, fy, ph } = k;
  const flap = Math.sin(ph) * 2;
  ctx.beginPath();
  ctx.moveTo(cx - 12, by - 46);
  ctx.quadraticCurveTo(cx - 26 - flap, by - 20, cx - 22 - flap, fy - 6 + len);
  ctx.lineTo(cx + 22 + flap, fy - 6 + len);
  ctx.quadraticCurveTo(cx + 26 + flap, by - 20, cx + 12, by - 46);
  ctx.closePath();
  ctx.fillStyle = k.back ? outer : inner;
  ctx.fill();
  ctx.strokeStyle = OL;
  ctx.lineWidth = 2;
  ctx.stroke();
  if (k.back) {
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 4, by - 40); ctx.lineTo(cx - 8, fy - 8);
    ctx.moveTo(cx + 5, by - 40); ctx.lineTo(cx + 9, fy - 8);
    ctx.stroke();
  } else {
    ctx.fillStyle = outer;
    ctx.fillRect(cx - 24 - flap, fy - 14 + len, 5, 8);
    ctx.fillRect(cx + 19 + flap, fy - 14 + len, 5, 8);
  }
}

const COSTUME_ART: Record<string, CostumeArt> = {
  ghost: {
    noHat: true,
    over: (ctx, k) => {
      const { cx, hy, fy, ph, back } = k;
      ctx.beginPath();
      ctx.moveTo(cx - 20, fy - 12);
      ctx.bezierCurveTo(cx - 24, hy + 10, cx - 18, hy - 18, cx, hy - 18);
      ctx.bezierCurveTo(cx + 18, hy - 18, cx + 24, hy + 10, cx + 20, fy - 12);
      for (let i = 0; i <= 5; i++) {
        const x = cx + 20 - i * 8;
        ctx.quadraticCurveTo(x - 2, fy - 8 + Math.sin(ph + i) * 3 + (i % 2 ? 3 : -1), x - 8, fy - 12);
      }
      ctx.closePath();
      const g = ctx.createLinearGradient(cx - 20, hy, cx + 20, fy);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(1, '#c8d4ee');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = OL;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(120,140,190,0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - 8, hy + 14); ctx.quadraticCurveTo(cx - 12, hy + 34, cx - 10, fy - 14);
      ctx.moveTo(cx + 9, hy + 14); ctx.quadraticCurveTo(cx + 13, hy + 34, cx + 11, fy - 14);
      ctx.stroke();
      if (!back) {
        ellipse(ctx, cx - 6, hy, 3.5, 4.5, '#120c18');
        ellipse(ctx, cx + 6, hy, 3.5, 4.5, '#120c18');
        ci(ctx, cx - 5, hy - 1, 1, '#fff', false);
        ci(ctx, cx + 7, hy - 1, 1, '#fff', false);
        // candy pail peeking out of the sheet
        rr(ctx, cx - 24, fy - 30 + k.as, 13, 10, 4, '#f07a1c');
      }
    },
  },
  vampire: {
    pal: { top: '#1d1626', topD: '#8a1020', pants: '#141018', hair: '#0d0b10', shoe: '#111' },
    noHat: true,
    behind: (ctx, k) => { if (!k.back) cape(ctx, k, '#141018', '#b0182c'); },
    body: (ctx, k) => {
      if (k.back) cape(ctx, k, '#141018', '#b0182c', 2);
      else {
        ctx.fillStyle = '#e8e2d8';
        ctx.beginPath(); ctx.moveTo(k.cx - 5, k.by - 46); ctx.lineTo(k.cx + 5, k.by - 46); ctx.lineTo(k.cx, k.by - 32); ctx.fill();
        ctx.fillStyle = '#b0182c';
        ctx.beginPath(); ctx.moveTo(k.cx - 3, k.by - 44); ctx.lineTo(k.cx + 3, k.by - 44); ctx.lineTo(k.cx, k.by - 40); ctx.fill();
      }
    },
    head: (ctx, k) => {
      const { cx, hy, back } = k;
      for (const s of [-1, 1]) {
        ctx.fillStyle = back ? '#141018' : '#b0182c';
        ctx.beginPath(); ctx.moveTo(cx + s * 8, hy + 12); ctx.lineTo(cx + s * 22, hy - 6); ctx.lineTo(cx + s * 15, hy + 14); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = OL; ctx.lineWidth = 1.5; ctx.stroke();
      }
      if (!back) {
        ctx.fillStyle = '#0d0b10';
        ctx.beginPath(); ctx.moveTo(cx - 14, hy - 4); ctx.lineTo(cx, hy - 2); ctx.lineTo(cx + 14, hy - 4); ctx.lineTo(cx + 12, hy - 13); ctx.lineTo(cx - 12, hy - 13); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.moveTo(cx - 3, hy + 6); ctx.lineTo(cx - 2, hy + 10); ctx.lineTo(cx - 1, hy + 6); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx + 1, hy + 6); ctx.lineTo(cx + 2, hy + 10); ctx.lineTo(cx + 3, hy + 6); ctx.fill();
      }
    },
  },
  witch: {
    pal: { top: '#4a2a6a', topD: '#2e1844', pants: '#2e1844', shoe: '#141018' },
    noHat: true,
    body: (ctx, k) => {
      // robe skirt
      ctx.beginPath();
      ctx.moveTo(k.cx - 12, k.by - 24); ctx.lineTo(k.cx + 12, k.by - 24); ctx.lineTo(k.cx + 16, k.fy - 10); ctx.lineTo(k.cx - 16, k.fy - 10); ctx.closePath();
      ctx.fillStyle = '#4a2a6a'; ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#7dff5a'; ctx.fillRect(k.cx - 12, k.by - 26, 24, 3);
    },
    head: (ctx, k) => {
      const { cx, hy, ph } = k;
      ctx.fillStyle = '#231232';
      ctx.beginPath(); ctx.ellipse(cx, hy - 9, 22, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = OL; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - 11, hy - 10); ctx.quadraticCurveTo(cx + 2, hy - 30, cx + 14 + Math.sin(ph) * 2, hy - 46); ctx.quadraticCurveTo(cx + 8, hy - 26, cx + 11, hy - 10); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#7dff5a'; ctx.fillRect(cx - 10, hy - 16, 21, 4);
      ctx.fillStyle = '#ffe14a';
      ctx.font = 'bold 9px sans-serif'; ctx.fillText('★', cx + 2, hy - 22);
    },
  },
  hero: {
    pal: { top: '#2f5ad8', topD: '#1f3c9a', pants: '#2f5ad8', shoe: '#d83a2a' },
    noHat: true,
    behind: (ctx, k) => { if (!k.back) cape(ctx, k, '#c8241e', '#8a1410', 4); },
    body: (ctx, k) => {
      if (k.back) cape(ctx, k, '#d8301e', '#8a1410', 4);
      else {
        ci(ctx, k.cx, k.by - 36, 6, '#ffd23a');
        ctx.fillStyle = '#d8301e';
        ctx.beginPath(); ctx.moveTo(k.cx + 1, k.by - 41); ctx.lineTo(k.cx - 3, k.by - 35); ctx.lineTo(k.cx, k.by - 35); ctx.lineTo(k.cx - 1, k.by - 31); ctx.lineTo(k.cx + 3, k.by - 37); ctx.lineTo(k.cx, k.by - 37); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffd23a'; ctx.fillRect(k.cx - 12, k.by - 25, 24, 3);
      }
    },
    head: (ctx, k) => {
      if (k.back) {
        ctx.fillStyle = '#111'; ctx.fillRect(k.cx - 14, k.hy - 2, 28, 4);
        return;
      }
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.roundRect(k.cx - 13, k.hy - 4, 26, 8, 4); ctx.fill();
      ci(ctx, k.cx - 5, k.hy + 0.5, 2.4, '#fff', false);
      ci(ctx, k.cx + 5, k.hy + 0.5, 2.4, '#fff', false);
      ci(ctx, k.cx - 5, k.hy + 0.5, 1.2, '#111', false);
      ci(ctx, k.cx + 5, k.hy + 0.5, 1.2, '#111', false);
    },
  },
  skeleton: {
    pal: { top: '#16141c', topD: '#0b0a0e', pants: '#16141c', shoe: '#111' },
    body: (ctx, k) => {
      const { cx, by, back } = k;
      ctx.strokeStyle = '#eee8d8'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx, by - 44); ctx.lineTo(cx, by - 24); ctx.stroke();
      if (!back) for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(cx, by - 41 + i * 4.5, 8 - i, 2.2, 0, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke(); }
      else for (let i = 0; i < 5; i++) ctx.fillRect(cx - 2, by - 43 + i * 4, 4, 2);
      ctx.beginPath();
      ctx.moveTo(cx - 5, by - 20); ctx.lineTo(cx - 5 - k.sw * 1.5, k.fy - 8);
      ctx.moveTo(cx + 5, by - 20); ctx.lineTo(cx + 5 + k.sw * 1.5, k.fy - 8);
      ctx.stroke();
    },
    head: (ctx, k) => {
      if (k.back) return;
      const { cx, hy } = k;
      ellipse(ctx, cx, hy + 2, 11, 11, 'rgba(240,236,224,0.95)');
      ellipse(ctx, cx - 5, hy + 1, 3.6, 3.8, '#0b0a0e');
      ellipse(ctx, cx + 5, hy + 1, 3.6, 3.8, '#0b0a0e');
      ctx.fillStyle = '#0b0a0e';
      ctx.beginPath(); ctx.moveTo(cx, hy + 4); ctx.lineTo(cx - 1.5, hy + 7); ctx.lineTo(cx + 1.5, hy + 7); ctx.fill();
      ctx.strokeStyle = '#0b0a0e'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx - 5, hy + 10); ctx.lineTo(cx + 5, hy + 10);
      for (let i = -4; i <= 4; i += 2) { ctx.moveTo(cx + i, hy + 8.5); ctx.lineTo(cx + i, hy + 11.5); }
      ctx.stroke();
    },
  },
  pumpkin: {
    pal: { top: '#ee7a22', topD: '#b8561a', pants: '#2a3a1a', shoe: '#2a1a10' },
    hideHead: true, noHat: true,
    head: (ctx, k) => {
      const { cx, hy, back } = k;
      const py = hy - 1;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath(); ctx.ellipse(cx + i * 6.5, py, 9, 16, 0, 0, Math.PI * 2);
        ctx.fillStyle = i % 2 ? '#d45f17' : '#f08024'; ctx.fill();
        ctx.strokeStyle = OL; ctx.lineWidth = 1.5; ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath(); ctx.ellipse(cx - 9, py - 7, 3, 6, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3d5a22'; ctx.fillRect(cx - 2, py - 21, 4, 7);
      if (!back) {
        ctx.fillStyle = '#ffe36a';
        ctx.beginPath(); ctx.moveTo(cx - 11, py - 5); ctx.lineTo(cx - 4, py); ctx.lineTo(cx - 12, py + 1); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx + 11, py - 5); ctx.lineTo(cx + 4, py); ctx.lineTo(cx + 12, py + 1); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx - 10, py + 5);
        for (let i = 0; i <= 5; i++) ctx.lineTo(cx - 10 + i * 4, py + 5 + (i % 2 ? 3 : 0) + 2);
        ctx.lineTo(cx + 8, py + 11); ctx.lineTo(cx - 8, py + 11); ctx.closePath(); ctx.fill();
      }
    },
  },
  astronaut: {
    pal: { top: '#e8e8ee', topD: '#a8a8b8', pants: '#dcdce4', shoe: '#5a5a66' },
    noHat: true,
    body: (ctx, k) => {
      if (k.back) {
        rr(ctx, k.cx - 11, k.by - 48, 22, 22, 4, '#b8bcc8');
        ctx.fillStyle = '#4fb3ff'; ctx.fillRect(k.cx - 6, k.by - 44, 4, 4);
        ctx.fillStyle = '#ff4a4a'; ctx.fillRect(k.cx + 2, k.by - 44, 4, 4);
      } else {
        rr(ctx, k.cx - 7, k.by - 42, 14, 10, 2, '#5a6070');
        ctx.fillStyle = '#ff4a4a'; ctx.fillRect(k.cx - 5, k.by - 40, 3, 3);
        ctx.fillStyle = '#5fe37a'; ctx.fillRect(k.cx - 1, k.by - 40, 3, 3);
        ctx.fillStyle = '#4fb3ff'; ctx.fillRect(k.cx + 3, k.by - 40, 3, 3);
        ctx.fillStyle = '#d8301e'; ctx.fillRect(k.cx + 7, k.by - 44, 4, 3);
      }
    },
    head: (ctx, k) => {
      const { cx, hy } = k;
      ctx.beginPath(); ctx.arc(cx, hy, 19, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(170,215,255,0.28)'; ctx.fill();
      ctx.strokeStyle = '#d8dce8'; ctx.lineWidth = 3; ctx.stroke();
      ctx.strokeStyle = OL; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.ellipse(cx - 8, hy - 9, 5, 3, -0.6, 0, Math.PI * 2); ctx.fill();
      rr(ctx, cx - 14, hy + 15, 28, 5, 2, '#c8ccd8');
    },
  },
  dino: {
    pal: { top: '#4a9a3a', topD: '#2e6a24', pants: '#3a7a2e', shoe: '#2a2a1a' },
    noHat: true,
    behind: (ctx, k) => {
      const { cx, by, fy, sw } = k;
      ctx.beginPath();
      ctx.moveTo(cx + 6, by - 26);
      ctx.quadraticCurveTo(cx + 26 + sw * 3, by - 18, cx + 30 + sw * 4, fy - 4);
      ctx.quadraticCurveTo(cx + 18, fy - 10, cx + 4, by - 18);
      ctx.closePath();
      ctx.fillStyle = '#3f8a30'; ctx.fill();
      ctx.strokeStyle = OL; ctx.lineWidth = 2; ctx.stroke();
    },
    body: (ctx, k) => {
      if (k.back) {
        ctx.fillStyle = '#ffd23a';
        for (let i = 0; i < 4; i++) {
          const y = k.by - 46 + i * 6;
          ctx.beginPath(); ctx.moveTo(k.cx - 3, y + 4); ctx.lineTo(k.cx, y - 2); ctx.lineTo(k.cx + 3, y + 4); ctx.fill();
        }
      } else {
        ellipse(ctx, k.cx, k.by - 32, 7, 9, '#b8e07a');
      }
    },
    head: (ctx, k) => {
      const { cx, hy, back } = k;
      ctx.beginPath(); ctx.arc(cx, hy - 2, 16, Math.PI * 0.95, Math.PI * 2.05);
      ctx.lineTo(cx + 15, hy - 1); ctx.lineTo(cx - 15, hy - 1); ctx.closePath();
      ctx.fillStyle = '#4a9a3a'; ctx.fill();
      ctx.strokeStyle = OL; ctx.lineWidth = 2; ctx.stroke();
      if (!back) {
        ctx.fillStyle = '#fff';
        for (let i = -12; i <= 9; i += 4) { ctx.beginPath(); ctx.moveTo(i + cx, hy - 2); ctx.lineTo(i + cx + 2, hy + 3); ctx.lineTo(i + cx + 4, hy - 2); ctx.fill(); }
        ci(ctx, cx - 7, hy - 12, 3.5, '#ffe14a');
        ci(ctx, cx + 7, hy - 12, 3.5, '#ffe14a');
        ci(ctx, cx - 7, hy - 12, 1.5, '#111', false);
        ci(ctx, cx + 7, hy - 12, 1.5, '#111', false);
      } else {
        ctx.fillStyle = '#ffd23a';
        for (let i = 0; i < 3; i++) { const y = hy - 16 + i * 7; ctx.beginPath(); ctx.moveTo(cx - 3, y + 4); ctx.lineTo(cx, y - 3); ctx.lineTo(cx + 3, y + 4); ctx.fill(); }
      }
    },
  },
};

function drawKid(ctx: CanvasRenderingContext2D, cx: number, fy: number, f: number, row: number, p0: HeroPal, costume?: string) {
  const C = costume ? COSTUME_ART[costume] : undefined;
  const p: HeroPal = C ? { ...p0, ...(C.pal || {}), ...(C.noHat ? { hat: undefined, cap: undefined, ponytail: false } : {}) } : p0;
  const walking = row === 1 || row === 3;
  const back = row >= 2;
  const n = walking ? 6 : 4;
  const ph = (f / n) * Math.PI * 2;
  const sw = walking ? Math.sin(ph) : 0;
  const bob = walking ? Math.abs(Math.cos(ph)) * 2.5 : Math.sin(ph) * 0.8 + 0.8;
  const by = fy - bob;
  const K0: K = { cx, by, fy, hy: by - 60, back, sw, as: walking ? -sw * 4 : 0, ph };
  if (C?.behind) C.behind(ctx, K0);
  // legs
  const l1 = Math.max(0, sw) * 4, l2 = Math.max(0, -sw) * 4;
  limb(ctx, cx - 5, by - 22, cx - 5 - sw * 1.5, fy - 4 - l1, 6, p.pants);
  limb(ctx, cx + 5, by - 22, cx + 5 + sw * 1.5, fy - 4 - l2, 6, p.pants);
  rr(ctx, cx - 10 - sw * 1.5, fy - 7 - l1, 9, 6, 3, p.shoe);
  rr(ctx, cx + 1 + sw * 1.5, fy - 7 - l2, 9, 6, 3, p.shoe);
  // back arm
  const as = walking ? -sw * 4 : 0;
  // torso
  rr(ctx, cx - 12, by - 46, 24, 26, 8, p.top);
  ctx.fillStyle = p.topD;
  ctx.fillRect(cx + 4, by - 42, 6, 20);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(cx - 9, by - 42, 4, 18);
  if (!back) {
    // hoodie pocket + strings
    rr(ctx, cx - 7, by - 31, 14, 7, 3, p.topD, false);
    ctx.strokeStyle = '#eee';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - 3, by - 44); ctx.lineTo(cx - 3, by - 37); ctx.moveTo(cx + 3, by - 44); ctx.lineTo(cx + 3, by - 37); ctx.stroke();
  } else {
    // hood
    rr(ctx, cx - 10, by - 50, 20, 10, 5, p.topD);
  }
  if (C?.body) C.body(ctx, K0);
  // arms
  limb(ctx, cx - 12, by - 42, cx - 15, by - 27 + as, 6, p.top);
  limb(ctx, cx + 12, by - 42, cx + 15, by - 27 - as, 6, p.top);
  ci(ctx, cx - 15, by - 25 + as, 3.5, p.skin);
  ci(ctx, cx + 15, by - 25 - as, 3.5, p.skin);
  // candy pail on left hand
  if (!back) {
    const px = cx - 17, py = by - 18 + as;
    ctx.strokeStyle = OL; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(px, py - 4, 6, Math.PI, 0); ctx.stroke();
    rr(ctx, px - 7, py - 4, 14, 11, 4, '#f07a1c');
    ctx.fillStyle = '#2a1408';
    ctx.fillRect(px - 4, py, 2, 2); ctx.fillRect(px + 2, py, 2, 2); ctx.fillRect(px - 3, py + 3, 6, 1.5);
  }
  // head
  const hy = by - 60;
  if (C?.hideHead) {
    C.head?.(ctx, K0);
    C.over?.(ctx, K0);
    return;
  }
  if (p.ponytail && back) rr(ctx, cx - 4, hy + 2, 8, 16, 4, p.hair);
  ci(ctx, cx, hy, 14, p.skin);
  if (!back) {
    // hair fringe
    ctx.fillStyle = p.hair;
    ctx.beginPath(); ctx.arc(cx, hy - 2, 14.5, Math.PI * 1.05, Math.PI * 1.95); ctx.quadraticCurveTo(cx + 6, hy - 6, cx, hy - 8); ctx.quadraticCurveTo(cx - 8, hy - 4, cx - 14, hy - 4); ctx.fill();
    // eyes
    ci(ctx, cx - 5, hy + 1, 2.6, '#1a1020', false);
    ci(ctx, cx + 5, hy + 1, 2.6, '#1a1020', false);
    ci(ctx, cx - 4.2, hy, 0.9, '#fff', false);
    ci(ctx, cx + 5.8, hy, 0.9, '#fff', false);
    ellipse(ctx, cx - 9, hy + 6, 2.5, 1.4, 'rgba(255,90,90,0.45)');
    ellipse(ctx, cx + 9, hy + 6, 2.5, 1.4, 'rgba(255,90,90,0.45)');
    ctx.strokeStyle = '#5a2a2a'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(cx, hy + 6, 2.5, 0.2, Math.PI - 0.2); ctx.stroke();
    if (p.glasses) {
      ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx - 5, hy + 1, 4, 0, Math.PI * 2); ctx.moveTo(cx + 9, hy + 1); ctx.arc(cx + 5, hy + 1, 4, 0, Math.PI * 2); ctx.moveTo(cx - 1, hy + 1); ctx.lineTo(cx + 1, hy + 1); ctx.stroke();
    }
  } else {
    ctx.fillStyle = p.hair;
    ctx.beginPath(); ctx.arc(cx, hy, 14, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = OL; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx - 3, hy - 3, 8, Math.PI, Math.PI * 1.6); ctx.stroke();
  }
  if (p.hat) {
    ctx.fillStyle = p.hat;
    ctx.beginPath(); ctx.arc(cx, hy - 4, 14.5, Math.PI, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = OL; ctx.lineWidth = 2; ctx.stroke();
    ci(ctx, cx, hy - 19, 3.5, '#fff');
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(cx - 14, hy - 7, 28, 3);
  }
  if (p.cap) {
    ctx.fillStyle = p.cap;
    ctx.beginPath(); ctx.arc(cx, hy - 5, 14, Math.PI, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = OL; ctx.lineWidth = 2; ctx.stroke();
    if (!back) rr(ctx, cx - 12, hy - 7, 24, 5, 2, p.cap);
    else rr(ctx, cx - 6, hy - 22, 12, 5, 2, p.cap);
  }
  if (p.ponytail && !back) rr(ctx, cx + 11, hy - 6, 6, 14, 3, p.hair);
  C?.head?.(ctx, K0);
  C?.over?.(ctx, K0);
}

export const COSTUME_ART_IDS = Object.keys(COSTUME_ART);

export const HEROES = [
  { id: 'tommy', name: 'Tommy', pal: { top: '#c8312d', topD: '#8f1f1d', pants: '#2f4a7a', hair: '#5a3418', skin: '#f2c39a', shoe: '#f2f2f2', cap: '#1f3c8a' } as HeroPal },
  { id: 'sam', name: 'Sam', pal: { top: '#3c7a3a', topD: '#285427', pants: '#4a3a2a', hair: '#1b1410', skin: '#a8714a', shoe: '#333', glasses: true } as HeroPal },
  { id: 'jess', name: 'Jess', pal: { top: '#7a3fb0', topD: '#562a80', pants: '#2b2b36', hair: '#e0a040', skin: '#f6d2b5', shoe: '#e94d6a', hat: '#e8c23a', ponytail: true } as HeroPal },
];

const COSTUME_PROMPT: Record<string, string> = {
  ghost: 'wearing a homemade white bedsheet ghost costume with two cut-out eye holes that covers them down to the knees (sneakers visible)',
  vampire: 'wearing a Dracula costume: black cape with red lining, high collar, slicked-back hair, plastic fangs',
  witch: 'wearing a purple witch robe and a huge crooked pointy hat with a green band',
  hero: 'wearing a homemade blue superhero suit with a red cape, yellow lightning emblem and black eye mask',
  skeleton: 'wearing a black skeleton onesie with white printed bones and skull face paint',
  pumpkin: 'wearing an oversized carved jack-o-lantern head mask with a glowing face and an orange sweatshirt',
  astronaut: 'wearing a white astronaut costume with a bubble glass helmet and chest control panel',
  dino: 'wearing a green T-Rex hoodie with a toothy hood, yellow back spikes and a floppy tail',
};

export function heroSheet(i: number, costume?: string | null): Sheet {
  const h = HEROES[i];
  const c = costume || '';
  return buildSheet(
    c ? `hero_${h.id}_${c}` : `hero_${h.id}`,
    c ? `Kid "${h.name}" in the ${c} costume (same grid/anchor as base sheet)` : `Playable kid "${h.name}" - idle & walk, facing camera and facing away (left/right via horizontal flip)`,
    c ? `The same 11-year-old kid "${h.name}" ${COSTUME_PROMPT[c]}, trick-or-treating, holding an orange plastic jack-o-lantern candy pail.` : `A normal 11-year-old American kid in everyday clothes (${h.pal.top} hoodie/jacket) carrying an orange plastic jack-o-lantern candy pail.`,
    64, 96, 6, ['idle front (4f)', 'walk front (6f)', 'idle back (4f)', 'walk back (6f)'], 32, 90,
    (ctx, cx, fy, f, row) => {
      const n = row === 1 || row === 3 ? 6 : 4;
      if (f >= n) return;
      drawKid(ctx, cx, fy, f, row, h.pal, c || undefined);
    }
  );
}

// ================= ENEMIES =================
function eyesGlow(ctx: CanvasRenderingContext2D, x: number, y: number, dx: number, col: string, r = 2.2) {
  for (const s of [-1, 1]) {
    ctx.fillStyle = col.replace(')', ',0.35)').replace('rgb', 'rgba');
    ci(ctx, x + s * dx, y, r * 2, 'rgba(255,240,120,0.25)', false);
    ci(ctx, x + s * dx, y, r, col, false);
  }
}

function zombie(ctx: CanvasRenderingContext2D, cx: number, fy: number, f: number) {
  const ph = (f / 6) * Math.PI * 2, sw = Math.sin(ph), bob = Math.abs(Math.cos(ph)) * 2;
  const by = fy - bob;
  limb(ctx, cx - 6, by - 24, cx - 7 - sw * 2, fy - 4, 7, '#4a3a2c');
  limb(ctx, cx + 6, by - 24, cx + 7 + sw * 2, fy - 4, 7, '#4a3a2c');
  rr(ctx, cx - 12 - sw * 2, fy - 7, 10, 6, 2, '#2a221c');
  rr(ctx, cx + 2 + sw * 2, fy - 7, 10, 6, 2, '#2a221c');
  rr(ctx, cx - 14, by - 54, 28, 32, 6, '#4a6272');
  ctx.fillStyle = '#7aa35a';
  ctx.beginPath(); ctx.moveTo(cx - 4, by - 30); ctx.lineTo(cx + 3, by - 22); ctx.lineTo(cx - 8, by - 22); ctx.fill();
  ctx.fillStyle = '#33464f';
  ctx.fillRect(cx + 6, by - 50, 6, 26);
  ctx.fillStyle = '#6a2a22';
  ctx.fillRect(cx - 8, by - 44, 4, 4);
  // arms reaching forward
  limb(ctx, cx - 13, by - 48, cx - 12 + sw * 2, by - 36, 7, '#4a6272');
  limb(ctx, cx + 13, by - 48, cx + 12 - sw * 2, by - 36, 7, '#4a6272');
  ci(ctx, cx - 12 + sw * 2, by - 33, 5, '#7aa35a');
  ci(ctx, cx + 12 - sw * 2, by - 33, 5, '#7aa35a');
  const hx = cx + sw * 2, hy = by - 66;
  ci(ctx, hx, hy, 13, '#7aa35a');
  ctx.fillStyle = '#5a7f40';
  ctx.beginPath(); ctx.arc(hx + 3, hy + 2, 9, -0.4, 1.4); ctx.fill();
  ctx.fillStyle = '#2a2a1a';
  ctx.beginPath(); ctx.arc(hx, hy - 4, 13, Math.PI * 1.1, Math.PI * 1.9); ctx.fill();
  eyesGlow(ctx, hx, hy, 5, '#fff07a');
  ctx.fillStyle = '#2a0f0f';
  ctx.fillRect(hx - 5, hy + 5, 10, 4);
  ctx.fillStyle = '#e8e2c0';
  ctx.fillRect(hx - 4, hy + 5, 2, 2); ctx.fillRect(hx + 1, hy + 5, 2, 2);
  ctx.strokeStyle = '#2a2a1a'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(hx + 6, hy - 9); ctx.lineTo(hx + 9, hy - 3); ctx.moveTo(hx + 6, hy - 7); ctx.lineTo(hx + 9, hy - 7); ctx.stroke();
}

function skeleton(ctx: CanvasRenderingContext2D, cx: number, fy: number, f: number) {
  const ph = (f / 6) * Math.PI * 2, sw = Math.sin(ph), bob = Math.abs(Math.cos(ph)) * 2;
  const by = fy - bob, B = '#e8e2d0';
  limb(ctx, cx - 5, by - 26, cx - 6 - sw * 3, fy - 3, 3.5, B);
  limb(ctx, cx + 5, by - 26, cx + 6 + sw * 3, fy - 3, 3.5, B);
  rr(ctx, cx - 9, by - 30, 18, 7, 3, B);
  limb(ctx, cx, by - 30, cx, by - 52, 3, B);
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = OL; ctx.lineWidth = 4.5;
    ctx.beginPath(); ctx.ellipse(cx, by - 46 + i * 5, 11 - i, 3, 0, Math.PI * 0.05, Math.PI * 0.95); ctx.stroke();
    ctx.strokeStyle = B; ctx.lineWidth = 2.5; ctx.stroke();
  }
  limb(ctx, cx - 11, by - 52, cx - 15 + sw * 4, by - 32, 3, B);
  limb(ctx, cx + 11, by - 52, cx + 15 - sw * 4, by - 32, 3, B);
  // bone club
  limb(ctx, cx + 15 - sw * 4, by - 32, cx + 22 - sw * 4, by - 50, 4, '#d8d0b8');
  ci(ctx, cx + 22 - sw * 4, by - 52, 4, '#d8d0b8');
  const hy = by - 64, jaw = (f % 2) * 2;
  ci(ctx, cx, hy, 12, B);
  rr(ctx, cx - 7, hy + 6 + jaw, 14, 6, 2, B);
  ci(ctx, cx - 5, hy, 3.8, '#120a10', false);
  ci(ctx, cx + 5, hy, 3.8, '#120a10', false);
  ci(ctx, cx - 5, hy, 1.4, '#ff4040', false);
  ci(ctx, cx + 5, hy, 1.4, '#ff4040', false);
  ctx.fillStyle = '#120a10';
  ctx.beginPath(); ctx.moveTo(cx, hy + 3); ctx.lineTo(cx - 2, hy + 6); ctx.lineTo(cx + 2, hy + 6); ctx.fill();
}

function ghost(ctx: CanvasRenderingContext2D, cx: number, fy: number, f: number) {
  const ph = (f / 6) * Math.PI * 2;
  const by = fy - 14 - Math.sin(ph) * 4;
  ctx.beginPath();
  ctx.moveTo(cx - 20, by);
  ctx.bezierCurveTo(cx - 24, by - 40, cx - 18, by - 66, cx, by - 66);
  ctx.bezierCurveTo(cx + 18, by - 66, cx + 24, by - 40, cx + 20, by);
  for (let i = 0; i <= 5; i++) {
    const x = cx + 20 - i * 8;
    const y = by + Math.sin(ph + i * 1.3) * 4 + (i % 2 ? 4 : -2);
    ctx.quadraticCurveTo(x + 4, y + 6, x - 4, y);
  }
  ctx.closePath();
  const g = ctx.createLinearGradient(cx, by - 66, cx, by + 6);
  g.addColorStop(0, 'rgba(240,248,255,0.95)');
  g.addColorStop(1, 'rgba(170,200,255,0.55)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(30,30,60,0.7)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ellipse(ctx, cx - 7, by - 44, 4, 6, '#101024');
  ellipse(ctx, cx + 7, by - 44, 4, 6, '#101024');
  ellipse(ctx, cx, by - 30, 5, 6 + Math.sin(ph) * 2, '#101024');
  limb(ctx, cx - 18, by - 34, cx - 26, by - 26 + Math.sin(ph) * 3, 6, 'rgba(225,235,255,0.9)');
  limb(ctx, cx + 18, by - 34, cx + 26, by - 26 - Math.sin(ph) * 3, 6, 'rgba(225,235,255,0.9)');
}

function bat(ctx: CanvasRenderingContext2D, cx: number, fy: number, f: number) {
  const ph = (f / 4) * Math.PI * 2;
  const by = fy - 26;
  const wing = Math.sin(ph) * 12;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + s * 5, by);
    ctx.quadraticCurveTo(cx + s * 16, by - 10 - wing, cx + s * 28, by - 6 - wing);
    ctx.lineTo(cx + s * 22, by + 2 - wing * 0.3);
    ctx.lineTo(cx + s * 17, by - 1 - wing * 0.4);
    ctx.lineTo(cx + s * 12, by + 4 - wing * 0.2);
    ctx.closePath();
    ctx.fillStyle = '#2a1a33';
    ctx.fill();
    ctx.strokeStyle = OL; ctx.lineWidth = 1.5; ctx.stroke();
  }
  ci(ctx, cx, by, 8, '#3a2446');
  ctx.fillStyle = '#3a2446';
  ctx.beginPath(); ctx.moveTo(cx - 6, by - 5); ctx.lineTo(cx - 4, by - 13); ctx.lineTo(cx - 1, by - 6); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx + 6, by - 5); ctx.lineTo(cx + 4, by - 13); ctx.lineTo(cx + 1, by - 6); ctx.fill();
  ci(ctx, cx - 3, by - 1, 1.6, '#ff3b3b', false);
  ci(ctx, cx + 3, by - 1, 1.6, '#ff3b3b', false);
  ctx.fillStyle = '#fff';
  ctx.fillRect(cx - 2, by + 3, 1.2, 2.2); ctx.fillRect(cx + 1, by + 3, 1.2, 2.2);
}

function pumpkinWalker(ctx: CanvasRenderingContext2D, cx: number, fy: number, f: number) {
  const ph = (f / 6) * Math.PI * 2, hop = Math.abs(Math.sin(ph)) * 6;
  const by = fy - hop;
  limb(ctx, cx - 6, by - 10, cx - 8, fy - 2, 4, '#3d5a22');
  limb(ctx, cx + 6, by - 10, cx + 8, fy - 2, 4, '#3d5a22');
  const py = by - 26;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.ellipse(cx + i * 6, py, 9, 17, 0, 0, Math.PI * 2);
    ctx.fillStyle = i % 2 ? '#d45f17' : '#ee7a22';
    ctx.fill();
    ctx.strokeStyle = OL; ctx.lineWidth = 1.5; ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.beginPath(); ctx.ellipse(cx - 10, py - 7, 4, 7, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffe36a';
  ctx.beginPath(); ctx.moveTo(cx - 11, py - 6); ctx.lineTo(cx - 4, py - 1); ctx.lineTo(cx - 12, py); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx + 11, py - 6); ctx.lineTo(cx + 4, py - 1); ctx.lineTo(cx + 12, py); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - 13, py + 4);
  for (let i = 0; i <= 6; i++) ctx.lineTo(cx - 13 + i * 4.33, py + 4 + (i % 2 ? 4 : 0) + (i > 0 && i < 6 ? 3 : 0));
  ctx.lineTo(cx + 10, py + 11);
  ctx.lineTo(cx - 10, py + 11);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#3d5a22';
  ctx.fillRect(cx - 2, py - 22, 4, 7);
  ctx.strokeStyle = '#3d5a22'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx + 1, py - 20); ctx.quadraticCurveTo(cx + 10, py - 26, cx + 8, py - 16); ctx.stroke();
}

function witch(ctx: CanvasRenderingContext2D, cx: number, fy: number, f: number) {
  const ph = (f / 6) * Math.PI * 2;
  const by = fy - 4 - Math.sin(ph) * 2;
  // cloak
  ctx.beginPath();
  ctx.moveTo(cx - 8, by - 56);
  ctx.lineTo(cx + 8, by - 56);
  ctx.quadraticCurveTo(cx + 22, by - 20, cx + 20 + Math.sin(ph) * 2, by);
  for (let i = 0; i < 5; i++) ctx.lineTo(cx + 20 - (i + 0.5) * 8, by + (i % 2 ? -5 : 2));
  ctx.lineTo(cx - 20, by);
  ctx.quadraticCurveTo(cx - 22, by - 20, cx - 8, by - 56);
  ctx.fillStyle = '#3a1f4f';
  ctx.fill();
  ctx.strokeStyle = OL; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#4e2a6a';
  ctx.fillRect(cx - 12, by - 46, 6, 40);
  // arms + staff
  limb(ctx, cx - 10, by - 50, cx - 18, by - 32, 6, '#3a1f4f');
  limb(ctx, cx + 10, by - 50, cx + 18, by - 36, 6, '#3a1f4f');
  ci(ctx, cx - 18, by - 30, 3.5, '#8ac46a');
  limb(ctx, cx + 20, by - 4, cx + 20, by - 70, 3, '#5a3a22');
  ci(ctx, cx + 20, by - 74, 5, '#b2ff6a');
  ci(ctx, cx + 20, by - 74, 9, 'rgba(178,255,106,0.3)', false);
  ci(ctx, cx + 18, by - 36, 3.5, '#8ac46a');
  // head
  const hy = by - 64;
  ci(ctx, cx, hy, 11, '#8ac46a');
  ctx.fillStyle = '#1a1018';
  ctx.beginPath(); ctx.moveTo(cx - 12, hy - 4); ctx.lineTo(cx - 14, hy + 14); ctx.lineTo(cx - 8, hy + 4); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx + 12, hy - 4); ctx.lineTo(cx + 14, hy + 14); ctx.lineTo(cx + 8, hy + 4); ctx.fill();
  ctx.fillStyle = '#6aa04a';
  ctx.beginPath(); ctx.moveTo(cx, hy); ctx.lineTo(cx + 2, hy + 6); ctx.lineTo(cx - 1, hy + 5); ctx.fill();
  eyesGlow(ctx, cx, hy - 1, 4.5, '#ffe14a', 1.8);
  ctx.strokeStyle = '#2a1018'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(cx, hy + 6, 3, 0.1, Math.PI - 0.1); ctx.stroke();
  // hat
  ctx.fillStyle = '#231232';
  ctx.beginPath(); ctx.ellipse(cx, hy - 8, 20, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = OL; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - 10, hy - 9); ctx.lineTo(cx + 12 + Math.sin(ph) * 2, hy - 40); ctx.lineTo(cx + 10, hy - 9); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#b44dff';
  ctx.fillRect(cx - 9, hy - 14, 19, 4);
}

function werewolf(ctx: CanvasRenderingContext2D, cx: number, fy: number, f: number) {
  const ph = (f / 6) * Math.PI * 2, sw = Math.sin(ph), bob = Math.abs(Math.cos(ph)) * 3;
  const by = fy - bob, F = '#5a4030', FD = '#3e2a1e';
  limb(ctx, cx - 10, by - 34, cx - 13 - sw * 4, fy - 4, 11, FD);
  limb(ctx, cx + 10, by - 34, cx + 13 + sw * 4, fy - 4, 11, FD);
  rr(ctx, cx - 22, by - 82, 44, 50, 16, F);
  ctx.fillStyle = '#7a5a40';
  ctx.beginPath(); ctx.ellipse(cx, by - 56, 13, 16, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2e4a6a';
  ctx.fillRect(cx - 18, by - 40, 36, 10);
  ctx.fillStyle = '#25405e';
  for (let i = 0; i < 4; i++) ctx.fillRect(cx - 18 + i * 10, by - 32, 5, 4);
  limb(ctx, cx - 20, by - 74, cx - 30 + sw * 4, by - 40, 10, F);
  limb(ctx, cx + 20, by - 74, cx + 30 - sw * 4, by - 40, 10, F);
  for (const s of [-1, 1]) {
    const hx = cx + s * (30 - s * sw * 4), hy2 = by - 38;
    ci(ctx, hx, hy2, 6, FD);
    ctx.strokeStyle = '#e8e2d0'; ctx.lineWidth = 2;
    for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(hx + k * 3, hy2 + 4); ctx.lineTo(hx + k * 4, hy2 + 10); ctx.stroke(); }
  }
  const hy = by - 92;
  ci(ctx, cx, hy, 16, F);
  ctx.fillStyle = F;
  ctx.beginPath(); ctx.moveTo(cx - 14, hy - 6); ctx.lineTo(cx - 12, hy - 26); ctx.lineTo(cx - 4, hy - 12); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx + 14, hy - 6); ctx.lineTo(cx + 12, hy - 26); ctx.lineTo(cx + 4, hy - 12); ctx.fill();
  rr(ctx, cx - 9, hy + 2, 18, 12, 5, '#7a5a40');
  ci(ctx, cx, hy + 4, 3, '#111', false);
  eyesGlow(ctx, cx, hy - 4, 7, '#ff3030', 2.6);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(cx - 6, hy + 10); ctx.lineTo(cx - 4, hy + 16); ctx.lineTo(cx - 2, hy + 10); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx + 6, hy + 10); ctx.lineTo(cx + 4, hy + 16); ctx.lineTo(cx + 2, hy + 10); ctx.fill();
}

function pumpkinKing(ctx: CanvasRenderingContext2D, cx: number, fy: number, f: number) {
  const ph = (f / 6) * Math.PI * 2;
  const by = fy - 6 - Math.sin(ph) * 3;
  // vine legs/roots
  for (let i = -3; i <= 3; i++) {
    ctx.strokeStyle = OL; ctx.lineWidth = 8;
    const x2 = cx + i * 22 + Math.sin(ph + i) * 6;
    ctx.beginPath(); ctx.moveTo(cx + i * 10, by - 30); ctx.quadraticCurveTo(cx + i * 22, by - 10, x2, fy - 2); ctx.stroke();
    ctx.strokeStyle = '#2f4a1a'; ctx.lineWidth = 5; ctx.stroke();
  }
  // vine arms
  for (const s of [-1, 1]) {
    ctx.strokeStyle = OL; ctx.lineWidth = 10;
    const hx = cx + s * (86 + Math.sin(ph) * 6), hy = by - 80 + Math.cos(ph) * 8;
    ctx.beginPath(); ctx.moveTo(cx + s * 50, by - 80); ctx.quadraticCurveTo(cx + s * 80, by - 120, hx, hy); ctx.stroke();
    ctx.strokeStyle = '#3d5a22'; ctx.lineWidth = 7; ctx.stroke();
    ci(ctx, hx, hy, 9, '#2f4a1a');
  }
  const py = by - 76;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.ellipse(cx + i * 14, py, 22, 52, 0, 0, Math.PI * 2);
    const g = ctx.createLinearGradient(cx - 70, py - 50, cx + 70, py + 50);
    g.addColorStop(0, i % 2 ? '#e0701c' : '#f8902e');
    g.addColorStop(1, '#a8400c');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = OL; ctx.lineWidth = 2.5; ctx.stroke();
  }
  // face
  const glow = 0.7 + Math.sin(ph * 2) * 0.3;
  ctx.fillStyle = `rgba(255,${180 + glow * 60},60,1)`;
  ctx.beginPath(); ctx.moveTo(cx - 40, py - 20); ctx.lineTo(cx - 14, py - 4); ctx.lineTo(cx - 42, py); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx + 40, py - 20); ctx.lineTo(cx + 14, py - 4); ctx.lineTo(cx + 42, py); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx, py - 4); ctx.lineTo(cx - 6, py + 8); ctx.lineTo(cx + 6, py + 8); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - 46, py + 14);
  for (let i = 0; i <= 10; i++) ctx.lineTo(cx - 46 + i * 9.2, py + 14 + (i % 2 ? 12 : 0) + Math.sin(i / 10 * Math.PI) * 10);
  ctx.lineTo(cx + 40, py + 36); ctx.quadraticCurveTo(cx, py + 50, cx - 40, py + 36);
  ctx.closePath(); ctx.fill();
  // crown
  ctx.fillStyle = '#e8c23a';
  ctx.beginPath();
  ctx.moveTo(cx - 34, py - 46);
  for (let i = 0; i <= 6; i++) ctx.lineTo(cx - 34 + i * 11.3, py - 46 - (i % 2 ? 0 : 26));
  ctx.lineTo(cx + 34, py - 40); ctx.lineTo(cx - 34, py - 40); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = OL; ctx.lineWidth = 2; ctx.stroke();
  for (let i = 0; i < 4; i++) ci(ctx, cx - 26 + i * 17, py - 47, 3.5, ['#ff3b5c', '#4fb3ff', '#7dff5a', '#c46bff'][i]);
}

const EN_DEFS: Record<string, { fw: number; fh: number; frames: number; ax: number; ay: number; draw: (c: CanvasRenderingContext2D, x: number, y: number, f: number) => void; desc: string; prompt: string }> = {
  zombie: { fw: 64, fh: 96, frames: 6, ax: 32, ay: 90, draw: zombie, desc: 'Shambling suburban zombie (walk cycle)', prompt: 'A green-skinned shambling zombie in a torn blue shirt, arms reaching forward, glowing yellow eyes, walk cycle facing camera.' },
  skeleton: { fw: 64, fh: 96, frames: 6, ax: 32, ay: 90, draw: skeleton, desc: 'Skeleton with bone club (walk cycle)', prompt: 'A cartoon skeleton with red pinprick eyes holding a bone club, chattering jaw, walk cycle facing camera.' },
  ghost: { fw: 64, fh: 96, frames: 6, ax: 32, ay: 90, draw: ghost, desc: 'Bedsheet ghost (float cycle, semi-transparent)', prompt: 'A classic bedsheet ghost, translucent pale blue-white, black hollow eyes and mouth, wavy hem, floating cycle.' },
  bat: { fw: 64, fh: 56, frames: 4, ax: 32, ay: 52, draw: bat, desc: 'Vampire bat (flap cycle, flying)', prompt: 'A small purple vampire bat with red eyes and tiny fangs, wing-flap cycle seen from the front.' },
  pumpkin: { fw: 64, fh: 80, frames: 6, ax: 32, ay: 76, draw: pumpkinWalker, desc: 'Hopping jack-o-lantern bomber (explodes)', prompt: 'A small living jack-o-lantern with vine legs hopping, glowing jagged grin, hop cycle.' },
  witch: { fw: 72, fh: 112, frames: 6, ax: 36, ay: 106, draw: witch, desc: 'Witch caster (ranged)', prompt: 'A green-skinned witch in a purple cloak and pointed hat holding a staff with a glowing green orb, idle-float cycle.' },
  werewolf: { fw: 96, fh: 128, frames: 6, ax: 48, ay: 122, draw: werewolf, desc: 'Werewolf elite (large)', prompt: 'A hulking brown werewolf in torn jeans, red glowing eyes, claws, prowling walk cycle.' },
  king: { fw: 200, fh: 210, frames: 6, ax: 100, ay: 202, draw: pumpkinKing, desc: 'BOSS: The Pumpkin King', prompt: 'A giant crowned jack-o-lantern boss with a blazing carved face, vine arms and root legs, menacing idle cycle.' },
};

export function enemySheet(type: string): Sheet {
  const d = EN_DEFS[type];
  return buildSheet(`enemy_${type}`, d.desc, d.prompt, d.fw, d.fh, d.frames, ['walk/float facing camera (flip horizontally for left/right)'], d.ax, d.ay, (ctx, cx, fy, f) => d.draw(ctx, cx, fy, f));
}

export const ENEMY_TYPES = Object.keys(EN_DEFS);
