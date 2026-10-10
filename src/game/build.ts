// ===== BUILDCRAFT: tags, resonance, overflow =====
// Every build piece (treat, inscription on the gun in hand, costume, talent, kid) carries TAGS.
// Every 3 of a tag is one RESONANCE TIER. Each tier compounds that tag's multiplier, and tiers 1/2/3 unlock
// KEYSTONES that wire one system into another (crits explode, explosions chain, chains count as hits, kills
// feed damage...). Stats past their natural limit OVERFLOW into something else (crit > 100% = overcrit layers,
// element chance > 100% = stronger effect, fire rate past what a gun can shoot = extra projectiles or damage),
// but every self-feeding stack has a CEILING (see the *_MAX constants below): nothing may grow exponentially.
// See BUILDCRAFT.md for the full math and example builds.
import type { Stats, Weapon } from './data';

export type Tag = 'crit' | 'fire' | 'shock' | 'ecto' | 'blast' | 'kill' | 'sugar' | 'tank' | 'summon';

export interface TagDef {
  name: string; icon: string; color: string;
  /** what each tier compounds (shown in the build sheet) */
  scaling: string;
  keystones: [string, string, string];
}

export const TAG_DEFS: Record<Tag, TagDef> = {
  crit: { name: 'Crit', icon: '🎯', color: '#ffe14a', scaling: '×1.15 crit damage per tier',
    keystones: ['Lucky Streak · every crit +2% crit chance for 3s (up to +50%)', 'Critical Mass · crits explode for 30% of the hit (can crit, can chain)', 'Snap · every crit takes 0.15s off your skill cooldown'] },
  fire: { name: 'Fire', icon: '🔥', color: '#ff7a1a', scaling: '×1.25 burn damage per tier',
    keystones: ['Searing · burn ticks can crit (and overcrit)', 'Wildfire · burning monsters pass their burn on when they die', 'Inferno · burns stack up (to 5 deep) instead of only keeping the strongest'] },
  shock: { name: 'Shock', icon: '⚡', color: '#7fd8ff', scaling: '×1.25 chain damage and +1 jump per tier',
    keystones: ['Conductive · chain jumps count as hits: they apply elements and trigger your gun’s inscriptions', 'Overload · +2 jumps, and a chain hitting a burning monster detonates the rest of its burn', 'Storm Front · chains fork in two at every jump'] },
  ecto: { name: 'Ecto', icon: '🟢', color: '#7cff64', scaling: '+25% ecto amplification per tier',
    keystones: ['Haunting · every hit on an ecto’d monster makes it take +4% more damage, stacking to +100%', 'Plague · ecto jumps to nearby monsters when its host dies', 'Possessed · ecto amplification also boosts burn and chain damage'] },
  blast: { name: 'Blast', icon: '💥', color: '#ffb347', scaling: '×1.2 explosion damage per tier',
    keystones: ['Bigger Booms · explosions +35% radius', 'Elemental Payload · explosions carry your gun’s burn/shock/ecto chances', 'Chain Reaction · monsters killed by an explosion explode too (50%)'] },
  kill: { name: 'Kill', icon: '💀', color: '#ff5a6e', scaling: '+25% momentum per kill per tier',
    keystones: ['Momentum · every kill +1% damage for 4s; the timer refreshes, up to 100 stacks', 'Scavenger · kills refund 1 ammo', 'Bloodlust · kills shave 0.2s off skill cooldown and dash recharge'] },
  sugar: { name: 'Sugar', icon: '🍭', color: '#ff7ad9', scaling: '×1.08 fire rate per tier',
    keystones: ['Overclock · fire rate past 12/s becomes extra projectiles instead of wasted damage', 'Sugar High · every % of bonus move speed is also bonus damage (up to +100%)', 'Hyperactive · every 20th shot also fires a ring of 8 shots'] },
  tank: { name: 'Tank', icon: '🛡️', color: '#9fb4ff', scaling: '×1.06 max HP per tier',
    keystones: ['Juggernaut · +1% damage per 5 max HP above 100 (up to +100%)', 'Spiky Costume · monsters that hit you take 20% of your max HP', 'Bulwark · +1% damage per 5 max shield (up to +100%)'] },
  summon: { name: 'Summon', icon: '👻', color: '#c9b8ff', scaling: '×1.3 summon damage per tier',
    keystones: ['Pack Leader · orbit blades, ghost buddy, companion and Candy Cannon deal +50%', 'Shared Tricks · summon hits carry your gun’s burn/shock/ecto chances', 'Army of Ghosts · +2 orbit blades and the ghost buddy fires twice as often'] },
};
export const TAG_ORDER: Tag[] = ['crit', 'fire', 'shock', 'ecto', 'blast', 'kill', 'sugar', 'tank', 'summon'];

