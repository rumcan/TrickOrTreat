import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Play, Users, Backpack, Settings as Gear, ChevronRight, RotateCw, X, ChevronLeft, Gamepad2, Sun, Vibrate, Moon, Lock, Maximize, Trophy, Sparkles, Keyboard } from 'lucide-react';
import { Game } from '../game/engine';
import { HERO_INFO, Save, ESSENCE_UNLOCK, essenceEarned, weaponTitle, SCROLL_BY_ID, baseStats, applyTalents, weaponStats, weaponDps, Scroll, Weapon } from '../game/data';
import { settings, saveSettings } from '../game/settings';
import * as storage from '../game/storage';
import { KitButton, KitTitle, Keycap, Toggle, Slider, Banner, LogoImg } from './kit';
import { WeaponCard, CharacterCard, ControlsPanel, InfoPanel, fmtTime, RARITY_KIT, CandyIcon, ClockIcon, SkullIcon, HouseIcon, CoinIcon, TreatArt, GunArt, Inscriptions } from './common';
import { ART, FACES, PORTRAITS, HERO_COLORS } from './art';
import { RunInventory } from './RunInventory';
import { TalentTree } from './TalentTree';
import { gameAudio } from '../game/audio';
import { tutorialSeen, forgetTutorial, rememberTutorial } from '../game/tutorial';
import { adsAvailable, watchRewardedAd } from '../game/ads';
import { expansion, hasFullGame } from '../game/expansion';
import { ExpansionUnlock } from './ExpansionUnlock';
import { UnlockShowcase } from './UnlockShowcase';
import { TagChips } from './BuildSheet';
import { SCROLL_TAGS } from '../game/build';
import { SplashArt } from './SplashArt';
import { LeaderboardDrawer } from './LeaderboardDrawer';
import RadioPill, { MusicToggle } from './RadioPill';
import { KeybindEditor } from './Keybinds';
import { useBack } from './back';
import { canFullscreen, requestGameFullscreen } from './fullscreen';

const RARITY_NAMES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];

