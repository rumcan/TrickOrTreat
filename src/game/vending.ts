import { SCROLLS, WEAPONS, makeWeapon } from './data';
import type { Scroll, Weapon } from './data';
import { VENDING_RARITY_ODDS, VENDING_TREAT_SHARE, VENDING_DUD_SHARE, weightedPick } from './vending-odds';
import type { ClutterKind } from './arcade-clutter';

/** a spin that wins nothing: the junk left on the Starcade's floor (its art is reused for the tile) */
export interface VendingDud { id: string; name: string; quote: string; art: ClutterKind }
export const VENDING_DUDS: VendingDud[] = [
  { id: 'pizza', name: 'Empty Pizza Box', quote: 'Somebody already ate it.', art: 'pizza_box' },
  { id: 'soda', name: 'Flat Soda', quote: 'Warm. No fizz. No power.', art: 'soda' },
  { id: 'popcorn', name: 'Floor Popcorn', quote: 'The five-second rule ran out hours ago.', art: 'popcorn' },
  { id: 'tickets', name: 'Used Tickets', quote: 'Good for one prize. In 1989.', art: 'tickets' },
];
export type VendingPrize = { kind: 'treat'; scroll: Scroll; rarity: number; premium: boolean; key: string; weight: number }
  | { kind: 'weapon'; weapon: Weapon; rarity: number; premium: boolean; key: string; weight: number }
  | { kind: 'dud'; dud: VendingDud; rarity: number; premium: boolean; key: string; weight: number };
export interface VendingSpin { id: number; reel: VendingPrize[]; winner: VendingPrize; stop: number; status: 'spinning' | 'won' | 'claimed' | 'rejected'; cost: number }
export const prizeName = (prize: VendingPrize) => prize.kind === 'treat' ? prize.scroll.name : prize.kind === 'dud' ? prize.dud.name : prize.weapon.def.name;

/** The earned-coin machine can award premium prizes without granting permanent ownership. */
export function vendingCatalogue(owned: Record<string, number>) {
  const catalogue: VendingPrize[] = [];
  for (const scroll of SCROLLS) {
    catalogue.push({ kind: 'treat', scroll, rarity: scroll.rarity, premium: !!scroll.premium, key: `treat:${scroll.id}`, weight: 0 });
  }
  for (const def of WEAPONS) for (let rarity = 0; rarity <= 4; rarity++) {
    const weapon = makeWeapon(def.id, rarity, 1, true);
    catalogue.push({ kind: 'weapon', weapon, rarity, premium: !!def.premium, key: `weapon:${def.id}:${rarity}`, weight: 0 });
  }
  for (let rarity = 0; rarity <= 4; rarity++) {
    const eligible = catalogue.filter(p => p.rarity === rarity
      && (p.kind === 'weapon' || (p.kind === 'treat' && (owned[p.scroll.id] || 0) < p.scroll.max))); // treats stop at their max
    const treats = eligible.filter(p => p.kind === 'treat'), guns = eligible.filter(p => p.kind === 'weapon');
    const treatShare = guns.length ? treats.length ? VENDING_TREAT_SHARE : 0 : 1;
    for (const p of treats) p.weight = VENDING_RARITY_ODDS[rarity] * treatShare / treats.length;
    for (const p of guns) p.weight = VENDING_RARITY_ODDS[rarity] * (1 - treatShare) / guns.length;
  }
  // duds take their share on top of the real prizes, whose odds among themselves stay as they were
  const real = catalogue.reduce((sum, p) => sum + p.weight, 0), duds = real * VENDING_DUD_SHARE / (1 - VENDING_DUD_SHARE);
  for (const dud of VENDING_DUDS) catalogue.push({ kind: 'dud', dud, rarity: 0, premium: false, key: `dud:${dud.id}`, weight: duds / VENDING_DUDS.length });
  return catalogue;
}

export function createVendingSpin(catalogue: VendingPrize[], id: number, cost: number, random = Math.random): VendingSpin | null {
  const winner = weightedPick(catalogue, random);
  if (!winner) return null;
  // The prize is rolled ONCE, before animation. Reel decoys never affect the result.
  const stop = 42;
  const reel = Array.from({ length: stop + 5 }, () => catalogue[Math.min(catalogue.length - 1, Math.floor(random() * catalogue.length))]);
  // Always include inspectable premium samples in the visible settled neighbourhood.
  const premiumTreat = catalogue.find(p => p.premium && p.kind === 'treat');
  const premiumGun = catalogue.find(p => p.premium && p.kind === 'weapon' && p.rarity === 3);
  if (premiumTreat) reel[stop - 1] = premiumTreat;
  if (premiumGun) reel[stop + 1] = premiumGun;
  reel[stop] = winner;
  return { id, reel, stop, winner, status: 'spinning', cost };
}
