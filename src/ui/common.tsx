import { useEffect, useRef } from 'react';
import { Tornado, Camera, Wrench, Moon } from 'lucide-react';
import { weaponIcon } from '../game/art/fx';
import { heroSheet, blitFrame } from '../game/art/characters';
import { imgUrl } from '../game/assets';
import { treatArt } from '../game/art/treats';
import { RARITY } from '../game/config';
import { Weapon, weaponStats, Stats, TRAIT_BY_ID, INSC_STYLE, weaponDps, HERO_INFO } from '../game/data';
import { ART, PORTRAITS, HERO_COLORS } from './art';
import { Keycap, KitTitle } from './kit';

export { imgUrl };
export const weaponUrl = (id: string) => imgUrl(weaponIcon(id));
export const fmtTime = (t: number) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
export const RARITY_KIT = ['#9aa0a6', '#7cff64', '#4fb3ff', '#a46bff', '#ffc453'];

// ============ GLYPHS (filled icons as drawn in the kit) ============
type G = { size?: number; className?: string };
const svg = (size: number, className: string, children: React.ReactNode) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={`shrink-0 ${className}`} aria-hidden>{children}</svg>
);
export const HeartIcon = ({ size = 16, className = '' }: G) => svg(size, className, <path fill="#f92f36" stroke="#000" strokeWidth="1.2" d="M12 21.2l-1.5-1.3C5.4 15.3 2 12.3 2 8.5 2 5.4 4.4 3 7.5 3c1.7 0 3.4.8 4.5 2.1C13.1 3.8 14.8 3 16.5 3 19.6 3 22 5.4 22 8.5c0 3.8-3.4 6.8-8.5 11.4z" />);
export const ShieldIcon = ({ size = 16, className = '' }: G) => svg(size, className, <><path fill="#28aed5" stroke="#000" strokeWidth="1.2" d="M12 2l8.5 3v6.2c0 5-3.6 9.5-8.5 10.8-4.9-1.3-8.5-5.8-8.5-10.8V5z" /><path fill="#bfeefa" opacity=".55" d="M12 4.3l-6.3 2.3v4.6c0 1.4.3 2.8.9 4L12 6.9z" /></>);
export const SkullIcon = ({ size = 16, className = '' }: G) => svg(size, className, <path fill="#f4e6c4" fillRule="evenodd" d="M12 2C7 2 3 5.6 3 10.2c0 2.6 1.3 4.9 3.3 6.4V20c0 .6.4 1 1 1H9v-2h1.5v2h3v-2H15v2h1.7c.6 0 1-.4 1-1v-3.4c2-1.5 3.3-3.8 3.3-6.4C21 5.6 17 2 12 2zM8.4 14.2a2.3 2.3 0 110-4.6 2.3 2.3 0 010 4.6zm7.2 0a2.3 2.3 0 110-4.6 2.3 2.3 0 010 4.6zM12 16l-1.4-2.6h2.8z" />);
export const CoinIcon = ({ size = 16, className = '' }: G) => svg(size, className, <><circle cx="12" cy="12" r="9.5" fill="#e89a1c" stroke="#5a3606" strokeWidth="1.4" /><circle cx="12" cy="12" r="6.2" fill="#f7c043" stroke="#b9730f" strokeWidth="1.2" /><path d="M10 9.5c1.2-1 3.3-.8 3.9.5" stroke="#fff3c4" strokeWidth="1.4" fill="none" strokeLinecap="round" /></>);
export const CandyIcon = ({ size = 16, className = '' }: G) => svg(size, className, <><path fill="#ff5f9e" stroke="#000" strokeWidth="1" d="M2 7.5l5 4.5-5 4.5zM22 7.5l-5 4.5 5 4.5z" /><circle cx="12" cy="12" r="5.6" fill="#ff5f9e" stroke="#000" strokeWidth="1.1" /><path d="M9.2 9.5l5.4 5" stroke="#ffd1e6" strokeWidth="1.6" strokeLinecap="round" /></>);
export const HouseIcon = ({ size = 16, className = '' }: G) => svg(size, className, <path fill="#fb8016" d="M12 3l9.5 8.4h-2.8V21h-5v-6h-3.4v6h-5v-9.6H2.5z" />);
export const ClockIcon = ({ size = 16, className = '' }: G) => svg(size, className, <><circle cx="12" cy="12" r="9.5" fill="#fb8016" /><path d="M12 6.5V12l3.5 2.2" stroke="#16100a" strokeWidth="2.2" fill="none" strokeLinecap="round" /></>);
export const CloverIcon = ({ size = 16, className = '' }: G) => svg(size, className, <g fill="#3fa34d" stroke="#0d2a12" strokeWidth=".9"><circle cx="12" cy="7.2" r="4" /><circle cx="7.2" cy="12" r="4" /><circle cx="16.8" cy="12" r="4" /><circle cx="12" cy="16.4" r="4" /><path d="M12 13l2.5 8" fill="none" strokeWidth="1.8" /></g>);

