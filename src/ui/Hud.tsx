import { Heart, Zap, Home, Candy, Map as MapIcon, DoorOpen } from 'lucide-react';
import { HudSnap, Game } from '../game/engine';
import { HERO_INFO, SCROLL_BY_ID, weaponTitle, COSTUME_BY_ID } from '../game/data';
import { weaponUrl, fmtTime, HeroPreview, Bar, Keycap, PanelTab, Slot, Check, RARITY_KIT } from './common';

function CostumeCard({ id, hero, title }: { id: string; hero: number; title: string }) {
  const c = COSTUME_BY_ID[id];
  return (
    <div className="kit-clip flex w-72 gap-2.5 border-2 bg-[#0E1117]/95 p-3" style={{ borderColor: c.color, boxShadow: `0 0 22px ${c.color}55` }}>
      <div className="-my-2 shrink-0"><HeroPreview hero={hero} size={0.9} walking costume={id} /></div>
      <div>
        <div className="font-cond2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#9aa3b8]">{title}</div>
        <div className="font-cond text-base leading-tight" style={{ color: c.color }}>{c.name}</div>
        <div className="mt-1 text-[11px] font-bold text-[#FFC453]">{c.power}</div>
        <div className="mt-1 text-[11px] text-[#7CFF64]">{c.perks}</div>
      </div>
    </div>
  );
}

