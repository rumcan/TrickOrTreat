import { DoorOpen, Map as MapIcon, Pause as PauseIcon, Maximize, Wind } from 'lucide-react';
import { HudSnap, Game } from '../game/engine';
import { HERO_INFO, SCROLL_BY_ID, weaponTitle, COSTUME_BY_ID } from '../game/data';
import { weaponUrl, fmtTime, HeroPreview, RARITY_KIT, Check, ShieldIcon, SkullIcon, CoinIcon, CandyIcon, HouseIcon, SkillIcon, WeaponCard } from './common';
import { Bar, Banner, Keycap, KitTitle, Toast, IconTile } from './kit';
import { FACES, HERO_COLORS, BannerKind } from './art';

const BANNER_KIND: Record<string, BannerKind> = { info: 'tot', danger: 'died', loot: 'weapon', win: 'mission' };

function CostumeCard({ id, hero, title }: { id: string; hero: number; title: string }) {
  const c = COSTUME_BY_ID[id];
  return (
    <div className="kit-panel flex w-72 gap-2.5 p-3" style={{ borderColor: c.color }}>
      <div className="-my-2 shrink-0"><HeroPreview hero={hero} size={0.9} walking costume={id} /></div>
      <div>
        <div className="font-cond2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#9aa0a6]">{title}</div>
        <div className="font-cond text-lg uppercase leading-tight" style={{ color: c.color }}>{c.name}</div>
        <div className="mt-1 text-[12px] font-semibold leading-snug text-[#ffc453]">{c.power}</div>
        <div className="mt-1 text-[12px] leading-snug text-[#7cff64]">{c.perks}</div>
      </div>
    </div>
  );
}

/** square hotbar slot with the cream hotkey badge (kit) */
function Slot({ hotkey, active, children, className = '' }: { hotkey: string; active?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={`kit-tile flex h-[64px] w-[66px] flex-col items-center justify-center gap-1 sm:h-[82px] sm:w-[88px] ${className}`} style={active ? { borderColor: '#fb8016', boxShadow: '0 0 0 1px #000, 0 0 16px rgba(251,128,22,0.45), inset 0 0 18px rgba(0,0,0,0.6)' } : undefined}>
      {children}
      <span className="kit-key absolute -bottom-2 -left-2 !h-6 !min-w-6 !px-1 !text-[13px]">{hotkey}</span>
    </div>
  );
}

function PlayerPlate({ hero, s }: { hero: number; s: HudSnap }) {
  const h = HERO_INFO[hero];
  const costume = s.costume ? COSTUME_BY_ID[s.costume] : null;
  return (
    <div className="absolute left-2 top-2 flex items-center sm:left-4 sm:top-4">
      <div className="relative z-10 h-16 w-16 shrink-0 sm:h-[84px] sm:w-[84px]">
        <div className="h-full w-full overflow-hidden rounded-full border-[3px] border-[#d9a540] shadow-[0_0_0_2px_#000,0_4px_12px_rgba(0,0,0,0.6)]" style={{ background: HERO_COLORS[hero] }}>
          <img src={FACES[hero]} alt="" draggable={false} className="h-full w-full object-cover" />
        </div>
        <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#d9a540] bg-[#0b0c0f] font-cond text-[15px] leading-none text-[#f2c94c] shadow-[0_0_0_1.5px_#000]">{s.level}</div>
        {costume && <div className="absolute -left-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full border-2 bg-[#0b0c0f] text-sm shadow-[0_0_0_1.5px_#000]" style={{ borderColor: costume.color }} title={costume.name}>{costume.icon}</div>}
      </div>
      <div className="kit-panel -ml-5 w-[188px] py-1.5 pl-7 pr-2.5 sm:w-[300px] sm:py-2 sm:pl-8 sm:pr-3">
        <div className="truncate font-cond2 text-[13px] font-bold uppercase leading-none tracking-wide sm:text-[16px]">
          <span className="text-[#f2c94c]">{h.name}</span>
          <span className="hidden text-[#f2e6c9] sm:inline"> - {h.title}</span>
        </div>
        <Bar value={s.hp} max={s.maxHp} color="#f92f36" h={14} className="mt-1.5" />
        <Bar value={s.shield} max={s.maxShield} color="#28aed5" h={12} className="mt-1" icon={<ShieldIcon size={15} />} />
        <div className="mt-1 flex items-center gap-1.5" title={`Level ${s.level}`}>
          <CandyIcon size={15} />
          <Bar value={s.xp} max={s.xpNext} color="#fab431" h={6} label={false} className="flex-1" />
        </div>
      </div>
    </div>
  );
}