/** how many tags a piece needs per tier */
export const PER_TIER = 3;

// ---- what carries which tag (one table, so theorycrafters can read it in one place) ----
export const SCROLL_TAGS: Record<string, Tag[]> = {
  sugar: ['sugar'], king: [], sour: ['crit'], jaw: ['crit'], bag: ['sugar'], sticky: ['sugar'], shoes: ['sugar'], pad: ['tank'], lasagna: ['tank'],
  magnet: [], cane: ['kill'], bouncy: ['kill'], bubble: ['sugar'], fireball: ['fire'], pop: ['shock'], gummy: ['ecto'], pepper: ['fire', 'fire'],
  sweater: ['shock', 'shock'], taffy: ['ecto', 'ecto'], fangs: ['kill', 'tank'], trick: ['tank'], energy: [], orbit: ['summon', 'summon'], buddy: ['summon', 'summon'],
  glass: ['crit', 'kill'], clover: ['crit'], firesneak: ['fire', 'blast'], helmet: ['tank'], piggy: [], homework: [], bang: ['blast', 'blast'], jackpot: ['sugar', 'sugar'],
  lucky6: ['crit'], fullbag: ['sugar'], skate: ['sugar', 'kill'], statue: ['tank'], bluff: ['tank'], bedtime: ['kill', 'kill'], owl: ['crit', 'crit'], cursed: ['kill', 'crit'],
  walkie: ['summon'], firstaid: ['tank'], friendship: ['summon', 'tank'],
};
export const INSC_TAGS: Record<string, Tag[]> = {
  dmg: [], rate: ['sugar'], mag: ['sugar'], reload: ['sugar'], crit: ['crit'], critdmg: ['crit'], speed: [], fire: ['fire'], shock: ['shock'], ecto: ['ecto'],
  pierce: ['kill'], bounce: ['kill'], opener: ['crit'], fresh: ['sugar'], seconds: ['kill'], combo: ['sugar'], scaredy: ['tank'], freeze: ['tank'], trot: ['sugar'],
  bigkid: ['crit'], sixth: ['crit'], twin: ['sugar', 'sugar'], vamp: ['crit', 'tank'], pinata: ['blast', 'kill'], haunted: ['summon'], split: ['kill', 'kill'],
  socks: ['shock', 'shock'], tummy: ['tank'], glasspump: ['crit', 'crit'], crash: ['sugar', 'sugar'],
};
export const COSTUME_TAGS: Record<string, Tag[]> = {
  ghost: ['ecto'], vampire: ['crit', 'kill'], witch: ['summon', 'ecto'], hero: ['kill'], skeleton: ['crit'], pumpkin: ['fire', 'blast'], astronaut: ['tank'], dino: ['tank', 'blast'],
  knight: ['tank', 'tank'], moth: ['sugar'],
};
export const TALENT_TAGS: Record<string, Tag[]> = {
  trigger: ['sugar'], lucky: ['crit'], grin: ['crit'], hot: ['fire'], prankster: ['sugar'], thick: ['tank'], pads: ['tank'], hardhat: ['tank'], second: ['tank'],
  heavy: ['kill'], sharpshot: ['crit'], bestfriends: ['summon'], stitched: ['tank'], guardians: ['summon'], dash: ['sugar'], find: [],
};
/** Tommy blasts, Sam summons a tornado, Jess crits, Maya tanks, Leo moves */
export const HERO_TAGS: Tag[][] = [['blast'], ['summon', 'shock'], ['crit'], ['tank'], ['sugar']];
const ELEM_TAG: Record<string, Tag> = { fire: 'fire', shock: 'shock', ecto: 'ecto' };

