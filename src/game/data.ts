import * as storage from './storage';
import { Elem, RARITY } from './config';
import { hasFullGame } from './expansion';

// ================= STATS =================
export interface Stats {
  dmg: number; rate: number; crit: number; critDmg: number; reload: number; mag: number; move: number;
  maxHp: number; maxShield: number; shieldDelay: number; armor: number;
  magnet: number; pierce: number; bounce: number; pellets: number;
  burn: number; shock: number; ecto: number; burnDmg: number; chain: number; ectoAmp: number;
  vamp: number; healDrop: number; skillCd: number; skillPow: number;
  orbit: number; familiar: number; dashCharges: number; dashFire: number;
  luck: number; revive: number; rerolls: number; coinGain: number; xpGain: number; startCoins: number; startRarity: number;
  totSpeed: number; totChoices: number; costumeLuck: number; costumePower: number; dodge: number;
  companionDmg: number; reviveSpeed: number; companionArmor: number;
  /** occult-scroll style treats (Gunfire Reborn): conditional, run-wide */
  sixth: number; fullBag: number; skate: number; statue: number; bluff: number; execute: number; owl: number;
}

export function baseStats(): Stats {
  return {
    dmg: 1, rate: 1, crit: 0.05, critDmg: 1.8, reload: 1, mag: 1, move: 1,
    maxHp: 100, maxShield: 50, shieldDelay: 3, armor: 0,
    magnet: 1, pierce: 0, bounce: 0, pellets: 0,
    burn: 0, shock: 0, ecto: 0, burnDmg: 1, chain: 2, ectoAmp: 0.15,
    vamp: 0, healDrop: 0.01, skillCd: 1, skillPow: 1,
    orbit: 0, familiar: 0, dashCharges: 2, dashFire: 0,
    luck: 0, revive: 0, rerolls: 1, coinGain: 1, xpGain: 1, startCoins: 0, startRarity: 0,
    totSpeed: 1, totChoices: 0, costumeLuck: 1, costumePower: 1, dodge: 0,
    companionDmg: 1, reviveSpeed: 1, companionArmor: 0,
    sixth: 0, fullBag: 0, skate: 0, statue: 0, bluff: 0, execute: 0, owl: 0,
  };
}

// ================= WEAPONS =================
export type BulletKind = 'pea' | 'dart' | 'corn' | 'fire' | 'water' | 'balloon' | 'rocket' | 'beam' | 'stone' | 'hex' | 'bone' | 'candy';

export interface WeaponDef {
  premium?: boolean;
  id: string; name: string; desc: string;
  dmg: number; rate: number; mag: number; reload: number; speed: number; spread: number; pellets: number; range: number;
  pierce: number; bounce: number; elem?: Elem; elemChance: number; explode: number; kind: BulletKind; color: string; critBonus: number; shake: number;
}

export const WEAPONS: WeaponDef[] = [
  { id: 'pea', name: 'Pea Shooter', desc: 'Reliable semi-auto. Peas sting more than you think.', dmg: 15, rate: 4, mag: 12, reload: 1.1, speed: 15, spread: 0.04, pellets: 1, range: 9, pierce: 0, bounce: 0, elemChance: 0, explode: 0, kind: 'pea', color: '#9dff7a', critBonus: 0.05, shake: 1 },
  { id: 'nerf', name: 'Foam Blaster', desc: 'Full-auto foam dart spray. Huge magazine.', dmg: 7, rate: 11, mag: 40, reload: 1.7, speed: 16, spread: 0.13, pellets: 1, range: 8, pierce: 0, bounce: 0, elemChance: 0, explode: 0, kind: 'dart', color: '#ff9a3a', critBonus: 0, shake: 0.6 },
  { id: 'shotgun', name: 'Candy Corn Shotgun', desc: 'Blasts a cone of razor candy corn.', dmg: 9, rate: 1.4, mag: 6, reload: 1.5, speed: 14, spread: 0.5, pellets: 7, range: 6, pierce: 0, bounce: 0, elemChance: 0, explode: 0, kind: 'corn', color: '#ffb52a', critBonus: 0, shake: 4 },
  { id: 'roman', name: 'Roman Candle', desc: 'Bouncing fireballs that set monsters ablaze.', dmg: 20, rate: 2.6, mag: 10, reload: 1.6, speed: 9, spread: 0.06, pellets: 1, range: 9, pierce: 0, bounce: 2, elem: 'fire', elemChance: 0.6, explode: 0, kind: 'fire', color: '#ff7a1a', critBonus: 0, shake: 1.5 },
  { id: 'soaker', name: 'Ecto Soaker', desc: 'Piercing stream of glowing goo. Corrodes & slows.', dmg: 5, rate: 14, mag: 60, reload: 2, speed: 11, spread: 0.07, pellets: 1, range: 6.5, pierce: 2, bounce: 0, elem: 'ecto', elemChance: 0.3, explode: 0, kind: 'water', color: '#8dff5a', critBonus: 0, shake: 0.3 },
  { id: 'balloon', name: 'Static Balloon Launcher', desc: 'Charged balloons pop into chain lightning.', dmg: 18, rate: 2, mag: 8, reload: 1.5, speed: 7.5, spread: 0.05, pellets: 1, range: 8, pierce: 0, bounce: 0, elem: 'shock', elemChance: 0.75, explode: 1.2, kind: 'balloon', color: '#4fb3ff', critBonus: 0, shake: 1.5 },
  { id: 'rocket', name: 'Bottle Rocket Launcher', desc: 'Explosive rockets with a big boom.', dmg: 46, rate: 1, mag: 4, reload: 2, speed: 10, spread: 0.03, pellets: 1, range: 10, pierce: 0, bounce: 0, elem: 'fire', elemChance: 0.3, explode: 1.8, kind: 'rocket', color: '#ff5a3a', critBonus: 0, shake: 6 },
  { id: 'laser', name: 'Ghost-Buster Flashlight', desc: 'Instant piercing light beams. Shocks spirits.', dmg: 17, rate: 3, mag: 15, reload: 1.4, speed: 0, spread: 0.0, pellets: 1, range: 10, pierce: 99, bounce: 0, elem: 'shock', elemChance: 0.2, explode: 0, kind: 'beam', color: '#cfeaff', critBonus: 0.05, shake: 1 },
  { id: 'slingshot', name: 'Wrist Slingshot', desc: 'Heavy piercing stones. Big crits.', dmg: 42, rate: 1.5, mag: 5, reload: 1.2, speed: 19, spread: 0.01, pellets: 1, range: 11, pierce: 1, bounce: 0, elemChance: 0, explode: 0, kind: 'stone', color: '#d8d0c0', critBonus: 0.2, shake: 2 },
];
WEAPONS.push(
  { id: 'gloom', premium: true, name: 'Gloom Drum', desc: 'A deep sonic toy cannon. Wide piercing pressure pulses.', dmg: 23, rate: 2.4, mag: 10, reload: 1.8, speed: 12, spread: 0.12, pellets: 2, range: 8, pierce: 2, bounce: 0, elem: 'ecto', elemChance: 0.35, explode: 0, kind: 'water', color: '#8971ba', critBonus: 0, shake: 1.2 },
  { id: 'marshmallow', premium: true, name: 'Marshmallow Mortar', desc: 'Slow soft projectiles with a huge sticky splash.', dmg: 38, rate: 1.3, mag: 5, reload: 1.8, speed: 7, spread: 0.06, pellets: 1, range: 10, pierce: 0, bounce: 0, elem: 'ecto', elemChance: 0.7, explode: 2, kind: 'balloon', color: '#f1d8be', critBonus: 0, shake: 2 },
  { id: 'bubblegum', premium: true, name: 'Bubblegum Rail', desc: 'A precise spectral beam. Pierces the whole horde.', dmg: 35, rate: 1.8, mag: 8, reload: 1.5, speed: 0, spread: 0, pellets: 1, range: 12, pierce: 99, bounce: 0, elem: 'ecto', elemChance: 0.5, explode: 0, kind: 'beam', color: '#db87bb', critBonus: 0.1, shake: 0.8 },
  { id: 'acorn', premium: true, name: 'Acorn Repeater', desc: 'Rapid bouncing acorns from a handmade wooden blaster.', dmg: 10, rate: 8, mag: 28, reload: 1.4, speed: 16, spread: 0.09, pellets: 1, range: 10, pierce: 0, bounce: 2, elemChance: 0, explode: 0, kind: 'stone', color: '#ce9c55', critBonus: 0.08, shake: 0.4 },
);
export const WEAPON_BY_ID = Object.fromEntries(WEAPONS.map((w) => [w.id, w])) as Record<string, WeaponDef>;

