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
  totSpeed: number; totChoices: number; startCostume: number; dodge: number;
  companionDmg: number; reviveSpeed: number; companionArmor: number;
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
    totSpeed: 1, totChoices: 0, startCostume: 0, dodge: 0,
    companionDmg: 1, reviveSpeed: 1, companionArmor: 0,
  };
}

// ================= WEAPONS =================
export type BulletKind = 'pea' | 'dart' | 'corn' | 'fire' | 'water' | 'balloon' | 'rocket' | 'beam' | 'stone' | 'hex' | 'bone';

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

export interface Trait { id: string; name: string; desc: string; minRarity: number }
export const TRAITS: Trait[] = [
  { id: 'dmg', name: 'Sugar-Coated', desc: '+15% damage', minRarity: 1 },
  { id: 'rate', name: 'Hyper', desc: '+15% fire rate', minRarity: 1 },
  { id: 'mag', name: 'Overstuffed', desc: '+40% magazine', minRarity: 1 },
  { id: 'reload', name: 'Fidgety', desc: '-25% reload time', minRarity: 1 },
  { id: 'crit', name: 'Lucky', desc: '+8% crit chance', minRarity: 1 },
  { id: 'pierce', name: 'Pointy', desc: '+1 pierce', minRarity: 2 },
  { id: 'bounce', name: 'Bouncy', desc: '+1 ricochet', minRarity: 2 },
  { id: 'fire', name: 'Spicy', desc: '+15% Burn chance', minRarity: 1 },
  { id: 'shock', name: 'Staticky', desc: '+15% Shock chance', minRarity: 1 },
  { id: 'ecto', name: 'Gooey', desc: '+15% Ecto chance', minRarity: 1 },
  { id: 'twin', name: 'Twin Shot', desc: '+1 projectile', minRarity: 3 },
  { id: 'vamp', name: 'Fanged', desc: 'Crits heal 1 HP', minRarity: 3 },
];
export const TRAIT_BY_ID = Object.fromEntries(TRAITS.map((t) => [t.id, t])) as Record<string, Trait>;

export interface Weapon { uid: number; def: WeaponDef; rarity: number; level: number; traits: string[]; ammo: number; reloadT: number; cd: number }

let uidc = 1;
export function rollRarity(luck: number, minR = 0) {
  const w = [60, 28, 12 + luck * 3, 4 + luck * 2, 1 + luck];
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) {
    r -= w[i];
    if (r <= 0) return Math.max(minR, i);
  }
  return Math.max(minR, 0);
}

export function makeWeapon(defId: string | null, rarity: number, level = 1): Weapon {
  const weaponPool = WEAPONS.filter((w) => !w.premium || hasFullGame());
  const chosen = defId ? WEAPON_BY_ID[defId] : weaponPool[Math.floor(Math.random() * weaponPool.length)];
  const def = chosen && (!chosen.premium || hasFullGame()) ? chosen : WEAPON_BY_ID.pea;
  const traits: string[] = [];
  const pool = TRAITS.filter((t) => t.minRarity <= rarity && (!['fire', 'shock', 'ecto'].includes(t.id) || !def.elem || def.elem === t.id || Math.random() < 0.3));
  for (let i = 0; i < rarity && pool.length; i++) {
    const k = Math.floor(Math.random() * pool.length);
    traits.push(pool[k].id);
    pool.splice(k, 1);
  }
  const w: Weapon = { uid: uidc++, def, rarity, level, traits, ammo: 0, reloadT: 0, cd: 0 };
  w.ammo = weaponStats(w, baseStats()).mag;
  return w;
}

export interface WStats { dmg: number; rate: number; mag: number; reload: number; pierce: number; bounce: number; pellets: number; crit: number; fire: number; shock: number; ecto: number; vamp: boolean; range: number }

