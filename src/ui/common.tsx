import { useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { weaponIcon } from '../game/art/fx';
import { heroSheet } from '../game/art/characters';
import { Img } from '../game/assets';
import { RARITY } from '../game/config';
import { Weapon, weaponStats, Stats, TRAIT_BY_ID, weaponDps } from '../game/data';

const urlCache = new Map<Img, string>();
export function imgUrl(img: Img) {
  let u = urlCache.get(img);
  if (!u) {
    u = img instanceof HTMLImageElement ? img.src : img.toDataURL();
    urlCache.set(img, u);
  }
  return u;
}
export const weaponUrl = (id: string) => imgUrl(weaponIcon(id));

const base = (import.meta as unknown as { env: { BASE_URL: string } }).env.BASE_URL || './';

// The logo ships on a flat white field; key it out at load so it behaves like a transparent PNG.
let logoUrl: string | null = null;
let logoLoading = false;
const logoSubs = new Set<() => void>();
function ensureLogo() {
  if (logoUrl || logoLoading) return;
  logoLoading = true;
  const im = new Image();
  im.onload = () => {
    try {
      const c = document.createElement('canvas');
      c.width = im.width;
      c.height = im.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(im, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height);
      const px = d.data;
      for (let i = 0; i < px.length; i += 4) {
        const r = px[i], g = px[i + 1], b = px[i + 2];
        if (r > 235 && g > 235 && b > 235) px[i + 3] = 0;
        else if (r > 205 && g > 205 && b > 205) px[i + 3] = Math.round((255 - Math.min(r, g, b)) * 4);
      }
      ctx.putImageData(d, 0, 0);
      logoUrl = c.toDataURL('image/png');
    } catch {
      logoUrl = im.src;
    }
    logoSubs.forEach((f) => f());
  };
  im.onerror = () => { logoUrl = im.src; logoSubs.forEach((f) => f()); };
  im.src = `${base}images/logo_white.png`;
}
export function LogoImg({ className = '', drop = true }: { className?: string; drop?: boolean }) {
  const [url, setUrl] = useState<string | null>(logoUrl);
  useEffect(() => {
    if (logoUrl) { setUrl(logoUrl); return; }
    ensureLogo();
    const cb = () => setUrl(logoUrl);
    logoSubs.add(cb);
    return () => { logoSubs.delete(cb); };
  }, []);
  if (!url) return <div className={className} aria-hidden />;
  return (
    <img
      src={url}
      alt="Trick or Treat — Last Kid Standing"
      className={className}
      style={drop ? { filter: 'drop-shadow(4px 5px 0 rgba(0,0,0,0.9)) drop-shadow(0 0 26px rgba(249,120,27,0.35))' } : undefined}
      draggable={false}
    />
  );
}

export function Tagline({ className = '' }: { className?: string }) {
  return (
    <div className={`font-title pointer-events-none select-none leading-none ${className}`} style={{ transform: 'rotate(-3deg)' }}>
      <span className="text-[#FFC453]" style={{ textShadow: '3px 3px 0 #000' }}>Same streets. </span>
      <span className="text-[#E63946]" style={{ textShadow: '3px 3px 0 #000' }}>Scarier nights.</span>
    </div>
  );
}

// ============ KIT PRIMITIVES ============

export function Btn({
  children, onClick, disabled, variant = 'primary', className = '', icon: Icon, block,
}: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; variant?: 'primary' | 'ghost' | 'dark' | 'secondary' | 'danger' | 'cream'; className?: string; icon?: LucideIcon; block?: boolean;
}) {
  const base = 'kit-clip group relative flex items-center gap-2 border-2 px-4 py-2 sm:gap-2.5 sm:px-5 sm:py-2.5 font-cond uppercase tracking-wider text-xs sm:text-sm transition-all duration-100 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:translate-y-0';
  const v =
    variant === 'primary'
      ? 'border-black bg-[#F9781B] text-black shadow-[inset_0_-4px_0_rgba(0,0,0,0.28)] hover:bg-[#ff8c33] hover:shadow-[inset_0_-4px_0_rgba(0,0,0,0.28),0_0_18px_rgba(249,120,27,0.45)]'
      : variant === 'danger'
        ? 'border-black bg-[#E63946] text-black shadow-[inset_0_-4px_0_rgba(0,0,0,0.3)] hover:bg-[#ff4d5a]'
        : variant === 'cream'
        ? 'border-black bg-[#F4E8D5] text-[#20242e] shadow-[inset_0_-4px_0_rgba(0,0,0,0.18)] hover:bg-white'
        : variant === 'secondary'
          ? 'border-[#7A45F2] bg-[#7A45F2]/10 text-[#b79bff] hover:bg-[#7A45F2]/25'
          : variant === 'dark'
            ? 'border-[#3a3f4d] bg-[#171b24] text-[#F4E8D5] hover:border-[#F9781B] hover:text-[#F9781B]'
            : 'border-[#F9781B]/60 bg-transparent text-[#F9781B] hover:bg-[#F9781B]/10';
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${v} ${block ? 'w-full justify-start' : ''} ${className}`}>
      {variant === 'primary' && !Icon && <span className="text-[10px] leading-none">▶</span>}
      {Icon && <Icon size={16} strokeWidth={2.6} className="shrink-0" />}
      <span className="leading-none">{children}</span>
    </button>
  );
}

export function Keycap({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-[3px] border border-[#F4E8D5]/50 border-b-2 border-b-[#F4E8D5]/70 bg-[#1a1f29] px-1.5 font-cond2 text-[12px] font-bold text-[#F4E8D5] shadow-[0_1px_0_#000] ${wide ? 'px-2.5' : ''}`}>
      {children}
    </span>
  );
}

