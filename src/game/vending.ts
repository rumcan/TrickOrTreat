import { SCROLLS, WEAPONS, makeWeapon } from './data';
import type { Scroll, Weapon } from './data';
import { VENDING_RARITY_ODDS, VENDING_TREAT_SHARE, weightedPick } from './vending-odds';

export type VendingPrize = { kind: 'treat'; scroll: Scroll; rarity: number; premium: boolean; key: string; weight: number }
  | { kind: 'weapon'; weapon: Weapon; rarity: number; premium: boolean; key: string; weight: number };
export interface VendingSpin { id: number; reel: VendingPrize[]; winner: VendingPrize; stop: number; status: 'spinning' | 'won' | 'claimed' | 'rejected'; cost: number }
export const prizeName = (prize: VendingPrize) => prize.kind === 'treat' ? prize.scroll.name : prize.weapon.def.name;

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
      && (p.kind === 'weapon' || p.scroll.max > 1 || !(owned[p.scroll.id] > 0)));
    const treats = eligible.filter(p => p.kind === 'treat'), guns = eligible.filter(p => p.kind === 'weapon');
    const treatShare = guns.length ? treats.length ? VENDING_TREAT_SHARE : 0 : 1;
    for (const p of treats) p.weight = VENDING_RARITY_ODDS[rarity] * treatShare / treats.length;
    for (const p of guns) p.weight = VENDING_RARITY_ODDS[rarity] * (1 - treatShare) / guns.length;
  }
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
