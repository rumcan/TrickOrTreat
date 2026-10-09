// Theorycrafting UI: tag chips, resonance tiers + keystones, and the full damage multiplier chain.
import { Game } from '../game/engine';
import { weaponStats } from '../game/data';
import { Build, Tag, TAG_DEFS, TAG_ORDER, PER_TIER, expectedCritMul, rateOverflow } from '../game/build';

/** small tag chips; with a build, also shows what picking them would do to its tiers */
export function TagChips({ tags, build, className = '' }: { tags: Tag[]; build?: Build; className?: string }) {
  if (!tags.length) return null;
  const gains = build ? build.previewGain(tags) : null;
  const uniq = [...new Set(tags)];
  return (
    <div className={`flex flex-wrap justify-center gap-1 ${className}`}>
      {uniq.map((t) => {
        const d = TAG_DEFS[t], n = tags.filter((x) => x === t).length, g = gains?.find((x) => x.tag === t);
        return (
          <span key={t} className="paper-chip !px-1.5 !py-0.5 !text-[10px]" style={{ color: d.color }} title={`${d.name}: ${d.scaling}`}>
            {d.icon} {d.name}{n > 1 ? ` ×${n}` : ''}
            {g && <span className={g.tierUp ? 'ml-1 text-[#7cff64]' : 'ml-1 text-[#8f8676]'}>{g.tierUp ? `→ T${Math.floor(g.to / PER_TIER)}!` : `${g.to % PER_TIER}/${PER_TIER}`}</span>}
          </span>
        );
      })}
    </div>
  );
}

/** the resonance board: every tag, its tier, progress to the next, and which keystones are live */
export function SynergyPanel({ game }: { game: Game }) {
  const b = game.build;
  const active = TAG_ORDER.filter((t) => b.counts[t] > 0);
  return (
    <section className="paper-panel paper-panel--rule !p-4">
      <div className="paper-kicker">Synergies · every {PER_TIER} of a tag = 1 tier · tiers never cap</div>
      {!active.length && <p className="text-sm text-[#c9bda6]">No tags yet. Treats, inscriptions on the gun in your hand, your costume, talents and your kid all carry tags.</p>}
      <div className="grid gap-2.5 sm:grid-cols-2">
        {active.map((t) => {
          const d = TAG_DEFS[t], n = b.counts[t], tier = b.tiers[t];
          return (
            <div key={t} className="paper-card !p-3" style={{ borderLeft: `5px solid ${d.color}` }}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-cond text-lg uppercase" style={{ color: d.color }}>{d.icon} {d.name}</span>
                <span className="font-num text-sm text-[#f2e8d4]">T{tier} <span className="text-[#8f8676]">· {n} tags</span></span>
              </div>
              <div className="mt-1 h-1.5 bg-black/50"><div className="h-full" style={{ width: `${((n % PER_TIER) / PER_TIER) * 100}%`, background: d.color }} /></div>
              <div className="mt-1 text-[11px] text-[#8f8676]">{d.scaling}{tier > 0 ? ` → now ${scalingNow(b, t)}` : ''}</div>
              <ul className="mt-1.5 space-y-0.5">
                {d.keystones.map((k, i) => (
                  <li key={i} className={`text-[12px] leading-snug ${tier > i ? 'text-[#f2e8d4]' : 'text-[#6c6658]'}`}>
                    <span className="font-bold" style={{ color: tier > i ? d.color : undefined }}>{tier > i ? '◆' : `T${i + 1}`}</span> {k}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function scalingNow(b: Build, t: Tag) {
  switch (t) {
    case 'crit': return `×${b.critMore().toFixed(2)}`;
    case 'fire': return `×${b.burnMore().toFixed(2)}`;
    case 'shock': return `×${b.chainMore().toFixed(2)}, +${b.chainJumps()} jumps`;
    case 'ecto': return `×${b.ectoMore().toFixed(2)} amp`;
    case 'blast': return `×${b.blastMore().toFixed(2)}`;
    case 'kill': return `+${(b.momentumPer() * 100).toFixed(2)}% per kill`;
    case 'sugar': return `×${b.rateMore().toFixed(2)} rate`;
    case 'tank': return `×${b.hpMore().toFixed(2)} HP`;
    case 'summon': return `×${b.summonMore().toFixed(2)}`;
  }
}

/** every multiplier between the gun's printed damage and what actually lands, in order */
export function DamageMath({ game }: { game: Game }) {
  const w = game.weapon, s = game.stats, b = game.build;
  if (!w) return null;
  const st = weaponStats(w, s);
  const has = (id: string) => w.traits.filter((x) => x === id).length;
  const rar = (1 + w.rarity * 0.15) * (1 + (w.level - 1) * 0.14);
  const insc = (1 + has('dmg') * 0.15) * (1 + has('tummy') * 0.4);
  const more = game.globalMore();
  const crit = expectedCritMul(st.crit + game.streak * 0.02, st.critMul);
  const ov = rateOverflow(st.rate, st.pellets, b.ks('sugar', 1));
  const hit = st.dmg * more * crit * ov.dmgMul;
  const cycle = st.mag / ov.shots + st.reload;
  const dps = hit * ov.pellets * ov.shots * (st.mag / ov.shots / cycle);
  const rows: [string, string, string?][] = [
    ['Gun base damage', w.def.dmg.toFixed(1)],
    ['× rarity & level', `×${rar.toFixed(2)}`],
    ['× inscriptions', `×${insc.toFixed(2)}`],
    ['× run damage (treats, talents, kid, costume)', `×${s.dmg.toFixed(2)}`],
    ['× momentum · juggernaut · bulwark · sugar high', `×${more.toFixed(2)}`, game.momentum ? `${game.momentum} kill stacks` : undefined],
    ['× crit, expected (overcrit past 100%)', `×${crit.toFixed(2)}`, `${Math.round((st.crit + game.streak * 0.02) * 100)}% at ×${st.critMul.toFixed(2)}${game.streak ? ` · ${game.streak} streak` : ''}`],
    ['× fire-rate overflow', `×${ov.dmgMul.toFixed(2)}`, ov.pellets > st.pellets ? `overclocked into ${ov.pellets.toFixed(1)} shots` : undefined],
  ];
  return (
    <section className="paper-panel paper-panel--rule !p-4">
      <div className="paper-kicker">Damage math · {w.def.name}</div>
      <dl className="space-y-1">
        {rows.map(([k, v, note]) => (
          <div key={k} className="flex items-baseline justify-between gap-3 border-b border-white/5 pb-1 text-[13px]">
            <dt className="text-[#c9bda6]">{k}{note && <span className="ml-1.5 text-[11px] text-[#8f8676]">({note})</span>}</dt>
            <dd className="font-num text-[#f2e8d4]">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-2 grid grid-cols-2 gap-2 text-center">
        <div className="paper-card !p-2"><div className="label">Average hit</div><div className="font-cond text-2xl text-[#fa7b19]">{fmt(hit)}</div></div>
        <div className="paper-card !p-2"><div className="label">Expected DPS</div><div className="font-cond text-2xl text-[#fa7b19]">{fmt(dps)}</div></div>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-[#8f8676]">
        Not included: element procs (burn ×{b.burnMore().toFixed(2)}, chains ×{b.chainMore().toFixed(2)}, ecto amp ×{b.ectoMore().toFixed(2)}), explosions ×{b.blastMore().toFixed(2)}, keystone chain reactions and trigger inscriptions — that’s where builds go off the charts.
      </p>
    </section>
  );
}

export const fmt = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e4 ? `${(n / 1e3).toFixed(1)}k` : Math.round(n).toString());
