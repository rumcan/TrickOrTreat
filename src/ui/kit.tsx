// ===== UI kit primitives (art/concept/ui-kit.webp) =====
import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ART, BANNER_ART, BannerKind } from './art';

type BtnVariant = 'orange' | 'dark' | 'cream' | 'teal' | 'red';
const BTN_SIZE = { sm: 'h-9 px-3.5 text-sm', md: 'h-11 px-5 text-base', lg: 'h-14 px-6 text-xl' };
const ICON_SIZE = { sm: 15, md: 18, lg: 24 };

export function KitButton({
  children, onClick, disabled, variant = 'orange', size = 'md', icon: Icon, iconColor, fillIcon, className = '', title,
}: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; variant?: BtnVariant; size?: keyof typeof BTN_SIZE; icon?: LucideIcon; iconColor?: string; fillIcon?: boolean; className?: string; title?: string;
}) {
  return (
    <button onClick={onClick} disabled={disabled} title={title} className={`kit-btn kit-btn-${variant} ${BTN_SIZE[size]} ${className}`}>
      {Icon && <Icon size={ICON_SIZE[size]} strokeWidth={2.5} className="shrink-0" style={{ color: iconColor }} fill={fillIcon ? 'currentColor' : 'none'} />}
      <span className="whitespace-nowrap">{children}</span>
    </button>
  );
}

export function Keycap({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`kit-key ${className}`}>{children}</span>;
}

/** orange outlined display title ("PAUSED", "TRICK OR TREAT") */
export function KitTitle({ children, className = '', color = '#fb8016' }: { children: ReactNode; className?: string; color?: string }) {
  return (
    <div className={`font-cond uppercase leading-none kit-outline ${className}`} style={{ color }}>
      {children}
    </div>
  );
}

export function Bar({ value, max, color, icon, label = true, h = 14, className = '' }: { value: number; max: number; color: string; icon?: ReactNode; label?: boolean; h?: number; className?: string }) {
  const k = Math.max(0, Math.min(1, value / Math.max(1, max)));
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {icon}
      <div className="relative flex-1 overflow-hidden border border-black bg-[#1c1e24]" style={{ height: h, boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08)' }}>
        {/* scaleX keeps updates on the compositor: no layout per HUD tick */}
        <div className="absolute inset-0 origin-left transition-transform duration-150" style={{ transform: `scaleX(${k})`, background: color, boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.25), inset 0 2px 0 rgba(255,255,255,0.25)' }} />
        {label && (
          <div className="absolute inset-0 flex items-center justify-center font-num text-[10px] leading-none text-white" style={{ textShadow: '0 1px 2px #000, 0 0 3px #000' }}>
            {Math.ceil(Math.max(0, value))} / {Math.round(max)}
          </div>
        )}
      </div>
    </div>
  );
}

export function Chip({ icon, children, color = '#f2e6c9', className = '' }: { icon?: ReactNode; children: ReactNode; color?: string; className?: string }) {
  return (
    <div className={`kit-chip font-num text-sm leading-none ${className}`} style={{ color }}>
      {icon}
      <span>{children}</span>
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      onClick={() => onChange(!on)}
      aria-pressed={on}
      aria-label={label}
      className="relative flex h-8 w-[84px] shrink-0 items-center rounded-full border-2 bg-[#0b0c0f] shadow-[0_0_0_1px_#000]"
      style={{ borderColor: on ? '#5ea26b' : '#b53f3d' }}
    >
      <span className={`absolute top-1/2 font-cond2 text-sm font-bold uppercase leading-none -translate-y-1/2 ${on ? 'left-3 text-[#cfe8c8]' : 'right-3 text-[#f2e6c9]'}`}>{on ? 'On' : 'Off'}</span>
      <span className="absolute top-1/2 h-[22px] w-[22px] -translate-y-1/2 rounded-full transition-[left] duration-150" style={{ left: on ? 54 : 3, background: on ? '#5ea26b' : '#b53f3d', boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.25)' }} />
    </button>
  );
}

export function Slider({ value, onChange, min = 0, max = 1, step = 0.05, icon: Icon, label }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; icon?: LucideIcon; label?: string }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex items-center gap-2.5">
      {Icon && <Icon size={20} className="shrink-0 text-[#f4e6c4]" fill="currentColor" />}
      <input
        type="range" min={min} max={max} step={step} value={value} aria-label={label}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="kit-range w-44"
        style={{ '--p': `${pct}%` } as CSSProperties}
      />
    </div>
  );
}