export function weaponStats(w: Weapon, s: Stats): WStats {
  const d = w.def;
  const has = (t: string) => w.traits.filter((x) => x === t).length;
  const rarMul = 1 + w.rarity * 0.15;
  const lvlMul = 1 + (w.level - 1) * 0.14;
  const ch = (e: Elem) => (d.elem === e ? d.elemChance : 0) + has(e) * 0.15 + (s as unknown as Record<string, number>)[e === 'fire' ? 'burn' : e];
  return {
    dmg: d.dmg * rarMul * lvlMul * (1 + has('dmg') * 0.15) * s.dmg,
    rate: d.rate * (1 + has('rate') * 0.15) * s.rate * (1 + (w.level - 1) * 0.03),
    mag: Math.max(1, Math.round(d.mag * (1 + has('mag') * 0.4) * s.mag)),
    reload: d.reload * (1 - has('reload') * 0.25) * s.reload,
    pierce: d.pierce + has('pierce') + s.pierce,
    bounce: d.bounce + has('bounce') + s.bounce,
    pellets: d.pellets + has('twin') + s.pellets,
    crit: s.crit + d.critBonus + has('crit') * 0.08,
    fire: ch('fire'),
    shock: ch('shock'),
    ecto: ch('ecto'),
    vamp: has('vamp') > 0,
    range: d.range,
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
  return Math.round(((st.dmg * st.pellets * st.mag) / cycle) * (1 + st.crit * (s.critDmg - 1)) * (w.def.explode ? 1.6 : 1));
}

// ================= SCROLLS (Treats) =================
export interface Scroll { id: string; name: string; icon: string; rarity: number; desc: string; max: number; premium?: boolean; apply: (s: Stats) => void }

export const SCROLLS: Scroll[] = [
  { id: 'sugar', name: 'Sugar Rush', icon: '🍭', rarity: 0, desc: '+15% fire rate', max: 8, apply: (s) => (s.rate *= 1.15) },
  { id: 'king', name: 'King-Size Bar', icon: '🍫', rarity: 0, desc: '+18% damage', max: 8, apply: (s) => (s.dmg *= 1.18) },
  { id: 'sour', name: 'Sour Patch', icon: '🍬', rarity: 0, desc: '+8% crit chance', max: 6, apply: (s) => (s.crit += 0.08) },
  { id: 'jaw', name: 'Jawbreaker', icon: '🔮', rarity: 1, desc: '+40% crit damage', max: 5, apply: (s) => (s.critDmg += 0.4) },
  { id: 'bag', name: 'Pillowcase Bag', icon: '🎒', rarity: 0, desc: '+35% magazine size', max: 5, apply: (s) => (s.mag *= 1.35) },
  { id: 'sticky', name: 'Sticky Fingers', icon: '🖐️', rarity: 0, desc: '-20% reload time', max: 4, apply: (s) => (s.reload *= 0.8) },
  { id: 'shoes', name: 'Light-Up Sneakers', icon: '👟', rarity: 0, desc: '+10% move speed', max: 5, apply: (s) => (s.move *= 1.1) },
  { id: 'pad', name: 'Costume Padding', icon: '🛡️', rarity: 0, desc: '+25 max shield', max: 6, apply: (s) => (s.maxShield += 25) },
  { id: 'lasagna', name: "Mom's Lasagna", icon: '🍝', rarity: 0, desc: '+25 max HP', max: 6, apply: (s) => (s.maxHp += 25) },
  { id: 'magnet', name: 'Fridge Magnet', icon: '🧲', rarity: 0, desc: '+40% pickup radius', max: 4, apply: (s) => (s.magnet *= 1.4) },
  { id: 'cane', name: 'Pointy Candy Cane', icon: '🦯', rarity: 1, desc: '+1 pierce for all weapons', max: 3, apply: (s) => (s.pierce += 1) },
  { id: 'bouncy', name: 'Super Bouncy Ball', icon: '⚾', rarity: 1, desc: '+1 ricochet for all weapons', max: 3, apply: (s) => (s.bounce += 1) },
  { id: 'bubble', name: 'Double Bubble', icon: '🫧', rarity: 3, desc: '+1 projectile, -10% damage', max: 3, apply: (s) => { s.pellets += 1; s.dmg *= 0.9; } },
  { id: 'fireball', name: 'Atomic Fireball', icon: '🔥', rarity: 1, desc: '+20% Burn chance on hit', max: 4, apply: (s) => (s.burn += 0.2) },
  { id: 'pop', name: 'Pop Rocks', icon: '⚡', rarity: 1, desc: '+20% Shock chance on hit', max: 4, apply: (s) => (s.shock += 0.2) },
  { id: 'gummy', name: 'Gummy Slime', icon: '🟢', rarity: 1, desc: '+20% Ecto chance on hit', max: 4, apply: (s) => (s.ecto += 0.2) },
  { id: 'pepper', name: 'Ghost Pepper', icon: '🌶️', rarity: 2, desc: 'Burn deals +60% damage', max: 3, apply: (s) => (s.burnDmg *= 1.6) },
  { id: 'sweater', name: 'Static Sweater', icon: '🧶', rarity: 2, desc: 'Shock chains to +2 more enemies', max: 3, apply: (s) => (s.chain += 2) },
  { id: 'taffy', name: 'Toxic Taffy', icon: '☣️', rarity: 2, desc: 'Ecto enemies take +15% more damage', max: 3, apply: (s) => (s.ectoAmp += 0.15) },
  { id: 'fangs', name: 'Vampire Teeth', icon: '🧛', rarity: 1, desc: '10% chance to heal 2 HP on kill', max: 4, apply: (s) => (s.vamp += 0.1) },
  { id: 'trick', name: 'Trick-or-Treat Bag', icon: '👜', rarity: 0, desc: 'Monsters drop chocolate bars more often', max: 3, apply: (s) => (s.healDrop += 0.012) },
  { id: 'energy', name: 'Energy Drink', icon: '🥤', rarity: 1, desc: '-20% skill cooldown', max: 3, apply: (s) => (s.skillCd *= 0.8) },
  { id: 'orbit', name: 'Candy Corn Orbit', icon: '🌀', rarity: 2, desc: '+1 orbiting candy-corn blade', max: 5, apply: (s) => (s.orbit += 1) },
  { id: 'buddy', name: 'Ghost Buddy', icon: '👻', rarity: 3, desc: 'A friendly ghost follows you and shoots monsters', max: 3, apply: (s) => (s.familiar += 1) },
  { id: 'glass', name: 'Glass Cannon Costume', icon: '💎', rarity: 4, desc: '+45% damage, -30% max HP', max: 1, apply: (s) => { s.dmg *= 1.45; s.maxHp *= 0.7; } },
  { id: 'clover', name: 'Four-Leaf Clover', icon: '🍀', rarity: 2, desc: 'Better loot rarity', max: 3, apply: (s) => (s.luck += 1) },
  { id: 'firesneak', name: 'Fire Sneakers', icon: '🥾', rarity: 2, desc: 'Dashing leaves a burning trail', max: 1, apply: (s) => (s.dashFire = 1) },
  { id: 'helmet', name: 'Bike Helmet', icon: '⛑️', rarity: 1, desc: 'Take 12% less damage', max: 3, apply: (s) => (s.armor = 1 - (1 - s.armor) * 0.88) },
  { id: 'piggy', name: 'Piggy Bank', icon: '🐷', rarity: 0, desc: '+40% coins', max: 3, apply: (s) => (s.coinGain *= 1.4) },
  { id: 'homework', name: 'Homework Done', icon: '📚', rarity: 0, desc: '+20% XP gain', max: 3, apply: (s) => (s.xpGain *= 1.2) },
  { id: 'bang', name: 'Bigger Bang', icon: '💥', rarity: 1, desc: '+35% skill power & radius', max: 3, apply: (s) => (s.skillPow *= 1.35) },
  { id: 'jackpot', name: 'Jackpot', icon: '🎰', rarity: 4, desc: '+1 projectile and +15% fire rate', max: 1, apply: (s) => { s.pellets += 1; s.rate *= 1.15; } },
];
SCROLLS.push(
  { id: 'walkie', premium: true, name: 'Walkie-Talkie Pact', icon: '📻', rarity: 1, desc: '+25% companion damage', max: 4, apply: (s) => (s.companionDmg *= 1.25) },
  { id: 'firstaid', premium: true, name: 'Pocket First Aid', icon: '🩹', rarity: 2, desc: 'Revives are 25% faster', max: 3, apply: (s) => (s.reviveSpeed *= 1.25) },
  { id: 'friendship', premium: true, name: 'Friendship Bracelet', icon: '🧶', rarity: 2, desc: 'Companion takes 15% less damage', max: 3, apply: (s) => (s.companionArmor = 1 - (1 - s.companionArmor) * 0.85) },
);
export const SCROLL_BY_ID = Object.fromEntries(SCROLLS.map((s) => [s.id, s])) as Record<string, Scroll>;

export function rollScrolls(n: number, owned: Record<string, number>, luck: number): Scroll[] {
  const out: Scroll[] = [];
  const weights = [60, 30, 14 + luck * 3, 6 + luck * 2, 2 + luck];
  const avail = SCROLLS.filter((s) => (owned[s.id] || 0) < s.max && (!s.premium || hasFullGame()));
  for (let i = 0; i < n && avail.length; i++) {
    let tot = 0;
    for (const s of avail) tot += weights[s.rarity];
    let r = Math.random() * tot;
    let k = 0;
    for (; k < avail.length; k++) {
      r -= weights[avail[k].rarity];
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
  { id: 'master', branch: 1, x: 750, y: 70, req: ['hardhat', 'second'], capstone: true, name: 'Costume Master', icon: '🎭', max: 1, cost: () => 240, desc: 'CAPSTONE · Start every run wearing a random costume', apply: (s, l) => (s.startCostume += l) },
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
export interface CostumeDef { id: string; name: string; icon: string; color: string; power: string; perks: string; line: string; premium?: boolean; apply: (s: Stats) => void }
export const COSTUMES: CostumeDef[] = [
  { id: 'ghost', name: 'Bedsheet Ghost', icon: '👻', color: '#dfe8ff', power: 'Phase: walk through garden fences, hedges & graves (not district locks)', perks: '+15% chance to dodge hits', line: 'Eek! A real ghost?!', apply: (s) => (s.dodge += 0.15) },
  { id: 'vampire', name: 'Vampire', icon: '🧛', color: '#e0304a', power: 'Bloodsucker: every kill heals 1 HP', perks: '+30% crit damage', line: "A vampire! Please don't bite me!", apply: (s) => (s.critDmg += 0.3) },
  { id: 'witch', name: 'Little Witch', icon: '🧙', color: '#b44dff', power: 'Hex Bolts: auto-casts a homing hex every 1.2s', perks: '+25% skill power', line: 'What a wicked little witch!', apply: (s) => (s.skillPow *= 1.25) },
  { id: 'hero', name: 'Super Kid', icon: '🦸', color: '#4f8aff', power: 'Cape Dash: dashing through monsters damages & knocks them away', perks: '+1 dash, +12% move speed', line: 'Our hero! Here to save Halloween?', apply: (s) => { s.dashCharges += 1; s.move *= 1.12; } },
  { id: 'skeleton', name: 'Skeleton Suit', icon: '💀', color: '#e8e2d0', power: 'Bone Rattle: critical hits splinter into 2 bone shards', perks: '+10% crit chance', line: 'Spooky scary skeleton!', apply: (s) => (s.crit += 0.1) },
  { id: 'pumpkin', name: 'Pumpkin Head', icon: '🎃', color: '#ff8a1e', power: 'Hot Head: getting hit releases a fire nova (3s cooldown)', perks: '+20% Burn chance', line: 'Ha! A walking jack-o-lantern!', apply: (s) => (s.burn += 0.2) },
  { id: 'astronaut', name: 'Space Cadet', icon: '🧑‍🚀', color: '#cfe6ff', power: 'Force Field: shield recharges twice as fast and sooner', perks: '+60 max shield', line: 'One small step for candy-kind!', apply: (s) => { s.maxShield += 60; s.shieldDelay *= 0.5; } },
  { id: 'dino', name: 'T-Rex Hoodie', icon: '🦖', color: '#5fd84a', power: 'Stomp: every 4s a shockwave stuns & hurts nearby monsters', perks: '+40 max HP', line: 'RAWR! A dinosaur at my door!', apply: (s) => (s.maxHp += 40) },
];
COSTUMES.push(
  { id: 'knight', premium: true, name: 'Cardboard Knight', icon: '🛡️', color: '#d0ac76', power: 'Guard: 20% damage reduction', perks: '+50 max shield', line: 'A brave knight at my door!', apply: (s) => { s.maxShield += 50; s.armor = 1 - (1 - s.armor) * 0.8; } },
  { id: 'moth', premium: true, name: 'Moon Moth', icon: '🦋', color: '#b7adce', power: 'Moon Wings: +1 dash and +20% dodge', perks: '+15% movement speed', line: 'Follow the porchlight, little moth!', apply: (s) => { s.dashCharges += 1; s.dodge += 0.2; s.move *= 1.15; } },
);
export const COSTUME_BY_ID = Object.fromEntries(COSTUMES.map((c) => [c.id, c])) as Record<string, CostumeDef>;
export const HOMEOWNERS = ['Mrs. Henderson', 'Mr. Kowalski', 'Old Man Jenkins', 'The Nguyens', 'Ms. Petrova', 'Grandma Rose', 'Coach Miller', 'Dr. Alvarez', 'The Johnsons', 'Mrs. Okafor', 'Mr. Bellamy', 'Aunt Dottie'];
export const GIVE_LINES = ['Here you go, sweetie!', 'Take two, I won\'t tell!', 'Full-size bars this year!', 'Careful out there tonight…', 'Happy Halloween, dear!', 'Ooh, last of the good stuff!'];

const SAVE_KEY = 'tot_survivors_save_v1';
export interface Save { soul: number; talents: Record<string, number>; best: number; hero: number }
export function loadSave(): Save {
  try {
    const s = JSON.parse(storage.getItem(SAVE_KEY) || '');
    const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
    const talents: Record<string, number> = {};
    for (const tal of TALENTS) {
      const rank = Math.min(tal.max, finite(s.talents?.[tal.id]));
      if (rank) talents[tal.id] = rank;
    }
    return { soul: finite(s.soul), talents, best: finite(s.best), hero: Math.min(4, finite(s.hero)) };
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
  { name: 'Maya', title: 'The Fixer', passive: '20% faster reloads', skill: 'Repair Pulse', skillDesc: 'Restore health and shields to you and your active friend, and refill your magazine.', cd: 12, apply: (s: Stats) => (s.reload *= 0.8) },
  { name: 'Leo', title: 'The Night Scout', passive: '+12% movement speed', skill: 'Night Beacon', skillDesc: 'A low moonlit pulse slows nearby monsters and marks a safe escape.', cd: 9, apply: (s: Stats) => (s.move *= 1.12) },
];

export const rarityColor = (r: number) => RARITY[r].color;
