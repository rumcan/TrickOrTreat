// The in-game HUD, built on HexMatch's in-game skeleton (theme-poster-hud.css) in dark paper:
//  · an ink TOP BAR with a 3px orange rule (here the rule doubles as the XP meter): kid chip, goal chips,
//    the clock, resource chips split by hairlines, square icon buttons and the radio;
//  · an ink LEFT RAIL with an orange letter-spaced heading: treats, synergies, friends;
//  · a bottom ink TAB STRIP (guns / skill / dash; the gun in hand is the "paper" tab) with a paper DRAWER
//    that opens above it for whatever needs you right now (revive, cannon, doorstep, pickups);
//  · NOTICES as paper slips with a 4px orange left edge.
import { DoorOpen, Map as MapIcon, Pause as PauseIcon, Maximize, Wind, Backpack, Check as CheckIcon } from 'lucide-react';
import { HudSnap, Game } from '../game/engine';
import { HERO_INFO, SCROLL_BY_ID, weaponTitle, COSTUME_BY_ID } from '../game/data';
import { weaponUrl, fmtTime, HeroPreview, RARITY_KIT, SkullIcon, CoinIcon, SkillIcon, WeaponCard, TreatArt } from './common';
import { Banner, Keycap } from './kit';
import { FACES, HERO_COLORS, BannerKind } from './art';
import RadioPill from './RadioPill';
import { TAG_DEFS, TAG_ORDER } from '../game/build';

const BANNER_KIND: Record<string, BannerKind> = { info: 'tot', danger: 'died', loot: 'weapon', win: 'mission' };
const pct = (v: number, m: number) => `${Math.max(0, Math.min(1, v / Math.max(1, m))) * 100}%`;

function CostumeCard({ id, hero, title }: { id: string; hero: number; title: string }) {
  const c = COSTUME_BY_ID[id];
  return (
    <div className="hm-slip flex w-72 gap-2.5 !p-3" style={{ borderLeftColor: c.color }}>
      <div className="-my-2 shrink-0"><HeroPreview hero={hero} size={0.9} walking costume={id} /></div>
      <div>
        <div className="hm-kicker">{title}</div>
        <div className="font-cond text-lg uppercase leading-tight" style={{ color: c.color }}>{c.name}</div>
        <div className="mt-1 text-[12px] font-semibold leading-snug text-[#f2e8d4]">{c.power}</div>
        <div className="mt-1 text-[12px] leading-snug text-[#8fdc7a]">{c.perks}</div>
      </div>
    </div>
  );
}