export function IconTile({ icon: Icon, onClick, active, title, color, className = '' }: { icon: LucideIcon; onClick?: () => void; active?: boolean; title?: string; color?: string; className?: string }) {
  return (
    <button onClick={onClick} title={title} aria-label={title} className={`kit-tile flex h-10 w-10 items-center justify-center ${active ? '!border-black !bg-[#fb8016]' : ''} ${className}`}>
      <Icon size={20} strokeWidth={2.4} style={{ color: active ? '#0c0b0a' : color ?? '#f4e6c4' }} />
    </button>
  );
}

const BANNER: Record<BannerKind, { bg: string; border: string; text: string }> = {
  mission: { bg: 'linear-gradient(180deg,#2a0700 0%,#5a1a04 62%,#7a2404 100%)', border: '#ed8337', text: '#f4dfc2' },
  died: { bg: 'linear-gradient(180deg,#43101a 0%,#1c0f16 100%)', border: '#b33846', text: '#ff3d55' },
  level: { bg: 'linear-gradient(180deg,#03252a 0%,#021a20 100%)', border: '#3faeb1', text: '#1fc8da' },
  weapon: { bg: 'linear-gradient(180deg,#2a1714 0%,#171717 100%)', border: '#c9a24a', text: '#f7c636' },
  tot: { bg: 'linear-gradient(180deg,#26131c 0%,#4a120c 100%)', border: '#bb8839', text: '#fb7d1c' },
};
const BANNER_SIZE = { sm: { h: 58, t: 28, s: 11 }, md: { h: 78, t: 40, s: 13 }, lg: { h: 112, t: 62, s: 15 } };

/** illustrated plate ("MISSION COMPLETE", "YOU DIED", "LEVEL UP!", "NEW WEAPON!", "TRICK OR TREAT!") */
export function Banner({ kind, title, sub, size = 'md', className = '', style }: { kind: BannerKind; title: ReactNode; sub?: ReactNode; size?: keyof typeof BANNER_SIZE; className?: string; style?: CSSProperties }) {
  const b = BANNER[kind], z = BANNER_SIZE[size];
  // shrink long titles to the plate's width (cqw = % of the text column), so any announcement fits on any screen
  const chars = typeof title === 'string' ? Math.max(8, title.length) : 12;
  const fit = `min(${z.t}px, ${(100 / (0.56 * chars)).toFixed(2)}cqw)`;
  return (
    <div className={`relative flex overflow-hidden ${className}`} style={{ height: z.h, background: b.bg, border: `2px solid ${b.border}`, boxShadow: '0 0 0 2px #000, 0 12px 30px rgba(0,0,0,0.6)', ...style }}>
      <img src={BANNER_ART[kind]} alt="" draggable={false} className="h-full w-auto max-w-[42%] shrink-0 object-cover object-left" style={{ maskImage: 'linear-gradient(90deg,#000 62%,transparent)', WebkitMaskImage: 'linear-gradient(90deg,#000 62%,transparent)' }} />
      <div className="relative -ml-4 flex min-w-0 flex-1 flex-col justify-center pr-5" style={{ containerType: 'inline-size' }}>
        <div className="truncate font-cond uppercase leading-[1.05] kit-outline" style={{ color: b.text, fontSize: fit }}>{title}</div>
        {sub && <div className="truncate font-cond2 font-bold uppercase tracking-[0.12em] text-[#f2e6c9]" style={{ fontSize: z.s, textShadow: '0 1px 2px #000' }}>{sub}</div>}
      </div>
    </div>
  );
}

export function Toast({ face, children }: { face: string; children: ReactNode }) {
  return (
    <div className="kit-panel kit-slide-in flex items-center gap-3 py-1.5 pl-1.5 pr-4">
      <img src={face} alt="" className="h-11 w-11 shrink-0 border border-black object-cover" draggable={false} />
      <span className="font-ui text-sm font-semibold text-[#f2e6c9]">{children}</span>
    </div>
  );
}

export function LogoImg({ className = '', small }: { className?: string; small?: boolean }) {
  const src = small ? ART.logoSm : ART.logo;
  const [decodedSrc, setDecodedSrc] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const image = new Image();
    image.fetchPriority = 'high';
    image.src = src;
    // Reveal only a complete decoded frame; slow connections must not paint PNG-like strips.
    void image.decode().then(() => { if (active) setDecodedSrc(src); }).catch(() => undefined);
    return () => { active = false; };
  }, [src]);
  return <img src={src} alt="Trick or Treat — Maple Falls" width={small ? 640 : 1240} height={small ? 239 : 462} decoding="async" fetchPriority="high" className={className} draggable={false} style={{ height: 'auto', opacity: decodedSrc === src ? 1 : 0, filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.7))' }} />;
}