export function PanelTab({ children, color = '#F4E8D5', dark }: { children: React.ReactNode; color?: string; dark?: boolean }) {
  return (
    <span className="kit-tab inline-block px-2.5 py-0.5 font-cond2 text-[11px] font-bold uppercase tracking-[0.14em]" style={{ background: color, color: dark ? '#0E1117' : '#0E1117' }}>
      {children}
    </span>
  );
}

export function KitPanel({ label, labelColor, children, className = '' }: { label?: string; labelColor?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      {label && (
        <div className="absolute -top-3 left-3 z-10">
          <PanelTab color={labelColor}>{label}</PanelTab>
        </div>
      )}
      <div className="kit-panel h-full">{children}</div>
    </div>
  );
}

export function Bar({ value, max, color, icon, className = '', h = 14 }: { value: number; max: number; color: string; icon?: React.ReactNode; className?: string; h?: number }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className={`relative flex items-center gap-1.5 ${className}`}>
      {icon}
      <div className="relative flex-1 overflow-hidden rounded-[3px] border border-black bg-[#1a1f29]" style={{ height: h, boxShadow: 'inset 0 2px 3px rgba(0,0,0,0.6)' }}>
        <div className="h-full transition-[width] duration-150" style={{ width: `${pct}%`, background: color, boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.3), inset 0 2px 0 rgba(255,255,255,0.25)' }} />
        <div className="absolute inset-0 flex items-center justify-center font-cond2 text-[11px] font-bold text-white" style={{ textShadow: '0 1px 2px #000, 0 0 4px #000' }}>
          {Math.ceil(Math.max(0, value))} / {Math.round(max)}
        </div>
      </div>
    </div>
  );
}