export interface BuildInput { hero: number; talents: Record<string, number>; costume: string | null; scrolls: Record<string, number>; weapon: Weapon | null }
export interface BuildPiece { tag: Tag; from: string }

export class Build {
  counts: Record<Tag, number>;
  tiers: Record<Tag, number>;
  pieces: BuildPiece[] = [];
  constructor(inp: BuildInput) {
    const counts = Object.fromEntries(TAG_ORDER.map((t) => [t, 0])) as Record<Tag, number>;
    const add = (tags: Tag[] | undefined, from: string, times = 1) => {
      if (!tags) return;
      for (const t of tags) { counts[t] += times; for (let i = 0; i < times; i++) this.pieces.push({ tag: t, from }); }
    };
    add(HERO_TAGS[inp.hero], 'Kid');
    for (const [id, n] of Object.entries(inp.talents)) if (n > 0) add(TALENT_TAGS[id], 'Talent');
    if (inp.costume) add(COSTUME_TAGS[inp.costume], 'Costume');
    for (const [id, n] of Object.entries(inp.scrolls)) if (n > 0) add(SCROLL_TAGS[id], 'Treat', n);
    const w = inp.weapon;
    if (w) {
      for (const id of w.traits) add(INSC_TAGS[id], 'Inscription');
      if (w.def.elem) add([ELEM_TAG[w.def.elem]], 'Gun');
      if (w.def.explode > 0) add(['blast'], 'Gun');
    }
    this.counts = counts;
    this.tiers = Object.fromEntries(TAG_ORDER.map((t) => [t, Math.floor(counts[t] / PER_TIER)])) as Record<Tag, number>;
  }
  tier(t: Tag) { return this.tiers[t]; }
  /** keystone k (1..3) of a tag is active */
  ks(t: Tag, k: 1 | 2 | 3) { return this.tiers[t] >= k; }
  /** compounding per-tier multiplier (base^tier) */
  pow(t: Tag, base: number) { return Math.pow(base, this.tiers[t]); }

  // ---- the numbers each tag compounds ----
  critMore() { return 1 + 0.15 * this.tiers.crit; }
  burnMore() { return this.pow('fire', 1.25); }
  chainMore() { return this.pow('shock', 1.25); }
  chainJumps() { return this.tiers.shock + (this.ks('shock', 2) ? 2 : 0); }
  ectoMore() { return 1 + 0.25 * this.tiers.ecto; }
  blastMore() { return this.pow('blast', 1.2); }
  blastRadius() { return this.ks('blast', 1) ? 1.35 : 1; }
  momentumPer() { return 0.01 * (1 + 0.25 * Math.max(0, this.tiers.kill - 1)); }
  rateMore() { return this.pow('sugar', 1.08); }
  hpMore() { return this.pow('tank', 1.06); }
  summonMore() { return this.pow('summon', 1.3) * (this.ks('summon', 1) ? 1.5 : 1); }

  /** tags this build would gain from extra pieces (level-up preview): which tiers they'd complete */
  previewGain(tags: Tag[]) {
    const out: { tag: Tag; from: number; to: number; tierUp: boolean }[] = [];
    const seen = new Map<Tag, number>();
    for (const t of tags) seen.set(t, (seen.get(t) ?? 0) + 1);
    for (const [t, n] of seen) {
      const from = this.counts[t], to = from + n;
      out.push({ tag: t, from, to, tierUp: Math.floor(to / PER_TIER) > Math.floor(from / PER_TIER) });
    }
    return out;
  }
}

