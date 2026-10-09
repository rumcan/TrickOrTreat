import { useEffect, useState } from 'react';
import { Play, Users, Gem, Archive, Settings as Gear, LogOut, RotateCw, X, Bomb, Tornado, Camera, Heart, Candy, ChevronLeft } from 'lucide-react';
import { Game } from '../game/engine';
import { HERO_INFO, Save, upgradeCost, weaponTitle, SCROLL_BY_ID, RARITY_KIT_COLORS } from './kitData';
import { Btn, Keycap, KitToggle, PanelTab, WeaponCard, fmtTime, LogoImg, Tagline } from './common';
import { settings, saveSettings } from '../game/settings';
import { Controls } from './Controls';

const base = (import.meta as unknown as { env: { BASE_URL: string } }).env.BASE_URL || './';
const PORTRAITS = ['portrait_tommy.jpg', 'portrait_sam.jpg', 'portrait_jess.jpg'];
const HERO_FRAME = ['#F9781B', '#31c9e8', '#7A45F2'];

function Logo({ size = 'lg' }: { size?: 'lg' | 'sm' }) {
  return <LogoImg className={size === 'lg' ? 'w-[min(560px,86vw)] md:w-[min(560px,44vw)]' : 'w-[210px]'} />;
}

function RailItem({ icon: Icon, label, active, onClick, danger }: { icon: React.ElementType; label: string; active?: boolean; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`kit-clip flex w-56 items-center gap-3 border-2 px-4 py-2.5 text-left transition-all duration-100 ${
        active
          ? 'border-black bg-[#F9781B] text-black shadow-[inset_0_-3px_0_rgba(0,0,0,0.25)]'
          : danger
            ? 'border-[#3a3f4d] bg-[#0E1117]/85 text-[#E63946] hover:border-[#E63946] hover:translate-x-1'
            : 'border-[#3a3f4d] bg-[#0E1117]/85 text-[#F4E8D5] hover:border-[#F9781B] hover:text-[#F9781B] hover:translate-x-1'
      }`}
    >
      <Icon size={17} strokeWidth={2.4} />
      <span className="font-cond text-sm uppercase tracking-wider">{label}</span>
    </button>
  );
}