/** the kit check box (objectives) */
export function Check({ on }: { on: boolean }) {
  return (
    <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[3px] border-2 ${on ? 'border-black bg-[#fb8016]' : 'border-[#8a8f8c] bg-[#0b0c0f]'}`}>
      {on && (
        <svg width="11" height="9" viewBox="0 0 10 8" fill="none">
          <path d="M1 3.5L4 6.5L9 1" stroke="#0e0f13" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      )}
    </span>
  );
}

/** hero skill icon: Tommy's pumpkin comes from the kit art */
export function SkillIcon({ hero, size = 40 }: { hero: number; size?: number }) {
  if (hero === 0) return <img src={ART.skillPumpkin} alt="" draggable={false} style={{ width: size, height: size }} className="shrink-0 object-cover" />;
  const Icon = hero === 1 ? Tornado : hero === 3 ? Wrench : hero === 4 ? Moon : Camera;
  return (
    <span className="flex shrink-0 items-center justify-center bg-[#16181d]" style={{ width: size, height: size, color: HERO_COLORS[hero] }}>
      <Icon size={size * 0.62} strokeWidth={2.4} />
    </span>
  );
}

// ============ SPRITE PREVIEW ============
/** Animated in-game sprite. Only repaints when the frame changes (9 fps). */
export function HeroPreview({ hero, size = 2, walking = true, costume = null, staticFrame = false }: { hero: number; size?: number; walking?: boolean; costume?: string | null; staticFrame?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const s = heroSheet(hero, costume);
    const c = ref.current!;
    const ctx = c.getContext('2d')!;
    if (staticFrame) {
      // Choose an idle cell that is least clipped at its edges; no walking or fake ground shadow.
      const probe = document.createElement('canvas'); probe.width = s.fw; probe.height = s.fh;
      const pc = probe.getContext('2d', { willReadFrequently: true })!;
      let selected = 0, best = Infinity;
      for (let f = 0; f < (s.rowFrames[0] || 1); f++) {
        pc.clearRect(0, 0, s.fw, s.fh); blitFrame(pc, s, s.img, 0, f, s.ax, s.ay);
        const pixels = pc.getImageData(0, 0, s.fw, s.fh).data;
        let clipped = 0;
        for (let y = 0; y < s.fh; y++) for (let x = 0; x < s.fw; x++) if ((x === 0 || y === 0 || x === s.fw - 1 || y === s.fh - 1) && pixels[(y * s.fw + x) * 4 + 3] > 32) clipped++;
        if (clipped < best) { best = clipped; selected = f; }
      }
      ctx.clearRect(0, 0, c.width, c.height); ctx.scale(size, size);
      blitFrame(ctx, s, s.img, 0, selected, s.ax, s.ay);
      return;
    }
    let raf = 0, last = -1;
    const t0 = performance.now();
    const row = walking ? 1 : 0;
    const loop = (t: number) => {
      const f = Math.floor(((t - t0) / 1000) * 9) % (s.rowFrames[row] || 1);
      if (f !== last) {
        last = f;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.ellipse(c.width / 2, c.height - 8 * size, 16 * size, 6 * size, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.setTransform(size, 0, 0, size, 0, 0);
        blitFrame(ctx, s, s.img, row, f, s.ax, s.ay);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [hero, size, walking, costume, staticFrame]);
  return <canvas ref={ref} width={64 * size} height={96 * size} className="block" />;
}

// ============ CARDS ============
export function WeaponCard({ w, stats, compare, title, compact, bigInsc, className = '' }: { w: Weapon; stats: Stats; compare?: Weapon | null; title?: string; compact?: boolean; bigInsc?: boolean; className?: string }) {
  const st = weaponStats(w, stats);
  const rc = RARITY_KIT[w.rarity];
  const dps = weaponDps(w, stats);
  const cdps = compare ? weaponDps(compare, stats) : null;
  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
    <div className="flex items-center justify-between border-b border-[#2a2d33] py-[5px] last:border-0">
      <span className="font-ui text-[13px] text-[#e6dcc4]">{k}</span>
      <span className="font-ui text-[13px] font-bold text-white">{v}</span>
    </div>
  );
  return (
    <div className={`kit-panel relative max-w-full ${compact ? 'w-60 p-3' : 'w-72 p-4'} ${className}`} style={{ borderColor: w.rarity ? rc : '#58585b' }}>
      {title && <div className="absolute -top-3 left-3"><Keycap className="!h-5 !text-[11px] uppercase tracking-wider">{title}</Keycap></div>}
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-20 shrink-0 items-center justify-center">
          <img src={weaponUrl(w.def.id)} className="h-10 w-20 [image-rendering:pixelated]" style={{ filter: 'drop-shadow(0 3px 0 rgba(0,0,0,0.6))' }} alt="" />
        </div>
        <div className="min-w-0">
          <div className="font-cond text-xl uppercase leading-tight text-[#f2e6c9]">{w.def.name}</div>
          <div className="font-cond2 text-[13px] font-semibold uppercase tracking-wide text-[#9aa0a6]">
            <span style={{ color: w.rarity ? rc : undefined }}>{RARITY[w.rarity].name}</span> - Lv {w.level}
          </div>
        </div>
      </div>
      {!compact && <p className="mt-2 text-[12px] italic leading-snug text-[#9aa0a6]">{w.def.desc}</p>}
      <div className="mt-2.5 rounded-[6px] border border-[#3a3d44] bg-black/30 px-3 py-0.5">
        <Row
          k="DPS"
          v={
            <span>
              {dps}
              {cdps !== null && <span className={dps >= cdps ? 'ml-1.5 text-[#7cff64]' : 'ml-1.5 text-[#ff4d5a]'}>{dps >= cdps ? '▲' : '▼'}{Math.abs(dps - cdps)}</span>}
            </span>
          }
        />
        <Row k="Damage" v={`${Math.round(st.dmg)}${st.pellets > 1 ? ' × ' + st.pellets : ''}`} />
        <Row k="Fire rate" v={`${st.rate.toFixed(1)}/s`} />
        <Row k="Magazine" v={st.mag} />
        <Row k="Reload" v={`${st.reload.toFixed(2)}s`} />
        {st.pierce > 0 && st.pierce < 50 && <Row k="Pierce" v={st.pierce} />}
        {st.bounce > 0 && <Row k="Ricochet" v={st.bounce} />}
        {w.def.explode > 0 && <Row k="Explosion" v={`${w.def.explode.toFixed(1)} tiles`} />}
        {st.fire > 0 && <Row k="Burn" v={<span className="text-[#fb8016]">{Math.round(st.fire * 100)}%</span>} />}
        {st.shock > 0 && <Row k="Shock" v={<span className="text-[#7fd8ff]">{Math.round(st.shock * 100)}%</span>} />}
        {st.ecto > 0 && <Row k="Ecto" v={<span className="text-[#7cff64]">{Math.round(st.ecto * 100)}%</span>} />}
      </div>
      <Inscriptions w={w} compact={compact} big={bigInsc} />
    </div>
  );
}

/** a gun's inscription lines, Gunfire Reborn style: tier glyph + name + effect, colour-coded by tier */
export function Inscriptions({ w, compact, big }: { w: Weapon; compact?: boolean; big?: boolean }) {
  if (!w.traits.length) return compact ? null : <div className="mt-2 font-cond2 text-[11px] font-bold uppercase tracking-wider text-[#5f6470]">No inscriptions</div>;
  return (
    <div className={`mt-2 ${big ? 'space-y-1.5' : 'space-y-0.5'}`}>
      {w.traits.map((t, i) => {
        const tr = TRAIT_BY_ID[t];
        if (!tr) return null;
        const st = INSC_STYLE[tr.tier];
        return (
          <div key={i} className={`${big ? 'border-l-[3px] pl-2.5 text-[13px]' : 'text-[11px]'} leading-snug`} style={{ borderColor: st.color }}>
            <span className="font-bold" style={{ color: st.color }}>{st.glyph} {tr.name}</span>
            {big && <span className="ml-1.5 font-cond2 text-[10px] font-bold uppercase tracking-widest text-[#6c7280]">{st.label}</span>}
            {big ? <div className="text-[#d8cfbb]">{tr.desc}</div> : <span className="text-[#9aa0a6]"> {tr.desc}</span>}
          </div>
        );
      })}
    </div>
  );
}

function Arrow({ dir, onClick }: { dir: -1 | 1; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label={dir < 0 ? 'Previous kid' : 'Next kid'} className="absolute top-1/2 z-10 -translate-y-1/2 p-1 text-[#141210] transition-transform hover:scale-110 active:scale-95" style={{ [dir < 0 ? 'left' : 'right']: -34 }}>
      <svg width="24" height="44" viewBox="0 0 24 44"><path d={dir < 0 ? 'M22 2L2 22l20 20z' : 'M2 2l20 20L2 42z'} fill="currentColor" /></svg>
    </button>
  );
}

/** the cream character card from the kit */
export function CharacterCard({ hero, stats, onPrev, onNext }: { hero: number; stats: Stats; onPrev?: () => void; onNext?: () => void }) {
  const h = HERO_INFO[hero];
  const barW = (v: number) => `${Math.min(100, (v / 200) * 100)}%`;
  return (
    <div className="kit-paper kit-pop flex w-full max-w-[640px] flex-col gap-6 p-5 sm:flex-row sm:p-6">
      <div className="relative mx-10 shrink-0 self-center sm:mx-8">
        {onPrev && <Arrow dir={-1} onClick={onPrev} />}
        <div className="h-[260px] w-[176px] overflow-hidden border-[3px] border-[#1a1712] sm:h-[300px] sm:w-[200px]" style={{ background: HERO_COLORS[hero] }}>
          <img src={PORTRAITS[hero]} alt={h.name} draggable={false} className="h-full w-full object-cover object-top" />
        </div>
        {onNext && <Arrow dir={1} onClick={onNext} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-cond text-5xl uppercase leading-none tracking-wide text-[#1d1d1b] sm:text-6xl">{h.name}</div>
        <div className="font-brush mt-1 text-xl uppercase leading-tight text-[#e2342f] sm:text-2xl">{h.title}</div>
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-3">
            <HeartIcon size={22} />
            <span className="font-num w-[86px] text-[15px] text-[#1d1d1b]">{Math.round(stats.maxHp)} / {Math.round(stats.maxHp)}</span>
            <span className="h-3 bg-[#f92f36]" style={{ width: barW(stats.maxHp) }} />
          </div>
          <div className="flex items-center gap-3">
            <ShieldIcon size={22} />
            <span className="font-num w-[86px] text-[15px] text-[#1d1d1b]">{Math.round(stats.maxShield)} / {Math.round(stats.maxShield)}</span>
            <span className="h-3 bg-[#28aed5]" style={{ width: barW(stats.maxShield) }} />
          </div>
          <div className="flex items-center gap-3">
            <CloverIcon size={22} />
            <span className="font-ui text-[15px] font-semibold text-[#1d1d1b]">Passive: <span className="text-[#2f8a3c]">{h.passive}</span></span>
          </div>
        </div>
        <div className="mt-4 flex gap-3 border border-[#b9a77c] bg-[#e2d2a6] p-2.5">
          <div className="h-14 w-14 shrink-0 self-start overflow-hidden border-2 border-[#3a2f20]"><SkillIcon hero={hero} size={52} /></div>
          <div className="min-w-0">
            <div className="font-cond2 text-lg font-bold uppercase leading-tight text-[#1d1d1b]">{h.skill} <span className="font-semibold normal-case text-[#4a4130]">({h.cd}s)</span></div>
            <div className="text-[13px] leading-snug text-[#2c2618]">{h.skillDesc}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ PANELS ============
function CtrlRow({ k, label }: { k: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3 py-[3px]">
      <div className="flex w-[128px] shrink-0 gap-1">{k}</div>
      <span className="font-ui text-[13px] text-[#e6dcc4]">{label}</span>
    </div>
  );
}
/** two-column controls panel from the kit */
export function ControlsPanel({ className = '' }: { className?: string }) {
  return (
      <div className={`kit-panel grid grid-cols-1 gap-x-8 px-4 py-3 sm:grid-cols-2 ${className}`}>
        <div className="touch-manual col-span-full mb-3 border-b border-white/20 pb-3 text-sm leading-relaxed text-white">
          <strong className="block text-[#b5f4cb]">Touch controls</strong>
          Left thumb: move. Right thumb: aim and fire. Without manual aiming, your gun automatically targets nearby monsters. Tap Interact to ring doorbells, pick up loot, revive a friend or use the cannon. Tap a weapon slot to switch; use the Skill, Dash and Reload buttons. At a doorstep, Dash becomes Flee. Your build, map and pause are in the top bar.
        </div>
      <div>
        <CtrlRow k={<><Keycap>W</Keycap><Keycap>A</Keycap><Keycap>S</Keycap><Keycap>D</Keycap></>} label="Move" />
        <CtrlRow k={<Keycap>LMB</Keycap>} label="Aim / Shoot" />
        <CtrlRow k={<Keycap>Space</Keycap>} label="Dash (i-frames)" />
        <CtrlRow k={<Keycap>E</Keycap>} label="Interact: Trick or Treat" />
        <CtrlRow k={<><Keycap>Q</Keycap><Keycap>1</Keycap><Keycap>2</Keycap></>} label="Swap weapon" />
      </div>
      <div>
        <CtrlRow k={<Keycap>Auto</Keycap>} label="Fires at nearest monster" />
        <CtrlRow k={<><Keycap>RMB</Keycap><Keycap>F</Keycap></>} label="Hero skill" />
        <CtrlRow k={<Keycap>E</Keycap>} label="Pick up / Shop" />
        <CtrlRow k={<Keycap>Space</Keycap>} label="While at a door: flee" />
        <CtrlRow k={<><Keycap>R</Keycap><span className="px-0.5 text-[#9aa0a6]">-</span><Keycap>Esc</Keycap></>} label="Reload - Pause" />
        <CtrlRow k={<Keycap>M</Keycap>} label="Map" />
      </div>
    </div>
  );
}

/** "TRICK OR TREAT — find candies…" panel with the big pumpkin */
export function InfoPanel({ className = '' }: { className?: string }) {
  return (
    <div className={`kit-panel-gold relative flex min-h-[124px] overflow-hidden ${className}`}>
      <div className="relative z-10 flex-1 py-3 pl-4 pr-2">
        <KitTitle className="text-2xl">Trick or Treat</KitTitle>
        <p className="mt-2 font-ui text-[15px] leading-relaxed text-[#f2e6c9]">
          Find candies 🍭, defeat monsters 👻, upgrade your weapons and survive the night!
        </p>
      </div>
      <img src={ART.infoPumpkin} alt="" draggable={false} className="h-[124px] w-auto shrink-0 self-end" style={{ maskImage: 'linear-gradient(90deg,transparent,#000 30%)', WebkitMaskImage: 'linear-gradient(90deg,transparent,#000 30%)' }} />
    </div>
  );
}

/** the 80s/90s-movie card art for a treat (procedural, or the generated PNG when one is dropped in) */
export function TreatArt({ id, className = '' }: { id: string; className?: string }) {
  return <img src={imgUrl(treatArt(id))} alt="" draggable={false} className={`block h-full w-full object-cover ${className}`} />;
}