/**
 * Ceilings on every stack that feeds itself. Before these, Lucky Streak raised crit chance without limit and each
 * 100% of crit chance multiplied damage by the crit multiplier AGAIN (critMul ^ layers), so a fast gun reached
 * numbers like 1e21. Stacks are now linear and bounded.
 */
export const STREAK_MAX = 25;        // Lucky Streak: +2% crit each -> +50%
export const MOMENTUM_MAX = 100;     // Momentum kill stacks
export const COMBO_MAX = 40;         // Candy Corn Combo: +3% each -> +120%
export const HAUNT_MAX = 1;          // Haunting: +4% per hit -> +100% damage taken
export const INFERNO_STACKS = 5;     // Inferno: burn stacks up to 5x the incoming burn
export const OVERCRIT_LAYERS_MAX = 3;
export const OVERCRIT_PER_LAYER = 0.5;

/** crit multiplier for a number of crit layers: the first is a normal crit, each further one adds +50% of it */
export function critLayerMul(critMul: number, layers: number) {
  return layers <= 0 ? 1 : critMul * (1 + OVERCRIT_PER_LAYER * (Math.min(layers, OVERCRIT_LAYERS_MAX) - 1));
}
/**
 * Overcrit: every full 100% of crit chance is a guaranteed crit layer; the remainder is the chance of one more.
 * Layers ADD (never multiply): 2 layers at x2.3 crit damage = x3.45, and 3 layers is the most a hit can carry.
 */
export function rollCrit(chance: number, critMul: number) {
  const c = Math.min(OVERCRIT_LAYERS_MAX, Math.max(0, chance));
  const layers = Math.floor(c) + (Math.random() < c - Math.floor(c) ? 1 : 0);
  return { layers, mul: critLayerMul(critMul, layers) };
}
/** expected value of rollCrit (build sheet) */
export function expectedCritMul(chance: number, critMul: number) {
  const c = Math.min(OVERCRIT_LAYERS_MAX, Math.max(0, chance)), base = Math.floor(c), f = c - base;
  return critLayerMul(critMul, base) * (1 - f) + critLayerMul(critMul, base + 1) * f;
}

/**
 * Fire rate: a gun physically shoots up to SHOTS_PER_SEC_MAX times a second. Rate past that is never wasted:
 * with Sugar · Overclock it becomes extra projectiles, otherwise it becomes damage. Projectiles past
 * PELLETS_MAX likewise fold into damage. (These are performance limits on *entities*, not on power.)
 */
export const SHOTS_PER_SEC_MAX = 20;
export const OVERCLOCK_AT = 12;
export const PELLETS_MAX = 16;
export function rateOverflow(rate: number, pellets: number, overclock: boolean) {
  let shots = rate, pel = pellets, dmgMul = 1;
  const limit = overclock ? OVERCLOCK_AT : SHOTS_PER_SEC_MAX;
  if (shots > limit) {
    const k = shots / limit;
    shots = limit;
    if (overclock) pel *= k; else dmgMul *= k;
  }
  if (pel > PELLETS_MAX) { dmgMul *= pel / PELLETS_MAX; pel = PELLETS_MAX; }
  return { shots, pellets: pel, dmgMul };
}

/** element chance overflow: >100% makes the effect itself stronger (burn ×chance, extra jumps, stronger ecto) */
export const overflow = (chance: number) => Math.max(1, chance);

export function statsLine(s: Stats) {
  return `dmg ×${s.dmg.toFixed(2)} · rate ×${s.rate.toFixed(2)} · crit ${(s.crit * 100).toFixed(0)}% ×${s.critDmg.toFixed(2)}`;
}