// ================= TITLE =================
export function Title({ save, onPlay, onTalents, onAtlas, onChars }: { save: Save; onPlay: () => void; onTalents: () => void; onAtlas: () => void; onChars: () => void }) {
  const [showSettings, setShowSettings] = useState(false);
  const [bye, setBye] = useState(false);
  useEffect(() => {
    if (bye) { const t = setTimeout(() => setBye(false), 2200); return () => clearTimeout(t); }
  }, [bye]);
  return (
    <div className="absolute inset-0 overflow-y-auto bg-[#0E1117] text-[#F4E8D5]">
      <div className="relative min-h-full">
        <div className="absolute inset-0 scale-105 bg-cover bg-center" style={{ backgroundImage: `url(${base}images/title_hero.jpg)` }} />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0E1117]/95 via-[#0E1117]/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0E1117] via-transparent to-[#0E1117]/70" />
        {/* drifting bats */}
        <span className="kit-bat pointer-events-none absolute left-[18%] top-[14%] text-2xl opacity-70" style={{ animationDelay: '0s' }}>🦇</span>
        <span className="kit-bat pointer-events-none absolute left-[64%] top-[9%] text-lg opacity-50" style={{ animationDelay: '1.3s' }}>🦇</span>
        <span className="kit-bat pointer-events-none absolute left-[82%] top-[22%] text-xl opacity-60" style={{ animationDelay: '2.1s' }}>🦇</span>

        <div className="relative mx-auto flex min-h-full max-w-7xl flex-col justify-between gap-8 p-5 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <Logo />
            <div className="kit-clip border-2 border-[#3a3f4d] bg-[#0E1117]/85 px-4 py-2 text-right">
              <div className="font-cond2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#9aa3b8]">Soul Candy</div>
              <div className="font-cond text-xl sm:text-2xl text-[#b79bff]">🍬 {save.soul}</div>
            </div>
          </div>

          <div className="flex flex-col-reverse items-start gap-6 md:flex-row md:items-end md:justify-between">
            <nav className="flex w-full max-w-xs flex-col gap-2">
              <Btn icon={Play} onClick={onPlay} className="w-full justify-start py-3 text-base">Go trick-or-treating</Btn>
              <RailItem icon={Users} label="Characters" onClick={onChars} />
              <RailItem icon={Gem} label="Talents" onClick={onTalents} />
              <RailItem icon={Archive} label="Collection" onClick={onAtlas} />
              <RailItem icon={Gear} label="Settings" onClick={() => setShowSettings(true)} />
              <RailItem icon={LogOut} label="Quit" danger onClick={() => setBye(true)} />
            </nav>
            <div className="flex flex-col items-start gap-4 md:items-end">
              <Tagline className="text-3xl sm:text-4xl" />
              {save.best > 0 && <div className="kit-clip inline-block border-2 border-[#3a3f4d] bg-[#0E1117]/85 px-4 py-2 font-cond2 text-sm font-bold text-[#9aa3b8]">Best survival · {fmtTime(save.best)}</div>}
            </div>
          </div>
        </div>

        {bye && (
          <div className="pointer-events-none absolute inset-x-0 bottom-24 flex justify-center px-4">
            <div className="kit-clip border-2 border-[#FFC453] bg-[#0E1117]/95 px-5 py-2.5 font-cond2 text-sm font-bold text-[#FFC453]">🎃 No escape from Halloween. The night needs you.</div>
          </div>
        )}
        {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      </div>
    </div>
  );
}

// ================= CHARACTER SELECT =================
const SKILL_ICONS = [Bomb, Tornado, Camera];
export function CharSelect({ save, setHero, onBack, onPlay }: { save: Save; setHero: (h: number) => void; onBack: () => void; onPlay: () => void }) {
  return (
    <div className="absolute inset-0 overflow-auto bg-[#0E1117] text-[#F4E8D5]">
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `url(${base}images/title_hero.jpg)`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(6px) saturate(0.6)' }} />
      <div className="absolute inset-0 bg-[#0E1117]/70" />
      <div className="relative mx-auto flex min-h-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8 lg:flex-row lg:gap-8">
        {/* rail */}
        <div className="flex shrink-0 flex-col gap-2 lg:pt-20">
          <div className="mb-2 lg:mb-6"><Logo size="sm" /></div>
          <div className="flex flex-row flex-wrap gap-2 lg:flex-col">
            <RailItem icon={Users} label="Characters" active onClick={() => {}} />
            <RailItem icon={Gem} label="Talents" onClick={onBack} />
            <RailItem icon={Archive} label="Collection" onClick={onBack} />
          </div>
        </div>
        {/* cards */}
        <div className="min-w-0 flex-1">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-cond text-3xl uppercase text-[#F4E8D5] sm:text-4xl">Choose your kid</div>
              <div className="font-cond2 text-sm font-semibold text-[#9aa3b8]">Each has a passive perk and a unique hero skill.</div>
            </div>
            <Btn onClick={onPlay} className="py-3 text-base">Start the night</Btn>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {HERO_INFO.map((h, i) => {
              const active = save.hero === i;
              const SkillIcon = SKILL_ICONS[i];
              return (
                <button key={i} onClick={() => setHero(i)} className={`kit-clip group relative border-[3px] bg-[#0E1117] text-left transition-all hover:-translate-y-1 ${active ? 'shadow-[0_0_30px_rgba(249,120,27,0.45)]' : 'opacity-90 hover:opacity-100'}`} style={{ borderColor: active ? '#F9781B' : HERO_FRAME[i] }}>
                  <div className="relative h-52 overflow-hidden sm:h-64">
                    <img src={`${base}images/${PORTRAITS[i]}`} alt={h.name} className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0E1117] via-transparent to-transparent" />
                    {active && <div className="absolute right-2 top-2"><PanelTab color="#F9781B">Selected</PanelTab></div>}
                  </div>
                  <div className="px-4 pb-4">
                    <div className="font-cond text-2xl uppercase leading-none text-white">{h.name}</div>
                    <div className="font-cond2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#9aa3b8]">{h.title}</div>
                    <div className="mt-3 flex gap-2.5 rounded-[4px] border border-black bg-[#171b24] p-2.5">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px]" style={{ background: HERO_FRAME[i] + '30', color: HERO_FRAME[i] }}>
                        <SkillIcon size={20} />
                      </div>
                      <div>
                        <div className="font-cond2 text-[12px] font-bold uppercase tracking-wide" style={{ color: HERO_FRAME[i] }}>{h.skill} · {h.cd}s</div>
                        <div className="mt-0.5 text-[11px] leading-snug text-[#9aa3b8]">{h.skillDesc}</div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-[#7CFF64]">
                      <Heart size={11} className="fill-[#7CFF64]" /> Passive: {h.passive}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-5 flex justify-center"><Btn variant="dark" icon={ChevronLeft} onClick={onBack}>Back</Btn></div>
        </div>
      </div>
    </div>
  );
}

// ================= SETTINGS =================
export function SettingsModal({ onClose }: { onClose: () => void }) {
  const [, force] = useState(0);
  const set = (fn: () => void) => { fn(); saveSettings(); force((n) => n + 1); };
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-md">
        <div className="absolute -top-3 left-4 z-10"><PanelTab color="#F9781B">04 · Settings</PanelTab></div>
        <div className="kit-panel p-6">
          <div className="flex items-center justify-between">
            <div className="font-cond text-3xl uppercase text-[#F4E8D5]">Settings</div>
            <button onClick={onClose} className="text-[#9aa3b8] hover:text-[#F9781B]"><X size={22} /></button>
          </div>
          <div className="mt-5 space-y-4">
            <SettingRow label="Screen shake" desc="Camera kick on hits & explosions" on={settings.shake} toggle={(v) => set(() => (settings.shake = v))} />
            <SettingRow label="Damage numbers" desc="Floating numbers when you hit" on={settings.dmgText} toggle={(v) => set(() => (settings.dmgText = v))} />
            <SettingRow label="Low effects" desc="Fewer particles for slow machines" on={settings.lowFx} toggle={(v) => set(() => (settings.lowFx = v))} />
          </div>
          <div className="mt-6 border-t-2 border-white/10 pt-4">
            <Btn variant="danger" icon={RotateCw} onClick={() => { localStorage.clear(); location.reload(); }}>Reset all progress</Btn>
            <span className="ml-2 font-cond2 text-[11px] text-[#9aa3b8]">Wipes talents, settings & best time.</span>
          </div>
          <div className="mt-5 flex justify-end"><Btn onClick={onClose}>Done</Btn></div>
        </div>
      </div>
    </div>
  );
}
function SettingRow({ label, desc, on, toggle }: { label: string; desc: string; on: boolean; toggle: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="font-cond2 text-sm font-bold uppercase tracking-wide text-[#F4E8D5]">{label}</div>
        <div className="text-[11px] text-[#9aa3b8]">{desc}</div>
      </div>
      <KitToggle on={on} onChange={toggle} />
    </div>
  );
}

// ================= PAUSE =================
function Skyline() {
  return (
    <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="h-20 w-full">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b1040" /><stop offset="0.5" stopColor="#8a2a1a" /><stop offset="1" stopColor="#F9781B" />
        </linearGradient>
      </defs>
      <rect width="1200" height="120" fill="url(#sky)" />
      <g fill="#120a14">
        <rect x="0" y="80" width="1200" height="40" />
        {Array.from({ length: 14 }).map((_, i) => (
          <g key={i} transform={`translate(${i * 88},0)`}>
            <rect x="6" y={64 - (i % 3) * 10} width="60" height="60" />
            <polygon points={`6,${64 - (i % 3) * 10} 36,${44 - (i % 3) * 10} 66,${64 - (i % 3) * 10}`} />
          </g>
        ))}
        <g transform="translate(880,0)">
          <rect x="26" y="30" width="48" height="24" rx="4" /><rect x="44" y="54" width="10" height="30" />
          <rect x="30" y="20" width="4" height="12" /><rect x="66" y="20" width="4" height="12" />
        </g>
      </g>
      {Array.from({ length: 18 }).map((_, i) => (
        <rect key={i} x={20 + i * 66 + (i % 2) * 12} y={86 - (i % 3) * 8} width="4" height="5" fill="#FFC453" opacity="0.9" />
      ))}
    </svg>
  );
}

export function Pause({ game, onResume, onRestart, onQuit }: { game: Game; onResume: () => void; onRestart: () => void; onQuit: () => void }) {
  const cur = game.p.weapons[game.p.cur];
  const [showSettings, setShowSettings] = useState(false);
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/75 backdrop-blur-sm">
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      <div className="w-full max-w-5xl overflow-hidden rounded-[6px]">
        <div className="relative">
          <div className="absolute -top-0 left-1/2 z-10 -translate-x-1/2 -translate-y-1/3">
            <div className="font-cond text-7xl uppercase tracking-wide text-[#F9781B]" style={{ textShadow: '4px 4px 0 #000, 0 0 30px rgba(249,120,27,0.6)' }}>Paused</div>
          </div>
        </div>
        <div className="kit-panel grid grid-cols-1 gap-6 overflow-y-auto p-5 pt-12 sm:p-8 sm:pt-14 md:grid-cols-[220px_1fr_260px]">
          <div className="flex flex-col gap-2">
            <Btn icon={Play} onClick={onResume} className="w-full justify-start">Resume</Btn>
            <RailItem icon={Gear} label="Options" onClick={() => setShowSettings(true)} />
            <RailItem icon={RotateCw} label="Restart run" onClick={onRestart} />
            <RailItem icon={LogOut} label="Quit to menu" danger onClick={onQuit} />
            <div className="mt-4"><Controls /></div>
          </div>
          <div className="flex flex-col items-center justify-start gap-4">
            {cur ? <WeaponCard w={cur} stats={game.stats} title="Equipped" /> : <div className="font-cond2 text-sm text-[#9aa3b8]">No weapon equipped</div>}
            <div className="flex flex-wrap justify-center gap-1.5">
              {Object.entries(game.scrolls).map(([id, n]) => (
                <span key={id} className="rounded-[3px] border bg-black/50 px-1.5 py-0.5 text-[11px]" style={{ borderColor: RARITY_KIT_COLORS[SCROLL_BY_ID[id].rarity] }} title={SCROLL_BY_ID[id].desc}>
                  {SCROLL_BY_ID[id].icon} {n > 1 && `x${n}`}
                </span>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2"><PanelTab>Controls</PanelTab></div>
            <div className="space-y-1.5">
              <Ctrl k={<><Keycap>W</Keycap><Keycap>A</Keycap><Keycap>S</Keycap><Keycap>D</Keycap></>} label="Move" />
              <Ctrl k={<Keycap wide>LMB</Keycap>} label="Aim / shoot" />
              <Ctrl k={<><Keycap wide>RMB</Keycap><Keycap>F</Keycap></>} label="Hero skill" />
              <Ctrl k={<Keycap wide>Space</Keycap>} label="Dash / flee" />
              <Ctrl k={<Keycap>E</Keycap>} label="Interact" />
              <Ctrl k={<><Keycap>Q</Keycap><Keycap>1</Keycap><Keycap>2</Keycap></>} label="Swap weapon" />
              <Ctrl k={<Keycap>R</Keycap>} label="Reload" />
              <Ctrl k={<Keycap wide>Esc</Keycap>} label="Resume / pause" />
            </div>
          </div>
        </div>
        <Skyline />
      </div>
    </div>
  );
}
function Ctrl({ k, label }: { k: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex gap-1">{k}</div>
      <span className="font-cond2 text-[12px] font-semibold text-[#9aa3b8]">{label}</span>
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
  const title = game.choiceMode === 'shop' ? 'Pick a Treat' : game.choiceMode === 'house' ? `${game.choiceGiver}'s Candy Bowl` : `Level ${game.p.level - game.pendingLevels + 1}!`;
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-5xl px-6">
        <div className="text-center">
          <div className="font-cond text-5xl uppercase text-[#F9781B]" style={{ textShadow: '3px 3px 0 #000, 0 0 26px rgba(249,120,27,0.55)' }}>{title}</div>
          <div className="mt-1 font-cond2 text-sm font-bold uppercase tracking-[0.2em] text-[#9aa3b8]">
            {game.choiceMode === 'house' ? (game.p.costume ? '🎭 Costume bonus: extra pick, better candy' : 'No costume = stingy treats') : 'Choose a Treat — they stack'}
          </div>
        </div>
        <div className={`mt-6 grid grid-cols-1 gap-4 ${game.choices.length >= 4 ? 'md:grid-cols-4' : game.choices.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
          {game.choices.map((c, i) => {
            const rc = RARITY_KIT_COLORS[c.rarity];
            return (
              <button key={c.id + i} onClick={() => pick(c.id)} className="kit-clip group border-2 bg-[#0E1117]/95 p-4 text-center transition-all hover:-translate-y-1.5" style={{ borderColor: rc, boxShadow: `0 0 22px ${rc}33` }}>
                <div className="mb-2 flex justify-center"><Keycap>{i + 1}</Keycap></div>
                <div className="font-cond2 text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: rc }}>{['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'][c.rarity]}</div>
                <div className="my-3 text-5xl transition-transform group-hover:scale-110">{c.icon}</div>
                <div className="font-cond text-lg uppercase leading-tight text-[#F4E8D5]">{c.name}</div>
                <div className="mt-1.5 text-[12px] leading-snug text-[#9aa3b8]">{c.desc}</div>
                <div className="mt-2 font-cond2 text-[10px] font-bold text-[#5a6070]">Owned {(game.scrolls[c.id] || 0)}/{c.max}</div>
              </button>
            );
          })}
        </div>
        <div className="mt-5 flex justify-center">
          <Btn variant="secondary" disabled={game.rerolls <= 0} onClick={() => { game.reroll(); force((n) => n + 1); }}>🎲 Reroll ({game.rerolls})</Btn>
        </div>
      </div>
    </div>
  );
}

// ================= SHOP =================
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
    <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-3xl">
        <div className="absolute -mt-3 ml-4 z-10"><PanelTab color="#F9781B">Shop</PanelTab></div>
        <div className="kit-panel p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-cond text-3xl uppercase text-[#F9781B]">🍬 Candy Lady's Treats</div>
              <div className="font-cond2 text-[12px] font-semibold text-[#9aa3b8]">"Spend those coins wisely, dearie… the night is long."</div>
            </div>
            <div className="kit-clip flex items-center gap-2 border-2 border-[#FFC453] bg-black/60 px-4 py-2 font-cond text-xl text-[#FFC453]"><Candy size={18} />{p.coins}</div>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
            {p.weapons.map((w, i) => w && (
              <div key={i} className="kit-clip border-2 border-[#3a3f4d] bg-[#171b24] p-3">
                <div className="flex items-center gap-2.5">
                  <WeaponThumb id={w.def.id} />
                  <div className="flex-1">
                    <div className="font-cond text-base uppercase" style={{ color: RARITY_KIT_COLORS[w.rarity] }}>{weaponTitle(w)}</div>
                    <div className="font-cond2 text-[11px] text-[#9aa3b8]">+14% damage · +3% fire rate</div>
                  </div>
                </div>
                <Btn className="mt-2.5 w-full justify-center text-xs" disabled={p.coins < upgradeCost(w)} onClick={() => { game.shopUpgrade(i); f(); }}>⬆ Upgrade Lv {w.level + 1} · 🪙 {upgradeCost(w)}</Btn>
              </div>
            ))}
            <div className="kit-clip border-2 border-[#3a3f4d] bg-[#171b24] p-3">
              <div className="font-cond text-base uppercase text-[#E63946]">🍫 Full-Size Chocolate Bar</div>
              <div className="font-cond2 text-[11px] text-[#9aa3b8]">Restore 50% HP ({Math.ceil(p.hp)}/{Math.round(game.stats.maxHp)})</div>
              <Btn variant="dark" className="mt-2.5 w-full justify-center text-xs" disabled={p.coins < game.healCost() || p.hp >= game.stats.maxHp} onClick={() => { game.shopHeal(); f(); }}>Buy · 🪙 {game.healCost()}</Btn>
            </div>
            <div className="kit-clip border-2 border-[#3a3f4d] bg-[#171b24] p-3">
              <div className="font-cond text-base uppercase text-[#b79bff]">🎁 Mystery Treat</div>
              <div className="font-cond2 text-[11px] text-[#9aa3b8]">Pick 1 of {3 + game.stats.totChoices} Treats (like a level-up)</div>
              <Btn variant="dark" className="mt-2.5 w-full justify-center text-xs" disabled={p.coins < game.treatCost()} onClick={() => { game.shopTreat(); onClose(); }}>Buy · 🪙 {game.treatCost()}</Btn>
            </div>
          </div>
          <div className="mt-5 flex justify-end"><Btn onClick={onClose}>Leave</Btn><span className="ml-2 self-center font-cond2 text-[11px] text-[#9aa3b8]">E / Esc</span></div>
        </div>
      </div>
    </div>
  );
}
import { weaponUrl } from './common';
function WeaponThumb({ id }: { id: string }) {
  return <div className="flex h-9 w-16 items-center justify-center rounded-[3px] border border-black bg-[#0E1117]"><img src={weaponUrl(id)} className="h-6 w-12 [image-rendering:pixelated]" alt="" /></div>;
}

// ================= END =================
export function EndScreen({ game, onAgain, onTitle, onTalents, onContinue }: { game: Game; onAgain: () => void; onTitle: () => void; onTalents: () => void; onContinue: () => void }) {
  const win = game.state === 'victory';
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-[6px]">
        <div className="kit-panel p-8 text-center">
          <LogoImg className="mx-auto mb-2 w-72" />
          <div className={`font-cond text-5xl uppercase ${win ? 'text-[#7CFF64]' : 'text-[#E63946]'}`} style={{ textShadow: '3px 3px 0 #000, 0 0 28px currentColor' }}>{win ? 'Mission Complete' : 'You Died'}</div>
          <div className="mt-1 font-cond2 text-sm font-semibold text-[#9aa3b8]">{win ? 'The Pumpkin King has been smashed.' : 'The monsters got you this time.'}</div>
          <div className="mt-6 grid grid-cols-3 gap-3">
            <Stat label="Survived" v={fmtTime(game.time)} />
            <Stat label="Monsters" v={String(game.kills)} />
            <Stat label="Level" v={String(game.p.level)} />
          </div>
          <div className="mt-4 font-cond text-3xl text-[#b79bff]">+{game.soulEarned} 🍬</div>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {win && <Btn onClick={onContinue}>Endless night</Btn>}
            <Btn variant={win ? 'dark' : 'primary'} icon={RotateCw} onClick={onAgain}>Play again</Btn>
            <Btn variant="secondary" icon={Gem} onClick={onTalents}>Talents</Btn>
            <Btn variant="dark" icon={LogOut} onClick={onTitle}>Menu</Btn>
          </div>
        </div>
        <Skyline />
      </div>
    </div>
  );
}
function Stat({ label, v }: { label: string; v: string }) {
  return (
    <div className="kit-clip border-2 border-[#3a3f4d] bg-[#171b24] p-3">
      <div className="font-cond2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#9aa3b8]">{label}</div>
      <div className="font-cond text-2xl text-[#F4E8D5]">{v}</div>
    </div>
  );
}