/**
 * Weapon INSCRIPTIONS (Gunfire Reborn style): rolled lines on every gun, more and stronger with rarity.
 *  ● stat       plain numbers, always on
 *  ◆ trigger    conditional: first shot, kills, combos, standing still…
 *  ★ unique     changes how the gun behaves (epic+; a legendary always has one)
 *  ✦ deal       a "Spooky Deal": a big bonus with a catch (rare+, purple)
 * Static numbers live in weaponStats(); the triggers are handled by the engine (see Game.insc*).
 */
export type InscTier = 'stat' | 'trigger' | 'unique' | 'deal';
export interface Trait { id: string; name: string; desc: string; minRarity: number; tier: InscTier }
export const TRAITS: Trait[] = [
  // ● stat lines
  { id: 'dmg', tier: 'stat', name: 'Sugar-Coated', desc: '+15% damage', minRarity: 0 },
  { id: 'rate', tier: 'stat', name: 'Hyper', desc: '+15% fire rate', minRarity: 0 },
  { id: 'mag', tier: 'stat', name: 'Overstuffed', desc: '+40% magazine', minRarity: 0 },
  { id: 'reload', tier: 'stat', name: 'Fidgety', desc: '-25% reload time', minRarity: 0 },
  { id: 'crit', tier: 'stat', name: 'Lucky', desc: '+8% crit chance', minRarity: 0 },
  { id: 'critdmg', tier: 'stat', name: "Jack-o'-Grin", desc: '+50% crit damage', minRarity: 1 },
  { id: 'speed', tier: 'stat', name: 'Broomstick Express', desc: '+60% shot speed, +20% range', minRarity: 0 },
  { id: 'fire', tier: 'stat', name: 'Spicy', desc: '+15% Burn chance', minRarity: 1 },
  { id: 'shock', tier: 'stat', name: 'Staticky', desc: '+15% Shock chance', minRarity: 1 },
  { id: 'ecto', tier: 'stat', name: 'Gooey', desc: '+15% Ecto chance', minRarity: 1 },
  { id: 'pierce', tier: 'stat', name: 'Pointy', desc: '+1 pierce', minRarity: 2 },
  { id: 'bounce', tier: 'stat', name: 'Bouncy', desc: '+1 ricochet', minRarity: 2 },
  // ◆ triggers
  { id: 'opener', tier: 'trigger', name: 'Trick Shot', desc: 'First shot of every magazine deals +100% damage', minRarity: 1 },
  { id: 'fresh', tier: 'trigger', name: 'Fresh Batch', desc: 'Reloading an empty magazine: +40% damage for 4s', minRarity: 1 },
  { id: 'seconds', tier: 'trigger', name: 'Seconds, Please!', desc: 'Kills: 30% chance to refund 2 ammo and +30% fire rate for 3s', minRarity: 1 },
  { id: 'combo', tier: 'trigger', name: 'Candy Corn Combo', desc: 'Each hit +3% damage, stacking without limit; all lost after 2s without a hit', minRarity: 2 },
  { id: 'scaredy', tier: 'trigger', name: 'Scaredy-Cat', desc: 'Below 35% HP: +35% fire rate', minRarity: 1 },
  { id: 'freeze', tier: 'trigger', name: 'Freeze Tag', desc: 'After standing still for 1s: +30% damage', minRarity: 1 },
  { id: 'trot', tier: 'trigger', name: 'Trick-or-Treat Trot', desc: 'While moving: +15% fire rate', minRarity: 1 },
  { id: 'bigkid', tier: 'trigger', name: 'Big Kid Energy', desc: '+40% damage to bosses and elites', minRarity: 2 },
  { id: 'sixth', tier: 'trigger', name: 'Sixth Sense', desc: 'Every 6th shot deals +80% damage', minRarity: 2 },
  // ★ uniques
  { id: 'twin', tier: 'unique', name: 'Twin Shot', desc: '+1 projectile', minRarity: 3 },
  { id: 'vamp', tier: 'unique', name: 'Fanged', desc: 'Crits heal 1 HP', minRarity: 3 },
  { id: 'pinata', tier: 'unique', name: 'Piñata Pop', desc: 'Kills burst for 60% damage around the monster', minRarity: 3 },
  { id: 'haunted', tier: 'unique', name: 'Haunted', desc: 'Shots curve toward monsters', minRarity: 3 },
  { id: 'split', tier: 'unique', name: 'Two-for-One', desc: 'Shots split in two on their first hit (45% damage each)', minRarity: 3 },
  { id: 'socks', tier: 'unique', name: 'Fuzzy Socks', desc: 'Hits zap a nearby monster for 50% damage (25% chance)', minRarity: 3 },
  // ✦ spooky deals
  { id: 'tummy', tier: 'deal', name: 'Tummy Ache', desc: '+40% damage, but -15% move speed while held', minRarity: 2 },
  { id: 'glasspump', tier: 'deal', name: 'Glass Pumpkin', desc: '+60% crit damage, but take +15% damage while held', minRarity: 2 },
  { id: 'crash', tier: 'deal', name: 'Sugar Crash', desc: '+50% fire rate, but +50% reload time', minRarity: 2 },
];
export const TRAIT_BY_ID = Object.fromEntries(TRAITS.map((t) => [t.id, t])) as Record<string, Trait>;
export const INSCRIPTIONS = TRAITS;
export const INSC_STYLE: Record<InscTier, { glyph: string; color: string; label: string }> = {
  stat: { glyph: '●', color: '#8fdc7a', label: 'Inscription' },
  trigger: { glyph: '◆', color: '#3fd0e0', label: 'Trigger' },
  unique: { glyph: '★', color: '#ffb43c', label: 'Unique' },
  deal: { glyph: '✦', color: '#c08cff', label: 'Spooky deal' },
};

