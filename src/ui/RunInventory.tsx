import { useState } from 'react';
import { useBack } from './back';
import { Game } from '../game/engine';
import { baseStats, COSTUME_BY_ID, HERO_INFO, SCROLL_BY_ID } from '../game/data';
import { KitButton, KitTitle } from './kit';
import { HeroPreview, RARITY_KIT, WeaponCard, TreatArt } from './common';
import { SynergyPanel, DamageMath, TagChips } from './BuildSheet';
import { SCROLL_TAGS } from '../game/build';

/** Reads the actual applied run state, not the collection of possible drops. */
export function RunInventory({ game, onClose }: { game: Game; onClose: () => void }) {
  useBack(onClose);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'effects' | 'synergies' | 'damage'>('effects');
  const tabs = [['effects', 'Collected effects'], ['synergies', 'Synergies & tiers'], ['damage', 'Damage breakdown']] as const;
  const [sort, setSort] = useState<'picked' | 'rarity' | 'name'>('picked');
  const entries = Object.entries(game.scrolls).filter(([id, count]) => count > 0 && SCROLL_BY_ID[id]);
  const total = entries.reduce((n, [, count]) => n + count, 0);
  const visible = entries.filter(([id]) => `${SCROLL_BY_ID[id].name} ${SCROLL_BY_ID[id].desc}`.toLowerCase().includes(search.toLowerCase()));
  if (sort !== 'picked') visible.sort(([a], [b]) => sort === 'name' ? SCROLL_BY_ID[a].name.localeCompare(SCROLL_BY_ID[b].name) : SCROLL_BY_ID[b].rarity - SCROLL_BY_ID[a].rarity);
  const hero = HERO_INFO[game.hero], s = game.stats;
  const costume = game.p.costume ? COSTUME_BY_ID[game.p.costume] : null;
  const stats = [
    ['Damage', `${s.dmg.toFixed(2)}×`], ['Fire rate', `${s.rate.toFixed(2)}×`], ['Crit chance', `${Math.round(s.crit * 100)}%${s.crit > 1 ? ' (overcrit)' : ''}`],
    ['Crit damage', `${s.critDmg.toFixed(2)}×`], ['Reload time', `${s.reload.toFixed(2)}×`], ['Magazine', `${s.mag.toFixed(2)}×`],
    ['HP / Shield', `${Math.round(s.maxHp)} / ${Math.round(s.maxShield)}`], ['Damage reduction', `${Math.round(s.armor * 100)}%`],
    ['Move speed', `${s.move.toFixed(2)}×`], ['Pierce / Ricochet', `${s.pierce} / ${s.bounce}`], ['Extra projectiles', String(s.pellets)],
    ['Burn / Shock / Ecto', `${Math.round(s.burn * 100)} / ${Math.round(s.shock * 100)} / ${Math.round(s.ecto * 100)}%`],
    ['XP gain', `${s.xpGain.toFixed(2)}×`], ['Coin gain', `${s.coinGain.toFixed(2)}×`], ['Pickup radius', `${s.magnet.toFixed(2)}×`],
    ['Companion damage', `${s.companionDmg.toFixed(2)}×`], ['Revive speed', `${s.reviveSpeed.toFixed(2)}×`], ['Companion reduction', `${Math.round(s.companionArmor * 100)}%`],
  ];
  return (
    <div role="dialog" aria-modal="true" aria-label="Run inventory" className="run-inventory absolute inset-0 z-40 overflow-y-auto bg-[#090b10]/95 p-4 text-white sm:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div><KitTitle className="text-4xl">Your run build</KitTitle><p className="text-sm text-[#9aa0a6]">{total} treats · {entries.length} unique effects · game paused</p></div>
          <KitButton onClick={onClose}>Close inventory</KitButton>
        </header>
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <section>
            <div role="tablist" aria-label="Run build sections" className="mb-5 flex flex-wrap gap-2">
              {tabs.map(([id, label], index) => <button key={id} id={`build-tab-${id}`} role="tab" tabIndex={tab === id ? 0 : -1} aria-selected={tab === id} aria-controls={`build-panel-${id}`} onClick={() => setTab(id)} onKeyDown={e => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
                e.preventDefault();
                const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (index + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
                setTab(tabs[next][0]);
                e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
              }} className={`build-tab ${tab === id ? 'is-active' : ''}`}>{label}</button>)}
            </div>
            <div role="tabpanel" id={`build-panel-${tab}`} aria-labelledby={`build-tab-${tab}`}>
            {tab === 'synergies' && <SynergyPanel game={game} />}
            {tab === 'damage' && <DamageMath game={game} />}
            {tab === 'effects' && <>
            <div className="mb-4 flex gap-2">
              <input aria-label="Search collected treats" placeholder="Search effects or treats…" value={search} onChange={(e) => setSearch(e.target.value)} className="min-w-0 flex-1 rounded border border-[#3a3d44] bg-[#13151b] px-3 py-2" />
              <select aria-label="Sort collected treats" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="rounded border border-[#3a3d44] bg-[#13151b] px-2"><option value="picked">Picked up</option><option value="rarity">Rarity</option><option value="name">Name</option></select>
            </div>
            {!entries.length && <div className="kit-panel p-8 text-center"><KitTitle className="text-2xl">Your bag is waiting</KitTitle><p className="mt-2 text-[#9aa0a6]">Collect treats from level-ups, chests and doorbells. Every applied effect will appear here.</p></div>}
            {!!entries.length && !visible.length && <p>No collected treats match that search.</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              {visible.map(([id, count]) => {
                const item = SCROLL_BY_ID[id], stacked = baseStats(), initial = baseStats();
                for (let n = 0; n < count; n++) item.apply(stacked);
                const changed = Object.keys(stacked).filter((key) => stacked[key as keyof typeof stacked] !== initial[key as keyof typeof initial]);
                return <article key={id} className="inventory-treat kit-panel flex flex-col gap-3 p-4 xl:flex-row" style={{ borderColor: RARITY_KIT[item.rarity] }}>
                  <span className="hm-thumb h-[68px] w-[120px] shrink-0 !aspect-auto" style={{ borderColor: RARITY_KIT[item.rarity] }}><TreatArt id={id} /></span><div className="min-w-0 flex-1"><h2 className="font-cond2 text-lg font-bold" style={{ color: RARITY_KIT[item.rarity] }}>{item.name} <span className="text-[#f2e6c9]">×{count}</span></h2><p className="text-sm">{item.desc} per copy</p><TagChips tags={SCROLL_TAGS[id] ?? []} className="mt-1 !justify-start" /><p className="mt-2 text-xs text-[#9aa0a6]">{count}/{item.max} stacks{count > item.max ? ' (overstacked)' : ''} · {changed.map((key) => `${key}: ${Number(stacked[key as keyof typeof stacked].toFixed(2))}`).join(' · ')} on baseline</p></div>
                </article>;
              })}
            </div>
            </>}
            </div>
          </section>
          <aside className="space-y-4">
            <section className="kit-panel p-4"><div className="flex items-center gap-3"><HeroPreview hero={game.hero} size={0.65} costume={game.p.costume} /><div><KitTitle className="text-2xl">{hero.name}</KitTitle><p className="text-sm">{hero.passive}</p></div></div>{costume && <div className="mt-3 border-t border-white/10 pt-3"><span className="text-xs font-bold uppercase text-[#c69fff]">Epic costume</span><h2 style={{ color: costume.color }}>{costume.icon} {costume.name}</h2><p className="text-sm">{costume.power}</p><p className="text-sm text-[#7cff64]">{costume.perks}</p></div>}</section>
            {game.p.weapons.map((weapon, slot) => weapon ? <section key={weapon.uid}><WeaponCard w={weapon} stats={s} title={`Slot ${slot + 1}${slot === game.p.cur ? ' · Equipped' : ''}`} /></section> : <p key={slot} className="text-sm text-[#9aa0a6]">Weapon slot {slot + 1} empty</p>)}
            <section className="kit-panel p-4"><h2 className="mb-2 font-cond2 text-xl font-bold">Applied totals</h2><p className="mb-3 text-xs text-[#9aa0a6]">Hero + persistent talents + costume + all collected treats. Weapon-specific modifiers are shown on the weapon cards.</p><dl className="space-y-1">{stats.map(([label, value]) => <div key={label} className="flex justify-between gap-3 text-sm"><dt className="text-[#9aa0a6]">{label}</dt><dd>{value}</dd></div>)}</dl></section>
          </aside>
        </div>
      </div>
    </div>
  );
}
