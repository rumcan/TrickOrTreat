import { useEffect, useMemo, useState } from 'react';
import { Play, Users, Lollipop, Backpack, Settings as Gear, LogOut, RotateCw, X, ChevronLeft, Gamepad2, Sun, Vibrate, Moon } from 'lucide-react';
import { Game } from '../game/engine';
import { HERO_INFO, Save, upgradeCost, weaponTitle, SCROLL_BY_ID, baseStats, applyTalents } from '../game/data';
import { settings, saveSettings } from '../game/settings';
import { KitButton, KitTitle, Keycap, Toggle, Slider, Chip, Banner, LogoImg } from './kit';
import { WeaponCard, CharacterCard, ControlsPanel, InfoPanel, HeroPreview, fmtTime, weaponUrl, RARITY_KIT, CandyIcon, ClockIcon, SkullIcon, HouseIcon, CoinIcon } from './common';
import { ART, FACES, HERO_COLORS } from './art';

const RARITY_NAMES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];

/** full-bleed key art with a readable vignette */
function KeyArt({ dim = 0, blur }: { dim?: number; blur?: boolean }) {
  return (
    <>
      <img src={ART.keyart} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover object-bottom" style={blur ? { filter: 'blur(5px) saturate(0.7)', transform: 'scale(1.05)' } : undefined} />
      <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, rgba(14,15,19,${0.55 + dim}) 0%, rgba(14,15,19,${dim}) 38%, rgba(14,15,19,${0.15 + dim}) 62%, rgba(14,15,19,0.92) 100%)` }} />
    </>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      {children}
    </div>
  );
}

// ================= TITLE =================
export function Title({ save, onPlay, onTalents, onAtlas, onChars }: { save: Save; onPlay: () => void; onTalents: () => void; onAtlas: () => void; onChars: () => void }) {
  const [modal, setModal] = useState<'none' | 'settings' | 'howto'>('none');
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#0e0f13] text-[#f2e6c9]">
      <KeyArt />
      <div className="relative flex h-full flex-col justify-between gap-6 p-4 sm:p-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <LogoImg className="kit-bob w-[min(560px,88vw)] md:w-[min(600px,40vw)]" />
          <div className="flex flex-col items-end gap-2">
            <div className="font-cond2 text-[11px] font-bold uppercase tracking-[0.22em] text-[#9aa0a6]">Soul candy</div>
            <Chip icon={<CandyIcon size={20} />} className="!text-xl">{save.soul}</Chip>
            {save.best > 0 && <Chip icon={<ClockIcon size={16} />} className="!text-xs">BEST {fmtTime(save.best)}</Chip>}
          </div>
        </header>
        <nav className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
          <KitButton size="lg" icon={Play} fillIcon onClick={onPlay} className="w-full sm:w-auto">Go trick-or-treating</KitButton>
          <KitButton size="lg" variant="dark" icon={Lollipop} iconColor="#ff5f9e" onClick={onTalents}>Talents ({save.soul})</KitButton>
          <KitButton size="lg" variant="dark" icon={Users} iconColor="#fb8016" onClick={onChars}>Characters</KitButton>
          <KitButton size="lg" variant="dark" icon={Backpack} iconColor="#fb8016" onClick={onAtlas}>Collection</KitButton>
          <KitButton size="lg" variant="dark" icon={Gamepad2} iconColor="#f4e6c4" onClick={() => setModal('howto')}>How to play</KitButton>
          <KitButton size="lg" variant="dark" icon={Gear} iconColor="#f4e6c4" onClick={() => setModal('settings')}>Settings</KitButton>
        </nav>
      </div>
      {modal === 'settings' && <SettingsModal onClose={() => setModal('none')} />}
      {modal === 'howto' && <HowToModal onClose={() => setModal('none')} />}
    </div>
  );
}

function HowToModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <Modal onClose={onClose}>
      <div className="kit-pop w-full max-w-3xl space-y-3">
        <InfoPanel />
        <ControlsPanel />
        <div className="kit-panel px-4 py-3 font-ui text-[14px] leading-relaxed text-[#e6dcc4]">
          Ring doorbells for candy and treats, but you're stuck on the porch while you wait, and the doorbell draws the horde. Wear a costume for better treats.
          New streets open every minute. The <span className="text-[#fb8016]">Pumpkin King</span> rises at 05:00.
        </div>
        <div className="flex justify-end"><KitButton variant="cream" onClick={onClose}>Got it</KitButton></div>
      </div>
    </Modal>
  );
}

// ================= CHARACTER SELECT =================
export function CharSelect({ save, setHero, onBack, onPlay }: { save: Save; setHero: (h: number) => void; onBack: () => void; onPlay: () => void }) {
  const i = save.hero;
  const n = HERO_INFO.length;
  const stats = useMemo(() => {
    const s = baseStats();
    HERO_INFO[i].apply(s);
    applyTalents(s, save.talents);
    return s;
  }, [i, save.talents]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') setHero((i + n - 1) % n);
      else if (k === 'arrowright' || k === 'd') setHero((i + 1) % n);
      else if (k === 'enter') onPlay();
      else if (k === 'escape') onBack();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [i, n, setHero, onPlay, onBack]);
  return (
    <div className="absolute inset-0 overflow-y-auto bg-[#0e0f13] text-[#f2e6c9]">
      <KeyArt dim={0.35} blur />
      <div className="relative mx-auto flex min-h-full max-w-4xl flex-col items-center justify-center gap-6 px-4 py-8">
        <div className="text-center">
          <KitTitle className="text-4xl sm:text-5xl">Choose your kid</KitTitle>
          <div className="mt-2 font-cond2 text-sm font-semibold uppercase tracking-[0.16em] text-[#9aa0a6]">Each has a passive perk and a unique hero skill</div>
        </div>
        <CharacterCard key={i} hero={i} stats={stats} onPrev={() => setHero((i + n - 1) % n)} onNext={() => setHero((i + 1) % n)} />
        <div className="flex flex-wrap items-end justify-center gap-3">
          {HERO_INFO.map((h, k) => (
            <button key={k} onClick={() => setHero(k)} title={h.name} className="h-16 w-16 overflow-hidden border-[3px] shadow-[0_0_0_2px_#000] transition-transform hover:-translate-y-1" style={{ borderColor: k === i ? '#fb8016' : '#3a3d44', background: HERO_COLORS[k] }}>
              <img src={FACES[k]} alt={h.name} draggable={false} className={`h-full w-full object-cover ${k === i ? '' : 'opacity-70 saturate-50'}`} />
            </button>
          ))}
          <div className="kit-panel ml-2 flex h-16 items-end overflow-hidden px-2" title="In-game sprite">
            <div className="-mb-1"><HeroPreview hero={i} size={0.75} walking /></div>
            <span className="mb-1.5 ml-1 font-cond2 text-[10px] font-bold uppercase tracking-widest text-[#9aa0a6]">In game</span>
          </div>
        </div>
        <div className="flex gap-3">
          <KitButton variant="dark" icon={ChevronLeft} onClick={onBack}>Back</KitButton>
          <KitButton icon={Play} fillIcon onClick={onPlay}>Start the night</KitButton>
        </div>
      </div>
    </div>
  );
}

// ================= SETTINGS =================
export function SettingsModal({ onClose }: { onClose: () => void }) {
  const [, force] = useState(0);
  const [armed, setArmed] = useState(false);
  const set = (fn: () => void) => { fn(); saveSettings(); force((n) => n + 1); };
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <Modal onClose={onClose}>
      <div className="kit-panel kit-pop w-full max-w-md p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <KitTitle className="text-4xl">Settings</KitTitle>
          <button onClick={onClose} aria-label="Close" className="text-[#9aa0a6] hover:text-[#fb8016]"><X size={24} /></button>
        </div>
        <div className="mt-5 space-y-4">
          <SettingRow label="Screen shake" desc="Camera kick on hits & explosions"><Slider icon={Vibrate} label="Screen shake" value={settings.shake} onChange={(v) => set(() => (settings.shake = v))} /></SettingRow>
          <SettingRow label="Night brightness" desc="Lift the darkness a little"><Slider icon={settings.bright > 0.5 ? Sun : Moon} label="Night brightness" value={settings.bright} onChange={(v) => set(() => (settings.bright = v))} /></SettingRow>
          <SettingRow label="Damage numbers" desc="Floating numbers when you hit"><Toggle label="Damage numbers" on={settings.dmgText} onChange={(v) => set(() => (settings.dmgText = v))} /></SettingRow>
          <SettingRow label="Low effects" desc="Fewer particles for slow machines"><Toggle label="Low effects" on={settings.lowFx} onChange={(v) => set(() => (settings.lowFx = v))} /></SettingRow>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
          <KitButton
            variant="red" size="sm" icon={RotateCw}
            onClick={() => { if (!armed) setArmed(true); else { localStorage.clear(); location.reload(); } }}
          >
            {armed ? 'Click again to wipe' : 'Reset progress'}
          </KitButton>
          <KitButton variant="cream" onClick={onClose}>Confirm</KitButton>
        </div>
      </div>
    </Modal>
  );
}
function SettingRow({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div>
        <div className="font-cond2 text-[15px] font-bold uppercase tracking-wide text-[#f2e6c9]">{label}</div>
        <div className="text-[12px] text-[#9aa0a6]">{desc}</div>
      </div>
      {children}
    </div>
  );
}

// ================= PAUSE =================
export function Pause({ game, onResume, onRestart, onQuit }: { game: Game; onResume: () => void; onRestart: () => void; onQuit: () => void }) {
  const cur = game.p.weapons[game.p.cur];
  const [panel, setPanel] = useState<'none' | 'settings' | 'controls'>('none');
  const [hover, setHover] = useState(0);
  const items = [
    { label: 'Resume', on: onResume, icon: Play },
    { label: 'Settings', on: () => setPanel('settings'), icon: Gear },
    { label: 'Controls', on: () => setPanel((p) => (p === 'controls' ? 'none' : 'controls')), icon: Gamepad2 },
    { label: 'Restart run', on: onRestart, icon: RotateCw },
    { label: 'Quit run', on: onQuit, icon: LogOut },
  ];
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-y-auto bg-black/70 p-4">
      <div className="flex flex-col items-center gap-4">
        <div className="flex flex-wrap items-start justify-center gap-5">
          <div className="kit-panel kit-pop w-[300px] overflow-hidden">
            <KitTitle className="pb-3 pt-4 text-center text-[54px]">Paused</KitTitle>
            <img src={ART.pause} alt="" draggable={false} className="block w-full border-y border-black" />
            <div className="py-1">
              {items.map((it, k) => {
                const on = hover === k;
                return (
                  <button key={it.label} onMouseEnter={() => setHover(k)} onFocus={() => setHover(k)} onClick={it.on} className="flex w-full items-center gap-4 border-b border-[#24262c] px-5 py-2.5 text-left last:border-0">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-[3px] ${on ? 'bg-[#fb8016] text-[#0c0b0a]' : 'text-[#f4e6c4]'}`}>
                      <it.icon size={on ? 20 : 24} strokeWidth={2.6} fill={it.icon === Play ? 'currentColor' : 'none'} />
                    </span>
                    <span className={`font-cond2 text-[19px] font-bold uppercase tracking-wide ${on ? 'text-[#fb8016]' : 'text-[#f2e6c9]'}`}>{it.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex w-72 flex-col gap-4">
            {cur ? <WeaponCard w={cur} stats={game.stats} title="Equipped" /> : <div className="font-cond2 text-sm text-[#9aa0a6]">No weapon equipped</div>}
            {Object.keys(game.scrolls).length > 0 && (
              <div className="kit-panel p-3">
                <div className="mb-2 font-cond2 text-[12px] font-bold uppercase tracking-[0.18em] text-[#9aa0a6]">Treats this run</div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(game.scrolls).map(([id, n]) => (
                    <span key={id} className="kit-tile flex h-9 min-w-9 items-center justify-center gap-0.5 px-1 text-base" style={{ borderColor: RARITY_KIT[SCROLL_BY_ID[id].rarity] }} title={`${SCROLL_BY_ID[id].name}: ${SCROLL_BY_ID[id].desc}`}>
                      {SCROLL_BY_ID[id].icon}{n > 1 && <span className="font-cond2 text-[11px] font-bold text-[#fb8016]">x{n}</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        {panel === 'controls' && <ControlsPanel className="kit-pop w-full max-w-[640px]" />}
      </div>
      {panel === 'settings' && <SettingsModal onClose={() => setPanel('none')} />}
    </div>
  );
}

// ================= LEVEL UP =================
export function LevelUp({ game, onDone }: { game: Game; onDone: () => void }) {
  const [, force] = useState(0);
  const pick = (id: string) => { game.choose(id); force((n) => n + 1); onDone(); };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const i = ['1', '2', '3', '4', '5'].indexOf(e.key);
      if (i >= 0 && game.choices[i]) pick(game.choices[i].id);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });
  const mode = game.choiceMode;
  const kind = mode === 'house' ? 'tot' : mode === 'shop' ? 'weapon' : 'level';
  const title = mode === 'shop' ? 'Pick a treat' : mode === 'house' ? 'Trick or treat!' : 'Level up!';
  const sub = mode === 'house'
    ? `${game.choiceGiver}'s candy bowl · ${game.p.costume ? 'costume bonus: extra pick' : 'no costume = stingy treats'}`
    : mode === 'shop' ? "Candy Lady's mystery treat" : `Level ${game.p.level - game.pendingLevels + 1} · treats stack`;
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-y-auto bg-black/70 p-4">
      <div className="w-full max-w-5xl">
        <Banner key={title + game.p.level} kind={kind} title={title} sub={sub} size="lg" className="kit-pop mx-auto w-[min(660px,100%)]" />
        <div className={`mt-6 grid grid-cols-1 gap-4 ${game.choices.length >= 4 ? 'md:grid-cols-4' : game.choices.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
          {game.choices.map((c, i) => {
            const rc = RARITY_KIT[c.rarity];
            return (
              <button key={c.id + i} onClick={() => pick(c.id)} className="kit-panel group flex flex-col items-center p-4 text-center transition-transform hover:-translate-y-1.5" style={{ borderColor: rc, boxShadow: `0 0 0 1px #000, 0 0 22px ${rc}33` }}>
                <div className="flex w-full items-center justify-between">
                  <Keycap>{i + 1}</Keycap>
                  <span className="font-cond2 text-[12px] font-bold uppercase tracking-[0.2em]" style={{ color: rc }}>{RARITY_NAMES[c.rarity]}</span>
                </div>
                <div className="my-3 text-5xl transition-transform group-hover:scale-110">{c.icon}</div>
                <div className="font-cond text-xl uppercase leading-tight text-[#f2e6c9]">{c.name}</div>
                <div className="mt-1.5 text-[13px] leading-snug text-[#c9c1ad]">{c.desc}</div>
                <div className="mt-auto pt-2 font-num text-[11px] text-[#6b7078]">Owned {game.scrolls[c.id] || 0}/{c.max}</div>
              </button>
            );
          })}
        </div>
        <div className="mt-5 flex justify-center">
          <KitButton variant="teal" disabled={game.rerolls <= 0} onClick={() => { game.reroll(); force((n) => n + 1); }}>🎲 Reroll ({game.rerolls})</KitButton>
        </div>
      </div>
    </div>
  );
}