/** per-gun runtime state used by trigger inscriptions */
export interface WeaponFx { shots: number; combo: number; comboT: number; fresh: number; hasty: number }
export interface Weapon { uid: number; def: WeaponDef; rarity: number; level: number; traits: string[]; ammo: number; reloadT: number; cd: number; fx?: WeaponFx }

let uidc = 1;
export function rollRarity(luck: number, minR = 0, maxR = 4) {
  const w = [60, 28, 12 + luck * 3, 4 + luck * 2, 1 + luck];
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) {
    r -= w[i];
    if (r <= 0) return Math.min(maxR, Math.max(minR, i));
  }
  return Math.max(minR, 0);
}

/** Inscription lines per rarity: common 0-1 · uncommon 1 · rare 2 · epic 3 (25% one unique) · legendary 3 + a unique */
export function rollInscriptions(def: WeaponDef, rarity: number): string[] {
  const ok = (t: Trait) => t.minRarity <= rarity && (!['fire', 'shock', 'ecto'].includes(t.id) || !def.elem || def.elem === t.id || Math.random() < 0.3)
    && !(t.id === 'speed' && def.kind === 'beam') && !(t.id === 'haunted' && def.kind === 'beam') && !(t.id === 'split' && def.kind === 'beam');
  const take = (pool: Trait[], out: string[]) => {
    const p = pool.filter((t) => ok(t) && !out.includes(t.id));
    if (p.length) out.push(p[Math.floor(Math.random() * p.length)].id);
  };
  const out: string[] = [];
  const stats = TRAITS.filter((t) => t.tier === 'stat'), triggers = TRAITS.filter((t) => t.tier === 'trigger');
  const uniques = TRAITS.filter((t) => t.tier === 'unique'), deals = TRAITS.filter((t) => t.tier === 'deal');
  const n = [Math.random() < 0.5 ? 1 : 0, 1, 2, 3, 3][rarity] ?? 0;
  const unique = rarity >= 4 || (rarity === 3 && Math.random() < 0.25);
  let trig = rarity >= 1 && Math.random() < (rarity === 1 ? 0.35 : 0.6) ? 1 : 0;
  if (rarity >= 3 && Math.random() < 0.5) trig++;
  for (let i = 0; i < n; i++) take(i < trig ? triggers : stats, out);
  if (rarity >= 2 && Math.random() < 0.22) { out.pop(); take(deals, out); }
  if (unique) take(uniques, out);
  return out;
}

/** a full-game gun built only to be shown (locked) to free players: the teaser card on level-ups and houses */
export function makeLockedWeapon(rarity: number): Weapon | null {
  const pool = WEAPONS.filter((w) => w.premium);
  if (!pool.length) return null;
  const def = pool[Math.floor(Math.random() * pool.length)];
  const w: Weapon = { uid: uidc++, def, rarity, level: 1, traits: rollInscriptions(def, rarity), ammo: 0, reloadT: 0, cd: 0 };
  w.ammo = weaponStats(w, baseStats()).mag;
  return w;
}
export function makeWeapon(defId: string | null, rarity: number, level = 1): Weapon {
  const weaponPool = WEAPONS.filter((w) => !w.premium || hasFullGame());
  const chosen = defId ? WEAPON_BY_ID[defId] : weaponPool[Math.floor(Math.random() * weaponPool.length)];
  const def = chosen && (!chosen.premium || hasFullGame()) ? chosen : WEAPON_BY_ID.pea;
  const traits = rollInscriptions(def, rarity);
  const w: Weapon = { uid: uidc++, def, rarity, level, traits, ammo: 0, reloadT: 0, cd: 0 };
  w.ammo = weaponStats(w, baseStats()).mag;
  return w;
}

export interface WStats { dmg: number; rate: number; mag: number; reload: number; pierce: number; bounce: number; pellets: number; crit: number; fire: number; shock: number; ecto: number; vamp: boolean; range: number; critMul: number; speed: number }

export function weaponStats(w: Weapon, s: Stats): WStats {
  const d = w.def;
  const has = (t: string) => w.traits.filter((x) => x === t).length;
  const rarMul = 1 + w.rarity * 0.15;
  const lvlMul = 1 + (w.level - 1) * 0.14;
  const ch = (e: Elem) => (d.elem === e ? d.elemChance : 0) + has(e) * 0.15 + (s as unknown as Record<string, number>)[e === 'fire' ? 'burn' : e];
  return {
    dmg: d.dmg * rarMul * lvlMul * (1 + has('dmg') * 0.15) * (1 + has('tummy') * 0.4) * s.dmg,
    rate: d.rate * (1 + has('rate') * 0.15) * (1 + has('crash') * 0.5) * s.rate * (1 + (w.level - 1) * 0.03),
    mag: Math.max(1, Math.round(d.mag * (1 + has('mag') * 0.4) * s.mag)),
    reload: d.reload * (1 - has('reload') * 0.25) * (1 + has('crash') * 0.5) * s.reload,
    pierce: d.pierce + has('pierce') + s.pierce,
    bounce: d.bounce + has('bounce') + s.bounce,
    pellets: d.pellets + has('twin') + s.pellets,
    crit: s.crit + d.critBonus + has('crit') * 0.08,
    fire: ch('fire'),
    shock: ch('shock'),
    ecto: ch('ecto'),
    vamp: has('vamp') > 0,
    range: d.range * (1 + has('speed') * 0.2),
    critMul: s.critDmg + has('critdmg') * 0.5 + has('glasspump') * 0.6,
    speed: d.speed * (1 + has('speed') * 0.6),
  };
}