// ───────────────────────── top bar ─────────────────────────
function TopBar({ s, game }: { s: HudSnap; game: Game }) {
  const hero = game.hero, h = HERO_INFO[hero];
  const costume = s.costume ? COSTUME_BY_ID[s.costume] : null;
  const goals = [
    { done: s.costumesFound >= 3, label: 'Find costumes', v: `${Math.min(s.costumesFound, 3)}/3` },
    { done: s.doorsRung >= 5, label: 'Ring doorbells', v: `${s.doorsRung}/${Math.max(5, s.housesTotal)}` },
    { done: s.time >= 300, label: 'Survive', v: '05:00' },
  ];
  return (
    <header className="hm-topbar pointer-events-auto" aria-label="Run status">
      {/* kid */}
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="relative shrink-0">
          <div className="hm-av h-[38px] w-[38px] sm:h-[42px] sm:w-[42px]" style={{ background: HERO_COLORS[hero] }}>
            <img src={FACES[hero]} alt="" draggable={false} className="h-full w-full object-cover" />
          </div>
          {costume && <span className="hm-badge absolute -bottom-1.5 -left-1.5" style={{ borderColor: costume.color }} title={costume.name}>{costume.icon}</span>}
        </div>
        <div className="w-[118px] min-w-0 sm:w-[190px]">
          <div className="flex items-baseline gap-2 truncate">
            <span className="hm-name">{h.name}</span>
            <span className="hm-level">LV {s.level}</span>
          </div>
          <div className="mt-1 space-y-[3px]">
            <div className="hm-meter" title={`HP ${Math.ceil(s.hp)} / ${Math.round(s.maxHp)}`}><span><i style={{ width: pct(s.hp, s.maxHp), background: '#e8433c' }} /></span><b>{Math.ceil(Math.max(0, s.hp))}</b></div>
            <div className="hm-meter" title={`Shield ${Math.ceil(s.shield)} / ${Math.round(s.maxShield)}`}><span><i style={{ width: pct(s.shield, s.maxShield), background: '#28aed5' }} /></span><b>{Math.ceil(Math.max(0, s.shield))}</b></div>
          </div>
        </div>
      </div>

      {/* goals */}
      <div className="hidden items-center gap-1.5 lg:flex">
        {goals.map((g) => (
          <span key={g.label} className={`hm-goal ${g.done ? 'done' : ''}`}>
            {g.done ? <CheckIcon size={13} strokeWidth={3} /> : <span className="text-[#f08a2c]">★</span>}
            <span>{g.label}</span>
            <span className="hm-goal-v">{g.v}</span>
          </span>
        ))}
      </div>

      {/* clock */}
      <div className="hm-clock">
        <div className="hm-time">{fmtTime(s.time)}</div>
        <div className="hm-time-sub">
          {s.wave > 0 ? <span className="text-[#ff5a6e]">Wave {s.wave} · {Math.ceil(s.waveIn)}s</span>
            : s.bossIn !== null ? <span>Boss in {fmtTime(s.bossIn)}</span>
              : <span>Night falls</span>}
        </div>
      </div>

      {/* resources + buttons */}
      <div className="ml-auto flex items-center">
        <div className="hm-chips">
          <span className="hm-chip" title="Monsters"><SkullIcon size={17} /><b>{s.kills}</b></span>
          <span className="hm-chip money" title="Coins"><CoinIcon size={17} /><b>{s.coins}</b></span>
          {s.momentum > 0 && <span className="hm-chip hot" title="Kill · Momentum stacks">💀<b>{s.momentum}</b></span>}
          {s.streak > 0 && <span className="hm-chip hot" title="Crit · Lucky Streak stacks">🎯<b>{s.streak}</b></span>}
        </div>
        <div className="hidden xl:block"><RadioPill compact /></div>
        <div className="flex gap-1.5 pl-2">
          <button className="hm-iconbtn hm-desk" title="Your run build (I)" aria-label="Your run build" onClick={() => game.state === 'play' && (game.state = 'inventory')}><Backpack size={16} /></button>
          <button className={`hm-iconbtn hm-desk ${s.bigMap ? 'on' : ''}`} title="Map (M)" aria-label="Map" onClick={() => (game.bigMap = !game.bigMap)}><MapIcon size={16} /></button>
          <button className="hm-iconbtn" title="Pause (Esc)" aria-label="Pause" onClick={() => game.state === 'play' && (game.state = 'pause')}><PauseIcon size={16} /></button>
          <button className="hm-iconbtn hm-desk" title="Fullscreen" aria-label="Fullscreen" onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => undefined)}><Maximize size={15} /></button>
        </div>
      </div>
      {/* the orange rule is the XP meter */}
      <span className="hm-xp" title={`Level ${s.level} · ${Math.floor(s.xp)} / ${s.xpNext} XP`}><i style={{ width: pct(s.xp, s.xpNext) }} /></span>
    </header>
  );
}