function TimerPlate({ s }: { s: HudSnap }) {
  return (
    <div className="kit-panel absolute left-1/2 top-[84px] -translate-x-1/2 px-3 pb-1.5 pt-1 text-center sm:top-3 sm:px-5 sm:pb-2 sm:pt-1.5">
      <div className="font-num text-[28px] leading-none text-[#f4e6c4] sm:text-[40px]">{fmtTime(s.time)}</div>
      <div className="mt-1 flex items-center justify-center gap-3 font-num text-[12px] leading-none sm:mt-1.5 sm:gap-4 sm:text-[15px]">
        <span className="flex items-center gap-1.5 text-[#f2e6c9]"><SkullIcon size={16} />{s.kills}</span>
        <span className="flex items-center gap-1.5 text-[#f2e6c9]"><CoinIcon size={16} />{s.coins}</span>
        <span className="flex items-center gap-1.5 text-[#f2e6c9]"><CandyIcon size={17} />{s.doorsRung}/{s.housesTotal}</span>
        {s.bossIn !== null && <span className="flex items-center gap-1.5 text-[#fb8016]" title="The Pumpkin King arrives"><HouseIcon size={16} />{fmtTime(s.bossIn)}</span>}
      </div>
    </div>
  );
}

export function Hud({ s, game }: { s: HudSnap; game: Game }) {
  const hero = game.hero;
  const cur = s.weapons[s.cur];
  const skillReady = s.skillCd <= 0;
  const friend = FACES[hero === 2 ? 0 : 2]; // the other kid on the walkie-talkie
  return (
    <div className="pointer-events-none absolute inset-0 select-none font-ui text-[#f2e6c9]">
      <PlayerPlate hero={hero} s={s} />

      {/* objectives */}
      <div className={`kit-panel-gold absolute left-4 top-[7.4rem] hidden w-[252px] px-3.5 pb-3 pt-2.5 ${s.bigMap ? '' : 'md:block'}`}>
        <KitTitle className="text-lg">Trick or Treat</KitTitle>
        <div className="mt-2 space-y-2">
          <Objective on={s.costumesFound >= 3} label="Find costumes" val={`${Math.min(s.costumesFound, 3)}/3`} />
          <Objective on={s.doorsRung >= 5} label="Ring doorbells" val={`${s.doorsRung}/${Math.max(5, s.housesTotal)}`} />
          <Objective on={s.time >= 300} label="Survive until 05:00" />
        </div>
      </div>
      {/* treats */}
      <div className={`absolute left-4 top-[16.6rem] hidden max-w-[252px] flex-wrap gap-1.5 ${s.bigMap ? '' : 'md:flex'}`}>
        {Object.entries(s.scrolls).map(([id, n]) => {
          const sc = SCROLL_BY_ID[id];
          return (
            <div key={id} title={`${sc.name}: ${sc.desc}`} className="kit-tile flex h-9 w-9 items-center justify-center text-base" style={{ borderColor: RARITY_KIT[sc.rarity] }}>
              {sc.icon}
              {n > 1 && <span className="absolute -bottom-1.5 -right-1.5 rounded-[3px] border border-black bg-[#fb8016] px-1 font-cond2 text-[10px] font-bold leading-[14px] text-black">x{n}</span>}
            </div>
          );
        })}
      </div>

      <TimerPlate s={s} />

      {/* map / pause / fullscreen (top-right, under the minimap) */}
      <div className="pointer-events-auto absolute right-[18px] hidden gap-1.5 sm:flex" style={{ top: 'calc(min(230px, 22vw) / 2 + 34px)' }}>
        <IconTile icon={MapIcon} title="Map (M)" active={s.bigMap} onClick={() => (game.bigMap = !game.bigMap)} className="cursor-pointer" />
        <IconTile icon={PauseIcon} title="Pause (Esc)" onClick={() => game.state === 'play' && (game.state = 'pause')} className="cursor-pointer" />
        <IconTile icon={Maximize} title="Fullscreen" onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => undefined)} className="cursor-pointer" />
      </div>
      {/* walkie-talkie toasts */}
      <div className="absolute right-2 top-[236px] flex w-[250px] max-w-[70vw] flex-col items-end gap-2 sm:right-[18px] sm:top-[calc(min(230px,22vw)/2_+_90px)]">
        {s.state === 'play' && s.toasts.map((q) => <Toast key={q.id} face={friend}>{q.text}</Toast>)}
      </div>

      {/* boss */}
      {s.boss && (
        <div className="absolute left-1/2 top-[152px] w-[min(540px,86vw)] -translate-x-1/2 sm:top-[104px]">
          <KitTitle className="mb-1 text-center text-xl tracking-[0.2em]">{s.boss.name}</KitTitle>
          <Bar value={s.boss.hp} max={s.boss.max} color="linear-gradient(90deg,#b0340c,#fb8016,#ffc453)" h={16} label={false} />
        </div>
      )}

      {s.banner && s.state === 'play' && !s.bigMap && <BannerPlate text={s.banner.text} sub={s.banner.sub} kind={BANNER_KIND[s.banner.kind]} t={s.banner.t} />}

      {/* ===== hotbar ===== */}
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-end gap-2.5 sm:bottom-5 sm:gap-3.5">
        {s.weapons.map((ws, i) =>
          ws ? (
            <Slot key={i} hotkey={String(i + 1)} active={i === s.cur}>
              <img src={weaponUrl(ws.w.def.id)} className="h-7 w-14 [image-rendering:pixelated] sm:h-9 sm:w-[72px]" style={{ filter: 'drop-shadow(0 2px 0 rgba(0,0,0,0.7))' }} alt={weaponTitle(ws.w)} />
              {ws.w.reloadT > 0 ? (
                <span className="font-cond2 text-[12px] font-bold uppercase tracking-wider text-[#fb8016] sm:text-[13px]">Reload</span>
              ) : (
                <span className="font-ui text-[12px] font-semibold leading-none text-white sm:text-[15px]">{ws.w.ammo} / {ws.st.mag}</span>
              )}
              {ws.w.reloadT > 0 && <span className="absolute inset-x-2 bottom-1.5 h-1 origin-left bg-[#fb8016]" style={{ transform: `scaleX(${1 - ws.w.reloadT / ws.st.reload})` }} />}
              <span className="absolute left-0 top-0 h-[3px] w-full" style={{ background: RARITY_KIT[ws.w.rarity] }} />
            </Slot>
          ) : (
            <Slot key={i} hotkey={String(i + 1)} className="opacity-60">
              <span className="font-cond text-3xl leading-none text-[#4a4d55]">+</span>
            </Slot>
          )
        )}
        <Slot hotkey="F" active={skillReady}>
          <SkillIcon hero={hero} size={40} />
          <span className="font-ui text-[12px] font-semibold leading-none text-white sm:text-[14px]">{skillReady ? 'Ready' : `${s.skillCd.toFixed(1)}s`}</span>
          {!skillReady && <span className="absolute inset-0 origin-top bg-black/55" style={{ transform: `scaleY(${s.skillCd / s.skillMax})` }} />}
        </Slot>
        <Slot hotkey="Spc">
          <Wind size={26} className="text-[#28aed5]" strokeWidth={2.4} />
          <div className="flex gap-1">
            {Array.from({ length: s.dashMax }).map((_, i) => (
              <span key={i} className="h-2 w-3.5 border border-black" style={{ background: i < s.dashCharges ? '#28aed5' : '#2a2d33' }} />
            ))}
          </div>
        </Slot>
      </div>

      {/* trick-or-treat progress */}
      {s.tot && (
        <div className="absolute bottom-[118px] left-1/2 w-[min(440px,86vw)] -translate-x-1/2 sm:bottom-[134px]">
          <div className="mb-1.5 flex items-center justify-center gap-2 font-cond2 text-sm font-bold uppercase tracking-[0.14em] text-[#fb8016]">
            <DoorOpen size={16} /> Trick-or-treating at {s.tot.owner}'s…
          </div>
          <Bar value={s.tot.t} max={s.tot.dur} color="linear-gradient(90deg,#b0340c,#fb8016,#ffc453)" h={14} label={false} />
          <div className="mt-1.5 text-center font-cond2 text-[13px] font-bold uppercase tracking-wider text-[#ff4d5a]">
            ⚠ Vulnerable — can't move or shoot · <Keycap className="!h-5 !text-[11px]">Space</Keycap> to flee
          </div>
        </div>
      )}

      {/* rescuing a friend / being revived */}
      {s.rescue && (
        <div className="absolute bottom-[118px] left-1/2 flex w-[min(420px,90vw)] -translate-x-1/2 flex-col items-center gap-2 sm:bottom-[134px]">
          <div className="kit-panel flex w-full items-center gap-3 px-3.5 py-2.5" style={{ borderColor: '#b58bff', boxShadow: '0 0 0 1px #000, 0 0 18px rgba(181,139,255,0.4)' }}>
            {!s.rescue.downed && <Keycap>E</Keycap>}
            <div className="min-w-0 flex-1">
              <div className="truncate font-cond2 text-[15px] font-bold uppercase tracking-wide text-[#f2e6c9]">{s.rescue.label}</div>
              {s.rescue.progress >= 0 && <Bar value={s.rescue.progress * 100} max={100} color="linear-gradient(90deg,#7b4dd6,#b58bff,#e6d4ff)" h={8} label={false} className="mt-1.5" />}
            </div>
          </div>
          {!s.rescue.downed && s.rescue.progress <= 0 && !/Defeat/.test(s.rescue.label) && <div className="font-cond2 text-[12px] font-bold uppercase tracking-wider text-[#c9b8e8]" style={{ textShadow: '0 1px 2px #000' }}>Tap E and stay close · hits only pause it</div>}
        </div>
      )}

      {/* manning a Candy Cannon */}
      {s.turret && (
        <div className="absolute bottom-[118px] left-1/2 w-[min(400px,90vw)] -translate-x-1/2 sm:bottom-[134px]">
          <div className="kit-panel px-3.5 py-2.5" style={{ borderColor: s.turret.over > 0 ? '#ff5a3a' : '#fb8016' }}>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <span className="font-cond text-lg uppercase leading-none text-[#fb8016]">Candy Cannon</span>
              <span className={`font-cond2 text-[12px] font-bold uppercase tracking-wider ${s.turret.over > 0 ? 'text-[#ff5a3a]' : 'text-[#9aa0a6]'}`}>{s.turret.over > 0 ? 'Overheated!' : 'Heat'}</span>
            </div>
            <Bar value={s.turret.heat * 100} max={100} color={s.turret.over > 0 ? '#ff5a3a' : 'linear-gradient(90deg,#2ec4b0,#ffd23a 60%,#ff5a3a)'} h={9} label={false} />
            <div className="mt-1.5 flex items-center gap-2 font-cond2 text-[12px] font-bold uppercase tracking-wider text-[#c9bda6]">
              <Keycap className="!h-5 !text-[11px]">E</Keycap> climb down · hold mouse to aim · auto-fires at the nearest monster
            </div>
          </div>
        </div>
      )}

      {/* interaction + compare */}
      {s.interact && !s.turret && (
        <div role={s.nearbyWeapon ? 'region' : undefined} aria-label={s.nearbyWeapon ? 'Nearby weapon comparison' : undefined} className={`absolute flex flex-col gap-2 ${s.nearbyWeapon ? 'right-3 top-1/2 w-[min(240px,calc(50vw-40px))] -translate-y-1/2 items-stretch md:right-[18px] md:w-auto md:max-w-[calc(50vw-40px)]' : 'bottom-[118px] left-1/2 -translate-x-1/2 items-center sm:bottom-[134px]'}`}>
          {s.nearbyCostume && (
            <div className="hidden items-end gap-2 md:flex">
              {s.costume && <div className="opacity-70"><CostumeCard id={s.costume} hero={hero} title="Wearing" /></div>}
              <CostumeCard id={s.nearbyCostume} hero={hero} title="Costume on the ground" />
            </div>
          )}
          {s.nearbyWeapon && (
            <div className="pointer-events-auto hidden max-h-[max(160px,calc(100dvh-440px))] flex-col gap-3 overflow-y-auto overscroll-contain p-1 pt-4 md:flex xl:flex-row xl:items-end">
              {cur && <div className="opacity-75"><WeaponCard w={cur.w} stats={game.stats} title="Equipped" compact /></div>}
              <div className="order-first xl:order-last"><WeaponCard w={s.nearbyWeapon} stats={game.stats} compare={cur?.w} title="On the ground" compact /></div>
            </div>
          )}
          <div className={`kit-panel flex items-center gap-2.5 px-3.5 py-2 ${s.nearbyWeapon ? 'max-w-full' : 'max-w-[92vw]'}`} style={{ borderColor: '#fb8016', boxShadow: '0 0 0 1px #000, 0 0 16px rgba(251,128,22,0.35)' }}>
            <Keycap>E</Keycap>
            <span className="truncate font-cond2 text-[15px] font-bold uppercase tracking-wide text-[#f2e6c9]">{s.interact}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function BannerPlate({ text, sub, kind, t }: { text: string; sub: string; kind: BannerKind; t: number }) {
  return (
    <div className="kit-flicker absolute left-1/2 top-[19%] w-[min(620px,94vw)] sm:top-[21%]" style={{ opacity: Math.min(1, t * 1.5), transform: `translateX(-50%) scale(${t > 3.2 ? 1 + (t - 3.2) * 1.2 : 1})` }}>
      <Banner kind={kind} title={text} sub={sub} size="md" />
    </div>
  );
}

function Objective({ on, label, val }: { on: boolean; label: string; val?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <Check on={on} />
      <span className={`flex-1 font-cond2 text-[14px] font-semibold ${on ? 'text-[#9aa0a6] line-through decoration-[#5a6070]' : 'text-[#f2e6c9]'}`}>{label}</span>
      {val && <span className="font-num text-[12px] text-[#9aa0a6]">{val}</span>}
    </div>
  );
}