export function weaponTitle(w: Weapon) {
  return `${w.def.name}${w.level > 1 ? ' +' + (w.level - 1) : ''}`;
}
export function upgradeCost(w: Weapon) {
  return Math.round(25 * Math.pow(w.level, 1.35) * (1 + w.rarity * 0.2));
}
export function weaponDps(w: Weapon, s: Stats) {
  const st = weaponStats(w, s);
  const cycle = st.mag / st.rate + st.reload;
  return Math.round(((st.dmg * st.pellets * st.mag) / cycle) * (1 + st.crit * (st.critMul - 1)) * (w.def.explode ? 1.6 : 1));
}

// ================= SCROLLS (Treats) =================
export interface Scroll { id: string; name: string; quote?: string; icon: string; rarity: number; desc: string; max: number; premium?: boolean; apply: (s: Stats) => void }

export const SCROLLS: Scroll[] = [
  { id: 'sugar', name: "Up, Up, Down, Down…", quote: "Cheat code entered. Fingers go brrr.", icon: '🍭', rarity: 0, desc: '+15% fire rate', max: 8, apply: (s) => (s.rate *= 1.15) },
  { id: 'king', name: "Blessing of the Barbarian Prince", quote: "Raise the sword. You have the power.", icon: '🍫', rarity: 0, desc: '+18% damage', max: 8, apply: (s) => (s.dmg *= 1.18) },
  { id: 'sour', name: "Eye of the Tiger", quote: "Rising up to the challenge of your rival.", icon: '🍬', rarity: 0, desc: '+8% crit chance', max: 6, apply: (s) => (s.crit += 0.08) },
  { id: 'jaw', name: "Crane Kick", quote: "If do right, no can defend.", icon: '🔮', rarity: 1, desc: '+40% crit damage', max: 5, apply: (s) => (s.critDmg += 0.4) },
  { id: 'bag', name: "Unlicensed Nuclear Accelerator", quote: "Bigger pack. Don't ask where it came from.", icon: '🎒', rarity: 0, desc: '+35% magazine size', max: 5, apply: (s) => (s.mag *= 1.35) },
  { id: 'sticky', name: "Duct-Tape Genius Mullet", quote: "Business up front, reload in the back.", icon: '🖐️', rarity: 0, desc: '-20% reload time', max: 4, apply: (s) => (s.reload *= 0.8) },
  { id: 'shoes', name: "Self-Lacing Sneakers", quote: "Power laces, alright!", icon: '👟', rarity: 0, desc: '+10% move speed', max: 5, apply: (s) => (s.move *= 1.1) },
  { id: 'pad', name: "Cyborg Cop Plating", quote: "Dead or alive, the candy's coming with me.", icon: '🛡️', rarity: 0, desc: '+25 max shield', max: 6, apply: (s) => (s.maxShield += 25) },
  { id: 'lasagna', name: "Raw-Egg Breakfast", quote: "Five raw eggs, then up the museum steps.", icon: '🍝', rarity: 0, desc: '+25 max HP', max: 6, apply: (s) => (s.maxHp += 25) },
  { id: 'magnet', name: "Tractor Beam", quote: "Candy goes up. You get it.", icon: '🧲', rarity: 0, desc: '+40% pickup radius', max: 4, apply: (s) => (s.magnet *= 1.4) },
  { id: 'cane', name: "Laser Sword", quote: "Vrrmm. Swish. Through two of them.", icon: '🦯', rarity: 1, desc: '+1 pierce for all weapons', max: 3, apply: (s) => (s.pierce += 1) },
  { id: 'bouncy', name: "Pinball Wizard", quote: "Tilt? Never heard of it.", icon: '⚾', rarity: 1, desc: '+1 ricochet for all weapons', max: 3, apply: (s) => (s.bounce += 1) },
  { id: 'bubble', name: "Two-Player Mode", quote: "Insert another quarter.", icon: '🫧', rarity: 3, desc: '+1 projectile, -10% damage', max: 3, apply: (s) => { s.pellets += 1; s.dmg *= 0.9; } },
  { id: 'fireball', name: "Firestarter Stare", quote: "Don't make her angry.", icon: '🔥', rarity: 1, desc: '+20% Burn chance on hit', max: 4, apply: (s) => (s.burn += 0.2) },
  { id: 'pop', name: "Short-Circuit Spark", quote: "Malfunction! Need input!", icon: '⚡', rarity: 1, desc: '+20% Shock chance on hit', max: 4, apply: (s) => (s.shock += 0.2) },
  { id: 'gummy', name: "Slimed!", quote: "It's all over you. And them.", icon: '🟢', rarity: 1, desc: '+20% Ecto chance on hit', max: 4, apply: (s) => (s.ecto += 0.2) },
  { id: 'pepper', name: "Bug-Hunt Flamethrower", quote: "Get away from her!", icon: '🌶️', rarity: 2, desc: 'Burn deals +60% damage', max: 3, apply: (s) => (s.burnDmg *= 1.6) },
  { id: 'sweater', name: "1.21 Jigawatts", quote: "Great Scott! Lightning never strikes once.", icon: '🧶', rarity: 2, desc: 'Shock chains to +2 more enemies', max: 3, apply: (s) => (s.chain += 2) },
  { id: 'taffy', name: "Sewer Ooze Canister", quote: "Glows in the dark. Mutates everything else.", icon: '☣️', rarity: 2, desc: 'Ecto enemies take +15% more damage', max: 3, apply: (s) => (s.ectoAmp += 0.15) },
  { id: 'fangs', name: "Lost-Boy Fangs", quote: "Sleep all day. Party all night.", icon: '🧛', rarity: 1, desc: '10% chance to heal 2 HP on kill', max: 4, apply: (s) => (s.vamp += 0.1) },
  { id: 'trick', name: "Thermos Lunchbox", quote: "Mom packed extra snacks.", icon: '👜', rarity: 0, desc: 'Monsters drop chocolate bars more often', max: 3, apply: (s) => (s.healDrop += 0.012) },
  { id: 'energy', name: "Training Montage", quote: "Cue the synths. Fast-forward.", icon: '🥤', rarity: 1, desc: '-20% skill cooldown', max: 3, apply: (s) => (s.skillCd *= 0.8) },
  { id: 'orbit', name: "Five-Bladed Glaive", quote: "Throw it like the fate of the realm depends on it.", icon: '🌀', rarity: 2, desc: '+1 orbiting candy-corn blade', max: 5, apply: (s) => (s.orbit += 1) },
  { id: 'buddy', name: "Pocket Ghost Pal", quote: "He's friendly. Mostly.", icon: '👻', rarity: 3, desc: 'A friendly ghost follows you and shoots monsters', max: 3, apply: (s) => (s.familiar += 1) },
  { id: 'glass', name: "There Can Be Only One", quote: "Sword up. Health down. Lightning optional.", icon: '💎', rarity: 4, desc: '+45% damage, -30% max HP', max: 1, apply: (s) => { s.dmg *= 1.45; s.maxHp *= 0.7; } },
  { id: 'clover', name: "One-Eyed Pirate's Map", quote: "Never say die. X marks the loot.", icon: '🍀', rarity: 2, desc: 'Better loot rarity', max: 3, apply: (s) => (s.luck += 1) },
  { id: 'firesneak', name: "88 MPH Fire Trails", quote: "Where we're going, we don't need roads.", icon: '🥾', rarity: 2, desc: 'Dashing leaves a burning trail', max: 1, apply: (s) => (s.dashFire = 1) },
  { id: 'helmet', name: "Half-Shell Armour", quote: "Heroes in a… shell.", icon: '⛑️', rarity: 1, desc: 'Take 12% less damage', max: 3, apply: (s) => (s.armor = 1 - (1 - s.armor) * 0.88) },
  { id: 'piggy', name: "Greed Is Good Briefcase", quote: "Lunch is for wimps.", icon: '🐷', rarity: 0, desc: '+40% coins', max: 3, apply: (s) => (s.coinGain *= 1.4) },
  { id: 'homework', name: "Wax On, Wax Off", quote: "Every chore was practice.", icon: '📚', rarity: 0, desc: '+20% XP gain', max: 3, apply: (s) => (s.xpGain *= 1.2) },
  { id: 'bang', name: "Yippee-Ki-Yay", quote: "Come out to the coast, we'll get together…", icon: '💥', rarity: 1, desc: '+35% skill power & radius', max: 3, apply: (s) => (s.skillPow *= 1.35) },
  { id: 'jackpot', name: "Arcade High Score", quote: "Enter your initials.", icon: '🎰', rarity: 4, desc: '+1 projectile and +15% fire rate', max: 1, apply: (s) => { s.pellets += 1; s.rate *= 1.15; } },
];
// occult-scroll style treats: conditional or double-edged (after Gunfire Reborn's scrolls)
SCROLLS.push(
  { id: 'lucky6', name: "Feeling Lucky, Punk?", quote: "Six shots, or only five?", icon: '🎲', rarity: 1, desc: 'Every 6th shot deals +60% damage', max: 1, apply: (s) => (s.sixth = 1) },
  { id: 'fullbag', name: "The Trap Is Full", quote: "Whatever you do, don't cross the streams.", icon: '🛍️', rarity: 1, desc: '+40% damage while your magazine is over 80% full', max: 1, apply: (s) => (s.fullBag = 1) },
  { id: 'skate', name: "Hoverboard Grind", quote: "Doesn't work on water.", icon: '🛹', rarity: 2, desc: 'Dashing instantly refills your magazine', max: 1, apply: (s) => (s.skate = 1) },
  { id: 'statue', name: "Unstoppable Cyborg Stance", quote: "Stand still. Hit harder. It'll be back.", icon: '🗿', rarity: 1, desc: '+35% damage after standing still for 1s', max: 1, apply: (s) => (s.statue = 1) },
  { id: 'bluff', name: "Danger-Zone Aviators", quote: "You can be my wingman any time.", icon: '😤', rarity: 0, desc: '+25% damage while at full HP', max: 1, apply: (s) => (s.bluff = 1) },
  { id: 'bedtime', name: "Elm Street Bedtime", quote: "Whatever you do… don't fall asleep.", icon: '🛏️', rarity: 3, desc: 'Normal monsters under 12% HP are popped instantly', max: 1, apply: (s) => (s.execute = 1) },
  { id: 'owl', name: "Heat-Vision Hunter", quote: "If it bleeds, you can crit it.", icon: '🦉', rarity: 2, desc: '+100% crit damage, but -25% damage on non-crits', max: 1, apply: (s) => { s.owl = 1; s.critDmg += 1; } },
  { id: 'cursed', name: "Fed After Midnight", quote: "Three rules. You broke the last one.", icon: '🍬', rarity: 4, desc: '+60% damage, but -50% max HP', max: 1, apply: (s) => { s.dmg *= 1.6; s.maxHp *= 0.5; } },
);
SCROLLS.push(
  { id: 'walkie', premium: true, name: "Never-Say-Die Walkies", quote: "Over and out, buddy.", icon: '📻', rarity: 1, desc: '+25% companion damage', max: 4, apply: (s) => (s.companionDmg *= 1.25) },
  { id: 'firstaid', premium: true, name: "Wilderness Survival Kit", quote: "Four friends, one long walk along the tracks.", icon: '🩹', rarity: 2, desc: 'Revives are 25% faster', max: 3, apply: (s) => (s.reviveSpeed *= 1.25) },
  { id: 'friendship', premium: true, name: "Wolf Pack Bracelets", quote: "Friends forever. BMX gang rules.", icon: '🧶', rarity: 2, desc: 'Companion takes 15% less damage', max: 3, apply: (s) => (s.companionArmor = 1 - (1 - s.companionArmor) * 0.85) },
);
export const SCROLL_BY_ID = Object.fromEntries(SCROLLS.map((s) => [s.id, s])) as Record<string, Scroll>;

