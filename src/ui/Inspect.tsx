import { useEffect, useState } from 'react';
import { Game } from '../game/engine';
import { RARITY } from '../game/config';
import { KitButton, Keycap } from './kit';
import { WeaponCard, RARITY_KIT } from './common';
import { TagChips } from './BuildSheet';
import { INSC_TAGS, Tag } from '../game/build';
import type { Weapon } from '../game/data';

/** a gun counts toward your synergies while it's in your hand: its inscriptions, its element, explosions */
const gunTags = (w: Weapon): Tag[] => [
  ...w.traits.flatMap((t) => INSC_TAGS[t] ?? []),
  ...(w.def.elem ? [w.def.elem as Tag] : []),
  ...(w.def.explode > 0 ? (['blast'] as Tag[]) : []),
];

/**
 * E on a gun: the world pauses and the find is laid next to the guns you carry. Wide screens show the find on the left
 * and one of your two guns on the right, chosen with tabs; a phone shows one card at a time with the same tabs plus one
 * for the find. Either card shows its DPS against the other, so the choice is a comparison and not a blind swap.
 */
export function WeaponInspect({ game, onDone }: { game: Game; onDone: () => void }) {
  const found = game.inspecting?.weapon;
  // which of my guns the find is compared with (starts on the one in hand), and what a phone is showing
  const [slot, setSlot] = useState(game.p.cur);
  const [view, setView] = useState<'found' | 'mine'>('found');
  const take = (to: number) => { game.takeInspected(to); onDone(); };
  const leave = () => { game.closeInspect(); onDone(); };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === '1' || k === '2') take(Number(k) - 1);
      else if (k === 'e' || k === 'escape') leave();
      else if (k === 'tab' || k === 'arrowleft' || k === 'arrowright' || k === 'q') { setSlot((s) => 1 - s); setView('mine'); }
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });
  if (!found) return null;
  const rc = RARITY_KIT[found.rarity];
  const mine = game.p.weapons[slot];
  const tab = (on: boolean, color?: string) => `min-w-0 flex-1 border-2 px-2.5 py-1.5 text-left transition-colors ${on ? 'bg-[#10161a]' : 'border-[#3a4046] bg-transparent opacity-70 hover:opacity-100'}` + (on && !color ? ' border-[#f08019]' : '');
  /** the tab strip: your two slots, and on a phone the find as well (there it is the only way to see each card) */
  const tabs = (phone: boolean) => (
    <div role="tablist" aria-label={phone ? 'Guns to look at' : 'Compare with one of your guns'} className={`${phone ? 'flex md:hidden' : 'hidden md:flex'} gap-1.5`}>
      {phone && (
        <button role="tab" aria-selected={view === 'found'} onClick={() => setView('found')} className={tab(view === 'found', rc)} style={view === 'found' ? { borderColor: found.rarity ? rc : '#f08019' } : undefined}>
          <div className="label !text-[10px]">On the ground</div>
          <div className="truncate font-cond text-[15px] uppercase leading-tight">{found.def.name}</div>
        </button>
      )}
      {[0, 1].map((i) => {
        const w = game.p.weapons[i], on = phone ? view === 'mine' && slot === i : slot === i;
        return (
          <button key={i} role="tab" aria-selected={on} onClick={() => { setSlot(i); setView('mine'); }} className={tab(on, w?.rarity ? RARITY_KIT[w.rarity] : undefined)} style={on && w?.rarity ? { borderColor: RARITY_KIT[w.rarity] } : undefined}>
            <div className="label !text-[10px]">Slot {i + 1}{i === game.p.cur ? ' · in hand' : ''}</div>
            <div className="truncate font-cond text-[15px] uppercase leading-tight" style={{ color: w?.rarity ? RARITY_KIT[w.rarity] : undefined }}>{w ? `${w.def.name} · Lv ${w.level}` : 'Empty'}</div>
          </button>
        );
      })}
    </div>
  );
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-[rgba(2,5,7,0.72)] p-3 backdrop-blur-[3px]" role="dialog" aria-label="Inspect weapon">
      <div className="paper-panel paper-panel--rule kit-pop m-auto w-full max-w-[900px] shrink-0 !p-4 sm:!p-6" style={{ borderTopColor: found.rarity ? rc : undefined }}>
        <div className="paper-kicker">Found on the ground · game paused</div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="paper-title !text-[clamp(26px,4vw,40px)]">{found.def.name}</h2>
          <span className="font-cond2 text-sm font-bold uppercase tracking-[0.16em]" style={{ color: found.rarity ? rc : '#c9bda6' }}>{RARITY[found.rarity].name} · Lv {found.level}</span>
        </div>
        <span className="paper-rule" />
        {gunTags(found).length > 0 && <div className="mt-3 flex flex-wrap items-center gap-2"><span className="paper-kicker !mb-0">Synergy tags while in hand</span><TagChips tags={gunTags(found)} className="!justify-start" /></div>}
        <div className="mt-4">{tabs(true)}</div>
        <div className="mt-3 grid gap-4 md:mt-0 md:grid-cols-2 md:items-start">
          <section className={view === 'found' ? '' : 'hidden md:block'} aria-label="The gun on the ground">
            <div className="paper-kicker hidden md:block">On the ground</div>
            <WeaponCard w={found} stats={game.stats} compare={mine} bigInsc className="!w-full" />
          </section>
          <section className={view === 'mine' ? '' : 'hidden md:block'} aria-label={`Your gun in slot ${slot + 1}`}>
            <div className="paper-kicker hidden md:block">Compare with your gun</div>
            {tabs(false)}
            <div className="md:mt-2">
              {mine
                ? <WeaponCard w={mine} stats={game.stats} compare={found} bigInsc className="!w-full" />
                : <div className="paper-card text-[14px] text-[#c9bda6]"><div className="font-cond text-xl uppercase text-[#8f8676]">Empty slot</div>Nothing to compare: the find goes here and nothing is dropped.</div>}
            </div>
          </section>
        </div>
        {/* the choice stays in reach while the cards scroll on a small screen */}
        <div className="sticky bottom-0 z-10 -mx-4 mt-4 flex flex-wrap items-center gap-2 border-t border-[#3a4046] px-4 pt-3 pb-1 sm:-mx-6 sm:px-6" style={{ background: 'var(--pp-paper-bg)' }}>
          {[0, 1].map((i) => {
            const w = game.p.weapons[i];
            return (
              <KitButton key={i} size="sm" variant={i === slot ? 'orange' : 'dark'} onClick={() => take(i)} className="min-w-0 flex-1" title={w ? `${w.def.name} is dropped on the ground` : 'The slot is empty: nothing is dropped'}>
                <span className="mr-1 hidden sm:inline-flex"><Keycap className="!h-5 !min-w-5 !text-[11px]">{i + 1}</Keycap></span>{w ? 'Swap' : 'Equip'}<span className="hidden sm:inline">&nbsp;{w ? 'for' : 'in'}</span>&nbsp;slot {i + 1}
              </KitButton>
            );
          })}
          <KitButton size="sm" variant="dark" onClick={leave} className="shrink-0"><span className="mr-1 hidden sm:inline-flex"><Keycap className="!h-5 !text-[11px]">E</Keycap></span>Leave it</KitButton>
          <p className="basis-full text-[12px] text-[#8f8676]">Swapping drops your old gun on the ground. Monsters are frozen while you read.<span className="hidden md:inline"> Tab switches the gun you compare with.</span></p>
        </div>
      </div>
    </div>
  );
}