// ================= SHOP =================
function WeaponThumb({ id }: { id: string }) {
  return <div className="kit-tile flex h-11 w-[72px] shrink-0 items-center justify-center"><img src={weaponUrl(id)} className="h-7 w-14 [image-rendering:pixelated]" alt="" /></div>;
}
export function Shop({ game, onClose }: { game: Game; onClose: () => void }) {
  const [, force] = useState(0);
  const f = () => force((n) => n + 1);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key.toLowerCase() === 'e') onClose(); };
    const t = setTimeout(() => window.addEventListener('keydown', h), 150);
    return () => { clearTimeout(t); window.removeEventListener('keydown', h); };
  }, [onClose]);
  const p = game.p;
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-y-auto bg-black/70 p-4">
      <div className="kit-panel kit-pop w-full max-w-3xl p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <KitTitle className="text-3xl sm:text-4xl">Candy Lady's Treats</KitTitle>
            <div className="mt-1 font-ui text-[13px] italic text-[#9aa0a6]">"Spend those coins wisely, dearie… the night is long."</div>
          </div>
          <Chip icon={<CoinIcon size={20} />} className="!text-xl" color="#ffc453">{p.coins}</Chip>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
          {p.weapons.map((w, i) => w && (
            <div key={i} className="kit-tile p-3">
              <div className="flex items-center gap-3">
                <WeaponThumb id={w.def.id} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-cond text-lg uppercase" style={{ color: w.rarity ? RARITY_KIT[w.rarity] : '#f2e6c9' }}>{weaponTitle(w)}</div>
                  <div className="font-cond2 text-[12px] font-semibold text-[#9aa0a6]">+14% damage · +3% fire rate</div>
                </div>
              </div>
              <KitButton size="sm" className="mt-2.5 w-full" disabled={p.coins < upgradeCost(w)} onClick={() => { game.shopUpgrade(i); f(); }}>Upgrade to Lv {w.level + 1} · 🪙 {upgradeCost(w)}</KitButton>
            </div>
          ))}
          <div className="kit-tile p-3">
            <div className="font-cond text-lg uppercase text-[#ff4d5a]">🍫 Full-size chocolate bar</div>
            <div className="font-cond2 text-[12px] font-semibold text-[#9aa0a6]">Restore 50% HP ({Math.ceil(p.hp)}/{Math.round(game.stats.maxHp)})</div>
            <KitButton size="sm" variant="dark" className="mt-2.5 w-full" disabled={p.coins < game.healCost() || p.hp >= game.stats.maxHp} onClick={() => { game.shopHeal(); f(); }}>Buy · 🪙 {game.healCost()}</KitButton>
          </div>
          <div className="kit-tile p-3">
            <div className="font-cond text-lg uppercase text-[#b98aff]">🎁 Mystery treat</div>
            <div className="font-cond2 text-[12px] font-semibold text-[#9aa0a6]">Pick 1 of {3 + game.stats.totChoices} treats (like a level-up)</div>
            <KitButton size="sm" variant="dark" className="mt-2.5 w-full" disabled={p.coins < game.treatCost()} onClick={() => { game.shopTreat(); onClose(); }}>Buy · 🪙 {game.treatCost()}</KitButton>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-end gap-2.5">
          <span className="font-cond2 text-[12px] font-semibold text-[#9aa0a6]"><Keycap>E</Keycap> / <Keycap>Esc</Keycap></span>
          <KitButton variant="cream" onClick={onClose}>Leave</KitButton>
        </div>
      </div>
    </div>
  );
}