export const LOCKED_SCROLLS = () => SCROLLS.filter((s) => s.premium);
export function rollScrolls(n: number, owned: Record<string, number>, luck: number, minRarity = 0, maxRarity = 4): Scroll[] {
  const out: Scroll[] = [];
  const weights = [60, 30, 14 + luck * 3, 6 + luck * 2, 2 + luck];
  // No hard caps: stacking treats can be taken past their usual max ("overstack"), just less often.
  // One-off treats (max 1) are switches, so they stay single.
  const over = (s: Scroll) => (owned[s.id] || 0) >= s.max;
  const avail = SCROLLS.filter((s) => s.rarity >= minRarity && s.rarity <= maxRarity && (!over(s) || s.max > 1) && (!s.premium || hasFullGame()));
  const weight = (s: Scroll) => weights[s.rarity] * (over(s) ? 0.3 : 1);
  for (let i = 0; i < n && avail.length; i++) {
    let tot = 0;
    for (const s of avail) tot += weight(s);
    let r = Math.random() * tot;
    let k = 0;
    for (; k < avail.length; k++) {
      r -= weight(avail[k]);
      if (r <= 0) break;
    }
    k = Math.min(k, avail.length - 1);
    out.push(avail[k]);
    avail.splice(k, 1);
  }
  return out;
}

