import { useEffect } from 'react';
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

/** E on a gun: the world pauses, you read it, then choose the slot it goes into (or leave it). */
export function WeaponInspect({ game, onDone }: { game: Game; onDone: () => void }) {
  const found = game.inspecting?.weapon;
  const take = (slot: number) => { game.takeInspected(slot); onDone(); };
  const leave = () => { game.closeInspect(); onDone(); };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === '1' || k === '2') take(Number(k) - 1);
      else if (k === 'e' || k === 'escape') leave();
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });
  if (!found) return null;
  const rc = RARITY_KIT[found.rarity];
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-[rgba(2,5,7,0.72)] p-3 backdrop-blur-[3px]" role="dialog" aria-label="Inspect weapon">
      <div className="paper-panel paper-panel--rule kit-pop w-full max-w-[860px] !p-4 sm:!p-6" style={{ borderTopColor: found.rarity ? rc : undefined }}>
        <div className="paper-kicker">Found on the ground · game paused</div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="paper-title !text-[clamp(28px,4vw,40px)]">{found.def.name}</h2>
          <span className="font-cond2 text-sm font-bold uppercase tracking-[0.16em]" style={{ color: found.rarity ? rc : '#c9bda6' }}>{RARITY[found.rarity].name} · Lv {found.level}</span>
        </div>
        <span className="paper-rule" />
        {gunTags(found).length > 0 && <div className="mt-3 flex flex-wrap items-center gap-2"><span className="paper-kicker !mb-0">Synergy tags while in hand</span><TagChips tags={gunTags(found)} className="!justify-start" /></div>}
        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start">
          <WeaponCard w={found} stats={game.stats} compare={game.weapon} bigInsc className="!w-full md:!w-[340px] shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="paper-kicker !mb-0">Put it in a slot</div>
            {[0, 1].map((slot) => {
              const w = game.p.weapons[slot];
              return (
                <div key={slot} className="paper-card flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="label">Slot {slot + 1}{slot === game.p.cur ? ' · in hand' : ''}</div>
                    {w ? (
                      <div className="truncate font-cond text-lg uppercase leading-tight" style={{ color: w.rarity ? RARITY_KIT[w.rarity] : undefined }}>{w.def.name} <span className="font-cond2 text-xs text-[#8f8676]">Lv {w.level} · {w.traits.length} inscription{w.traits.length === 1 ? '' : 's'}</span></div>
                    ) : <div className="font-cond text-lg uppercase text-[#8f8676]">Empty</div>}
                    {w && <div className="text-[12px] text-[#c9bda6]">Swapping drops it on the ground.</div>}
                  </div>
                  <KitButton size="sm" onClick={() => take(slot)} className="shrink-0"><span className="mr-1 inline-flex"><Keycap className="!h-5 !min-w-5 !text-[11px]">{slot + 1}</Keycap></span>{w ? 'Swap in' : 'Equip'}</KitButton>
                </div>
              );
            })}
            <div className="mt-auto flex items-center justify-between gap-2 pt-1">
              <span className="text-[12px] text-[#8f8676]">Monsters are frozen while you read.</span>
              <KitButton size="sm" variant="dark" onClick={leave}><span className="mr-1 inline-flex"><Keycap className="!h-5 !text-[11px]">E</Keycap></span>Leave it</KitButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