// ================= END =================
export function EndScreen({ game, onAgain, onTitle, onTalents, onContinue }: { game: Game; onAgain: () => void; onTitle: () => void; onTalents: () => void; onContinue: () => void }) {
  const win = game.state === 'victory';
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-y-auto bg-black/80 p-4">
      <div className="w-full max-w-xl">
        <img src={ART.kitLogo} alt="" draggable={false} className="mx-auto mb-3 w-[min(300px,70vw)]" />
        <Banner kind={win ? 'mission' : 'died'} title={win ? 'Mission complete' : 'You died'} sub={win ? 'The Pumpkin King has been smashed' : 'The monsters got you this time'} size="lg" className="kit-pop" />
        <div className="kit-panel mt-4 p-5">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Stat icon={<ClockIcon size={18} />} label="Survived" v={fmtTime(game.time)} />
            <Stat icon={<SkullIcon size={18} />} label="Monsters" v={String(game.kills)} />
            <Stat icon={<HouseIcon size={18} />} label="Doors" v={String(game.housesVisited)} />
            <Stat icon={<CandyIcon size={18} />} label="Level" v={String(game.p.level)} />
          </div>
          <div className="mt-4 flex items-center justify-center gap-2 font-cond text-3xl text-[#b98aff]">+{game.soulEarned} <CandyIcon size={26} /> <span className="font-cond2 text-sm font-bold uppercase tracking-[0.18em] text-[#9aa0a6]">soul candy</span></div>
          <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {win && <KitButton icon={Play} fillIcon onClick={onContinue} className="sm:col-span-2">Endless night</KitButton>}
            <KitButton variant={win ? 'teal' : 'orange'} icon={RotateCw} onClick={onAgain}>Play again</KitButton>
            <KitButton variant="teal" icon={Lollipop} onClick={onTalents}>Talents</KitButton>
            <KitButton variant="red" icon={LogOut} onClick={onTitle} className="sm:col-span-2">Quit to menu</KitButton>
          </div>
        </div>
      </div>
    </div>
  );
}
function Stat({ icon, label, v }: { icon: React.ReactNode; label: string; v: string }) {
  return (
    <div className="kit-tile px-3 py-2">
      <div className="flex items-center gap-1.5 font-cond2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#9aa0a6]">{icon}{label}</div>
      <div className="font-num text-xl text-[#f2e6c9]">{v}</div>
    </div>
  );
}