// ================= TALENTS (meta progression) =================
export interface Talent {
  premium?: boolean;
  id: string; branch: 0 | 1 | 2; name: string; icon: string; max: number; cost: (lvl: number) => number; desc: string; apply: (s: Stats, lvl: number) => void;
  /** position in the tree canvas (viewBox 1000 x 900) */
  x: number; y: number;
  /** unlock requires at least 1 rank in ANY of these (empty = connected to the root) */
  req: string[];
  capstone?: boolean;
}

export const TALENT_BRANCHES = ['Mischief', 'Costume', 'Street Smarts'];
export const TALENT_BRANCH_SUB = ['Offense', 'Defense', 'Utility'];
export const TALENT_COLORS = ['#ff5a4a', '#4fb3ff', '#5fe37a'];
export const TALENT_ROOT = { x: 500, y: 450 };
export const TALENTS: Talent[] = [
  // ---- Mischief (upper-left) ----
  { id: 'sharp', branch: 0, x: 385, y: 370, req: [], name: 'Sharp Teeth', icon: '🦷', max: 5, cost: (l) => 15 + l * 15, desc: '+5% damage per rank', apply: (s, l) => (s.dmg *= 1 + 0.05 * l) },
  { id: 'trigger', branch: 0, x: 255, y: 330, req: ['sharp'], name: 'Trigger Finger', icon: '👉', max: 3, cost: (l) => 25 + l * 20, desc: '+5% fire rate per rank', apply: (s, l) => (s.rate *= 1 + 0.05 * l) },
  { id: 'lucky', branch: 0, x: 360, y: 240, req: ['sharp'], name: 'Lucky Socks', icon: '🧦', max: 3, cost: (l) => 25 + l * 20, desc: '+3% crit chance per rank', apply: (s, l) => (s.crit += 0.03 * l) },
  { id: 'grin', branch: 0, x: 215, y: 195, req: ['trigger', 'lucky'], name: 'Wicked Grin', icon: '😈', max: 3, cost: (l) => 40 + l * 25, desc: '+15% crit damage per rank', apply: (s, l) => (s.critDmg += 0.15 * l) },
  { id: 'hot', branch: 0, x: 420, y: 130, req: ['lucky'], name: 'Hot Sauce Lunch', icon: '🌮', max: 1, cost: () => 90, desc: 'Start every run with +10% Burn chance', apply: (s, l) => (s.burn += 0.1 * l) },
  { id: 'prankster', branch: 0, x: 250, y: 70, req: ['grin', 'hot'], capstone: true, name: 'Prankster King', icon: '👑', max: 1, cost: () => 260, desc: 'CAPSTONE · All weapons fire +1 projectile', apply: (s, l) => (s.pellets += l) },
  // ---- Costume (upper-right) ----
  { id: 'thick', branch: 1, x: 615, y: 370, req: [], name: 'Thick Costume', icon: '🧥', max: 5, cost: (l) => 15 + l * 15, desc: '+10 max HP per rank', apply: (s, l) => (s.maxHp += 10 * l) },
  { id: 'pads', branch: 1, x: 745, y: 330, req: ['thick'], name: 'Knee Pads', icon: '🦵', max: 3, cost: (l) => 25 + l * 20, desc: '+10 max shield per rank', apply: (s, l) => (s.maxShield += 10 * l) },
  { id: 'recover', branch: 1, x: 640, y: 240, req: ['thick'], name: 'Quick Recovery', icon: '💨', max: 3, cost: (l) => 25 + l * 20, desc: 'Shield recharges 15% sooner per rank', apply: (s, l) => (s.shieldDelay *= 1 - 0.15 * l) },
  { id: 'hardhat', branch: 1, x: 785, y: 195, req: ['pads', 'recover'], name: 'Hard Hat', icon: '⛑️', max: 3, cost: (l) => 40 + l * 25, desc: 'Take 5% less damage per rank', apply: (s, l) => (s.armor = 1 - (1 - s.armor) * (1 - 0.05 * l)) },
  { id: 'second', branch: 1, x: 580, y: 130, req: ['recover'], name: 'Second Wind', icon: '❤️‍🔥', max: 1, cost: () => 150, desc: 'Revive once per run with 50% HP', apply: (s, l) => (s.revive += l) },
  { id: 'master', branch: 1, x: 750, y: 70, req: ['hardhat', 'second'], capstone: true, name: 'Costume Master', icon: '🎭', max: 1, cost: () => 240, desc: 'CAPSTONE · +50% costume find chance; +20% skill power while wearing a costume', apply: (s, l) => { s.costumeLuck *= 1 + l * 0.5; s.costumePower *= 1 + l * 0.2; } },
  // ---- Street Smarts (bottom) ----
  { id: 'shoes', branch: 2, x: 500, y: 570, req: [], name: 'New Sneakers', icon: '👟', max: 3, cost: (l) => 20 + l * 15, desc: '+4% move speed per rank', apply: (s, l) => (s.move *= 1 + 0.04 * l) },
  { id: 'pockets', branch: 2, x: 370, y: 625, req: ['shoes'], name: 'Deep Pockets', icon: '👖', max: 3, cost: (l) => 20 + l * 15, desc: '+15% pickup radius per rank', apply: (s, l) => (s.magnet *= 1 + 0.15 * l) },
  { id: 'allowance', branch: 2, x: 630, y: 625, req: ['shoes'], name: 'Allowance', icon: '💵', max: 3, cost: (l) => 20 + l * 20, desc: '+30 starting coins per rank', apply: (s, l) => (s.startCoins += 30 * l) },
  { id: 'sweet', branch: 2, x: 500, y: 690, req: ['shoes'], name: 'Sweet Talker', icon: '🗣️', max: 3, cost: (l) => 30 + l * 20, desc: 'Trick-or-treating is 12% faster per rank', apply: (s, l) => (s.totSpeed *= 1 - 0.12 * l) },
  { id: 'dash', branch: 2, x: 265, y: 720, req: ['pockets'], name: 'Extra Dash', icon: '⚡', max: 1, cost: () => 110, desc: '+1 dash charge', apply: (s, l) => (s.dashCharges += l) },
  { id: 'find', branch: 2, x: 360, y: 795, req: ['pockets'], name: 'Garage Sale Find', icon: '🔧', max: 2, cost: (l) => 80 + l * 80, desc: 'Starting weapon +1 rarity per rank', apply: (s, l) => (s.startRarity += l) },
  { id: 'reroll', branch: 2, x: 735, y: 720, req: ['allowance'], name: 'Second Opinion', icon: '🎲', max: 3, cost: (l) => 30 + l * 25, desc: '+1 treat reroll per run per rank', apply: (s, l) => (s.rerolls += l) },
  { id: 'legend', branch: 2, x: 500, y: 830, req: ['sweet'], capstone: true, name: 'Neighbourhood Legend', icon: '🏡', max: 1, cost: () => 220, desc: 'CAPSTONE · Every house offers +1 extra treat choice', apply: (s, l) => (s.totChoices += l) },
];
TALENTS.push(
  { id: 'heavy', premium: true, branch: 0, x: 95, y: 325, req: ['trigger'], name: 'Heavy Treats', icon: '🍫', max: 4, cost: (l) => 60 + l * 40, desc: '+8% damage per rank', apply: (s, l) => (s.dmg *= 1 + l * 0.08) },
  { id: 'sharpshot', premium: true, branch: 0, x: 65, y: 200, req: ['heavy'], name: 'Secret Aim', icon: '🎯', max: 3, cost: (l) => 80 + l * 45, desc: '+5% crit chance per rank', apply: (s, l) => (s.crit += l * 0.05) },
  { id: 'bestfriends', premium: true, branch: 0, x: 80, y: 80, req: ['sharpshot'], capstone: true, name: 'Partners in Mischief', icon: '🤝', max: 3, cost: (l) => 130 + l * 60, desc: '+20% companion damage per rank', apply: (s, l) => (s.companionDmg *= 1 + l * 0.2) },
  { id: 'stitched', premium: true, branch: 1, x: 905, y: 325, req: ['pads'], name: 'Double Stitched', icon: '🧵', max: 4, cost: (l) => 60 + l * 40, desc: '+15 HP and shield per rank', apply: (s, l) => { s.maxHp += l * 15; s.maxShield += l * 15; } },
  { id: 'fieldmedic', premium: true, branch: 1, x: 935, y: 200, req: ['stitched'], name: 'Field Medic', icon: '🩹', max: 3, cost: (l) => 80 + l * 45, desc: '+20% revive speed per rank', apply: (s, l) => (s.reviveSpeed *= 1 + l * 0.2) },
  { id: 'guardians', premium: true, branch: 1, x: 920, y: 80, req: ['fieldmedic'], capstone: true, name: 'Watch Each Other', icon: '🛡️', max: 3, cost: (l) => 130 + l * 60, desc: 'Companion takes 10% less damage per rank', apply: (s, l) => (s.companionArmor = 1 - (1 - s.companionArmor) * (1 - l * 0.1)) },
  { id: 'studygroup', premium: true, branch: 2, x: 150, y: 600, req: ['pockets'], name: 'Study Group', icon: '📚', max: 4, cost: (l) => 60 + l * 40, desc: '+10% run XP per rank', apply: (s, l) => (s.xpGain *= 1 + l * 0.1) },
  { id: 'paperroute', premium: true, branch: 2, x: 100, y: 745, req: ['studygroup'], name: 'Paper Route', icon: '🗞️', max: 3, cost: (l) => 80 + l * 45, desc: '+20% coin gain per rank', apply: (s, l) => (s.coinGain *= 1 + l * 0.2) },
  { id: 'seeker', premium: true, branch: 2, x: 85, y: 855, req: ['paperroute'], capstone: true, name: 'Master Seeker', icon: '🔦', max: 3, cost: (l) => 130 + l * 60, desc: '+15% pickup radius and 4% move speed per rank', apply: (s, l) => { s.magnet *= 1 + l * 0.15; s.move *= 1 + l * 0.04; } },
);
export const TALENT_BY_ID = Object.fromEntries(TALENTS.map((t) => [t.id, t])) as Record<string, Talent>;
export function talentUnlocked(t: Talent, ranks: Record<string, number>) {
  return (!t.premium || hasFullGame()) && (t.req.length === 0 || t.req.some((r) => (ranks[r] || 0) > 0));
}