// ───────────────────────── left rail ─────────────────────────
function Rail({ s, game }: { s: HudSnap; game: Game }) {
  const treats = Object.entries(s.scrolls).filter(([id, n]) => n > 0 && SCROLL_BY_ID[id]);
  const max = 9;
  const tags = TAG_ORDER.filter((t) => game.build.tiers[t] > 0).sort((a, b) => game.build.tiers[b] - game.build.tiers[a]).slice(0, 4);
  const friends = game.campaign ? game.friends : [];
  return (
    <aside className="hm-rail pointer-events-auto" aria-label="Treats and synergies">
      <div className="hm-rail-title">Treats</div>
      {!treats.length && <div className="hm-rail-empty">Level up to fill your bag</div>}
      {treats.slice(0, max).map(([id, n]) => {
        const sc = SCROLL_BY_ID[id];
        return (
          <div key={id} className="hm-rail-row" title={`${sc.name} ×${n}: ${sc.desc}`} style={{ boxShadow: `inset 3px 0 0 ${RARITY_KIT[sc.rarity]}` }}>
            <span className="hm-rail-art" style={{ borderColor: RARITY_KIT[sc.rarity] }}><TreatArt id={id} /></span>
            {n > 1 && <span className="hm-rail-n">×{n}</span>}
          </div>
        );
      })}
      {treats.length > max && <button className="hm-rail-row hm-rail-more" onClick={() => game.state === 'play' && (game.state = 'inventory')}>+{treats.length - max}<small>more</small></button>}
      {tags.length > 0 && (
        <>
          <div className="hm-rail-title">Synergy</div>
          {tags.map((t) => <div key={t} className="hm-rail-row" title={`${TAG_DEFS[t].name} tier ${game.build.tiers[t]}`}><span className="hm-rail-tag" style={{ color: TAG_DEFS[t].color }}>{TAG_DEFS[t].name}</span><span className="hm-rail-n">T{game.build.tiers[t]}</span></div>)}
        </>
      )}
      {friends.length > 0 && (
        <>
          <div className="hm-rail-title">Friends</div>
          {friends.map((f) => (
            <div key={f.hero} className="hm-rail-row" title={`${HERO_INFO[f.hero].name} · ${f.status === 'rescued' ? (game.activeFriend === f.hero ? 'your helper' : 'saved') : game.map.gates[f.gate].name}`}>
              <span className="hm-av h-7 w-7 !border" style={{ background: HERO_COLORS[f.hero], borderColor: f.status === 'rescued' ? '#66d2b7' : '#5f6470', opacity: f.status === 'rescued' ? 1 : 0.55 }}><img src={FACES[f.hero]} alt="" className="h-full w-full object-cover" /></span>
              <span className="hm-rail-n" style={{ color: f.status === 'rescued' ? '#66d2b7' : '#8f8676' }}>{f.status === 'rescued' ? (game.activeFriend === f.hero ? 'help' : 'safe') : 'lost'}</span>
            </div>
          ))}
        </>
      )}
    </aside>
  );
}