export function Hud({ s, game }: { s: HudSnap; game: Game }) {
  const hero = HERO_INFO[game.hero];
  const cur = s.weapons[s.cur];
  const wave = Math.min(99, Math.floor(s.time / 60) + 1);
  const skillReady = s.skillCd <= 0;
  const segs = skillReady ? 4 : Math.floor((1 - s.skillCd / s.skillMax) * 4);
  const skillIcon = game.hero === 0 ? '🎃' : game.hero === 1 ? '🌪️' : '📸';
  const costume = s.costume ? COSTUME_BY_ID[s.costume] : null;
  return (
    <div className="pointer-events-none absolute inset-0 select-none font-ui text-[#F4E8D5]">
      {/* XP bar */}
      <div className="absolute left-0 right-0 top-0 h-1.5 bg-black/70">
        <div className="h-full bg-gradient-to-r from-[#7A45F2] via-[#b79bff] to-[#F9781B]" style={{ width: `${(s.xp / s.xpNext) * 100}%` }} />
      </div>

      {/* ===== player panel ===== */}
      <div className="absolute left-2 top-3 flex gap-2 sm:left-4 sm:top-4 sm:gap-2.5">
        <div className="relative h-14 w-14 shrink-0 sm:h-20 sm:w-20">
          <div className="absolute inset-0 overflow-hidden rounded-full border-[3px] border-[#F9781B] bg-[#171b24] shadow-[0_0_16px_rgba(249,120,27,0.5),inset_0_0_12px_rgba(0,0,0,0.8)]">
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 scale-110"><HeroPreview hero={game.hero} size={1} walking={false} costume={s.costume} /></div>
          </div>
          <div className="absolute -bottom-1 left-1/2 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border-2 border-black bg-[#FFC453] font-cond text-[13px] text-black shadow-[0_2px_4px_rgba(0,0,0,0.6)]">{s.level}</div>
        </div>
        <div className="kit-clip flex w-40 flex-col justify-center gap-1 border-2 border-[#3a3f4d] bg-[#0E1117]/90 px-2 py-1.5 sm:w-60 sm:gap-1.5 sm:px-3 sm:py-2">
          <div className="flex items-center justify-between">
            <span className="font-cond text-sm uppercase leading-none text-[#F4E8D5] sm:text-lg">{hero.name}</span>
            {costume && <span className="text-base" title={costume.name}>{costume.icon}</span>}
          </div>
          <Bar value={s.hp} max={s.maxHp} color="#E63946" h={15} icon={<Heart size={13} className="shrink-0 fill-[#E63946] text-[#E63946]" />} />
          <Bar value={s.shield} max={s.maxShield} color="#31c9e8" h={15} icon={<Zap size={13} className="shrink-0 fill-[#31c9e8] text-[#31c9e8]" />} />
        </div>
      </div>

      {/* ===== objective tracker ===== */}
      <div className="absolute left-4 top-[7.6rem] hidden w-[252px] md:block">
        <KitPanelLabel>Trick or Treat</KitPanelLabel>
        <div className="kit-panel space-y-2 px-3 py-3">
          <Objective on={s.costumesFound >= 3} label="Find costumes" val={`${Math.min(s.costumesFound, 3)}/3`} />
          <Objective on={s.doorsRung >= 5} label="Ring doorbells" val={`${s.doorsRung}/${Math.max(5, s.housesTotal)}`} />
          <Objective on={s.time >= 300} label="Survive until 05:00" />
        </div>
      </div>

      {/* treats */}
      <div className="absolute left-4 top-[17.5rem] hidden max-w-[250px] flex-wrap gap-1 md:flex">
        {Object.entries(s.scrolls).map(([id, n]) => {
          const sc = SCROLL_BY_ID[id];
          return (
            <div key={id} title={`${sc.name}: ${sc.desc}`} className="relative flex h-8 w-8 items-center justify-center rounded-[3px] border bg-black/70 text-base" style={{ borderColor: RARITY_KIT[sc.rarity] }}>
              {sc.icon}
              {n > 1 && <span className="absolute -bottom-1 -right-1 rounded-[2px] border border-black bg-[#F9781B] px-1 font-cond2 text-[9px] font-bold text-black">x{n}</span>}
            </div>
          );
        })}
      </div>

      {/* ===== top-center timer plate ===== */}
      <div className="absolute left-1/2 top-3 flex -translate-x-1/2 flex-col items-center gap-1 sm:top-4 sm:gap-1.5">
        <div className="kit-clip flex items-center gap-2.5 border-2 border-[#3a3f4d] bg-[#0E1117]/95 px-3 py-1.5 sm:gap-4 sm:px-6 sm:py-2">
          <span className="font-cond text-xs uppercase leading-none text-[#9aa3b8] sm:text-base">Night {wave}</span>
          <span className="font-cond text-2xl leading-none tracking-wider text-[#FFC453] sm:text-4xl" style={{ textShadow: '0 0 14px rgba(255,196,83,0.5)' }}>{fmtTime(s.time)}</span>
        </div>
        <div className="flex flex-wrap justify-center gap-1 sm:gap-1.5">
          <Chip icon={<span className="text-xs sm:text-sm">💀</span>} v={s.kills} />
          <Chip icon={<Candy size={12} className="text-[#FFC453]" />} v={`${s.doorsRung}/${s.housesTotal}`} />
          <Chip icon={<Home size={12} className="text-[#F9781B]" />} v={s.coins} color="#FFC453" />
        </div>
      </div>

      {/* minimap tag */}
      <div className="absolute right-2 top-2 hidden items-center gap-1.5 sm:flex">
        <MapIcon size={13} className="text-[#9aa3b8]" />
        <Keycap>M</Keycap>
      </div>

      {/* boss */}
      {s.boss && (
        <div className="absolute left-1/2 top-16 w-[min(540px,72vw)] -translate-x-1/2">
          <div className="mb-1 text-center font-cond text-xl uppercase tracking-[0.3em] text-[#F9781B]" style={{ textShadow: '0 0 14px rgba(249,120,27,0.7)' }}>The Pumpkin King</div>
          <div className="h-4 overflow-hidden rounded-[3px] border-2 border-black bg-[#1a1f29]">
            <div className="h-full bg-gradient-to-r from-[#b0340c] via-[#F9781B] to-[#FFC453]" style={{ width: `${(s.boss.hp / s.boss.max) * 100}%` }} />
          </div>
        </div>
      )}

      {/* banner plate */}
      {s.banner && <BannerPlate text={s.banner.text} sub={s.banner.sub} kind={s.banner.kind} t={s.banner.t} />}

      {/* ===== skill (bottom-left) ===== */}
      <div className="absolute bottom-3 left-2 flex items-end gap-1.5 sm:bottom-5 sm:left-4 sm:gap-2.5">
        <div className="kit-clip relative flex items-center gap-2 border-2 border-[#3a3f4d] bg-[#0E1117]/95 px-2 py-2 sm:gap-2.5 sm:px-3 sm:py-2.5">
          <span className="hidden sm:inline-flex"><Keycap wide>F</Keycap></span>
          <div className={`flex h-9 w-9 items-center justify-center rounded-[4px] border-2 text-xl sm:h-11 sm:w-11 sm:text-2xl ${skillReady ? 'border-[#F9781B] bg-[#F9781B]/15 shadow-[0_0_12px_rgba(249,120,27,0.5)]' : 'border-[#3a3f4d] bg-[#171b24]'}`}>{skillIcon}</div>
          <div className="hidden sm:block">
            <div className="font-cond2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#F4E8D5]">{hero.skill}</div>
            <div className="mt-1 flex gap-1">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className="kit-tab h-2.5 w-6" style={{ background: i < segs ? '#F9781B' : '#2a2f3a' }} />
              ))}
            </div>
          </div>
          <div className="flex gap-0.5 sm:hidden">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="kit-tab h-2 w-3.5" style={{ background: i < segs ? '#F9781B' : '#2a2f3a' }} />
            ))}
          </div>
        </div>
        <div className="kit-clip hidden items-center gap-2 border-2 border-[#3a3f4d] bg-[#0E1117]/90 px-3 py-2.5 sm:flex">
          <Keycap wide>Space</Keycap>
          <div className="mt-0.5 flex gap-1">
            {Array.from({ length: s.dashMax }).map((_, i) => (
              <span key={i} className="kit-tab h-2.5 w-5" style={{ background: i < s.dashCharges ? '#31c9e8' : '#2a2f3a' }} />
            ))}
          </div>
        </div>
      </div>

      {/* ===== weapon slots (bottom-right) ===== */}
      <div className="absolute bottom-3 right-2 flex items-end gap-1.5 sm:bottom-5 sm:right-4 sm:gap-2">
        {s.weapons.map((ws, i) =>
          ws ? (
            <Slot key={i} hotkey={String(i + 1)} active={i === s.cur} className="w-[86px] sm:w-[150px]">
              <img src={weaponUrl(ws.w.def.id)} className="h-7 w-11 shrink-0 sm:h-8 sm:w-14 [image-rendering:pixelated]" alt="" />
              <div className="hidden min-w-0 sm:block">
                <div className="truncate font-cond2 text-[10px] font-bold uppercase tracking-wide text-[#9aa3b8]">{weaponTitle(ws.w)}</div>
                <div className="font-cond text-lg leading-none" style={{ color: ws.w.reloadT > 0 ? '#F9781B' : '#F4E8D5' }}>
                  {ws.w.reloadT > 0 ? '…' : `${ws.w.ammo}/${ws.st.mag}`}
                </div>
              </div>
              <div className="font-cond text-sm leading-none sm:hidden" style={{ color: ws.w.reloadT > 0 ? '#F9781B' : '#F4E8D5' }}>
                {ws.w.reloadT > 0 ? '…' : ws.w.ammo}
              </div>
            </Slot>
          ) : (
            <Slot key={i} hotkey={String(i + 1)} className="hidden w-[150px] justify-center opacity-50 sm:flex">
              <span className="w-full text-center font-cond2 text-[11px] font-bold uppercase tracking-wide text-[#5a6070]">Empty</span>
            </Slot>
          )
        )}
        <Slot hotkey="F" className="hidden w-[104px] flex-col items-center !gap-1 py-2 sm:flex">
          <span className="text-2xl leading-none">{skillIcon}</span>
          <span className="font-cond2 text-[9px] font-bold uppercase tracking-wide text-[#9aa3b8]">{skillReady ? 'Ready' : `${s.skillCd.toFixed(1)}s`}</span>
        </Slot>
        <Slot className="hidden w-[64px] justify-center opacity-40 sm:flex">
          <span className="w-full text-center font-cond text-xl text-[#5a6070]">+</span>
        </Slot>
      </div>

      {/* trick-or-treat progress */}
      {s.tot && (
        <div className="absolute bottom-32 left-1/2 w-[min(440px,80vw)] -translate-x-1/2">
          <div className="mb-1 flex items-center justify-center gap-2 font-cond2 text-sm font-bold uppercase tracking-[0.16em] text-[#F9781B]">
            <DoorOpen size={15} /> Trick-or-treating at {s.tot.owner}'s…
          </div>
          <div className="h-4 overflow-hidden rounded-[3px] border-2 border-black bg-[#1a1f29]">
            <div className="h-full bg-gradient-to-r from-[#b0340c] via-[#F9781B] to-[#FFC453]" style={{ width: `${(s.tot.t / s.tot.dur) * 100}%` }} />
          </div>
          <div className="mt-1.5 text-center font-cond2 text-[12px] font-bold uppercase tracking-wider text-[#E63946]">
            ⚠ Vulnerable — can't move or shoot · <span className="text-[#31c9e8]">Space</span> to flee
          </div>
        </div>
      )}

      {/* interaction + compare */}
      {s.interact && (
        <div className="absolute bottom-28 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
          {s.nearbyCostume && (
            <div className="hidden items-end gap-2 md:flex">
              {s.costume && <div className="opacity-70"><CostumeCard id={s.costume} hero={game.hero} title="Wearing" /></div>}
              <CostumeCard id={s.nearbyCostume} hero={game.hero} title="Costume on the ground" />
            </div>
          )}
          {s.nearbyWeapon && (
            <div className="hidden items-end gap-2 md:flex">
              {cur && <div className="opacity-70"><WeaponCardLite w={cur} /></div>}
            </div>
          )}
          <div className="kit-clip flex items-center gap-2.5 border-2 border-[#F9781B] bg-[#0E1117]/95 px-4 py-2 shadow-[0_0_16px_rgba(249,120,27,0.4)]">
            <Keycap>E</Keycap>
            <span className="font-cond2 text-sm font-bold uppercase tracking-wide text-[#F4E8D5]">{s.interact}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ icon, v, color = '#F4E8D5' }: { icon: React.ReactNode; v: React.ReactNode; color?: string }) {
  return (
    <div className="kit-clip flex items-center gap-1.5 border-2 border-[#3a3f4d] bg-[#0E1117]/90 px-2.5 py-1 font-cond2 text-sm font-bold" style={{ color }}>
      {icon}<span>{v}</span>
    </div>
  );
}