// ================= COSTUMES =================
export interface CostumeDef { id: string; name: string; icon: string; color: string; power: string; perks: string; line: string; rarity: 3; premium?: boolean; apply: (s: Stats) => void }
export const COSTUMES: CostumeDef[] = [
  { id: 'ghost', rarity: 3, name: 'Bedsheet Ghost', icon: '👻', color: '#dfe8ff', power: 'Epic Phase: pass garden fences, hedges & graves; district locks stay solid', perks: '+35% dodge, +1 dash, +15% movement', line: 'Eek! A real ghost?!', apply: (s) => { s.dodge += 0.35; s.dashCharges++; s.move *= 1.15; } },
  { id: 'vampire', rarity: 3, name: 'Vampire', icon: '🧛', color: '#e0304a', power: 'Blood Feast: every kill heals 4 HP and restores 3 shield', perks: '+75% crit damage, +15% damage', line: "A vampire! Please don't bite me!", apply: (s) => { s.critDmg += 0.75; s.dmg *= 1.15; } },
  { id: 'witch', rarity: 3, name: 'Little Witch', icon: '🧙', color: '#b44dff', power: 'Hex Storm: three powerful homing, piercing hexes every 0.9s', perks: '+60% skill power', line: 'What a wicked little witch!', apply: (s) => (s.skillPow *= 1.6) },
  { id: 'hero', rarity: 3, name: 'Super Kid', icon: '🦸', color: '#4f8aff', power: 'Meteor Dash: smash through monsters for 120 base damage with knockback', perks: '+2 dashes, +25% movement, +20% damage', line: 'Our hero! Here to save Halloween?', apply: (s) => { s.dashCharges += 2; s.move *= 1.25; s.dmg *= 1.2; } },
  { id: 'skeleton', rarity: 3, name: 'Skeleton Suit', icon: '💀', color: '#e8e2d0', power: 'Bone Barrage: crits launch four piercing shards (0.15s cooldown)', perks: '+20% crit chance, +50% crit damage', line: 'Spooky scary skeleton!', apply: (s) => { s.crit += 0.2; s.critDmg += 0.5; } },
  { id: 'pumpkin', rarity: 3, name: 'Pumpkin Head', icon: '🎃', color: '#ff8a1e', power: 'Inferno Crown: taking a hit releases a huge fire nova (2s cooldown)', perks: '+50% burn chance, +50% burn damage', line: 'Ha! A walking jack-o-lantern!', apply: (s) => { s.burn += 0.5; s.burnDmg *= 1.5; } },
  { id: 'astronaut', rarity: 3, name: 'Space Cadet', icon: '🧑‍🚀', color: '#cfe6ff', power: 'Orbital Field: double shield recharge, 75% shorter recharge delay', perks: '+150 shield, 15% damage reduction', line: 'One small step for candy-kind!', apply: (s) => { s.maxShield += 150; s.shieldDelay *= 0.25; s.armor = 1 - (1 - s.armor) * 0.85; } },
  { id: 'dino', rarity: 3, name: 'T-Rex Hoodie', icon: '🦖', color: '#5fd84a', power: 'Jurassic Stomp: wide 150-damage shockwave and stun every 2.5s', perks: '+100 HP, +20% damage', line: 'RAWR! A dinosaur at my door!', apply: (s) => { s.maxHp += 100; s.dmg *= 1.2; } },
];
COSTUMES.push(
  { id: 'knight', rarity: 3, premium: true, name: 'Cardboard Knight', icon: '🛡️', color: '#d0ac76', power: 'Royal Guard: 40% damage reduction and one orbiting blade', perks: '+120 shield, +35% companion damage', line: 'A brave knight at my door!', apply: (s) => { s.maxShield += 120; s.armor = 1 - (1 - s.armor) * 0.6; s.orbit++; s.companionDmg *= 1.35; } },
  { id: 'moth', rarity: 3, premium: true, name: 'Moon Moth', icon: '🦋', color: '#b7adce', power: 'Lunar Wings: two extra dashes and 40% dodge', perks: '+30% movement, +40% skill power', line: 'Follow the porchlight, little moth!', apply: (s) => { s.dashCharges += 2; s.dodge += 0.4; s.move *= 1.3; s.skillPow *= 1.4; } },
);
export const COSTUME_BY_ID = Object.fromEntries(COSTUMES.map((c) => [c.id, c])) as Record<string, CostumeDef>;
export const HOMEOWNERS = ['Mrs. Henderson', 'Mr. Kowalski', 'Old Man Jenkins', 'The Nguyens', 'Ms. Petrova', 'Grandma Rose', 'Coach Miller', 'Dr. Alvarez', 'The Johnsons', 'Mrs. Okafor', 'Mr. Bellamy', 'Aunt Dottie'];
export const GIVE_LINES = ['Here you go, sweetie!', 'Take two, I won\'t tell!', 'Full-size bars this year!', 'Careful out there tonight…', 'Happy Halloween, dear!', 'Ooh, last of the good stuff!'];