// ───────────────────────── bottom tab strip + drawer ─────────────────────────
function Tabs({ s, hero }: { s: HudSnap; hero: number }) {
  const skillReady = s.skillCd <= 0;
  return (
    <nav className="hm-tabs" aria-label="Weapons and abilities">
      {s.weapons.map((ws, i) =>
        ws ? (
          <div key={i} className={`hm-tab ${i === s.cur ? 'active' : ''}`} style={{ boxShadow: `inset 0 -3px 0 ${RARITY_KIT[ws.w.rarity]}` }}>
            <Keycap className="hm-key">{String(i + 1)}</Keycap>
            <img src={weaponUrl(ws.w.def.id)} className="h-7 w-14 shrink-0 [image-rendering:pixelated]" style={{ filter: 'drop-shadow(0 2px 0 rgba(0,0,0,0.6))' }} alt={weaponTitle(ws.w)} />
            <span className="hidden min-w-0 flex-col leading-none md:flex">
              <span className="hm-tab-name">{ws.w.def.name}</span>
              <span className="hm-tab-sub">{ws.w.reloadT > 0 ? <span className="text-[#f08a2c]">Reloading…</span> : <>{ws.w.ammo} / {ws.st.mag}</>}</span>
            </span>
            <span className="hm-tab-sub md:hidden">{ws.w.reloadT > 0 ? 'R…' : ws.w.ammo}</span>
            {ws.w.reloadT > 0 && <span className="absolute inset-x-0 bottom-0 h-[3px] origin-left bg-[#e8700f]" style={{ transform: `scaleX(${1 - ws.w.reloadT / ws.st.reload})` }} />}
          </div>
        ) : (
          <div key={i} className="hm-tab empty"><Keycap className="hm-key">{String(i + 1)}</Keycap><span className="hm-tab-sub">Empty</span></div>
        )
      )}
      <div className={`hm-tab ${skillReady ? 'ready' : ''}`}>
        <Keycap className="hm-key">F</Keycap>
        <SkillIcon hero={hero} size={26} />
        <span className="hidden flex-col leading-none md:flex">
          <span className="hm-tab-name">{HERO_INFO[hero].skill}</span>
          <span className="hm-tab-sub">{skillReady ? <span className="text-[#8fdc7a]">Ready</span> : `${s.skillCd.toFixed(1)}s`}</span>
        </span>
        {!skillReady && <span className="absolute inset-x-0 bottom-0 h-[3px] origin-left bg-[#5f6470]" style={{ transform: `scaleX(${1 - s.skillCd / s.skillMax})` }} />}
      </div>
      <div className="hm-tab">
        <Keycap className="hm-key">Spc</Keycap>
        <Wind size={20} className="text-[#28aed5]" strokeWidth={2.4} />
        <span className="flex gap-1">
          {Array.from({ length: s.dashMax }).map((_, i) => <span key={i} className="h-2 w-3" style={{ background: i < s.dashCharges ? '#28aed5' : '#2a3437' }} />)}
        </span>
      </div>
    </nav>
  );
}

/** whatever needs you right now, as a paper drawer over the tab strip (one at a time) */
function Drawer({ s }: { s: HudSnap }) {
  let body: React.ReactNode = null;
  if (s.rescue) {
    body = (
      <>
        <div className="hm-kicker" style={{ color: '#c9a8ff' }}>{s.rescue.downed ? 'You are down' : 'A friend needs you'}</div>
        <div className="flex items-center gap-3">
          {!s.rescue.downed && <Keycap>E</Keycap>}
          <div className="hm-drawer-main">{s.rescue.label}</div>
        </div>
        {s.rescue.progress >= 0 && <div className="hm-progress mt-2"><i style={{ width: `${s.rescue.progress * 100}%`, background: '#b58bff' }} /></div>}
        {!s.rescue.downed && s.rescue.progress <= 0 && !/Defeat/.test(s.rescue.label) && <div className="hm-drawer-note">Tap E and stay close · hits only pause it</div>}
      </>
    );
  } else if (s.turret) {
    body = (
      <>
        <div className="flex items-baseline justify-between"><div className="hm-kicker">Candy Cannon</div><div className={`hm-kicker ${s.turret.over > 0 ? '!text-[#ff5a3a]' : '!text-[#8f8676]'}`}>{s.turret.over > 0 ? 'Overheated!' : 'Heat'}</div></div>
        <div className="hm-progress"><i style={{ width: `${s.turret.heat * 100}%`, background: s.turret.over > 0 ? '#ff5a3a' : '#e8700f' }} /></div>
        <div className="hm-drawer-note flex items-center gap-2"><Keycap className="!h-5 !text-[11px]">E</Keycap> climb down · hold the mouse to aim · it fires at the nearest monster on its own</div>
      </>
    );
  } else if (s.tot) {
    body = (
      <>
        <div className="hm-kicker flex items-center gap-1.5"><DoorOpen size={14} /> On {s.tot.owner}'s doorstep</div>
        <div className="hm-progress"><i style={{ width: `${(s.tot.t / s.tot.dur) * 100}%` }} /></div>
        <div className="hm-drawer-note !text-[#ff7a6e]">Vulnerable: you can't move or shoot · <Keycap className="!h-5 !text-[11px]">Space</Keycap> to flee</div>
      </>
    );
  } else if (s.interact && !s.nearbyWeapon) {
    body = (
      <div className="flex items-center gap-3">
        <Keycap>E</Keycap>
        <div className="hm-drawer-main">{s.interact}</div>
      </div>
    );
  }
  if (!body) return null;
  return <div className="hm-drawer">{body}</div>;
}