export function Check({ on }: { on: boolean }) {
  return (
    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border-2 ${on ? 'border-[#F9781B] bg-[#F9781B]' : 'border-[#5a6070] bg-transparent'}`}>
      {on && (
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path d="M1 3.5L4 6.5L9 1" stroke="#0E1117" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      )}
    </span>
  );
}

export function KitToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} className={`relative h-5 w-10 rounded-full border-2 transition-colors ${on ? 'border-[#7CFF64] bg-[#7CFF64]/25' : 'border-[#5a6070] bg-[#1a1f29]'}`}>
      <span className={`absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full transition-all ${on ? 'left-[22px] bg-[#7CFF64]' : 'left-[3px] bg-[#5a6070]'}`} />
    </button>
  );
}

export function Slot({ children, hotkey, active, count, className = '' }: { children: React.ReactNode; hotkey?: string; active?: boolean; count?: string; className?: string }) {
  return (
    <div className={`kit-clip relative flex items-center gap-2 border-2 bg-[#0E1117]/95 px-2.5 py-2 ${active ? 'border-[#F9781B] shadow-[0_0_14px_rgba(249,120,27,0.35)]' : 'border-[#3a3f4d]'} ${className}`}>
      {children}
      {hotkey && (
        <span className="absolute -top-0.5 right-1.5 flex h-5 min-w-5 items-center justify-center rounded-[3px] border border-[#3a3f4d] bg-[#171b24] px-1 font-cond2 text-[11px] font-bold text-[#F4E8D5]">{hotkey}</span>
      )}
      {count !== undefined && (
        <span className="absolute -bottom-0.5 right-1.5 font-cond2 text-[10px] font-bold text-[#9aa3b8]">{count}</span>
      )}
    </div>
  );
}

// ============ GAME-SPECIFIC ============

export function HeroPreview({ hero, size = 2, walking = true, costume = null }: { hero: number; size?: number; walking?: boolean; costume?: string | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const s = heroSheet(hero, costume);
    const c = ref.current!;
    const ctx = c.getContext('2d')!;
    let raf = 0;
    const t0 = performance.now();
    const loop = (t: number) => {
      const n = walking ? 6 : 4;
      const f = Math.floor(((t - t0) / 1000) * 9) % n;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(c.width / 2, c.height - 8 * size, 16 * size, 6 * size, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.drawImage(s.img, f * s.fw, (walking ? 1 : 0) * s.fh, s.fw, s.fh, 0, 0, s.fw * size, s.fh * size);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [hero, size, walking, costume]);
  return <canvas ref={ref} width={64 * size} height={96 * size} className="block" />;
}

export const RARITY_KIT = ['#9aa3b8', '#7CFF64', '#4fb3ff', '#7A45F2', '#FFC453'];

export function WeaponCard({ w, stats, compare, title, compact }: { w: Weapon; stats: Stats; compare?: Weapon | null; title?: string; compact?: boolean }) {
  const st = weaponStats(w, stats);
  const rc = RARITY_KIT[w.rarity];
  const dps = weaponDps(w, stats);
  const cdps = compare ? weaponDps(compare, stats) : null;
  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
    <div className="flex items-center justify-between border-b border-white/5 py-1 last:border-0">
      <span className="font-cond2 text-[12px] font-semibold uppercase tracking-wide text-[#9aa3b8]">{k}</span>
      <span className="font-cond2 text-[13px] font-bold text-[#F4E8D5]">{v}</span>
    </div>
  );
  return (
    <div className={`kit-clip max-w-full border-2 bg-[#0E1117]/95 ${compact ? 'w-56 p-2.5' : 'w-72 p-3.5'}`} style={{ borderColor: rc, boxShadow: `0 0 22px ${rc}44, inset 0 0 30px rgba(0,0,0,0.5)` }}>
      {title && <div className="mb-1.5"><PanelTab>{title}</PanelTab></div>}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded-[4px] border border-black bg-[#171b24]">
          <img src={weaponUrl(w.def.id)} className="h-8 w-16 [image-rendering:pixelated]" alt="" />
        </div>
        <div className="min-w-0">
          <div className="font-cond text-lg leading-tight text-[#F4E8D5]">{w.def.name}</div>
          <div className="font-cond2 text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: rc }}>
            {RARITY[w.rarity].name}{w.level > 1 ? ` · LV ${w.level}` : ''}
          </div>
        </div>
      </div>
      <p className="mt-2 text-[11px] italic leading-snug text-[#9aa3b8]">{w.def.desc}</p>
      <div className="mt-2">
        <Row k="Damage" v={`${Math.round(st.dmg)}${st.pellets > 1 ? ' × ' + st.pellets : ''}`} />
        <Row k="Fire Rate" v={`${st.rate.toFixed(1)}/s`} />
        <Row k="Magazine" v={st.mag} />
        <Row k="Reload" v={`${st.reload.toFixed(2)}s`} />
        <Row
          k="DPS"
          v={
            <span>
              {dps}
              {cdps !== null && <span className={dps >= cdps ? 'ml-1.5 text-[#7CFF64]' : 'ml-1.5 text-[#E63946]'}>{dps >= cdps ? '▲' : '▼'}{Math.abs(dps - cdps)}</span>}
            </span>
          }
        />
        {st.pierce > 0 && st.pierce < 50 && <Row k="Pierce" v={st.pierce} />}
        {st.bounce > 0 && <Row k="Ricochet" v={st.bounce} />}
        {w.def.explode > 0 && <Row k="Explosion" v={`${w.def.explode.toFixed(1)} tiles`} />}
        {st.fire > 0 && <Row k="Burn" v={<span className="text-[#F9781B]">{Math.round(st.fire * 100)}%</span>} />}
        {st.shock > 0 && <Row k="Shock" v={<span className="text-[#7fd8ff]">{Math.round(st.shock * 100)}%</span>} />}
        {st.ecto > 0 && <Row k="Ecto" v={<span className="text-[#7CFF64]">{Math.round(st.ecto * 100)}%</span>} />}
      </div>
      {w.traits.length > 0 && (
        <div className="mt-2 border-t-2 border-white/10 pt-2">
          {w.traits.map((t, i) => (
            <div key={i} className="text-[11px] leading-snug">
              <span className="font-bold text-[#FFC453]">◆ {TRAIT_BY_ID[t].name}</span>{' '}
              <span className="text-[#9aa3b8]">{TRAIT_BY_ID[t].desc}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const fmtTime = (t: number) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