const SAVE_KEY = 'tot_survivors_save_v1';
export interface Save { soul: number; talents: Record<string, number>; best: number; hero: number; bestWave?: number }
export function loadSave(): Save {
  try {
    const s = JSON.parse(storage.getItem(SAVE_KEY) || '');
    const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
    const talents: Record<string, number> = {};
    for (const tal of TALENTS) {
      const rank = Math.min(tal.max, finite(s.talents?.[tal.id]));
      if (rank) talents[tal.id] = rank;
    }
    return { soul: finite(s.soul), talents, best: finite(s.best), hero: Math.min(4, finite(s.hero)), bestWave: finite(s.bestWave) };
  } catch {
    return { soul: 60, talents: {}, best: 0, hero: 0 };
  }
}
export function storeSave(s: Save) {
  storage.setItem(SAVE_KEY, JSON.stringify(s));
}

export function applyTalents(s: Stats, t: Record<string, number>) {
  for (const tal of TALENTS) if (t[tal.id] && (!tal.premium || hasFullGame())) tal.apply(s, Math.min(tal.max, Math.max(0, t[tal.id])));
}

// ================= HEROES (skills) =================
export const HERO_INFO = [
  { name: 'Tommy', title: 'The Troublemaker', passive: '+10% damage', skill: 'Pumpkin Bomb', skillDesc: 'Lob an explosive jack-o-lantern that bursts into flames.', cd: 6, apply: (s: Stats) => (s.dmg *= 1.1) },
  { name: 'Sam', title: 'The Science Kid', passive: '+30 max shield', skill: 'TP Tornado', skillDesc: 'Summon a toilet-paper twister that pulls in and shreds monsters.', cd: 10, apply: (s: Stats) => (s.maxShield += 30) },
  { name: 'Jess', title: 'The Brave One', passive: '+8% crit chance', skill: 'Camera Flash', skillDesc: 'A blinding flash that stuns and damages everything in a wide cone.', cd: 7, apply: (s: Stats) => (s.crit += 0.08) },
  { name: 'Maya', title: 'The Fixer', passive: '35% faster reloads, +40 shield', skill: 'Overcharged Repair', skillDesc: 'Fully heal and shield yourself, heal or revive your active friend, and refill both guns. An EMP breaks nearby enemy shields, stuns and deals 140 damage. Gain 2s invulnerability and double damage for 6s.', cd: 12, apply: (s: Stats) => { s.reload *= 0.65; s.maxShield += 40; } },
  { name: 'Leo', title: 'The Night Scout', passive: '+20% movement speed, +1 dash', skill: 'Nightfall Beacon', skillDesc: 'A huge moonlit blast deals 220 damage, slows enemies for 8s and stuns for 3s (1s on bosses). Refill your dashes, gain 1.5s invulnerability and triple damage for 7s.', cd: 11, apply: (s: Stats) => { s.move *= 1.2; s.dashCharges++; } },
];

export const rarityColor = (r: number) => RARITY[r].color;