/** full-bleed key art with a readable vignette */
function KeyArt({ dim = 0, blur }: { dim?: number; blur?: boolean }) {
  return (
    <>
      <SplashArt style={blur ? { filter: 'blur(5px) saturate(0.7)', transform: 'scale(1.05)' } : undefined} />
      <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, rgba(14,15,19,${0.55 + dim}) 0%, rgba(14,15,19,${dim}) 38%, rgba(14,15,19,${0.15 + dim}) 62%, rgba(14,15,19,0.92) 100%)` }} />
    </>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  useBack(() => onClose?.(), !!onClose);
  return (
    <div className="absolute inset-0 z-50 bg-black/75">
      {/* margin:auto centring, so a popup taller than the phone starts at its top instead of being cut off above it */}
      <div className="modal-scroll flex h-full overflow-y-auto overscroll-contain p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
        <div className="m-auto flex w-full justify-center">{children}</div>
      </div>
      {/* phones: always-visible way out, pinned over the scrolling content */}
      {onClose && <button type="button" className="modal-close" aria-label="Close popup" onClick={onClose}><X size={20} strokeWidth={3} /></button>}
    </div>
  );
}

// ================= TITLE =================
/** The art Atlas is strictly a development tool and is never exposed by the production menu. */
const SHOW_ATLAS = import.meta.env.DEV;

/** one rail row: icon, uppercase label, chevron — the left menu of the new key art */
function MenuRow({ icon: Icon, label, sub, onClick, primary, disabled, className = '' }: { icon: LucideIcon; label: string; sub?: string; onClick?: () => void; primary?: boolean; disabled?: boolean; className?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`title-menu ${primary ? 'title-menu--play' : ''} ${className}`}>
      <Icon size={18} strokeWidth={2.6} className="title-menu-ico" />
      <span className="title-menu-text">
        <span className="title-menu-label">{label}</span>
        {sub && <span className="title-menu-sub">{sub}</span>}
      </span>
      <ChevronRight size={18} strokeWidth={3} className="title-menu-chev" aria-hidden="true" />
    </button>
  );
}

/** Essence / best time: a dark plate with a round medallion, as in the kit sheet */
function StatPlate({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: 'purple' | 'orange' }) {
  return (
    <span className={`title-stat title-stat--${tone}`}>
      <span className="title-stat-ico">{icon}</span>
      <span className="title-stat-value">{value}</span>
      <span className="title-stat-label">{label}</span>
    </span>
  );
}

export function Title({ save, setHero, onPlay, onCampaign, onTalents, onAtlas, onChars }: { save: Save; setHero: (hero: number) => void; onPlay: () => void; onCampaign: () => void; onTalents: () => void; onAtlas: () => void; onChars: () => void }) {
  const [modal, setModal] = useState<'none' | 'settings' | 'howto'>('none');
  const [settingsTab, setSettingsTab] = useState<'game' | 'keys'>('game');
  const [records, setRecords] = useState(false);
  const [showcase, setShowcase] = useState(false);
  useSyncExternalStore(expansion.subscribe, expansion.snapshot, expansion.snapshot);
  const allowed = save.hero < 3 || hasFullGame();
  const hero = HERO_INFO[save.hero];
  const kids = HERO_INFO.length;
  const step = (by: number) => setHero((save.hero + by + kids) % kids);
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#0e0f13] text-[#f2e6c9]">
      <KeyArt />
      {/* Night records still opens from the edge tab (and from the menu row above it) */}
      <LeaderboardDrawer open={records} onOpenChange={setRecords} />
      {/* Layout lives in index.css (.title-*): a left menu column on a desktop, one screen with no scrolling on a phone. */}
      <div className="title-wrap relative flex h-full flex-col justify-between gap-4 overflow-y-auto p-3 sm:p-8 sm:pt-12 lg:pt-12">
        <header aria-label="Game header" className="title-head flex flex-col items-center gap-2">
          {/* full-game unlock lives in the top-right corner (the menu takes the left) */}
          <div className="title-unlock absolute right-3 top-3 z-40 sm:right-5 sm:top-4"><ExpansionUnlock compact onPlay={onCampaign} /></div>
          <LogoImg className="title-logo w-[min(300px,74vw)] sm:w-[min(400px,40vw)] xl:w-[min(520px,36vw)]" />
          <div className="title-stats flex flex-wrap items-center justify-center gap-2">
            <StatPlate tone="purple" icon={<CandyIcon size={16} />} label="Essence" value={String(save.soul)} />
            {save.best > 0 && <StatPlate tone="orange" icon={<ClockIcon size={16} />} label="Best" value={fmtTime(save.best)} />}
            {/* phones have no menu column, so the radio rides with the counters there */}
            <MusicToggle className="title-stat-music" />
          </div>
          {/* the free way into the full game, right under the Essence it counts; it opens the showcase, which shows the progress */}
          {!hasFullGame() && <button type="button" className="unlock-badge" onClick={() => setShowcase(true)} aria-label="Reach 15,000 Essence to unlock the full game. Limited time. See what is in it."><img src={ART.badge15k} alt="" draggable={false} className="kit-bob" /></button>}
          {showcase && <UnlockShowcase onClose={() => setShowcase(false)} onPlay={onCampaign} />}
        </header>
        <div className="title-main mx-auto flex w-full max-w-4xl flex-1 flex-col">
          <div className="title-pick flex flex-1 items-center py-5">
          <section aria-label="Character selection" className="title-panel kit-panel nx-leafy nx-bracket w-full p-3 sm:p-4">
            <h1 className="title-h1 mb-3 font-cond text-xl uppercase text-[#ffc453] sm:text-2xl">Choose your kid</h1>
            <div className="title-cast" role="group" aria-label="Playable kids">
              <button type="button" className="title-arrow title-arrow--prev" aria-label="Previous kid" onClick={() => step(-1)}><ChevronLeft size={20} strokeWidth={3} /></button>
              {HERO_INFO.map((kid, index) => {
                const selected = index === save.hero, locked = index >= 3 && !hasFullGame();
                return (
                  <button
                    key={kid.name}
                    aria-label={`Select ${kid.name}${locked ? ' (full game)' : ''}`}
                    aria-pressed={selected}
                    onClick={() => setHero(index)}
                    className={`title-card group ${selected ? 'is-picked' : ''}`}
                    style={{ ['--hero' as string]: HERO_COLORS[index] }}
                  >
                    <span className="title-card-art">
                      <img src={PORTRAITS[index]} alt={`${kid.name} portrait`} draggable={false} className="title-portrait" />
                      {locked && <span className="title-lock">Full game</span>}
                    </span>
                    {selected && <span aria-hidden="true" className="title-tick">✓</span>}
                    <span className="title-kid">{kid.name}</span>
                    {selected && (
                      <span className="title-card-detail">
                        <span className="title-card-role">{kid.title}</span>
                        <span className="title-card-perk">{kid.passive}</span>
                      </span>
                    )}
                  </button>
                );
              })}
              <button type="button" className="title-arrow title-arrow--next" aria-label="Next kid" onClick={() => step(1)}><ChevronRight size={20} strokeWidth={3} /></button>
            </div>
            <div className="title-go mt-3 flex flex-wrap items-center justify-between gap-3">
              <div aria-live="polite" className="title-brief min-w-0 flex-1">
                <div className="font-cond text-xl">{hero.name} <span className="text-sm text-[#9aa0a6]">· {hero.title}</span></div>
                <p className="title-passive mt-1 text-xs text-[#e6dcc4]">{hero.passive} · {hero.skill} ({hero.cd}s)</p>
                <p className="mt-1 hidden text-xs text-[#9aa0a6] sm:block">{hero.skillDesc}</p>
              </div>
              {!allowed && <p className="title-locked-note w-full text-xs text-[#ffc453]">Unlock the full game in the header to play as {hero.name}.</p>}
              <KitButton size="lg" icon={Play} fillIcon disabled={!allowed} onClick={onPlay} className="title-play w-full sm:w-auto">Go trick-or-treating</KitButton>
            </div>
          </section>
          </div>
          <nav className="title-nav" aria-label="Main menu">
            <MenuRow icon={Play} label="Play" sub="start the night" primary disabled={!allowed} onClick={onPlay} />
            <MenuRow icon={Trophy} label="Night records" sub="the longest nights" onClick={() => setRecords(true)} />
            <MenuRow icon={Sparkles} label={`Talents (${save.soul})`} sub="spend essence" onClick={onTalents} />
            <MenuRow icon={Users} label="Character details" sub="stats and skills" onClick={onChars} />
            {SHOW_ATLAS && <MenuRow icon={Backpack} label="Collection" sub="art atlas" onClick={onAtlas} />}
            <MenuRow icon={Gamepad2} label="How to play" sub="controls and tricks" onClick={() => setModal('howto')} />
            <MenuRow icon={Gear} label="Settings" sub="sound · keys · gore" onClick={() => { setSettingsTab('game'); setModal('settings'); }} />
            {/* only where it can work; never floating over other buttons */}
            {canFullscreen() && <MenuRow icon={Maximize} label="Fullscreen" className="title-fullscreen" onClick={() => requestGameFullscreen(true)} />}
            <div className="title-rail-radio"><RadioPill compact /></div>
          </nav>
        </div>
      </div>
      {modal === 'settings' && <SettingsModal tab={settingsTab} onClose={() => setModal('none')} />}
      {modal === 'howto' && <HowToModal onClose={() => setModal('none')} onCustomise={() => { setSettingsTab('keys'); setModal('settings'); }} />}
    </div>
  );
}

function HowToModal({ onClose, onCustomise }: { onClose: () => void; onCustomise?: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <Modal onClose={onClose}>
      <div className="kit-pop w-full max-w-3xl space-y-3">
        <header className="kit-panel nx-bracket w-full px-5 py-4">
          <div className="paper-kicker">Maple Falls · your first night</div>
          <h2 className="kit-word text-5xl sm:text-6xl">How to play</h2>
          <span className="nx-divider" />
        </header>
        <InfoPanel />
        <ControlsPanel onCustomise={onCustomise} />
        <div className="kit-panel px-4 py-3 font-ui text-[14px] leading-relaxed text-[#e6dcc4]">
          Ring doorbells for candy and treats, but you're stuck on the porch while you wait, and the doorbell draws the horde. Wear a costume for better treats.
          Each kid has one costume of their own: a rare Epic drop, never starting gear. After wave 10, some enemies gain elemental immunities or defensive wards. Mix damage types; aim directly against ricochet wards and use piercing 2+ against sealed shells. Ordinary mobs remain plentiful.
          New streets open every minute. The <span className="text-[#fb8016]">Pumpkin King</span> rises at 05:00.
        </div>
        <div className="flex justify-end"><KitButton variant="cream" onClick={onClose}>Got it</KitButton></div>
      </div>
    </Modal>
  );
}

// ================= CHARACTER SELECT =================
export function CharSelect({ save, setHero, onBack, onPlay }: { save: Save; setHero: (h: number) => void; onBack: () => void; onPlay: () => void }) {
  useBack(onBack);
  useSyncExternalStore(expansion.subscribe, expansion.snapshot, expansion.snapshot);
  const allowed = save.hero < 3 || hasFullGame();
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
      else if (k === 'enter' && allowed) onPlay();
      else if (k === 'escape') onBack();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [i, n, setHero, onPlay, onBack, allowed]);
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
        </div>
        <div className="flex gap-3">
          <KitButton variant="dark" icon={ChevronLeft} onClick={onBack}>Back</KitButton>
          <KitButton icon={Play} fillIcon disabled={!allowed} onClick={onPlay}>{allowed ? 'Start the night' : 'Full-game kid · unlock required'}</KitButton>
        </div>
        {!allowed && <ExpansionUnlock onPlay={onPlay} />}
      </div>
    </div>
  );
}

// ================= SETTINGS =================
/** Settings › Keys: the sheet the pause menu opens as well. */
export function ControlsSettings({ className = '' }: { className?: string }) {
  return (
    <div className={className}>
      <ControlsPanel />
      <KeybindEditor className="mt-5" />
    </div>
  );
}

/** the pill switch from the kit sheet: an orange track with the label inside */
function SettingsTabs({ tab, onChange }: { tab: 'game' | 'keys'; onChange: (t: 'game' | 'keys') => void }) {
  const tabs = [{ id: 'game' as const, label: 'Game & sound' }, { id: 'keys' as const, label: 'Controls & keys' }];
  return (
    <div role="tablist" aria-label="Settings sections" className="settings-tabs">
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" id={`settings-tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`settings-panel-${t.id}`} className="settings-tab" onClick={() => onChange(t.id)}>{t.label}</button>
      ))}
    </div>
  );
}