function HouseSil({ flip }: { flip?: boolean }) {
  return (
    <svg viewBox="0 0 90 60" className="h-full w-auto" style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      <g fill="#0a0610">
        <rect x="4" y="34" width="34" height="26" />
        <polygon points="4,34 21,16 38,34" />
        <rect x="44" y="42" width="26" height="18" />
        <polygon points="44,42 57,30 70,42" />
        <rect x="72" y="46" width="16" height="14" />
        <polygon points="72,46 80,38 88,46" />
        <rect x="18" y="6" width="3" height="12" />
      </g>
      <rect x="12" y="42" width="5" height="6" fill="#FFC453" />
      <rect x="26" y="42" width="5" height="6" fill="#F9781B" />
      <rect x="52" y="47" width="4" height="5" fill="#FFC453" />
    </svg>
  );
}

function BannerPlate({ text, sub, kind, t }: { text: string; sub: string; kind: 'info' | 'danger' | 'loot'; t: number }) {
  const col = kind === 'danger' ? '#E63946' : kind === 'loot' ? '#7CFF64' : '#F9781B';
  const bg = kind === 'danger' ? 'linear-gradient(90deg,#3a0a12 0%,#1a060a 60%,rgba(14,17,23,0) 100%)' : kind === 'loot' ? 'linear-gradient(90deg,#0a2a10 0%,#0a1a0c 60%,rgba(14,17,23,0) 100%)' : 'linear-gradient(90deg,#4a1c06 0%,#22100a 60%,rgba(14,17,23,0) 100%)';
  return (
      <div className="absolute left-1/2 top-[20%] w-[min(560px,94vw)] -translate-x-1/2 sm:top-[22%]" style={{ opacity: Math.min(1, t * 1.5), transform: `translateX(-50%) scale(${t > 3.2 ? 1 + (t - 3.2) * 1.4 : 1})` }}>
      <div className="kit-flicker relative flex h-20 w-full items-center overflow-hidden sm:h-24" style={{ background: bg }}>
        <div className="absolute inset-y-0 left-0 hidden w-28 opacity-90 sm:block"><HouseSil /></div>
        <div className="absolute inset-y-0 right-0 hidden w-24 opacity-70 sm:block"><HouseSil flip /></div>
        <div className="relative z-10 ml-4 sm:ml-28">
          <div className="font-cond text-2xl uppercase leading-tight sm:text-4xl md:text-5xl" style={{ color: col, textShadow: '3px 3px 0 #000, 0 0 22px ' + col + '99' }}>{text}</div>
          {sub && <div className="mt-1 font-cond2 text-xs font-bold uppercase tracking-[0.14em] text-[#F4E8D5]/90 sm:text-sm" style={{ textShadow: '0 2px 4px #000' }}>{sub}</div>}
        </div>
        <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: col }} />
        <div className="absolute inset-x-0 bottom-0 h-0.5" style={{ background: col }} />
      </div>
    </div>
  );
}

function KitPanelLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5"><PanelTab color="#F9781B">{children}</PanelTab></div>;
}
function Objective({ on, label, val }: { on: boolean; label: string; val?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <Check on={on} />
      <span className={`flex-1 font-cond2 text-[13px] font-semibold ${on ? 'text-[#9aa3b8] line-through decoration-[#5a6070]' : 'text-[#F4E8D5]'}`}>{label}</span>
      {val && <span className="font-cond2 text-[12px] font-bold text-[#9aa3b8]">{val}</span>}
    </div>
  );
}
const RARITY_NAMES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];
function WeaponCardLite({ w }: { w: { w: import('../game/data').Weapon; st: import('../game/data').WStats } }) {
  return (
    <div className="kit-clip flex items-center gap-2 border-2 bg-[#0E1117]/95 px-2.5 py-2" style={{ borderColor: RARITY_KIT[w.w.rarity] }}>
      <img src={weaponUrl(w.w.def.id)} className="h-7 w-12 [image-rendering:pixelated]" alt="" />
      <div>
        <div className="font-cond text-sm leading-none text-[#F4E8D5]">{weaponTitle(w.w)}</div>
        <div className="font-cond2 text-[10px] font-bold uppercase" style={{ color: RARITY_KIT[w.w.rarity] }}>{RARITY_NAMES[w.w.rarity]} · Lv {w.w.level}</div>
      </div>
      <span className="ml-2 font-cond2 text-[10px] font-bold text-[#9aa3b8]">Equipped</span>
    </div>
  );
}