// ───────────────────────── HUD ─────────────────────────
export function Hud({ s, game }: { s: HudSnap; game: Game }) {
  const hero = game.hero;
  const cur = s.weapons[s.cur];
  const friend = FACES[hero === 2 ? 0 : 2]; // the other kid on the walkie-talkie
  return (
    <div className="pointer-events-none absolute inset-0 select-none font-ui text-[#f2e6c9]">
      <TopBar s={s} game={game} />
      {!s.bigMap && <Rail s={s} game={game} />}

      {/* walkie-talkie notices: paper slips under the minimap */}
      <div className="hm-notices">
        {s.state === 'play' && s.toasts.map((q) => (
          <div key={q.id} className="hm-slip kit-slide-in flex items-center gap-2.5">
            <img src={friend} alt="" className="hm-av h-9 w-9 shrink-0 object-cover" draggable={false} />
            <span className="text-[13.5px] font-semibold leading-snug">{q.text}</span>
          </div>
        ))}
      </div>

      {/* boss */}
      {s.boss && (
        <div className="hm-boss">
          <div className="flex items-baseline justify-between gap-3">
            <span className="hm-kicker !mb-0">Boss</span>
            <span className="font-cond text-xl uppercase leading-none text-[#f2e8d4]">{s.boss.name}</span>
            <span className="font-num text-[11px] text-[#8f8676]">{Math.max(0, Math.ceil((s.boss.hp / s.boss.max) * 100))}%</span>
          </div>
          <div className="hm-progress mt-1.5 !h-2.5"><i style={{ width: pct(s.boss.hp, s.boss.max) }} /></div>
        </div>
      )}

      {s.banner && s.state === 'play' && !s.bigMap && <BannerPlate text={s.banner.text} sub={s.banner.sub} kind={BANNER_KIND[s.banner.kind]} t={s.banner.t} />}

      {/* bottom: drawer over the tab strip */}
      <div className="hm-dock">
        <Drawer s={s} />
        <Tabs s={s} hero={hero} />
      </div>

      {/* nearby gun / costume: comparison on the right, the E slip under it */}
      {s.interact && !s.turret && (s.nearbyWeapon || s.nearbyCostume) && (
        <div role={s.nearbyWeapon ? 'region' : undefined} aria-label={s.nearbyWeapon ? 'Nearby weapon comparison' : undefined} className={`absolute flex flex-col gap-2 ${s.nearbyWeapon ? 'right-3 top-1/2 w-[min(240px,calc(50vw-40px))] -translate-y-1/2 items-stretch md:right-[18px] md:w-auto md:max-w-[calc(50vw-40px)]' : 'bottom-[96px] left-1/2 -translate-x-1/2 items-center sm:bottom-[104px]'}`}>
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
          <div className="hm-slip flex items-center gap-2.5 !py-2">
            <Keycap>E</Keycap>
            <span className="truncate font-cond2 text-[15px] font-bold uppercase tracking-wide text-[#f2e8d4]">{s.interact}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function BannerPlate({ text, sub, kind, t }: { text: string; sub: string; kind: BannerKind; t: number }) {
  return (
    <div className="kit-flicker absolute left-1/2 top-[22%] w-[min(620px,94vw)]" style={{ opacity: Math.min(1, t * 1.5), transform: `translateX(-50%) scale(${t > 3.2 ? 1 + (t - 3.2) * 1.2 : 1})` }}>
      <Banner kind={kind} title={text} sub={sub} size="md" />
    </div>
  );
}