export function SettingsModal({ onClose, tab: firstTab = 'game' }: { onClose: () => void; tab?: 'game' | 'keys' }) {
  const [tab, setTab] = useState<'game' | 'keys'>(firstTab);
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
      <div className="kit-panel kit-pop w-full max-w-md p-5 sm:max-w-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="paper-kicker">Maple Falls · options</div>
            <h2 className="kit-word text-5xl sm:text-6xl">Settings</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="shrink-0 text-[#9aa0a6] hover:text-[#fb8016]"><X size={24} /></button>
        </div>
        <SettingsTabs tab={tab} onChange={setTab} />
        {tab === 'game' ? (
          <div id="settings-panel-game" role="tabpanel" aria-labelledby="settings-tab-game" className="settings-body mt-5 space-y-4">
            <SettingRow label="Screen shake" desc="Camera kick on hits & explosions"><Slider icon={Vibrate} label="Screen shake" value={settings.shake} onChange={(v) => set(() => (settings.shake = v))} /></SettingRow>
            <SettingRow label="Night brightness" desc="Lift the darkness a little"><Slider icon={settings.bright > 0.5 ? Sun : Moon} label="Night brightness" value={settings.bright} onChange={(v) => set(() => (settings.bright = v))} /></SettingRow>
            <SettingRow label="Damage numbers" desc="Floating numbers when you hit"><Toggle label="Damage numbers" on={settings.dmgText} onChange={(v) => set(() => (settings.dmgText = v))} /></SettingRow>
            <SettingRow label="Monster names" desc="Labels above monsters with a special power"><Toggle label="Monster names" on={settings.names} onChange={(v) => set(() => (settings.names = v))} /></SettingRow>
            <SettingRow label="Tutorial" desc="Professor Fizz's walkie-talkie lesson on your next run"><Toggle label="Tutorial on the next run" on={!tutorialSeen()} onChange={(v) => { if (v) forgetTutorial(); else rememberTutorial('never'); force((n) => n + 1); }} /></SettingRow>
            <SettingRow label="Low effects" desc="Fewer particles for slow machines"><Toggle label="Low effects" on={settings.lowFx} onChange={(v) => set(() => (settings.lowFx = v))} /></SettingRow>
            <SettingRow label="High graphics" desc="Sharper art and screen for strong PCs (applies on the next run)"><Toggle label="High graphics" on={settings.hq} onChange={(v) => set(() => (settings.hq = v))} /></SettingRow>
            <SettingRow label="Monster blood & gore" desc="Lightweight splatters; green by default"><select aria-label="Monster blood and gore" value={settings.gore} onChange={e => set(() => { settings.gore = e.target.value as typeof settings.gore; })} className="settings-select"><option value="green">Green blood</option><option value="red">Red blood</option><option value="off">Off</option></select></SettingRow>
            <SettingRow label="Sound effects" desc="Blaster pops, pickups and monster hits"><Slider icon={Moon} label="Sound effects volume" value={settings.sfxVolume} onChange={(v) => { gameAudio.setVolume(v); force((n) => n + 1); }} /></SettingRow>
            <SettingRow label="Mute audio" desc="Silences effects and the radio"><Toggle label="Mute all audio" on={settings.muted} onChange={(v) => { gameAudio.setMuted(v); force((n) => n + 1); }} /></SettingRow>
          </div>
        ) : (
          <div id="settings-panel-keys" role="tabpanel" aria-labelledby="settings-tab-keys" className="settings-body mt-5">
            <p className="settings-note"><Keyboard size={14} className="inline align-[-2px]" /> Click a key, then press the one you want. Everything here is used by the game the moment you set it, and it is remembered on this device.</p>
            <ControlsSettings />
          </div>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
          <KitButton
            variant="red" size="sm" icon={RotateCw}
            onClick={() => { if (!armed) setArmed(true); else { storage.clearAll().then(() => location.reload()); } }}
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
    <div className="settings-row flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
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
  const [panel, setPanel] = useState<'none' | 'settings' | 'controls' | 'keys' | 'inventory' | 'team'>('none');
  const [, setHover] = useState(0);
  const items = [
    { label: 'Resume', sub: 'back to the night', on: onResume },
    { label: 'Your run build (I)', sub: 'treats · synergies · damage math', on: () => setPanel('inventory') },
    ...(game.friends.length ? [{ label: 'Friends & shared guns', sub: 'your team and their guns', on: () => setPanel('team') }] : []),
    { label: 'Settings', sub: 'sound · brightness · gore', on: () => setPanel('settings') },
    { label: 'Controls', sub: 'keys and mouse', on: () => setPanel((p) => (p === 'controls' ? 'none' : 'controls')) },
    { label: 'Restart run', sub: 'same kid, fresh night', on: onRestart },
    { label: 'Quit run', sub: 'bank your essence', on: onQuit },
  ];
  const treats = Object.entries(game.scrolls).filter(([id, n]) => n > 0 && SCROLL_BY_ID[id]);
  return (
    <div className="hm-backdrop">
      <div className="hm-modal hm-pause nx-bracket nx-bracket--red kit-pop grid gap-6 md:grid-cols-[minmax(0,1fr)_300px]">
        <div className="hm-pause-main min-w-0">
          <div className="paper-kicker">Paused · {fmtTime(game.time)} · {HERO_INFO[game.hero].name}</div>
          <h2 className="hm-modal-title">Take a breather</h2>
          <span className="hm-rule" />
          <ol className="mt-5 shrink-0">
            {items.map((it, k) => (
              <li key={it.label}>
                <button onMouseEnter={() => setHover(k)} onClick={it.on} className="hm-menu-row">
                  <span className="hm-menu-n">{String(k + 1).padStart(2, '0')}</span>
                  <span className="hm-menu-label">{it.label}</span>
                  <span className="hm-menu-sub">{it.sub}</span>
                  <ChevronRight size={18} strokeWidth={3} className="hm-menu-chev" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ol>
          {treats.length > 0 && panel !== 'controls' && (
            <div className="paper-section hm-pause-treats mt-5">
              <h3>Treats this run · {treats.reduce((a, [, n]) => a + n, 0)}</h3>
              {/* the only part of the pause menu that scrolls: a long run collects dozens of treats */}
              <div className="hm-pause-grid grid grid-cols-5 gap-1.5 sm:grid-cols-8" tabIndex={0} aria-label="Treats collected this run">
                {treats.map(([id, n]) => (
                  <div key={id} className="hm-thumb" title={`${SCROLL_BY_ID[id].name}: ${SCROLL_BY_ID[id].desc}`} style={{ borderColor: RARITY_KIT[SCROLL_BY_ID[id].rarity] }}>
                    <TreatArt id={id} />
                    {n > 1 && <span className="hm-thumb-n">×{n}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {panel === 'controls' && <ControlsPanel className="kit-pop mt-4 w-full" onCustomise={() => setPanel('keys')} />}
        </div>
        <aside className="flex min-w-0 flex-col gap-4">
          {cur ? <WeaponCard w={cur} stats={game.stats} title="In hand" compact className="!w-full shrink-0" /> : <div className="text-sm text-[#8f8676]">No weapon equipped</div>}
        </aside>
      </div>
      {panel === 'settings' && <SettingsModal onClose={() => setPanel('none')} />}
      {panel === 'keys' && <Modal onClose={() => setPanel('controls')}><div className="kit-panel kit-pop w-full max-w-2xl p-5 sm:p-6 text-[#f2e6c9]"><div className="paper-kicker">Paused · {HERO_INFO[game.hero].name}</div><h2 className="kit-word text-5xl">Controls</h2><p className="settings-note mt-2">Click a key, then press the one you want. Your keys apply straight away and are remembered on this device.</p><KeybindEditor className="mt-4" /><div className="mt-4 flex justify-end gap-2"><KitButton variant="dark" onClick={() => setPanel('controls')}>Back to controls</KitButton><KitButton variant="cream" onClick={() => setPanel('none')}>Done</KitButton></div></div></Modal>}
      {panel === 'inventory' && <RunInventory game={game} onClose={() => setPanel('none')} />}
      {panel === 'team' && <Modal onClose={() => setPanel('none')}><div className="kit-panel w-full max-w-3xl p-5 text-[#f2e6c9]"><KitTitle className="text-3xl">Friends & shared guns</KitTitle><p className="mt-2 text-sm text-[#9aa0a6]">Every friend on your team fights beside you. Sharing swaps guns, so nothing is duplicated. All friends' guns follow your highest weapon level. A friend who goes down must be revived within 30 seconds.</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{game.friends.map(f => <div key={f.hero} className="kit-tile p-3"><div className="font-cond text-xl">{HERO_INFO[f.hero].name} {f.status === 'rescued' ? ((f.abductT ?? 0) > 0 ? `· abducted ${Math.ceil(f.abductT!)}s` : f.hp > 0 ? '· fighting' : '· down') : ''}</div>{f.status !== 'rescued' ? <p className="text-sm text-[#9aa0a6]">Find them in {game.rescueMap.gates[f.gate].name} and revive them.</p> : <><p className="text-sm">HP {Math.ceil(f.hp)}/{f.maxHp} · {f.weapon.def.name} Lv {f.weapon.level}</p><p className="text-xs text-[#9aa0a6]">Friend candy {f.candy} · revive {f.reviveCd > 0 ? `${Math.ceil(f.reviveCd)}s` : 'ready'}</p><div className="mt-2 flex gap-2">{game.p.weapons.map((w, slot) => w && <KitButton key={slot} size="sm" variant="dark" onClick={() => { game.giveFriendWeapon(f.hero, slot); setHover(n => n + 1); }}>Swap gun {slot + 1}</KitButton>)}</div></>}</div>)}</div><KitButton className="mt-4" variant="cream" onClick={() => setPanel('none')}>Back</KitButton></div></Modal>}
    </div>
  );
}

/** a treat's retro card illustration */

/** Free game: a full-game treat or gun on show behind glass. Read-only, never pickable; it teases the unlock. */
function LockedPick({ scroll, weapon, game, onTaken }: { scroll: Scroll | null; weapon: Weapon | null; game: Game; onTaken: () => void }) {
  // RUN's apps can show a rewarded ad: watch one and the locked prize is this bowl's pick (for this run)
  const [ad, setAd] = useState<'idle' | 'playing' | 'failed'>('idle');
  const offer = adsAvailable();
  const watch = async () => {
    if (ad === 'playing') return;
    setAd('playing');
    const earned = await watchRewardedAd('locked-prize');
    if (earned && game.takeLocked()) { onTaken(); return; }
    setAd('failed');
  };
  const rarity = weapon ? weapon.rarity : scroll?.rarity ?? 2;
  const rc = RARITY_KIT[rarity];
  const st = weapon ? weaponStats(weapon, game.stats) : null;
  return (
    <div className="hm-pick hm-locked" style={{ ['--acc' as string]: rc }} aria-disabled={!offer} role="group" aria-label={`Locked: ${weapon ? weapon.def.name : scroll?.name}. ${offer ? 'Watch an ad to take it this run, or unlock the full game.' : 'Unlock the full game to find it.'}`}>
      <div className={`hm-pick-art ${weapon ? 'hm-pick-gun' : ''}`} style={{ ['--glow' as string]: rc }}>
        {weapon ? <GunArt id={weapon.def.id} /> : scroll && <TreatArt id={scroll.id} />}
        <span className="hm-lock" aria-hidden="true"><Lock size={26} strokeWidth={2.5} /></span>
        <span className="hm-stamp">Full game</span>
      </div>
      <div className="flex flex-1 flex-col p-3.5">
        <div className="hm-label !text-[#8f8676]">{RARITY_NAMES[rarity]} {weapon ? `gun · Lv ${weapon.level}` : 'treat'} · locked</div>
        <div className="hm-pick-name mt-1">{weapon ? weapon.def.name : scroll?.name}</div>
        {scroll?.quote && <div className="hm-pick-quote">“{scroll.quote}”</div>}
        {weapon && <div className="hm-pick-quote">{weapon.def.desc}</div>}
        <div className="hm-label mt-3">{weapon ? 'Firepower' : 'Effect'}</div>
        <div className="hm-pick-desc">{weapon && st ? <span className="font-num">{weaponDps(weapon, game.stats)} DPS · {st.mag} mag · {st.rate.toFixed(1)}/s</span> : scroll?.desc}</div>
        {weapon && <Inscriptions w={weapon} compact />}
        {offer
          ? <div className="mt-auto pt-3">
              <button type="button" className="hm-btn hm-ad-btn" disabled={ad === 'playing'} onClick={() => void watch()}><Play size={14} fill="currentColor" /> {ad === 'playing' ? 'Ad playing…' : `Watch an ad · take this ${weapon ? 'gun' : 'treat'}`}</button>
              <div className="hm-locked-foot mt-2">{ad === 'failed' ? 'No reward: the ad was not watched to the end' : 'Yours for this run · or unlock the full game'}</div>
            </div>
          : <div className="hm-locked-foot mt-auto pt-3"><Lock size={12} strokeWidth={3} /> Unlock the full game to find this</div>}
      </div>
    </div>
  );
}

// ================= DISCARD A TREAT =================
/** "Discard this treat?" Yes removes one copy for good (useful for the double-edged ones); No changes nothing. */
export function DiscardTreat({ game, onDone }: { game: Game; onDone: () => void }) {
  const sc = game.discarding ? SCROLL_BY_ID[game.discarding] : null;
  const answer = (yes: boolean) => { game.answerDiscard(yes); onDone(); };
  useEffect(() => {
    const h = (e: KeyboardEvent) => { const k = e.key.toLowerCase(); if (k === 'y' || k === 'enter') answer(true); else if (k === 'n' || k === 'escape') answer(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });
  if (!sc) return null;
  const n = game.scrolls[sc.id] || 0, rc = RARITY_KIT[sc.rarity];
  return (
    <div className="hm-backdrop" role="dialog" aria-modal="true" aria-label={`Discard ${sc.name}?`}>
      <div className="hm-modal kit-pop !w-[min(520px,100%)]">
        <div className="paper-kicker">Your treats · game paused</div>
        <h2 className="hm-modal-title !text-[clamp(30px,5vw,44px)]">Discard this treat?</h2>
        <span className="hm-rule" />
        <div className="mt-5 flex items-center gap-4">
          <span className="hm-thumb h-[76px] w-[134px] shrink-0 !aspect-auto" style={{ borderColor: rc }}><TreatArt id={sc.id} /></span>
          <div className="min-w-0">
            <div className="hm-label" style={{ color: rc }}>{RARITY_NAMES[sc.rarity]} treat{n > 1 ? ` · you hold ${n}` : ''}</div>
            <div className="font-cond text-2xl uppercase leading-tight text-[#fff0da]">{sc.name}</div>
            <div className="mt-1 text-[15px] font-semibold text-[#f2e8d4]">{sc.desc}</div>
          </div>
        </div>
        <p className="mt-4 text-sm text-[#c9bda6]">{n > 1 ? 'One copy is thrown away for good.' : 'It is thrown away for good.'} You get nothing back for it.</p>
        <div className="hm-foot">
          <button className="hm-btn ghost" onClick={() => answer(false)}>No, keep it</button>
          <button className="hm-btn" onClick={() => answer(true)}>Yes, discard</button>
        </div>
      </div>
    </div>
  );
}

// ================= LEVEL UP =================
export function LevelUp({ game, onDone }: { game: Game; onDone: () => void }) {
  const [, force] = useState(0);
  const pick = (id: string) => { game.choose(id); force((n) => n + 1); onDone(); };
  const pickGun = (i: number) => { game.chooseGun(i); force((n) => n + 1); onDone(); };
  const pickFriend = () => { game.chooseFriend(); force((n) => n + 1); onDone(); };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.repeat || game.state !== 'levelup') return;
      const i = ['1', '2', '3', '4', '5', '6'].indexOf(e.key);
      if (i < 0) return;
      if (game.choices[i]) pick(game.choices[i].id);
      else if (game.gunChoices[i - game.choices.length]) pickGun(i - game.choices.length);
      else if (game.friendChoice !== null && i === game.choices.length + game.gunChoices.length) pickFriend();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });
  const mode = game.choiceMode;
  const title = mode === 'shop' ? 'Pick a treat' : mode === 'house' ? 'Trick or treat!' : 'Level up!';
  const houseNote = mode === 'house' ? ` · ${game.choiceRewardRange.label}: a treat or a gun` : '';
  const kicker = mode === 'house'
    ? `${game.choiceGiver}'s candy bowl · ${game.p.costume ? 'costume bonus: better treats' : 'choose one reward'}${houseNote}`
    : mode === 'shop' ? "The Candy Lady's mystery bag" : `Level ${game.p.level - game.pendingLevels + 1} · what do you imagine tonight?`;
  const friend = mode === 'house' ? game.friendChoice : null;
  const n = game.choices.length + game.gunChoices.length + (friend === null ? 0 : 1);
  const locked = game.lockedChoice;
  const cards = n + (locked ? 1 : 0);
  // "Level up!" is drawn as a brush wordmark: cream first word, orange painted second (art/concept/level-up.webp)
  const titleWords = title.split(' ');
  const titleHead = titleWords.slice(0, -1).join(' ');
  const titleTail = titleWords[titleWords.length - 1];
  return (
    <div className="hm-backdrop">
      <div className="hm-modal hm-modal--lvl nx-leafy kit-pop">
        <header className="lvl-head">
          <div className="lvl-kicker">{kicker}</div>
          <h2 className="lvl-title" aria-label={title}><span>{titleHead}</span> <em>{titleTail}</em></h2>
        </header>
        {mode === 'house' && game.treatGuideNotice && <aside role="note" aria-label="Trick-or-treat guide" className="mt-4 rounded-lg border border-[#69cf91]/60 bg-[#102a23] px-4 py-3 text-sm leading-relaxed text-[#f0fff4]">
          <strong className="block text-[#a4f5ba]">The best loot is behind a door.</strong>
          Trick-or-treat at houses and other buildings across town to find treats and guns. Houses offer Common–Rare loot; other venues offer Rare–Epic, and major buildings can offer Legendary rewards.
        </aside>}
        <div className={`lvl-grid mt-5 grid grid-cols-1 gap-4 ${cards >= 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : cards === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
          {game.choices.map((c, i) => {
            const rc = RARITY_KIT[c.rarity], owned = game.scrolls[c.id] || 0;
            return (
              <button key={c.id + i} onClick={() => pick(c.id)} className="hm-pick lvl-card" style={{ ['--acc' as string]: rc }}>
                <div className="hm-pick-art">
                  <TreatArt id={c.id} />
                  <span className="lvl-num">{i + 1}</span>
                  <span className="hm-stamp">{RARITY_NAMES[c.rarity]} treat</span>
                </div>
                <div className="lvl-body flex flex-1 flex-col">
                  <div className="hm-pick-name">{c.name}</div>
                  {c.quote && <div className="hm-pick-quote">“{c.quote}”</div>}
                  <div className="lvl-effect">
                    <span className="hm-label">Effect</span>
                    <div className="hm-pick-desc">{c.desc}</div>
                  </div>
                  <TagChips tags={SCROLL_TAGS[c.id] ?? []} build={game.build} className="lvl-tags !justify-start" />
                  <div className="lvl-owned mt-auto flex items-baseline justify-between">
                    <span className="lvl-owned-k">{owned >= c.max ? 'Overstack' : 'Owned'}</span>
                    <span className={`font-num text-[12px] ${owned >= c.max ? 'text-[#ff7ad9]' : 'text-[#c9bda6]'}`}>{owned >= c.max ? `${owned} · no cap` : `${owned}/${c.max}`}</span>
                  </div>
                </div>
              </button>
            );
          })}
          {game.gunChoices.map((w, j) => {
            const rc = RARITY_KIT[w.rarity], i = game.choices.length + j;
            const st = weaponStats(w, game.stats);
            return (
              <button key={w.uid} onClick={() => pickGun(j)} className="hm-pick lvl-card" style={{ ['--acc' as string]: rc }} aria-label={`Take ${w.def.name}`}>
                <div className="hm-pick-art hm-pick-gun" style={{ ['--glow' as string]: rc }}>
                  <GunArt id={w.def.id} />
                  <span className="lvl-num">{i + 1}</span>
                  <span className="hm-stamp">{RARITY_NAMES[w.rarity]} gun · Lv {w.level}</span>
                </div>
                <div className="lvl-body flex flex-1 flex-col">
                  <div className="hm-pick-name">{w.def.name}</div>
                  <div className="hm-pick-quote">{w.def.desc}</div>
                  <div className="lvl-effect">
                    <span className="hm-label">Firepower</span>
                    <div className="hm-pick-desc font-num">Level {w.level} · {weaponDps(w, game.stats)} DPS · {st.mag} mag · {st.rate.toFixed(1)}/s</div>
                  </div>
                  <Inscriptions w={w} compact />
                  <div className="lvl-owned mt-auto flex items-baseline justify-between">
                    <span className="lvl-owned-k">{game.p.weapons.some((x) => !x) ? 'Free slot' : 'Compare'}</span>
                    <span className="font-num text-[12px] text-[#c9bda6]">{game.p.weapons.some((x) => !x) ? 'goes straight in' : 'compare first, you can come back'}</span>
                  </div>
                </div>
              </button>
            );
          })}
          {friend !== null && (
            <button onClick={pickFriend} className="hm-pick lvl-card hm-pick-friend" style={{ ['--acc' as string]: HERO_COLORS[friend] }} aria-label={`Let ${HERO_INFO[friend].name} join you`}>
              <div className="hm-pick-art" style={{ background: HERO_COLORS[friend] }}>
                <img src={PORTRAITS[friend]} alt="" draggable={false} className="block h-full w-full object-cover object-[50%_18%]" />
                <span className="lvl-num">{n}</span>
                <span className="hm-stamp">Friend</span>
              </div>
              <div className="lvl-body flex flex-1 flex-col">
                <div className="hm-pick-name">{HERO_INFO[friend].name} wants to come along</div>
                <div className="hm-pick-quote">“{HERO_INFO[friend].title}. Safer together, right?”</div>
                <div className="lvl-effect">
                  <span className="hm-label">Companion</span>
                  <div className="hm-pick-desc">Fights beside you with a Foam Blaster and helps you up once a minute if you fall.</div>
                </div>
                <div className="lvl-owned mt-auto flex items-baseline justify-between">
                  <span className="lvl-owned-k">Joins now</span>
                  <span className="font-num text-[12px] text-[#c9bda6]">{game.friends.some(f => f.status === 'rescued') ? 'one more helper' : 'your first helper'}</span>
                </div>
              </div>
            </button>
          )}
          {locked && <LockedPick scroll={locked.scroll} weapon={locked.weapon} game={game} onTaken={() => { force((n) => n + 1); onDone(); }} />}
        </div>
        <footer className="lvl-bar">
          <span className="lvl-bar-hint">
            Press <Keycap className="lvl-key">1</Keycap><span aria-hidden="true">–</span><Keycap className="lvl-key">{n}</Keycap> · treats stack up to their maximum
          </span>
          <button className="hm-btn lvl-reroll" disabled={game.rerolls <= 0} onClick={() => { game.reroll(); force((k) => k + 1); }}>
            <RotateCw size={18} strokeWidth={3} aria-hidden="true" /> Reroll ({game.rerolls})
          </button>
        </footer>
      </div>
    </div>
  );
}

function WeaponThumb({ id }: { id: string }) {
  return <span className="block h-[46px] w-[81px] shrink-0 overflow-hidden border-2 border-[#06090b] bg-[#0a1630]"><GunArt id={id} /></span>;
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
    <div className="hm-backdrop">
      <div className="hm-modal kit-pop !max-w-[860px]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="paper-kicker">{game.calmT > 0 ? `The Candy Lady's stand · ${Math.ceil(game.calmT)} quiet seconds left when you leave` : "The Candy Lady's stand"}</div>
            <h2 className="hm-modal-title">Treats &amp; trades</h2>
            <span className="hm-rule" />
          </div>
          <div className="paper-card flex items-center gap-2 !px-4 !py-2"><CoinIcon size={22} /><span className="font-cond text-3xl leading-none text-[#f29b39]">{p.coins}</span></div>
        </div>
        <p className="mt-3 text-[14px] italic text-[#c9bda6]">“Spend those coins wisely, dearie… the night is long.”</p>
        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
          {p.weapons.map((w, i) => w && (
            <div key={i} className="paper-card flex flex-col gap-2" style={{ borderLeft: `5px solid ${w.rarity ? RARITY_KIT[w.rarity] : '#58585b'}` }}>
              <div className="flex items-center gap-3">
                <WeaponThumb id={w.def.id} />
                <div className="min-w-0 flex-1">
                  <div className="label">Gun {i + 1} · upgrade</div>
                  <div className="truncate font-cond text-xl uppercase leading-tight">{weaponTitle(w)}</div>
                </div>
              </div>
              <div className="text-[13px] text-[#c9bda6]">+14% damage · +3% fire rate per level</div>
              <button className="hm-btn" disabled={p.coins < game.upgradePrice(w)} onClick={() => { game.shopUpgrade(i); f(); }}>Level {w.level + 1} · {game.upgradePrice(w) ? `${game.upgradePrice(w)} coins` : 'FREE'}</button>
              <div className="shop-lines" aria-label={`Inscriptions on ${w.def.name}`}>{w.traits.length ? <Inscriptions w={w} compact /> : <span className="text-[13px] text-[#8f8676]">No inscriptions</span>}</div>
              <button className="hm-btn ghost" disabled={p.coins < game.rerollCost()} title="A gamble: anything from no lines at all to a legendary set" onClick={() => { game.shopReroll(i); f(); }}>Reroll inscriptions · {game.rerollCost()} coins</button>
              <div className="text-[12px] text-[#8f8676]">A gamble: you may get amazing lines, or lose the ones you have. Costs more every time.</div>
            </div>
          ))}
          <div className="paper-card flex flex-col gap-2" style={{ borderLeft: '5px solid #e8433c' }}>
            <div className="label">First aid</div>
            <div className="font-cond text-xl uppercase leading-tight">Full-size chocolate bar</div>
            <div className="text-[13px] text-[#c9bda6]">Restore 50% HP ({Math.ceil(p.hp)}/{Math.round(game.stats.maxHp)})</div>
            <button className="hm-btn ghost" disabled={p.coins < game.healCost() || p.hp >= game.stats.maxHp} onClick={() => { game.shopHeal(); f(); }}>Buy · {game.healCost()} coins</button>
          </div>
          <div className="paper-card flex flex-col gap-2" style={{ borderLeft: '5px solid #66d2b7' }}>
            <div className="label">Friends</div>
            <div className="font-cond text-xl uppercase leading-tight">Bring a friend back</div>
            {game.revivable.length
              ? <><div className="text-[13px] text-[#c9bda6]">Back on their feet beside you, at full health.</div>
                {game.revivable.map(friend => <button key={friend.hero} className="hm-btn ghost" disabled={p.coins < game.reviveCost()} onClick={() => { game.shopRevive(friend.hero); f(); }}>{HERO_INFO[friend.hero].name} · {game.reviveCost()} coins</button>)}</>
              : <div className="text-[13px] text-[#8f8676]">Nobody is missing. If a friend goes down and is not reached in time, find them here.</div>}
          </div>
        </div>
        <div className="hm-foot">
          <span className="text-[13px] text-[#8f8676]"><Keycap className="!h-5 !rounded-none !text-[11px]">E</Keycap> / <Keycap className="!h-5 !rounded-none !text-[11px]">Esc</Keycap> to leave</span>
          <button className="hm-btn" onClick={onClose}>Leave</button>
        </div>
      </div>
    </div>
  );
}

// ================= END =================
export function EndScreen({ game, onAgain, onTitle, onContinue }: { game: Game; onAgain: () => void; onTitle: () => void; onContinue: () => void }) {
  const [panel, setPanel] = useState<'talents' | 'summary'>('summary');
  const [recordMessage, setRecordMessage] = useState('');
  useEffect(() => {
    let active = true;
    void game.recordUpload?.then(message => { if (active) setRecordMessage(message); });
    return () => { active = false; };
  }, [game, game.recordUpload]);
  const [tally, setTally] = useState(0);
  useEffect(() => {
    let frame = 0; const began = performance.now();
    const tick = () => { const progress = Math.min(1, (performance.now() - began) / 1200); setTally(Math.floor(game.soulEarned * progress)); if (progress < 1) frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [game, game.soulEarned]);
  const win = game.state === 'victory';
  // The night always ends at the talent constellations: spend what was earned, then play again or leave from there.
  if (panel === 'talents') return <TalentTree save={game.save} onBack={onTitle} backLabel="Main menu" onAgain={onAgain} earned={game.soulEarned} />;
  const rows: [string, number][] = [['Collected XP converted', game.essence.combat], ['Monsters defeated', game.essence.kills], ['Time survived', game.essence.survival], [`Bosses defeated (${game.bossWins})`, game.essence.bosses], ...(game.wave ? [[`Endless waves (${game.wave})`, game.essence.waves] as [string, number]] : [])];
  return (
    <div className="end-screen">
      <div className="end-column">
        <img src={ART.kitLogo} alt="" draggable={false} className="mx-auto mb-3 w-[min(260px,62vw)]" />
        {win || game.victorious
          ? <Banner kind="mission" title={game.victorious ? `Wave ${game.wave}` : 'Mission complete'} sub={game.victorious ? `Night beaten · endless best ${game.save.bestWave ?? game.wave}${(game.save.bestWave ?? 0) <= game.wave ? ' · new record!' : ''}` : 'The Pumpkin King has been smashed'} size="lg" className="kit-pop" />
          : <img src={ART.youDied} alt="You died. The monsters got you this time." width={1240} height={239} draggable={false} className="end-plate kit-pop" />}
        <section className="end-panel">
          <div className="paper-kicker">Tonight's run</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat icon={<ClockIcon size={18} />} label="Survived" v={fmtTime(game.time)} />
            <Stat icon={<SkullIcon size={18} />} label="Monsters" v={String(game.kills)} />
            <Stat icon={<HouseIcon size={18} />} label="Doors" v={String(game.housesVisited)} />
            <Stat icon={<CandyIcon size={18} />} label="Level" v={String(game.p.level)} />
          </div>
          <dl className="end-rows">{rows.map(([label, amount]) => <div key={label}><dt>{label}</dt><dd>+{amount}</dd></div>)}</dl>
          <div className="end-total" aria-label={`Earned ${game.soulEarned} essence`}>
            <CandyIcon size={30} />
            <b>+{tally}</b>
            <span>essence earned<small>Balance {game.save.soul} · spend it on permanent talents</small></span>
          </div>
          {game.fullGameEarned
            ? <p role="status" className="end-unlock"><b>Full game unlocked!</b> You have earned more than {ESSENCE_UNLOCK.toLocaleString('en-US')} Essence. It is yours: Maya and Leo, the bigger town, and every full-game gun, treat and talent.</p>
            : !hasFullGame() && <p className="end-unlock end-unlock--progress">Full game unlocks free at {ESSENCE_UNLOCK.toLocaleString('en-US')} Essence earned · {essenceEarned(game.save).toLocaleString('en-US')} so far</p>}
          {recordMessage && <p role="status" className="mt-3 text-center text-sm text-[#9fe1cb]">{recordMessage}</p>}
          <div className="mt-4 flex flex-col gap-2">
            {win && !game.victorious && <button className="hm-btn ghost w-full" onClick={onContinue}><Play size={17} fill="currentColor" /> Endless night</button>}
            <button className="hm-btn end-next w-full" onClick={() => setPanel('talents')}>Spend essence on talents <ChevronRight size={20} strokeWidth={3} /></button>
          </div>
        </section>
      </div>
    </div>
  );
}
function Stat({ icon, label, v }: { icon: React.ReactNode; label: string; v: string }) {
  return (
    <div className="end-stat">
      <div className="label">{icon}{label}</div>
      <b>{v}</b>
    </div>
  );
}
